"""
Test Suite for Phase 14: Subscriber-facing Integration Management Area.

Verifies:
1. Subscriber Access (Dashboard, Channels, Couriers, Mappings, Events, Shipments, Logs)
2. Staff Access Control (Cashier/Unauthorized staff gets 403 Forbidden)
3. Multi-Tenant Isolation (Tenant B cannot see or manipulate Tenant A's channels, couriers, events, shipments)
4. Connection Status & Validation Actions (Website validation, Courier credential validation, Disconnect)
5. Failed Event Visibility & Inspection
6. Retry Permission & Execution (Owner can retry; unauthorized blocked)
7. Credential Protection (Plaintext API secrets, passwords, client secrets, and encrypted fields are NEVER exposed)
"""
from decimal import Decimal
import json
from unittest.mock import patch, MagicMock

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import RoleType, User
from catalog.models import Category, Product, Unit
from tenants.models import Shop
from .models import (
    CourierAccount,
    CourierCredential,
    CourierProvider,
    CourierShipment,
    ExternalOrder,
    Integration,
    IntegrationCategory,
    IntegrationCredential,
    IntegrationEvent,
    IntegrationLog,
    IntegrationProvider,
    IntegrationStatus,
    ProductChannelMapping,
)


@override_settings(SECURE_SSL_REDIRECT=False)
class SubscriberIntegrationPhase14TestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        # 1. Tenant A (Alpha Subscriber)
        cls.shop_a = Shop.objects.create(
            name="Alpha Subscriber Shop",
            subdomain="alpha-subscriber",
            business_type="super_shop",
            is_active=True,
            modules={"integrations": True},
        )
        cls.owner_a = User.objects.create_user(
            email="owner_a@alphasub.test",
            phone="01720000001",
            password="StrongPassword123!",
            role=RoleType.OWNER,
            shop=cls.shop_a,
        )
        cls.staff_unauthorized_a = User.objects.create_user(
            email="cashier_a@alphasub.test",
            phone="01720000002",
            password="StrongPassword123!",
            role=RoleType.CASHIER,
            shop=cls.shop_a,
        )

        # 2. Tenant B (Beta Subscriber - Isolator)
        cls.shop_b = Shop.objects.create(
            name="Beta Competitor Shop",
            subdomain="beta-competitor",
            business_type="fashion_pos",
            is_active=True,
            modules={"integrations": True},
        )
        cls.owner_b = User.objects.create_user(
            email="owner_b@betasub.test",
            phone="01730000001",
            password="StrongPassword123!",
            role=RoleType.OWNER,
            shop=cls.shop_b,
        )

        # 3. Product in Shop A
        cls.category_a = Category.objects.create(shop=cls.shop_a, name="Apparel")
        cls.unit_a, _ = Unit.all_objects.get_or_create(
            shop=cls.shop_a,
            name="Pcs",
            defaults={"short_code": "pcs", "measure_type": "count", "allow_decimal": False},
        )
        cls.product_a = Product.objects.create(
            shop=cls.shop_a,
            name="Alpha Denim Jeans",
            sku="ALPH-JNS-01",
            selling_price=Decimal("1850.00"),
            cost_price=Decimal("1200.00"),
            category=cls.category_a,
            unit=cls.unit_a,
        )

        # 4. Website Channel in Shop A
        cls.website_a = Integration.all_objects.create(
            shop=cls.shop_a,
            name="Alpha WooCommerce Live",
            category=IntegrationCategory.ECOMMERCE,
            provider=IntegrationProvider.WOOCOMMERCE,
            status=IntegrationStatus.CONNECTED,
            base_url="https://alpha-woo.example.com",
            is_active=True,
        )
        cls.website_cred_a = IntegrationCredential.all_objects.create(
            shop=cls.shop_a,
            integration=cls.website_a,
        )
        cls.website_cred_a.set_credentials(
            api_key="ck_alpha_live_public_key",
            api_secret="cs_alpha_super_secret_password_never_expose",
            webhook_secret="whsec_alpha_private_signing_token",
        )
        cls.website_cred_a.save()

        # 5. Product Mapping in Shop A
        cls.mapping_a = ProductChannelMapping.all_objects.create(
            shop=cls.shop_a,
            integration=cls.website_a,
            product=cls.product_a,
            internal_sku="ALPH-JNS-01",
            external_product_id="WOO-PROD-9988",
            external_sku="ALPH-JNS-01",
            sync_status=ProductChannelMapping.SyncStatus.ACTIVE,
            is_sync_enabled=True,
            sync_inventory=True,
        )

        # 6. Courier Account in Shop A
        cls.courier_a = CourierAccount.all_objects.create(
            shop=cls.shop_a,
            name="Alpha Pathao Express",
            provider=CourierProvider.PATHAO,
            merchant_id="MERCH-ALPHA-01",
            is_active=True,
            is_default=True,
            default_pickup_address={"city": "Dhaka", "address": "Banani Road 11"},
        )
        cls.courier_cred_a = CourierCredential.all_objects.create(
            shop=cls.shop_a,
            account=cls.courier_a,
        )
        cls.courier_cred_a.set_credentials(
            extra={
                "client_id": "pathao_client_id_alpha",
                "client_secret": "pathao_secret_key_alpha_do_not_leak",
                "username": "alpha_merchant@pathao.test",
                "password": "UltraSecretCourierPassword123!",
                "store_id": "10293",
            }
        )
        cls.courier_cred_a.save()

        # 7. Courier Shipment in Shop A
        cls.shipment_a = CourierShipment.all_objects.create(
            shop=cls.shop_a,
            account=cls.courier_a,
            tracking_id="TRK-ALPHA-8899",
            consignment_id="CSG-ALPHA-8899",
            status="in_transit",
            cod_amount=Decimal("1850.00"),
            recipient_name="Tanvir Hossain",
            recipient_phone="01811223344",
            recipient_address="Mirpur 10, Dhaka",
            recipient_city="Dhaka",
        )

        # 8. Integration Events in Shop A (1 Failed, 1 Retry, 1 Success)
        cls.event_failed_a = IntegrationEvent.all_objects.create(
            shop=cls.shop_a,
            integration=cls.website_a,
            external_event_id="EVT-FAIL-01",
            event_type="order.created",
            status=IntegrationEvent.Status.FAILED_PERMANENTLY,
            error_message="Invalid consumer secret credentials",
            error_details={"category": "AUTHENTICATION_ERROR"},
            attempt_count=3,
            max_retries=3,
        )
        cls.event_retry_a = IntegrationEvent.all_objects.create(
            shop=cls.shop_a,
            integration=cls.website_a,
            external_event_id="EVT-RETRY-01",
            event_type="inventory.sync",
            status=IntegrationEvent.Status.RETRY,
            error_message="Gateway timeout during sync",
            error_details={"category": "TIMEOUT"},
            attempt_count=1,
            max_retries=3,
            next_retry_at=timezone.now() + timezone.timedelta(minutes=5),
        )
        cls.event_success_a = IntegrationEvent.all_objects.create(
            shop=cls.shop_a,
            integration=cls.website_a,
            external_event_id="EVT-SUCC-01",
            event_type="order.updated",
            status=IntegrationEvent.Status.SUCCESS,
            attempt_count=1,
        )

        # 9. Integration Log in Shop A
        cls.log_a = IntegrationLog.all_objects.create(
            shop=cls.shop_a,
            integration=cls.website_a,
            level=IntegrationLog.LogLevel.INFO,
            action="order_processed",
            message="Successfully processed incoming order WOO-ORD-101",
        )

    def setUp(self):
        self.client_a = APIClient()
        self.client_a.force_authenticate(user=self.owner_a)

        self.client_staff = APIClient()
        self.client_staff.force_authenticate(user=self.staff_unauthorized_a)

        self.client_b = APIClient()
        self.client_b.force_authenticate(user=self.owner_b)

    # =========================================================================
    # 1. SUBSCRIBER ACCESS TESTS
    # =========================================================================
    def test_subscriber_can_access_dashboard_summary(self):
        """Subscriber can fetch aggregated metrics from dashboard summary."""
        res = self.client_a.get("/api/integrations/dashboard/summary/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()

        # Check KPI structure
        self.assertIn("stats", data)
        self.assertEqual(data["stats"]["websites"]["total"], 1)
        self.assertEqual(data["stats"]["websites"]["connected"], 1)
        self.assertEqual(data["stats"]["couriers"]["total"], 1)
        self.assertEqual(data["stats"]["couriers"]["active"], 1)
        self.assertEqual(data["stats"]["mappings"]["total"], 1)
        self.assertEqual(data["stats"]["events"]["total"], 3)
        self.assertEqual(data["stats"]["shipments"]["total"], 1)

        # Check lists
        self.assertEqual(len(data["websites"]), 1)
        self.assertEqual(len(data["couriers"]), 1)
        self.assertGreaterEqual(len(data["failed_events"]), 2)  # FAILED_PERMANENTLY + RETRY
        self.assertEqual(len(data["recent_logs"]), 1)

    def test_subscriber_can_list_and_create_website_channel(self):
        """Subscriber can list existing channels and create a new one."""
        # List
        res_list = self.client_a.get("/api/integrations/channels/")
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_list.json()), 1)

        # Create
        res_create = self.client_a.post("/api/integrations/channels/", {
            "name": "Alpha Shopify Store",
            "provider": "shopify",
            "category": "ecommerce",
            "base_url": "https://alpha-shop.myshopify.com",
            "api_key": "shpat_live_sample_key",
            "api_secret": "shpss_sample_secret_key_123",
        })
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        created_data = res_create.json()
        self.assertEqual(created_data["name"], "Alpha Shopify Store")

        # Verify created channel is under Shop A
        new_ch = Integration.all_objects.get(id=created_data["id"])
        self.assertEqual(new_ch.shop, self.shop_a)

    def test_subscriber_can_list_and_create_courier_account(self):
        """Subscriber can list and add courier account."""
        # List
        res_list = self.client_a.get("/api/integrations/couriers/")
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_list.json()), 1)
        self.assertEqual(res_list.json()[0]["provider"], "pathao")

        # Create
        res_create = self.client_a.post("/api/integrations/couriers/", {
            "name": "Alpha SteadFast Account",
            "provider": "steadfast",
            "merchant_id": "STDF-9988",
            "api_key": "stdf_api_key_sample",
            "api_secret": "stdf_secret_sample",
        })
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        created_acc = res_create.json()
        self.assertEqual(created_acc["name"], "Alpha SteadFast Account")
        self.assertEqual(created_acc["provider"], "steadfast")

        # Verify database record
        db_acc = CourierAccount.all_objects.get(id=created_acc["id"])
        self.assertEqual(db_acc.shop, self.shop_a)
        self.assertTrue(db_acc.credential.has_credentials())

    # =========================================================================
    # 2. STAFF ACCESS CONTROL TESTS
    # =========================================================================
    def test_unauthorized_staff_cannot_access_integrations(self):
        """Cashier role without integration permissions receives 403 Forbidden."""
        endpoints = [
            "/api/integrations/dashboard/summary/",
            "/api/integrations/channels/",
            "/api/integrations/couriers/",
            "/api/integrations/mappings/",
            "/api/integrations/events/failed/",
            "/api/integrations/logs/",
            "/api/integrations/shipments/",
        ]
        for ep in endpoints:
            res = self.client_staff.get(ep)
            self.assertEqual(
                res.status_code,
                status.HTTP_403_FORBIDDEN,
                f"Expected 403 for unauthorized staff at {ep}, got {res.status_code}",
            )

    def test_unauthorized_staff_cannot_create_or_modify_integrations(self):
        """Staff without manage permissions cannot create channel or courier."""
        res_ch = self.client_staff.post("/api/integrations/channels/", {
            "name": "Hacked Channel",
            "provider": "woocommerce",
            "category": "ecommerce",
        })
        self.assertEqual(res_ch.status_code, status.HTTP_403_FORBIDDEN)

        res_cr = self.client_staff.post("/api/integrations/couriers/", {
            "name": "Hacked Courier",
            "provider": "pathao",
        })
        self.assertEqual(res_cr.status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # 3. TENANT ISOLATION TESTS
    # =========================================================================
    def test_tenant_b_dashboard_summary_is_isolated(self):
        """Tenant B's dashboard summary shows zero stats despite Tenant A's activity."""
        res = self.client_b.get("/api/integrations/dashboard/summary/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()

        self.assertEqual(data["stats"]["websites"]["total"], 0)
        self.assertEqual(data["stats"]["couriers"]["total"], 0)
        self.assertEqual(data["stats"]["mappings"]["total"], 0)
        self.assertEqual(data["stats"]["events"]["total"], 0)
        self.assertEqual(data["stats"]["shipments"]["total"], 0)
        self.assertEqual(len(data["websites"]), 0)
        self.assertEqual(len(data["couriers"]), 0)
        self.assertEqual(len(data["failed_events"]), 0)
        self.assertEqual(len(data["recent_logs"]), 0)

    def test_tenant_b_cannot_view_or_mutate_tenant_a_resources(self):
        """Tenant B cannot access or mutate Tenant A's channels, couriers, or shipments."""
        # 1. Channels
        res_ch_get = self.client_b.get(f"/api/integrations/channels/{self.website_a.id}/")
        self.assertEqual(res_ch_get.status_code, status.HTTP_404_NOT_FOUND)

        res_ch_del = self.client_b.delete(f"/api/integrations/channels/{self.website_a.id}/")
        self.assertEqual(res_ch_del.status_code, status.HTTP_404_NOT_FOUND)

        # 2. Couriers
        res_cr_get = self.client_b.get(f"/api/integrations/couriers/{self.courier_a.id}/")
        self.assertEqual(res_cr_get.status_code, status.HTTP_404_NOT_FOUND)

        res_cr_post = self.client_b.post(f"/api/integrations/couriers/{self.courier_a.id}/toggle-active/")
        self.assertEqual(res_cr_post.status_code, status.HTTP_404_NOT_FOUND)

        # 3. Shipments
        res_sh_get = self.client_b.get(f"/api/integrations/shipments/{self.shipment_a.id}/")
        self.assertEqual(res_sh_get.status_code, status.HTTP_404_NOT_FOUND)

        # 4. Events
        res_ev_get = self.client_b.get(f"/api/integrations/events/{self.event_failed_a.id}/")
        self.assertEqual(res_ev_get.status_code, status.HTTP_404_NOT_FOUND)

        res_ev_retry = self.client_b.post(f"/api/integrations/events/{self.event_failed_a.id}/retry/")
        self.assertEqual(res_ev_retry.status_code, status.HTTP_404_NOT_FOUND)

    # =========================================================================
    # 4. CONNECTION STATUS & VALIDATION ACTION TESTS
    # =========================================================================
    @patch("integrations.connectors.custom_webhook.CustomWebhookConnector.validate_credentials")
    def test_website_validate_connection_success(self, mock_val):
        """Validating website connection marks integration connected and returns success."""
        mock_val.return_value = True

        res = self.client_a.post(f"/api/integrations/channels/{self.website_a.id}/validate-connection/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertIn("Connection validated successfully", data["message"])

        # Integration status in DB
        self.website_a.refresh_from_db()
        self.assertEqual(self.website_a.status, IntegrationStatus.CONNECTED)

    @patch("integrations.connectors.custom_webhook.CustomWebhookConnector.validate_credentials")
    def test_website_validate_connection_failure(self, mock_val):
        """Failed website connection test updates status to ERROR and returns 400."""
        mock_val.return_value = False

        res = self.client_a.post(f"/api/integrations/channels/{self.website_a.id}/validate-connection/")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        data = res.json()
        self.assertFalse(data["success"])

        self.website_a.refresh_from_db()
        self.assertEqual(self.website_a.status, IntegrationStatus.ERROR)

    def test_website_disconnect_action(self):
        """Disconnecting a channel sets its status to DISCONNECTED."""
        res = self.client_a.post(f"/api/integrations/channels/{self.website_a.id}/disconnect/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.website_a.refresh_from_db()
        self.assertEqual(self.website_a.status, IntegrationStatus.DISCONNECTED)

    @patch("integrations.couriers.pathao.PathaoCourierAdapter.validate_credentials")
    def test_courier_validate_credentials_success(self, mock_val):
        """Courier validate_credentials endpoint invokes adapter and returns success."""
        mock_val.return_value = True

        res = self.client_a.post(f"/api/integrations/couriers/{self.courier_a.id}/validate-credentials/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertIn("Credentials validated successfully", data["message"])

    def test_courier_toggle_active_action(self):
        """Toggling courier active state changes is_active flag."""
        self.assertTrue(self.courier_a.is_active)

        # Toggle to False
        res1 = self.client_a.post(f"/api/integrations/couriers/{self.courier_a.id}/toggle-active/")
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.courier_a.refresh_from_db()
        self.assertFalse(self.courier_a.is_active)

        # Toggle back to True
        res2 = self.client_a.post(f"/api/integrations/couriers/{self.courier_a.id}/toggle-active/")
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.courier_a.refresh_from_db()
        self.assertTrue(self.courier_a.is_active)

    # =========================================================================
    # 5. FAILED EVENT VISIBILITY TESTS
    # =========================================================================
    def test_failed_events_visibility_and_inspection(self):
        """Failed and retry events are visible in /api/integrations/events/failed/."""
        res = self.client_a.get("/api/integrations/events/failed/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        events = data.get("results", data) if isinstance(data, dict) else data

        # Both event_failed_a and event_retry_a must appear
        event_ids = [e["id"] for e in events]
        self.assertIn(self.event_failed_a.id, event_ids)
        self.assertIn(self.event_retry_a.id, event_ids)
        self.assertNotIn(self.event_success_a.id, event_ids)

        # Inspect details of failed event
        failed_detail = next(e for e in events if e["id"] == self.event_failed_a.id)
        self.assertEqual(failed_detail["error_category"], "AUTHENTICATION_ERROR")
        self.assertEqual(failed_detail["attempt_count"], 3)
        self.assertEqual(failed_detail["status"], IntegrationEvent.Status.FAILED_PERMANENTLY)

    # =========================================================================
    # 6. RETRY PERMISSION & EXECUTION TESTS
    # =========================================================================
    @patch("integrations.webhook_engine.execute_event_processing")
    def test_subscriber_can_trigger_manual_retry(self, mock_exec):
        """Authorized subscriber can trigger manual retry for failed event."""
        res = self.client_a.post(f"/api/integrations/events/{self.event_failed_a.id}/retry/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["event_id"], self.event_failed_a.id)

        # Event status should be queued/retried
        self.event_failed_a.refresh_from_db()
        self.assertIn(self.event_failed_a.status, [IntegrationEvent.Status.QUEUED, IntegrationEvent.Status.RETRY, IntegrationEvent.Status.SUCCESS])

    def test_unauthorized_user_cannot_trigger_retry(self):
        """Staff without manage permissions cannot trigger retry."""
        res = self.client_staff.post(f"/api/integrations/events/{self.event_failed_a.id}/retry/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # 7. CREDENTIAL PROTECTION TESTS (CRITICAL SECURITY INVARIANT)
    # =========================================================================
    def test_channel_api_never_exposes_raw_secrets(self):
        """GET /api/integrations/channels/ must never return raw API secrets or tokens."""
        res = self.client_a.get(f"/api/integrations/channels/{self.website_a.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        raw_text = res.content.decode("utf-8")

        # Plaintext secrets set in setUpTestData:
        # "cs_alpha_super_secret_password_never_expose"
        # "whsec_alpha_private_signing_token"
        self.assertNotIn("cs_alpha_super_secret_password_never_expose", raw_text)
        self.assertNotIn("whsec_alpha_private_signing_token", raw_text)

        data = res.json()
        # Ensure only masked overview is returned
        if "credential" in data and data["credential"]:
            cred_overview = data["credential"].get("overview", {})
            self.assertNotIn("api_secret", cred_overview)
            self.assertNotIn("webhook_secret", cred_overview)

    def test_courier_api_never_exposes_raw_passwords_or_secrets(self):
        """GET /api/integrations/couriers/ must never return raw passwords, secrets or encrypted blobs."""
        res = self.client_a.get(f"/api/integrations/couriers/{self.courier_a.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        raw_text = res.content.decode("utf-8")

        # Plaintext secrets set in setUpTestData:
        # "pathao_secret_key_alpha_do_not_leak"
        # "UltraSecretCourierPassword123!"
        self.assertNotIn("pathao_secret_key_alpha_do_not_leak", raw_text)
        self.assertNotIn("UltraSecretCourierPassword123!", raw_text)
        self.assertNotIn("encrypted_credentials", raw_text)

        data = res.json()
        self.assertNotIn("password", data)
        self.assertNotIn("client_secret", data)
        self.assertNotIn("encrypted_credentials", data)
        self.assertTrue(data["has_credentials"])

    def test_shipment_api_does_not_leak_courier_secrets(self):
        """GET /api/integrations/shipments/ does not contain credentials."""
        res = self.client_a.get(f"/api/integrations/shipments/{self.shipment_a.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        raw_text = res.content.decode("utf-8")

        self.assertNotIn("pathao_secret_key_alpha_do_not_leak", raw_text)
        self.assertNotIn("UltraSecretCourierPassword123!", raw_text)
