"""
Comprehensive Test Suite for Phase 12:
Courier Shipment Lifecycle Integration with StockWhisk Internal Business Entities.

Covers:
1. Status update (forward progressive lifecycle)
2. Duplicate status idempotency
3. Out-of-order status handling & terminal state protection
4. Delivered status & COD payment reconciliation
5. Failed delivery handling & retry re-attempt
6. Cancelled shipment lifecycle
7. Returned (RTO) logistics event (Strictly NO automatic restocking)
8. Unknown status normalization and fallback audit
9. Duplicate webhook idempotency
10. Multi-tenant isolation
"""
from decimal import Decimal
import uuid

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError
from django.test import TestCase
from django.utils import timezone

from tenants.models import Shop
from sales.models import Sale
from inventory.models import StockMovement
from integrations.models import (
    CourierAccount,
    CourierCredential,
    CourierEvent,
    CourierShipment,
    CourierStatusHistory,
    ExternalOrder,
    Integration,
)
from integrations.couriers.base import ShipmentStatus
from integrations.couriers.lifecycle import (
    apply_shipment_transition,
    is_out_of_order_transition,
    STATE_PRECEDENCE,
    TERMINAL_STATES,
)
from integrations.couriers.engine import (
    handle_inbound_courier_event,
    track_and_sync_shipment,
)
from integrations.couriers.mock_adapter import MockCourierAdapter


