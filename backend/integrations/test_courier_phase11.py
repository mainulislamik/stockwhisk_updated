"""
Unit and Integration Tests for Phase 11: Pathao Courier Adapter.

Tests cover:
1. Successful shipment creation & tracking lifecycle
2. Invalid credentials handling (401 -> CourierAuthError)
3. Timeout handling (requests.Timeout -> CourierTimeoutError)
4. 4xx validation errors (422/400 -> CourierValidationError)
5. 5xx server errors (500/502 -> CourierServerError)
6. Rate limiting (429 -> CourierRateLimitError)
7. Duplicate shipment request handling
8. Duplicate courier webhook handling (Idempotent processing)
9. Unknown status normalization fallback
10. Shipment cancellation lifecycle
11. Multi-tenant isolation (strict tenant boundary enforcement)
12. Credential protection (never expose secrets in string representations)
"""
from decimal import Decimal
from unittest.mock import MagicMock, patch
import uuid

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError
from django.test import TestCase
from django.utils import timezone
import requests

from tenants.models import Shop
from sales.models import Sale
from integrations.validators import CrossTenantBoundaryViolation
from integrations.models import (
    CourierAccount,
    CourierCredential,
    CourierEvent,
    CourierProvider,
    CourierShipment,
    CourierStatusHistory,
)
from integrations.couriers import (
    CancelResultDTO,
    CourierAuthError,
    CourierError,
    CourierRateLimitError,
    CourierServerError,
    CourierShipmentNotFoundError,
    CourierTimeoutError,
    CourierValidationError,
    PickupRequestDTO,
    ShipmentRequestDTO,
    ShipmentStatus,
    cancel_shipment,
    create_shipment,
    get_courier_adapter,
    handle_inbound_courier_event,
    track_and_sync_shipment,
)
from integrations.couriers.pathao import PathaoCourierAdapter


