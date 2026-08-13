"""Permission tests for the Sales read/write split.

A read-only role (Accountant: view_sales, no create_sale) must be able to view,
retrieve and search sales/invoices, but never create or cancel a sale. A role
with create_sale (Cashier) can create; a role with neither is denied entirely.
"""
from decimal import Decimal

from rest_framework.test import APIClient, APITestCase

from accounts.models import Role, RoleType, User
from catalog.models import Product
from core.tenant_context import set_current_tenant
from inventory.services import apply_movement
from sales.services import create_sale
from tenants.services import register_shop

SALES_URL = "/api/sales/sales/"


class SalePermissionTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.shop, cls.owner = register_shop(
            name="Sales Perm Shop", owner_email="owner@sp.test",
            owner_password="pw12345", owner_name="Owner",
        )
        set_current_tenant(cls.shop)
        cls.product = Product.all_objects.create(
            shop_id=cls.shop.id, name="Widget", sku="W-1",
            selling_price="100.00", cost_price="60.00", track_inventory=True,
        )
        apply_movement(product=cls.product, movement_type="opening",
                       quantity=Decimal("50"), unit_cost=Decimal("60"),
                       shop=cls.shop, created_by=cls.owner)
        cls.sale = create_sale(
            shop=cls.shop,
            items=[{"product": cls.product, "quantity": Decimal("1"), "unit_price": Decimal("100")}],
            payments=[{"amount": Decimal("100"), "method": "cash"}],
            created_by=cls.owner,
        )
        # Accountant: view_sales, NOT create_sale (read-only reporting role).
        cls.accountant = User.objects.create_user(
            email="acc@sp.test", password="pw12345", shop=cls.shop, role=RoleType.ACCOUNTANT)
        # Cashier: create_sale (+ view_sales).
        cls.cashier = User.objects.create_user(
            email="cash@sp.test", password="pw12345", shop=cls.shop, role=RoleType.CASHIER)

    def api(self, user):
        set_current_tenant(self.shop)
        c = APIClient()
        c.force_authenticate(user=user)
        return c

    # ── Read-only role CAN view sales/invoices ──────────────────────────────
    def test_accountant_can_list_sales(self):
        r = self.api(self.accountant).get(SALES_URL)
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(r.data["count"], 1)

    def test_accountant_can_retrieve_sale(self):
        r = self.api(self.accountant).get(f"{SALES_URL}{self.sale.id}/")
        self.assertEqual(r.status_code, 200)

    def test_accountant_can_search_sales(self):
        r = self.api(self.accountant).get(SALES_URL, {"search": self.sale.invoice_no})
        self.assertEqual(r.status_code, 200)

    # ── Read-only role CANNOT create / cancel ───────────────────────────────
    def test_accountant_cannot_create_sale(self):
        r = self.api(self.accountant).post(SALES_URL, {"items": []}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_accountant_cannot_cancel_sale(self):
        r = self.api(self.accountant).post(f"{SALES_URL}{self.sale.id}/cancel/")
        self.assertEqual(r.status_code, 403)

    # ── create_sale role CAN create ─────────────────────────────────────────
    def test_cashier_can_create_sale(self):
        body = {
            "items": [{"product": self.product.id, "quantity": "1", "unit_price": "100"}],
            "payments": [{"amount": "100", "method": "cash"}],
        }
        r = self.api(self.cashier).post(SALES_URL, body, format="json")
        self.assertIn(r.status_code, (200, 201))

    # ── No sales permission at all → denied ─────────────────────────────────
    def test_without_view_sales_denied(self):
        role = Role.objects.get(shop=self.shop, role_type=RoleType.ACCOUNTANT)
        perms = list(role.permissions.filter(code__in=["view_sales", "create_sale"]))
        role.permissions.remove(*perms)  # rolled back after this test
        r = self.api(self.accountant).get(SALES_URL)
        self.assertEqual(r.status_code, 403)
