"""Purchasing service layer: build a PO, then receive it into stock."""
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from accounting.models import ExpenseCategory, LedgerEntry
from accounting.services import record_expense, resolve_ledger_account
from inventory.models import MovementType
from inventory.services import apply_movement

from .models import PurchaseOrder, PurchaseOrderItem, PurchasePayment, SupplierPayment

ZERO = Decimal("0")

# Purchase payments are booked to this expense category so they show up in the
# shop's accounting / expense views.
PURCHASE_EXPENSE_CATEGORY = "Product Purchase"


def _purchase_expense_category(shop):
    cat, _ = ExpenseCategory.all_objects.get_or_create(
        shop_id=shop.id, name=PURCHASE_EXPENSE_CATEGORY
    )
    return cat


def post_purchase_payment_to_accounting(*, shop, po, amount, when=None, created_by=None, method=""):
    """
    Post a product-purchase payment to the accounting ledger as an Inventory Investment (not an operating expense).

    * amount > 0  → cash/bank/mobile-money paid to supplier ⇒ Outflow in LedgerEntry (source_type="PurchasePayment")
    * amount < 0  → refund from supplier ⇒ Inflow in LedgerEntry (source_type="PurchaseRefund")
    """
    amount = Decimal(amount)
    if amount == 0:
        return None
    acct = resolve_ledger_account(method)
    if amount > 0:
        return LedgerEntry.all_objects.create(
            shop_id=shop.id, account=acct, amount=-amount,
            source_type="PurchasePayment", source_id=str(po.id),
            description=f"Purchase payment {po.po_number}",
        )
    return LedgerEntry.all_objects.create(
        shop_id=shop.id, account=acct, amount=-amount,
        source_type="PurchaseRefund", source_id=str(po.id),
        description=f"Purchase refund {po.po_number}",
    )


@transaction.atomic
def add_purchase_payment(*, po, amount, method=PurchasePayment.Method.CASH,
                         reference="", note="", created_by=None):
    """
    Record a partial (or full) payment against a purchase order. Bumps
    ``po.paid``, lowers the supplier's cached ``due_balance`` and posts the
    payment to accounting. Rejects amounts above the outstanding PO due.
    """
    amount = Decimal(amount)
    if amount <= 0:
        raise ValueError("Amount must be positive.")
    due = (po.total or ZERO) - (po.paid or ZERO)
    if amount > due:
        raise ValueError(f"Amount exceeds PO due of {due}.")

    payment = PurchasePayment.objects.create(
        shop_id=po.shop_id, purchase_order=po, amount=amount, method=method,
        reference=reference, note=note, created_by=created_by,
    )
    po.paid = (po.paid or ZERO) + amount
    po.save(update_fields=["paid"])

    if po.supplier:
        supplier = po.supplier
        supplier.due_balance = (supplier.due_balance or ZERO) - amount
        supplier.save(update_fields=["due_balance"])

    if method != PurchasePayment.Method.SETTLEMENT:
        post_purchase_payment_to_accounting(
            shop=po.shop, po=po, amount=amount, created_by=created_by, method=method,
        )
    return payment


@transaction.atomic
def pay_supplier(*, supplier, amount, method=SupplierPayment.Method.CASH,
                 reference="", note="", created_by=None):
    """
    Pay down a supplier's outstanding payable. Records a SupplierPayment,
    reduces the supplier's cached ``due_balance``, and writes a cash outflow.
    Raises if the amount exceeds what is currently owed.
    """
    amount = Decimal(amount)
    if amount <= 0:
        raise ValueError("Amount must be positive.")
    outstanding = supplier.due_balance or ZERO
    if amount > outstanding:
        raise ValueError(f"Amount exceeds outstanding due of {outstanding}.")

    payment = SupplierPayment.objects.create(
        shop_id=supplier.shop_id, supplier=supplier, amount=amount,
        method=method, reference=reference, note=note, created_by=created_by,
    )
    supplier.due_balance = outstanding - amount
    supplier.save(update_fields=["due_balance"])
    
    if method != SupplierPayment.Method.SETTLEMENT:
        acct = resolve_ledger_account(method)
        LedgerEntry.objects.create(
            shop_id=supplier.shop_id, account=acct, amount=-amount,
            source_type="SupplierPayment", source_id=str(payment.id),
            description=f"Payment ({method}) to {supplier.name}",
        )


    # Allocate payment across open PurchaseOrders in FIFO order
    try:
        from django.db.models import F
        rem = amount
        open_pos = list(
            PurchaseOrder.objects.filter(
                supplier=supplier,
                paid__lt=F("total")
            ).order_by("order_date", "id")
        )
        for po in open_pos:
            if rem <= 0:
                break
            po_due = (po.total or ZERO) - (po.paid or ZERO)
            if po_due > 0:
                portion = min(rem, po_due)
                po_method = method if method in PurchasePayment.Method.values else PurchasePayment.Method.CASH
                PurchasePayment.objects.create(
                    shop_id=po.shop_id, purchase_order=po, amount=portion,
                    method=po_method, reference=reference,
                    note=f"Supplier Payment #{payment.id}" if not note else note,
                    created_by=created_by,
                )
                po.paid = (po.paid or ZERO) + portion
                po.save(update_fields=["paid"])
                rem -= portion
    except Exception:
        pass

    return payment


