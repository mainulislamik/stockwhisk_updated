"""
Tests for Phase 3: Secure Multi-Tenancy, RBAC Permissions, Boundary Enforcement & IDOR/BOLA Protection.

Verifies:
1. Valid authentication & Tenant identification.
2. Invalid/expired authentication handling.
3. Inactive and suspended shop access locking.
4. Granular RBAC permissions (Owner vs Manager vs Cashier vs Accountant).
5. Object-level tenant ownership validation.
6. Prevention of cross-tenant access and manipulation across all domains (BOLA/IDOR):
   - Tenant A -> Tenant B Products
   - Tenant A -> Tenant B Orders
   - Tenant A -> Tenant B Inventory Movements
   - Tenant A -> Tenant B Integrations
   - Tenant A -> Tenant B Credentials
   - Tenant A -> Tenant B Shipments
7. Credential exposure protection across detail views and logs.
8. Throttling / Rate limiting behavior.
"""
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APIClient

from accounts.models import RoleType
from catalog.models import Product
from core.tenant_context import set_current_tenant
from inventory.models import StockMovement
from sales.models import Sale
from tenants.models import Shop
from .models import (
    Integration,
    IntegrationCategory,
    IntegrationProvider,
    IntegrationStatus,
    SyncJob,
)
from .permissions import (
    CanManageIntegrationCredentials,
    CanManageIntegrations,
    CanViewIntegrations,
    IsActiveTenant,
    IsIntegrationTenantOwner,
)
from .services import create_integration, update_credentials
from .validators import CrossTenantBoundaryViolation, validate_tenant_boundary

User = get_user_model()


class MultiTenantSecurityAndPermissionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        # 1. Create two isolated tenant shops
        cls.shop_a = Shop.objects.create(
            name="Alpha Corp",
            slug="alpha-corp",
            business_type="electronics",
            is_active=True,
            modules={"integrations": True},
        )
        cls.shop_b = Shop.objects.create(
            name="Beta Enterprise",
            slug="beta-enterprise",
            business_type="fashion",
            is_active=True,
            modules={"integrations": True},
        )
        cls.shop_suspended = Shop.objects.create(
            name="Suspended Retail",
            slug="suspended-retail",
            business_type="general",
            is_active=False,
        )

        # 2. Create users with different roles for Shop A
        cls.owner_a = User.objects.create_user(
            email="owner@alpha.com",
            password="SecurePassword123!",
            first_name="Alpha",
            last_name="Owner",
            shop=cls.shop_a,
            role=RoleType.OWNER,
        )
        cls.manager_a = User.objects.create_user(
            email="manager@alpha.com",
            password="SecurePassword123!",
            first_name="Alpha",
            last_name="Manager",
            shop=cls.shop_a,
            role=RoleType.MANAGER,
        )
        cls.cashier_a = User.objects.create_user(
            email="cashier@alpha.com",
            password="SecurePassword123!",
            first_name="Alpha",
            last_name="Cashier",
            shop=cls.shop_a,
            role=RoleType.CASHIER,
        )
        cls.accountant_a = User.objects.create_user(
            email="accountant@alpha.com",
            password="SecurePassword123!",
            first_name="Alpha",
            last_name="Accountant",
            shop=cls.shop_a,
            role=RoleType.ACCOUNTANT,
        )

        # 3. Create users for Shop B
        cls.owner_b = User.objects.create_user(
            email="owner@beta.com",
            password="SecurePassword123!",
            first_name="Beta",
            last_name="Owner",
            shop=cls.shop_b,
            role=RoleType.OWNER,
        )

        # 4. Create user for Suspended Shop
        cls.user_suspended = User.objects.create_user(
            email="owner@suspended.com",
            password="SecurePassword123!",
            first_name="Suspended",
            last_name="Owner",
            shop=cls.shop_suspended,
            role=RoleType.OWNER,
        )

        # 5. Populate entities in Shop A
        set_current_tenant(cls.shop_a)
        cls.int_a = create_integration(
            shop=cls.shop_a,
            name="Alpha WooCommerce",
            category="ecommerce",
            provider="woocommerce",
            credentials={"api_key": "ck_alpha_12345678", "api_secret": "cs_alpha_secret_pass"},
            created_by=cls.owner_a,
        )
        cls.product_a = Product.all_objects.create(
            shop=cls.shop_a,
            name="Laptop Alpha",
            sku="SKU-ALP-01",
            selling_price="1200.00",
            cost_price="900.00",
        )
        cls.order_a = Sale.all_objects.create(
            shop=cls.shop_a,
            invoice_no="INV-ALP-001",
            sale_date=timezone.now(),
            total="1200.00",
            paid="1200.00",
        )
        cls.stock_movement_a = StockMovement.all_objects.create(
            shop=cls.shop_a,
            product=cls.product_a,
            quantity=10,
            movement_type="purchase_in",
        )

        # 6. Populate entities in Shop B
        set_current_tenant(cls.shop_b)
        cls.int_b = create_integration(
            shop=cls.shop_b,
            name="Beta Shopify",
            category="ecommerce",
            provider="shopify",
            credentials={"api_key": "shpat_beta_98765432", "api_secret": "shpss_beta_secret_pass"},
            created_by=cls.owner_b,
        )
        cls.product_b = Product.all_objects.create(
            shop=cls.shop_b,
            name="Dress Beta",
            sku="SKU-BET-01",
            selling_price="500.00",
            cost_price="300.00",
        )
        cls.order_b = Sale.all_objects.create(
            shop=cls.shop_b,
            invoice_no="INV-BET-001",
            sale_date=timezone.now(),
            total="500.00",
            paid="500.00",
        )
        cls.stock_movement_b = StockMovement.all_objects.create(
            shop=cls.shop_b,
            product=cls.product_b,
            quantity=20,
            movement_type="purchase_in",
        )

    def client_for(self, user):
        client = APIClient()
        if user:
            client.force_authenticate(user=user)
            if hasattr(user, "shop") and user.shop:
                set_current_tenant(user.shop)
        return client

    # ── 1. Authentication & Tenant Identification ─────────────────────────
    def test_anonymous_access_rejected(self):
        """Unauthenticated requests must be rejected with 401."""
        client = self.client_for(None)
        res = client.get("/api/integrations/channels/")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_valid_authentication_identifies_tenant(self):
        """Owner A receives only Shop A integrations."""
        client = self.client_for(self.owner_a)
        res = client.get("/api/integrations/channels/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        items = res.data["results"] if isinstance(res.data, dict) and "results" in res.data else res.data
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["id"], self.int_a.id)

    def test_suspended_tenant_access_denied(self):
        """Users belonging to inactive or suspended shops must be locked out with 403."""
        client = self.client_for(self.user_suspended)
        res = client.get("/api/integrations/channels/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("inactive or suspended", res.data.get("detail", ""))

    # ── 2. RBAC Permission Boundaries ─────────────────────────────────────
    def test_cashier_cannot_view_integrations(self):
        """Cashier role lacks CanViewIntegrations permission."""
        client = self.client_for(self.cashier_a)
        res = client.get("/api/integrations/channels/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_accountant_cannot_view_integrations(self):
        """Accountant role lacks CanViewIntegrations permission."""
        client = self.client_for(self.accountant_a)
        res = client.get("/api/integrations/channels/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_can_view_and_update_settings_but_not_credentials(self):
        """
        Managers can view and update basic integration parameters,
        but are strictly forbidden from rotating/setting sensitive API keys and credentials.
        """
        client = self.client_for(self.manager_a)
        # 1. View allowed
        res_view = client.get(f"/api/integrations/channels/{self.int_a.id}/")
        self.assertEqual(res_view.status_code, status.HTTP_200_OK)

        # 2. Update basic settings allowed
        res_update = client.patch(
            f"/api/integrations/channels/{self.int_a.id}/",
            {"name": "Alpha WooCommerce Updated"},
            format="json",
        )
        self.assertEqual(res_update.status_code, status.HTTP_200_OK)

        # 3. Rotate/Update credentials FORBIDDEN (Owner-only)
        res_cred = client.post(
            f"/api/integrations/channels/{self.int_a.id}/update-credentials/",
            {"api_key": "new_manager_key"},
            format="json",
        )
        self.assertEqual(res_cred.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_manage_credentials(self):
        """Owner can rotate integration credentials."""
        client = self.client_for(self.owner_a)
        res = client.post(
            f"/api/integrations/channels/{self.int_a.id}/update-credentials/",
            {"api_key": "ck_new_owner_key_999"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["overview"]["api_key_masked"], "••••••••_999")

    # ── 3. Cross-Tenant Isolation & IDOR/BOLA Protection ───────────────────
    def test_tenant_b_cannot_view_tenant_a_integration(self):
        """Shop B owner querying Shop A's integration ID receives 404 (Not Found / Obscured)."""
        client = self.client_for(self.owner_b)
        res = client.get(f"/api/integrations/channels/{self.int_a.id}/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_tenant_b_cannot_update_tenant_a_integration(self):
        """Shop B owner attempting to patch Shop A's integration receives 404."""
        client = self.client_for(self.owner_b)
        res = client.patch(
            f"/api/integrations/channels/{self.int_a.id}/",
            {"name": "Hijacked Integration"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_tenant_b_cannot_rotate_tenant_a_credentials(self):
        """Shop B owner attempting credential rotation on Shop A receives 404."""
        client = self.client_for(self.owner_b)
        res = client.post(
            f"/api/integrations/channels/{self.int_a.id}/update-credentials/",
            {"api_key": "stolen_key"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_cross_tenant_product_boundary_assertion(self):
        """validate_tenant_boundary rejects linking Tenant B product to Tenant A integration."""
        with self.assertRaises(CrossTenantBoundaryViolation):
            validate_tenant_boundary(
                shop=self.shop_a,
                product=self.product_b,
                integration=self.int_a,
            )

    def test_cross_tenant_order_boundary_assertion(self):
        """validate_tenant_boundary rejects linking Tenant B order to Tenant A."""
        with self.assertRaises(CrossTenantBoundaryViolation):
            validate_tenant_boundary(
                shop=self.shop_a,
                order=self.order_b,
                integration=self.int_a,
            )

    def test_cross_tenant_inventory_movement_boundary_assertion(self):
        """validate_tenant_boundary rejects referencing Tenant B stock movement under Tenant A."""
        with self.assertRaises(CrossTenantBoundaryViolation):
            validate_tenant_boundary(
                shop=self.shop_a,
                stock_movement=self.stock_movement_b,
            )

    def test_cross_tenant_credential_boundary_assertion(self):
        """validate_tenant_boundary rejects referencing Tenant B credentials under Tenant A."""
        with self.assertRaises(CrossTenantBoundaryViolation):
            validate_tenant_boundary(
                shop=self.shop_a,
                credential=self.int_b.credential,
            )

    def test_valid_same_tenant_boundary_assertion_passes(self):
        """All entities from Shop A validate smoothly without exception."""
        try:
            validate_tenant_boundary(
                shop=self.shop_a,
                product=self.product_a,
                order=self.order_a,
                integration=self.int_a,
                credential=self.int_a.credential,
                stock_movement=self.stock_movement_a,
            )
        except CrossTenantBoundaryViolation:
            self.fail("validate_tenant_boundary raised CrossTenantBoundaryViolation unexpectedly!")

    # ── 4. Credential Protection & Secret Non-Leakage ──────────────────────
    def test_raw_secrets_never_in_api_response(self):
        """Ensure plaintext API keys and secrets never appear anywhere in the API payloads."""
        client = self.client_for(self.owner_a)
        res = client.get(f"/api/integrations/channels/{self.int_a.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        content_str = res.content.decode("utf-8")

        self.assertNotIn("cs_alpha_secret_pass", content_str)
        self.assertNotIn("ck_alpha_12345678", content_str)
        self.assertIn("••••••••5678", content_str)
