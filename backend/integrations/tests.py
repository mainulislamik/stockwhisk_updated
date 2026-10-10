"""
Tests for the StockWhisk Integrations Platform Foundation.

Covers:
1. Model creation, defaults, constraints, and lifecycle transitions.
2. Tenant ownership and fail-closed queryset isolation.
3. Cryptographic credential encryption at rest, decryption, and masking.
4. Duplicate integration prevention (unique constraints).
5. Service layer workflows (creation, credential updates, sync jobs, audit logging).
6. API endpoint authentication, tenant boundaries, and credential leak prevention.
"""
from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import RoleType
from audit.models import AuditLog
from core.tenant_context import tenant_context
from tenants.models import Shop
from .crypto import decrypt_secret, encrypt_secret, mask_credential
from .models import (
    Integration,
    IntegrationCategory,
    IntegrationCredential,
    IntegrationEvent,
    IntegrationLog,
    IntegrationProvider,
    IntegrationStatus,
    SyncJob,
)
from .services import (
    change_status,
    complete_sync_job,
    create_integration,
    create_sync_job,
    update_credentials,
    update_integration,
)

User = get_user_model()


class IntegrationsFoundationTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        # Create test shops
        cls.shop_a = Shop.objects.create(
            name="Shop Alpha",
            slug="shop-alpha",
            business_type="electronics",
        )
        cls.shop_b = Shop.objects.create(
            name="Shop Beta",
            slug="shop-beta",
            business_type="fashion",
        )

        # Create test users
        cls.user_a = User.objects.create_user(
            email="alice@alpha.com",
            password="TestPassword123!",
            first_name="Alice",
            last_name="Owner",
            shop=cls.shop_a,
            role=RoleType.OWNER,
        )
        cls.user_b = User.objects.create_user(
            email="bob@beta.com",
            password="TestPassword123!",
            first_name="Bob",
            last_name="Owner",
            shop=cls.shop_b,
            role=RoleType.OWNER,
        )

    def setUp(self):
        self.client_a = APIClient()
        self.client_a.force_authenticate(user=self.user_a)

        self.client_b = APIClient()
        self.client_b.force_authenticate(user=self.user_b)

    @property
    def api_a(self):
        from core.tenant_context import set_current_tenant
        set_current_tenant(self.shop_a)
        return self.client_a

    @property
    def api_b(self):
        from core.tenant_context import set_current_tenant
        set_current_tenant(self.shop_b)
        return self.client_b


class IntegrationModelAndConstraintTests(IntegrationsFoundationTestCase):
    def test_create_integration_defaults(self):
        """Verify default status is DRAFT and is_active is True."""
        integration = Integration.all_objects.create(
            shop=self.shop_a,
            name="Alpha WooCommerce",
            category=IntegrationCategory.ECOMMERCE,
            provider=IntegrationProvider.WOOCOMMERCE,
            base_url="https://alpha.example.com",
        )
        self.assertEqual(integration.status, IntegrationStatus.DRAFT)
        self.assertTrue(integration.is_active)
        self.assertIn("Alpha WooCommerce", str(integration))

    def test_lifecycle_transitions(self):
        """Verify lifecycle methods update status and timestamps correctly."""
        integration = Integration.all_objects.create(
            shop=self.shop_a,
            name="Alpha Pathao",
            category=IntegrationCategory.COURIER,
            provider=IntegrationProvider.PATHAO,
        )
        # Connect
        integration.mark_connected()
        self.assertEqual(integration.status, IntegrationStatus.CONNECTED)
        self.assertIsNotNone(integration.connected_at)
        self.assertEqual(integration.error_message, "")

        # Pause
        integration.pause()
        self.assertEqual(integration.status, IntegrationStatus.PAUSED)

        # Resume
        integration.resume()
        self.assertEqual(integration.status, IntegrationStatus.CONNECTED)

        # Mark Error
        integration.mark_error("Connection timeout")
        self.assertEqual(integration.status, IntegrationStatus.ERROR)
        self.assertIn("Connection timeout", integration.error_message)
        self.assertIsNotNone(integration.last_error_at)

        # Disconnect
        integration.disconnect()
        self.assertEqual(integration.status, IntegrationStatus.DISCONNECTED)

    def test_duplicate_integration_prevention(self):
        """Shop cannot have two integrations with identical (provider, name)."""
        Integration.all_objects.create(
            shop=self.shop_a,
            name="Main Store",
            category=IntegrationCategory.ECOMMERCE,
            provider=IntegrationProvider.WOOCOMMERCE,
        )
        with self.assertRaises(IntegrityError):
            Integration.all_objects.create(
                shop=self.shop_a,
                name="Main Store",
                category=IntegrationCategory.ECOMMERCE,
                provider=IntegrationProvider.WOOCOMMERCE,
            )

    def test_same_name_different_shop_allowed(self):
        """Different shops can have integrations with the same name and provider."""
        int_a = Integration.all_objects.create(
            shop=self.shop_a,
            name="Main Store",
            category=IntegrationCategory.ECOMMERCE,
            provider=IntegrationProvider.WOOCOMMERCE,
        )
        int_b = Integration.all_objects.create(
            shop=self.shop_b,
            name="Main Store",
            category=IntegrationCategory.ECOMMERCE,
            provider=IntegrationProvider.WOOCOMMERCE,
        )
        self.assertNotEqual(int_a.id, int_b.id)

    def test_event_idempotency_unique_constraint(self):
        """IntegrationEvent unique constraint prevents duplicate event IDs per integration."""
        integration = Integration.all_objects.create(
            shop=self.shop_a,
            name="Alpha Shopify",
            category=IntegrationCategory.ECOMMERCE,
            provider=IntegrationProvider.SHOPIFY,
        )
        IntegrationEvent.all_objects.create(
            shop=self.shop_a,
            integration=integration,
            external_event_id="evt_1001",
            event_type="orders.create",
            payload={"order_id": 1001},
        )
        with self.assertRaises(IntegrityError):
            IntegrationEvent.all_objects.create(
                shop=self.shop_a,
                integration=integration,
                external_event_id="evt_1001",
                event_type="orders.create",
                payload={"order_id": 1001},
            )


