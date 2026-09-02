from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from catalog.models import Product, ProductVariation
from inventory.models import MovementType
from inventory.services import apply_movement
from .models import BatchStatus, ProductionBatch, ProductionMaterial


@transaction.atomic
def start_production_batch(*, shop, user, materials_data, notes="", additional_cost=0, additional_cost_note=""):
    """
    Step 1: Start a production batch with raw materials.
    Deducts raw materials from inventory ledger and locks snapshot cost.
    """
    if not materials_data:
        raise ValidationError("At least one raw material is required.")

    batch = ProductionBatch.objects.create(
        shop=shop,
        created_by=user,
        notes=notes or "",
        additional_cost=Decimal(str(additional_cost or 0)),
        additional_cost_note=additional_cost_note or "",
        status=BatchStatus.IN_PROGRESS,
    )

    total_mat_cost = Decimal("0.00")

    for item in materials_data:
        product_id = item.get("product_id") or item.get("product")
        qty = Decimal(str(item.get("quantity") or 0))
        if qty <= 0:
            raise ValidationError("Quantity must be greater than 0 for all materials.")

        try:
            prod = Product.all_objects.get(id=product_id, shop=shop)
        except Product.DoesNotExist:
            raise ValidationError(f"Product #{product_id} does not exist.")

        var_id = item.get("variation_id") or item.get("variation")
        variation = None
        if var_id:
            variation = ProductVariation.all_objects.filter(id=var_id, product=prod).first()

        unit_cost = Decimal(str(item.get("unit_cost") if item.get("unit_cost") is not None else prod.cost_price or 0))
        subtotal = (qty * unit_cost).quantize(Decimal("0.01"))
        total_mat_cost += subtotal

        unit = prod.unit

        ProductionMaterial.objects.create(
            shop=shop,
            batch=batch,
            product=prod,
            variation=variation,
            quantity=qty,
            unit=unit,
            unit_cost=unit_cost,
            subtotal=subtotal,
        )

        # Deduct raw material stock
        apply_movement(
            shop=shop,
            product=prod,
            variation=variation,
            movement_type=MovementType.PRODUCTION_OUT,
            quantity=qty,
            unit_cost=unit_cost,
            reference_type="production_batch",
            reference_id=batch.id,
            note=f"Used in Production Batch #{batch.batch_number}",
            created_by=user,
        )

    batch.total_material_cost = total_mat_cost
    batch.save(update_fields=["total_material_cost"])
    return batch


@transaction.atomic
def complete_production_batch(
    *,
    batch,
    output_product_id,
    output_quantity,
    output_variation_id=None,
    additional_cost=None,
    additional_cost_note=None,
    update_product_cost=True,
    user=None,
):
    """
    Step 2: Complete the production batch by recording final yield.
    Calculates exact per-unit cost and credits finished product inventory.
    """
    if batch.status != BatchStatus.IN_PROGRESS:
        raise ValidationError(f"Batch is already {batch.status}.")

    output_qty = Decimal(str(output_quantity or 0))
    if output_qty <= 0:
        raise ValidationError("Output quantity must be greater than 0.")

    try:
        output_prod = Product.all_objects.get(id=output_product_id, shop=batch.shop)
    except Product.DoesNotExist:
        raise ValidationError("Selected output product does not exist.")

    output_var = None
    if output_variation_id:
        output_var = ProductVariation.all_objects.filter(id=output_variation_id, product=output_prod).first()

    if additional_cost is not None:
        batch.additional_cost = Decimal(str(additional_cost or 0))
    if additional_cost_note is not None:
        batch.additional_cost_note = str(additional_cost_note or "")

    total_cost = (batch.total_material_cost or 0) + (batch.additional_cost or 0)
    calculated_unit_cost = (total_cost / output_qty).quantize(Decimal("0.01"))

    batch.output_product = output_prod
    batch.output_variation = output_var
    batch.output_quantity = output_qty
    batch.calculated_unit_cost = calculated_unit_cost
    batch.update_product_cost = bool(update_product_cost)
    batch.status = BatchStatus.COMPLETED
    batch.completed_at = timezone.now()
    batch.completed_by = user
    batch.save()

    # Credit output product stock in ledger
    apply_movement(
        shop=batch.shop,
        product=output_prod,
        variation=output_var,
        movement_type=MovementType.PRODUCTION_IN,
        quantity=output_qty,
        unit_cost=calculated_unit_cost,
        reference_type="production_batch",
        reference_id=batch.id,
        note=f"Yield from Production Batch #{batch.batch_number}",
        created_by=user,
    )

    # Update product cost in catalog if requested
    if update_product_cost:
        output_prod.cost_price = calculated_unit_cost
        output_prod.save(update_fields=["cost_price"])

    return batch


@transaction.atomic
def cancel_production_batch(*, batch, reason="", user=None):
    """
    Cancel an in-progress batch and return all raw materials to stock.
    """
    if batch.status == BatchStatus.COMPLETED:
        raise ValidationError("Completed batches cannot be cancelled.")
    if batch.status == BatchStatus.CANCELLED:
        return batch

    # Restore raw materials to stock
    for mat in batch.materials.select_related("product", "variation"):
        apply_movement(
            shop=batch.shop,
            product=mat.product,
            variation=mat.variation,
            movement_type=MovementType.ADJUST_IN,
            quantity=mat.quantity,
            unit_cost=mat.unit_cost,
            reference_type="production_batch_cancel",
            reference_id=batch.id,
            note=f"Restored from Cancelled Batch #{batch.batch_number}",
            created_by=user,
        )

    batch.status = BatchStatus.CANCELLED
    if reason:
        batch.notes = f"{batch.notes}\n[Cancelled: {reason}]".strip()
    batch.save(update_fields=["status", "notes"])
    return batch
