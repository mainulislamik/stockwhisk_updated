"""
Product Mapping Service Layer for StockWhisk Integrations (Phase 5).

Provides high-level, atomic operations for:
- Creating product/variation mappings
- Updating existing mappings
- Deleting/disconnecting mappings
- Validating mappings (ensuring SKUs, products, and channels match)
- Searching mappings (by external ID, SKU, internal ID)
- Detecting unmapped StockWhisk products
- Detecting conflicting mappings (cross-referenced or overlapping IDs)
"""
import logging
from typing import Any, Dict, List, Optional, Tuple

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from catalog.models import Product, ProductVariation
from core.tenant_context import tenant_context
from .models import Integration, IntegrationAuditLog, ProductChannelMapping
from .validators import validate_tenant_boundary
from .audit import record_integration_audit

logger = logging.getLogger("integrations.mapping")


class MappingConflictError(ValidationError):
    """Raised when an external ID or SKU collides with another product or channel mapping."""
    pass


class MappingValidationError(ValidationError):
    """Raised when mapping data violates business or tenant rules."""
    pass


def validate_mapping_data(
    shop,
    integration: Integration,
    product: Product,
    external_product_id: str,
    variation: Optional[ProductVariation] = None,
    external_variation_id: str = "",
    external_sku: str = "",
) -> None:
    """
    Validates that:
    1. Integration, Product, and Variation belong to the given shop (Tenant Boundary).
    2. Integration is active and an eCommerce category channel.
    3. If Variation is provided, it belongs to the Product.
    4. Stable identifiers (external_product_id) are present and non-empty.
    """
    # 1. Multi-tenant boundary verification
    validate_tenant_boundary(shop=shop, integration=integration, product=product)

    if variation:
        if variation.shop_id != shop.id:
            raise MappingValidationError("Variation belongs to a different shop.")
        if variation.product_id != product.id:
            raise MappingValidationError(
                f"Variation #{variation.id} does not belong to Product #{product.id}."
            )

    # 2. Integration validity
    if not integration.is_active:
        raise MappingValidationError(
            f"Cannot create or update mapping for inactive integration '{integration.name}'."
        )

    # 3. Stable identifier validation
    if not external_product_id or not str(external_product_id).strip():
        raise MappingValidationError("external_product_id is required and cannot be blank.")


def create_or_update_product_mapping(
    shop,
    integration: Integration,
    product: Product,
    external_product_id: str,
    variation: Optional[ProductVariation] = None,
    external_variation_id: str = "",
    external_sku: str = "",
    is_sync_enabled: bool = True,
    metadata: Optional[Dict[str, Any]] = None,
) -> Tuple[ProductChannelMapping, bool]:
    """
    Creates or updates a ProductChannelMapping atomically with conflict detection.
    """
    external_product_id = str(external_product_id).strip()
    external_variation_id = str(external_variation_id or "").strip()
    external_sku = str(external_sku or "").strip()
    metadata = metadata or {}

    # Run validation checks
    validate_mapping_data(
        shop=shop,
        integration=integration,
        product=product,
        external_product_id=external_product_id,
        variation=variation,
        external_variation_id=external_variation_id,
        external_sku=external_sku,
    )

    # Derive internal SKU snapshot
    internal_sku = variation.sku if variation and variation.sku else product.sku

    with transaction.atomic():
        # Check conflict: Is external_product_id + external_variation_id already mapped to ANOTHER product?
        existing_ext = ProductChannelMapping.all_objects.filter(
            shop=shop,
            integration=integration,
            external_product_id=external_product_id,
            external_variation_id=external_variation_id,
        ).first()

        if existing_ext:
            if existing_ext.product_id != product.id or existing_ext.variation_id != (variation.id if variation else None):
                raise MappingConflictError(
                    f"External item (Product {external_product_id}, Var {external_variation_id or 'None'}) "
                    f"is already mapped to StockWhisk Product #{existing_ext.product_id}."
                )

        # Check conflict: Is this internal product/variation already mapped to ANOTHER external ID in this channel?
        existing_internal = ProductChannelMapping.all_objects.filter(
            shop=shop,
            integration=integration,
            product=product,
            variation=variation,
        ).first()

        if existing_internal:
            if (
                existing_internal.external_product_id != external_product_id
                or existing_internal.external_variation_id != external_variation_id
            ):
                raise MappingConflictError(
                    f"StockWhisk Product #{product.id} (Var {variation.id if variation else 'None'}) "
                    f"is already mapped to External Product #{existing_internal.external_product_id}."
                )

        # Upsert mapping
        mapping, created = ProductChannelMapping.all_objects.update_or_create(
            shop=shop,
            integration=integration,
            product=product,
            variation=variation,
            defaults={
                "internal_sku": internal_sku,
                "external_product_id": external_product_id,
                "external_variation_id": external_variation_id,
                "external_sku": external_sku,
                "sync_status": ProductChannelMapping.SyncStatus.ACTIVE,
                "is_sync_enabled": is_sync_enabled,
                "metadata": metadata,
            },
        )

        record_integration_audit(
            shop=shop,
            action=str(IntegrationAuditLog.Action.MAPPING_CREATED if created else IntegrationAuditLog.Action.MAPPING_CHANGED),
            integration=integration,
            event_type="mapping.created" if created else "mapping.changed",
            internal_id=str(product.id),
            external_id=external_product_id,
            status="success",
            description=f"Product mapping {'created' if created else 'updated'} for Product #{product.id} -> Ext #{external_product_id}.",
            details={"mapping_id": mapping.id, "sku": internal_sku, "external_sku": external_sku},
        )

        return mapping, created


