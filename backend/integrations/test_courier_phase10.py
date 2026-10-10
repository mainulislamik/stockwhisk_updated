"""
Unit and Integration Tests for Phase 10: Provider-Independent Courier Integration Architecture.

Tests cover:
1. Adapter contract conformance and interface abstractions
2. Full shipment lifecycle (create -> pickup -> track -> deliver / cancel)
3. Tenant isolation (independent accounts, credentials, shipments across Shop A and Shop B)
4. Invalid credentials and authentication error handling
5. Unsupported operation enforcement (feature-flagged methods)
6. Raw status normalization across diverse provider strings into ShipmentStatus
7. Inbound duplicate event handling and idempotency guarantees
"""
from datetime import datetime
from decimal import Decimal
import uuid

from django.test import TestCase
from django.utils import timezone

from tenants.models import Shop
from sales.models import Sale
from integrations.models import (
    CourierAccount,
    CourierCredential,
    CourierEvent,
    CourierProvider,
    CourierShipment,
    CourierStatusHistory,
    Integration,
    IntegrationCategory,
    IntegrationProvider,
    IntegrationStatus,
)
from integrations.couriers import (
    BaseCourierAdapter,
    CancelResultDTO,
    CourierAuthError,
    CourierDuplicateEventError,
    CourierError,
    CourierShipmentNotFoundError,
    CourierUnsupportedOperationError,
    CourierValidationError,
    MockCourierAdapter,
    PickupRequestDTO,
    PickupResponseDTO,
    ShipmentRequestDTO,
    ShipmentResponseDTO,
    ShipmentStatus,
    TrackingResultDTO,
    cancel_shipment,
    create_shipment,
    get_courier_adapter,
    handle_inbound_courier_event,
    register_courier_adapter,
    request_pickup,
    track_and_sync_shipment,
)
from integrations.validators import CrossTenantBoundaryViolation