def _materialize_units_with_warranty(po, item):
    """For a received PO line, create one ``ProductUnit`` per piece if explicit barcodes
    were provided or if the product offers a warranty. Lets a bulk-bought batch be returned
    one unit at a time.
    """
    from django.utils import timezone as _tz

    from catalog.models import ProductUnit
    from service.models import Warranty

    product = item.product
    months = getattr(product, "warranty_months", 0) or 0
    qty = int(item.quantity or 0)
    if qty <= 0:
        return
    
    explicit_barcodes = item.barcodes or []
    # If no explicit barcodes and no warranty, skip
    if not explicit_barcodes and months <= 0:
        return

    start = _tz.localdate()
    for n in range(1, qty + 1):
        if n - 1 < len(explicit_barcodes):
            serial = explicit_barcodes[n - 1]
        else:
            if months <= 0:
                # If they didn't provide enough barcodes and there's no warranty, just skip the rest
                break
            serial = f"{po.po_number}-{item.id}-{n:03d}"
            
        unit = ProductUnit.all_objects.create(
            shop_id=po.shop_id, product=product, barcode=serial,
            status=ProductUnit.Status.IN_STOCK,
            cost_price=item.unit_cost, selling_price=product.selling_price,
            warranty_months=months,
        )
        if months > 0:
            Warranty.objects.create(
                shop_id=po.shop_id, product=product, product_unit=unit,
                serial_no=serial, period_months=months, start_date=start,
            )


def _next_po_number(shop) -> str:
    count = PurchaseOrder.all_objects.filter(shop_id=shop.id).count() + 1
    return f"PO-{count:06d}"


@transaction.atomic
def create_purchase_order(
    *, shop, supplier, items, branch=None, discount=ZERO, order_date=None, due_date=None,
    note="", created_by=None,
):
    """``items``: dicts with ``product``, optional ``variation``, ``quantity``,
    ``unit_cost``."""
    po = PurchaseOrder.objects.create(
        shop=shop, supplier=supplier, branch=branch,
        po_number=_next_po_number(shop),
        status=PurchaseOrder.Status.ORDERED,
        order_date=order_date or timezone.now().date(),
        due_date=due_date,
        discount=Decimal(discount or 0), note=note, created_by=created_by,
    )
    subtotal = ZERO
    for row in items:
        item = PurchaseOrderItem.objects.create(
            shop=shop, purchase_order=po, product=row["product"],
            variation=row.get("variation"),
            quantity=Decimal(row["quantity"]), unit_cost=Decimal(row["unit_cost"]),
            barcodes=row.get("barcodes") or [],
        )
        subtotal += item.subtotal

    po.subtotal = subtotal
    po.total = subtotal - po.discount
    po.save(update_fields=["subtotal", "total"])
    return po


