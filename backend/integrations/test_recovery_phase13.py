"""
Comprehensive Test Suite for Phase 13: External Integration Failure Recovery.

Verifies:
1. Successful retry on transient network/timeout failure
2. Retry exhaustion after max_retries reached (transitions to FAILED_PERMANENTLY)
3. Permanent failure on non-retryable errors (malformed payload, unmapped SKU, invalid credentials)
4. Manual retry capability for failed events (and REST API endpoint)
5. Duplicate retry prevention (guards against re-running already successful events)
6. Celery dispatch failure resilience & periodic recovery
7. API timeout categorization & exponential backoff
8. API 500 / server error categorization & retry scheduling
9. Rate limiting & Retry-After header awareness
10. Invalid credentials (401) immediate permanent failure
11. Retries cannot create duplicate orders or courier shipments
12. Multi-tenant isolation on recovery APIs and event queries
"""
from datetime import timedelta
from decimal import Decimal
import json
from typing import Any, Optional, Tuple
from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import RoleType, User
from catalog.models import Category, Product
from tenants.models import Shop
from .models import (
    CourierAccount,
    CourierCredential,
    CourierShipment,
    ExternalOrder,
    Integration,
    IntegrationEvent,
    IntegrationLog,
    InventoryReservation,
    ProductChannelMapping,
    WebhookEndpoint,
)
from .order_engine import StandardOrderDTO, StandardOrderItemDTO, process_external_order
from .couriers.base import BaseCourierAdapter, CourierAuthError, ShipmentRequestDTO, ShipmentResponseDTO
from .couriers.engine import create_shipment
from .connectors.base import ConnectorAuthError, ConnectorServerError, ConnectorTimeoutError
from .recovery import (
    IntegrationErrorCategory,
    classify_error,
    compute_backoff_delay,
    manual_retry_event,
    record_event_failure,
    retry_eligible_events,
    TRANSIENT_CATEGORIES,
    PERMANENT_CATEGORIES,
)
from .webhook_engine import EventDispatcher, execute_event_processing, ingest_webhook


class MockCourierAdapter(BaseCourierAdapter):
    """Deterministic mock courier adapter for testing shipment booking and retries."""
    def authenticate(self) -> bool:
        return True

    def validate_credentials(self) -> bool:
        return True

    def create_shipment(self, request: ShipmentRequestDTO) -> ShipmentResponseDTO:
        tracking_id = f"TRK-{request.sale_id or 'EXT'}-{request.recipient_phone[-4:]}"
        return ShipmentResponseDTO(
            tracking_id=tracking_id,
            consignment_id=f"CSG-{tracking_id}",
            status="pending",
            raw_status="order_created",
            delivery_fee=Decimal("60.00"),
            cod_charge=Decimal("10.00"),
            raw_response={"status": "success", "tracking": tracking_id},
        )

    def request_pickup(self, request):
        return None  # type: ignore

    def track_shipment(self, tracking_id: str):
        return None  # type: ignore

    def get_status(self, tracking_id: str) -> Tuple[str, str]:
        return ("pending", "order_created")

    def cancel_shipment(self, tracking_id: str, reason: str = ""):
        return None  # type: ignore

    def normalize_status(self, raw_status: str) -> str:
        return "pending"

    def verify_webhook_signature(self, headers, body) -> bool:
        return True

    def parse_webhook_event(self, headers, body):
        return None


