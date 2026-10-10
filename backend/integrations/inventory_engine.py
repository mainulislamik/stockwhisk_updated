"""
Central Inventory Synchronization Engine for StockWhisk Integrations (Phase 6).

Implements:
1. Central StockWhisk Inventory Concept:
   - ON_HAND: Physical stock in store/warehouse (Product.current_stock / Variation.current_stock)
   - RESERVED: Quantity held for pending eCommerce orders (Product.reserved_stock / Variation.reserved_stock)
   - AVAILABLE: ON_HAND - RESERVED (capped at 0) - Available to Sell (ATS)
2. Strict Central Business Logic Invariance:
   - Direct database mutation of inventory from integrations is STRICTLY FORBIDDEN.
   - Any inventory adjustment must route strictly through `inventory.services.apply_movement`.
3. Outbound Synchronization:
   - StockWhisk inventory changes trigger asynchronous sync to connected external eCommerce channels.
4. Inbound Synchronization:
   - External website stock changes into StockWhisk are permitted ONLY when explicitly authorized
     by integration configuration, and routed strictly through `inventory.services.apply_movement`.
5. Resilient Error Handling & Categorization:
   - Unmapped product, Missing SKU, Timeout, 500 Server Error, Rate Limit (429), Invalid Credentials (401),
     Deleted external product (404), Insufficient permissions (403).
"""

from decimal import Decimal
import logging
from typing import Any, Dict, List, Optional, Tuple

import requests
from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from catalog.models import Product, ProductVariation
from core.tenant_context import set_current_tenant
from inventory.models import MovementType, StockMovement
from inventory.services import apply_movement

from .models import (
    Integration,
    IntegrationAuditLog,
    IntegrationLog,
    IntegrationStatus,
    InventoryReservation,
    ProductChannelMapping,
    SyncError,
    SyncJob,
)
from .audit import record_integration_audit
from .validators import validate_tenant_boundary

logger = logging.getLogger("integrations.inventory")


# ============================================================================
# 1. Failure Hierarchy & Result Containers
# ============================================================================

class InventorySyncError(Exception):
    """Base exception for inventory sync failures."""
    error_type = "unknown_error"
    status_code: Optional[int] = None
    is_recoverable = False

    def __init__(self, message: str, status_code: Optional[int] = None, raw_payload: Optional[dict] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code or self.status_code
        self.raw_payload = raw_payload or {}


class UnmappedProductError(InventorySyncError):
    error_type = "unmapped_product"
    is_recoverable = False


class MissingIdentifierError(InventorySyncError):
    error_type = "missing_sku"
    is_recoverable = False


class ExternalTimeoutError(InventorySyncError):
    error_type = "timeout"
    status_code = 408
    is_recoverable = True


class ExternalServerError(InventorySyncError):
    error_type = "server_error"
    status_code = 500
    is_recoverable = True


class ExternalRateLimitError(InventorySyncError):
    error_type = "rate_limit"
    status_code = 429
    is_recoverable = True

    def __init__(self, message: str, retry_after: int = 60, status_code: Optional[int] = 429, raw_payload: Optional[dict] = None):
        super().__init__(message, status_code=status_code or 429, raw_payload=raw_payload)
        self.retry_after = retry_after
        self.retry_after = retry_after


class InvalidCredentialsError(InventorySyncError):
    error_type = "invalid_credentials"
    status_code = 401
    is_recoverable = False


class ExternalProductDeletedError(InventorySyncError):
    error_type = "external_product_deleted"
    status_code = 404
    is_recoverable = False


class InsufficientPermissionsError(InventorySyncError):
    error_type = "insufficient_permissions"
    status_code = 403
    is_recoverable = False


class InsufficientStockOrderError(InventorySyncError):
    """
    Raised when available stock (ATS = ON_HAND - RESERVED) is insufficient
    to satisfy an external order reservation request.
    """
    error_type = "insufficient_stock"
    status_code = 409
    is_recoverable = False

    def __init__(
        self,
        message: str,
        details: Optional[dict] = None,
        available_stock: Decimal = Decimal("0.00"),
        requested_quantity: Decimal = Decimal("0.00"),
    ):
        super().__init__(message)
        self.details = details or {}
        self.available_stock = Decimal(str(available_stock))
        self.requested_quantity = Decimal(str(requested_quantity))
        self.details.setdefault("available_stock", str(self.available_stock))
        self.details.setdefault("requested_quantity", str(self.requested_quantity))


class InventorySyncResult:
    def __init__(
        self,
        success: bool,
        status: str,
        available_quantity: Decimal,
        error_type: str = "none",
        error_message: str = "",
        status_code: Optional[int] = None,
        retry_after: int = 0,
        raw_payload: Optional[dict] = None,
    ):
        self.success = success
        self.status = status
        self.available_quantity = available_quantity
        self.error_type = error_type
        self.error_message = error_message
        self.status_code = status_code
        self.retry_after = retry_after
        self.raw_payload = raw_payload or {}

    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "status": self.status,
            "available_quantity": str(self.available_quantity),
            "error_type": self.error_type,
            "error_message": self.error_message,
            "status_code": self.status_code,
            "retry_after": self.retry_after,
        }