@transaction.atomic
def receive_purchase_order(*, po, paid=ZERO, due_date=None, update_cost=True, created_by=None,
                           payment_method=PurchasePayment.Method.CASH):
    """
    Receive an ordered PO into stock: write PURCHASE_IN movements for each line,
    optionally refresh product cost, record supplier due + any payment.
    """
    if po.status == PurchaseOrder.Status.RECEIVED:
        raise ValueError("Purchase order already received.")

    # Guard the (shop, product, barcode) unique constraint up front so a clash
    # returns a clear message instead of a raw IntegrityError / 500. Uniqueness
    # is PER PRODUCT: the same barcode on a different product is allowed (common
    # in retail), so a clash is only a duplicate within the *same* product.
    from catalog.models import ProductUnit
    clashes = set()
    for it in po.items.all():
        bcs = [b for b in (it.barcodes or []) if b]
        if not bcs:
            continue
        counts = {}
        for b in bcs:
            counts[b] = counts.get(b, 0) + 1
        dup_in_batch = {b for b, c in counts.items() if c > 1}
        existing = set(
            ProductUnit.all_objects.filter(
                shop_id=po.shop_id, product_id=it.product_id, barcode__in=bcs
            ).values_list("barcode", flat=True)
        )
        clashes |= existing | dup_in_batch
    if clashes:
        raise ValueError(
            "These barcode(s) already exist for the same product or are repeated "
            "in this batch: " + ", ".join(sorted(clashes))
            + ". Please remove or change them and try again."
        )

    from decimal import Decimal
    for item in po.items.select_related("product", "variation").all():
        product = item.product
        # Handle UOM Conversion for Bulk Purchases (e.g., Drums/Boxes to Liters/Pcs)
        multiplier = getattr(product, "purchase_multiplier", Decimal("1.0")) or Decimal("1.0")
        effective_qty = (item.quantity or Decimal("0")) * multiplier
        
        # Calculate cost per BASE unit (Liter) instead of BULK unit (Drum)
        if multiplier > 0 and item.unit_cost is not None:
            effective_unit_cost = item.unit_cost / multiplier
        else:
            effective_unit_cost = item.unit_cost or Decimal("0")
            
        apply_movement(
            shop=po.shop, product=product, variation=item.variation,
            movement_type=MovementType.PURCHASE_IN, quantity=effective_qty,
            unit_cost=effective_unit_cost, branch=po.branch,
            reference_type="PurchaseOrder", reference_id=po.id, created_by=created_by,
        )
        if update_cost:
            # Latest purchase cost (per base unit) becomes the product's standard cost.
            product.cost_price = effective_unit_cost
            # Also sync selling_price when a bulk purchase multiplier is in play:
            # if the stored selling_price is still at drum/pack level (i.e. it's
            # > 80 % of the drum/pack cost), divide it by the same multiplier
            # so it stays consistent as a per-base-unit price.
            update_fields = ["cost_price"]
            if multiplier > 1 and product.selling_price is not None:
                drum_cost = effective_unit_cost * multiplier
                if product.selling_price > drum_cost * Decimal("0.8"):
                    product.selling_price = product.selling_price / multiplier
                    update_fields.append("selling_price")
            product.save(update_fields=update_fields)
        # Bulk purchase → per-unit warranty tracking: one ProductUnit + Warranty
        # per received piece, so the batch is bought together but returned one
        # unit at a time.
        _materialize_units_with_warranty(po, item)

    paid = Decimal(paid or 0)
    po.paid = paid
    po.status = PurchaseOrder.Status.RECEIVED
    po.received_at = timezone.now()
    if due_date:
        po.due_date = due_date
        po.save(update_fields=["paid", "status", "received_at", "due_date"])
    else:
        po.save(update_fields=["paid", "status", "received_at"])

    # Supplier owed the unpaid remainder; record any cash outflow.
    supplier = po.supplier
    if supplier:
        supplier.due_balance = (supplier.due_balance or ZERO) + (po.total - paid)
        if due_date and (po.total - paid) > 0:
            supplier.due_date = due_date
            supplier.save(update_fields=["due_balance", "due_date"])
        else:
            supplier.save(update_fields=["due_balance"])

    if paid > 0:
        # An initial payment at receive is a product-purchase payment too:
        # classify it and post to accounting (Expense row + cash ledger).
        post_purchase_payment_to_accounting(
            shop=po.shop, po=po, amount=paid, created_by=created_by,
            method=payment_method,
        )
    return po


@transaction.atomic
def create_purchase_return(*, po, lines, reason="", refund_amount=None, created_by=None):
    """
    Return damaged or unwanted items from a received PO back to the supplier.
    lines: list of {"item_id": int, "quantity": Decimal}
    Deducts stock via ADJUST_OUT and reduces supplier payable due_balance.
    """
    shop = po.shop
    total_return_value = ZERO
    for line in lines:
        po_item = PurchaseOrderItem.objects.get(id=line["item_id"], purchase_order=po)
        qty = Decimal(str(line["quantity"]))
        if qty <= 0 or qty > po_item.quantity_received:
            raise ValueError(f"Invalid return quantity {qty} for item {po_item.id}.")
        
        unit_cost = po_item.unit_cost or po_item.product.cost_price or ZERO
        line_val = qty * unit_cost
        total_return_value += line_val

        if po_item.product.track_inventory:
            apply_movement(
                shop=shop, product=po_item.product, movement_type=MovementType.ADJUST_OUT,
                quantity=qty, unit_cost=unit_cost, reference_type="PurchaseReturn",
                reference_id=str(po.id), note=f"Return to supplier: {reason or po.po_number}",
                created_by=created_by,
            )

    actual_refund = Decimal(str(refund_amount)) if refund_amount is not None else total_return_value
    if po.supplier and actual_refund > 0:
        supplier = po.supplier
        supplier.due_balance = max(ZERO, (supplier.due_balance or ZERO) - actual_refund)
        supplier.save(update_fields=["due_balance"])
    
    return total_return_value
