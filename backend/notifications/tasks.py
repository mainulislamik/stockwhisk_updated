from datetime import timedelta
from django.utils import timezone
from celery import shared_task

from .models import Notification


@shared_task
def send_notification_digest():
    """
    Daily 10am (Asia/Dhaka) combined summary: one email per shop with the latest
    notification of each type from the last 24h — instead of emailing every alert.
    """
    from accounts.models import RoleType, User
    from tenants.models import Shop

    from .channels import send_html_email
    from .emails import build_digest_email
    from .services import get_alert_config

    since = timezone.now() - timedelta(hours=24)
    sent = 0
    for shop in Shop.objects.filter(is_active=True):
        cfg = get_alert_config(shop)
        if not cfg.email_enabled:
            continue
        notes = list(
            Notification.all_objects.filter(shop_id=shop.id, created_at__gte=since)
            .order_by("-created_at")
        )
        if not notes:
            continue
        # Keep only the newest notification per type (dedupe hourly repeats).
        latest_by_type = {}
        for n in notes:
            latest_by_type.setdefault(n.type, n)
        items = list(latest_by_type.values())

        owners = User.objects.filter(shop_id=shop.id, role=RoleType.OWNER, is_active=True)
        subject, text, html = build_digest_email(shop=shop, items=items, total=len(notes))
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