# ============================================================================
# 2. Inventory Concept Helpers (ON_HAND, RESERVED, AVAILABLE)
# ============================================================================

def get_inventory_levels(product: Product, variation: Optional[ProductVariation] = None) -> Dict[str, Decimal]:
    """
    Computes standard StockWhisk inventory levels:
    - ON_HAND: Physical stock in store/warehouse (current_stock).
    - RESERVED: Stock held for pending unfulfilled eCommerce orders (reserved_stock).
    - AVAILABLE: ON_HAND - RESERVED (minimum 0) - Available to Sell (ATS).
    """
    item = variation if variation is not None else product
    on_hand = Decimal(str(item.current_stock or 0))
    reserved = Decimal(str(getattr(item, "reserved_stock", 0) or 0))
    available = max(Decimal("0.00"), on_hand - reserved)
    return {
        "on_hand": on_hand,
        "reserved": reserved,
        "available": available,
    }


@transaction.atomic
def reserve_inventory_for_order(
    *,
    shop,
    integration: Integration,
    product: Product,
    quantity: Decimal,
    variation: Optional[ProductVariation] = None,
    reference_type: str = "WebOrder",
    reference_id: str = "",
    note: str = "",
) -> InventoryReservation:
    """
    Temporarily holds/reserves inventory for a pending external web order.
    Acquires an exclusive row lock on the target product/variation to guarantee
    race-condition free available stock calculation and atomic reservation.
    """
    qty = Decimal(str(quantity))
    if qty <= 0:
        raise ValueError("Reservation quantity must be positive.")

    # 0. Strict Tenant Isolation Assertion
    validate_tenant_boundary(shop=shop, product=product, integration=integration)

    # 1. Acquire row-level exclusive lock(s) in deterministic order
    # To prevent deadlocks, lock parent product then variation
    locked_product = Product.all_objects.select_for_update().get(pk=product.pk)
    if variation:
        locked_variation = ProductVariation.all_objects.select_for_update().get(pk=variation.pk)
        item = locked_variation
    else:
        locked_variation = None
        item = locked_product

    # 2. Under lock, calculate Available-To-Sell (ATS = ON_HAND - RESERVED)
    on_hand = Decimal(str(item.current_stock or 0))
    reserved = Decimal(str(item.reserved_stock or 0))
    available = max(Decimal("0.00"), on_hand - reserved)

    if available < qty:
        raise InsufficientStockOrderError(
            f"Insufficient available stock for '{item}'. Available: {available}, Requested: {qty}",
            available_stock=available,
            requested_quantity=qty,
            details={
                "product_id": product.id,
                "variation_id": variation.id if variation else None,
                "available_stock": str(available),
                "requested_quantity": str(qty),
            },
        )

    # 3. Increment reserved_stock under lock
    new_reserved = reserved + qty
    if variation and locked_variation is not None:
        ProductVariation.all_objects.filter(pk=variation.pk).update(reserved_stock=new_reserved)
        locked_variation.reserved_stock = new_reserved
        variation.reserved_stock = new_reserved
    else:
        Product.all_objects.filter(pk=product.pk).update(reserved_stock=new_reserved)
        locked_product.reserved_stock = new_reserved
        product.reserved_stock = new_reserved

    # 4. Create audit reservation record
    reservation = InventoryReservation.objects.create(
        shop=shop,
        integration=integration,
        product=product,
        variation=variation,
        quantity=qty,
        reference_type=reference_type,
        reference_id=reference_id,
        status=InventoryReservation.Status.ACTIVE,
        metadata={
            "note": note,
            "initial_available": str(available),
            "reserved_quantity": str(qty),
            "reserved_at": timezone.now().isoformat(),
        },
    )

    logger.info(
        f"Reserved {qty} of product#{product.id} (var#{variation.id if variation else 'none'}) for {reference_type}:{reference_id}"
    )
    return reservation