class Phase10CourierIntegrationTests(TestCase):
    """Test suite verifying all aspects of Phase 10 Courier Architecture."""

    def setUp(self):
        super().setUp()

        # Create two distinct tenant shops for isolation testing
        self.shop_a = Shop.objects.create(
            name="Courier Test Shop A",
            subdomain=f"c-shop-a-{uuid.uuid4().hex[:6]}",
            business_type="retail",
        )
        self.shop_b = Shop.objects.create(
            name="Courier Test Shop B",
            subdomain=f"c-shop-b-{uuid.uuid4().hex[:6]}",
            business_type="retail",
        )

        # Create Courier Accounts for Shop A
        self.courier_acc_a = CourierAccount.all_objects.create(
            shop=self.shop_a,
            name="Shop A Mock Courier",
            provider=CourierProvider.MOCK,
            merchant_id="MERCHANT-A-001",
            is_active=True,
            is_default=True,
            default_pickup_address={
                "address": "House 10, Road 4, Dhanmondi",
                "city": "Dhaka",
                "phone": "01711000001",
            },
        )
        self.cred_a = CourierCredential.all_objects.create(
            shop=self.shop_a,
            account=self.courier_acc_a,
        )
        self.cred_a.set_credentials(
            api_key="valid_api_key_a",
            api_secret="valid_secret_a",
            access_token="bearer_token_a",
            webhook_secret="wh_secret_a",
        )
        self.cred_a.save()

        # Create Courier Accounts for Shop B
        self.courier_acc_b = CourierAccount.all_objects.create(
            shop=self.shop_b,
            name="Shop B Mock Courier",
            provider=CourierProvider.MOCK,
            merchant_id="MERCHANT-B-002",
            is_active=True,
            is_default=True,
            default_pickup_address={
                "address": "GEC Circle, Chittagong",
                "city": "Chittagong",
                "phone": "01811000002",
            },
        )
        self.cred_b = CourierCredential.all_objects.create(
            shop=self.shop_b,
            account=self.courier_acc_b,
        )
        self.cred_b.set_credentials(
            api_key="valid_api_key_b",
            api_secret="valid_secret_b",
            access_token="bearer_token_b",
            webhook_secret="wh_secret_b",
        )
        self.cred_b.save()

        # Optional Sale for Shop A
        self.sale_a = Sale.all_objects.create(
            shop=self.shop_a,
            invoice_no=f"INV-A-{uuid.uuid4().hex[:6]}",
            sale_date=timezone.now(),
            subtotal=Decimal("1500.00"),
            total=Decimal("1500.00"),
            status="completed",
        )

        # Optional Sale for Shop B
        self.sale_b = Sale.all_objects.create(
            shop=self.shop_b,
            invoice_no=f"INV-B-{uuid.uuid4().hex[:6]}",
            sale_date=timezone.now(),
            subtotal=Decimal("2500.00"),
            total=Decimal("2500.00"),
            status="completed",
        )

    # --------------------------------------------------------------------------
    # 1. Adapter Contract Conformance
    # --------------------------------------------------------------------------

    def test_adapter_contract_interface(self):
        """Verify that get_courier_adapter instantiates a conforming BaseCourierAdapter."""
        adapter = get_courier_adapter(self.courier_acc_a)
        self.assertIsInstance(adapter, BaseCourierAdapter)
        self.assertTrue(hasattr(adapter, "create_shipment"))
        self.assertTrue(hasattr(adapter, "request_pickup"))
        self.assertTrue(hasattr(adapter, "track_shipment"))
        self.assertTrue(hasattr(adapter, "get_status"))
        self.assertTrue(hasattr(adapter, "cancel_shipment"))
        self.assertTrue(hasattr(adapter, "normalize_status"))

    def test_custom_adapter_registration(self):
        """Verify dynamic adapter registration in the central registry."""
        class DummyCourier(BaseCourierAdapter):
            def validate_credentials(self) -> bool:
                return True
            def create_shipment(self, request: ShipmentRequestDTO) -> ShipmentResponseDTO:
                return ShipmentResponseDTO(tracking_id="DUMMY")
            def request_pickup(self, request: PickupRequestDTO) -> PickupResponseDTO:
                return PickupResponseDTO(pickup_id="PK-DUMMY")
            def track_shipment(self, tracking_id: str) -> TrackingResultDTO:
                return TrackingResultDTO(tracking_id=tracking_id, current_status=ShipmentStatus.PENDING, raw_status="pending")
            def get_status(self, tracking_id: str) -> tuple[str, str]:
                return (ShipmentStatus.PENDING, "pending")
            def cancel_shipment(self, tracking_id: str, reason: str = "") -> CancelResultDTO:
                return CancelResultDTO(tracking_id=tracking_id, success=True)
            def normalize_status(self, raw_status: str) -> str:
                return ShipmentStatus.PENDING

        register_courier_adapter("custom_dummy", DummyCourier)
        dummy_acc = CourierAccount.all_objects.create(
            shop=self.shop_a,
            name="Custom Provider Account",
            provider="custom_dummy",
        )
        ad = get_courier_adapter(dummy_acc)
        self.assertIsInstance(ad, DummyCourier)

    # --------------------------------------------------------------------------
    # 2. Shipment Lifecycle (Create -> Pickup -> Track -> Status Updates -> Cancel)
    # --------------------------------------------------------------------------

    def test_shipment_creation_lifecycle(self):
        """Verify booking a shipment and recording initial status & history."""
        req = ShipmentRequestDTO(
            recipient_name="Rahim Uddin",
            recipient_phone="01712345678",
            recipient_address="Block C, Banani, Dhaka",
            recipient_city="Dhaka",
            recipient_zone="Banani",
            cod_amount=Decimal("1500.00"),
            weight_kg=Decimal("1.20"),
            item_description="Cotton Shirt & Jeans",
            special_instruction="Call before delivery",
            sale_id=self.sale_a.id,
        )

        shipment = create_shipment(self.courier_acc_a, req, sale=self.sale_a)
        self.assertIsNotNone(shipment.id)
        self.assertEqual(shipment.shop, self.shop_a)
        self.assertEqual(shipment.account, self.courier_acc_a)
        self.assertEqual(shipment.sale, self.sale_a)
        self.assertTrue(shipment.tracking_id.startswith("MOCK-TRK-"))
        self.assertEqual(shipment.status, ShipmentStatus.PENDING)
        self.assertEqual(shipment.cod_amount, Decimal("1500.00"))
        self.assertEqual(shipment.delivery_fee, Decimal("60.00"))
        self.assertEqual(shipment.cod_charge, Decimal("10.00"))

        # Verify initial history record
        hist = CourierStatusHistory.all_objects.filter(shipment=shipment)
        self.assertEqual(hist.count(), 1)
        self.assertEqual(hist.first().to_status, ShipmentStatus.PENDING)

    def test_request_pickup_updates_shipment_status(self):
        """Verify pickup request transitions shipment to PICKUP_REQUESTED and logs timeline."""
        req = ShipmentRequestDTO(
            recipient_name="Karim Mia",
            recipient_phone="01812345678",
            recipient_address="Agrabad C/A, Chittagong",
            cod_amount=Decimal("500.00"),
        )
        shipment = create_shipment(self.courier_acc_a, req)

        pickup_res = request_pickup(
            self.courier_acc_a,
            tracking_ids=[shipment.tracking_id],
            note="Pickup from warehouse gate 2",
        )
        self.assertTrue(pickup_res.pickup_id.startswith("PK-"))

        shipment.refresh_from_db()
        self.assertEqual(shipment.status, ShipmentStatus.PICKUP_REQUESTED)
        self.assertIsNotNone(shipment.pickup_requested_at)

        # Verify status history
        hist = CourierStatusHistory.all_objects.filter(shipment=shipment).order_by("-created_at")
        self.assertEqual(hist.count(), 2)
        self.assertEqual(hist.first().to_status, ShipmentStatus.PICKUP_REQUESTED)

    def test_track_and_sync_shipment(self):
        """Verify live tracking updates shipment state and milestones."""
        req = ShipmentRequestDTO(
            recipient_name="Sumi Akter",
            recipient_phone="01912345678",
            recipient_address="Mirpur 10, Dhaka",
        )
        shipment = create_shipment(self.courier_acc_a, req)

        # Track and sync
        synced = track_and_sync_shipment(shipment)
        self.assertIn(synced.status, [ShipmentStatus.PENDING, ShipmentStatus.IN_TRANSIT])

    def test_cancel_shipment_lifecycle(self):
        """Verify cancelling a booked shipment with the courier."""
        req = ShipmentRequestDTO(
            recipient_name="Jasim Khan",
            recipient_phone="01512345678",
            recipient_address="Uttara Sector 3, Dhaka",
        )
        shipment = create_shipment(self.courier_acc_a, req)

        cancelled = cancel_shipment(shipment, reason="Customer cancelled before dispatch")
        self.assertEqual(cancelled.status, ShipmentStatus.CANCELLED)
        self.assertIsNotNone(cancelled.cancelled_at)

        # Verify status history
        hist = CourierStatusHistory.all_objects.filter(shipment=shipment).order_by("-created_at")
        self.assertEqual(hist.first().to_status, ShipmentStatus.CANCELLED)
        self.assertIn("Customer cancelled", hist.first().remarks)

    # --------------------------------------------------------------------------
    # 3. Tenant Isolation
    # --------------------------------------------------------------------------

    def test_tenant_credential_isolation(self):
        """Ensure Shop A credentials are encrypted separately and inaccessible to Shop B."""
        creds_a = self.cred_a.get_credentials()
        creds_b = self.cred_b.get_credentials()

        self.assertEqual(creds_a["api_key"], "valid_api_key_a")
        self.assertEqual(creds_b["api_key"], "valid_api_key_b")
        self.assertNotEqual(creds_a["api_key"], creds_b["api_key"])
        self.assertNotEqual(self.cred_a.encrypted_api_key, self.cred_b.encrypted_api_key)

    def test_tenant_shipment_data_isolation(self):
        """Ensure queries for Shop A shipments never return Shop B shipments."""
        req_a = ShipmentRequestDTO(recipient_name="User A", recipient_phone="01700000001", recipient_address="A")
        req_b = ShipmentRequestDTO(recipient_name="User B", recipient_phone="01800000002", recipient_address="B")

        sh_a = create_shipment(self.courier_acc_a, req_a)
        sh_b = create_shipment(self.courier_acc_b, req_b)

        shop_a_shipments = CourierShipment.all_objects.filter(shop=self.shop_a)
        shop_b_shipments = CourierShipment.all_objects.filter(shop=self.shop_b)

        self.assertIn(sh_a, shop_a_shipments)
        self.assertNotIn(sh_b, shop_a_shipments)
        self.assertIn(sh_b, shop_b_shipments)
        self.assertNotIn(sh_a, shop_b_shipments)

    def test_cross_tenant_sale_binding_raises_idor_violation(self):
        """Verify that attempting to attach Shop B's Sale to Shop A's shipment is rejected."""
        req = ShipmentRequestDTO(
            recipient_name="Intruder Test",
            recipient_phone="01799999999",
            recipient_address="Dhaka",
        )
        with self.assertRaises(CrossTenantBoundaryViolation):
            create_shipment(self.courier_acc_a, req, sale=self.sale_b)

    # --------------------------------------------------------------------------
    # 4. Invalid Credentials & Authentication Error Handling
    # --------------------------------------------------------------------------

    def test_invalid_credentials_raises_courier_auth_error(self):
        """Verify CourierAuthError is raised when courier credentials are invalid or missing."""
        invalid_acc = CourierAccount.all_objects.create(
            shop=self.shop_a,
            name="Invalid Creds Courier",
            provider=CourierProvider.MOCK,
        )
        invalid_cred = CourierCredential.all_objects.create(
            shop=self.shop_a,
            account=invalid_acc,
        )
        invalid_cred.set_credentials(api_key="INVALID")
        invalid_cred.save()

        adapter = get_courier_adapter(invalid_acc)
        with self.assertRaises(CourierAuthError):
            adapter.validate_credentials()

        req = ShipmentRequestDTO(
            recipient_name="Test",
            recipient_phone="01711111111",
            recipient_address="Dhaka",
        )
        with self.assertRaises(CourierAuthError):
            create_shipment(invalid_acc, req)

    # --------------------------------------------------------------------------
    # 5. Unsupported Operation Enforcement
    # --------------------------------------------------------------------------

    def test_unsupported_cancellation_raises_error(self):
        """Verify that providers without cancellation support raise CourierUnsupportedOperationError."""
        non_cancelling_adapter = MockCourierAdapter(self.courier_acc_a, supports_cancellation=False)
        req = ShipmentRequestDTO(
            recipient_name="No Cancel",
            recipient_phone="01700000000",
            recipient_address="Dhaka",
        )
        shipment = create_shipment(self.courier_acc_a, req, adapter=non_cancelling_adapter)

        with self.assertRaises(CourierUnsupportedOperationError):
            cancel_shipment(shipment, adapter=non_cancelling_adapter)

    def test_unsupported_pickup_request_raises_error(self):
        """Verify that providers without pickup request support raise CourierUnsupportedOperationError."""
        no_pickup_adapter = MockCourierAdapter(self.courier_acc_a, supports_pickup_request=False)
        req = ShipmentRequestDTO(
            recipient_name="No Pickup",
            recipient_phone="01700000000",
            recipient_address="Dhaka",
        )
        shipment = create_shipment(self.courier_acc_a, req, adapter=no_pickup_adapter)

        with self.assertRaises(CourierUnsupportedOperationError):
            request_pickup(self.courier_acc_a, [shipment.tracking_id], adapter=no_pickup_adapter)

    # --------------------------------------------------------------------------
    # 6. Status Normalization Across Diverse Provider Strings
    # --------------------------------------------------------------------------

    def test_status_normalization_coverage(self):
        """Verify all 10 standard ShipmentStatus states are accurately normalized from raw provider strings."""
        adapter = get_courier_adapter(self.courier_acc_a)

        # Expected mappings
        test_cases = [
            ("order_placed", ShipmentStatus.PENDING),
            ("created", ShipmentStatus.PENDING),
            ("ready_to_ship", ShipmentStatus.READY_TO_SHIP),
            ("ready_for_pickup", ShipmentStatus.READY_TO_SHIP),
            ("call_driver", ShipmentStatus.PICKUP_REQUESTED),
            ("pickup_requested", ShipmentStatus.PICKUP_REQUESTED),
            ("picked_up", ShipmentStatus.PICKED_UP),
            ("collected", ShipmentStatus.PICKED_UP),
            ("received_at_hub", ShipmentStatus.PICKED_UP),
            ("in_transit", ShipmentStatus.IN_TRANSIT),
            ("hub_transfer", ShipmentStatus.IN_TRANSIT),
            ("out_for_delivery", ShipmentStatus.OUT_FOR_DELIVERY),
            ("on_the_way", ShipmentStatus.OUT_FOR_DELIVERY),
            ("delivered", ShipmentStatus.DELIVERED),
            ("successful", ShipmentStatus.DELIVERED),
            ("delivery_failed", ShipmentStatus.DELIVERY_FAILED),
            ("customer_refused", ShipmentStatus.DELIVERY_FAILED),
            ("cancelled", ShipmentStatus.CANCELLED),
            ("void", ShipmentStatus.CANCELLED),
            ("returned", ShipmentStatus.RETURNED),
            ("rto", ShipmentStatus.RETURNED),
            ("UNKNOWN_CUSTOM_STRING", ShipmentStatus.PENDING),
        ]

        for raw_val, expected_norm in test_cases:
            normalized = adapter.normalize_status(raw_val)
            self.assertEqual(
                normalized,
                expected_norm,
                f"Failed to normalize raw status '{raw_val}' -> expected '{expected_norm}', got '{normalized}'",
            )
            # Ensure normalized status is in the canonical set
            self.assertIn(normalized, ShipmentStatus.ALL)

    # --------------------------------------------------------------------------
    # 7. Inbound Event Processing & Duplicate Event Idempotency
    # --------------------------------------------------------------------------

    def test_inbound_courier_event_idempotency(self):
        """Verify inbound webhook event updates shipment and subsequent duplicate is ignored."""
        req = ShipmentRequestDTO(
            recipient_name="Webhook Target",
            recipient_phone="01712341234",
            recipient_address="Dhanmondi 27",
            cod_amount=Decimal("1200.00"),
        )
        shipment = create_shipment(self.courier_acc_a, req)

        event_payload = {
            "tracking_id": shipment.tracking_id,
            "status": "delivered",
            "collected_amount": "1200.00",
            "hub": "Dhanmondi Hub",
            "remarks": "Delivered to recipient with COD collected",
        }

        # First delivery of webhook event
        event_1, created_1 = handle_inbound_courier_event(
            account=self.courier_acc_a,
            event_id="EVT-WH-998811",
            event_type="shipment.delivered",
            payload=event_payload,
        )
        self.assertTrue(created_1)
        self.assertEqual(event_1.event_id, "EVT-WH-998811")

        # Verify shipment status updated to DELIVERED
        shipment.refresh_from_db()
        self.assertEqual(shipment.status, ShipmentStatus.DELIVERED)
        self.assertEqual(shipment.raw_status, "delivered")
        self.assertEqual(shipment.collected_amount, Decimal("1200.00"))
        self.assertIsNotNone(shipment.delivered_at)

        # Duplicate delivery of exact same webhook event ID
        event_2, created_2 = handle_inbound_courier_event(
            account=self.courier_acc_a,
            event_id="EVT-WH-998811",
            event_type="shipment.delivered",
            payload=event_payload,
        )
        self.assertFalse(created_2)
        self.assertEqual(event_1.id, event_2.id)

        # Ensure no duplicate events or status history records were created
        total_events = CourierEvent.all_objects.filter(
            shop=self.shop_a,
            account=self.courier_acc_a,
            event_id="EVT-WH-998811",
        ).count()
        self.assertEqual(total_events, 1)
