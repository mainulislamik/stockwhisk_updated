"""Tenant provisioning: register a shop with its owner in one transaction."""
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from accounts.models import RoleType, User
from accounts.rbac import seed_default_roles
from audit.models import AuditLog
from audit.services import record

from .models import Branch, Shop, Subscription, SubscriptionPlan

TRIAL_DAYS = 14


CAMICAL_DEFAULT_UNITS = [
    ("Piece", "pcs", "count", False),
    ("Kilogram", "kg", "weight", True),
    ("Gram", "g", "weight", True),
    ("Liter", "L", "volume", True),
    ("Milliliter", "ml", "volume", True),
    ("Drum", "drum", "volume", False),
    ("Bottle", "bottle", "count", False),
]


SUPERSHOP_DEFAULT_UNITS = [
    {"name": "Piece", "short_code": "pcs", "measure_type": "count", "allow_decimal": False},
    {"name": "Kilogram", "short_code": "kg", "measure_type": "weight", "allow_decimal": True},
    {"name": "Gram", "short_code": "g", "measure_type": "weight", "allow_decimal": True},
    {"name": "Liter", "short_code": "L", "measure_type": "volume", "allow_decimal": True},
    {"name": "Milliliter", "short_code": "ml", "measure_type": "volume", "allow_decimal": True},
    {"name": "Dozen", "short_code": "dz", "measure_type": "count", "allow_decimal": True},
    {"name": "Pack / Box", "short_code": "pkt", "measure_type": "count", "allow_decimal": False},
]

def seed_measurement_units(shop, business_type):
    """Seed default units for CAMICAL shops so kg/L/decimal quantities work out of the box."""
    from catalog.models import Unit

    if str(business_type) != "camical":
        return
    for name, short_code, measure_type, allow_decimal in CAMICAL_DEFAULT_UNITS:
        Unit.all_objects.get_or_create(
            shop=shop,
            name=name,
            defaults={
                "short_code": short_code,
                "measure_type": measure_type,
                "allow_decimal": allow_decimal,
            },
        )


@transaction.atomic
def register_shop(
    *, name, owner_email, owner_password, owner_name="",
    business_type=Shop.BusinessType.GENERAL, phone="", address="", plan=None,
    reseller=None,
):
    """
    Provision a new tenant:
    1. Create the Shop on the Free/default plan with a trial window.
    2. Create a main Branch.
    3. Seed system roles + permission catalog.
    4. Create the Owner user.
    5. Open a trialing Subscription.
    6. Audit the creation.
    """
    if plan is None:
        plan = (
            SubscriptionPlan.objects.filter(tier=SubscriptionPlan.Tier.FREE).first()
            or SubscriptionPlan.objects.filter(is_active=True).order_by("price_monthly").first()
        )

    now = timezone.now()
    # Trial length is configurable in Platform Settings (falls back to TRIAL_DAYS).
    try:
        from platform_admin.models import PlatformConfig
        trial_days = PlatformConfig.get_solo().default_trial_days or TRIAL_DAYS
    except Exception:
        trial_days = TRIAL_DAYS
    shop = Shop.objects.create(
        name=name,
        business_type=business_type,
        phone=phone,
        address=address,
        plan=plan,
        trial_ends_at=now + timedelta(days=trial_days),
        reseller=reseller if reseller is not None else None,
        reseller_attributed_at=now if reseller is not None else None,
    )

    Branch.objects.create(shop=shop, name="Main", is_main=True)
    seed_default_roles(shop)
    seed_measurement_units(shop, business_type)

    from accounting.services import seed_expense_categories
    seed_expense_categories(shop)

    first, _, last = owner_name.partition(" ")
    owner = User.objects.create_user(
        email=owner_email,
        password=owner_password,
        shop=shop,
        role=RoleType.OWNER,
        first_name=first,
        last_name=last,
        phone=phone,
    )

    if plan is not None:
        Subscription.objects.create(
            shop=shop, plan=plan,
            status=Subscription.Status.TRIALING,
            current_period_end=shop.trial_ends_at,
        )

    record(
        action=AuditLog.Action.CREATE, actor=owner, shop=shop, target=shop,
        description=f"Shop '{shop.name}' registered",
    )
    return shop, owner