@transaction.atomic
def release_inventory_reservation(
    reservation: InventoryReservation,
    quantity: Optional[Decimal] = None,
    reason: str = "",
) -> InventoryReservation:
    """
    Releases a previously held reservation (full or partial).
    Decrements reserved_stock under row lock, restoring Available-To-Sell (ATS).
    """
    if reservation.status != InventoryReservation.Status.ACTIVE:
        return reservation

    product = reservation.product
    variation = reservation.variation
    current_res_qty = Decimal(str(reservation.quantity))

    # Acquire exclusive row lock
    locked_product = Product.all_objects.select_for_update().get(pk=product.pk)
    if variation:
        locked_variation = ProductVariation.all_objects.select_for_update().get(pk=variation.pk)
        item = locked_variation
    else:
        locked_variation = None
        item = locked_product

    # Determine release quantity
    if quantity is not None:
        release_qty = Decimal(str(quantity))
        if release_qty <= 0:
            raise ValueError("Release quantity must be positive.")
        if release_qty > current_res_qty:
            release_qty = current_res_qty
    else:
        release_qty = current_res_qty

    # 1. Decrement reserved_stock
    current_reserved = Decimal(str(item.reserved_stock or 0))
    new_reserved = max(Decimal("0.00"), current_reserved - release_qty)

    if variation and locked_variation is not None:
        ProductVariation.all_objects.filter(pk=variation.pk).update(reserved_stock=new_reserved)
        locked_variation.reserved_stock = new_reserved
        variation.reserved_stock = new_reserved
    else:
        Product.all_objects.filter(pk=product.pk).update(reserved_stock=new_reserved)
        locked_product.reserved_stock = new_reserved
        product.reserved_stock = new_reserved

    # 2. Update reservation record
    remaining_qty = current_res_qty - release_qty
    metadata = dict(reservation.metadata or {})

    if remaining_qty <= 0:
        # Full release
        reservation.quantity = Decimal("0.00")
        reservation.status = InventoryReservation.Status.RELEASED
        metadata["release_reason"] = reason
        metadata["released_at"] = timezone.now().isoformat()
        metadata["released_quantity"] = str(release_qty)
        reservation.metadata = metadata
        reservation.save(update_fields=["quantity", "status", "metadata", "updated_at"])
        logger.info(f"Fully released reservation #{reservation.id} for {release_qty} of product#{product.id}")
    else:
        # Partial release
        reservation.quantity = remaining_qty
        partial_history = metadata.get("partial_releases", [])
        partial_history.append({
            "released_quantity": str(release_qty),
            "remaining_quantity": str(remaining_qty),
            "reason": reason,
            "timestamp": timezone.now().isoformat(),
        })
        metadata["partial_releases"] = partial_history
        metadata["last_partial_release_at"] = timezone.now().isoformat()
        reservation.metadata = metadata
        reservation.save(update_fields=["quantity", "metadata", "updated_at"])
        logger.info(
            f"Partially released reservation #{reservation.id}: released {release_qty}, remaining {remaining_qty}"
        )

    return reservation


@transaction.atomic
def commit_inventory_reservation_to_sale(
    reservation: InventoryReservation,
    sale_id: str,
    quantity: Optional[Decimal] = None,
    created_by=None,
) -> StockMovement:
    """
    Converts a reservation into a permanent ledger deduction upon dispatch.
    Executes central apply_movement() AND decrements reserved_stock under row lock.
    """
    if reservation.status != InventoryReservation.Status.ACTIVE:
        raise ValueError("Cannot commit a non-active reservation.")

    product = reservation.product
    variation = reservation.variation
    shop = reservation.shop
    current_res_qty = Decimal(str(reservation.quantity))

    commit_qty = Decimal(str(quantity)) if quantity is not None else current_res_qty
    if commit_qty <= 0:
        raise ValueError("Commit quantity must be positive.")
    if commit_qty > current_res_qty:
        commit_qty = current_res_qty

    # 1. Acquire row lock
    locked_product = Product.all_objects.select_for_update().get(pk=product.pk)
    if variation:
        locked_variation = ProductVariation.all_objects.select_for_update().get(pk=variation.pk)
        item = locked_variation
    else:
        locked_variation = None
        item = locked_product

    # 2. Permanent deduction via central business logic
    movement = apply_movement(
        shop=shop,
        product=product,
        variation=variation,
        movement_type=MovementType.SALE_OUT,
        quantity=commit_qty,
        reference_type="Sale",
        reference_id=str(sale_id),
        note=f"Dispatched web order fulfillment (Reservation #{reservation.id})",
        created_by=created_by,
    )

    # 3. Decrement reserved_stock under lock
    current_reserved = Decimal(str(item.reserved_stock or 0))
    new_reserved = max(Decimal("0.00"), current_reserved - commit_qty)
    if variation and locked_variation is not None:
        ProductVariation.all_objects.filter(pk=variation.pk).update(reserved_stock=new_reserved)
        locked_variation.reserved_stock = new_reserved
        variation.reserved_stock = new_reserved
    else:
        Product.all_objects.filter(pk=product.pk).update(reserved_stock=new_reserved)
        locked_product.reserved_stock = new_reserved
        product.reserved_stock = new_reserved

    # 4. Update reservation record
    remaining = current_res_qty - commit_qty
    metadata = dict(reservation.metadata or {})
    if remaining <= 0:
        reservation.quantity = Decimal("0.00")
        reservation.status = InventoryReservation.Status.COMMITTED
        metadata["committed_at"] = timezone.now().isoformat()
        metadata["committed_quantity"] = str(commit_qty)
        metadata["committed_sale_id"] = str(sale_id)
        reservation.metadata = metadata
        reservation.save(update_fields=["quantity", "status", "metadata", "updated_at"])
    else:
        reservation.quantity = remaining
        partial_history = metadata.get("partial_commits", [])
        partial_history.append({
            "committed_quantity": str(commit_qty),
            "remaining_quantity": str(remaining),
            "sale_id": str(sale_id),
            "timestamp": timezone.now().isoformat(),
        })
        metadata["partial_commits"] = partial_history
        reservation.metadata = metadata
        reservation.save(update_fields=["quantity", "metadata", "updated_at"])

    return movement


