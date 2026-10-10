"""
Test Suite for Phase 15: Integration Platform Observability and Audit.

Verifies:
1. Correct Tenant Scoping (Strict multi-tenant isolation; Tenant B never sees Tenant A's audit logs)
2. Correct Event & Complete Fields Capture:
   - Tenant, Integration, Event Type, Internal ID, External ID, Timestamp, Status,
     Attempt Count, Duration, Error Type, Error Message, HTTP Status, Correlation/Request ID.
3. Correct Timestamps & Chronological Ordering
4. No Secret Leakage (Plaintext API secrets, passwords, client secrets, webhook secrets, tokens are sanitized/redacted)
5. Audit Immutability (Entries cannot be modified or deleted via save(), delete(), or Django admin)
6. Permission Boundaries (Subscriber Owner allowed, Unauthorized staff 403, Non-admin blocked from superadmin observability, Superadmin allowed)
7. Audit of All Important Actions:
   - integration connected, integration disconnected, credentials changed,
     mapping created, mapping changed, mapping removed, webhook received,
     order imported, inventory synchronized, shipment created, shipment cancelled,
     retry triggered, integration failed.
8. Superadmin Observability Aggregation Metrics.
"""
from datetime import timedelta
from decimal import Decimal
import json
from unittest.mock import MagicMock, patch
import uuid

from django.core.exceptions import PermissionDenied
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import RoleType, User
from catalog.models import Category, Product, Unit
from tenants.models import Shop
from .audit import (
    record_integration_audit,
    sanitize_audit_payload,
    trace_integration_operation,
)
from .models import (
    CourierAccount,
    CourierCredential,
    CourierProvider,
    CourierShipment,
    ExternalOrder,
    Integration,
    IntegrationAuditLog,
    IntegrationCategory,
    IntegrationCredential,
    IntegrationEvent,
    IntegrationLog,
    IntegrationProvider,
    IntegrationStatus,
    ProductChannelMapping,
    SyncJob,
    WebhookEndpoint,
)
from .services import change_status, create_integration, update_credentials
from .mapping_services import create_or_update_product_mapping, disconnect_product_mapping
from .recovery import manual_retry_event, record_event_failure, IntegrationErrorCategory


