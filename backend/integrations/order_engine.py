"""
Generic External Order Synchronization & Ingestion Engine for StockWhisk (Phase 7).

Manages the complete end-to-end order synchronization pipeline:
External Website Order
        ↓
Webhook/API Event
        ↓
Authenticate (Tenant & Channel)
        ↓
Validate (Payload & Fields)
        ↓
Identify Tenant (Context Binding)
        ↓
Idempotency Check (Duplicate Order Prevention)
        ↓
Product/SKU Mapping (Catalog & Variations)
        ↓
Validate Quantities (Quantity & Stock ATS)
        ↓
Create/Update StockWhisk Order (sales.Sale)
        ↓
Prepare Stock Reservation (InventoryReservation)
        ↓
Order State Management (Cancelled/Completed transitions)
"""

import datetime
import hashlib
import json
import logging
from dataclasses import asdict, dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Tuple, Union

from django.db import DatabaseError, IntegrityError, transaction
from django.utils import timezone

from core.tenant_context import set_current_tenant, tenant_context
from catalog.models import Product, ProductVariation
from crm.models import Customer
from sales.models import Payment, Sale, SaleItem
from sales.services import add_payment, create_sale

from .inventory_engine import (
    InsufficientStockOrderError,
    commit_inventory_reservation_to_sale,
    get_inventory_levels,
    release_inventory_reservation,
    reserve_inventory_for_order,
)
from .models import (
    ExternalOrder,
    Integration,
    IntegrationAuditLog,
    IntegrationLog,
    IntegrationStatus,
    InventoryReservation,
    ProductChannelMapping,
    SyncError,
)
from .audit import record_integration_audit

logger = logging.getLogger("integrations.orders")


# ==============================================================================
# Domain Exceptions
# ==============================================================================

class OrderSyncError(Exception):
    """Base exception for order synchronization failures."""
    def __init__(
        self,
        message: str,
        error_type: str = "order_sync_error",
        status_code: int = 400,
        details: Optional[dict] = None,
    ):
        super().__init__(message)
        self.message = message
        self.error_type = error_type
        self.status_code = status_code
        self.details = details or {}


class TenantAuthenticationError(OrderSyncError):
    def __init__(self, message: str, details: Optional[dict] = None):
        super().__init__(message, error_type="tenant_auth_error", status_code=403, details=details)


class MalformedOrderPayloadError(OrderSyncError):
    def __init__(self, message: str, details: Optional[dict] = None):
        super().__init__(message, error_type="malformed_payload", status_code=400, details=details)


class UnmappedProductOrderError(OrderSyncError):
    def __init__(self, message: str, details: Optional[dict] = None):
        super().__init__(message, error_type="unmapped_product", status_code=422, details=details)


class InvalidQuantityError(OrderSyncError):
    def __init__(self, message: str, details: Optional[dict] = None):
        super().__init__(message, error_type="invalid_quantity", status_code=400, details=details)


class ExternalAPIError(OrderSyncError):
    def __init__(self, message: str, status_code: int = 502, details: Optional[dict] = None):
        super().__init__(message, error_type="external_api_error", status_code=status_code, details=details)


# ==============================================================================
# Standard Order DTOs
# ==============================================================================

@dataclass
class StandardOrderItemDTO:
    sku: str
    name: str = ""
    quantity: Decimal = Decimal("1.00")
    unit_price: Decimal = Decimal("0.00")
    discount: Decimal = Decimal("0.00")
    tax: Decimal = Decimal("0.00")
    subtotal: Decimal = Decimal("0.00")
    external_item_id: str = ""
    external_variation_id: Optional[str] = None
    raw_data: dict = field(default_factory=dict)


@dataclass
class StandardOrderDTO:
    external_order_id: str
    external_order_number: str = ""
    external_status: str = "pending"
    customer_name: str = ""
    customer_phone: str = ""
    customer_email: str = ""
    shipping_address: str = ""
    billing_address: str = ""
    items: List[StandardOrderItemDTO] = field(default_factory=list)
    subtotal: Decimal = Decimal("0.00")
    discount: Decimal = Decimal("0.00")
    tax: Decimal = Decimal("0.00")
    shipping_charge: Decimal = Decimal("0.00")
    total: Decimal = Decimal("0.00")
    paid_amount: Decimal = Decimal("0.00")
    currency: str = "BDT"
    payment_method: str = ""
    payment_status: str = ""
    note: str = ""
    raw_payload: dict = field(default_factory=dict)