# Aliases for inventory concept operations
reserve_stock = reserve_inventory_for_order
release_stock = release_inventory_reservation
commit_reservation = commit_inventory_reservation_to_sale


# ============================================================================
# 3. Inbound Inventory Synchronization (External Website -> StockWhisk)
# ============================================================================

@transaction.atomic
def sync_inbound_stock_from_external(
    *,
    shop,
    integration: Integration,
    mapping: ProductChannelMapping,
    external_stock_quantity: Any = None,
    external_quantity: Any = None,
    created_by=None,
    note: str = "",
) -> Optional[StockMovement]:
    """
    Updates StockWhisk inventory from an external channel update.
    CRITICAL RULE ENFORCEMENT:
    - Verifies data ownership matrix allows inbound sync for this integration.
    - NEVER directly updates Product.current_stock.
    - Routes delta strictly through inventory.services.apply_movement().
    """
    # 1. Enforce Data Ownership Matrix
    allow_inbound = integration.config.get("allow_inbound_stock_sync", False)
    if not allow_inbound:
        raise PermissionDenied(
            f"Inbound inventory synchronization is not permitted for integration '{integration.name}'."
        )

    product = mapping.product
    variation = mapping.variation
    raw_qty = external_quantity if external_quantity is not None else external_stock_quantity
    if raw_qty is None:
        raise ValueError("Must provide external_stock_quantity or external_quantity")
    target_qty = Decimal(str(raw_qty))

    # 2. Compute difference against current StockWhisk physical stock
    current_physical = Decimal(str(variation.current_stock if variation else product.current_stock or 0))
    delta = target_qty - current_physical

    if delta == Decimal("0.00"):
        return None  # Stock matches; no movement needed

    # 3. Apply via central business logic
    movement_type = MovementType.ADJUST_IN if delta > 0 else MovementType.ADJUST_OUT
    movement = apply_movement(
        shop=shop,
        product=product,
        variation=variation,
        movement_type=movement_type,
        quantity=abs(delta),
        reference_type="ExternalSync",
        reference_id=str(integration.id),
        note=note or f"External inventory sync from {integration.name}",
        created_by=created_by,
    )

    mapping.last_synced_at = timezone.now()
    mapping.sync_status = ProductChannelMapping.SyncStatus.SYNCED
    mapping.error_message = ""
    mapping.save(update_fields=["last_synced_at", "sync_status", "error_message", "updated_at"])

    return movement


# ============================================================================
# 4. Outbound Inventory Adapter Dispatcher
# ============================================================================

_ADAPTER_REGISTRY: Dict[str, Any] = {}


def register_inventory_adapter(key: Any, adapter_or_cls: Any):
    """Registers an inventory channel adapter class or instance."""
    _ADAPTER_REGISTRY[str(key)] = adapter_or_cls


def get_inventory_adapter(integration: Integration):
    """Returns the adapter instance for an integration, or Default/Mock adapter."""
    adapter = _ADAPTER_REGISTRY.get(str(integration.id)) or _ADAPTER_REGISTRY.get(str(integration.provider))
    if adapter:
        if callable(adapter) and isinstance(adapter, type):
            return adapter(integration)
        return adapter
    return GenericInventoryAdapter(integration)


