"""
Subscription lifecycle Celery task (runs daily via Celery beat).

For every current subscription (trial or paid):
  * Email the owner a reminder 5, 3, 2 and 1 day(s) before expiry (once each).
  * When the period ends, auto-suspend the shop and mark the subscription expired.

No charging — purely state + notifications. Reminders are de-duplicated via
``Subscription.reminded_days`` so a milestone is never emailed twice; renewing
resets that list (see billing.services.grant_or_extend_plan).
"""
from celery import shared_task
from django.utils import timezone

from notifications.models import NotificationType
from notifications.services import notify
from tenants.models import Subscription

REMINDER_DAYS = (5, 3, 2, 1)


def _plan_label(sub):
    if sub.status == Subscription.Status.TRIALING:
        return "free trial"
    return f"{sub.plan.name} plan" if sub.plan else "subscription"


@shared_task
def check_subscription_expiry():
    now = timezone.now()
    today = timezone.localdate()
    stats = {"reminders": 0, "suspended": 0}

    subs = Subscription.objects.filter(
        is_current=True,
        status__in=[Subscription.Status.ACTIVE, Subscription.Status.TRIALING],
        current_period_end__isnull=False,
    ).select_related("shop", "plan")

    for sub in subs:
        shop = sub.shop
        end = sub.current_period_end
        days_left = (end.date() - today).days
        label = _plan_label(sub)

        # --- Expired → auto-suspend ---------------------------------------
        if days_left <= 0:
            sub.status = Subscription.Status.EXPIRED
            sub.save(update_fields=["status"])
            if shop.is_active:
                shop.is_active = False
                shop.suspended_at = now
                shop.save(update_fields=["is_active", "suspended_at"])
            notify(
                shop=shop, type=NotificationType.SUBSCRIPTION,
                title="Subscription expired — access suspended",
                message=(
                    f"Your {label} has expired and access is now suspended.\n"
                    f"Please renew to restore access to your shop."
                ),
                email=True,
            )
            stats["suspended"] += 1
            continue

        # --- Pre-expiry reminders (5/3/2/1) -------------------------------
        if not shop.is_active:
            continue
        reminded = list(sub.reminded_days or [])
        if days_left in REMINDER_DAYS and days_left not in reminded:
            notify(
                shop=shop, type=NotificationType.SUBSCRIPTION,
                title=f"Your {label} expires in {days_left} day{'s' if days_left != 1 else ''}",
                message=(
                    f"Your {label} will expire on {end:%d %b %Y} "
                    f"({days_left} day{'s' if days_left != 1 else ''} left).\n"
                    f"Please renew before then to avoid interruption."
                ),
                email=True,
            )
            reminded.append(days_left)
            sub.reminded_days = reminded
            sub.save(update_fields=["reminded_days"])
            stats["reminders"] += 1

    return stats
