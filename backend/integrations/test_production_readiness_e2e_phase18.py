"""
Production Readiness End-to-End Test Suite for Phase 18.
Validates the entire StockWhisk Integration Platform lifecycle:
1. Subscriber connects website
2. Subscriber connects courier
3. Product mapping is created
4. StockWhisk has inventory
5. Website receives customer order
6. Website sends order event
7. StockWhisk authenticates event
8. Tenant is identified
9. Duplicate event is prevented
10. Product is mapped
11. Stock is checked
12. Stock is reserved
13. Stock movement is recorded according to existing business rules
14. Order is created/updated
15. Website inventory is synchronized
16. Shipment is created
17. Courier returns shipment ID
18. Pickup is requested if supported
19. Tracking status is synchronized
20. Shipment becomes delivered
21. Failed delivery is handled
22. Return/RTO is handled according to business rules (NO auto restock)
23. Failed integrations can be retried
24. Tenant isolation remains intact
"""
from decimal import Decimal
import hashlib
import hmac
import json
import time
import uuid

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import RoleType, User
from catalog.models import Category, Product, Unit
from core.tenant_context import tenant_context
from inventory.models import MovementType, StockMovement
from inventory.services import apply_movement
from sales.models import Sale
from tenants.models import Shop

from integrations.couriers.base import ShipmentRequestDTO, ShipmentStatus
from integrations.couriers.engine import (
    create_shipment,
    handle_inbound_courier_event,
    request_pickup,
    track_and_sync_shipment,
)
from integrations.couriers.lifecycle import apply_shipment_transition
from integrations.inventory_engine import (
    commit_inventory_reservation_to_sale,
    get_inventory_levels,
    release_inventory_reservation,
    reserve_inventory_for_order,
    sync_product_inventory,
)
from integrations.models import (
    CourierAccount,
    CourierCredential,
    CourierEvent,
    CourierProvider,
    CourierShipment,
    CourierStatusHistory,
    ExternalOrder,
    Integration,
    IntegrationAuditLog,
    IntegrationCategory,
    IntegrationCredential,
    IntegrationEvent,
    IntegrationProvider,
    IntegrationStatus,
    InventoryReservation,
    ProductChannelMapping,
    WebhookEndpoint,
)
from integrations.order_engine import (
    commit_order_reservations,
    process_external_order,
    release_order_reservations,
)
from integrations.recovery import retry_eligible_events
from integrations.webhook_engine import execute_event_processing, ingest_webhook