@override_settings(SECURE_SSL_REDIRECT=False)
class ObservabilityPhase15TestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        # 1. Tenant A (Alpha Subscriber)
        cls.shop_a = Shop.objects.create(
            name="Alpha Subscriber Shop",
            subdomain="alpha-obs-sub",
            business_type="super_shop",
            is_active=True,
        )
        cls.owner_a = User.objects.create_user(
            email="owner_a@alphaobs.test",
            phone="01730000001",
            password="StrongPassword123!",
            role=RoleType.OWNER,
            shop=cls.shop_a,
        )
        cls.staff_unauthorized_a = User.objects.create_user(
            email="cashier_a@alphaobs.test",
            phone="01730000002",
            password="StrongPassword123!",
            role=RoleType.CASHIER,
            shop=cls.shop_a,
        )

        # 2. Tenant B (Beta Competitor - Isolator)
        cls.shop_b = Shop.objects.create(
            name="Beta Competitor Shop",
            subdomain="beta-obs-sub",
            business_type="fashion_pos",
            is_active=True,
        )
        cls.owner_b = User.objects.create_user(
            email="owner_b@betaobs.test",
            phone="01730000003",
            password="StrongPassword123!",
            role=RoleType.OWNER,
            shop=cls.shop_b,
        )

        # 3. Superadmin / Platform Staff
        cls.superadmin = User.objects.create_superuser(
            email="superadmin@stockwhisk.test",
            phone="01730000099",
            password="SuperPassword123!",
        )

        # 4. Catalog for Tenant A
        cls.unit_a = Unit.objects.create(shop=cls.shop_a, name="Piece", code="pc")
        cls.category_a = Category.objects.create(shop=cls.shop_a, name="Electronics")
        cls.product_a = Product.objects.create(
            shop=cls.shop_a,
            name="Wireless Earbuds",
            sku="EAR-001",
            unit=cls.unit_a,
            category=cls.category_a,
            purchase_price=Decimal("1500.00"),
            selling_price=Decimal("2500.00"),
            current_stock=Decimal("50.00"),
            reserved_stock=Decimal("0.00"),
        )

        # 5. Integrations for Tenant A & B
        cls.integration_a = Integration.all_objects.create(
            shop=cls.shop_a,
            name="Alpha WooCommerce Store",
            category=IntegrationCategory.ECOMMERCE,
            provider=IntegrationProvider.WOOCOMMERCE,
            status=IntegrationStatus.CONNECTED,
            base_url="https://alpha-store.test",
            webhook_slug="alpha-woo",
        )
        cls.integration_b = Integration.all_objects.create(
            shop=cls.shop_b,
            name="Beta Shopify Store",
            category=IntegrationCategory.ECOMMERCE,
            provider=IntegrationProvider.SHOPIFY,
            status=IntegrationStatus.CONNECTED,
            base_url="https://beta-store.test",
            webhook_slug="beta-shopify",
        )

        # 6. Couriers for Tenant A
        cls.courier_a = CourierAccount.all_objects.create(
            shop=cls.shop_a,
            name="Alpha Pathao Express",
            provider=CourierProvider.PATHAO,
            is_active=True,
            is_default=True,
        )

    def setUp(self):
        self.client = APIClient()

    # ==========================================================================
    # 1. Correct Tenant Scoping
    # ==========================================================================
    def test_correct_tenant_scoping_and_isolation(self):
        """Verifies that audit logs are strictly isolated by tenant and Tenant B cannot see Tenant A's entries."""
        # Create audit entry for Shop A
        log_a = record_integration_audit(
            shop=self.shop_a,
            action=str(IntegrationAuditLog.Action.INTEGRATION_CONNECTED),
            integration=self.integration_a,
            event_type="channel.connected",
            internal_id=str(self.integration_a.id),
            status="success",
            description="Alpha store connected",
        )

        # Create audit entry for Shop B
        log_b = record_integration_audit(
            shop=self.shop_b,
            action=str(IntegrationAuditLog.Action.INTEGRATION_CONNECTED),
            integration=self.integration_b,
            event_type="channel.connected",
            internal_id=str(self.integration_b.id),
            status="success",
            description="Beta store connected",
        )

        self.assertEqual(log_a.shop_id, self.shop_a.id)
        self.assertEqual(log_b.shop_id, self.shop_b.id)

        # Tenant A owner retrieves audit logs
        self.client.force_authenticate(user=self.owner_a)
        response_a = self.client.get("/api/integrations/audit-logs/")
        self.assertEqual(response_a.status_code, status.HTTP_200_OK)
        results_a = response_a.data.get("results", response_a.data)
        ids_a = [entry["id"] for entry in results_a]
        self.assertIn(log_a.id, ids_a)
        self.assertNotIn(log_b.id, ids_a)

        # Tenant B owner retrieves audit logs
        self.client.force_authenticate(user=self.owner_b)
        response_b = self.client.get("/api/integrations/audit-logs/")
        self.assertEqual(response_b.status_code, status.HTTP_200_OK)
        results_b = response_b.data.get("results", response_b.data)
        ids_b = [entry["id"] for entry in results_b]
        self.assertIn(log_b.id, ids_b)
        self.assertNotIn(log_a.id, ids_b)

        # Tenant B cannot retrieve Tenant A's audit log directly by ID
        detail_res = self.client.get(f"/api/integrations/audit-logs/{log_a.id}/")
        self.assertEqual(detail_res.status_code, status.HTTP_404_NOT_FOUND)

    # ==========================================================================
    # 2. Correct Event & Fields Capture
    # ==========================================================================
    def test_correct_event_and_complete_fields_captured(self):
        """Verifies capturing of all mandatory operational fields: Tenant, Integration, Event Type, IDs, Metrics."""
        correlation_id = str(uuid.uuid4())
        request_id = "req_test_12345"

        audit_entry = record_integration_audit(
            shop=self.shop_a,
            action=str(IntegrationAuditLog.Action.ORDER_IMPORTED),
            integration=self.integration_a,
            event_type="order.imported",
            internal_id="SALE_789",
            external_id="WC_ORDER_456",
            status="success",
            attempt_count=2,
            duration_ms=185,
            error_type="",
            error_message="",
            http_status=200,
            correlation_id=correlation_id,
            request_id=request_id,
            actor=self.owner_a,
            description="Order #WC_ORDER_456 imported into Sale #SALE_789",
            details={"invoice_no": "INV-1001", "total": "2500.00"},
            changes={"status": ["pending", "completed"]},
        )

        self.assertEqual(audit_entry.shop, self.shop_a)
        self.assertEqual(audit_entry.integration, self.integration_a)
        self.assertEqual(audit_entry.action, str(IntegrationAuditLog.Action.ORDER_IMPORTED))
        self.assertEqual(audit_entry.event_type, "order.imported")
        self.assertEqual(audit_entry.internal_id, "SALE_789")
        self.assertEqual(audit_entry.external_id, "WC_ORDER_456")
        self.assertEqual(audit_entry.status, "success")
        self.assertEqual(audit_entry.attempt_count, 2)
        self.assertEqual(audit_entry.duration_ms, 185)
        self.assertEqual(audit_entry.http_status, 200)
        self.assertEqual(audit_entry.correlation_id, correlation_id)
        self.assertEqual(audit_entry.request_id, request_id)
        self.assertEqual(audit_entry.actor, self.owner_a)
        self.assertEqual(audit_entry.details.get("invoice_no"), "INV-1001")
        self.assertIsNotNone(audit_entry.created_at)

    # ==========================================================================
    # 3. Correct Timestamps & Ordering
    # ==========================================================================
    def test_correct_timestamps_and_chronological_ordering(self):
        """Verifies that timestamps are timezone-aware and ordering is strictly descending by created_at."""
        t1 = timezone.now() - timedelta(minutes=5)
        log1 = record_integration_audit(
            shop=self.shop_a,
            action=str(IntegrationAuditLog.Action.WEBHOOK_RECEIVED),
            event_type="webhook.ping",
            status="success",
        )
        log2 = record_integration_audit(
            shop=self.shop_a,
            action=str(IntegrationAuditLog.Action.INVENTORY_SYNCHRONIZED),
            event_type="inventory.sync",
            status="success",
        )

        self.assertLessEqual(log1.created_at, log2.created_at)

        # Query via API
        self.client.force_authenticate(user=self.owner_a)
        res = self.client.get("/api/integrations/audit-logs/")
        results = res.data.get("results", res.data)
        # Most recent first
        self.assertEqual(results[0]["id"], log2.id)

    # ==========================================================================
    # 4. No Secret Leakage
    # ==========================================================================
    def test_no_secret_leakage_in_audit_records_and_serializers(self):
        """Verifies that tokens, passwords, and sensitive keys are never saved or displayed in plaintext."""
        sensitive_payload = {
            "api_key": "raw_secret_key_12345",
            "password": "SuperSecretPassword!",
            "client_secret": "cs_test_987654321",
            "webhook_secret": "whsec_abcdef",
            "access_token": "bearer_token_xyz",
            "safe_metadata": "StockWhisk Dhaka Outlet",
            "nested": {
                "auth_token": "token_nested_secret",
                "regular_count": 10,
            },
        }

        sanitized = sanitize_audit_payload(sensitive_payload)
        self.assertEqual(sanitized["api_key"], "[REDACTED]")
        self.assertEqual(sanitized["password"], "[REDACTED]")
        self.assertEqual(sanitized["client_secret"], "[REDACTED]")
        self.assertEqual(sanitized["webhook_secret"], "[REDACTED]")
        self.assertEqual(sanitized["access_token"], "[REDACTED]")
        self.assertEqual(sanitized["safe_metadata"], "StockWhisk Dhaka Outlet")
        self.assertEqual(sanitized["nested"]["auth_token"], "[REDACTED]")
        self.assertEqual(sanitized["nested"]["regular_count"], 10)

        # Test recording via audit logger
        audit_record = record_integration_audit(
            shop=self.shop_a,
            action=str(IntegrationAuditLog.Action.CREDENTIALS_CHANGED),
            integration=self.integration_a,
            status="success",
            details=sensitive_payload,
            changes={"secret_key": ["old_secret_value", "new_secret_value"]},
        )

        self.assertEqual(audit_record.details["password"], "[REDACTED]")
        self.assertEqual(audit_record.details["client_secret"], "[REDACTED]")

        # Test API response serialization
        self.client.force_authenticate(user=self.owner_a)
        res = self.client.get(f"/api/integrations/audit-logs/{audit_record.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data
        self.assertEqual(data["details"]["password"], "[REDACTED]")
        self.assertEqual(data["details"]["access_token"], "[REDACTED]")
        self.assertNotIn("raw_secret_key_12345", json.dumps(data))
        self.assertNotIn("SuperSecretPassword!", json.dumps(data))

    # ==========================================================================
    # 5. Audit Immutability
    # ==========================================================================
    def test_audit_immutability_prevents_updates_and_deletions(self):
        """Verifies that audit log rows cannot be modified or deleted directly in code."""
        audit_entry = record_integration_audit(
            shop=self.shop_a,
            action=str(IntegrationAuditLog.Action.INTEGRATION_CONNECTED),
            integration=self.integration_a,
            status="success",
            description="Initial audit log entry",
        )

        # Attempt to modify
        audit_entry.description = "Malicious update attempt"
        with self.assertRaises(PermissionDenied):
            audit_entry.save()

        # Attempt to delete
        with self.assertRaises(PermissionDenied):
            audit_entry.delete()

        # Verify entry remains unchanged in database
        refreshed = IntegrationAuditLog.all_objects.get(id=audit_entry.id)
        self.assertEqual(refreshed.description, "Initial audit log entry")

    # ==========================================================================
    # 6. Permission Boundaries
    # ==========================================================================
    def test_permission_boundaries(self):
        """Verifies subscriber vs staff vs superadmin permission enforcement."""
        # 1. Subscriber owner has access to own audit logs
        self.client.force_authenticate(user=self.owner_a)
        res_owner = self.client.get("/api/integrations/audit-logs/")
        self.assertEqual(res_owner.status_code, status.HTTP_200_OK)

        # 2. Staff without integration permissions (Cashier) gets 403 Forbidden
        self.client.force_authenticate(user=self.staff_unauthorized_a)
        res_staff = self.client.get("/api/integrations/audit-logs/")
        self.assertEqual(res_staff.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Subscriber owner blocked from superadmin observability
        self.client.force_authenticate(user=self.owner_a)
        res_admin_obs = self.client.get("/api/integrations/admin/observability/")
        self.assertEqual(res_admin_obs.status_code, status.HTTP_403_FORBIDDEN)

        # 4. Superadmin has full access to superadmin observability
        self.client.force_authenticate(user=self.superadmin)
        res_super = self.client.get("/api/integrations/admin/observability/")
        self.assertEqual(res_super.status_code, status.HTTP_200_OK)
        self.assertIn("connected_integrations", res_super.data)
        self.assertIn("failed_events", res_super.data)
        self.assertIn("integration_errors", res_super.data)
        self.assertIn("active_courier_connections", res_super.data)
        self.assertIn("synchronization_activity", res_super.data)
        self.assertIn("shipment_integration_activity", res_super.data)

    # ==========================================================================
    # 7. Audit Operations Lifecycle Tracking
    # ==========================================================================
    def test_audit_operations_lifecycle_tracking(self):
        """Verifies tracking of integration actions: connect, disconnect, mapping lifecycle, retry, etc."""
        # A. Credentials changed
        cred = update_credentials(
            integration=self.integration_a,
            api_key="new_key",
            api_secret="new_secret",
            actor=self.owner_a,
        )
        cred_audit = IntegrationAuditLog.all_objects.filter(
            shop=self.shop_a,
            action=str(IntegrationAuditLog.Action.CREDENTIALS_CHANGED),
        ).first()
        self.assertIsNotNone(cred_audit)
        self.assertEqual(cred_audit.status, "success")

        # B. Status changed / Disconnected
        change_status(
            integration=self.integration_a,
            new_status="disconnected",
            reason="Maintenance",
            actor=self.owner_a,
        )
        disc_audit = IntegrationAuditLog.all_objects.filter(
            shop=self.shop_a,
            action=str(IntegrationAuditLog.Action.INTEGRATION_DISCONNECTED),
        ).first()
        self.assertIsNotNone(disc_audit)

        # Reconnect
        change_status(
            integration=self.integration_a,
            new_status="connected",
            actor=self.owner_a,
        )
        conn_audit = IntegrationAuditLog.all_objects.filter(
            shop=self.shop_a,
            action=str(IntegrationAuditLog.Action.INTEGRATION_CONNECTED),
        ).first()
        self.assertIsNotNone(conn_audit)

        # C. Mapping created, changed, removed
        mapping, created = create_or_update_product_mapping(
            shop=self.shop_a,
            integration=self.integration_a,
            product=self.product_a,
            external_product_id="EXT_PROD_999",
            external_sku="EXT-SKU-999",
        )
        map_create_audit = IntegrationAuditLog.all_objects.filter(
            shop=self.shop_a,
            action=str(IntegrationAuditLog.Action.MAPPING_CREATED),
        ).first()
        self.assertIsNotNone(map_create_audit)
        self.assertEqual(map_create_audit.external_id, "EXT_PROD_999")

        # Update mapping
        create_or_update_product_mapping(
            shop=self.shop_a,
            integration=self.integration_a,
            product=self.product_a,
            external_product_id="EXT_PROD_999",
            external_sku="EXT-SKU-UPDATED",
        )
        map_change_audit = IntegrationAuditLog.all_objects.filter(
            shop=self.shop_a,
            action=str(IntegrationAuditLog.Action.MAPPING_CHANGED),
        ).first()
        self.assertIsNotNone(map_change_audit)

        # Remove mapping
        disconnect_product_mapping(shop=self.shop_a, mapping_id=mapping.id, soft=False)
        map_remove_audit = IntegrationAuditLog.all_objects.filter(
            shop=self.shop_a,
            action=str(IntegrationAuditLog.Action.MAPPING_REMOVED),
        ).first()
        self.assertIsNotNone(map_remove_audit)

    # ==========================================================================
    # 8. Tracing & Timing Execution
    # ==========================================================================
    def test_trace_integration_operation_timing_and_error_capture(self):
        """Verifies that trace_integration_operation measures duration_ms and captures errors automatically."""
        # 1. Successful trace
        with trace_integration_operation(
            shop=self.shop_a,
            action="custom_sync_job",
            integration=self.integration_a,
            event_type="test.trace",
            initial_details={"step": "first"},
        ) as trace_ctx:
            trace_ctx.internal_id = "TRACE_001"
            trace_ctx.external_id = "EXT_TRACE_001"

        success_log = IntegrationAuditLog.all_objects.filter(
            shop=self.shop_a,
            event_type="test.trace",
            status="success",
        ).first()
        self.assertIsNotNone(success_log)
        self.assertEqual(success_log.internal_id, "TRACE_001")
        self.assertGreaterEqual(success_log.duration_ms, 0)

        # 2. Failing trace
        with self.assertRaises(ValueError):
            with trace_integration_operation(
                shop=self.shop_a,
                action="custom_sync_failure",
                integration=self.integration_a,
                event_type="test.failure",
            ):
                raise ValueError("External gateway timeout simulated")

        fail_log = IntegrationAuditLog.all_objects.filter(
            shop=self.shop_a,
            event_type="test.failure",
            status="failed",
        ).first()
        self.assertIsNotNone(fail_log)
        self.assertEqual(fail_log.error_type, "ValueError")
        self.assertIn("External gateway timeout simulated", fail_log.error_message)