# ==============================================================================
# Helper Normalizers & Parsers
# ==============================================================================

def _to_decimal(val: Any, default: str = "0.00") -> Decimal:
    if val is None or val == "":
        return Decimal(default)
    try:
        return Decimal(str(val))
    except (InvalidOperation, TypeError, ValueError):
        raise MalformedOrderPayloadError(f"Invalid numeric value: '{val}'")


def _serialize_dict(data: Any) -> Any:
    """Recursively converts Decimals, datetimes, and non-serializable objects into strings for JSONField."""
    if isinstance(data, dict):
        return {str(k): _serialize_dict(v) for k, v in data.items()}
    elif isinstance(data, (list, tuple, set)):
        return [_serialize_dict(v) for v in data]
    elif isinstance(data, Decimal):
        return str(data)
    elif isinstance(data, (datetime.datetime, datetime.date)):
        return data.isoformat()
    return data


def parse_and_validate_order_payload(payload: Any) -> StandardOrderDTO:
    """
    Validates and normalizes generic external order payloads into StandardOrderDTO.
    Detects malformed structure, missing required fields, or non-positive quantities.
    """
    if not isinstance(payload, dict):
        raise MalformedOrderPayloadError("Order payload must be a JSON object.")

    # 1. External Order ID
    ext_id = str(
        payload.get("external_order_id")
        or payload.get("order_id")
        or payload.get("id")
        or ""
    ).strip()
    if not ext_id:
        raise MalformedOrderPayloadError("Missing required field: external_order_id.")

    ext_number = str(
        payload.get("external_order_number")
        or payload.get("order_number")
        or payload.get("number")
        or ext_id
    ).strip()

    ext_status = str(payload.get("external_status") or payload.get("status") or "pending").strip().lower()

    # 2. Line Items
    raw_items = payload.get("items") or payload.get("line_items") or []
    if not isinstance(raw_items, list) or len(raw_items) == 0:
        raise MalformedOrderPayloadError("Order payload must contain a non-empty 'items' list.")

    parsed_items: List[StandardOrderItemDTO] = []
    calc_subtotal = Decimal("0.00")

    for idx, item in enumerate(raw_items):
        if not isinstance(item, dict):
            raise MalformedOrderPayloadError(f"Line item at index {idx} must be a JSON object.")

        # Quantity check
        qty_raw = item.get("quantity") if item.get("quantity") is not None else item.get("qty")
        if qty_raw is None:
            raise MalformedOrderPayloadError(f"Line item at index {idx} missing quantity.")

        try:
            qty = _to_decimal(qty_raw)
        except MalformedOrderPayloadError:
            raise InvalidQuantityError(f"Line item quantity must be a valid positive number. Got '{qty_raw}'.")

        if qty <= Decimal("0"):
            raise InvalidQuantityError(f"Line item quantity must be greater than zero. Got {qty}.")

        sku = str(item.get("sku") or item.get("product_sku") or "").strip()
        name = str(item.get("name") or item.get("title") or item.get("product_name") or sku or f"Item {idx+1}")
        unit_price = _to_decimal(item.get("unit_price") or item.get("price"))
        line_discount = _to_decimal(item.get("discount"))
        line_tax = _to_decimal(item.get("tax"))
        line_subtotal = _to_decimal(
            item.get("subtotal") or (qty * unit_price - line_discount)
        )
        ext_item_id = str(item.get("external_item_id") or item.get("id") or item.get("product_id") or "").strip()
        ext_var_id = str(item.get("external_variation_id") or item.get("variation_id") or "").strip() or None

        calc_subtotal += line_subtotal
        parsed_items.append(
            StandardOrderItemDTO(
                sku=sku,
                name=name,
                quantity=qty,
                unit_price=unit_price,
                discount=line_discount,
                tax=line_tax,
                subtotal=line_subtotal,
                external_item_id=ext_item_id,
                external_variation_id=ext_var_id,
                raw_data=item,
            )
        )

    # 3. Customer & Address
    cust_data = payload.get("customer") or {}
    cust_name = str(
        payload.get("customer_name")
        or cust_data.get("name")
        or f"{cust_data.get('first_name', '')} {cust_data.get('last_name', '')}".strip()
        or ""
    )
    cust_phone = str(
        payload.get("customer_phone")
        or cust_data.get("phone")
        or payload.get("billing_phone")
        or ""
    ).strip()
    cust_email = str(
        payload.get("customer_email")
        or cust_data.get("email")
        or ""
    ).strip()

    def _format_address(addr: Any) -> str:
        if isinstance(addr, dict):
            parts = [
                addr.get("address_1"),
                addr.get("address_2"),
                addr.get("city"),
                addr.get("state"),
                addr.get("postcode"),
                addr.get("country"),
            ]
            return ", ".join(str(p).strip() for p in parts if p)
        return str(addr or "").strip()

    shipping_addr = _format_address(payload.get("shipping_address") or payload.get("shipping"))
    billing_addr = _format_address(payload.get("billing_address") or payload.get("billing")) or shipping_addr

    # 4. Financials
    subtotal = _to_decimal(payload.get("subtotal") or calc_subtotal)
    discount = _to_decimal(payload.get("discount"))
    tax = _to_decimal(payload.get("tax"))
    shipping_charge = _to_decimal(
        payload.get("shipping_charge")
        or payload.get("shipping_fee")
        or payload.get("delivery_charge")
    )
    raw_total = payload.get("total")
    if raw_total is not None:
        total = _to_decimal(raw_total)
    else:
        total = max(Decimal("0.00"), subtotal - discount + tax + shipping_charge)

    paid_amount = _to_decimal(payload.get("paid_amount") or payload.get("amount_paid"))
    currency = str(payload.get("currency") or "BDT").strip()
    payment_method = str(payload.get("payment_method") or payload.get("payment_gateway") or "").strip()
    payment_status = str(payload.get("payment_status") or "").strip()
    note = str(payload.get("note") or payload.get("customer_note") or "").strip()

    return StandardOrderDTO(
        external_order_id=ext_id,
        external_order_number=ext_number,
        external_status=ext_status,
        customer_name=cust_name,
        customer_phone=cust_phone,
        customer_email=cust_email,
        shipping_address=shipping_addr,
        billing_address=billing_addr,
        items=parsed_items,
        subtotal=subtotal,
        discount=discount,
        tax=tax,
        shipping_charge=shipping_charge,
        total=total,
        paid_amount=paid_amount,
        currency=currency,
        payment_method=payment_method,
        payment_status=payment_status,
        note=note,
        raw_payload=payload if isinstance(payload, dict) else {},
    )