class BaseInventoryAdapter:
    """Base interface for channel inventory synchronization adapters."""
    def __init__(self, integration: Integration):
        self.integration = integration

    def update_remote_stock(self, mapping: ProductChannelMapping, available_quantity: Decimal) -> InventorySyncResult:
        raise NotImplementedError

    def fetch_remote_stock(self, mapping: ProductChannelMapping) -> InventorySyncResult:
        raise NotImplementedError


class GenericInventoryAdapter(BaseInventoryAdapter):
    """
    Default adapter providing structured request validation, error simulation/mocking,
    and standard external payload formation.
    """
    def __init__(self, integration: Integration):
        super().__init__(integration)

    def update_remote_stock(self, mapping: ProductChannelMapping, available_quantity: Decimal) -> InventorySyncResult:
        """
        Executes external stock update. In Phase 6 (pre-connector phase),
        handles validation, mock simulation hooks, and structured responses.
        """
        # 1. Validate credentials
        if not self.integration.credential or not self.integration.credential.has_credentials():
            raise InvalidCredentialsError(
                f"Missing API credentials for integration '{self.integration.name}'."
            )

        # 2. Check for missing identifiers
        has_identifier = bool(mapping.external_product_id or mapping.external_sku or mapping.internal_sku)
        if not has_identifier:
            raise MissingIdentifierError(
                f"Mapping #{mapping.id} lacks stable identifiers (no external ID, no SKU)."
            )

        # 3. Check for mock/simulation triggers in config (used for testing failure scenarios)
        sim = self.integration.config.get("simulate_error")
        if sim == "timeout":
            raise ExternalTimeoutError("Connection timed out to external eCommerce API.")
        elif sim == "server_error":
            raise ExternalServerError("External server returned HTTP 500 Internal Server Error.")
        elif sim == "rate_limit":
            raise ExternalRateLimitError("API rate limit exceeded. Retry after delay.", retry_after=30)
        elif sim == "invalid_credentials":
            raise InvalidCredentialsError("External API returned HTTP 401 Unauthorized.")
        elif sim == "deleted_product":
            raise ExternalProductDeletedError("External product ID not found on remote store (HTTP 404).")
        elif sim == "insufficient_permissions":
            raise InsufficientPermissionsError("API key lacks required write_products scope (HTTP 403).")

        return InventorySyncResult(
            success=True,
            status="synced",
            available_quantity=available_quantity,
            raw_payload={"remote_stock": str(available_quantity), "updated": True},
        )


class WooCommerceInventoryAdapter(GenericInventoryAdapter):
    """
    Dedicated WooCommerce REST API inventory synchronization adapter.
    Dispatches HTTP PUT /wp-json/wc/v3/products/<id> or /wp-json/wc/v3/products/<id>/variations/<var_id>
    using Consumer Key and Consumer Secret Basic Auth.
    """
    def update_remote_stock(self, mapping: ProductChannelMapping, available_quantity: Decimal) -> InventorySyncResult:
        # Check simulation hooks first
        sim = self.integration.config.get("simulate_error")
        if sim:
            return super().update_remote_stock(mapping, available_quantity)

        # 1. Validate credentials
        if not self.integration.credential or not self.integration.credential.has_credentials():
            raise InvalidCredentialsError(
                f"Missing API credentials for WooCommerce integration '{self.integration.name}'."
            )

        creds = self.integration.credential.get_credentials()
        api_key = creds.get("api_key") or ""
        api_secret = creds.get("api_secret") or ""
        base_url = (self.integration.base_url or self.integration.config.get("store_url") or "").rstrip("/")

        # Check for mock or sandbox mode
        is_mock = bool(
            self.integration.config.get("mock_mode")
            or "mock" in base_url
            or "test" in base_url
            or not (base_url and api_key and api_secret)
        )

        if is_mock:
            return super().update_remote_stock(mapping, available_quantity)

        # 2. Determine endpoint
        ext_product_id = mapping.external_product_id
        ext_var_id = mapping.external_variation_id

        if not ext_product_id and not mapping.external_sku:
            raise MissingIdentifierError(
                f"Mapping #{mapping.id} lacks external product ID or SKU for WooCommerce sync."
            )

        if ext_var_id and ext_product_id:
            url = f"{base_url}/wp-json/wc/v3/products/{ext_product_id}/variations/{ext_var_id}"
        elif ext_product_id:
            url = f"{base_url}/wp-json/wc/v3/products/{ext_product_id}"
        else:
            return super().update_remote_stock(mapping, available_quantity)

        payload = {
            "manage_stock": True,
            "stock_quantity": int(available_quantity),
        }

        try:
            resp = requests.put(
                url,
                json=payload,
                auth=(api_key, api_secret),
                timeout=12,
            )
        except requests.Timeout as e:
            raise ExternalTimeoutError(f"WooCommerce API timeout: {e}") from e
        except requests.RequestException as e:
            raise ExternalServerError(f"WooCommerce connection error: {e}") from e

        if resp.status_code in (401, 403):
            if resp.status_code == 403:
                raise InsufficientPermissionsError("WooCommerce API key lacks write permissions (HTTP 403).")
            raise InvalidCredentialsError("Invalid WooCommerce Consumer Key or Secret (HTTP 401).")
        elif resp.status_code == 404:
            raise ExternalProductDeletedError(f"Product #{ext_product_id} not found on WooCommerce store (HTTP 404).")
        elif resp.status_code == 429:
            raise ExternalRateLimitError("WooCommerce rate limit exceeded (HTTP 429).")
        elif resp.status_code >= 500:
            raise ExternalServerError(f"WooCommerce server error (HTTP {resp.status_code}).")

        data = resp.json() if resp.content else {}
        return InventorySyncResult(
            success=True,
            status="synced",
            available_quantity=available_quantity,
            raw_payload={"remote_stock": str(available_quantity), "woocommerce_response": data},
        )


