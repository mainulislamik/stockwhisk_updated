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


import logging
logger = logging.getLogger(__name__)

@shared_task
def send_daily_shop_reports():
    """
    Automated Daily Night Digest (runs at 23:45 Asia/Dhaka).
    Dispatches business health PDF & HTML email to all active shops from noreply@stockwhisk.com.
    """
    from tenants.models import Shop
    from .services import get_alert_config
    from reports.scheduled_digest import send_shop_digest_email

    sent_count = 0
    for shop in Shop.objects.filter(is_active=True):
        try:
            cfg = get_alert_config(shop)
            if not getattr(cfg, "daily_report_enabled", True):
                continue
            res = send_shop_digest_email(shop, frequency="daily")
            if res.get("success"):
                sent_count += 1
        except Exception:
            logger.exception("Failed sending daily digest for shop %s (%s)", shop.id, shop.name)
    return {"daily_reports_sent": sent_count}


@shared_task
def send_weekly_shop_reports():
    """
    Automated Weekly Digest (runs every Saturday at 08:00 AM Asia/Dhaka).
    """
    from tenants.models import Shop
    from .services import get_alert_config
    from reports.scheduled_digest import send_shop_digest_email

    sent_count = 0
    for shop in Shop.objects.filter(is_active=True):
        try:
            cfg = get_alert_config(shop)
            if not getattr(cfg, "weekly_report_enabled", True):
                continue
            res = send_shop_digest_email(shop, frequency="weekly")
            if res.get("success"):
                sent_count += 1
        except Exception:
            logger.exception("Failed sending weekly digest for shop %s (%s)", shop.id, shop.name)
    return {"weekly_reports_sent": sent_count}


@shared_task
def send_monthly_shop_reports():
    """
    Automated Monthly Statement (runs on 1st of every month at 09:00 AM Asia/Dhaka).
    """
    from tenants.models import Shop
    from .services import get_alert_config
    from reports.scheduled_digest import send_shop_digest_email

    sent_count = 0
    for shop in Shop.objects.filter(is_active=True):
        try:
            cfg = get_alert_config(shop)
            if not getattr(cfg, "monthly_report_enabled", True):
                continue
            res = send_shop_digest_email(shop, frequency="monthly")
            if res.get("success"):
                sent_count += 1
        except Exception:
            logger.exception("Failed sending monthly digest for shop %s (%s)", shop.id, shop.name)
    return {"monthly_reports_sent": sent_count}


@shared_task
def send_daily_night_owner_whatsapp_digest():
    """
    Automated Daily Night WhatsApp Executive Report (runs daily at configured time, e.g. 22:00 BST).
    Dispatches throttled, humanized daily business reports to enabled shop owners.
    """
    from .owner_digest import send_throttled_owner_daily_reports
    return send_throttled_owner_daily_reports()


@shared_task
def send_inactive_onboarding_whatsapp_checkin():
    """
    Automated Inactive Client Onboarding Follow-up (runs daily at 11:30 AM Asia/Dhaka).
    Identifies newly registered shops (Day 1, Day 3, Day 7) that haven't recorded sales yet,
    and sends personalized, helpful support messages offering assistance & live onboarding.
    """
    from tenants.models import Shop
    from sales.models import Sale
    from .owner_digest import build_onboarding_followup_message, resolve_owner_phone
    from .baileys import send_platform_whatsapp_message

    today = timezone.localtime().date()
    sent_count = 0

    for shop in Shop.objects.filter(is_active=True):
        try:
            has_sales = Sale.all_objects.filter(shop=shop).exists()
            if has_sales:
                continue

            days_since_created = (today - shop.created_at.date()).days
            if days_since_created not in (1, 3, 7):
                continue

            owner_phone = resolve_owner_phone(shop)
            if not owner_phone:
                continue

            owner = getattr(shop, "owner", None)
            owner_name = owner.first_name if owner and owner.first_name else ""

            msg_text = build_onboarding_followup_message(owner_name, days_since_created)
            res = send_platform_whatsapp_message(owner_phone, msg_text)
            if res.get("success"):
                sent_count += 1
        except Exception:
            logger.exception("Failed sending onboarding followup for shop %s", shop.id)

    return {"inactive_followups_sent": sent_count}