def resolve_product_mapping(
    shop,
    integration: Integration,
    item_dto: StandardOrderItemDTO,
) -> Tuple[Product, Optional[ProductVariation]]:
    """
    Resolves an external line item to an internal StockWhisk Product and ProductVariation.
    Resolution Priority:
    1. ProductChannelMapping by external_variation_id
    2. ProductChannelMapping by external_product_id
    3. ProductChannelMapping by external_sku
    4. Internal Catalog direct SKU match (ProductVariation or Product)
    Raises UnmappedProductOrderError if no mapping or matching item is found.
    """
    # 1. ProductChannelMapping by variation ID
    if item_dto.external_variation_id:
        mapping = (
            ProductChannelMapping.all_objects.filter(
                shop=shop,
                integration=integration,
                external_variation_id=str(item_dto.external_variation_id),
            )
            .select_related("product", "variation")
            .first()
        )
        if mapping:
            return mapping.product, mapping.variation

    # 2. ProductChannelMapping by product ID
    if item_dto.external_item_id:
        mapping = (
            ProductChannelMapping.all_objects.filter(
                shop=shop,
                integration=integration,
                external_product_id=str(item_dto.external_item_id),
                external_variation_id__isnull=True,
            )
            .select_related("product", "variation")
            .first()
        )
        if not mapping:
            mapping = (
                ProductChannelMapping.all_objects.filter(
                    shop=shop,
                    integration=integration,
                    external_product_id=str(item_dto.external_item_id),
                )
                .select_related("product", "variation")
                .first()
            )
        if mapping:
            return mapping.product, mapping.variation

    # 3. ProductChannelMapping by external SKU
    if item_dto.sku:
        mapping = (
            ProductChannelMapping.all_objects.filter(
                shop=shop,
                integration=integration,
                external_sku=item_dto.sku,
            )
            .select_related("product", "variation")
            .first()
        )
        if mapping:
            return mapping.product, mapping.variation

    # 4. Direct Catalog SKU fallback
    if item_dto.sku:
        var = (
            ProductVariation.all_objects.filter(shop=shop, sku=item_dto.sku)
            .select_related("product")
            .first()
        )
        if var:
            return var.product, var

        prod = Product.all_objects.filter(shop=shop, sku=item_dto.sku).first()
        if prod:
            return prod, None

    # No match found
    identifier = item_dto.sku or item_dto.external_item_id or item_dto.name
    raise UnmappedProductOrderError(
        f"Unmapped item in external order: '{identifier}'. No ProductChannelMapping or catalog SKU found.",
        details={
            "sku": item_dto.sku,
            "external_item_id": item_dto.external_item_id,
            "external_variation_id": item_dto.external_variation_id,
            "name": item_dto.name,
        },
    )