_ADAPTER_REGISTRY["woocommerce"] = WooCommerceInventoryAdapter


# ============================================================================
# 5. Core Synchronization Operations
# ============================================================================

def sync_product_inventory(
    mapping_or_id: Any = None,
    sync_job: Optional[SyncJob] = None,
    product_id: Optional[int] = None,
    integration: Optional[Integration] = None,
    variation_id: Optional[int] = None,
) -> InventorySyncResult:
    """
    Synchronizes available inventory for a single ProductChannelMapping to its external channel.
    - Calculates available ATS = current_stock - reserved_stock.
    - Pushes ATS to external channel via adapter.
    - Records SyncError and updates mapping status on failure.
    - Disables retry loops on permanent failures (invalid credentials, 403, 404).
    """
    if isinstance(mapping_or_id, ProductChannelMapping):
        mapping = mapping_or_id
    elif mapping_or_id is not None:
        mapping = ProductChannelMapping.all_objects.select_related(
            "shop", "integration", "product", "variation", "integration__credential"
        ).filter(id=mapping_or_id).first()
    elif product_id and integration:
        mapping = ProductChannelMapping.all_objects.select_related(
            "shop", "integration", "product", "variation", "integration__credential"
        ).filter(
            shop_id=integration.shop_id,
            integration=integration,
            product_id=product_id,
            variation_id=variation_id,
        ).first()
    else:
        mapping = None

    if not mapping:
        err = UnmappedProductError(f"Product has no active channel mapping for this integration.")
        return InventorySyncResult(
            success=False,
            status="unmapped",
            available_quantity=Decimal("0.00"),
            error_type="unmapped_product",
            error_message=str(err),
        )

    integration = mapping.integration
    shop = mapping.shop

    # Ensure thread-local tenant is active
    set_current_tenant(shop)

    # Check if mapping or integration is disabled
    if not mapping.is_sync_enabled or not mapping.sync_inventory or not mapping.is_active:
        return InventorySyncResult(
            success=False,
            status="skipped",
            available_quantity=Decimal("0.00"),
            error_type="sync_disabled",
            error_message="Inventory sync is disabled for this mapping.",
        )

    if not integration.is_active or integration.status == IntegrationStatus.DISCONNECTED:
        return InventorySyncResult(
            success=False,
            status="skipped",
            available_quantity=Decimal("0.00"),
            error_type="integration_inactive",
            error_message=f"Integration '{integration.name}' is inactive or disconnected.",
        )

    # 1. Calculate Available Stock (ATS)
    levels = get_inventory_levels(mapping.product, mapping.variation)
    available_qty = levels["available"]

    adapter = get_inventory_adapter(integration)

    try:
        result = adapter.update_remote_stock(mapping, available_qty)

        # On Success:
        mapping.sync_status = ProductChannelMapping.SyncStatus.SYNCED
        mapping.last_synced_at = timezone.now()
        mapping.error_message = ""
        mapping.save(update_fields=["sync_status", "last_synced_at", "error_message", "updated_at"])

        IntegrationLog.objects.create(
            shop=shop,
            integration=integration,
            level=IntegrationLog.Level.INFO,
            action="inventory_sync_success",
            message=f"Synced stock {available_qty} for mapping #{mapping.id}",
            details={"levels": {k: str(v) for k, v in levels.items()}},
        )

        record_integration_audit(
            shop=shop,
            action=str(IntegrationAuditLog.Action.INVENTORY_SYNCHRONIZED),
            integration=integration,
            event_type="inventory.sync",
            internal_id=str(mapping.product_id),
            external_id=str(mapping.external_product_id),
            status="success",
            description=f"Stock synchronized ({available_qty}) for Product #{mapping.product_id} -> Ext #{mapping.external_product_id}.",
            details={"mapping_id": mapping.id, "available_qty": str(available_qty)},
        )

        return result

    except InventorySyncError as exc:
        # Failure Recording & State Transitions
        return _handle_inventory_sync_failure(mapping, exc, available_qty, sync_job)
    except Exception as exc:
        wrapped = InventorySyncError(f"Unexpected error during inventory sync: {str(exc)}")
        return _handle_inventory_sync_failure(mapping, wrapped, available_qty, sync_job)


