"""Permission tests for the product read/write split (POS grid vs management).

Cashier (view_products, no manage_products) must be able to browse/search/read
products for POS, but never create/edit/delete them or see internal cost.
"""
from rest_framework.test import APIClient, APITestCase

from accounts.models import RoleType, User
from catalog.models import Product
from core.tenant_context import set_current_tenant
from tenants.services import register_shop

PRODUCTS_URL = "/api/catalog/products/"


class ProductPermissionTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.shop, cls.owner = register_shop(
            name="Perm Test Shop", owner_email="owner@perm.test",
            owner_password="pw12345", owner_name="Owner",
        )
        set_current_tenant(cls.shop)
        cls.product = Product.all_objects.create(
            shop_id=cls.shop.id, name="Widget", sku="W-1",
            selling_price="100.00", cost_price="60.00", track_inventory=True,
        )
        cls.cashier = User.objects.create_user(
            email="cashier@perm.test", password="pw12345", shop=cls.shop, role=RoleType.CASHIER)
        cls.manager = User.objects.create_user(
            email="manager@perm.test", password="pw12345", shop=cls.shop, role=RoleType.MANAGER)
        cls.accountant = User.objects.create_user(
            email="acct@perm.test", password="pw12345", shop=cls.shop, role=RoleType.ACCOUNTANT)

    def api(self, user):
        set_current_tenant(self.shop)
        c = APIClient()
        c.force_authenticate(user=user)
        return c

    # ── Cashier: READ / browse / search allowed ─────────────────────────────
    def test_cashier_can_list_products(self):
        r = self.api(self.cashier).get(PRODUCTS_URL)
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(r.data["count"], 1)

    def test_cashier_can_retrieve_product(self):
        r = self.api(self.cashier).get(f"{PRODUCTS_URL}{self.product.id}/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["name"], "Widget")

    def test_cashier_can_search_products(self):
        r = self.api(self.cashier).get(PRODUCTS_URL, {"search": "Widget"})
        self.assertEqual(r.status_code, 200)

    # ── Cashier: WRITE denied (even calling the endpoint directly) ───────────
    def test_cashier_cannot_create_product(self):
        r = self.api(self.cashier).post(PRODUCTS_URL, {"name": "X", "selling_price": "10", "cost_price": "5"})
        self.assertEqual(r.status_code, 403)

    def test_cashier_cannot_update_product(self):
        r = self.api(self.cashier).patch(f"{PRODUCTS_URL}{self.product.id}/", {"selling_price": "1"})
        self.assertEqual(r.status_code, 403)
        self.product.refresh_from_db()
        self.assertEqual(str(self.product.selling_price), "100.00")

    def test_cashier_cannot_delete_product(self):
        r = self.api(self.cashier).delete(f"{PRODUCTS_URL}{self.product.id}/")
        self.assertEqual(r.status_code, 403)

    # ── Cashier: internal cost hidden ───────────────────────────────────────
    def test_cashier_cannot_see_cost(self):
        r = self.api(self.cashier).get(f"{PRODUCTS_URL}{self.product.id}/")
        self.assertNotIn("cost_price", r.data)
        self.assertIn("selling_price", r.data)

    # ── Manager: full management + cost visible ─────────────────────────────
    def test_manager_can_create_product(self):
        r = self.api(self.manager).post(PRODUCTS_URL, {"name": "New", "selling_price": "10", "cost_price": "5"})
        self.assertIn(r.status_code, (200, 201))

    def test_manager_can_update_product(self):
        r = self.api(self.manager).patch(f"{PRODUCTS_URL}{self.product.id}/", {"selling_price": "150"})
        self.assertEqual(r.status_code, 200)

    def test_manager_can_see_cost(self):
        r = self.api(self.manager).get(f"{PRODUCTS_URL}{self.product.id}/")
        self.assertIn("cost_price", r.data)

    # ── User without any product permission: denied ─────────────────────────
    def test_accountant_cannot_read_products(self):
        r = self.api(self.accountant).get(PRODUCTS_URL)
        self.assertEqual(r.status_code, 403)

    # ── Owner: full access ──────────────────────────────────────────────────
    def test_owner_can_read_and_write(self):
        c = self.api(self.owner)
        self.assertEqual(c.get(PRODUCTS_URL).status_code, 200)
        self.assertIn(c.post(PRODUCTS_URL, {"name": "O", "selling_price": "5", "cost_price": "2"}).status_code, (200, 201))
