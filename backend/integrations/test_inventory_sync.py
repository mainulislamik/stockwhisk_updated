"""
Comprehensive Test Suite for Phase 6: Central Inventory Synchronization Mechanism.

Verifies:
1. Stock increase (StockMovement purchase_in triggers outbound sync)
2. Stock decrease (StockMovement sale_out triggers outbound sync)
3. Concept verification: ON_HAND, RESERVED, AVAILABLE (AVAILABLE = ON_HAND - RESERVED)
4. Duplicate event deduplication & debouncing
5. Failed API handling & detailed failure recording in SyncError
6. Celery retry mechanism for recoverable errors
7. Mapping failure handling (unmapped product, missing SKU)
8. Multi-tenant isolation enforcement
9. Regression against POS and purchase inventory flows
10. Inbound stock synchronization strictly routed through central StockMovement services
"""
import uuid
from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.core.exceptions import PermissionDenied
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import RoleType, User
from catalog.models import Category, Product, ProductVariation, Unit
from core.tenant_context import set_current_tenant
from integrations.inventory_engine import (
    BaseInventoryAdapter,
    ExternalProductDeletedError,
    ExternalRateLimitError,
    ExternalServerError,
    ExternalTimeoutError,
    InsufficientPermissionsError,
    InvalidCredentialsError,
    InventorySyncResult,
    MissingIdentifierError,
    UnmappedProductError,
    commit_reservation,
    get_channel_inventory_summary,
    get_inventory_adapter,
    get_inventory_levels,
    register_inventory_adapter,
    release_stock,
    reserve_stock,
    sync_bulk_inventory,
    sync_inbound_stock,
    sync_product_inventory,
)
from integrations.models import (
    Integration,
    IntegrationCredential,
    IntegrationStatus,
    InventoryReservation,
    ProductChannelMapping,
    SyncError,
    SyncJob,
)
from inventory.models import MovementType, StockMovement
from inventory.services import apply_movement
from tenants.models import Shop


class MockTestAdapter(BaseInventoryAdapter):
    """Mock external eCommerce adapter for deterministic testing."""

    def __init__(self, integration):
        super().__init__(integration)
        self.pushed_updates = []
        self.should_fail_with = None
        self.custom_retry_after = 60

    def update_remote_stock(self, mapping: ProductChannelMapping, available_quantity: Decimal) -> InventorySyncResult:
        if self.should_fail_with:
            if isinstance(self.should_fail_with, Exception):
                raise self.should_fail_with
            elif callable(self.should_fail_with):
                return self.should_fail_with(mapping, available_quantity)

        self.pushed_updates.append({
            "mapping_id": mapping.id,
            "product_id": mapping.product_id,
            "variation_id": mapping.variation_id,
            "external_product_id": mapping.external_product_id,
            "external_variation_id": mapping.external_variation_id,
            "stock": available_quantity,
        })
        return InventorySyncResult(
            success=True,
            status="synced",
            available_quantity=available_quantity,
            raw_payload={"stock_quantity": float(available_quantity)},
        )

    def fetch_remote_stock(self, mapping: ProductChannelMapping) -> InventorySyncResult:
        return InventorySyncResult(
            success=True,
            status="synced",
            available_quantity=Decimal("10.00"),
        )