def _handle_inventory_sync_failure(
    mapping: ProductChannelMapping,
    exc: InventorySyncError,
    available_qty: Decimal,
    sync_job: Optional[SyncJob] = None,
) -> InventorySyncResult:
    """
    Categorizes errors, persists SyncError, updates mapping status, and manages integration error state.
    """
    shop = mapping.shop
    integration = mapping.integration

    error_type = exc.error_type
    error_msg = str(exc)
    status_code = getattr(exc, "status_code", None)
    raw_payload = getattr(exc, "raw_payload", {})

    # 1. Update mapping status based on error severity
    if error_type in ["invalid_credentials", "insufficient_permissions", "server_error"]:
        mapping.sync_status = ProductChannelMapping.SyncStatus.ERROR
        if error_type in ["invalid_credentials", "insufficient_permissions"]:
            integration.mark_error(error_msg)
    elif error_type == "external_product_deleted":
        mapping.sync_status = ProductChannelMapping.SyncStatus.CONFLICT
    elif error_type in ["timeout", "rate_limit"]:
        mapping.sync_status = ProductChannelMapping.SyncStatus.PENDING_SYNC
    else:
        mapping.sync_status = ProductChannelMapping.SyncStatus.ERROR

    mapping.error_message = error_msg[:1000]
    mapping.save(update_fields=["sync_status", "error_message", "updated_at"])

    # 2. Record persistent SyncError row
    SyncError.objects.create(
        shop=shop,
        job=sync_job,
        integration=integration,
        mapping=mapping,
        error_type=error_type,
        status_code=status_code,
        error_message=error_msg,
        raw_payload=raw_payload,
    )

    # 3. Log to IntegrationLog
    IntegrationLog.objects.create(
        shop=shop,
        integration=integration,
        level=IntegrationLog.Level.ERROR,
        action="inventory_sync_failure",
        message=f"Inventory sync failed for mapping #{mapping.id}: [{error_type}] {error_msg}",
        details={"error_type": error_type, "status_code": status_code},
    )

    record_integration_audit(
        shop=shop,
        action=str(IntegrationAuditLog.Action.INVENTORY_SYNCHRONIZED),
        integration=integration,
        event_type="inventory.sync",
        internal_id=str(mapping.product_id),
        external_id=str(mapping.external_product_id),
        status="failed",
        error_type=error_type,
        error_message=error_msg,
        http_status=status_code,
        description=f"Inventory sync failed for mapping #{mapping.id}: [{error_type}] {error_msg}",
        details={"mapping_id": mapping.id, "error_type": error_type, "status_code": status_code},
    )

    logger.warning(
        f"Inventory sync failed for mapping #{mapping.id} (Integration #{integration.id}): [{error_type}] {error_msg}"
    )

    # Determine specific outcome status
    if error_type in ["timeout", "server_error"]:
        result_status = "retry"
    elif error_type == "rate_limit":
        result_status = "rate_limited"
    elif error_type == "external_product_deleted":
        result_status = "conflict"
    elif error_type in ["invalid_credentials", "insufficient_permissions"]:
        result_status = "failed_permanently"
    else:
        result_status = "error"

    return InventorySyncResult(
        success=False,
        status=result_status,
        available_quantity=available_qty,
        error_type=error_type,
        error_message=error_msg,
        status_code=status_code,
        retry_after=getattr(exc, "retry_after", 0),
        raw_payload=raw_payload,
    )


# ============================================================================
# 6. Bulk & Initial Synchronization
# ============================================================================

