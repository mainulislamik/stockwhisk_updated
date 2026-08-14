"""Reseller / partner / referral models.

Integrates with the existing architecture:
- A reseller is an existing ``accounts.User`` (with ``shop=None``) plus a
  ``ResellerProfile``. Resellers are NOT shop members — the tenant RBAC and
  ``IsTenantMember`` never grant them shop access.
- Attribution lives on ``tenants.Shop.reseller`` (a real FK, added in tenants).
- ``ResellerCommission`` is an append-only ledger with a per-period snapshot of
  the rate, so historical commissions never change when a rate is updated.
"""
import secrets
from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from core.models import TimeStampedModel

_REFERRAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no ambiguous chars
MAX_COMMISSION_RATE = Decimal("100.00")


def _generate_referral_code() -> str:
    return "SW-" + "".join(secrets.choice(_REFERRAL_ALPHABET) for _ in range(5))


class ResellerProfile(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"
        REJECTED = "rejected", "Rejected"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reseller_profile"
    )
    # Internal, human-readable id (RS-000123). Derived from pk; immutable.
    reseller_code = models.CharField(max_length=20, unique=True, blank=True, editable=False)
    # Public attribution code (SW-8K4P2). Unique, hard to guess, immutable.
    referral_code = models.CharField(max_length=20, unique=True, db_index=True, editable=False)

    company_name = models.CharField(max_length=180, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    address = models.TextField(blank=True)
    country = models.CharField(max_length=80, blank=True)

    # Percentage of gross profit shared with the reseller (admin-controlled).
    commission_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("10.00"),
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(MAX_COMMISSION_RATE)],
    )
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.PENDING)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="+",
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status"], name="resellers_r_status_idx")]

    def __str__(self):
        return f"{self.reseller_code or 'RS-?'} ({self.user.email})"

    @property
    def is_active(self) -> bool:
        return self.status == self.Status.ACTIVE

    @property
    def referral_link(self) -> str:
        return f"/register/?ref={self.referral_code}"

    def save(self, *args, **kwargs):
        if not self.referral_code:
            code = _generate_referral_code()
            while ResellerProfile.objects.filter(referral_code=code).exists():
                code = _generate_referral_code()
            self.referral_code = code
        super().save(*args, **kwargs)
        if not self.reseller_code:
            self.reseller_code = f"RS-{self.pk:06d}"
            ResellerProfile.objects.filter(pk=self.pk).update(reseller_code=self.reseller_code)


class ResellerCommission(TimeStampedModel):
    """One row per (reseller, shop, month). Append-only ledger."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        PAID = "paid", "Paid"
        CANCELLED = "cancelled", "Cancelled"

    reseller = models.ForeignKey(
        ResellerProfile, on_delete=models.PROTECT, related_name="commissions"
    )
    # SET_NULL: never destroy financial history if a shop is removed.
    shop = models.ForeignKey(
        "tenants.Shop", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="reseller_commissions",
    )
    shop_name = models.CharField(max_length=150, blank=True)  # denormalised snapshot
    period_year = models.PositiveIntegerField()
    period_month = models.PositiveSmallIntegerField()  # 1-12

    gross_profit = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2)  # snapshot at calc time
    commission_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    status = models.CharField(max_length=15, choices=Status.choices, default=Status.PENDING)
    approved_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    payment_reference = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-period_year", "-period_month", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["reseller", "shop", "period_year", "period_month"],
                name="uniq_reseller_commission_period",
            ),
        ]
        indexes = [
            models.Index(fields=["reseller", "status"], name="resellers_r_res_status_idx"),
            models.Index(fields=["period_year", "period_month"], name="resellers_r_period_idx"),
        ]

    def __str__(self):
        return f"{self.reseller.reseller_code} · {self.shop_name} · {self.period_year}-{self.period_month:02d}"

    def mark_paid(self, reference="", note=""):
        self.status = self.Status.PAID
        self.paid_at = timezone.now()
        if reference:
            self.payment_reference = reference
        if note:
            self.notes = (self.notes + "\n" + note).strip()
        self.save(update_fields=["status", "paid_at", "payment_reference", "notes", "updated_at"])


class PendingResellerRegistration(TimeStampedModel):
    """
    Temporarily stores reseller registration details until the email OTP is verified.
    """
    email = models.EmailField(unique=True)
    password_hash = models.CharField(max_length=255)
    full_name = models.CharField(max_length=150)
    company_name = models.CharField(max_length=180, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    address = models.TextField(blank=True)
    country = models.CharField(max_length=80, blank=True)
    otp = models.CharField(max_length=6)
    expires_at = models.DateTimeField()

    def __str__(self):
        return f"{self.email} ({self.otp})"