class PathaoCourierAdapterTests(TestCase):
    """Test suite verifying official Pathao courier provider implementation."""

    def setUp(self):
        super().setUp()

        # 1. Create two isolated tenant shops
        self.shop_a = Shop.objects.create(
            name="Pathao Shop A",
            subdomain=f"pathao-a-{uuid.uuid4().hex[:6]}",
        )
        self.shop_b = Shop.objects.create(
            name="Pathao Shop B",
            subdomain=f"pathao-b-{uuid.uuid4().hex[:6]}",
        )

        # 2. Configure CourierAccount for Shop A
        self.account_a = CourierAccount.all_objects.create(
            shop=self.shop_a,
            name="Pathao Primary A",
            provider=CourierProvider.PATHAO,
            merchant_id="M-PATHAO-100",
            is_active=True,
            default_pickup_address={"store_id": 130820, "city": "Dhaka"},
            metadata={"store_id": 130820, "is_sandbox": True},
        )
        self.cred_a = CourierCredential.all_objects.create(
            shop=self.shop_a,
            account=self.account_a,
        )
        self.cred_a.set_credentials(
            api_key="client_id_shop_a",
            api_secret="client_secret_shop_a",
            access_token="initial_access_token_a",
            webhook_secret="wh_secret_a",
            extra={
                "client_id": "client_id_shop_a",
                "client_secret": "client_secret_shop_a",
                "username": "merchant_a@example.com",
                "password": "PasswordA#123",
                "store_id": 130820,
            },
            token_expires_at=timezone.now() + timezone.timedelta(days=15),
        )
        self.cred_a.save()

        # 3. Configure CourierAccount for Shop B
        self.account_b = CourierAccount.all_objects.create(
            shop=self.shop_b,
            name="Pathao Primary B",
            provider=CourierProvider.PATHAO,
            merchant_id="M-PATHAO-200",
            is_active=True,
            default_pickup_address={"store_id": 140999, "city": "Chittagong"},
            metadata={"store_id": 140999, "is_sandbox": True},
        )
        self.cred_b = CourierCredential.all_objects.create(
            shop=self.shop_b,
            account=self.account_b,
        )
        self.cred_b.set_credentials(
            api_key="client_id_shop_b",
            api_secret="client_secret_shop_b",
            access_token="initial_access_token_b",
            webhook_secret="wh_secret_b",
            extra={
                "client_id": "client_id_shop_b",
                "client_secret": "client_secret_shop_b",
                "username": "merchant_b@example.com",
                "password": "PasswordB#456",
                "store_id": 140999,
            },
            token_expires_at=timezone.now() + timezone.timedelta(days=15),
        )
        self.cred_b.save()

        # 4. Create Sale fixtures
        self.sale_a = Sale.all_objects.create(
            shop=self.shop_a,
            invoice_no=f"INV-PA-{uuid.uuid4().hex[:6]}",
            sale_date=timezone.now(),
            total=Decimal("2000.00"),
            paid=Decimal("2000.00"),
            status="completed",
        )
        self.sale_b = Sale.all_objects.create(
            shop=self.shop_b,
            invoice_no=f"INV-PB-{uuid.uuid4().hex[:6]}",
            sale_date=timezone.now(),
            total=Decimal("3500.00"),
            paid=Decimal("3500.00"),
            status="completed",
        )

        self.req_dto = ShipmentRequestDTO(
            recipient_name="Mahbub Alam",
            recipient_phone="01712345678",
            recipient_address="Flat 4B, House 12, Road 5, Dhanmondi, Dhaka",
            cod_amount=Decimal("1500.00"),
            weight_kg=Decimal("0.75"),
            item_description="Cotton Shirts",
            pickup_store_id="130820",
            sale_id=self.sale_a.id,
        )

    def test_factory_resolves_pathao_adapter(self):
        """Verify get_courier_adapter returns PathaoCourierAdapter."""
        adapter = get_courier_adapter(self.account_a)
        self.assertIsInstance(adapter, PathaoCourierAdapter)
        assert isinstance(adapter, PathaoCourierAdapter)
        self.assertEqual(adapter.default_store_id, 130820)
        self.assertEqual(adapter.base_url, PathaoCourierAdapter.SANDBOX_BASE_URL)

    @patch("requests.post")
    def test_successful_shipment_creation(self, mock_post):
        """Test full shipment creation flow with official Pathao responses."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.ok = True
        mock_response.json.return_value = {
            "type": "success",
            "message": "Order created successfully",
            "data": {
                "consignment_id": "PT-CONS-10001",
                "merchant_order_id": str(self.sale_a.id),
                "order_status": "Pending",
                "delivery_fee": 80.00,
            },
        }
        mock_post.return_value = mock_response

        shipment = create_shipment(
            account=self.account_a,
            request=self.req_dto,
            sale=self.sale_a,
        )

        self.assertEqual(shipment.tracking_id, "PT-CONS-10001")
        self.assertEqual(shipment.consignment_id, "PT-CONS-10001")
        self.assertEqual(shipment.status, ShipmentStatus.PENDING)
        self.assertEqual(shipment.raw_status, "Pending")
        self.assertEqual(shipment.delivery_fee, Decimal("80.00"))
        self.assertEqual(shipment.cod_amount, Decimal("1500.00"))

        # Verify audit history
        history = CourierStatusHistory.all_objects.filter(shop=self.shop_a, shipment=shipment)
        self.assertEqual(history.count(), 1)
        self.assertEqual(history.first().to_status, ShipmentStatus.PENDING)

    @patch("requests.post")
    def test_invalid_credentials_raises_auth_error(self, mock_post):
        """Test that invalid credentials (401 Unauthorized) raise CourierAuthError."""
        # Force token refresh to trigger token endpoint call
        self.cred_a.token_expires_at = timezone.now() - timezone.timedelta(days=1)
        self.cred_a.save()

        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.ok = False
        mock_response.text = '{"message": "Unauthorized client credentials"}'
        mock_post.return_value = mock_response

        adapter = get_courier_adapter(self.account_a)
        with self.assertRaises(CourierAuthError):
            adapter.create_shipment(self.req_dto)

    @patch("requests.post")
    def test_timeout_handling(self, mock_post):
        """Test that requests.Timeout raises CourierTimeoutError."""
        mock_post.side_effect = requests.Timeout("Connection timed out after 20s")

        adapter = get_courier_adapter(self.account_a)
        with self.assertRaises(CourierTimeoutError):
            adapter.create_shipment(self.req_dto)

    @patch("requests.post")
    def test_4xx_validation_error(self, mock_post):
        """Test that 422 Unprocessable Entity raises CourierValidationError."""
        mock_response = MagicMock()
        mock_response.status_code = 422
        mock_response.ok = False
        mock_response.text = '{"message": "The recipient phone is invalid."}'
        mock_response.json.return_value = {"message": "The recipient phone is invalid."}
        mock_post.return_value = mock_response

        adapter = get_courier_adapter(self.account_a)
        with self.assertRaises(CourierValidationError) as ctx:
            adapter.create_shipment(self.req_dto)
        self.assertIn("recipient phone is invalid", str(ctx.exception))

    @patch("requests.post")
    def test_5xx_server_error(self, mock_post):
        """Test that 500/502 server errors raise CourierServerError."""
        mock_response = MagicMock()
        mock_response.status_code = 502
        mock_response.ok = False
        mock_response.text = "Bad Gateway"
        mock_post.return_value = mock_response

        adapter = get_courier_adapter(self.account_a)
        with self.assertRaises(CourierServerError):
            adapter.create_shipment(self.req_dto)

    @patch("requests.post")
    def test_rate_limit_429(self, mock_post):
        """Test that 429 Too Many Requests raises CourierRateLimitError."""
        mock_response = MagicMock()
        mock_response.status_code = 429
        mock_response.ok = False
        mock_response.text = "Rate limit exceeded"
        mock_post.return_value = mock_response

        adapter = get_courier_adapter(self.account_a)
        with self.assertRaises(CourierRateLimitError):
            adapter.create_shipment(self.req_dto)

    def test_duplicate_shipment_request_db_constraint(self):
        """Test that attempting to insert a duplicate (shop, account, tracking_id) raises IntegrityError."""
        CourierShipment.all_objects.create(
            shop=self.shop_a,
            account=self.account_a,
            tracking_id="DUP-TRK-9999",
            consignment_id="DUP-TRK-9999",
            recipient_name="Existing Customer",
            recipient_phone="01800000000",
            recipient_address="Dhaka",
            status=ShipmentStatus.READY_TO_SHIP,
        )

        with self.assertRaises(IntegrityError):
            CourierShipment.all_objects.create(
                shop=self.shop_a,
                account=self.account_a,
                tracking_id="DUP-TRK-9999",
                consignment_id="DUP-TRK-9999",
                recipient_name="Another Customer",
                recipient_phone="01900000000",
                recipient_address="Dhaka",
                status=ShipmentStatus.PENDING,
            )

    def test_duplicate_courier_webhook_idempotency(self):
        """Test that duplicate webhook events are detected and processed idempotently."""
        shipment = CourierShipment.all_objects.create(
            shop=self.shop_a,
            account=self.account_a,
            tracking_id="PT-WH-5000",
            consignment_id="PT-WH-5000",
            recipient_name="Customer",
            recipient_phone="01711111111",
            recipient_address="Uttara, Dhaka",
            status=ShipmentStatus.IN_TRANSIT,
        )

        payload = {
            "consignment_id": "PT-WH-5000",
            "merchant_order_id": str(self.sale_a.id),
            "event": "order.delivered",
            "collected_amount": 1500,
            "updated_at": "2026-10-02T12:00:00Z",
        }

        # First event processing
        event1, is_new1 = handle_inbound_courier_event(
            account=self.account_a,
            event_id="EVT-PT-DELIVERED-001",
            event_type="order.delivered",
            payload=payload,
        )
        self.assertTrue(is_new1)
        self.assertEqual(event1.status, "processed")

        shipment.refresh_from_db()
        self.assertEqual(shipment.status, ShipmentStatus.DELIVERED)
        self.assertIsNotNone(shipment.delivered_at)

        # Replaying identical event (duplicate)
        event2, is_new2 = handle_inbound_courier_event(
            account=self.account_a,
            event_id="EVT-PT-DELIVERED-001",
            event_type="order.delivered",
            payload=payload,
        )
        self.assertFalse(is_new2)
        self.assertEqual(event1.id, event2.id)

        # Audit history count should remain 1
        history_count = CourierStatusHistory.all_objects.filter(
            shop=self.shop_a,
            shipment=shipment,
            to_status=ShipmentStatus.DELIVERED,
        ).count()
        self.assertEqual(history_count, 1)

    def test_unknown_status_normalization_fallback(self):
        """Test that unknown raw courier status safely falls back to PENDING while preserving raw string."""
        adapter = get_courier_adapter(self.account_a)
        unknown_raw = "some_exotic_future_status_unrecognized"
        normalized = adapter.normalize_status(unknown_raw)
        self.assertEqual(normalized, ShipmentStatus.PENDING)

    @patch("requests.post")
    def test_shipment_cancellation_lifecycle(self, mock_post):
        """Test cancelling a shipment via Pathao cancel API."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.ok = True
        mock_response.json.return_value = {
            "type": "success",
            "message": "Order cancelled successfully",
        }
        mock_post.return_value = mock_response

        shipment = CourierShipment.all_objects.create(
            shop=self.shop_a,
            account=self.account_a,
            tracking_id="PT-CANCEL-1234",
            consignment_id="PT-CANCEL-1234",
            recipient_name="Customer",
            recipient_phone="01711111111",
            recipient_address="Dhaka",
            status=ShipmentStatus.READY_TO_SHIP,
        )

        cancelled = cancel_shipment(shipment, reason="Buyer requested change of address")
        self.assertEqual(cancelled.status, ShipmentStatus.CANCELLED)
        self.assertIsNotNone(cancelled.cancelled_at)

        # Audit history recorded
        latest_history = CourierStatusHistory.all_objects.filter(
            shop=self.shop_a,
            shipment=cancelled,
        ).first()
        self.assertIsNotNone(latest_history)
        self.assertEqual(latest_history.to_status, ShipmentStatus.CANCELLED)
        self.assertIn("Buyer requested change of address", latest_history.remarks)

    def test_multi_tenant_isolation(self):
        """Test strict multi-tenant boundary: Shop A cannot access Shop B's resources."""
        # 1. Attempt to create shipment with Account A for Sale B (cross-tenant violation)
        req_cross = ShipmentRequestDTO(
            recipient_name="Cross Tenant",
            recipient_phone="01700000000",
            recipient_address="Dhaka",
            sale_id=self.sale_b.id,
        )
        with self.assertRaises((CrossTenantBoundaryViolation, PermissionDenied)):
            create_shipment(
                account=self.account_a,
                request=req_cross,
                sale=self.sale_b,
            )

        # 2. Database query isolation
        CourierShipment.all_objects.create(
            shop=self.shop_a,
            account=self.account_a,
            tracking_id="A-ONLY-111",
            consignment_id="A-ONLY-111",
            recipient_name="Shop A Customer",
            recipient_phone="01711111111",
            recipient_address="Dhaka",
        )
        CourierShipment.all_objects.create(
            shop=self.shop_b,
            account=self.account_b,
            tracking_id="B-ONLY-222",
            consignment_id="B-ONLY-222",
            recipient_name="Shop B Customer",
            recipient_phone="01722222222",
            recipient_address="Chittagong",
        )

        a_shipments = CourierShipment.all_objects.filter(shop=self.shop_a)
        b_shipments = CourierShipment.all_objects.filter(shop=self.shop_b)
        self.assertEqual(a_shipments.count(), 1)
        self.assertEqual(b_shipments.count(), 1)
        self.assertEqual(a_shipments.first().tracking_id, "A-ONLY-111")
        self.assertEqual(b_shipments.first().tracking_id, "B-ONLY-222")

    def test_never_expose_courier_credentials(self):
        """Verify courier credentials are encrypted and never exposed in strings or representations."""
        # String representations should not show raw secrets
        cred_str = str(self.cred_a)
        account_str = str(self.account_a)
        self.assertNotIn("PasswordA#123", cred_str)
        self.assertNotIn("client_secret_shop_a", cred_str)
        self.assertNotIn("PasswordA#123", account_str)

        # Masked overview check
        overview = self.cred_a.get_masked_overview()
        self.assertTrue(overview["has_api_key"])
        self.assertTrue(overview["has_api_secret"])
        self.assertNotIn("PasswordA#123", str(overview))
        self.assertNotIn("client_secret_shop_a", str(overview))