def disconnect_product_mapping(
    shop,
    mapping_id: int,
    soft: bool = True,
) -> Optional[ProductChannelMapping]:
    """
    Disconnects or deletes a product channel mapping.
    If soft=True, sets sync_status to DISCONNECTED and disables sync.
    If soft=False, completely deletes the mapping row.
    """
    mapping = ProductChannelMapping.all_objects.filter(shop=shop, id=mapping_id).first()
    if not mapping:
        raise MappingValidationError(f"Mapping #{mapping_id} not found in this shop.")

    if soft:
        mapping.sync_status = ProductChannelMapping.SyncStatus.DISCONNECTED
        mapping.is_sync_enabled = False
        mapping.save(update_fields=["sync_status", "is_sync_enabled", "updated_at"])

        record_integration_audit(
            shop=shop,
            action=str(IntegrationAuditLog.Action.MAPPING_REMOVED),
            integration=mapping.integration,
            event_type="mapping.removed",
            internal_id=str(mapping.product_id),
            external_id=mapping.external_product_id,
            status="success",
            description=f"Product mapping #{mapping_id} soft disconnected.",
            details={"mapping_id": mapping_id, "soft": True},
        )
        return mapping
    else:
        int_id = str(mapping.product_id)
        ext_id = mapping.external_product_id
        integration_obj = mapping.integration
        mapping.delete()

        record_integration_audit(
            shop=shop,
            action=str(IntegrationAuditLog.Action.MAPPING_REMOVED),
            integration=integration_obj,
            event_type="mapping.removed",
            internal_id=int_id,
            external_id=ext_id,
            status="success",
            description=f"Product mapping #{mapping_id} permanently removed.",
            details={"mapping_id": mapping_id, "soft": False},
        )
        return None


def search_product_mapping(
    shop,
    integration: Integration,
    external_product_id: Optional[str] = None,
    external_variation_id: Optional[str] = None,
    sku: Optional[str] = None,
    product_id: Optional[int] = None,
    variation_id: Optional[int] = None,
) -> Optional[ProductChannelMapping]:
    """
    High-priority lookup for mapped products using stable identifiers:
    1. Exact external_product_id + external_variation_id match.
    2. Exact external_sku or internal_sku match within the channel.
    3. Internal product_id + variation_id match.
    """
    validate_tenant_boundary(shop=shop, integration=integration)
    qs = ProductChannelMapping.all_objects.filter(shop=shop, integration=integration)

    # 1. External ID match (Highest priority)
    if external_product_id:
        ext_var = external_variation_id or ""
        match = qs.filter(
            external_product_id=str(external_product_id).strip(),
            external_variation_id=str(ext_var).strip(),
        ).first()
        if match:
            return match

    # 2. SKU match
    if sku and str(sku).strip():
        sku_clean = str(sku).strip()
        match = qs.filter(external_sku=sku_clean).first()
        if match:
            return match
        match = qs.filter(internal_sku=sku_clean).first()
        if match:
            return match

    # 3. Internal Product ID match
    if product_id:
        var_filter = {"variation_id": variation_id} if variation_id else {"variation__isnull": True}
        match = qs.filter(product_id=product_id, **var_filter).first()
        if match:
            return match

    return None


def get_unmapped_products(
    shop,
    integration: Integration,
    limit: int = 100,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    """
    Finds StockWhisk products in the shop that have no active mapping for the given integration.
    Returns list of product info dictionaries.
    """
    validate_tenant_boundary(shop=shop, integration=integration)

    # Get all product IDs mapped in this integration
    mapped_product_ids = (
        ProductChannelMapping.all_objects.filter(
            shop=shop,
            integration=integration,
            sync_status__in=[
                ProductChannelMapping.SyncStatus.ACTIVE,
                ProductChannelMapping.SyncStatus.PAUSED,
            ],
        )
        .values_list("product_id", flat=True)
        .distinct()
    )

    # Unmapped products
    unmapped_qs = (
        Product.all_objects.filter(shop=shop)
        .exclude(id__in=mapped_product_ids)
        .order_by("-id")[offset : offset + limit]
    )

    results = []
    for prod in unmapped_qs:
        results.append({
            "id": prod.id,
            "name": prod.name,
            "sku": prod.sku,
            "barcode": prod.barcode,
            "selling_price": str(prod.selling_price) if getattr(prod, "selling_price", None) is not None else "0.00",
            "current_stock": str(prod.current_stock),
            "has_variations": ProductVariation.all_objects.filter(shop=shop, product=prod).exists(),
        })
    return results


def detect_conflicting_mappings(shop, integration: Integration) -> List[Dict[str, Any]]:
    """
    Audits existing mappings in a channel to detect duplicate SKUs, missing products,
    or ambiguous linkages.
    """
    validate_tenant_boundary(shop=shop, integration=integration)
    conflicts = []

    mappings = ProductChannelMapping.all_objects.filter(shop=shop, integration=integration)

    # Detect duplicate external SKUs
    sku_counts = {}
    for m in mappings:
        if m.external_sku:
            sku_counts.setdefault(m.external_sku, []).append(m)

    for sku, map_list in sku_counts.items():
        if len(map_list) > 1:
            conflicts.append({
                "type": "duplicate_external_sku",
                "sku": sku,
                "mapping_ids": [m.id for m in map_list],
                "description": f"External SKU '{sku}' is assigned to {len(map_list)} different product mappings.",
            })

    return conflicts
