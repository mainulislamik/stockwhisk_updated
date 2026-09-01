"""Tenant root models: subscription plans, shops (tenants), branches."""
import re

from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from core.models import TimeStampedModel


def derive_barcode_prefix(name: str) -> str:
    """Build a short, memorable 3-letter-ish barcode prefix from a shop name.

    Uses word initials when there are multiple words (VISION ELECTRONICS -> VE,
    padded to VSE from the first word's consonants), otherwise the leading
    letters of a single word. Always uppercase A-Z0-9, 3-5 chars.
    """
    words = re.findall(r"[A-Za-z0-9]+", (name or "").upper())
    if not words:
        return "SHP"
    if len(words) >= 2:
        w1 = words[0]
        # first consonant after the leading letter (VISION -> S)
        inner = next((c for c in w1[1:] if c not in "AEIOU"), "")
        code = w1[0] + inner + words[1][0]  # Vision Electronics -> VSE
        for w in words[2:]:  # extend up to 4 chars with more word initials
            if len(code) >= 4:
                break
            code += w[0]
    else:
        code = words[0][:4]
    code = re.sub(r"[^A-Z0-9]", "", code)[:4]
    return code.ljust(3, "X")[:4] if code else "SHP"


class SubscriptionPlan(TimeStampedModel):
    """A billing tier. Not tenant-scoped — plans are platform-global."""

    class Tier(models.TextChoices):
        FREE = "free", "Free"
        BASIC = "basic", "Basic"
        PROFESSIONAL = "professional", "Professional"
        ENTERPRISE = "enterprise", "Enterprise"

    name = models.CharField(max_length=80)
    tier = models.CharField(max_length=20, choices=Tier.choices, unique=True)
    price_monthly = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    price_yearly = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Feature gating. Stored as JSON so plans are editable without migrations.
    # Keys are feature flags checked by the FeatureGate (e.g. "multi_branch",
    # "advanced_analytics", "api_access").
    features = models.JSONField(default=dict, blank=True)

    # Hard limits enforced on top of feature flags.
    max_users = models.PositiveIntegerField(default=2)
    max_branches = models.PositiveIntegerField(default=1)
    max_products = models.PositiveIntegerField(default=100)

    # Custom feature bullet points shown on the public pricing card (one per
    # entry). When empty, the card falls back to the auto limits + feature flags.
    highlights = models.JSONField(default=list, blank=True)

    # Whether each limit line appears in the auto feature list on the pricing card.
    show_users = models.BooleanField(default=True)
    show_branches = models.BooleanField(default=True)
    show_products = models.BooleanField(default=True)

    # Yearly discount shown on the pricing page (0 = no discount / hide yearly saving).
    yearly_discount_percent = models.PositiveIntegerField(default=0)

    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["price_monthly"]

    def __str__(self):
        return f"{self.name} ({self.get_tier_display()})"

    def has_feature(self, flag: str) -> bool:
        return bool(self.features.get(flag, False))