class CredentialSecurityAndCryptoTests(IntegrationsFoundationTestCase):
    def test_encryption_at_rest(self):
        """Secrets must be encrypted at rest and never stored in plaintext."""
        raw_secret = "cs_live_secret_very_confidential_9999"
        encrypted = encrypt_secret(raw_secret, self.shop_a.id)
        self.assertNotEqual(raw_secret, encrypted)
        self.assertTrue(len(encrypted) > 30)

        # Decrypt
        decrypted = decrypt_secret(encrypted, self.shop_a.id)
        self.assertEqual(raw_secret, decrypted)

    def test_cross_shop_key_isolation(self):
        """Credentials encrypted for Shop A cannot be decrypted with Shop B's key."""
        raw_secret = "secret_for_shop_a_only"
        encrypted_a = encrypt_secret(raw_secret, self.shop_a.id)

        # Attempting to decrypt with Shop B's salt must raise ValueError
        with self.assertRaises(ValueError):
            decrypt_secret(encrypted_a, self.shop_b.id)

    def test_credential_model_masking(self):
        """IntegrationCredential must mask values in get_masked_overview."""
        integration = Integration.all_objects.create(
            shop=self.shop_a,
            name="Steadfast Hub",
            category=IntegrationCategory.COURIER,
            provider=IntegrationProvider.STEADFAST,
        )
        cred = IntegrationCredential.all_objects.create(
            shop=self.shop_a,
            integration=integration,
        )
        cred.set_credentials(
            api_key="sf_live_key_abcdef1234",
            api_secret="sf_secret_super_hidden",
        )
        cred.save()

        overview = cred.get_masked_overview()
        self.assertTrue(overview["has_api_key"])
        self.assertTrue(overview["has_api_secret"])
        # API key shows only mask + last 4 chars
        self.assertEqual(overview["api_key_masked"], "••••••••1234")
        # API secret is NEVER revealed in overview
        self.assertNotIn("sf_secret_super_hidden", str(overview))
        self.assertTrue(overview["is_configured"])


class TenantIsolationTests(IntegrationsFoundationTestCase):
    def test_fail_closed_without_tenant(self):
        """Without active tenant context, Integration.objects.all() returns none()."""
        Integration.all_objects.create(
            shop=self.shop_a,
            name="Alpha Channel",
            category=IntegrationCategory.ECOMMERCE,
            provider=IntegrationProvider.WOOCOMMERCE,
        )
        # Default objects manager without tenant context returns empty
        self.assertEqual(Integration.objects.count(), 0)

    def test_tenant_context_filtering(self):
        """Tenant context strictly restricts visibility to the active shop."""
        Integration.all_objects.create(
            shop=self.shop_a,
            name="Alpha Only",
            category=IntegrationCategory.ECOMMERCE,
            provider=IntegrationProvider.WOOCOMMERCE,
        )
        Integration.all_objects.create(
            shop=self.shop_b,
            name="Beta Only",
            category=IntegrationCategory.ECOMMERCE,
            provider=IntegrationProvider.WOOCOMMERCE,
        )

        with tenant_context(self.shop_a):
            qs_a = Integration.objects.all()
            self.assertEqual(qs_a.count(), 1)
            self.assertEqual(qs_a.first().name, "Alpha Only")

        with tenant_context(self.shop_b):
            qs_b = Integration.objects.all()
            self.assertEqual(qs_b.count(), 1)
            self.assertEqual(qs_b.first().name, "Beta Only")


