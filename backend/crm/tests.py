"""Permission tests for the Customer read/write split (accounting/read roles).

Accountant (view_customers, no manage_customers) must be able to view customers
and dues, but never create/edit/delete a customer or record a due payment.
"""
from rest_framework.test import APIClient, APITestCase

from accounts.models import RoleType, User
from crm.models import Customer
from core.tenant_context import set_current_tenant
from tenants.services import register_shop

CUSTOMERS_URL = "/api/crm/customers/"


class CustomerPermissionTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.shop, cls.owner = register_shop(
            name="CRM Perm Shop", owner_email="owner@crm.test",
            owner_password="pw12345", owner_name="Owner",
        )
        set_current_tenant(cls.shop)
        cls.customer = Customer.all_objects.create(
            shop_id=cls.shop.id, name="Rahim", phone="0170000000")
        cls.accountant = User.objects.create_user(  # view_customers, no manage_customers
            email="acc@crm.test", password="pw12345", shop=cls.shop, role=RoleType.ACCOUNTANT)
        cls.cashier = User.objects.create_user(      # manage_customers
            email="cash@crm.test", password="pw12345", shop=cls.shop, role=RoleType.CASHIER)
        cls.inventory = User.objects.create_user(    # neither customer perm
            email="inv@crm.test", password="pw12345", shop=cls.shop, role=RoleType.INVENTORY_MANAGER)

    def api(self, user):
        set_current_tenant(self.shop)
        c = APIClient()
        c.force_authenticate(user=user)
        return c

    # ── Accountant: READ allowed ────────────────────────────────────────────
    def test_accountant_can_list_customers(self):
        r = self.api(self.accountant).get(CUSTOMERS_URL)
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(r.data["count"], 1)

    def test_accountant_can_retrieve_customer(self):
        r = self.api(self.accountant).get(f"{CUSTOMERS_URL}{self.customer.id}/")
        self.assertEqual(r.status_code, 200)

    def test_accountant_can_view_dues_total(self):
        r = self.api(self.accountant).get(f"{CUSTOMERS_URL}dues-total/")
        self.assertEqual(r.status_code, 200)

    # ── Accountant: WRITE denied ────────────────────────────────────────────
    def test_accountant_cannot_create_customer(self):
        r = self.api(self.accountant).post(CUSTOMERS_URL, {"name": "New"})
        self.assertEqual(r.status_code, 403)

    def test_accountant_cannot_update_customer(self):
        r = self.api(self.accountant).patch(f"{CUSTOMERS_URL}{self.customer.id}/", {"name": "X"})
        self.assertEqual(r.status_code, 403)

    def test_accountant_cannot_delete_customer(self):
        r = self.api(self.accountant).delete(f"{CUSTOMERS_URL}{self.customer.id}/")
        self.assertEqual(r.status_code, 403)

    def test_accountant_cannot_pay_due(self):
        r = self.api(self.accountant).post(f"{CUSTOMERS_URL}{self.customer.id}/pay-due/", {"amount": "10"})
        self.assertEqual(r.status_code, 403)

    # ── manage_customers role CAN manage ────────────────────────────────────
    def test_cashier_can_create_customer(self):
        r = self.api(self.cashier).post(CUSTOMERS_URL, {"name": "New", "phone": "0181111111"})
        self.assertIn(r.status_code, (200, 201))

    # ── Role without any customer permission → denied ───────────────────────
    def test_inventory_manager_cannot_read_customers(self):
        r = self.api(self.inventory).get(CUSTOMERS_URL)
        self.assertEqual(r.status_code, 403)
