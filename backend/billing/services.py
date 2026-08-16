"""
Manual/offline subscription billing (8.7). Replaces the Phase 1 gateway stub.

There is NO automatic charging. Owners submit ManualPayment records with proof;
Super Admins approve/reject. Approval extends the subscription period.
"""
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from notifications.models import NotificationType
from notifications.services import notify
from tenants.models import Subscription

from .models import ManualPayment, SubscriptionInvoice

GRACE_DAYS = 7


def billing_details():
    """Platform's own receiving numbers/account shown to owners. Not a gateway."""
    return getattr(settings, "PLATFORM_BILLING", {"bkash": "", "nagad": "", "bank": ""})


def _period_days(cycle):
    return 365 if cycle == Subscription.Cycle.YEARLY else 30


def _ensure_subscription(shop, plan, cycle):
    sub = Subscription.objects.filter(shop=shop, is_current=True).first()
    if sub is None:
        now = timezone.now()
        sub = Subscription.objects.create(
            shop=shop, plan=plan, cycle=cycle,
            status=Subscription.Status.TRIALING,
            current_period_start=now,
            current_period_end=shop.trial_ends_at or now,
            is_current=True,
        )
    return sub


@transaction.atomic
def submit_manual_payment(*, shop, plan, cycle, amount, method, payer_reference, proof=None, submitted_by=None):
    """
    Owner declares a payment they already made offline. Creates an unpaid
    invoice + a pending ManualPayment. Nothing is charged.
    """
    sub = _ensure_subscription(shop, plan, cycle)
    count = SubscriptionInvoice.all_objects.filter(shop_id=shop.id).count() + 1
    invoice = SubscriptionInvoice.objects.create(
        shop=shop, subscription=sub, plan=plan,
        number=f"SUB-{shop.id:04d}-{count:04d}",
        amount=Decimal(amount), cycle=cycle,
        period_start=timezone.now().date(),
        period_end=(timezone.now() + timedelta(days=_period_days(cycle))).date(),
    )
    payment = ManualPayment.objects.create(
        shop=shop, subscription=sub, invoice=invoice,
        amount=Decimal(amount), method=method, payer_reference=payer_reference,
        proof=proof, submitted_by=submitted_by,
    )
    notify(
        shop=shop, type=NotificationType.SUBSCRIPTION,
        title="Payment submitted for review",
        message=f"Your payment of {amount} via {method} is pending Super Admin review.",
    )
    return payment


@transaction.atomic
def approve_payment(*, payment, reviewer):
    """Approve: extend the subscription period, activate, mark invoice paid."""
    if payment.status == ManualPayment.Status.APPROVED:
        raise ValueError("Payment already approved.")

    sub = payment.subscription
    now = timezone.now()
    base = sub.current_period_end if (sub.current_period_end and sub.current_period_end > now) else now
    sub.current_period_start = now
    sub.current_period_end = base + timedelta(days=_period_days(sub.cycle))
    sub.status = Subscription.Status.ACTIVE
    sub.plan = payment.invoice.plan if payment.invoice else sub.plan
    sub.save()

    shop = sub.shop
    shop.plan = sub.plan
    shop.is_active = True
    shop.save(update_fields=["plan", "is_active"])

    payment.status = ManualPayment.Status.APPROVED
    payment.reviewed_by = reviewer
    payment.reviewed_at = now
    payment.save(update_fields=["status", "reviewed_by", "reviewed_at"])

    if payment.invoice:
        payment.invoice.status = SubscriptionInvoice.Status.PAID
        payment.invoice.save(update_fields=["status"])

    notify(
        shop=shop, type=NotificationType.SUBSCRIPTION,
        title="Payment approved — subscription active",
        message=f"Your {sub.plan.name} plan is active until {sub.current_period_end:%Y-%m-%d}.",
        email=True,
    )
    return payment


@transaction.atomic
def reject_payment(*, payment, reviewer, reason):
    if payment.status == ManualPayment.Status.APPROVED:
        raise ValueError("Cannot reject an approved payment.")
    payment.status = ManualPayment.Status.REJECTED
    payment.reviewed_by = reviewer
    payment.reviewed_at = timezone.now()
    payment.rejection_reason = reason
    payment.save(update_fields=["status", "reviewed_by", "reviewed_at", "rejection_reason"])
    if payment.invoice:
        payment.invoice.status = SubscriptionInvoice.Status.CANCELLED
        payment.invoice.save(update_fields=["status"])
    notify(
        shop=payment.shop, type=NotificationType.SUBSCRIPTION,
        title="Payment rejected",
        message=f"Your payment was rejected. Reason: {reason}",
        email=True,
    )
    return payment