class ServiceLayerTests(IntegrationsFoundationTestCase):
    def test_create_integration_service(self):
        """create_integration creates integration, credential, audit log, and internal log."""
        integration = create_integration(
            shop=self.shop_a,
            name="New Store",
            category=IntegrationCategory.ECOMMERCE,
            provider=IntegrationProvider.WOOCOMMERCE,
            base_url="https://newstore.com",
            credentials={"api_key": "ck_test_1234", "api_secret": "cs_test_5678"},
            created_by=self.user_a,
        )
        self.assertEqual(integration.status, IntegrationStatus.CONNECTED)
        self.assertTrue(integration.credential.has_credentials())

        # Verify Audit Log
        audit_entry = AuditLog.objects.filter(
            shop=self.shop_a,
            target_model="Integration",
            target_id=str(integration.id),
        ).first()
        self.assertIsNotNone(audit_entry)
        self.assertEqual(audit_entry.action, AuditLog.Action.CREATE)

        # Verify Integration Log
        int_log = IntegrationLog.all_objects.filter(integration=integration).first()
        self.assertIsNotNone(int_log)
        self.assertEqual(int_log.action, "create")

    def test_update_credentials_service(self):
        """update_credentials updates encrypted fields and records redacted audit."""
        integration = create_integration(
            shop=self.shop_a,
            name="Courier Sync",
            category=IntegrationCategory.COURIER,
            provider=IntegrationProvider.PATHAO,
            created_by=self.user_a,
        )
        self.assertEqual(integration.status, IntegrationStatus.DRAFT)

        update_credentials(
            integration=integration,
            api_key="pathao_client_id_999",
            api_secret="pathao_secret_xyz",
            actor=self.user_a,
        )

        integration.refresh_from_db()
        self.assertEqual(integration.status, IntegrationStatus.CONNECTED)
        creds = integration.credential.get_credentials()
        self.assertEqual(creds["api_key"], "pathao_client_id_999")
        self.assertEqual(creds["api_secret"], "pathao_secret_xyz")

    def test_sync_job_lifecycle(self):
        """create_sync_job and complete_sync_job track duration and metrics."""
        integration = create_integration(
            shop=self.shop_a,
            name="RedX Dispatch",
            category=IntegrationCategory.COURIER,
            provider=IntegrationProvider.REDX,
        )
        job = create_sync_job(integration=integration, job_type="tracking_poll")
        self.assertEqual(job.status, SyncJob.Status.RUNNING)
        self.assertIsNotNone(job.started_at)

        completed = complete_sync_job(job=job, items_processed=42, items_failed=0)
        self.assertEqual(completed.status, SyncJob.Status.COMPLETED)
        self.assertEqual(completed.items_processed, 42)
        self.assertIsNotNone(completed.finished_at)

        integration.refresh_from_db()
        self.assertEqual(integration.last_synced_at, completed.finished_at)


class APIEndpointSecurityAndPermissionsTests(IntegrationsFoundationTestCase):
    def test_unauthenticated_requests_blocked(self):
        """Anonymous requests must receive 401 Unauthorized."""
        anon_client = APIClient()
        response = anon_client.get("/api/integrations/channels/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_tenant_api_isolation(self):
        """Shop A user can only see Shop A integrations in API list."""
        int_a = create_integration(
            shop=self.shop_a,
            name="Alpha Store",
            category=IntegrationCategory.ECOMMERCE,
            provider=IntegrationProvider.WOOCOMMERCE,
        )
        int_b = create_integration(
            shop=self.shop_b,
            name="Beta Store",
            category=IntegrationCategory.ECOMMERCE,
            provider=IntegrationProvider.WOOCOMMERCE,
        )

        res_a = self.api_a.get("/api/integrations/channels/")
        self.assertEqual(res_a.status_code, status.HTTP_200_OK)
        ids_a = [item["id"] for item in res_a.data["results"]] if isinstance(res_a.data, dict) and "results" in res_a.data else [item["id"] for item in res_a.data]
        self.assertIn(int_a.id, ids_a)
        self.assertNotIn(int_b.id, ids_a)

    def test_credentials_never_exposed_via_get_detail(self):
        """Detail endpoint returns masked overview and never plaintext secrets."""
        int_a = create_integration(
            shop=self.shop_a,
            name="Secret WooCommerce",
            category=IntegrationCategory.ECOMMERCE,
            provider=IntegrationProvider.WOOCOMMERCE,
            credentials={"api_key": "ck_super_secret_key_1234", "api_secret": "cs_super_secret_pass"},
        )
        response = self.api_a.get(f"/api/integrations/channels/{int_a.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Raw secret must NEVER be anywhere in JSON response
        self.assertNotIn("cs_super_secret_pass", response.content.decode("utf-8"))
        self.assertNotIn("ck_super_secret_key_1234", response.content.decode("utf-8"))

        overview = response.data["credentials_overview"]
        self.assertTrue(overview["has_api_key"])
        self.assertEqual(overview["api_key_masked"], "••••••••1234")

    def test_cross_tenant_update_blocked(self):
        """User from Shop B cannot update or rotate credentials of Shop A's integration."""
        int_a = create_integration(
            shop=self.shop_a,
            name="Alpha Hub",
            category=IntegrationCategory.COURIER,
            provider=IntegrationProvider.PATHAO,
        )
        # Client B attempts to rotate credentials on Shop A's integration
        response = self.api_b.post(
            f"/api/integrations/channels/{int_a.id}/update-credentials/",
            {"api_key": "hacked_key"},
            format="json",
        )
        # Must return 404 Not Found due to tenant auto-filter
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