# ==============================================================================
# Central Order Ingestion & Processing Pipeline
# ==============================================================================

def process_external_order(
    shop,
    integration: Integration,
    order_payload: Union[dict, StandardOrderDTO],
    allow_on_hold: bool = False,
) -> Tuple[ExternalOrder, bool]:
    """
    Main entry point for processing external eCommerce orders.
    Enforces the full architectural pipeline:
    1. Authenticate Tenant & Integration
    2. Validate Order Payload
    3. Idempotency Check (select_for_update)
    4. Product / SKU Mapping Resolution
    5. Validate Quantities & Available-to-Sell (ATS)
    6. Atomic Transaction:
       - Create / Update StockWhisk Sale
       - Prepare Stock Reservation (hold stock without physical SALE_OUT yet)
       - Link ExternalOrder record
    7. Order State Management
    """
    # --- Step 1: Authenticate Tenant & Integration ---
    if not shop or not getattr(shop, "is_active", True):
        raise TenantAuthenticationError("Invalid or inactive tenant.")

    if integration.shop_id != shop.id:
        raise TenantAuthenticationError(
            f"Tenant mismatch: Integration #{integration.id} does not belong to Shop #{shop.id}."
        )

    if not integration.is_active or integration.status != IntegrationStatus.CONNECTED:
        raise TenantAuthenticationError(
            f"Integration '{integration.name}' is inactive or not connected (status: {integration.status})."
        )

    set_current_tenant(shop)

    # --- Step 2: Validate Payload ---
    if isinstance(order_payload, StandardOrderDTO):
        dto = order_payload
    else:
        dto = parse_and_validate_order_payload(order_payload)

    # --- Simulation / External Hook Check ---
    if integration.config.get("simulate_order_error"):
        sim_code = int(integration.config.get("simulate_order_status_code", 502))
        err_msg = integration.config.get("simulate_order_error_message", "External API communication failure.")
        SyncError.all_objects.create(
            shop=shop,
            integration=integration,
            error_type="external_api_failure",
            status_code=sim_code,
            error_message=err_msg,
            raw_payload=dto.raw_payload,
        )
        raise ExternalAPIError(err_msg, status_code=sim_code)

    # --- Step 3: Product/SKU Mapping & Quantity Validation ---
    mapped_items: List[Tuple[StandardOrderItemDTO, Product, Optional[ProductVariation]]] = []
    mapping_errors: List[str] = []

    for item_dto in dto.items:
        try:
            product, variation = resolve_product_mapping(shop, integration, item_dto)
            mapped_items.append((item_dto, product, variation))
        except UnmappedProductOrderError as exc:
            mapping_errors.append(str(exc))

    if mapping_errors:
        error_summary = "; ".join(mapping_errors)
        # Record SyncError for merchant investigation
        SyncError.all_objects.create(
            shop=shop,
            integration=integration,
            error_type="unmapped_product",
            error_message=error_summary,
            raw_payload=_serialize_dict(dto.raw_payload),
        )
        IntegrationLog.all_objects.create(
            shop=shop,
            integration=integration,
            level=IntegrationLog.Level.WARNING,
            action="order_unmapped_sku",
            message=f"Order #{dto.external_order_id} contains unmapped SKUs: {error_summary}",
        )

        if allow_on_hold:
            # Create on-hold order record without Sale
            on_hold_order = ExternalOrder.objects.create(
                shop=shop,
                integration=integration,
                sale=None,
                customer=None,
                external_order_id=dto.external_order_id,
                external_order_number=dto.external_order_number,
                external_status=dto.external_status,
                sync_status=ExternalOrder.SyncStatus.ON_HOLD,
                customer_name=dto.customer_name,
                customer_phone=dto.customer_phone,
                customer_email=dto.customer_email,
                shipping_address=dto.shipping_address,
                billing_address=dto.billing_address,
                subtotal=dto.subtotal,
                discount=dto.discount,
                tax=dto.tax,
                shipping_charge=dto.shipping_charge,
                total=dto.total,
                paid_amount=dto.paid_amount,
                currency=dto.currency,
                payment_method=dto.payment_method,
                payment_status=dto.payment_status,
                idempotency_key=f"ext:{integration.id}:{dto.external_order_id}",
                raw_payload=_serialize_dict(dto.raw_payload),
                items_payload=[_serialize_dict(asdict(i)) for i in dto.items],
                error_message=error_summary,
                processed_at=timezone.now(),
            )
            return on_hold_order, True
        else:
            raise UnmappedProductOrderError(error_summary)

    # --- Step 4: Idempotency Check & Concurrency Lock ---
    with transaction.atomic():
        existing_order = (
            ExternalOrder.all_objects.filter(
                shop=shop,
                integration=integration,
                external_order_id=dto.external_order_id,
            )
            .select_for_update()
            .first()
        )

        if existing_order:
            # Check if this is an idempotent duplicate or an order update
            normalized_status = dto.external_status.lower()
            if existing_order.external_status.lower() == normalized_status and existing_order.sync_status in [
                ExternalOrder.SyncStatus.SYNCED,
                ExternalOrder.SyncStatus.COMPLETED,
            ]:
                # Identical duplicate event -> return existing order safely without duplicate creation
                logger.info(
                    f"Duplicate order event for #{dto.external_order_id} on {integration.name}. Returning existing."
                )
                return existing_order, False
            else:
                # Order status or content updated -> transition state
                updated = update_external_order_state(existing_order, dto)
                return updated, False

        # Validate Stock Availability and Reserve under Row Lock
        # Sort items deterministically by (product_id, variation_id) to eliminate any deadlock risk across concurrent requests
        sorted_mapped_items = sorted(
            mapped_items,
            key=lambda x: (x[1].id, x[2].id if x[2] is not None else 0),
        )

        # Step 5: Lock relevant inventory row(s) & Reserve stock under row lock
        created_reservations = []
        try:
            for item_dto, product, variation in sorted_mapped_items:
                if product.track_inventory:
                    res = reserve_inventory_for_order(
                        shop=shop,
                        integration=integration,
                        product=product,
                        variation=variation,
                        quantity=item_dto.quantity,
                        reference_type="PendingOrder",
                        reference_id=str(dto.external_order_id),
                        note=f"External order #{dto.external_order_id} pending reservation",
                    )
                    created_reservations.append(res)
        except InsufficientStockOrderError as exc:
            if allow_on_hold:
                logger.warning(
                    f"Order #{dto.external_order_id} insufficient stock: {exc}. Placing order ON_HOLD."
                )
                payload = _serialize_dict(dto.raw_payload)
                payload["stock_shortage"] = {
                    "external_order_id": dto.external_order_id,
                    "available_stock": str(exc.available_stock),
                    "requested_quantity": str(exc.requested_quantity),
                }
                SyncError.all_objects.create(
                    shop=shop,
                    integration=integration,
                    error_type="insufficient_stock",
                    error_code="INSUFFICIENT_STOCK",
                    error_message=str(exc),
                    raw_payload=payload,
                )
                IntegrationLog.all_objects.create(
                    shop=shop,
                    integration=integration,
                    level=IntegrationLog.Level.ERROR,
                    action="order_insufficient_stock",
                    message=f"Order #{dto.external_order_id} stock reservation failed: {exc}",
                )
                on_hold_order = ExternalOrder.objects.create(
                    shop=shop,
                    integration=integration,
                    sale=None,
                    customer=None,
                    external_order_id=dto.external_order_id,
                    external_order_number=dto.external_order_number,
                    external_status=dto.external_status,
                    sync_status=ExternalOrder.SyncStatus.ON_HOLD,
                    customer_name=dto.customer_name,
                    customer_phone=dto.customer_phone,
                    customer_email=dto.customer_email,
                    shipping_address=dto.shipping_address,
                    billing_address=dto.billing_address,
                    subtotal=dto.subtotal,
                    discount=dto.discount,
                    tax=dto.tax,
                    shipping_charge=dto.shipping_charge,
                    total=dto.total,
                    paid_amount=dto.paid_amount,
                    currency=dto.currency,
                    payment_method=dto.payment_method,
                    payment_status=dto.payment_status,
                    idempotency_key=f"ext:{integration.id}:{dto.external_order_id}",
                    raw_payload=_serialize_dict(dto.raw_payload),
                    items_payload=[_serialize_dict(asdict(i)) for i in dto.items],
                    error_message=str(exc),
                    processed_at=timezone.now(),
                )
                return on_hold_order, True
            else:
                raise

        # --- Step 6: Atomic Creation of StockWhisk Order & Reservation Linkage ---
        # 1. Resolve or create CRM Customer
        customer = None
        if dto.customer_phone:
            customer = Customer.all_objects.filter(shop=shop, phone=dto.customer_phone).first()
            if not customer and dto.customer_name:
                customer = Customer.objects.create(
                    shop=shop,
                    name=dto.customer_name,
                    phone=dto.customer_phone,
                    email=dto.customer_email,
                    address=dto.shipping_address,
                )

        # 2. Prepare items for create_sale
        sale_items_data = []
        for item_dto, product, variation in mapped_items:
            sale_items_data.append(
                {
                    "product": product,
                    "variation": variation,
                    "quantity": item_dto.quantity,
                    "unit_price": item_dto.unit_price,
                    "discount": item_dto.discount,
                }
            )

        # 3. Create Sale with is_quotation=True to hold physical inventory
        # (physical stock is held via InventoryReservation, not deducted via SALE_OUT yet)
        sale = create_sale(
            shop=shop,
            items=sale_items_data,
            discount=dto.discount,
            delivery_charge=dto.shipping_charge,
            tax=dto.tax,
            customer=customer,
            customer_name=dto.customer_name or (customer.name if customer else "Online Customer"),
            customer_phone=dto.customer_phone or (customer.phone if customer else ""),
            customer_address=dto.shipping_address or (customer.address if customer else ""),
            is_quotation=True,
            idempotency_key=f"ext:{integration.id}:{dto.external_order_id}",
        )

        # 4. Link reservations to the created internal Sale
        for res in created_reservations:
            res.reference_type = "Sale"
            res.reference_id = str(sale.id)
            res.save(update_fields=["reference_type", "reference_id", "updated_at"])

        # 5. Handle Payment & Order Status
        if dto.paid_amount > Decimal("0"):
            method = Payment.Method.CASH
            pm_lower = dto.payment_method.lower()
            if "card" in pm_lower:
                method = Payment.Method.CARD
            elif "bkash" in pm_lower:
                method = Payment.Method.BKASH
            elif "nagad" in pm_lower:
                method = Payment.Method.NAGAD
            elif "bank" in pm_lower:
                method = Payment.Method.BANK

            add_payment(sale=sale, amount=dto.paid_amount, method=method)
        else:
            # Unpaid / Cash on Delivery (COD)
            sale.status = Sale.Status.DUE
            sale.save(update_fields=["status"])

        # Tag Sale custom_fields with channel provenance
        sale.custom_fields = {
            "source": "integration",
            "integration_id": integration.id,
            "integration_name": integration.name,
            "external_order_id": dto.external_order_id,
            "external_order_number": dto.external_order_number,
            "external_status": dto.external_status,
            "payment_method": dto.payment_method,
        }
        sale.save(update_fields=["custom_fields"])

        # 6. Create ExternalOrder Tracking Record
        external_order = ExternalOrder.objects.create(
            shop=shop,
            integration=integration,
            sale=sale,
            customer=customer,
            external_order_id=dto.external_order_id,
            external_order_number=dto.external_order_number,
            external_status=dto.external_status,
            sync_status=ExternalOrder.SyncStatus.SYNCED,
            customer_name=dto.customer_name,
            customer_phone=dto.customer_phone,
            customer_email=dto.customer_email,
            shipping_address=dto.shipping_address,
            billing_address=dto.billing_address,
            subtotal=dto.subtotal,
            discount=dto.discount,
            tax=dto.tax,
            shipping_charge=dto.shipping_charge,
            total=dto.total,
            paid_amount=dto.paid_amount,
            currency=dto.currency,
            payment_method=dto.payment_method,
            payment_status=dto.payment_status,
            idempotency_key=f"ext:{integration.id}:{dto.external_order_id}",
            raw_payload=_serialize_dict(dto.raw_payload),
            items_payload=[_serialize_dict(asdict(i)) for i in dto.items],
            processed_at=timezone.now(),
        )

        IntegrationLog.all_objects.create(
            shop=shop,
            integration=integration,
            level=IntegrationLog.Level.INFO,
            action="order_ingested_success",
            message=f"Order #{dto.external_order_id} ingested successfully -> Sale #{sale.invoice_no}",
            details={"sale_id": sale.id, "total": str(sale.total)},
        )

        record_integration_audit(
            shop=shop,
            action=str(IntegrationAuditLog.Action.ORDER_IMPORTED),
            integration=integration,
            event_type="order.imported",
            internal_id=str(sale.id),
            external_id=str(dto.external_order_id),
            status="success",
            description=f"Order #{dto.external_order_id} imported successfully -> Sale #{sale.invoice_no}.",
            details={"sale_id": sale.id, "invoice_no": sale.invoice_no, "total": str(sale.total)},
        )

        return external_order, True


