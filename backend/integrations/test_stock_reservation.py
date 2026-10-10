"""
Unit and Concurrency Tests for StockWhisk Stock Reservation Engine (Phase 8).

Verifies:
1. Concurrency: Stock = 1, Two simultaneous orders -> Only ONE succeeds.
2. Cancellation releases reserved stock back to Available-to-Sell.
3. Duplicate webhook does not double reserve stock.
4. Failed transaction restores consistency (rollback).
5. Multiple products reservation (all-or-nothing).
6. Deterministic lock ordering (deadlock prevention across concurrent requests).
7. Partial quantities & partial cancellation.
8. Tenant isolation (cross-tenant safety).
9. POS remains functional alongside active web reservations.
10. API endpoints for partial cancellation and reservation release.
"""
import threading
from decimal import Decimal
from django.db import connection, transaction
from django.test import TransactionTestCase
from rest_framework.test import APIClient

from accounts.models import RoleType, User
from catalog.models import Category, Product, Unit
from crm.models import Customer
from inventory.models import MovementType
from inventory.services import apply_movement
from sales.models import Sale
from sales.services import create_sale
from tenants.models import Shop

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
    IntegrationCategory,
    IntegrationCredential,
    IntegrationProvider,
    IntegrationStatus,
    InventoryReservation,
    ProductChannelMapping,
    SyncError,
)
from .order_engine import (
    commit_order_reservations,
    partially_cancel_order_reservation,
    process_external_order,
    release_order_reservations,
    update_external_order_state,
    StandardOrderDTO,
)


