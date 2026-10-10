"""
Automated Test Suite for Generic External Order Synchronization (Phase 7).

Verifies the end-to-end order synchronization process:
- New order ingestion & Sale creation
- Duplicate order idempotency (zero duplicates)
- Order status update (cancellation & reservation release, completion & reservation commit)
- Unknown SKU handling
- Missing mapping handling
- Invalid quantity rejection
- Invalid tenant & cross-tenant security
- Malformed order payload handling
- External API failure & logging
- Atomic transaction rollback
"""
from decimal import Decimal
from unittest.mock import patch

from django.db import DatabaseError, transaction
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import RoleType, User
from catalog.models import Category, Product, ProductVariation, Unit
from crm.models import Customer
from inventory.models import MovementType, StockMovement
from inventory.services import apply_movement
from sales.models import Payment, Sale, SaleItem
from tenants.models import Shop

from .inventory_engine import get_inventory_levels
from .models import (
    ExternalOrder,
    Integration,
    IntegrationCategory,
    IntegrationCredential,
    IntegrationProvider,
    IntegrationStatus,
    InventoryReservation,
    ProductChannelMapping,
    SyncError,
)
from .order_engine import (
    ExternalAPIError,
    InvalidQuantityError,
    MalformedOrderPayloadError,
    OrderSyncError,
    StandardOrderDTO,
    StandardOrderItemDTO,
    TenantAuthenticationError,
    UnmappedProductOrderError,
    parse_and_validate_order_payload,
    process_external_order,
    push_external_order_status,
    update_external_order_state,
)