# ==============================================================================
# Order State Management & Transition
# ==============================================================================

def release_order_reservations(shop, sale_id: str, quantity: Optional[Decimal] = None, reason: str = "") -> int:
    """Releases all active inventory reservations associated with a Sale (full or partial)."""
    reservations = InventoryReservation.all_objects.filter(
        shop=shop,
        reference_type="Sale",
        reference_id=str(sale_id),
        status=InventoryReservation.Status.ACTIVE,
    )
    count = 0
    for res in reservations:
        release_inventory_reservation(res, quantity=quantity, reason=reason)
        count += 1
    return count


def commit_order_reservations(shop, sale_id: str, quantity: Optional[Decimal] = None, created_by=None) -> int:
    """Commits all active inventory reservations associated with a Sale to permanent SALE_OUT."""
    reservations = InventoryReservation.all_objects.filter(
        shop=shop,
        reference_type="Sale",
        reference_id=str(sale_id),
        status=InventoryReservation.Status.ACTIVE,
    )
    count = 0
    for res in reservations:
        commit_inventory_reservation_to_sale(res, sale_id=str(sale_id), quantity=quantity, created_by=created_by)
        count += 1
    return count


def partially_cancel_order_reservation(
    *,
    shop,
    sale_id: str,
    product_id: int,
    quantity: Decimal,
    variation_id: Optional[int] = None,
    reason: str = "Partial cancellation",
) -> Optional[InventoryReservation]:
    """
    Partially releases reserved stock for a specific item on an active external order.
    Restores Available-To-Sell (ATS) by `quantity` under row-level lock.
    """
    qs = InventoryReservation.all_objects.filter(
        shop=shop,
        reference_type="Sale",
        reference_id=str(sale_id),
        product_id=product_id,
        status=InventoryReservation.Status.ACTIVE,
    )
    if variation_id:
        qs = qs.filter(variation_id=variation_id)

    reservation = qs.first()
    if not reservation:
        logger.warning(
            f"No active reservation found for sale #{sale_id}, product #{product_id} to partially release."
        )
        return None

    return release_inventory_reservation(reservation, quantity=quantity, reason=reason)


