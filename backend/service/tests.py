"""Permission tests for the Service read/write split.

Cashier (view_service, no manage_service) must be able to view repair tickets
and warranties, but not create/edit tickets or change their status.
"""
from rest_framework.test import APIClient, APITestCase

from accounts.models import RoleType, User
from core.tenant_context import set_current_tenant
from service.models import ServiceTicket
from tenants.services import register_shop

TICKETS_URL = "/api/service/tickets/"
WARRANTIES_URL = "/api/service/warranties/"


class ServicePermissionTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.shop, cls.owner = register_shop(
            name="Service Perm Shop", owner_email="owner@sv.test",
            owner_password="pw12345", owner_name="Owner",
        )
        set_current_tenant(cls.shop)
        cls.ticket = ServiceTicket.all_objects.create(
            shop_id=cls.shop.id, ticket_no="SVC-000001", customer_name="Walk-in",
            device_description="Laptop", device_type="laptop", issue_type="screen",
            complaint="cracked screen", status="received",
        )
        cls.cashier = User.objects.create_user(   # view_service, no manage_service
            email="cash@sv.test", password="pw12345", shop=cls.shop, role=RoleType.CASHIER)
        cls.manager = User.objects.create_user(   # manage_service
            email="mgr@sv.test", password="pw12345", shop=cls.shop, role=RoleType.MANAGER)
        cls.accountant = User.objects.create_user(  # no service permission
            email="acc@sv.test", password="pw12345", shop=cls.shop, role=RoleType.ACCOUNTANT)

    def api(self, user):
        set_current_tenant(self.shop)
        c = APIClient()
        c.force_authenticate(user=user)
        return c

    # ── Cashier: READ allowed ───────────────────────────────────────────────
    def test_cashier_can_list_tickets(self):
        r = self.api(self.cashier).get(TICKETS_URL)
        self.assertEqual(r.status_code, 200)

    def test_cashier_can_retrieve_ticket(self):
        r = self.api(self.cashier).get(f"{TICKETS_URL}{self.ticket.id}/")
        self.assertEqual(r.status_code, 200)

    def test_cashier_can_list_warranties(self):
        r = self.api(self.cashier).get(WARRANTIES_URL)
        self.assertEqual(r.status_code, 200)

    # ── Cashier: WRITE denied ───────────────────────────────────────────────
    def test_cashier_cannot_create_ticket(self):
        r = self.api(self.cashier).post(TICKETS_URL, {"device_description": "PC", "complaint": "dead"})
        self.assertEqual(r.status_code, 403)

    def test_cashier_cannot_change_status(self):
        r = self.api(self.cashier).post(f"{TICKETS_URL}{self.ticket.id}/change_status/", {"status": "in_repair"})
        self.assertEqual(r.status_code, 403)

    # ── manage_service role CAN create ──────────────────────────────────────
    def test_manager_can_create_ticket(self):
        r = self.api(self.manager).post(TICKETS_URL, {"device_description": "PC", "complaint": "dead"})
        self.assertIn(r.status_code, (200, 201))

    # ── No service permission → denied ──────────────────────────────────────
    def test_accountant_cannot_read_tickets(self):
        r = self.api(self.accountant).get(TICKETS_URL)
        self.assertEqual(r.status_code, 403)