@override_settings(SECURE_SSL_REDIRECT=False)
class IntegrationRecoveryPhase13TestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        # 1. Setup Tenant A
        cls.shop_a = Shop.objects.create(
            name="Alpha Recovery Corp",
            subdomain="alpha-recovery",
            business_type="super_shop",
            is_active=True,
            modules={"integrations": True},
        )
        cls.owner_a = User.objects.create_user(
            email="owner_a@alpha-recovery.test",
            phone="01710000001",
            password="StrongPassword123!",
            role=RoleType.OWNER,
            shop=cls.shop_a,
        )

        # 2. Setup Tenant B
        cls.shop_b = Shop.objects.create(
            name="Beta Recovery Corp",
            subdomain="beta-recovery",
            business_type="fashion_pos",
            is_active=True,
            modules={"integrations": True},
        )
        cls.owner_b = User.objects.create_user(
            email="owner_b@beta-recovery.test",
            phone="01710000002",
            password="StrongPassword123!",
            role=RoleType.OWNER,
            shop=cls.shop_b,
        )

        # 3. Setup Integrations
        cls.integration_a = Integration.all_objects.create(
            shop=cls.shop_a,
            name="Alpha WooCommerce Channel",
            provider="woocommerce",
            is_active=True,
            status="connected",
        )
        cls.endpoint_a = WebhookEndpoint.all_objects.create(
            shop=cls.shop_a,
            integration=cls.integration_a,
            name="Alpha Order Intake",
            secret_token="alpha_webhook_secret_key_123",
            is_active=True,
            retry_delay_seconds=30,
        )

        cls.integration_b = Integration.all_objects.create(
            shop=cls.shop_b,
            name="Beta Shopify Channel",
            provider="shopify",
            is_active=True,
            status="connected",
        )

        # 4. Setup Catalog and Mappings for Order Tests
        cls.category_a = Category.all_objects.create(
            shop=cls.shop_a,
            name="General Electronics",
        )
        cls.product_a = Product.all_objects.create(
            shop=cls.shop_a,
            name="Recovery Smart Watch",
            sku="RCV-SW-01",
            category=cls.category_a,
            selling_price=Decimal("2500.00"),
            current_stock=Decimal("50.00"),
            is_active=True,
        )
        cls.mapping_a = ProductChannelMapping.all_objects.create(
            shop=cls.shop_a,
            integration=cls.integration_a,
            product=cls.product_a,
            external_product_id="EXT-PROD-WATCH",
            external_sku="RCV-SW-01",
            sync_inventory=True,
            sync_status="active",
        )

        # 5. Setup Courier Account for Shipment Tests
        cls.courier_account_a = CourierAccount.all_objects.create(
            shop=cls.shop_a,
            provider="mock",
            name="Alpha Pathao Mock Account",
            is_active=True,
        )
        cls.courier_cred_a = CourierCredential.all_objects.create(
            shop=cls.shop_a,
            account=cls.courier_account_a,
        )
        cls.courier_cred_a.set_credentials(api_key="sec_mock_key")
        cls.courier_cred_a.save()

    def setUp(self):
        self.client_a = APIClient()
        self.client_a.force_authenticate(user=self.owner_a)

        self.client_b = APIClient()
        self.client_b.force_authenticate(user=self.owner_b)

        EventDispatcher.clear()

    # ==========================================================================
    # 1. Successful Retry
    # ==========================================================================
    def test_successful_retry(self):
        """
        Event fails initially with transient network error, transitions to RETRY
        with exponential backoff, then succeeds on retry.
        """
        event = IntegrationEvent.all_objects.create(
            shop=self.shop_a,
            integration=self.integration_a,
            endpoint=self.endpoint_a,
            external_event_id="evt_retry_success_01",
            event_type="order.updated",
            payload={"order_id": "1001", "status": "processing"},
            status=IntegrationEvent.Status.PROCESSING,
            attempt_count=0,
            max_retries=3,
        )

        # First attempt: Transient connection failure
        event.attempt_count += 1
        exc = ConnectionError("Connection refused by remote host")
        updated_event = record_event_failure(event, exc=exc, base_delay_seconds=60)

        self.assertEqual(updated_event.status, IntegrationEvent.Status.RETRY)
        self.assertEqual(updated_event.attempt_count, 1)
        self.assertEqual(updated_event.error_details["category"], IntegrationErrorCategory.NETWORK_ERROR.value)
        self.assertTrue(updated_event.error_details["is_transient"])
        self.assertIsNotNone(updated_event.next_retry_at)

        # Second attempt (retry succeeds)
        def mock_success_handler(ev):
            pass  # Successfully processed

        EventDispatcher.register("order.updated", mock_success_handler)
        success_event = execute_event_processing(event.id)

        self.assertEqual(success_event.status, IntegrationEvent.Status.SUCCESS)
        self.assertEqual(success_event.attempt_count, 2)
        self.assertEqual(success_event.error_message, "")
        self.assertIsNotNone(success_event.processed_at)

    # ==========================================================================
    # 2. Retry Exhaustion
    # ==========================================================================
    def test_retry_exhaustion(self):
        """
        Event repeatedly fails transiently until attempt_count reaches max_retries.
        Transitions permanently to FAILED_PERMANENTLY and schedules no further retries.
        """
        event = IntegrationEvent.all_objects.create(
            shop=self.shop_a,
            integration=self.integration_a,
            endpoint=self.endpoint_a,
            external_event_id="evt_retry_exhaust_01",
            event_type="order.sync",
            payload={"order_id": "1002"},
            status=IntegrationEvent.Status.PROCESSING,
            attempt_count=0,
            max_retries=3,
        )

        exc = TimeoutError("External gateway timeout (504)")

        # Attempt 1
        event.attempt_count += 1
        event = record_event_failure(event, exc=exc)
        self.assertEqual(event.status, IntegrationEvent.Status.RETRY)
        self.assertEqual(event.attempt_count, 1)

        # Attempt 2
        event.attempt_count += 1
        event = record_event_failure(event, exc=exc)
        self.assertEqual(event.status, IntegrationEvent.Status.RETRY)
        self.assertEqual(event.attempt_count, 2)

        # Attempt 3 (Max retries reached)
        event.attempt_count += 1
        event = record_event_failure(event, exc=exc)
        self.assertEqual(event.status, IntegrationEvent.Status.FAILED_PERMANENTLY)
        self.assertEqual(event.attempt_count, 3)
        self.assertIsNone(event.next_retry_at)

        # Verify audit logs recorded exhaustion
        log_entry = IntegrationLog.all_objects.filter(
            shop=self.shop_a,
            action="event_retry_exhausted",
        ).first()
        self.assertIsNotNone(log_entry)
        self.assertIn("reached retry exhaustion", log_entry.message)

    # ==========================================================================
    # 3. Permanent Failure
    # ==========================================================================
    def test_permanent_failure(self):
        """
        Permanent errors (unmapped product, malformed data, schema mismatch)
        fail fast to FAILED_PERMANENTLY without scheduling retries.
        """
        event = IntegrationEvent.all_objects.create(
            shop=self.shop_a,
            integration=self.integration_a,
            endpoint=self.endpoint_a,
            external_event_id="evt_perm_fail_01",
            event_type="catalog.product_mapped",
            payload={"sku": "UNKNOWN-SKU-999"},
            status=IntegrationEvent.Status.PROCESSING,
            attempt_count=0,
            max_retries=3,
        )

        event.attempt_count += 1
        exc = ValueError("Unmapped product SKU: UNKNOWN-SKU-999")
        failed_event = record_event_failure(event, exc=exc)

        self.assertEqual(failed_event.status, IntegrationEvent.Status.FAILED_PERMANENTLY)
        self.assertFalse(failed_event.error_details["is_transient"])
        self.assertIsNone(failed_event.next_retry_at)

        # Verify IntegrationLog recorded permanent failure
        log = IntegrationLog.all_objects.filter(
            shop=self.shop_a,
            action="event_failed_permanently",
        ).first()
        self.assertIsNotNone(log)

    # ==========================================================================
    # 4. Manual Retry Capability
    # ==========================================================================
    def test_manual_retry(self):
        """
        A permanently failed event can be manually re-triggered by merchant/admin
        via service function and REST API.
        """
        event = IntegrationEvent.all_objects.create(
            shop=self.shop_a,
            integration=self.integration_a,
            endpoint=self.endpoint_a,
            external_event_id="evt_manual_retry_01",
            event_type="order.fulfillment",
            payload={"shipment_id": "SH-101"},
            status=IntegrationEvent.Status.FAILED_PERMANENTLY,
            attempt_count=3,
            max_retries=3,
            error_message="Initial permanent failure",
        )

        def mock_success_handler(ev):
            pass

        EventDispatcher.register("order.fulfillment", mock_success_handler)

        # Test via service function
        updated_event, executed, msg = manual_retry_event(
            event_id=event.id,
            actor="owner_a@alpha-recovery.test",
        )
        self.assertTrue(executed)
        self.assertEqual(updated_event.status, IntegrationEvent.Status.SUCCESS)
        self.assertEqual(updated_event.error_message, "")

        # Verify audit log
        log = IntegrationLog.all_objects.filter(
            shop=self.shop_a,
            action="event_manual_retry_initiated",
        ).first()
        self.assertIsNotNone(log)

        # Test REST API endpoint
        # Create another failed event
        event_api = IntegrationEvent.all_objects.create(
            shop=self.shop_a,
            integration=self.integration_a,
            endpoint=self.endpoint_a,
            external_event_id="evt_manual_retry_api_01",
            event_type="order.fulfillment",
            payload={"shipment_id": "SH-102"},
            status=IntegrationEvent.Status.FAILED_PERMANENTLY,
            attempt_count=2,
            max_retries=3,
        )

        response = self.client_a.post(f"/api/integrations/events/{event_api.id}/retry/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["event"]["status"], IntegrationEvent.Status.SUCCESS)

    # ==========================================================================
    # 5. Duplicate Retry Prevention
    # ==========================================================================
    def test_duplicate_retry_prevention(self):
        """
        Events that have already succeeded cannot be retried accidentally,
        preventing duplicate external side-effects or business actions.
        """
        event = IntegrationEvent.all_objects.create(
            shop=self.shop_a,
            integration=self.integration_a,
            endpoint=self.endpoint_a,
            external_event_id="evt_dup_retry_01",
            event_type="order.fulfillment",
            payload={"shipment_id": "SH-201"},
            status=IntegrationEvent.Status.SUCCESS,
            attempt_count=1,
            max_retries=3,
            processed_at=timezone.now(),
        )

        # Service guard
        updated_event, executed, msg = manual_retry_event(event_id=event.id, force=False)
        self.assertFalse(executed)
        self.assertIn("already succeeded", msg)
        self.assertEqual(updated_event.status, IntegrationEvent.Status.SUCCESS)

        # REST API endpoint returns HTTP 400 Bad Request
        response = self.client_a.post(f"/api/integrations/events/{event.id}/retry/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["success"])

    # ==========================================================================
    # 6. Celery Failure Resilience
    # ==========================================================================
    def test_celery_dispatch_failure_resilience(self):
        """
        When Celery task dispatch fails (broker down / connection failure),
        the webhook intake still persists the event to DB as QUEUED,
        and recovery task safely processes it without data loss.
        """
        raw_body = json.dumps({"id": "evt_celery_fail_99", "type": "customer.created"}).encode()
        headers = {
            "x-webhook-secret": "alpha_webhook_secret_key_123",
            "x-event-id": "evt_celery_fail_99",
            "content-type": "application/json",
        }

        # Mock Celery delay to raise an unhandled broker exception
        with patch("integrations.tasks.process_integration_event.delay", side_effect=Exception("RabbitMQ Broker Down")):
            resp, status_code = ingest_webhook(self.endpoint_a, raw_body, headers)

        self.assertEqual(status_code, 202)
        self.assertEqual(resp["status"], "queued")
        event_id = resp["event_id"]

        event = IntegrationEvent.all_objects.get(id=event_id)
        self.assertEqual(event.status, IntegrationEvent.Status.QUEUED)
        self.assertIn("Celery queue dispatch delayed", event.error_message)

        # Periodic recovery runner picks up the stuck event and processes it
        def mock_customer_handler(ev):
            pass

        EventDispatcher.register("customer.created", mock_customer_handler)
        recovered_ids = retry_eligible_events(batch_size=10)
        self.assertIn(event.id, recovered_ids)

        event.refresh_from_db()
        self.assertEqual(event.status, IntegrationEvent.Status.SUCCESS)

    # ==========================================================================
    # 7. API Timeout Categorization and Exponential Backoff
    # ==========================================================================
    def test_api_timeout_categorization_and_backoff(self):
        """
        Timeouts are classified as TIMEOUT, marked transient, and calculate
        proper exponential backoff delays.
        """
        exc = ConnectorTimeoutError("Gateway timeout communicating with upstream store")
        cat, is_transient, retry_after = classify_error(exc=exc, status_code=504)

        self.assertEqual(cat, IntegrationErrorCategory.TIMEOUT)
        self.assertTrue(is_transient)

        # Verify exponential backoff calculation
        delay_1 = compute_backoff_delay(attempt_count=1, base_delay_seconds=60, jitter=False)
        delay_2 = compute_backoff_delay(attempt_count=2, base_delay_seconds=60, jitter=False)
        delay_3 = compute_backoff_delay(attempt_count=3, base_delay_seconds=60, jitter=False)

        self.assertEqual(delay_1, 60)
        self.assertEqual(delay_2, 120)
        self.assertEqual(delay_3, 240)

    # ==========================================================================
    # 8. API 500 / External Server Error
    # ==========================================================================
    def test_api_500_categorization_and_retry(self):
        """
        HTTP 500, 502, 503 are classified as EXTERNAL_SERVER_ERROR and marked transient.
        """
        exc = ConnectorServerError("Internal server error from Shopify API", status_code=500)
        cat, is_transient, retry_after = classify_error(exc=exc, status_code=500)

        self.assertEqual(cat, IntegrationErrorCategory.EXTERNAL_SERVER_ERROR)
        self.assertTrue(is_transient)

        event = IntegrationEvent.all_objects.create(
            shop=self.shop_a,
            integration=self.integration_a,
            endpoint=self.endpoint_a,
            external_event_id="evt_500_01",
            event_type="inventory.update",
            status=IntegrationEvent.Status.PROCESSING,
            attempt_count=0,
            max_retries=3,
        )
        event.attempt_count += 1
        updated = record_event_failure(event, exc=exc, status_code=500, base_delay_seconds=30)
        self.assertEqual(updated.status, IntegrationEvent.Status.RETRY)
        self.assertEqual(updated.error_details["category"], "EXTERNAL_SERVER_ERROR")

    # ==========================================================================
    # 9. Rate Limit & Retry-After
    # ==========================================================================
    def test_rate_limit_and_retry_after(self):
        """
        HTTP 429 is categorized as RATE_LIMITED and backoff strictly honors
        the provider's Retry-After header.
        """
        from .connectors.base import ConnectorRateLimitError

        exc = ConnectorRateLimitError("Rate limit exceeded on external API", retry_after=180)
        cat, is_transient, retry_after = classify_error(exc=exc, status_code=429)

        self.assertEqual(cat, IntegrationErrorCategory.RATE_LIMITED)
        self.assertTrue(is_transient)
        self.assertEqual(retry_after, 180)

        event = IntegrationEvent.all_objects.create(
            shop=self.shop_a,
            integration=self.integration_a,
            endpoint=self.endpoint_a,
            external_event_id="evt_rate_limit_01",
            event_type="price.sync",
            status=IntegrationEvent.Status.PROCESSING,
            attempt_count=0,
            max_retries=3,
        )
        event.attempt_count += 1
        now = timezone.now()
        updated = record_event_failure(event, exc=exc, status_code=429, retry_after=180)

        self.assertEqual(updated.status, IntegrationEvent.Status.RETRY)
        self.assertEqual(updated.error_details["category"], "RATE_LIMITED")
        self.assertIsNotNone(updated.next_retry_at)

        # Expected delay is ~180 seconds in the future
        diff_seconds = (updated.next_retry_at - now).total_seconds()
        self.assertTrue(175 <= diff_seconds <= 185)

    # ==========================================================================
    # 10. Invalid Credentials Permanent Failure
    # ==========================================================================
    def test_invalid_credentials_permanent_failure(self):
        """
        HTTP 401 / Invalid API Key is categorized as AUTHENTICATION_ERROR,
        marked non-transient, and fails immediately to FAILED_PERMANENTLY.
        """
        exc = ConnectorAuthError("Invalid API Secret Key provided")
        cat, is_transient, retry_after = classify_error(exc=exc, status_code=401)

        self.assertEqual(cat, IntegrationErrorCategory.AUTHENTICATION_ERROR)
        self.assertFalse(is_transient)

        event = IntegrationEvent.all_objects.create(
            shop=self.shop_a,
            integration=self.integration_a,
            endpoint=self.endpoint_a,
            external_event_id="evt_auth_fail_01",
            event_type="order.ingest",
            status=IntegrationEvent.Status.PROCESSING,
            attempt_count=0,
            max_retries=3,
        )
        event.attempt_count += 1
        updated = record_event_failure(event, exc=exc, status_code=401)

        self.assertEqual(updated.status, IntegrationEvent.Status.FAILED_PERMANENTLY)
        self.assertFalse(updated.error_details["is_transient"])
        self.assertIsNone(updated.next_retry_at)

    # ==========================================================================
    # 11. Retries Cannot Create Duplicate Orders or Shipments
    # ==========================================================================
    def test_retries_cannot_create_duplicate_orders_or_shipments(self):
        """
        Critical invariant: Re-running order ingestion or shipment creation
        MUST be completely idempotent and never create duplicate Sales or Consignments.
        """
        # --- A. Order Ingestion Retry Invariant ---
        order_dto = StandardOrderDTO(
            external_order_id="EXT-REC-ORDER-999",
            external_order_number="#999",
            external_status="processing",
            customer_name="Mr. Imon Customer",
            customer_phone="01719999999",
            customer_email="imon.customer@stockwhisk.test",
            shipping_address="Mirpur-10, Dhaka",
            billing_address="Mirpur-10, Dhaka",
            subtotal=Decimal("2500.00"),
            discount=Decimal("0.00"),
            tax=Decimal("0.00"),
            shipping_charge=Decimal("60.00"),
            total=Decimal("2560.00"),
            paid_amount=Decimal("0.00"),
            currency="BDT",
            items=[
                StandardOrderItemDTO(
                    sku="RCV-SW-01",
                    name="Recovery Smart Watch",
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("2500.00"),
                )
            ],
            raw_payload={"id": "EXT-REC-ORDER-999", "customer": "Imon"},
        )

        # Initial order processing
        ext_order, created_1 = process_external_order(
            shop=self.shop_a,
            integration=self.integration_a,
            order_payload=order_dto,
        )
        self.assertTrue(created_1)
        linked_sale_id = ext_order.sale.id

        # Retry order processing (e.g. repeated webhook or manual retry)
        ext_order_retry, created_2 = process_external_order(
            shop=self.shop_a,
            integration=self.integration_a,
            order_payload=order_dto,
        )
        self.assertFalse(created_2)
        self.assertEqual(ext_order_retry.id, ext_order.id)
        self.assertEqual(ext_order_retry.sale.id, linked_sale_id)

        # Assert database counts: exactly ONE ExternalOrder and ONE Sale
        self.assertEqual(
            ExternalOrder.all_objects.filter(shop=self.shop_a, external_order_id="EXT-REC-ORDER-999").count(),
            1,
        )
        from sales.models import Sale
        self.assertEqual(Sale.objects.filter(id=linked_sale_id).count(), 1)

        # --- B. Courier Shipment Booking Retry Invariant ---
        ship_req = ShipmentRequestDTO(
            recipient_name="Mr. Imon Customer",
            recipient_phone="01719999999",
            recipient_address="Mirpur-10, Dhaka",
            cod_amount=Decimal("2560.00"),
            item_description="Recovery Smart Watch",
            weight_kg=Decimal("0.5"),
            sale_id=linked_sale_id,
        )

        mock_adapter = MockCourierAdapter(self.courier_account_a)

        # Initial booking
        shipment_1 = create_shipment(
            account=self.courier_account_a,
            request=ship_req,
            sale=ext_order.sale,
            adapter=mock_adapter,
        )
        self.assertIsNotNone(shipment_1.tracking_id)

        # Retry booking for the same Sale
        shipment_2 = create_shipment(
            account=self.courier_account_a,
            request=ship_req,
            sale=ext_order.sale,
            adapter=mock_adapter,
        )

        # Must return the existing shipment and not duplicate DB rows
        self.assertEqual(shipment_1.id, shipment_2.id)
        self.assertEqual(shipment_1.tracking_id, shipment_2.tracking_id)
        self.assertEqual(
            CourierShipment.all_objects.filter(shop=self.shop_a, sale=ext_order.sale).count(),
            1,
        )

    # ==========================================================================
    # 12. Tenant Isolation
    # ==========================================================================
    def test_tenant_isolation_on_events_and_recovery(self):
        """
        Failed events and manual retry operations are strictly isolated by tenant.
        Tenant B cannot view or retry Tenant A's events.
        """
        event_a = IntegrationEvent.all_objects.create(
            shop=self.shop_a,
            integration=self.integration_a,
            endpoint=self.endpoint_a,
            external_event_id="evt_tenant_iso_01",
            event_type="order.ingest",
            status=IntegrationEvent.Status.FAILED_PERMANENTLY,
            attempt_count=3,
        )

        # Tenant B queries events via REST API -> should not see Tenant A's event
        resp_b_list = self.client_b.get("/api/integrations/events/failed/")
        self.assertEqual(resp_b_list.status_code, status.HTTP_200_OK)
        items = resp_b_list.data.get("results", resp_b_list.data) if isinstance(resp_b_list.data, dict) else resp_b_list.data
        ids = [e["id"] for e in items]
        self.assertNotIn(event_a.id, ids)

        # Tenant B attempts manual retry on Tenant A's event -> HTTP 404 Not Found
        resp_b_retry = self.client_b.post(f"/api/integrations/events/{event_a.id}/retry/")
        self.assertEqual(resp_b_retry.status_code, status.HTTP_404_NOT_FOUND)