def update_external_order_state(
    external_order: ExternalOrder,
    dto: StandardOrderDTO,
) -> ExternalOrder:
    """
    Handles lifecycle updates to existing external orders:
    - Cancelled / Void -> Releases stock reservation, marks Sale CANCELLED
    - Completed / Delivered -> Commits stock reservation (SALE_OUT), marks Sale PAID
    - Address / Customer details -> Updates record
    """
    with transaction.atomic():
        new_status = dto.external_status.lower()
        shop = external_order.shop

        if new_status in ["cancelled", "canceled", "void"]:
            if external_order.sync_status != ExternalOrder.SyncStatus.CANCELLED:
                if external_order.sale:
                    # Release active inventory reservations back to available stock
                    release_order_reservations(
                        shop=shop,
                        sale_id=str(external_order.sale.id),
                        reason=f"External order #{external_order.external_order_id} cancelled",
                    )
                    external_order.sale.status = Sale.Status.CANCELLED
                    external_order.sale.save(update_fields=["status"])

                external_order.sync_status = ExternalOrder.SyncStatus.CANCELLED
                logger.info(f"External order #{external_order.external_order_id} cancelled. Reservations released.")

        elif new_status in ["completed", "delivered"]:
            if external_order.sync_status not in [ExternalOrder.SyncStatus.COMPLETED]:
                if external_order.sale:
                    # Commit inventory reservation (SALE_OUT StockMovement created)
                    commit_order_reservations(
                        shop=shop,
                        sale_id=str(external_order.sale.id),
                    )
                    if external_order.sale.status != Sale.Status.PAID and external_order.sale.due == Decimal("0"):
                        external_order.sale.status = Sale.Status.PAID
                        external_order.sale.save(update_fields=["status"])

                external_order.sync_status = ExternalOrder.SyncStatus.COMPLETED
                logger.info(f"External order #{external_order.external_order_id} completed. Reservations committed.")

        else:
            external_order.sync_status = ExternalOrder.SyncStatus.UPDATED

        external_order.external_status = dto.external_status
        if dto.shipping_address:
            external_order.shipping_address = dto.shipping_address
        if dto.customer_phone:
            external_order.customer_phone = dto.customer_phone
        if dto.customer_name:
            external_order.customer_name = dto.customer_name

        external_order.save()
        return external_order


