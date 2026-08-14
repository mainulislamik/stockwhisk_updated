"""Reseller attribution + commission generation.

Commission = shop GROSS PROFIT (from the app's authoritative
``accounting.services.profit_summary``) × the reseller's rate, computed once per
(reseller, shop, calendar month). The rate is snapshotted onto each row, so
changing a reseller's rate never rewrites history. Returns/refunds are already
netted inside ``profit_summary`` for the period, so a closed month stays fixed
and later refunds reduce the later month's profit instead.
"""
import calendar
import datetime
from decimal import ROUND_HALF_UP, Decimal

from django.utils import timezone

from .models import ResellerCommission, ResellerProfile

CENT = Decimal("0.01")


def resolve_active_reseller(referral_code):
    """Return the ACTIVE reseller for a referral code, or None. Never attributes
    to a pending/suspended/rejected reseller."""
    if not referral_code:
        return None
    code = referral_code.strip().upper()
    if not code:
        return None
    return ResellerProfile.objects.filter(
        referral_code=code, status=ResellerProfile.Status.ACTIVE
    ).first()


def attribute_shop(shop, reseller):
    """Link a shop to a reseller (registration-time). Audited."""
    if reseller is None:
        return
    shop.reseller = reseller
    shop.reseller_attributed_at = timezone.now()
    shop.save(update_fields=["reseller", "reseller_attributed_at"])
    try:
        from audit.models import AuditLog
        from audit.services import record
        record(
            action=AuditLog.Action.CREATE, shop=shop, target=shop,
            description=f"Shop '{shop.name}' attributed to reseller {reseller.reseller_code}",
            metadata={"reseller_id": reseller.pk, "referral_code": reseller.referral_code},
        )
    except Exception:
        pass


def _month_bounds(year, month):
    start = timezone.make_aware(datetime.datetime(year, month, 1, 0, 0, 0))
    last = calendar.monthrange(year, month)[1]
    end = timezone.make_aware(datetime.datetime(year, month, last, 23, 59, 59, 999999))
    return start, end


def compute_commission(gross_profit, rate) -> Decimal:
    """commission = gross * rate% (Decimal, half-up to cents). <=0 → 0."""
    gross = Decimal(gross_profit or 0)
    if gross <= 0:
        return Decimal("0.00")
    return (gross * Decimal(rate) / Decimal("100")).quantize(CENT, rounding=ROUND_HALF_UP)


def generate_commissions_for_month(year, month):
    """Idempotently create one commission row per active-reseller shop for the
    given closed month. Returns (created, skipped_zero)."""
    from accounting.services import profit_summary
    from tenants.models import Shop

    start, end = _month_bounds(year, month)
    created = 0
    skipped = 0
    shops = Shop.objects.filter(
        reseller__isnull=False, reseller__status=ResellerProfile.Status.ACTIVE
    ).select_related("reseller")

    for shop in shops:
        reseller = shop.reseller
        # A reseller earns only once the referred shop is a PAYING customer:
        # nothing during the free trial, and nothing while the shop is
        # suspended (non-paying). Trial is over when trial_ends_at falls before
        # this month starts.
        on_trial = shop.trial_ends_at is None or shop.trial_ends_at >= start
        if on_trial or not shop.is_active:
            skipped += 1
            continue
        summary = profit_summary(shop, start=start, end=end)
        gross = Decimal(summary.get("gross_profit") or 0)
        if gross <= 0:
            skipped += 1
            continue
        rate = reseller.commission_rate
        _, was_created = ResellerCommission.objects.get_or_create(
            reseller=reseller, shop=shop, period_year=year, period_month=month,
            defaults={
                "shop_name": shop.name,
                "gross_profit": gross.quantize(CENT),
                "commission_rate": rate,
                "commission_amount": compute_commission(gross, rate),
            },
        )
        if was_created:
            created += 1
    return created, skipped