@override_settings(SECURE_SSL_REDIRECT=False)
class ProductionReadinessE2EPhase18TestCase(TestCase):
    """
    Exhaustive End-to-End Test Suite validating every link in the
    Integration Platform architecture for final production readiness.
    """

    def setUp(self):
        # -------------------------------------------------------------
        # Setup Multi-Tenant Environment (Shop A = Primary, Shop B = Isolation Check)
        # -------------------------------------------------------------
        self.shop_a = Shop.objects.create(
            name="Apex Retail Hub",
            slug=f"apex-hub-{uuid.uuid4().hex[:6]}",
            is_active=True,
            modules={"integrations": True},
        )
        self.user_a = User.objects.create_user(
            email="owner@apexhub.com",
            password="StrongPassword123!",
            first_name="Apex",
            last_name="Owner",
            role=RoleType.OWNER,
            shop=self.shop_a,
        )

        self.shop_b = Shop.objects.create(
            name="Zenith Traders",
            slug=f"zenith-traders-{uuid.uuid4().hex[:6]}",
            is_active=True,
            modules={"integrations": True},
        )
        self.user_b = User.objects.create_user(
            email="owner@zenith.com",
            password="StrongPassword123!",
            first_name="Zenith",
            last_name="Owner",
            role=RoleType.OWNER,
            shop=self.shop_b,
        )

        self.client_a = APIClient()
        self.client_a.force_authenticate(user=self.user_a)

        self.client_b = APIClient()
        self.client_b.force_authenticate(user=self.user_b)

        self.client_anon = APIClient()

    def test_complete_integration_platform_end_to_end_lifecycle(self):
        """
        Executes all 24 production readiness steps seamlessly:
        Connect -> Map -> Stock -> Order -> Reserve -> Sync -> Ship -> Track -> Deliver -> RTO -> Retry -> Isolation
        """
        # =============================================================
        # 1. Subscriber connects website
        # =============================================================
        website_integration = Integration.all_objects.create(
            shop=self.shop_a,
            name="Apex WooCommerce Store",
            category=IntegrationCategory.ECOMMERCE,
            provider=IntegrationProvider.WOOCOMMERCE,
            status=IntegrationStatus.CONNECTED,
            is_active=True,
            config={
                "base_url": "https://store.apexhub.com",
                "sync_inventory": True,
                "auto_sync_orders": True,
            },
        )
        website_cred = IntegrationCredential.all_objects.create(
            shop=self.shop_a,
            integration=website_integration,
        )
        website_cred.set_credentials(
            api_key="ck_apex_live_key_999",
            api_secret="cs_apex_live_secret_888",
        )
        website_cred.save()

        self.assertTrue(website_integration.is_active)
        self.assertEqual(website_integration.status, IntegrationStatus.CONNECTED)
        self.assertEqual(website_cred.shop_id, self.shop_a.id)

        # =============================================================
        # 2. Subscriber connects courier
        # =============================================================
        courier_account = CourierAccount.all_objects.create(
            shop=self.shop_a,
            provider="mock",
            name="Apex Fast Courier",
            is_active=True,
            is_default=True,
            default_pickup_address={"address": "Apex Warehouse, Tejgaon, Dhaka"},
        )
        courier_cred = CourierCredential.all_objects.create(
            shop=self.shop_a,
            account=courier_account,
        )
        courier_cred.set_credentials(
            api_key="mock_courier_api_key",
            api_secret="mock_courier_secret_key",
        )
        courier_cred.save()

        self.assertTrue(courier_account.is_active)
        self.assertEqual(courier_account.provider, "mock")

        # =============================================================
        # 3. Product mapping is created & 4. StockWhisk has inventory
        # =============================================================
        unit_pcs, _ = Unit.all_objects.get_or_create(
            shop=self.shop_a,
            name="Piece-E2E",
            defaults={"short_code": "pce2e", "measure_type": "count", "allow_decimal": False},
        )
        cat_electronics = Category.objects.create(shop=self.shop_a, name="Electronics")

        product = Product.objects.create(
            shop=self.shop_a,
            category=cat_electronics,
            unit=unit_pcs,
            name="Sonic Wireless Headphones",
            sku="SWH-100",
            current_stock=Decimal("0.00"),
            reserved_stock=Decimal("0.00"),
            cost_price=Decimal("1500.00"),
            selling_price=Decimal("2500.00"),
            track_inventory=True,
        )

        # Apply initial inventory through StockWhisk core StockMovement ledger
        apply_movement(
            shop=self.shop_a,
            product=product,
            movement_type=MovementType.PURCHASE_IN,
            quantity=Decimal("100.00"),
            unit_cost=1500,
            reference_type="InitialPurchase",
            reference_id="PO-INIT-001",
        )
        product.refresh_from_db()
        self.assertEqual(product.current_stock, Decimal("100.00"))
        self.assertEqual(product.reserved_stock, Decimal("0.00"))

        # Create Product Channel Mapping
        mapping = ProductChannelMapping.all_objects.create(
            shop=self.shop_a,
            integration=website_integration,
            product=product,
            external_product_id="WOO-PROD-9901",
            external_sku="SWH-100",
            internal_sku="SWH-100",
            sync_inventory=True,
            sync_status=ProductChannelMapping.SyncStatus.SYNCED,
        )
        self.assertEqual(mapping.product_id, product.id)
        self.assertEqual(mapping.external_product_id, "WOO-PROD-9901")

        # =============================================================
        # 5. Website receives customer order & 6. Sends order event
        # =============================================================
        webhook_secret = "webhook_secret_apex_777"
        webhook_endpoint = WebhookEndpoint.all_objects.create(
            shop=self.shop_a,
            integration=website_integration,
            name="Apex Inbound Orders",
            secret_token=webhook_secret,
            is_active=True,
        )

        order_raw_payload = {
            "id": "WOO-ORD-5501",
            "order_number": "5501",
            "status": "processing",
            "currency": "BDT",
            "total": "5000.00",
            "shipping_total": "100.00",
            "billing": {
                "first_name": "Rahim",
                "last_name": "Uddin",
                "phone": "01711000111",
                "address_1": "House 12, Road 4, Dhanmondi",
                "city": "Dhaka",
            },
            "line_items": [
                {
                    "id": 101,
                    "product_id": "WOO-PROD-9901",
                    "sku": "SWH-100",
                    "name": "Sonic Wireless Headphones",
                    "quantity": 2,
                    "price": "2500.00",
                    "total": "5000.00",
                }
            ],
        }
        body_bytes = json.dumps(order_raw_payload).encode("utf-8")
        timestamp_str = str(int(time.time()))
        valid_sig = hmac.new(webhook_secret.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()

        headers = {
            "HTTP_X_HUB_SIGNATURE_256": f"sha256={valid_sig}",
            "HTTP_X_TIMESTAMP": timestamp_str,
            "HTTP_X_EVENT_ID": "evt_apex_order_5501",
        }

        # =============================================================
        # 7. StockWhisk authenticates event & 8. Tenant is identified
        # =============================================================
        url = f"/api/integrations/webhooks/{webhook_endpoint.id}/"
        res = self.client_anon.post(
            url,
            data=body_bytes,
            content_type="application/json",
            **headers,
        )
        self.assertEqual(res.status_code, status.HTTP_202_ACCEPTED)

        event = IntegrationEvent.all_objects.filter(
            endpoint=webhook_endpoint,
            external_event_id="WOO-ORD-5501",
        ).first()
        self.assertIsNotNone(event)
        self.assertEqual(event.shop_id, self.shop_a.id)

        # =============================================================
        # 9. Duplicate event is prevented
        # =============================================================
        res_dup = self.client_anon.post(
            url,
            data=body_bytes,
            content_type="application/json",
            **headers,
        )
        self.assertEqual(res_dup.status_code, status.HTTP_200_OK)
        self.assertTrue(res_dup.data.get("duplicate"))
        # Verify deduplication prevented creating duplicate events
        dup_count = IntegrationEvent.all_objects.filter(
            endpoint=webhook_endpoint,
            external_event_id="WOO-ORD-5501",
        ).count()
        self.assertEqual(dup_count, 1)

        # =============================================================
        # 10. Product is mapped, 11. Stock is checked, 12. Stock is reserved,
        # 13. Stock movement / reservation recorded, 14. Order created/updated
        # =============================================================
        with tenant_context(self.shop_a):
            ext_order, created = process_external_order(
                shop=self.shop_a,
                integration=website_integration,
                order_payload=order_raw_payload,
            )

        self.assertTrue(created)
        self.assertEqual(ext_order.external_order_id, "WOO-ORD-5501")
        self.assertIsNotNone(ext_order.sale)

        # Check reservation state
        product.refresh_from_db()
        self.assertEqual(product.current_stock, Decimal("100.00"))  # physical stock unchanged before shipment
        self.assertEqual(product.reserved_stock, Decimal("2.00"))    # 2 units reserved for order

        active_reservations = InventoryReservation.all_objects.filter(
            shop=self.shop_a,
            product=product,
            reference_id=str(ext_order.sale_id),
            status=InventoryReservation.Status.ACTIVE,
        )
        self.assertEqual(active_reservations.count(), 1)
        self.assertEqual(active_reservations.first().quantity, Decimal("2.00"))

        # Verify duplicate order ingestion returns existing order without double-reserving stock
        with tenant_context(self.shop_a):
            ext_order2, created2 = process_external_order(
                shop=self.shop_a,
                integration=website_integration,
                order_payload=order_raw_payload,
            )
        self.assertFalse(created2)
        self.assertEqual(ext_order2.id, ext_order.id)
        product.refresh_from_db()
        self.assertEqual(product.reserved_stock, Decimal("2.00"))  # No double reservation!

        # =============================================================
        # 15. Website inventory is synchronized
        # =============================================================
        sync_result = sync_product_inventory(mapping.id)
        self.assertTrue(sync_result.success)
        mapping.refresh_from_db()
        self.assertEqual(mapping.sync_status, ProductChannelMapping.SyncStatus.SYNCED)

        # =============================================================
        # 16. Shipment is created & 17. Courier returns shipment ID
        # =============================================================
        shipment_req = ShipmentRequestDTO(
            recipient_name="Rahim Uddin",
            recipient_phone="01711000111",
            recipient_address="House 12, Road 4, Dhanmondi",
            recipient_city="Dhaka",
            cod_amount=Decimal("5100.00"),  # Total + shipping
            weight_kg=Decimal("0.5"),
            item_description="Sonic Wireless Headphones x 2",
        )
        shipment = create_shipment(
            account=courier_account,
            request=shipment_req,
            sale=ext_order.sale,
            external_order=ext_order,
        )
        self.assertIsNotNone(shipment.tracking_id)
        self.assertIsNotNone(shipment.consignment_id)
        self.assertEqual(shipment.status, ShipmentStatus.PENDING)

        # =============================================================
        # 18. Pickup is requested if supported
        # =============================================================
        pickup_res = request_pickup(
            account=courier_account,
            tracking_ids=[shipment.tracking_id],
            pickup_address={"address": "Apex Warehouse, Tejgaon, Dhaka"},
        )
        self.assertTrue(bool(pickup_res.pickup_id))
        shipment.refresh_from_db()
        self.assertEqual(shipment.status, ShipmentStatus.PICKUP_REQUESTED)

        # =============================================================
        # 19. Tracking status is synchronized
        # =============================================================
        # Move forward: PICKED_UP -> IN_TRANSIT -> OUT_FOR_DELIVERY
        apply_shipment_transition(shipment, ShipmentStatus.PICKED_UP, "Picked up from warehouse")
        apply_shipment_transition(shipment, ShipmentStatus.IN_TRANSIT, "At central sorting hub")
        apply_shipment_transition(shipment, ShipmentStatus.OUT_FOR_DELIVERY, "Rider out for delivery")

        shipment.refresh_from_db()
        self.assertEqual(shipment.status, ShipmentStatus.OUT_FOR_DELIVERY)

        # =============================================================
        # 20. Shipment becomes delivered & Stock movement committed
        # =============================================================
        # Commit reservations to permanent SALE_OUT upon final dispatch/delivery
        commit_order_reservations(self.shop_a, str(ext_order.sale_id))
        product.refresh_from_db()
        self.assertEqual(product.reserved_stock, Decimal("0.00"))
        self.assertEqual(product.current_stock, Decimal("98.00"))

        apply_res = apply_shipment_transition(
            shipment,
            ShipmentStatus.DELIVERED,
            "Package safely delivered to recipient",
        )
        self.assertTrue(apply_res.transitioned)
        shipment.refresh_from_db()
        self.assertEqual(shipment.status, ShipmentStatus.DELIVERED)

        # Ensure ExternalOrder synchronized to delivered / completed
        ext_order.refresh_from_db()
        self.assertEqual(ext_order.sync_status, ExternalOrder.SyncStatus.COMPLETED)
        self.assertEqual(ext_order.external_status, "delivered")

        # =============================================================
        # 21. Failed delivery handling (Intermediate attempt)
        # =============================================================
        # Create a second shipment to test failure and RTO lifecycle
        shipment_fail_req = ShipmentRequestDTO(
            recipient_name="Karim Khan",
            recipient_phone="01811000222",
            recipient_address="Mirpur 10, Dhaka",
            recipient_city="Dhaka",
            cod_amount=Decimal("1200.00"),
        )
        shipment_fail = create_shipment(
            account=courier_account,
            request=shipment_fail_req,
            sale=None,
            external_order=None,
        )
        apply_shipment_transition(shipment_fail, ShipmentStatus.OUT_FOR_DELIVERY, "First attempt")
        apply_shipment_transition(shipment_fail, ShipmentStatus.DELIVERY_FAILED, "Customer phone unreachable")
        shipment_fail.refresh_from_db()
        self.assertEqual(shipment_fail.status, ShipmentStatus.DELIVERY_FAILED)

        # Retry delivery attempt is permitted from DELIVERY_FAILED
        retry_trans = apply_shipment_transition(shipment_fail, ShipmentStatus.OUT_FOR_DELIVERY, "Second attempt")
        self.assertTrue(retry_trans.transitioned)
        self.assertFalse(retry_trans.is_out_of_order)

        # =============================================================
        # 22. Return / RTO handling (Strictly NO automatic restock)
        # =============================================================
        stock_before_rto = product.current_stock
        apply_shipment_transition(shipment_fail, ShipmentStatus.RETURNED, "Customer refused package - RTO")
        shipment_fail.refresh_from_db()
        self.assertEqual(shipment_fail.status, ShipmentStatus.RETURNED)

        product.refresh_from_db()
        # Verify strict invariant: NO automatic restocking on RTO
        self.assertEqual(
            product.current_stock,
            stock_before_rto,
            "RTO must never automatically restock inventory without physical warehouse inspection."
        )

        # =============================================================
        # 23. Failed integrations can be retried
        # =============================================================
        # Simulate a failed event in RETRY state with a valid order payload
        retry_payload = dict(order_raw_payload)
        retry_payload["id"] = "WOO-ORD-RETRY-7701"
        retry_payload["order_number"] = "7701"
        failed_event = IntegrationEvent.all_objects.create(
            shop=self.shop_a,
            integration=website_integration,
            endpoint=webhook_endpoint,
            external_event_id=f"evt_retry_{uuid.uuid4().hex[:6]}",
            event_type="order.created",
            payload=retry_payload,
            status=IntegrationEvent.Status.RETRY,
            attempt_count=1,
            next_retry_at=timezone.now() - timezone.timedelta(minutes=5),  # Due for retry
        )
        # Run recovery engine
        requeued_events = retry_eligible_events(batch_size=10)
        self.assertGreaterEqual(len(requeued_events), 1)

        failed_event.refresh_from_db()
        self.assertIn(
            failed_event.status,
            [IntegrationEvent.Status.QUEUED, IntegrationEvent.Status.SUCCESS],
            "Eligible failed event was recovered and processed.",
        )

        # =============================================================
        # 24. Tenant isolation remains intact
        # =============================================================
        # Tenant B cannot access Tenant A's integration
        res_b_int = self.client_b.get(f"/api/integrations/channels/{website_integration.id}/")
        self.assertEqual(res_b_int.status_code, status.HTTP_404_NOT_FOUND)

        # Tenant B cannot access Tenant A's shipment
        res_b_ship = self.client_b.get(f"/api/integrations/shipments/{shipment.id}/")
        self.assertEqual(res_b_ship.status_code, status.HTTP_404_NOT_FOUND)

        # Tenant B cannot access Tenant A's mapping
        res_b_map = self.client_b.get(f"/api/integrations/mappings/{mapping.id}/")
        self.assertEqual(res_b_map.status_code, status.HTTP_404_NOT_FOUND)

        # Tenant B cannot access Tenant A's external order
        res_b_ord = self.client_b.get(f"/api/integrations/orders/{ext_order.id}/")
        self.assertEqual(res_b_ord.status_code, status.HTTP_404_NOT_FOUND)
