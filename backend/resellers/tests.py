"""Reseller system tests: lifecycle, attribution, isolation/IDOR, commission
calculation, rate snapshot, idempotency and negative-profit handling.
"""
import datetime
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from accounts.models import User
from core.tenant_context import set_current_tenant
from resellers.models import ResellerCommission, ResellerProfile
from resellers.services import (
    compute_commission,
    generate_commissions_for_month,
    resolve_active_reseller,
)
from tenants.services import register_shop


def _make_reseller(email, status=ResellerProfile.Status.ACTIVE, rate="10.00"):
    user = User.objects.create_user(email=email, password="pw12345", shop=None)
    return ResellerProfile.objects.create(
        user=user, status=status, commission_rate=Decimal(rate))


class ResellerLifecycleTests(APITestCase):
    def test_registration_creates_pending_reseller(self):
        # Step 1: register → OTP emailed, no profile yet (200).
        r = self.client.post("/api/reseller/register/", {
            "full_name": "Jane Doe", "email": "jane@r.test",
            "password": "StrongPass123", "confirm_password": "StrongPass123",
        }, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(ResellerProfile.objects.filter(user__email="jane@r.test").exists())

        # Step 2: verify OTP → PENDING reseller profile created (201).
        from resellers.models import PendingResellerRegistration
        pending = PendingResellerRegistration.objects.get(email="jane@r.test")
        r2 = self.client.post("/api/reseller/verify-otp/", {"email": "jane@r.test", "otp": pending.otp}, format="json")
        self.assertEqual(r2.status_code, 201)
        profile = ResellerProfile.objects.get(user__email="jane@r.test")
        self.assertEqual(profile.status, ResellerProfile.Status.PENDING)
        self.assertTrue(profile.reseller_code.startswith("RS-"))
        self.assertTrue(profile.referral_code.startswith("SW-"))

    def test_pending_cannot_login(self):
        _make_reseller("p@r.test", status=ResellerProfile.Status.PENDING)
        r = self.client.post("/api/reseller/login/", {"email": "p@r.test", "password": "pw12345"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_suspended_and_rejected_cannot_login(self):
        _make_reseller("s@r.test", status=ResellerProfile.Status.SUSPENDED)
        _make_reseller("x@r.test", status=ResellerProfile.Status.REJECTED)
        self.assertEqual(self.client.post("/api/reseller/login/", {"email": "s@r.test", "password": "pw12345"}, format="json").status_code, 403)
        self.assertEqual(self.client.post("/api/reseller/login/", {"email": "x@r.test", "password": "pw12345"}, format="json").status_code, 403)

    def test_active_can_login(self):
        _make_reseller("a@r.test", status=ResellerProfile.Status.ACTIVE)
        r = self.client.post("/api/reseller/login/", {"email": "a@r.test", "password": "pw12345"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIn("access", r.data)


class ReferralAttributionTests(APITestCase):
    def test_valid_active_code_attributes_shop(self):
        reseller = _make_reseller("ref@r.test")
        resolved = resolve_active_reseller(reseller.referral_code.lower())  # case-insensitive
        self.assertEqual(resolved, reseller)
        shop, _ = register_shop(name="S1", owner_email="o1@s.test", owner_password="pw12345", reseller=resolved)
        self.assertEqual(shop.reseller_id, reseller.pk)
        self.assertIsNotNone(shop.reseller_attributed_at)

    def test_invalid_code_returns_none(self):
        self.assertIsNone(resolve_active_reseller("SW-NOPE9"))

    def test_inactive_reseller_code_not_attributed(self):
        reseller = _make_reseller("inact@r.test", status=ResellerProfile.Status.SUSPENDED)
        self.assertIsNone(resolve_active_reseller(reseller.referral_code))


class ResellerIsolationTests(APITestCase):
    def setUp(self):
        self.res_a = _make_reseller("a@iso.test")
        self.res_b = _make_reseller("b@iso.test")
        self.shop_a, _ = register_shop(name="ShopA", owner_email="oa@iso.test", owner_password="pw12345", reseller=self.res_a)
        self.shop_b, _ = register_shop(name="ShopB", owner_email="ob@iso.test", owner_password="pw12345", reseller=self.res_b)

    def api(self, reseller):
        c = APIClient(); c.force_authenticate(user=reseller.user); return c

    def test_reseller_sees_only_own_shops(self):
        r = self.api(self.res_a).get("/api/reseller/shops/")
        self.assertEqual(r.status_code, 200)
        ids = [s["id"] for s in r.data]
        self.assertIn(self.shop_a.id, ids)
        self.assertNotIn(self.shop_b.id, ids)

    def test_idor_other_shop_is_404(self):
        r = self.api(self.res_a).get(f"/api/reseller/shops/{self.shop_b.id}/")
        self.assertEqual(r.status_code, 404)

    def test_reseller_cannot_access_shop_apis(self):
        # No shop membership → tenant APIs deny.
        r = self.api(self.res_a).get("/api/catalog/products/")
        self.assertIn(r.status_code, (401, 403))

    def test_non_reseller_denied_portal(self):
        owner = self.shop_a.users.first()
        c = APIClient(); c.force_authenticate(user=owner)
        self.assertEqual(c.get("/api/reseller/dashboard/").status_code, 403)


class CommissionMathTests(APITestCase):
    def test_ten_and_twenty_percent(self):
        self.assertEqual(compute_commission(Decimal("10000"), Decimal("10")), Decimal("1000.00"))
        self.assertEqual(compute_commission(Decimal("10000"), Decimal("20")), Decimal("2000.00"))

    def test_zero_and_negative_profit(self):
        self.assertEqual(compute_commission(Decimal("0"), Decimal("10")), Decimal("0.00"))
        self.assertEqual(compute_commission(Decimal("-500"), Decimal("10")), Decimal("0.00"))


class CommissionGenerationTests(APITestCase):
    def _sale_shop_with_profit(self, reseller, when, email="p@gen.test", trial_ends=None):
        from catalog.models import Product
        from inventory.services import apply_movement
        from sales.services import create_sale
        shop, owner = register_shop(name="ProfitShop", owner_email=email, owner_password="pw12345", reseller=reseller)
        # Trial ended before the target month → paying customer (unless overridden).
        shop.trial_ends_at = trial_ends or timezone.make_aware(datetime.datetime(2026, 6, 1))
        shop.is_active = True
        shop.save(update_fields=["trial_ends_at", "is_active"])
        set_current_tenant(shop)
        p = Product.all_objects.create(shop_id=shop.id, name="W", selling_price="100", cost_price="60", track_inventory=True)
        apply_movement(product=p, movement_type="opening", quantity=Decimal("20"), unit_cost=Decimal("60"), shop=shop, created_by=owner)
        # 10 × (100-60) = 400 gross profit
        create_sale(shop=shop, items=[{"product": p, "quantity": Decimal("10"), "unit_price": Decimal("100")}],
                    payments=[{"amount": Decimal("1000"), "method": "cash"}], created_by=owner, sale_date=when)
        return shop

    def test_no_commission_while_on_trial(self):
        reseller = _make_reseller("trial@r.test", rate="10.00")
        when = timezone.make_aware(datetime.datetime(2026, 7, 15, 12, 0))
        # Trial ends AFTER the target month → still on trial → no commission.
        self._sale_shop_with_profit(reseller, when, email="trialshop@gen.test",
                                    trial_ends=timezone.make_aware(datetime.datetime(2026, 9, 1)))
        created, skipped = generate_commissions_for_month(2026, 7)
        self.assertEqual(created, 0)
        self.assertGreaterEqual(skipped, 1)

    def test_generation_snapshot_and_idempotency(self):
        reseller = _make_reseller("gen@r.test", rate="10.00")
        when = timezone.make_aware(datetime.datetime(2026, 7, 15, 12, 0))
        shop = self._sale_shop_with_profit(reseller, when)

        created, _ = generate_commissions_for_month(2026, 7)
        self.assertEqual(created, 1)
        c = ResellerCommission.objects.get(reseller=reseller, shop=shop, period_year=2026, period_month=7)
        self.assertEqual(c.gross_profit, Decimal("400.00"))
        self.assertEqual(c.commission_rate, Decimal("10.00"))
        self.assertEqual(c.commission_amount, Decimal("40.00"))

        # Idempotent: running again creates nothing.
        created2, _ = generate_commissions_for_month(2026, 7)
        self.assertEqual(created2, 0)

        # Rate change does NOT rewrite the historical (snapshotted) commission.
        reseller.commission_rate = Decimal("20.00")
        reseller.save(update_fields=["commission_rate"])
        generate_commissions_for_month(2026, 7)
        c.refresh_from_db()
        self.assertEqual(c.commission_rate, Decimal("10.00"))
        self.assertEqual(c.commission_amount, Decimal("40.00"))