class Shop(TimeStampedModel):
    """
    The tenant. Every tenant-owned row points here via ``shop``.

    NOT a TenantScopedModel itself — it is the scope root.
    """

    class BusinessType(models.TextChoices):
        FASHION = "fashion", "Fashion & Apparel"
        BEAUTY = "beauty", "Beauty & Cosmetics"
        JEWELRY = "jewelry", "Jewelry & Accessories"
        HOME_DECOR = "home_decor", "Home Decor & Furniture"
        FOOD = "food", "Groceries & Organic Food"
        FOOTWEAR = "footwear", "Footwear & Shoes"
        HANDCRAFTS = "handcrafts", "Handcrafts & Boutique"
        ELECTRONICS = "electronics", "Electronics & Gadgets"
        COMPUTER = "computer", "Computer & IT"
        MOBILE = "mobile", "Mobile & Accessories"
        GENERAL = "general", "General Retail"
        CAMICAL = "camical", "Chemical & Lab Supplies"
        OTHER = "other", "Other"

    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=160, unique=True, blank=True)
    subdomain = models.CharField(
        max_length=63, unique=True, blank=True, null=True,
        help_text="Optional host-based routing key, e.g. 'acme' -> acme.stockwhisk.app",
    )
    logo = models.ImageField(upload_to="shop_logos/", blank=True, null=True)

    business_type = models.CharField(
        max_length=20, choices=BusinessType.choices, default=BusinessType.GENERAL
    )
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)

    # Locale / financial config
    currency = models.CharField(max_length=3, default="BDT")
    vat_enabled = models.BooleanField(default=False)
    vat_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    vat_registration_no = models.CharField(max_length=50, blank=True)

    # Invoice presentation settings (prefix, footer note, etc.)
    invoice_settings = models.JSONField(default=dict, blank=True)
    opening_hours = models.JSONField(default=dict, blank=True)
    
    # Feature flags
    emi_enabled = models.BooleanField(default=False)
    delivery_enabled = models.BooleanField(default=True)
    # Offer to send the invoice PDF over WhatsApp from the POS after-sale popup.
    whatsapp_invoice_enabled = models.BooleanField(default=True)
    # Offline Sale Entry Mode: when enabled, POS allows backdated sales (up to 30 days)
    # and relaxes stock-level validation so the owner can log sales made during
    # a network/PC outage after the fact.
    offline_sale_mode = models.BooleanField(default=False)
    # Print preferences: "ask" (prompt every time for Normal vs POS), "pos" (always POS thermal receipt), "regular" (always standard A4)
    pos_print_mode = models.CharField(max_length=20, default="ask")
    pos_receipt_enabled = models.BooleanField(default=True)

    # Section module switches (shop owner can toggle on/off)
    service_enabled = models.BooleanField(default=True, help_text="Enable/disable Service section (Tickets, Warranties)")
    reports_enabled = models.BooleanField(default=True, help_text="Enable/disable Reports section")
    finance_enabled = models.BooleanField(default=True, help_text="Enable/disable Finance section (Expenses, Accounting)")

    # Short 2–5 char code prefixed to generated barcodes so labels are unique
    # per shop (e.g. "VSE" for Vision Electronics). Auto-derived from the name
    # on first save; owner can override it in Settings.
    barcode_prefix = models.CharField(max_length=5, blank=True)

    # Subscription state (denormalized current plan for fast gating).
    plan = models.ForeignKey(
        SubscriptionPlan, on_delete=models.PROTECT,
        related_name="shops", null=True, blank=True,
    )
    trial_ends_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    # Test/demo shop: its subscription revenue is excluded from platform totals.
    is_test = models.BooleanField(default=False)
    # Public read-only demo shop. Users of a demo shop can browse everything but
    # every write (POST/PUT/PATCH/DELETE) is blocked by DemoReadOnlyMiddleware.
    is_demo = models.BooleanField(default=False)

    # Reseller/partner attribution (via referral code at registration). Nullable —
    # most shops have no reseller. SET_NULL so removing a reseller never deletes a
    # shop. Only admins may change this; reseller users can never touch it.
    reseller = models.ForeignKey(
        "resellers.ResellerProfile", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="shops",
    )
    reseller_attributed_at = models.DateTimeField(null=True, blank=True)
    # Lifetime-free grant from a reseller: while True AND the attributing reseller
    # is active, this shop bypasses subscription/trial billing. If the reseller is
    # suspended or removed the grant lapses automatically (see has_free_access) —
    # the shop is never deleted, it simply has to start paying.
    is_free = models.BooleanField(default=False)
    # When the shop was last suspended (is_active flipped to False). Used to
    # enforce a cool-off before a shop can be permanently deleted.
    suspended_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name) or "shop"
            slug = base
            i = 1
            while Shop.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                i += 1
                slug = f"{base}-{i}"
            self.slug = slug
        if self.barcode_prefix:
            self.barcode_prefix = "".join(
                c for c in self.barcode_prefix.upper() if c.isalnum()
            )[:5]
        if not self.barcode_prefix:
            self.barcode_prefix = derive_barcode_prefix(self.name)
        super().save(*args, **kwargs)

    @property
    def effective_barcode_prefix(self) -> str:
        """Stored prefix if set, else derived on the fly from the shop name."""
        return self.barcode_prefix or derive_barcode_prefix(self.name)

    @property
    def shop_code(self) -> str:
        return f"SW-{1000 + self.id}"

    @property
    def has_free_access(self) -> bool:
        """A lifetime-free shop keeps free access only while its granting reseller
        is active. Suspending/removing the reseller lapses the perk — the shop
        must then pay — without ever deleting the shop."""
        if not self.is_free:
            return False
        reseller = self.reseller
        return bool(reseller and reseller.status == "active")

    @property
    def on_trial(self) -> bool:
        if self.has_free_access:
            return False
        return bool(self.trial_ends_at and self.trial_ends_at > timezone.now())

    def has_feature(self, flag: str) -> bool:
        """Central feature check used by the FeatureGate permission/decorator."""
        if not self.is_active:
            return False
        if self.plan is None:
            return False
        return self.plan.has_feature(flag)


class Branch(TimeStampedModel):
    """
    A physical location within a shop. Built now (per spec) even though the
    multi-branch *feature* is gated to a later phase, so future migrations are
    painless. Carries its own explicit ``shop`` FK.
    """

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="branches")
    name = models.CharField(max_length=120)
    code = models.CharField(max_length=20, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    address = models.TextField(blank=True)
    is_main = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "branches"
        constraints = [
            models.UniqueConstraint(
                fields=["shop", "name"], name="uniq_branch_name_per_shop"
            ),
        ]

    def __str__(self):
        return f"{self.shop.name} — {self.name}"


class Subscription(TimeStampedModel):
    """
    Billing subscription lifecycle for a shop. One active row per shop;
    history retained for audit. Payment integration lands in the billing app
    (Phase 1/2) — this holds state only.
    """

    class Status(models.TextChoices):
        TRIALING = "trial", "Trial"
        ACTIVE = "active", "Active"
        GRACE_PERIOD = "grace_period", "Grace period"
        PAST_DUE = "past_due", "Past due"
        CANCELLED = "cancelled", "Cancelled"
        EXPIRED = "expired", "Expired"

    class Cycle(models.TextChoices):
        MONTHLY = "monthly", "Monthly"
        YEARLY = "yearly", "Yearly"

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="subscriptions")
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT, related_name="subscriptions")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.TRIALING)
    cycle = models.CharField(max_length=10, choices=Cycle.choices, default=Cycle.MONTHLY)
    started_at = models.DateTimeField(default=timezone.now)
    current_period_start = models.DateTimeField(default=timezone.now)
    current_period_end = models.DateTimeField(null=True, blank=True)
    # Informational only — nothing charges automatically.
    auto_renew = models.BooleanField(default=False)
    is_current = models.BooleanField(default=True)
    # Expiry-reminder milestones (days-left) already emailed for the current
    # period, so the daily task never sends the same reminder twice. Reset on renew.
    reminded_days = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.shop.name} · {self.plan.tier} · {self.status}"

    @property
    def is_live(self) -> bool:
        if self.status in {self.Status.CANCELLED, self.Status.EXPIRED}:
            return False
        if self.current_period_end and self.current_period_end < timezone.now():
            return False
        return True
