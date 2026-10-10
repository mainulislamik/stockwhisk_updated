"""
Tests for Phase 4: Generic Webhook and Event Processing Infrastructure.

Verifies:
1. Valid webhook (Received -> Authenticated -> Validated -> Queued -> Processing -> Success)
2. Invalid signature rejection (401)
3. Malformed JSON payload rejection (400)
4. Duplicate event deduplication & idempotency
5. Retry progression on recoverable failure (Processing -> Failed -> Retry -> Success)
6. Permanent failure when retry limit reached (Processing -> Failed -> Retry Limit Reached -> Failed Permanently)
7. Tenant isolation (cross-tenant endpoint / event access blocked)
8. Celery / background worker failure resilience
9. Database failure resilience
10. Concurrent duplicate delivery race condition handling
11. Scrubbing sensitive secrets from logs, headers, and payloads
"""
import hashlib
import hmac
import json
from unittest.mock import patch

from django.db import DatabaseError, IntegrityError
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import RoleType, User
from tenants.models import Shop
from .models import (
    Integration,
    IntegrationEvent,
    IntegrationLog,
    WebhookEndpoint,
)
from .services import create_integration
from .webhook_engine import EventDispatcher, execute_event_processing


@override_settings(SECURE_SSL_REDIRECT=False)
class WebhookProcessingInfrastructureTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.shop_a = Shop.objects.create(
            name="Alpha Corp",
            subdomain="alpha-test-wh",
            business_type="super_shop",
            is_active=True,
        )
        cls.shop_b = Shop.objects.create(
            name="Beta Corp",
            subdomain="beta-test-wh",
            business_type="fashion_shop",
            is_active=True,
        )

        cls.user_a = User.objects.create_user(
            email="owner_a_wh@example.com",
            first_name="Alpha",
            last_name="Owner",
            role=RoleType.OWNER,
            shop=cls.shop_a,
            password="SecurePassword123!",
        )
        cls.user_b = User.objects.create_user(
            email="owner_b_wh@example.com",
            first_name="Beta",
            last_name="Owner",
            role=RoleType.OWNER,
            shop=cls.shop_b,
            password="SecurePassword123!",
        )

        cls.integration_a = create_integration(
            shop=cls.shop_a,
            name="Alpha Store",
            category="ecommerce",
            provider="woocommerce",
            credentials={"api_key": "raw_key_1", "api_secret": "raw_sec_1"},
        )
        cls.integration_b = create_integration(
            shop=cls.shop_b,
            name="Beta Store",
            category="ecommerce",
            provider="shopify",
            credentials={"api_key": "raw_key_2", "api_secret": "raw_sec_2"},
        )

        cls.secret = "whsec_test_secret_key_12345"
        cls.endpoint_a = WebhookEndpoint.all_objects.create(
            shop=cls.shop_a,
            integration=cls.integration_a,
            name="Alpha Webhook",
            secret_token=cls.secret,
            max_retries=3,
            retry_delay_seconds=60,
        )

    def setUp(self):
        self.client = APIClient()
        EventDispatcher.clear()

    def _sign_payload(self, raw_bytes: bytes, secret: str = None) -> str:
        s = secret or self.secret
        return hmac.new(s.encode("utf-8"), raw_bytes, hashlib.sha256).hexdigest()

    def test_valid_webhook_full_lifecycle(self):
        """
        Verify complete progression:
        RECEIVED -> AUTHENTICATED -> VALIDATED -> QUEUED -> PROCESSING -> SUCCESS
        """
        payload = {
            "id": "evt_live_1001",
            "event": "order.updated",
            "order_number": "ORD-5544",
            "amount": 2500,
        }
        body = json.dumps(payload).encode("utf-8")
        signature = self._sign_payload(body)

        # Register mock handler
        handler_called = []
        def on_order_updated(event):
            handler_called.append(event.external_event_id)
        EventDispatcher.register("order.updated", on_order_updated)

        url = f"/api/integrations/webhooks/{self.endpoint_a.id}/"
        response = self.client.post(
            url,
            data=body,
            content_type="application/json",
            HTTP_X_HUB_SIGNATURE_256=signature,
            HTTP_X_EVENT_ID="evt_live_1001",
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data["status"], "queued")
        event_id = response.data["event_id"]

        event = IntegrationEvent.all_objects.get(id=event_id)
        self.assertEqual(event.status, IntegrationEvent.Status.QUEUED)
        self.assertIsNotNone(event.received_at)
        self.assertIsNotNone(event.authenticated_at)
        self.assertIsNotNone(event.validated_at)
        self.assertIsNotNone(event.queued_at)

        # Trigger processing (simulating Celery worker)
        processed_event = execute_event_processing(event_id)
        self.assertEqual(processed_event.status, IntegrationEvent.Status.SUCCESS)
        self.assertEqual(processed_event.attempt_count, 1)
        self.assertIsNotNone(processed_event.processed_at)
        self.assertEqual(handler_called, ["evt_live_1001"])

    def test_invalid_signature_rejected(self):
        """Incoming webhook with forged/invalid signature is rejected with 401."""
        body = json.dumps({"id": "evt_bad_sig", "event": "test"}).encode("utf-8")
        bad_sig = "invalid_hex_digest_signature"

        url = f"/api/integrations/webhooks/{self.endpoint_a.id}/"
        response = self.client.post(
            url,
            data=body,
            content_type="application/json",
            HTTP_X_HUB_SIGNATURE_256=bad_sig,
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("Invalid webhook signature", response.data["error"])
        # Ensure no event was stored
        self.assertFalse(IntegrationEvent.all_objects.filter(external_event_id="evt_bad_sig").exists())

    def test_malformed_payload_rejected(self):
        """Invalid JSON payload is rejected with 400 Bad Request."""
        body = b"{not-valid-json: missing quotes"
        sig = self._sign_payload(body)

        url = f"/api/integrations/webhooks/{self.endpoint_a.id}/"
        response = self.client.post(
            url,
            data=body,
            content_type="application/json",
            HTTP_X_HUB_SIGNATURE_256=sig,
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Malformed", response.data["error"])

    def test_duplicate_event_deduplication(self):
        """
        Duplicate delivery with same external_event_id returns HTTP 200 (deduplicated)
        and does NOT re-execute handler.
        """
        payload = {"id": "evt_duplicate_test", "event": "inventory.sync"}
        body = json.dumps(payload).encode("utf-8")
        sig = self._sign_payload(body)

        executions = []
        EventDispatcher.register("inventory.sync", lambda e: executions.append(e.id))

        url = f"/api/integrations/webhooks/{self.endpoint_a.id}/"

        # First request
        resp1 = self.client.post(url, data=body, content_type="application/json", HTTP_X_HUB_SIGNATURE_256=sig)
        self.assertEqual(resp1.status_code, status.HTTP_202_ACCEPTED)
        execute_event_processing(resp1.data["event_id"])
        self.assertEqual(len(executions), 1)

        # Second delivery of duplicate event
        resp2 = self.client.post(url, data=body, content_type="application/json", HTTP_X_HUB_SIGNATURE_256=sig)
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        self.assertEqual(resp2.data["status"], "deduplicated")
        self.assertTrue(resp2.data["duplicate"])
        # Handler must not have been executed a second time!
        self.assertEqual(len(executions), 1)

    def test_retry_progression_on_failure(self):
        """
        Recoverable failure transitions:
        PROCESSING -> FAILED -> RETRY -> SUCCESS
        """
        calls = 0
        def flaky_handler(event):
            nonlocal calls
            calls += 1
            if calls == 1:
                raise ConnectionError("Temporary upstream timeout")
            return True

        EventDispatcher.register("order.created", flaky_handler)

        event = IntegrationEvent.all_objects.create(
            shop=self.shop_a,
            integration=self.integration_a,
            endpoint=self.endpoint_a,
            external_event_id="evt_flaky_1",
            event_type="order.created",
            payload={"id": 12},
            status=IntegrationEvent.Status.QUEUED,
            max_retries=3,
        )

        # Attempt 1 -> fails and transitions to RETRY
        ev1 = execute_event_processing(event.id)
        self.assertEqual(ev1.status, IntegrationEvent.Status.RETRY)
        self.assertEqual(ev1.attempt_count, 1)
        self.assertIn("Temporary upstream timeout", ev1.error_message)
        self.assertIsNotNone(ev1.next_retry_at)

        # Attempt 2 -> succeeds
        ev2 = execute_event_processing(event.id)
        self.assertEqual(ev2.status, IntegrationEvent.Status.SUCCESS)
        self.assertEqual(ev2.attempt_count, 2)
        self.assertEqual(ev2.error_message, "")

    def test_permanent_failure_when_retry_limit_reached(self):
        """
        Unrecoverable failure transitions:
        PROCESSING -> FAILED -> RETRY_LIMIT_REACHED -> FAILED_PERMANENTLY
        """
        def broken_handler(event):
            raise ConnectionError("Temporary upstream timeout")

        EventDispatcher.register("unrecoverable.event", broken_handler)

        event = IntegrationEvent.all_objects.create(
            shop=self.shop_a,
            integration=self.integration_a,
            endpoint=self.endpoint_a,
            external_event_id="evt_unrecoverable",
            event_type="unrecoverable.event",
            payload={"data": "bad"},
            status=IntegrationEvent.Status.QUEUED,
            max_retries=2,
        )

        # Attempt 1 -> RETRY
        ev1 = execute_event_processing(event.id)
        self.assertEqual(ev1.status, IntegrationEvent.Status.RETRY)
        self.assertEqual(ev1.attempt_count, 1)

        # Attempt 2 -> Limit reached -> FAILED_PERMANENTLY
        ev2 = execute_event_processing(event.id)
        self.assertEqual(ev2.status, IntegrationEvent.Status.FAILED_PERMANENTLY)
        self.assertEqual(ev2.attempt_count, 2)
        self.assertIn("Temporary upstream timeout", ev2.error_message)

    def test_tenant_isolation(self):
        """Webhook endpoints and events are strictly isolated by tenant."""
        endpoint_b = WebhookEndpoint.all_objects.create(
            shop=self.shop_b,
            integration=self.integration_b,
            name="Beta Webhook",
            secret_token="beta_secret",
        )

        # User B cannot access Endpoint A via API
        self.client.force_authenticate(user=self.user_b)
        res = self.client.get(f"/api/integrations/endpoints/{self.endpoint_a.id}/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

        # User B cannot link Endpoint to Integration A
        res_post = self.client.post(
            "/api/integrations/endpoints/",
            data={
                "integration": self.integration_a.id,
                "name": "Cross-tenant Endpoint",
            },
        )
        self.assertIn(res_post.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN])

    def test_celery_failure_resilience(self):
        """If Celery / message broker fails, webhook intake does not crash with 500."""
        payload = {"id": "evt_celery_fail", "event": "stock.updated"}
        body = json.dumps(payload).encode("utf-8")
        sig = self._sign_payload(body)

        url = f"/api/integrations/webhooks/{self.endpoint_a.id}/"

        with patch("integrations.tasks.process_integration_event.delay", side_effect=RuntimeError("Redis down")):
            response = self.client.post(url, data=body, content_type="application/json", HTTP_X_HUB_SIGNATURE_256=sig)
            # Response still succeeds with 202 Accepted because event was safely saved to DB
            self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
            self.assertEqual(response.data["status"], "queued")
            # Event exists in DB and can be picked up by fallback scanner
            event = IntegrationEvent.all_objects.get(external_event_id="evt_celery_fail")
            self.assertEqual(event.status, IntegrationEvent.Status.QUEUED)

    def test_database_failure_handling(self):
        """Database error during webhook intake returns structured error without crashing."""
        payload = {"id": "evt_db_fail", "event": "stock.updated"}
        body = json.dumps(payload).encode("utf-8")
        sig = self._sign_payload(body)

        url = f"/api/integrations/webhooks/{self.endpoint_a.id}/"

        with patch("integrations.webhook_engine.IntegrationEvent.all_objects.create", side_effect=DatabaseError("DB connection lost")):
            response = self.client.post(url, data=body, content_type="application/json", HTTP_X_HUB_SIGNATURE_256=sig)
            self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
            self.assertIn("error", response.data)

    def test_concurrent_duplicate_delivery(self):
        """
        Concurrent duplicate deliveries triggering IntegrityError on unique constraint
        are handled gracefully as deduplicated events.
        """
        payload = {"id": "evt_race_condition", "event": "order.paid"}
        body = json.dumps(payload).encode("utf-8")
        sig = self._sign_payload(body)

        # Pre-create event to simulate the other concurrent thread having committed
        existing = IntegrationEvent.all_objects.create(
            shop=self.shop_a,
            integration=self.integration_a,
            endpoint=self.endpoint_a,
            external_event_id="evt_race_condition",
            event_type="order.paid",
            status=IntegrationEvent.Status.SUCCESS,
        )

        url = f"/api/integrations/webhooks/{self.endpoint_a.id}/"

        # Mock create to raise IntegrityError as happens during DB race
        with patch("integrations.models.IntegrationEvent.all_objects.create", side_effect=IntegrityError("duplicate key")):
            response = self.client.post(url, data=body, content_type="application/json", HTTP_X_HUB_SIGNATURE_256=sig)
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response.data["status"], "deduplicated")
            self.assertTrue(response.data["duplicate"])
            self.assertEqual(response.data["event_id"], existing.id)

    def test_sensitive_secrets_scrubbed(self):
        """Sensitive credentials in webhook headers and payloads are scrubbed from stored logs."""
        payload = {
            "id": "evt_secret_scrub",
            "event": "auth.refresh",
            "api_key": "secret_key_12345",
            "password": "super_secret_password",
            "access_token": "token_abc_xyz",
            "public_field": "visible_data",
        }
        body = json.dumps(payload).encode("utf-8")
        sig = self._sign_payload(body)

        url = f"/api/integrations/webhooks/{self.endpoint_a.id}/"
        response = self.client.post(
            url,
            data=body,
            content_type="application/json",
            HTTP_X_HUB_SIGNATURE_256=sig,
            HTTP_AUTHORIZATION="Bearer my_secret_token",
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

        event = IntegrationEvent.all_objects.get(external_event_id="evt_secret_scrub")
        # Check payload sanitization
        self.assertEqual(event.payload["api_key"], "[REDACTED]")
        self.assertEqual(event.payload["password"], "[REDACTED]")
        self.assertEqual(event.payload["access_token"], "[REDACTED]")
        self.assertEqual(event.payload["public_field"], "visible_data")

        # Check headers sanitization
        auth_header = event.headers.get("authorization") or event.headers.get("HTTP_AUTHORIZATION")
        if auth_header:
            self.assertEqual(auth_header, "[REDACTED]")