class GenericOrderSyncTestCase(TestCase):
    """Rigorous Phase 7 Generic Order Sync Test Suite."""

    def setUp(self):
        # 1. Create Tenant A
        self.shop_a = Shop.objects.create(
            name="Alpha Retail",
            slug="alpha-retail",
            is_active=True,
        )
        self.user_a = User.objects.create_user(
            email="admin@alpha.com",
            password="password123",
            first_name="Alpha",
            last_name="Admin",
            role=RoleType.OWNER,
            shop=self.shop_a,
        )

        # 2. Create Tenant B
        self.shop_b = Shop.objects.create(
            name="Beta Retail",
            slug="beta-retail",
            is_active=True,
        )
        self.user_b = User.objects.create_user(
            email="admin@beta.com",
            password="password123",
            first_name="Beta",
            last_name="Admin",
            role=RoleType.OWNER,
            shop=self.shop_b,
        )

        # 3. Create Integrations
        self.integration_a = Integration.all_objects.create(
            shop=self.shop_a,
            name="Alpha Online Store",
            category=IntegrationCategory.ECOMMERCE,
            provider=IntegrationProvider.CUSTOM_WEBHOOK,
            status=IntegrationStatus.CONNECTED,
            is_active=True,
            config={"sync_inventory": True},
        )
        self.credential_a = IntegrationCredential.all_objects.create(
            shop=self.shop_a,
            integration=self.integration_a,
            encrypted_api_key="alpha_secret_token",
        )

        self.integration_b = Integration.all_objects.create(
            shop=self.shop_b,
            name="Beta Online Store",
            category=IntegrationCategory.ECOMMERCE,
            provider=IntegrationProvider.CUSTOM_WEBHOOK,
            status=IntegrationStatus.CONNECTED,
            is_active=True,
        )

        # 4. Products for Tenant A
        self.unit_a, _ = Unit.all_objects.get_or_create(
            shop=self.shop_a,
            name="Pcs",
            defaults={"short_code": "pcs", "measure_type": "count", "allow_decimal": False},
        )
        self.cat_a = Category.objects.create(shop=self.shop_a, name="Gadgets")
        self.prod_a1 = Product.objects.create(
            shop=self.shop_a,
            category=self.cat_a,
            unit=self.unit_a,
            name="Smart Watch X",
            sku="SW-X-01",
            current_stock=Decimal("0.00"),
            reserved_stock=Decimal("0.00"),
            cost_price=Decimal("1800.00"),
            selling_price=Decimal("2500.00"),
            track_inventory=True,
        )
        apply_movement(
            shop=self.shop_a,
            product=self.prod_a1,
            movement_type=MovementType.PURCHASE_IN,
            quantity=Decimal("50.00"),
            reference_type="InitialStock",
        )
        self.prod_a1.refresh_from_db()

        self.prod_a2 = Product.objects.create(
            shop=self.shop_a,
            category=self.cat_a,
            unit=self.unit_a,
            name="Wireless Earbuds Pro",
            sku="WE-PRO-02",
            current_stock=Decimal("0.00"),
            reserved_stock=Decimal("0.00"),
            cost_price=Decimal("800.00"),
            selling_price=Decimal("1200.00"),
            track_inventory=True,
        )
        apply_movement(
            shop=self.shop_a,
            product=self.prod_a2,
            movement_type=MovementType.PURCHASE_IN,
            quantity=Decimal("30.00"),
            reference_type="InitialStock",
        )
        self.prod_a2.refresh_from_db()

        # Product Channel Mappings for Tenant A
        self.map_a1 = ProductChannelMapping.all_objects.create(
            shop=self.shop_a,
            integration=self.integration_a,
            product=self.prod_a1,
            external_product_id="EXT-PROD-101",
            external_sku="SW-X-01",
            sync_status=ProductChannelMapping.SyncStatus.ACTIVE,
            sync_inventory=True,
        )
        self.map_a2 = ProductChannelMapping.all_objects.create(
            shop=self.shop_a,
            integration=self.integration_a,
            product=self.prod_a2,
            external_product_id="EXT-PROD-102",
            external_sku="WE-PRO-02",
            sync_status=ProductChannelMapping.SyncStatus.ACTIVE,
            sync_inventory=True,
        )

        self.client = APIClient()

    def test_01_new_order_creation_and_reservation(self):
        """Test standard incoming external order creates Sale, ExternalOrder, and reserves stock."""
        payload = {
            "external_order_id": "WO-9901",
            "external_order_number": "#9901",
            "external_status": "pending",
            "customer_name": "Rahim Khan",
            "customer_phone": "01711000111",
            "customer_email": "rahim@gmail.com",
            "shipping_address": "House 12, Road 5, Dhanmondi, Dhaka",
            "items": [
                {
                    "external_item_id": "EXT-PROD-101",
                    "sku": "SW-X-01",
                    "name": "Smart Watch X",
                    "quantity": "2",
                    "unit_price": "2500.00",
                    "discount": "100.00",
                },
                {
                    "external_item_id": "EXT-PROD-102",
                    "sku": "WE-PRO-02",
                    "name": "Wireless Earbuds Pro",
                    "quantity": "1",
                    "unit_price": "1200.00",
                    "discount": "0.00",
                },
            ],
            "discount": "100.00",
            "shipping_charge": "60.00",
            "paid_amount": "0.00",  # COD
            "payment_method": "Cash on Delivery",
        }

        ext_order, created = process_external_order(
            shop=self.shop_a,
            integration=self.integration_a,
            order_payload=payload,
        )

        self.assertTrue(created)
        self.assertEqual(ext_order.external_order_id, "WO-9901")
        self.assertEqual(ext_order.sync_status, ExternalOrder.SyncStatus.SYNCED)
        self.assertIsNotNone(ext_order.sale)

        # Verify Sale details
        sale = ext_order.sale
        self.assertEqual(sale.status, Sale.Status.DUE)
        self.assertEqual(sale.items.count(), 2)
        if sale.customer:
            self.assertEqual(sale.customer.name, "Rahim Khan")
            self.assertEqual(sale.customer.phone, "01711000111")
        else:
            self.assertEqual(sale.customer_name, "Rahim Khan")
            self.assertEqual(sale.customer_phone, "01711000111")
        self.assertEqual(sale.delivery_charge, Decimal("60.00"))

        # Verify Customer record auto-resolution/creation in CRM
        customer = Customer.all_objects.filter(shop=self.shop_a, phone="01711000111").first()
        self.assertIsNotNone(customer)
        self.assertEqual(customer.name, "Rahim Khan")

        # Verify Stock Reservation (Critical: physical current_stock untouched, reserved_stock incremented)
        self.prod_a1.refresh_from_db()
        self.prod_a2.refresh_from_db()

        self.assertEqual(self.prod_a1.current_stock, Decimal("50.00"))
        self.assertEqual(self.prod_a1.reserved_stock, Decimal("2.00"))
        self.assertEqual(self.prod_a1.available_stock, Decimal("48.00"))

        self.assertEqual(self.prod_a2.current_stock, Decimal("30.00"))
        self.assertEqual(self.prod_a2.reserved_stock, Decimal("1.00"))
        self.assertEqual(self.prod_a2.available_stock, Decimal("29.00"))

        reservations = InventoryReservation.all_objects.filter(
            shop=self.shop_a,
            reference_type="Sale",
            reference_id=str(sale.id),
            status=InventoryReservation.Status.ACTIVE,
        )
        self.assertEqual(reservations.count(), 2)

    def test_02_duplicate_order_idempotency(self):
        """The same external order must never create duplicate internal orders."""
        payload = {
            "external_order_id": "WO-DUP-100",
            "external_order_number": "#100",
            "items": [
                {
                    "external_item_id": "EXT-PROD-101",
                    "sku": "SW-X-01",
                    "quantity": "1",
                    "unit_price": "2500.00",
                }
            ],
            "total": "2500.00",
        }

        # 1st Call
        order1, created1 = process_external_order(self.shop_a, self.integration_a, payload)
        self.assertTrue(created1)

        # Initial counts
        sale_count_initial = Sale.all_objects.filter(shop=self.shop_a).count()
        ext_count_initial = ExternalOrder.all_objects.filter(shop=self.shop_a).count()
        res_count_initial = InventoryReservation.all_objects.filter(shop=self.shop_a).count()

        # 2nd Call (exact duplicate)
        order2, created2 = process_external_order(self.shop_a, self.integration_a, payload)
        self.assertFalse(created2)
        self.assertEqual(order1.id, order2.id)

        # Verify no duplicate models were created
        self.assertEqual(Sale.all_objects.filter(shop=self.shop_a).count(), sale_count_initial)
        self.assertEqual(ExternalOrder.all_objects.filter(shop=self.shop_a).count(), ext_count_initial)
        self.assertEqual(InventoryReservation.all_objects.filter(shop=self.shop_a).count(), res_count_initial)

        # Stock reservation must remain 1.00, not double to 2.00
        self.prod_a1.refresh_from_db()
        self.assertEqual(self.prod_a1.reserved_stock, Decimal("1.00"))
        self.assertEqual(self.prod_a1.available_stock, Decimal("49.00"))

    def test_03_updated_order_state_cancelled(self):
        """Updating an order to cancelled releases the inventory reservations and marks Sale cancelled."""
        payload = {
            "external_order_id": "WO-CANCEL-200",
            "items": [
                {
                    "external_item_id": "EXT-PROD-101",
                    "sku": "SW-X-01",
                    "quantity": "3",
                    "unit_price": "2500.00",
                }
            ],
            "total": "7500.00",
            "external_status": "pending",
        }
        ext_order, _ = process_external_order(self.shop_a, self.integration_a, payload)

        self.prod_a1.refresh_from_db()
        self.assertEqual(self.prod_a1.reserved_stock, Decimal("3.00"))
        self.assertEqual(self.prod_a1.available_stock, Decimal("47.00"))

        # Update payload: status becomes cancelled
        cancel_payload = dict(payload)
        cancel_payload["external_status"] = "cancelled"

        updated_order, created = process_external_order(self.shop_a, self.integration_a, cancel_payload)
        self.assertFalse(created)
        self.assertEqual(updated_order.sync_status, ExternalOrder.SyncStatus.CANCELLED)

        # Verify Sale is CANCELLED
        updated_order.sale.refresh_from_db()
        self.assertEqual(updated_order.sale.status, Sale.Status.CANCELLED)

        # Verify reservations are RELEASED
        reservations = InventoryReservation.all_objects.filter(
            shop=self.shop_a,
            reference_type="Sale",
            reference_id=str(updated_order.sale.id),
        )
        for res in reservations:
            self.assertEqual(res.status, InventoryReservation.Status.RELEASED)

        # Verify reserved stock was decremented back to 0.00 and available stock restored to 50.00
        self.prod_a1.refresh_from_db()
        self.assertEqual(self.prod_a1.reserved_stock, Decimal("0.00"))
        self.assertEqual(self.prod_a1.available_stock, Decimal("50.00"))

    def test_04_updated_order_state_completed(self):
        """Completing an order commits reservations to permanent SALE_OUT movements."""
        payload = {
            "external_order_id": "WO-COMPLETE-300",
            "items": [
                {
                    "external_item_id": "EXT-PROD-101",
                    "sku": "SW-X-01",
                    "quantity": "2",
                    "unit_price": "2500.00",
                }
            ],
            "total": "5000.00",
            "paid_amount": "5000.00",
            "payment_method": "bKash",
            "external_status": "processing",
        }
        ext_order, _ = process_external_order(self.shop_a, self.integration_a, payload)

        # Status update to completed / delivered
        complete_payload = dict(payload)
        complete_payload["external_status"] = "completed"

        updated_order, _ = process_external_order(self.shop_a, self.integration_a, complete_payload)
        self.assertEqual(updated_order.sync_status, ExternalOrder.SyncStatus.COMPLETED)

        # Verify reservations are COMMITTED
        reservations = InventoryReservation.all_objects.filter(
            shop=self.shop_a,
            reference_type="Sale",
            reference_id=str(updated_order.sale.id),
        )
        for res in reservations:
            self.assertEqual(res.status, InventoryReservation.Status.COMMITTED)

        # Verify StockMovement was created via core inventory logic
        movement = StockMovement.all_objects.filter(
            shop=self.shop_a,
            reference_type="Sale",
            reference_id=str(updated_order.sale.id),
            movement_type=MovementType.SALE_OUT,
        ).first()
        self.assertIsNotNone(movement)
        self.assertEqual(abs(movement.quantity), Decimal("2.00"))

        # Verify physical stock is now 48.00 and reserved_stock is 0.00
        self.prod_a1.refresh_from_db()
        self.assertEqual(self.prod_a1.current_stock, Decimal("48.00"))
        self.assertEqual(self.prod_a1.reserved_stock, Decimal("0.00"))
        self.assertEqual(self.prod_a1.available_stock, Decimal("48.00"))

    def test_05_unknown_sku_handling(self):
        """Unknown SKU in external order raises UnmappedProductOrderError and records SyncError."""
        payload = {
            "external_order_id": "WO-UNKNOWN-SKU",
            "items": [
                {
                    "external_item_id": "NON-EXISTENT-ID",
                    "sku": "UNKNOWN-GHOST-SKU",
                    "quantity": "1",
                    "unit_price": "500.00",
                }
            ],
        }

        with self.assertRaises(UnmappedProductOrderError):
            process_external_order(self.shop_a, self.integration_a, payload)

        # Verify SyncError was logged
        sync_error = SyncError.all_objects.filter(
            shop=self.shop_a,
            integration=self.integration_a,
            error_type="unmapped_product",
        ).first()
        self.assertIsNotNone(sync_error)
        self.assertIn("UNKNOWN-GHOST-SKU", sync_error.error_message)

        # Ensure no orphaned Sale was created
        self.assertFalse(Sale.all_objects.filter(shop=self.shop_a, idempotency_key__contains="WO-UNKNOWN-SKU").exists())

    def test_06_missing_mapping_fallback_to_catalog(self):
        """If ProductChannelMapping is missing, but SKU exists in catalog, it resolves cleanly."""
        # prod_unmapped has NO ProductChannelMapping
        prod_unmapped = Product.objects.create(
            shop=self.shop_a,
            category=self.cat_a,
            unit=self.unit_a,
            name="USB-C Fast Cable",
            sku="CABLE-TC-09",
            current_stock=Decimal("0.00"),
            reserved_stock=Decimal("0.00"),
            cost_price=Decimal("200.00"),
            selling_price=Decimal("350.00"),
            track_inventory=True,
        )
        apply_movement(
            shop=self.shop_a,
            product=prod_unmapped,
            movement_type=MovementType.PURCHASE_IN,
            quantity=Decimal("100.00"),
            reference_type="InitialStock",
        )
        prod_unmapped.refresh_from_db()

        payload = {
            "external_order_id": "WO-UNMAPPED-FALLBACK",
            "items": [
                {
                    "sku": "CABLE-TC-09",
                    "quantity": "2",
                    "unit_price": "350.00",
                }
            ],
            "total": "700.00",
        }

        ext_order, created = process_external_order(self.shop_a, self.integration_a, payload)
        self.assertTrue(created)
        self.assertEqual(ext_order.sale.items.first().product, prod_unmapped)

        prod_unmapped.refresh_from_db()
        self.assertEqual(prod_unmapped.reserved_stock, Decimal("2.00"))
        self.assertEqual(prod_unmapped.available_stock, Decimal("98.00"))

    def test_07_invalid_quantity(self):
        """Zero, negative, or invalid quantity must raise InvalidQuantityError before creating records."""
        payload_zero = {
            "external_order_id": "WO-QTY-ZERO",
            "items": [{"sku": "SW-X-01", "quantity": "0", "unit_price": "2500.00"}],
        }
        with self.assertRaises(InvalidQuantityError):
            process_external_order(self.shop_a, self.integration_a, payload_zero)

        payload_neg = {
            "external_order_id": "WO-QTY-NEG",
            "items": [{"sku": "SW-X-01", "quantity": "-5", "unit_price": "2500.00"}],
        }
        with self.assertRaises(InvalidQuantityError):
            process_external_order(self.shop_a, self.integration_a, payload_neg)

        payload_bad = {
            "external_order_id": "WO-QTY-BAD",
            "items": [{"sku": "SW-X-01", "quantity": "not_a_number", "unit_price": "2500.00"}],
        }
        with self.assertRaises(InvalidQuantityError):
            process_external_order(self.shop_a, self.integration_a, payload_bad)

        self.assertFalse(ExternalOrder.all_objects.filter(shop=self.shop_a).exists())

    def test_08_invalid_tenant(self):
        """Processing an order for mismatched or inactive tenant must raise TenantAuthenticationError."""
        payload = {
            "external_order_id": "WO-TENANT-MISMATCH",
            "items": [{"sku": "SW-X-01", "quantity": "1", "unit_price": "2500.00"}],
        }

        # shop_b trying to use integration_a (cross-tenant mismatch)
        with self.assertRaises(TenantAuthenticationError):
            process_external_order(self.shop_b, self.integration_a, payload)

        # Inactive integration
        self.integration_a.is_active = False
        self.integration_a.save()
        with self.assertRaises(TenantAuthenticationError):
            process_external_order(self.shop_a, self.integration_a, payload)

    def test_09_malformed_order_payload(self):
        """Malformed payloads (empty dict, missing external_order_id, empty items list) raise MalformedOrderPayloadError."""
        with self.assertRaises(MalformedOrderPayloadError):
            process_external_order(self.shop_a, self.integration_a, {})

        with self.assertRaises(MalformedOrderPayloadError):
            process_external_order(self.shop_a, self.integration_a, {"items": [{"sku": "SW-X-01", "quantity": 1}]})

        with self.assertRaises(MalformedOrderPayloadError):
            process_external_order(self.shop_a, self.integration_a, {"external_order_id": "WO-EMPTY", "items": []})

    def test_10_external_api_failure(self):
        """Simulate external API failure when pushing order updates; records SyncError."""
        self.integration_a.config = {"simulate_order_error": "502"}
        self.integration_a.save()

        with self.assertRaises(ExternalAPIError) as ctx:
            push_external_order_status(self.integration_a, "WO-123", "completed")

        self.assertEqual(ctx.exception.status_code, 502)

        # Verify SyncError was recorded
        sync_err = SyncError.all_objects.filter(
            shop=self.shop_a,
            integration=self.integration_a,
            error_type="server_error",
        ).first()
        self.assertIsNotNone(sync_err)
        self.assertEqual(sync_err.status_code, 502)

    def test_11_transaction_rollback(self):
        """Failure during order processing rolls back transaction completely (no partial Sale/Reservation)."""
        payload = {
            "external_order_id": "WO-ROLLBACK-TEST",
            "items": [
                {
                    "sku": "SW-X-01",
                    "quantity": "2",
                    "unit_price": "2500.00",
                }
            ],
            "total": "5000.00",
        }

        # Simulate exception during reservation creation
        with patch("integrations.order_engine.reserve_inventory_for_order") as mock_res:
            mock_res.side_effect = DatabaseError("Simulated database deadlock during reservation")

            with self.assertRaises(DatabaseError):
                process_external_order(self.shop_a, self.integration_a, payload)

        # Assert no orphaned Sale, SaleItem, or ExternalOrder was committed
        self.assertFalse(Sale.all_objects.filter(shop=self.shop_a, custom_fields__external_order_id="WO-ROLLBACK-TEST").exists())
        self.assertFalse(ExternalOrder.all_objects.filter(shop=self.shop_a, external_order_id="WO-ROLLBACK-TEST").exists())

        # Stock reservation must remain 0
        self.prod_a1.refresh_from_db()
        self.assertEqual(self.prod_a1.reserved_stock, Decimal("0.00"))
        self.assertEqual(self.prod_a1.available_stock, Decimal("50.00"))

    def test_12_api_order_ingestion_endpoint(self):
        """Test REST API /api/integrations/orders/ingest/ endpoint."""
        self.client.force_authenticate(user=self.user_a)

        payload = {
            "integration_id": str(self.integration_a.id),
            "order": {
                "external_order_id": "API-ORDER-777",
                "customer_name": "API Tester",
                "customer_phone": "01888123456",
                "items": [
                    {
                        "sku": "SW-X-01",
                        "quantity": "1",
                        "unit_price": "2500.00",
                    }
                ],
                "total": "2500.00",
            },
        }

        # First request -> 201 Created
        resp = self.client.post("/api/integrations/orders/ingest", payload, format="json", secure=True)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(resp.data["created"])
        self.assertEqual(resp.data["order"]["external_order_id"], "API-ORDER-777")

        # Second request -> 200 OK (idempotent)
        resp2 = self.client.post("/api/integrations/orders/ingest", payload, format="json", secure=True)
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        self.assertFalse(resp2.data["created"])