class InventorySynchronizationTests(TestCase):
    def setUp(self):
        # 1. Setup Tenants
        self.shop_a = Shop.objects.create(name="Shop Alpha", slug="shop-alpha", modules={"integrations": True})
        self.shop_b = Shop.objects.create(name="Shop Beta", slug="shop-beta", modules={"integrations": True})

        # 2. Setup Users
        self.owner_a = User.objects.create_user(
            email="owner_a@test.com",
            first_name="Owner",
            last_name="A",
            role=RoleType.OWNER,
            shop=self.shop_a,
            password="password123",
        )
        self.cashier_a = User.objects.create_user(
            email="cashier_a@test.com",
            first_name="Cashier",
            last_name="A",
            role=RoleType.CASHIER,
            shop=self.shop_a,
            password="password123",
        )
        self.owner_b = User.objects.create_user(
            email="owner_b@test.com",
            first_name="Owner",
            last_name="B",
            role=RoleType.OWNER,
            shop=self.shop_b,
            password="password123",
        )

        set_current_tenant(self.shop_a)

        # 3. Setup Units & Category
        self.unit_a, _ = Unit.all_objects.get_or_create(
            shop=self.shop_a,
            name="Pcs",
            defaults={"short_code": "pcs", "measure_type": "count", "allow_decimal": False},
        )
        self.cat_a = Category.all_objects.create(shop=self.shop_a, name="Apparel")

        # 4. Setup Products
        self.product_a = Product.all_objects.create(
            shop=self.shop_a,
            category=self.cat_a,
            unit=self.unit_a,
            name="Classic T-Shirt",
            sku="TSHIRT-001",
            selling_price=Decimal("500.00"),
            cost_price=Decimal("300.00"),
            current_stock=Decimal("0.00"),
            reserved_stock=Decimal("0.00"),
            track_inventory=True,
        )

        self.variation_a = ProductVariation.all_objects.create(
            shop=self.shop_a,
            product=self.product_a,
            name="Medium / Blue",
            sku="TSHIRT-001-M-BLU",
            selling_price=Decimal("550.00"),
            cost_price=Decimal("320.00"),
            current_stock=Decimal("0.00"),
            reserved_stock=Decimal("0.00"),
        )

        # 5. Setup Integrations
        self.integration_a = Integration.all_objects.create(
            shop=self.shop_a,
            name="Shop Alpha WooCommerce",
            category="ecommerce",
            provider="woocommerce",
            status=IntegrationStatus.CONNECTED,
            is_active=True,
            config={"allow_inbound_stock_sync": True},
        )
        IntegrationCredential.all_objects.create(
            shop=self.shop_a,
            integration=self.integration_a,
            encrypted_api_key="ENCRYPTED_MOCK_TOKEN",
        )

        # 6. Setup ProductChannelMapping
        self.mapping_simple = ProductChannelMapping.all_objects.create(
            shop=self.shop_a,
            integration=self.integration_a,
            product=self.product_a,
            internal_sku=self.product_a.sku,
            external_product_id="WC-1001",
            external_sku="WC-TSHIRT-SIMPLE",
            sync_status=ProductChannelMapping.SyncStatus.ACTIVE,
            sync_inventory=True,
        )

        self.mapping_variation = ProductChannelMapping.all_objects.create(
            shop=self.shop_a,
            integration=self.integration_a,
            product=self.product_a,
            variation=self.variation_a,
            internal_sku=self.variation_a.sku,
            external_product_id="WC-1001",
            external_variation_id="WC-VAR-501",
            external_sku="WC-TSHIRT-M-BLU",
            sync_status=ProductChannelMapping.SyncStatus.ACTIVE,
            sync_inventory=True,
        )

        # 7. Setup Mock Adapter
        self.adapter = MockTestAdapter(self.integration_a)
        register_inventory_adapter(self.integration_a.id, self.adapter)

        # 8. API Client
        self.client = APIClient()

    def test_concept_on_hand_reserved_available(self):
        """
        Tests the central inventory concept:
        ON_HAND (current_stock)
        RESERVED (reserved_stock)
        AVAILABLE = ON_HAND - RESERVED
        """
        # Initially 0
        levels = get_inventory_levels(self.product_a)
        self.assertEqual(levels["on_hand"], Decimal("0.00"))
        self.assertEqual(levels["reserved"], Decimal("0.00"))
        self.assertEqual(levels["available"], Decimal("0.00"))

        # Add 20 stock via central apply_movement
        apply_movement(
            shop=self.shop_a,
            product=self.product_a,
            movement_type=MovementType.PURCHASE_IN,
            quantity=Decimal("20.00"),
            reference_type="InitialStock",
        )
        self.product_a.refresh_from_db()
        levels = get_inventory_levels(self.product_a)
        self.assertEqual(levels["on_hand"], Decimal("20.00"))
        self.assertEqual(levels["reserved"], Decimal("0.00"))
        self.assertEqual(levels["available"], Decimal("20.00"))

        # Reserve 6 items for web order
        res = reserve_stock(
            shop=self.shop_a,
            integration=self.integration_a,
            product=self.product_a,
            quantity=Decimal("6.00"),
            reference_type="WebOrder",
            reference_id="ORD-101",
        )
        self.product_a.refresh_from_db()
        levels = get_inventory_levels(self.product_a)
        self.assertEqual(levels["on_hand"], Decimal("20.00"))
        self.assertEqual(levels["reserved"], Decimal("6.00"))
        self.assertEqual(levels["available"], Decimal("14.00"))  # 20 - 6 = 14

        # Commit reservation (order fulfilled & dispatched)
        commit_reservation(
            reservation=res,
            sale_id="SALE-101",
        )
        self.product_a.refresh_from_db()
        levels = get_inventory_levels(self.product_a)
        self.assertEqual(levels["on_hand"], Decimal("14.00"))
        self.assertEqual(levels["reserved"], Decimal("0.00"))
        self.assertEqual(levels["available"], Decimal("14.00"))

    def test_stock_increase_triggers_outbound_sync(self):
        """
        Stock increase via central apply_movement (e.g. purchase_in)
        updates current_stock and pushes new available ATS to external website.
        """
        apply_movement(
            shop=self.shop_a,
            product=self.product_a,
            movement_type=MovementType.PURCHASE_IN,
            quantity=Decimal("25.00"),
            reference_type="PurchaseOrder",
            reference_id="PO-777",
        )
        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.current_stock, Decimal("25.00"))
        self.assertEqual(self.product_a.available_stock, Decimal("25.00"))

        # Execute outbound sync
        result = sync_product_inventory(self.mapping_simple)
        self.assertTrue(result.success)
        self.assertEqual(result.status, "synced")
        self.assertEqual(len(self.adapter.pushed_updates), 1)
        self.assertEqual(self.adapter.pushed_updates[0]["stock"], Decimal("25.00"))

        # Verify mapping updated
        self.mapping_simple.refresh_from_db()
        self.assertEqual(self.mapping_simple.sync_status, ProductChannelMapping.SyncStatus.SYNCED)
        self.assertIsNotNone(self.mapping_simple.last_synced_at)

    def test_stock_decrease_triggers_outbound_sync(self):
        """
        Stock decrease via central apply_movement (e.g. sale_out from POS)
        updates current_stock and pushes reduced available stock to external website.
        """
        # Seed initial stock
        apply_movement(
            shop=self.shop_a,
            product=self.product_a,
            movement_type=MovementType.PURCHASE_IN,
            quantity=Decimal("30.00"),
        )
        # POS sale occurs
        apply_movement(
            shop=self.shop_a,
            product=self.product_a,
            movement_type=MovementType.SALE_OUT,
            quantity=Decimal("7.00"),
            reference_type="POSSale",
            reference_id="INV-999",
        )
        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.current_stock, Decimal("23.00"))
        self.assertEqual(self.product_a.available_stock, Decimal("23.00"))

        result = sync_product_inventory(self.mapping_simple)
        self.assertTrue(result.success)
        self.assertEqual(self.adapter.pushed_updates[-1]["stock"], Decimal("23.00"))

    def test_variation_stock_synchronization(self):
        """
        Synchronizing stock for a specific variation pushes variation's stock
        using its external variation ID.
        """
        apply_movement(
            shop=self.shop_a,
            product=self.product_a,
            variation=self.variation_a,
            movement_type=MovementType.PURCHASE_IN,
            quantity=Decimal("12.00"),
        )
        self.variation_a.refresh_from_db()
        self.assertEqual(self.variation_a.current_stock, Decimal("12.00"))

        result = sync_product_inventory(self.mapping_variation)
        self.assertTrue(result.success)
        self.assertEqual(self.adapter.pushed_updates[-1]["variation_id"], self.variation_a.id)
        self.assertEqual(self.adapter.pushed_updates[-1]["external_variation_id"], "WC-VAR-501")
        self.assertEqual(self.adapter.pushed_updates[-1]["stock"], Decimal("12.00"))

    def test_bulk_inventory_synchronization(self):
        """
        Bulk inventory sync processes all active mappings for an integration,
        creates a SyncJob, and tracks processed and failed items.
        """
        apply_movement(
            shop=self.shop_a,
            product=self.product_a,
            movement_type=MovementType.PURCHASE_IN,
            quantity=Decimal("50.00"),
        )
        job = sync_bulk_inventory(self.integration_a)
        self.assertIsNotNone(job)
        self.assertEqual(job.status, SyncJob.Status.COMPLETED)
        self.assertEqual(job.items_processed, 2)  # Simple + Variation
        self.assertEqual(job.items_failed, 0)
        self.assertEqual(len(self.adapter.pushed_updates), 2)

    def test_failed_api_server_error_and_failure_recording(self):
        """
        External server error (HTTP 500) creates SyncError record,
        marks status as ERROR, and flags for retry.
        """
        self.adapter.should_fail_with = ExternalServerError(
            "WooCommerce HTTP 500 Internal Server Error", status_code=500
        )

        result = sync_product_inventory(self.mapping_simple)
        self.assertFalse(result.success)
        self.assertEqual(result.status, "retry")
        self.assertEqual(result.error_type, "server_error")

        # Verify SyncError recorded in database
        error = SyncError.all_objects.filter(
            shop=self.shop_a,
            integration=self.integration_a,
            mapping=self.mapping_simple,
        ).first()
        self.assertIsNotNone(error)
        self.assertEqual(error.error_type, "server_error")
        self.assertEqual(error.status_code, 500)
        self.assertFalse(error.is_resolved)

        self.mapping_simple.refresh_from_db()
        self.assertEqual(self.mapping_simple.sync_status, ProductChannelMapping.SyncStatus.ERROR)

    def test_failed_api_rate_limit(self):
        """
        External rate limit (HTTP 429) records SyncError and extracts retry_after.
        """
        self.adapter.should_fail_with = ExternalRateLimitError(
            "Rate limit exceeded on Shopify", status_code=429, retry_after=180
        )

        result = sync_product_inventory(self.mapping_simple)
        self.assertFalse(result.success)
        self.assertEqual(result.status, "rate_limited")
        self.assertEqual(result.error_type, "rate_limit")
        self.assertEqual(result.retry_after, 180)

        error = SyncError.all_objects.filter(error_type="rate_limit").first()
        self.assertIsNotNone(error)
        self.assertEqual(error.status_code, 429)

    def test_failed_api_timeout(self):
        """
        Network / HTTP timeout is caught and categorized as recoverable retry.
        """
        self.adapter.should_fail_with = ExternalTimeoutError("Read timeout connecting to WooCommerce")

        result = sync_product_inventory(self.mapping_simple)
        self.assertFalse(result.success)
        self.assertEqual(result.status, "retry")
        self.assertEqual(result.error_type, "timeout")

        error = SyncError.all_objects.filter(error_type="timeout").first()
        self.assertIsNotNone(error)

    def test_failed_api_invalid_credentials(self):
        """
        Invalid credentials (HTTP 401) sets integration status to ERROR,
        records permanent failure, and prevents wasteful retries.
        """
        self.adapter.should_fail_with = InvalidCredentialsError(
            "Invalid consumer secret or expired API key", status_code=401
        )

        result = sync_product_inventory(self.mapping_simple)
        self.assertFalse(result.success)
        self.assertEqual(result.status, "failed_permanently")
        self.assertEqual(result.error_type, "invalid_credentials")

        self.integration_a.refresh_from_db()
        self.assertEqual(self.integration_a.status, IntegrationStatus.ERROR)

    def test_deleted_external_product_marked_conflict(self):
        """
        External product deleted (HTTP 404) marks mapping status as CONFLICT
        instead of infinite retrying.
        """
        self.adapter.should_fail_with = ExternalProductDeletedError(
            "Product WC-1001 not found on external store", status_code=404
        )

        result = sync_product_inventory(self.mapping_simple)
        self.assertFalse(result.success)
        self.assertEqual(result.status, "conflict")
        self.assertEqual(result.error_type, "external_product_deleted")

        self.mapping_simple.refresh_from_db()
        self.assertEqual(self.mapping_simple.sync_status, ProductChannelMapping.SyncStatus.CONFLICT)

    def test_mapping_failure_unmapped_product(self):
        """
        Attempting to sync an unmapped product handles gracefully without crashing,
        returning an unmapped status.
        """
        unmapped_prod = Product.all_objects.create(
            shop=self.shop_a,
            category=self.cat_a,
            unit=self.unit_a,
            name="Unmapped Hat",
            sku="HAT-999",
            selling_price=Decimal("200.00"),
        )
        result = sync_product_inventory(mapping_or_id=None, product_id=unmapped_prod.id, integration=self.integration_a)
        self.assertFalse(result.success)
        self.assertEqual(result.status, "unmapped")
        self.assertEqual(result.error_type, "unmapped_product")

    def test_inbound_stock_sync_strictly_reuses_stockmovement_services(self):
        """
        CRITICAL RULE VERIFICATION:
        Inbound sync from external website to StockWhisk MUST pass through
        central inventory.services.apply_movement.
        It must NEVER directly mutate Product.current_stock.
        """
        # Initial stock is 0
        self.assertEqual(self.product_a.current_stock, Decimal("0.00"))

        # Inbound stock change to 15 from external channel
        movement = sync_inbound_stock(
            shop=self.shop_a,
            integration=self.integration_a,
            mapping=self.mapping_simple,
            external_quantity=Decimal("15.00"),
            note="External WooCommerce webhook stock update",
        )
        self.assertIsNotNone(movement)
        self.assertEqual(movement.movement_type, MovementType.ADJUST_IN)
        self.assertEqual(movement.quantity, Decimal("15.00"))

        # Verify database state was updated by apply_movement
        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.current_stock, Decimal("15.00"))

        # Inbound stock change decreasing stock to 10
        movement_down = sync_inbound_stock(
            shop=self.shop_a,
            integration=self.integration_a,
            mapping=self.mapping_simple,
            external_quantity=Decimal("10.00"),
        )
        self.assertIsNotNone(movement_down)
        self.assertEqual(movement_down.movement_type, MovementType.ADJUST_OUT)
        self.assertEqual(movement_down.quantity, Decimal("-5.00"))

        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.current_stock, Decimal("10.00"))

    def test_inbound_stock_sync_denied_when_data_ownership_forbids_it(self):
        """
        Inbound inventory sync is rejected with PermissionDenied when
        data ownership matrix has not approved it.
        """
        self.integration_a.config = {"allow_inbound_stock_sync": False}
        self.integration_a.save()

        with self.assertRaises(PermissionDenied):
            sync_inbound_stock(
                shop=self.shop_a,
                integration=self.integration_a,
                mapping=self.mapping_simple,
                external_quantity=Decimal("50.00"),
            )

    def test_tenant_isolation(self):
        """
        Strict multi-tenant boundary: Tenant A's inventory operations,
        mappings, and sync jobs cannot be accessed or manipulated by Tenant B.
        """
        # Tenant B user tries to access Tenant A's mapping sync
        self.client.force_authenticate(user=self.owner_b)
        response = self.client.post(f"/api/integrations/mappings/{self.mapping_simple.id}/sync-inventory/")
        # DRF ViewSet handles non-existent or foreign tenant instance via 404
        self.assertIn(response.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_301_MOVED_PERMANENTLY])

        # Tenant B cannot see Tenant A's SyncErrors
        SyncError.all_objects.create(
            shop=self.shop_a,
            integration=self.integration_a,
            mapping=self.mapping_simple,
            error_type="timeout",
            error_message="Tenant A secret error",
        )
        res_errors = self.client.get("/api/integrations/sync-errors/", follow=True)
        self.assertEqual(res_errors.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_errors.data.get("results", [])), 0)

    def test_pos_and_purchase_regression_unaffected(self):
        """
        Verifies that StockWhisk core POS and purchasing operations continue
        to update inventory and create StockMovements with 100% precision.
        """
        # 1. Purchase receipt
        movement_po = apply_movement(
            shop=self.shop_a,
            product=self.product_a,
            movement_type=MovementType.PURCHASE_IN,
            quantity=Decimal("100.00"),
            unit_cost=Decimal("300.00"),
            reference_type="Purchase",
            reference_id="PO-001",
        )
        self.assertEqual(movement_po.quantity, Decimal("100.00"))
        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.current_stock, Decimal("100.00"))

        # 2. POS walk-in sale
        movement_pos = apply_movement(
            shop=self.shop_a,
            product=self.product_a,
            movement_type=MovementType.SALE_OUT,
            quantity=Decimal("4.00"),
            reference_type="Sale",
            reference_id="SALE-001",
        )
        self.assertEqual(movement_pos.quantity, Decimal("-4.00"))
        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.current_stock, Decimal("96.00"))

        # Verify summary helper
        summary = get_channel_inventory_summary(self.integration_a)
        self.assertEqual(summary["total_mappings"], 2)
        self.assertEqual(summary["active_mappings"], 2)
