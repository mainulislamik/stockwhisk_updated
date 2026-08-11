from datetime import timedelta
from django.utils import timezone
from celery import shared_task

from .models import Notification


@shared_task
def send_notification_digest():
    """
    Daily 10am (Asia/Dhaka) combined summary: one email per shop with a product
    table of current out/low stock plus any other operational alerts from the
    last 24h. Subscription/billing notifications are excluded (they have their
    own transactional emails).
    """
    from accounts.models import RoleType, User
    from analytics.services import low_stock_list, out_of_stock_list
    from tenants.models import Shop

    from .channels import send_html_email
    from .emails import build_digest_email
    from .models import NotificationType
    from .services import get_alert_config

    since = timezone.now() - timedelta(hours=24)
    STOCK_OR_BILLING = [
        NotificationType.LOW_STOCK, NotificationType.OUT_OF_STOCK,
        NotificationType.SUBSCRIPTION, NotificationType.PAYMENT_DUE,
    ]
    sent = 0
    for shop in Shop.objects.filter(is_active=True):
        cfg = get_alert_config(shop)
        if not cfg.email_enabled:
            continue

        out = out_of_stock_list(shop) or []
        low = low_stock_list(shop) or []

        # Other operational alerts (e.g. warranty), newest-per-type, no stock/billing.
        others_qs = (
            Notification.all_objects.filter(shop_id=shop.id, created_at__gte=since)
            .exclude(type__in=STOCK_OR_BILLING).order_by("-created_at")
        )
        seen, others = set(), []
        for n in others_qs:
            if n.type not in seen:
                seen.add(n.type)
                others.append(n)

        if not out and not low and not others:
            continue

        owners = User.objects.filter(shop_id=shop.id, role=RoleType.OWNER, is_active=True)
        subject, text, html = build_digest_email(shop=shop, out=out, low=low, others=others)
        for owner in owners:
            send_html_email(owner.email, subject, text, html)
        sent += 1
    return {"digests_sent": sent}


@shared_task
def delete_old_notifications():
    """
    Delete all notifications older than 7 days to prevent database bloat.
    """
    cutoff_date = timezone.now() - timedelta(days=7)
    deleted, _ = Notification.objects.filter(created_at__lt=cutoff_date).delete()
    return deleted