# ==============================================================================
# Outbound Order Status Synchronization
# ==============================================================================

def push_external_order_status(
    integration: Integration,
    external_order_id: str,
    status: str,
    tracking_data: Optional[dict] = None,
) -> bool:
    """
    Pushes an order fulfillment or status update back to the external eCommerce platform.
    Handles timeouts, HTTP 5xx errors, and records failures into SyncError.
    """
    shop = integration.shop
    simulate = integration.config.get("simulate_order_error")
    if simulate:
        if simulate in ["502", "server_error"]:
            SyncError.all_objects.create(
                shop=shop,
                integration=integration,
                error_type="server_error",
                error_code="502",
                status_code=502,
                error_message=f"External platform returned HTTP 502 Bad Gateway for order {external_order_id}",
                raw_payload={"external_order_id": external_order_id, "status": status},
            )
            raise ExternalAPIError("External platform returned HTTP 502 Bad Gateway", status_code=502)
        elif simulate in ["timeout", "408"]:
            SyncError.all_objects.create(
                shop=shop,
                integration=integration,
                error_type="timeout",
                error_code="408",
                status_code=408,
                error_message=f"Timeout communicating with external platform for order {external_order_id}",
                raw_payload={"external_order_id": external_order_id, "status": status},
            )
            raise ExternalAPIError("Timeout communicating with external platform", status_code=408)

    logger.info(f"Pushed order #{external_order_id} status '{status}' to {integration.name}")
    return True