class StockReservationPhase8Tests(TransactionTestCase):
    def setUp(self):
        super().setUp()
        self.shop = Shop.objects.create(
            name="Phase 8 Test Store",
            slug="phase-8-store",
            is_active=True,
        )
        self.user = User.objects.create(
            email="phase8_admin@example.com",
            shop=self.shop,
            role=RoleType.OWNER,
            is_active=True,
        )
        self.user.set_password("pass123")
        self.user.save()

        self.integration = Integration.all_objects.create(
            shop=self.shop,
            name="Main Online Store",
            category=IntegrationCategory.ECOMMERCE,
            provider=IntegrationProvider.CUSTOM_WEBHOOK,
            status=IntegrationStatus.CONNECTED,
            is_active=True,
            config={"sync_inventory": True, "sync_orders": True},
        )
        self.credential = IntegrationCredential.all_objects.create(
            shop=self.shop,
            integration=self.integration,
            encrypted_api_key="phase8_secret_token",
        )

        self.category = Category.objects.create(
            shop=self.shop,
            name="General",
        )
        self.unit, _ = Unit.all_objects.get_or_create(
            shop=self.shop,
            name="Pcs",
            defaults={"short_code": "pcs", "measure_type": "count", "allow_decimal": False},
        )

        # Base product with stock = 10
        self.product = Product.objects.create(
            shop=self.shop,
            category=self.category,
            unit=self.unit,
            name="Smart Gadget",
            sku="GADGET-001",
            cost_price=Decimal("50.00"),
            selling_price=Decimal("100.00"),
            track_inventory=True,
        )
        apply_movement(
            shop=self.shop,
            product=self.product,
            movement_type=MovementType.OPENING,
            quantity=Decimal("10.00"),
            note="Initial Stock 10",
        )

        ProductChannelMapping.objects.create(
            shop=self.shop,
            integration=self.integration,
            product=self.product,
            external_product_id="ext-prod-001",
            external_sku="EXT-GADGET-001",
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    # =========================================================================
    # 1. MANDATORY CONCURRENCY: Stock = 1, Two Simultaneous Orders -> Only 1 Succeeds
    # =========================================================================
    def test_01_mandatory_concurrency_stock_1_two_simultaneous_orders_only_one_succeeds(self):
        """
        Critical business rule:
        If available stock is 1 and two orders arrive simultaneously,
        only ONE order may successfully reserve the stock; the other must fail.
        """
        # Create a single-stock item
        single_item_product = Product.objects.create(
            shop=self.shop,
            category=self.category,
            unit=self.unit,
            name="Rare Item",
            sku="RARE-001",
            cost_price=Decimal("200.00"),
            selling_price=Decimal("500.00"),
            track_inventory=True,
        )
        apply_movement(
            shop=self.shop,
            product=single_item_product,
            movement_type=MovementType.OPENING,
            quantity=Decimal("1.00"),
            note="Single stock only",
        )
        ProductChannelMapping.objects.create(
            shop=self.shop,
            integration=self.integration,
            product=single_item_product,
            external_product_id="ext-rare-001",
            external_sku="EXT-RARE-001",
        )

        levels_before = get_inventory_levels(single_item_product)
        self.assertEqual(levels_before["available"], Decimal("1.00"))

        order_1_payload = {
            "external_order_id": "SIMULTANEOUS-ORDER-A",
            "items": [
                {
                    "external_product_id": "ext-rare-001",
                    "sku": "EXT-RARE-001",
                    "name": "Rare Item",
                    "quantity": "1.00",
                    "unit_price": "500.00",
                }
            ],
            "total": "500.00",
            "customer_phone": "01711000001",
            "customer_name": "Buyer A",
        }
        order_2_payload = {
            "external_order_id": "SIMULTANEOUS-ORDER-B",
            "items": [
                {
                    "external_product_id": "ext-rare-001",
                    "sku": "EXT-RARE-001",
                    "name": "Rare Item",
                    "quantity": "1.00",
                    "unit_price": "500.00",
                }
            ],
            "total": "500.00",
            "customer_phone": "01711000002",
            "customer_name": "Buyer B",
        }

        results = {"success": [], "failure": []}
        lock = threading.Lock()

        def worker(payload):
            connection.close()  # Fresh connection per thread
            try:
                order, created = process_external_order(
                    shop=self.shop,
                    integration=self.integration,
                    order_payload=payload,
                )
                with lock:
                    results["success"].append((payload["external_order_id"], order.id))
            except InsufficientStockOrderError as exc:
                with lock:
                    results["failure"].append((payload["external_order_id"], str(exc)))
            except Exception as exc:
                with lock:
                    results["failure"].append((payload["external_order_id"], f"Unexpected: {exc}"))
            finally:
                connection.close()

        t1 = threading.Thread(target=worker, args=(order_1_payload,))
        t2 = threading.Thread(target=worker, args=(order_2_payload,))

        t1.start()
        t2.start()

        t1.join(timeout=10)
        t2.join(timeout=10)

        # Exactly ONE must succeed and exactly ONE must fail due to insufficient stock
        self.assertEqual(len(results["success"]), 1, f"Expected exactly 1 success, got: {results['success']}")
        self.assertEqual(len(results["failure"]), 1, f"Expected exactly 1 failure, got: {results['failure']}")

        # Verify DB state: available stock must be 0, reserved stock must be exactly 1, no negative stock
        single_item_product.refresh_from_db()
        self.assertEqual(single_item_product.current_stock, Decimal("1.00"))
        self.assertEqual(single_item_product.reserved_stock, Decimal("1.00"))
        levels_after = get_inventory_levels(single_item_product)
        self.assertEqual(levels_after["available"], Decimal("0.00"))

        active_reservations = InventoryReservation.all_objects.filter(
            shop=self.shop,
            product=single_item_product,
            status=InventoryReservation.Status.ACTIVE,
        )
        self.assertEqual(active_reservations.count(), 1)
        self.assertEqual(active_reservations.first().quantity, Decimal("1.00"))

    # =========================================================================
    # 2. CANCELLATION RELEASES STOCK
    # =========================================================================
    def test_02_cancellation_releases_stock(self):
        """Cancelling an external order restores available stock immediately."""
        payload = {
            "external_order_id": "ORDER-CANCEL-01",
            "items": [
                {
                    "sku": "EXT-GADGET-001",
                    "name": "Smart Gadget",
                    "quantity": "3.00",
                    "unit_price": "100.00",
                }
            ],
            "total": "300.00",
        }
        order, created = process_external_order(
            shop=self.shop,
            integration=self.integration,
            order_payload=payload,
        )
        self.assertTrue(created)

        # Before cancel: 10 - 3 = 7 available
        self.product.refresh_from_db()
        self.assertEqual(self.product.reserved_stock, Decimal("3.00"))
        self.assertEqual(get_inventory_levels(self.product)["available"], Decimal("7.00"))

        # Cancel the order
        cancel_dto = StandardOrderDTO(
            external_order_id="ORDER-CANCEL-01",
            external_status="cancelled",
        )
        updated_order = update_external_order_state(order, cancel_dto)
        self.assertEqual(updated_order.sync_status, ExternalOrder.SyncStatus.CANCELLED)
        self.assertEqual(updated_order.sale.status, Sale.Status.CANCELLED)

        # After cancel: reserved stock decremented to 0, available restored to 10
        self.product.refresh_from_db()
        self.assertEqual(self.product.reserved_stock, Decimal("0.00"))
        self.assertEqual(get_inventory_levels(self.product)["available"], Decimal("10.00"))

        reservation = InventoryReservation.all_objects.get(
            shop=self.shop,
            reference_id=str(order.sale.id),
        )
        self.assertEqual(reservation.status, InventoryReservation.Status.RELEASED)

    # =========================================================================
    # 3. DUPLICATE WEBHOOK DOES NOT DOUBLE RESERVE
    # =========================================================================
    def test_03_duplicate_webhook_does_not_double_reserve(self):
        """Duplicate webhook deliveries must be idempotent and not increase reserved stock."""
        payload = {
            "external_order_id": "ORDER-DUP-WEBHOOK",
            "items": [
                {
                    "sku": "EXT-GADGET-001",
                    "name": "Smart Gadget",
                    "quantity": "2.00",
                    "unit_price": "100.00",
                }
            ],
            "total": "200.00",
        }
        order_1, created_1 = process_external_order(
            shop=self.shop,
            integration=self.integration,
            order_payload=payload,
        )
        self.assertTrue(created_1)

        self.product.refresh_from_db()
        self.assertEqual(self.product.reserved_stock, Decimal("2.00"))

        # Second delivery of identical webhook
        order_2, created_2 = process_external_order(
            shop=self.shop,
            integration=self.integration,
            order_payload=payload,
        )
        self.assertFalse(created_2)
        self.assertEqual(order_1.id, order_2.id)

        # Reserved stock MUST remain 2, not 4
        self.product.refresh_from_db()
        self.assertEqual(self.product.reserved_stock, Decimal("2.00"))
        self.assertEqual(get_inventory_levels(self.product)["available"], Decimal("8.00"))
        self.assertEqual(InventoryReservation.all_objects.filter(shop=self.shop).count(), 1)

    # =========================================================================
    # 4. FAILED TRANSACTION RESTORES CONSISTENCY (ROLLBACK)
    # =========================================================================
    def test_04_failed_transaction_restores_consistency(self):
        """
        If order creation fails mid-transaction (e.g. second item fails or unexpected DB error),
        any reservations initiated within the atomic block must be completely rolled back.
        """
        p2 = Product.objects.create(
            shop=self.shop,
            category=self.category,
            unit=self.unit,
            name="Accessory",
            sku="ACC-001",
            cost_price=Decimal("10.00"),
            selling_price=Decimal("20.00"),
            track_inventory=True,
        )
        # p2 has stock = 1
        apply_movement(
            shop=self.shop,
            product=p2,
            movement_type=MovementType.OPENING,
            quantity=Decimal("1.00"),
        )
        ProductChannelMapping.objects.create(
            shop=self.shop,
            integration=self.integration,
            product=p2,
            external_sku="EXT-ACC-001",
        )

        # Order requests 2 of GADGET-001 (which has 10) AND 5 of ACC-001 (which only has 1)
        multi_payload = {
            "external_order_id": "ORDER-FAIL-ROLLBACK",
            "items": [
                {
                    "sku": "EXT-GADGET-001",
                    "name": "Smart Gadget",
                    "quantity": "2.00",
                    "unit_price": "100.00",
                },
                {
                    "sku": "EXT-ACC-001",
                    "name": "Accessory",
                    "quantity": "5.00",  # exceeds available 1.00!
                    "unit_price": "20.00",
                },
            ],
            "total": "300.00",
        }

        with self.assertRaises(InsufficientStockOrderError):
            process_external_order(
                shop=self.shop,
                integration=self.integration,
                order_payload=multi_payload,
                allow_on_hold=False,
            )

        # Verify full rollback: Gadget-001 reserved stock must be 0!
        self.product.refresh_from_db()
        p2.refresh_from_db()
        self.assertEqual(self.product.reserved_stock, Decimal("0.00"))
        self.assertEqual(p2.reserved_stock, Decimal("0.00"))
        self.assertEqual(InventoryReservation.all_objects.filter(shop=self.shop).count(), 0)
        self.assertEqual(Sale.all_objects.filter(shop=self.shop).count(), 0)

    # =========================================================================
    # 5. MULTIPLE PRODUCTS DETERMINISTIC LOCKING (DEADLOCK AVOIDANCE)
    # =========================================================================
    def test_05_multiple_products_concurrent_deadlock_free(self):
        """
        Two concurrent orders containing the same products in reverse order
        must not deadlock, because mapped_items are sorted deterministically before locking.
        """
        prod_b = Product.objects.create(
            shop=self.shop,
            category=self.category,
            unit=self.unit,
            name="Smart Watch",
            sku="WATCH-001",
            cost_price=Decimal("40.00"),
            selling_price=Decimal("80.00"),
            track_inventory=True,
        )
        apply_movement(
            shop=self.shop,
            product=prod_b,
            movement_type=MovementType.OPENING,
            quantity=Decimal("10.00"),
        )
        ProductChannelMapping.objects.create(
            shop=self.shop,
            integration=self.integration,
            product=prod_b,
            external_sku="EXT-WATCH-001",
        )

        order_forward = {
            "external_order_id": "ORDER-MULTI-FWD",
            "items": [
                {"sku": "EXT-GADGET-001", "name": "Smart Gadget", "quantity": "1.00", "unit_price": "100.00"},
                {"sku": "EXT-WATCH-001", "name": "Smart Watch", "quantity": "1.00", "unit_price": "80.00"},
            ],
            "total": "180.00",
        }
        order_reverse = {
            "external_order_id": "ORDER-MULTI-REV",
            "items": [
                {"sku": "EXT-WATCH-001", "name": "Smart Watch", "quantity": "1.00", "unit_price": "80.00"},
                {"sku": "EXT-GADGET-001", "name": "Smart Gadget", "quantity": "1.00", "unit_price": "100.00"},
            ],
            "total": "180.00",
        }

        results = []
        lock = threading.Lock()

        def worker(payload):
            connection.close()
            try:
                order, created = process_external_order(
                    shop=self.shop,
                    integration=self.integration,
                    order_payload=payload,
                )
                with lock:
                    results.append((payload["external_order_id"], True))
            except Exception as exc:
                with lock:
                    results.append((payload["external_order_id"], f"Error: {exc}"))
            finally:
                connection.close()

        t1 = threading.Thread(target=worker, args=(order_forward,))
        t2 = threading.Thread(target=worker, args=(order_reverse,))

        t1.start()
        t2.start()

        t1.join(timeout=10)
        t2.join(timeout=10)

        # Both must succeed without deadlocking
        self.assertEqual(len(results), 2)
        for order_id, status in results:
            self.assertTrue(status is True, f"Order {order_id} failed: {status}")

        self.product.refresh_from_db()
        prod_b.refresh_from_db()
        self.assertEqual(self.product.reserved_stock, Decimal("2.00"))
        self.assertEqual(prod_b.reserved_stock, Decimal("2.00"))

    # =========================================================================
    # 6. PARTIAL QUANTITIES AND PARTIAL CANCELLATION
    # =========================================================================
    def test_06_partial_cancellation_releases_partial_stock(self):
        """
        Partial cancellation reduces the reservation quantity and restores
        available stock for only the cancelled portion.
        """
        payload = {
            "external_order_id": "ORDER-PARTIAL-01",
            "items": [
                {
                    "sku": "EXT-GADGET-001",
                    "name": "Smart Gadget",
                    "quantity": "5.00",
                    "unit_price": "100.00",
                }
            ],
            "total": "500.00",
        }
        order, _ = process_external_order(
            shop=self.shop,
            integration=self.integration,
            order_payload=payload,
        )

        self.product.refresh_from_db()
        self.assertEqual(self.product.reserved_stock, Decimal("5.00"))
        self.assertEqual(get_inventory_levels(self.product)["available"], Decimal("5.00"))

        # Customer cancels 2 units out of 5
        updated_res = partially_cancel_order_reservation(
            shop=self.shop,
            sale_id=str(order.sale.id),
            product_id=self.product.id,
            quantity=Decimal("2.00"),
            reason="Customer changed mind on 2 items",
        )
        self.assertIsNotNone(updated_res)
        assert updated_res is not None
        self.assertEqual(updated_res.status, InventoryReservation.Status.ACTIVE)
        self.assertEqual(updated_res.quantity, Decimal("3.00"))

        # Reserved stock decreases from 5 to 3; Available increases from 5 to 7
        self.product.refresh_from_db()
        self.assertEqual(self.product.reserved_stock, Decimal("3.00"))
        self.assertEqual(get_inventory_levels(self.product)["available"], Decimal("7.00"))

        # Cancel remaining 3 units
        final_res = partially_cancel_order_reservation(
            shop=self.shop,
            sale_id=str(order.sale.id),
            product_id=self.product.id,
            quantity=Decimal("3.00"),
            reason="Customer cancelled rest",
        )
        self.assertIsNotNone(final_res)
        assert final_res is not None
        self.assertEqual(final_res.status, InventoryReservation.Status.RELEASED)
        self.assertEqual(final_res.quantity, Decimal("0.00"))

        self.product.refresh_from_db()
        self.assertEqual(self.product.reserved_stock, Decimal("0.00"))
        self.assertEqual(get_inventory_levels(self.product)["available"], Decimal("10.00"))

    # =========================================================================
    # 7. TENANT ISOLATION
    # =========================================================================
    def test_07_tenant_isolation(self):
        """Reservations in Shop A never affect or touch inventory in Shop B."""
        shop_b = Shop.objects.create(name="Shop B", slug="shop-b-store", is_active=True)
        integration_b = Integration.all_objects.create(
            shop=shop_b,
            name="Shop B Web",
            category=IntegrationCategory.ECOMMERCE,
            provider=IntegrationProvider.CUSTOM_WEBHOOK,
            status=IntegrationStatus.CONNECTED,
            is_active=True,
            config={"sync_inventory": True, "sync_orders": True},
        )
        unit_b, _ = Unit.all_objects.get_or_create(
            shop=shop_b,
            name="Pcs",
            defaults={"short_code": "pcs", "measure_type": "count", "allow_decimal": False},
        )
        prod_b = Product.objects.create(
            shop=shop_b,
            category=Category.objects.create(shop=shop_b, name="Cat B"),
            unit=unit_b,
            name="Smart Gadget",
            sku="GADGET-001",
            cost_price=Decimal("50.00"),
            selling_price=Decimal("100.00"),
            track_inventory=True,
        )
        apply_movement(
            shop=shop_b,
            product=prod_b,
            movement_type=MovementType.OPENING,
            quantity=Decimal("10.00"),
        )
        ProductChannelMapping.objects.create(
            shop=shop_b,
            integration=integration_b,
            product=prod_b,
            external_sku="EXT-GADGET-001",
        )

        # Shop A reserves 4 items
        payload_a = {
            "external_order_id": "SHOP-A-ORDER",
            "items": [{"sku": "EXT-GADGET-001", "name": "Smart Gadget", "quantity": "4.00", "unit_price": "100.00"}],
            "total": "400.00",
        }
        process_external_order(shop=self.shop, integration=self.integration, order_payload=payload_a)

        self.product.refresh_from_db()
        prod_b.refresh_from_db()

        # Shop A reserved = 4, available = 6
        self.assertEqual(self.product.reserved_stock, Decimal("4.00"))
        self.assertEqual(get_inventory_levels(self.product)["available"], Decimal("6.00"))

        # Shop B must be completely untouched: reserved = 0, available = 10
        self.assertEqual(prod_b.reserved_stock, Decimal("0.00"))
        self.assertEqual(get_inventory_levels(prod_b)["available"], Decimal("10.00"))

    # =========================================================================
    # 8. POS REMAINS FUNCTIONAL ALONGSIDE ACTIVE WEB RESERVATIONS
    # =========================================================================
    def test_08_pos_remains_functional_alongside_reservations(self):
        """
        In-store counter sales via POS (create_sale with is_quotation=False)
        function normally alongside active web reservations, correctly deducting physical stock.
        """
        # Product initial stock = 10
        # 1. Web order arrives and reserves 3 items
        web_payload = {
            "external_order_id": "WEB-ORDER-POS-COEXIST",
            "items": [{"sku": "EXT-GADGET-001", "name": "Smart Gadget", "quantity": "3.00", "unit_price": "100.00"}],
            "total": "300.00",
        }
        web_order, _ = process_external_order(shop=self.shop, integration=self.integration, order_payload=web_payload)

        self.product.refresh_from_db()
        self.assertEqual(self.product.current_stock, Decimal("10.00"))
        self.assertEqual(self.product.reserved_stock, Decimal("3.00"))
        self.assertEqual(get_inventory_levels(self.product)["available"], Decimal("7.00"))

        # 2. Walk-in customer buys 2 items at POS
        pos_items = [
            {
                "product": self.product,
                "variation": None,
                "quantity": Decimal("2.00"),
                "unit_price": Decimal("100.00"),
            }
        ]
        pos_sale = create_sale(
            shop=self.shop,
            items=pos_items,
            is_quotation=False,  # direct counter sale
            created_by=self.user,
        )
        self.assertIsNotNone(pos_sale)

        # Physical stock decreases by 2 (10 -> 8); reserved stock stays 3; available becomes 8 - 3 = 5
        self.product.refresh_from_db()
        self.assertEqual(self.product.current_stock, Decimal("8.00"))
        self.assertEqual(self.product.reserved_stock, Decimal("3.00"))
        self.assertEqual(get_inventory_levels(self.product)["available"], Decimal("5.00"))

        # 3. Web order is fulfilled and dispatched -> commit reservation
        commit_order_reservations(shop=self.shop, sale_id=str(web_order.sale.id))

        # Reservation committed: physical stock decreases by 3 (8 -> 5); reserved stock becomes 0; available is 5
        self.product.refresh_from_db()
        self.assertEqual(self.product.current_stock, Decimal("5.00"))
        self.assertEqual(self.product.reserved_stock, Decimal("0.00"))
        self.assertEqual(get_inventory_levels(self.product)["available"], Decimal("5.00"))

    # =========================================================================
    # 9. API ENDPOINTS FOR PARTIAL CANCELLATION AND RESERVATION RELEASE
    # =========================================================================
    def test_09_api_partial_cancel_and_reservation_release(self):
        """Tests REST endpoints for partial cancellation and manual reservation release."""
        self.client.force_authenticate(user=self.user)
        payload = {
            "external_order_id": "API-PARTIAL-ORDER",
            "items": [{"sku": "EXT-GADGET-001", "name": "Smart Gadget", "quantity": "4.00", "unit_price": "100.00"}],
            "total": "400.00",
        }
        order, _ = process_external_order(shop=self.shop, integration=self.integration, order_payload=payload)

        # Call partial cancel API: release 1 unit
        url = f"/api/integrations/orders/{order.id}/partial-cancel"
        response = self.client.post(
            url,
            {"product_id": self.product.id, "quantity": "1.00", "reason": "Customer changed mind"},
            format="json",
            secure=True,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["remaining_reserved_quantity"], "3.00")

        self.product.refresh_from_db()
        self.assertEqual(self.product.reserved_stock, Decimal("3.00"))
        self.assertEqual(get_inventory_levels(self.product)["available"], Decimal("7.00"))

        # Call reservation release API on the reservation endpoint directly
        res = InventoryReservation.all_objects.get(reference_id=str(order.sale.id))
        res_url = f"/api/integrations/reservations/{res.id}/release"
        res_response = self.client.post(
            res_url,
            {"quantity": "3.00", "reason": "Admin full manual release"},
            format="json",
            secure=True,
        )
        self.assertEqual(res_response.status_code, 200)
        self.assertEqual(res_response.data["status"], "released")

        self.product.refresh_from_db()
        self.assertEqual(self.product.reserved_stock, Decimal("0.00"))
        self.assertEqual(get_inventory_levels(self.product)["available"], Decimal("10.00"))