def get_channel_inventory_summary(integration: Integration) -> dict:
    """
    Returns an inventory synchronization status summary for a given integration channel.
    """
    mappings = ProductChannelMapping.all_objects.filter(
        shop_id=integration.shop_id,
        integration=integration,
    )
    total_mappings = mappings.count()
    active_mappings = mappings.exclude(sync_status=ProductChannelMapping.SyncStatus.DISCONNECTED).count()
    synced = mappings.filter(sync_status=ProductChannelMapping.SyncStatus.SYNCED).count()
    errors = mappings.filter(sync_status=ProductChannelMapping.SyncStatus.ERROR).count()
    conflicts = mappings.filter(sync_status=ProductChannelMapping.SyncStatus.CONFLICT).count()
    pending = mappings.filter(sync_status=ProductChannelMapping.SyncStatus.PENDING_SYNC).count()
    latest_sync = (
        mappings.filter(last_synced_at__isnull=False).order_by("-last_synced_at").first()
    )

    return {
        "integration_id": integration.id,
        "integration_name": integration.name,
        "total_mappings": total_mappings,
        "active_mappings": active_mappings,
        "synced": synced,
        "errors": errors,
        "conflicts": conflicts,
        "pending": pending,
        "last_synced_at": latest_sync.last_synced_at if latest_sync else None,
    }


def execute_bulk_inventory_sync(
    integration: Integration,
    mapping_ids: Optional[List[int]] = None,
    job_type: str = "bulk_inventory_sync",
) -> SyncJob:
    """
    Executes bulk synchronization of inventory across all or specified mappings for an integration.
    Records progress and outcomes in a SyncJob instance.
    """
    shop = integration.shop
    set_current_tenant(shop)

    # 1. Create SyncJob
    job = SyncJob.objects.create(
        shop=shop,
        integration=integration,
        job_type=job_type,
        status=SyncJob.Status.RUNNING,
        started_at=timezone.now(),
        metadata={"mapping_ids": mapping_ids or "all"},
    )

    qs = ProductChannelMapping.all_objects.filter(
        shop=shop,
        integration=integration,
        sync_inventory=True,
    ).exclude(sync_status=ProductChannelMapping.SyncStatus.DISCONNECTED)
    if mapping_ids:
        qs = qs.filter(id__in=mapping_ids)

    mappings = list(qs)
    total = len(mappings)
    processed = 0
    failed = 0

    for mapping in mappings:
        result = sync_product_inventory(mapping, sync_job=job)
        if result.success:
            processed += 1
        else:
            failed += 1

    job.items_processed = processed
    job.items_failed = failed
    job.finished_at = timezone.now()
    job.status = SyncJob.Status.COMPLETED if failed == 0 else (
        SyncJob.Status.FAILED if processed == 0 and total > 0 else SyncJob.Status.COMPLETED
    )
    if failed > 0:
        job.error_summary = f"{failed} of {total} mappings failed to sync inventory."
    job.save(update_fields=["items_processed", "items_failed", "finished_at", "status", "error_summary", "updated_at"])

    return job


def initial_inventory_synchronization(integration: Integration) -> SyncJob:
    """
    Initial full inventory push upon connecting a channel.
    """
    return execute_bulk_inventory_sync(integration, job_type="initial_inventory_sync")


sync_bulk_inventory = execute_bulk_inventory_sync
sync_inbound_stock = sync_inbound_stock_from_external


# ============================================================================
# 7. Stock Movement Event Trigger Hook
# ============================================================================

def trigger_inventory_sync_for_movement(movement_id: int):
    """
    Called upon StockMovement creation to push new inventory levels to all
    relevant active channel mappings asynchronously.
    """
    movement = StockMovement.all_objects.filter(id=movement_id).first()
    if not movement:
        return

    shop = movement.shop
    set_current_tenant(shop)

    # Find active mappings for this product (and variation if applicable)
    filters = {
        "shop": shop,
        "product_id": movement.product_id,
        "sync_status__in": [ProductChannelMapping.SyncStatus.ACTIVE, ProductChannelMapping.SyncStatus.SYNCED, ProductChannelMapping.SyncStatus.PENDING_SYNC],
        "sync_inventory": True,
        "integration__is_active": True,
        "integration__status": IntegrationStatus.CONNECTED,
    }
    if movement.variation_id:
        filters["variation_id"] = movement.variation_id

    mappings = list(ProductChannelMapping.all_objects.filter(**filters).values_list("id", flat=True))
    if not mappings:
        return

    # Dispatch to Celery background task
    try:
        from .tasks import sync_inventory_mapping_task
        for mapping_id in mappings:
            sync_inventory_mapping_task.delay(mapping_id)
    except Exception as exc:
        logger.error(f"Failed to enqueue async inventory sync for movement #{movement_id}: {exc}")
        # Synchronous fallback if Celery/Redis is down
        for mapping_id in mappings:
            sync_product_inventory(mapping_id)