class CourierLifecyclePhase12TestCase(TestCase):
    """Test suite for Phase 12 Courier Lifecycle transitions and business logic integration."""

    def setUp(self):
        # 1. Setup multi-tenant test shops
        self.shop_a = Shop.objects.create(
            name="Phase 12 Shop A",
            subdomain=f"p12-a-{uuid.uuid4().hex[:6]}",
        )
        self.shop_b = Shop.objects.create(
            name="Phase 12 Shop B",
            subdomain=f"p12-b-{uuid.uuid4().hex[:6]}",
        )

        # 2. Setup courier accounts
        self.account_a = CourierAccount.all_objects.create(
            shop=self.shop_a,
            provider="mock",
            name="Mock Account Shop A",
            is_active=True,
        )
        self.account_b = CourierAccount.all_objects.create(
            shop=self.shop_b,
            provider="mock",
            name="Mock Account Shop B",
            is_active=True,
        )

        # 3. Setup credentials
        self.cred_a = CourierCredential.all_objects.create(
            shop=self.shop_a,
            account=self.account_a,
        )
        self.cred_a.set_credentials(api_key="sec_a_key")
        self.cred_a.save()

        # 4. Setup Sales for Shop A and Shop B
        self.sale_a = Sale.all_objects.create(
            shop=self.shop_a,
            invoice_no=f"INV-P12-A-{uuid.uuid4().hex[:6]}",
            sale_date=timezone.now(),
            total=Decimal("2000.00"),
            paid=Decimal("0.00"),
            status=Sale.Status.DUE,
            custom_fields={},
        )
        self.sale_b = Sale.all_objects.create(
            shop=self.shop_b,
            invoice_no=f"INV-P12-B-{uuid.uuid4().hex[:6]}",
            sale_date=timezone.now(),
            total=Decimal("1200.00"),
            paid=Decimal("1200.00"),
            status=Sale.Status.PAID,
            custom_fields={},
        )

        # 5. Setup mock adapter
        self.adapter = MockCourierAdapter(self.account_a)

    def _create_shipment_a(self, tracking_id="TRK-P12-001", status=ShipmentStatus.PENDING, cod_amount=Decimal("2000.00")):
        return CourierShipment.all_objects.create(
            shop=self.shop_a,
            account=self.account_a,
            sale=self.sale_a,
            tracking_id=tracking_id,
            consignment_id=f"CSG-{tracking_id}",
            status=status,
            raw_status=status,
            cod_amount=cod_amount,
            recipient_name="Customer A",
            recipient_phone="01711111111",
            recipient_address="Dhaka, Bangladesh",
        )

    def test_status_update_progressive_lifecycle(self):
        """Verify normal forward lifecycle updates status, timestamps, and audit history."""
        shipment = self._create_shipment_a(tracking_id="TRK-PROG-01", status=ShipmentStatus.PENDING)

        steps = [
            (ShipmentStatus.READY_TO_SHIP, "Order packed"),
            (ShipmentStatus.PICKUP_REQUESTED, "Pickup scheduled"),
            (ShipmentStatus.PICKED_UP, "Courier picked up parcel"),
            (ShipmentStatus.IN_TRANSIT, "On way to hub"),
            (ShipmentStatus.OUT_FOR_DELIVERY, "Rider dispatched"),
            (ShipmentStatus.DELIVERED, "Delivered to recipient"),
        ]

        prev_status = ShipmentStatus.PENDING
        for status, remarks in steps:
            res = apply_shipment_transition(
                shipment=shipment,
                new_status=status,
                raw_status=status.lower(),
                remarks=remarks,
            )
            self.assertTrue(res.transitioned)
            self.assertFalse(res.is_duplicate)
            self.assertFalse(res.is_out_of_order)
            self.assertEqual(res.old_status, prev_status)
            self.assertEqual(res.new_status, status)
            shipment = res.shipment
            self.assertEqual(shipment.status, status)
            prev_status = status

        # Check timestamps
        shipment.refresh_from_db()
        self.assertIsNotNone(shipment.pickup_requested_at)
        self.assertIsNotNone(shipment.picked_up_at)
        self.assertIsNotNone(shipment.delivered_at)

        # Check audit history count
        history = CourierStatusHistory.all_objects.filter(shipment=shipment)
        self.assertEqual(history.count(), 6)

    def test_duplicate_status_idempotency(self):
        """Verify duplicate status updates do not create duplicate history or alter state."""
        shipment = self._create_shipment_a(tracking_id="TRK-DUP-01", status=ShipmentStatus.IN_TRANSIT)

        history_count_before = CourierStatusHistory.all_objects.filter(shipment=shipment).count()

        # Send same status again
        res = apply_shipment_transition(
            shipment=shipment,
            new_status=ShipmentStatus.IN_TRANSIT,
            raw_status="in_transit",
            remarks="Duplicate ping from courier polling",
        )

        self.assertFalse(res.transitioned)
        self.assertTrue(res.is_duplicate)
        self.assertFalse(res.is_out_of_order)

        # Ensure no redundant history entry created
        history_count_after = CourierStatusHistory.all_objects.filter(shipment=shipment).count()
        self.assertEqual(history_count_before, history_count_after)

    def test_out_of_order_status_terminal_protection(self):
        """Verify terminal state (DELIVERED) is protected against out-of-order prior events."""
        shipment = self._create_shipment_a(tracking_id="TRK-OOO-01", status=ShipmentStatus.DELIVERED)

        # Attempt out-of-order IN_TRANSIT event
        res = apply_shipment_transition(
            shipment=shipment,
            new_status=ShipmentStatus.IN_TRANSIT,
            raw_status="in_transit",
            remarks="Delayed webhook packet",
        )

        self.assertFalse(res.transitioned)
        self.assertTrue(res.is_out_of_order)
        self.assertFalse(res.is_duplicate)

        shipment.refresh_from_db()
        # Status must remain DELIVERED
        self.assertEqual(shipment.status, ShipmentStatus.DELIVERED)

        # Audit history must log out-of-order attempt notice
        last_history = CourierStatusHistory.all_objects.filter(shipment=shipment).order_by("-created_at").first()
        self.assertIsNotNone(last_history)
        self.assertIn("Out-of-order event", last_history.remarks)
        self.assertEqual(last_history.to_status, ShipmentStatus.DELIVERED)

    def test_delivered_status_and_cod_payment_reconciliation(self):
        """Verify DELIVERED updates Sale custom_fields and updates payment when COD collected."""
        shipment = self._create_shipment_a(
            tracking_id="TRK-DELIV-01",
            status=ShipmentStatus.OUT_FOR_DELIVERY,
            cod_amount=Decimal("2000.00"),
        )

        self.assertEqual(self.sale_a.status, Sale.Status.DUE)
        self.assertEqual(self.sale_a.paid, Decimal("0.00"))

        res = apply_shipment_transition(
            shipment=shipment,
            new_status=ShipmentStatus.DELIVERED,
            raw_status="delivered",
            collected_amount=Decimal("2000.00"),
            remarks="Delivered and full COD collected",
        )

        self.assertTrue(res.transitioned)
        shipment.refresh_from_db()
        self.assertEqual(shipment.status, ShipmentStatus.DELIVERED)
        self.assertEqual(shipment.collected_amount, Decimal("2000.00"))

        # Check Sale reconciliation
        self.sale_a.refresh_from_db()
        self.assertEqual(self.sale_a.status, Sale.Status.PAID)
        self.assertEqual(self.sale_a.paid, Decimal("2000.00"))
        self.assertEqual(self.sale_a.custom_fields.get("courier_delivery_status"), "delivered")
        self.assertIsNotNone(self.sale_a.custom_fields.get("delivered_at"))
        self.assertEqual(self.sale_a.custom_fields.get("courier_cod_collected"), "2000.00")

    def test_failed_delivery_handling_and_retry(self):
        """Verify DELIVERY_FAILED sets failure remarks without cancelling sale, and allows retry."""
        shipment = self._create_shipment_a(
            tracking_id="TRK-FAIL-01",
            status=ShipmentStatus.OUT_FOR_DELIVERY,
        )

        res = apply_shipment_transition(
            shipment=shipment,
            new_status=ShipmentStatus.DELIVERY_FAILED,
            raw_status="delivery_failed",
            remarks="Customer requested delivery tomorrow",
        )

        self.assertTrue(res.transitioned)
        shipment.refresh_from_db()
        self.assertEqual(shipment.status, ShipmentStatus.DELIVERY_FAILED)

        # Sale should NOT be cancelled
        self.sale_a.refresh_from_db()
        self.assertNotEqual(self.sale_a.status, Sale.Status.CANCELLED)
        self.assertEqual(self.sale_a.custom_fields.get("courier_delivery_status"), "delivery_failed")
        self.assertEqual(self.sale_a.custom_fields.get("delivery_failure_reason"), "Customer requested delivery tomorrow")

        # Retry attempt: moving from DELIVERY_FAILED back to OUT_FOR_DELIVERY is valid
        self.assertFalse(is_out_of_order_transition(ShipmentStatus.DELIVERY_FAILED, ShipmentStatus.OUT_FOR_DELIVERY))
        res_retry = apply_shipment_transition(
            shipment=shipment,
            new_status=ShipmentStatus.OUT_FOR_DELIVERY,
            raw_status="out_for_delivery",
            remarks="Courier re-attempting delivery next morning",
        )
        self.assertTrue(res_retry.transitioned)
        shipment.refresh_from_db()
        self.assertEqual(shipment.status, ShipmentStatus.OUT_FOR_DELIVERY)

    def test_cancelled_shipment_lifecycle(self):
        """Verify CANCELLED shipment marks cancelled_at and flags sale cancellation."""
        shipment = self._create_shipment_a(
            tracking_id="TRK-CANC-01",
            status=ShipmentStatus.READY_TO_SHIP,
        )

        res = apply_shipment_transition(
            shipment=shipment,
            new_status=ShipmentStatus.CANCELLED,
            raw_status="cancelled",
            remarks="Cancelled by merchant request",
        )

        self.assertTrue(res.transitioned)
        shipment.refresh_from_db()
        self.assertEqual(shipment.status, ShipmentStatus.CANCELLED)
        self.assertIsNotNone(shipment.cancelled_at)

        self.sale_a.refresh_from_db()
        self.assertEqual(self.sale_a.custom_fields.get("courier_delivery_status"), "cancelled")
        self.assertEqual(self.sale_a.custom_fields.get("courier_cancellation_reason"), "Cancelled by merchant request")

        # CANCELLED is terminal: out-of-order check blocks later events
        self.assertTrue(is_out_of_order_transition(ShipmentStatus.CANCELLED, ShipmentStatus.IN_TRANSIT))

    def test_returned_rto_strictly_no_automatic_restock(self):
        """
        CRITICAL TEST: Verify RTO is treated strictly as a logistics event.
        NEVER automatically restocks inventory without physical return inspection.
        """
        movement_count_before = StockMovement.all_objects.filter(shop=self.shop_a).count()

        shipment = self._create_shipment_a(
            tracking_id="TRK-RTO-01",
            status=ShipmentStatus.IN_TRANSIT,
        )

        res = apply_shipment_transition(
            shipment=shipment,
            new_status=ShipmentStatus.RETURNED,
            raw_status="returned",
            remarks="Parcel returned to merchant warehouse (RTO)",
        )

        self.assertTrue(res.transitioned)
        shipment.refresh_from_db()
        self.assertEqual(shipment.status, ShipmentStatus.RETURNED)
        self.assertIsNotNone(shipment.returned_at)

        # Verify sale custom fields indicate pending inspection
        self.sale_a.refresh_from_db()
        self.assertEqual(self.sale_a.custom_fields.get("courier_delivery_status"), "returned")
        self.assertEqual(self.sale_a.custom_fields.get("rto_status"), "received_pending_inspection")
        self.assertIsNotNone(self.sale_a.custom_fields.get("rto_received_at"))

        # Verify ZERO automatic inventory movements were created
        movement_count_after = StockMovement.all_objects.filter(shop=self.shop_a).count()
        self.assertEqual(movement_count_before, movement_count_after, "Automatic inventory restock occurred on RTO, violating logistics rules!")

    def test_unknown_status_normalization_and_audit(self):
        """Verify unrecognized courier status maps safely without crash while preserving raw status."""
        shipment = self._create_shipment_a(tracking_id="TRK-UNK-01", status=ShipmentStatus.PENDING)

        raw_unknown = "vendor_custom_unmapped_signal"
        normalized = self.adapter.normalize_status(raw_unknown)
        self.assertEqual(normalized, ShipmentStatus.PENDING)

        res = apply_shipment_transition(
            shipment=shipment,
            new_status=normalized,
            raw_status=raw_unknown,
            remarks="Courier sent unmapped status string",
        )

        shipment.refresh_from_db()
        self.assertEqual(shipment.raw_status, raw_unknown)

        history = CourierStatusHistory.all_objects.filter(shipment=shipment).first()
        self.assertEqual(history.raw_status, raw_unknown)

    def test_duplicate_webhook_event_idempotency(self):
        """Verify handle_inbound_courier_event deduplicates by event_id."""
        shipment = self._create_shipment_a(tracking_id="TRK-WH-01", status=ShipmentStatus.IN_TRANSIT)

        event_id = "WH-EVT-P12-1001"
        payload = {
            "tracking_id": "TRK-WH-01",
            "status": "delivered",
            "cod_amount": "2000.00",
            "hub": "Dhaka Sorting Hub",
            "remarks": "Delivered successfully",
        }

        # First webhook delivery
        event1, created1 = handle_inbound_courier_event(
            account=self.account_a,
            event_id=event_id,
            event_type="order.delivered",
            payload=payload,
            adapter=self.adapter,
        )
        self.assertTrue(created1)
        self.assertEqual(event1.event_id, event_id)

        shipment.refresh_from_db()
        self.assertEqual(shipment.status, ShipmentStatus.DELIVERED)

        history_count = CourierStatusHistory.all_objects.filter(shipment=shipment).count()

        # Second duplicate webhook delivery with identical event_id
        event2, created2 = handle_inbound_courier_event(
            account=self.account_a,
            event_id=event_id,
            event_type="order.delivered",
            payload=payload,
            adapter=self.adapter,
        )
        self.assertFalse(created2)
        self.assertEqual(event1.id, event2.id)

        # History count must not increase
        self.assertEqual(
            CourierStatusHistory.all_objects.filter(shipment=shipment).count(),
            history_count,
        )

    def test_multi_tenant_isolation(self):
        """Verify courier webhook and transitions enforce strict tenant boundaries."""
        shipment_b = CourierShipment.all_objects.create(
            shop=self.shop_b,
            account=self.account_b,
            sale=self.sale_b,
            tracking_id="TRK-SHOP-B-01",
            consignment_id="CSG-B-01",
            status=ShipmentStatus.PENDING,
            raw_status="pending",
            recipient_name="Customer B",
            recipient_phone="01822222222",
            recipient_address="Chittagong",
        )

        # Webhook for Account A attempting to update Shop B's tracking ID
        payload_cross = {
            "tracking_id": "TRK-SHOP-B-01",
            "status": "delivered",
        }

        event_cross, created_cross = handle_inbound_courier_event(
            account=self.account_a,
            event_id="WH-CROSS-001",
            event_type="order.delivered",
            payload=payload_cross,
            adapter=self.adapter,
        )

        # Event is stored for Account A, but shipment reference is NULL because Shop B's shipment is invisible
        self.assertIsNone(event_cross.shipment)

        # Shipment B in Shop B remains untouched (still PENDING)
        shipment_b.refresh_from_db()
        self.assertEqual(shipment_b.status, ShipmentStatus.PENDING)