@transaction.atomic
def grant_or_extend_plan(*, shop, plan, days=None, end_date=None, amount=0,
                         cycle=Subscription.Cycle.MONTHLY, reviewer=None, stack=True):
    """
    Super Admin directly activates (or renews) a paid plan for a shop — no owner
    payment submission. Marks a PAID invoice and emails the owner.

    ``stack`` (default True): new time is added on top of any remaining
    period/trial (renew-before-expiry keeps the leftover days). When False, the
    paid period starts fresh from today and any remaining trial is discarded.

    Pass either ``days`` (length of the new period) or an explicit ``end_date``
    (a timezone-aware datetime).
    """
    now = timezone.now()
    sub = Subscription.objects.filter(shop=shop, is_current=True).first()
    if sub is None:
        sub = Subscription.objects.create(
            shop=shop, plan=plan, cycle=cycle,
            status=Subscription.Status.ACTIVE,
            current_period_start=now, current_period_end=now, is_current=True,
        )

    # Stack on remaining time only when asked; otherwise start the paid period now.
    base = sub.current_period_end if (stack and sub.current_period_end and sub.current_period_end > now) else now
    new_end = end_date if end_date is not None else base + timedelta(days=int(days or 0))

    sub.plan = plan
    sub.cycle = cycle
    sub.status = Subscription.Status.ACTIVE
    sub.current_period_start = now
    sub.current_period_end = new_end
    sub.reminded_days = []  # fresh period → reminders can fire again
    sub.save()

    shop.plan = plan
    shop.is_active = True
    shop.suspended_at = None
    shop.trial_ends_at = None  # paid now — trial no longer applies
    shop.save(update_fields=["plan", "is_active", "suspended_at", "trial_ends_at"])

    count = SubscriptionInvoice.all_objects.filter(shop_id=shop.id).count() + 1
    invoice = SubscriptionInvoice.objects.create(
        shop=shop, subscription=sub, plan=plan,
        number=f"SUB-{shop.id:04d}-{count:04d}",
        amount=Decimal(amount or 0), cycle=cycle,
        period_start=now.date(), period_end=new_end.date(),
        status=SubscriptionInvoice.Status.PAID,
    )

    # Immutable revenue ledger entry (survives shop deletion, excludes test shops).
    try:
        from platform_admin.models import PlatformRevenue
        PlatformRevenue.objects.create(
            shop=shop, shop_name=shop.name, shop_code=shop.shop_code,
            plan_tier=plan.tier, invoice_number=invoice.number,
            amount=Decimal(amount or 0), cycle=cycle,
            period_start=invoice.period_start, period_end=invoice.period_end,
            is_test=getattr(shop, "is_test", False),
        )
    except Exception:
        pass

    # In-app notification (no plain email — a rich HTML invoice goes out below).
    notify(
        shop=shop, type=NotificationType.SUBSCRIPTION,
        title=f"{plan.name} plan activated",
        message=f"Your {plan.name} plan is now active until {new_end:%d %b %Y}. Invoice {invoice.number}.",
        email=False,
    )

    # Professional HTML invoice to every active owner.
    from accounts.models import RoleType, User
    from notifications.channels import send_html_email
    from .emails import build_invoice_email

    owners = User.objects.filter(shop_id=shop.id, role=RoleType.OWNER, is_active=True)
    for owner in owners:
        subject, text_body, html_body = build_invoice_email(
            shop=shop, invoice=invoice, plan=plan,
            period_start=invoice.period_start, period_end=invoice.period_end,
            amount=Decimal(amount or 0),
            owner_name=(owner.first_name or "").strip(),
        )
        send_html_email(owner.email, subject, text_body, html_body)

    return sub, invoice


def subscription_status(shop):
    sub = Subscription.objects.filter(shop=shop, is_current=True).select_related("plan").first()
    now = timezone.now()

    if shop.has_free_access:
        state, ends_at = "free", None
    elif shop.on_trial:
        state, ends_at = "trial", shop.trial_ends_at
    elif sub and sub.current_period_end and sub.current_period_end > now:
        state, ends_at = "paid", sub.current_period_end
    elif sub and sub.current_period_end:
        state, ends_at = "expired", sub.current_period_end
    else:
        state, ends_at = "none", None

    days_left = max(0, (ends_at.date() - now.date()).days) if ends_at else 0

    return {
        "plan": shop.plan.tier if shop.plan else None,
        "plan_name": shop.plan.name if shop.plan else None,
        "state": state,
        "days_left": days_left,
        "ends_at": ends_at,
        "on_trial": shop.on_trial,
        "trial_ends_at": shop.trial_ends_at,
        "status": sub.status if sub else None,
        "current_period_end": sub.current_period_end if sub else None,
        "features": shop.plan.features if shop.plan else {},
        "billing_details": billing_details(),
    }
