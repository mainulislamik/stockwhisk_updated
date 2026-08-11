"""
Delivery channels. Email uses Django's backend. SMS/WhatsApp are stubbed —
the interface exists so wiring Twilio / Meta WhatsApp later is a drop-in, but
nothing is sent until credentials are configured.
"""
import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection, send_mail

logger = logging.getLogger("notifications")


def _platform_email():
    """Build an (connection, from_email) pair from the platform SMTP settings so
    notification emails go through the same server as OTP/reset mail. Falls back
    to Django's default backend if SMTP isn't configured."""
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@stockwhisk.com")
    try:
        from platform_admin.models import PlatformConfig
        cfg = PlatformConfig.get_solo()
        if cfg.smtp_host and cfg.smtp_user:
            connection = get_connection(
                backend="platform_admin.email_backend.UnverifiedSTARTTLSBackend",
                host=cfg.smtp_host, port=cfg.smtp_port,
                username=cfg.smtp_user, password=cfg.smtp_password,
                use_tls=cfg.smtp_use_tls,
            )
            return connection, (cfg.smtp_default_from or from_email)
    except Exception:
        logger.exception("Failed to build platform SMTP connection; using default backend")
    return None, from_email


def send_email(to, subject, body):
    if not to:
        return False
    connection, from_email = _platform_email()
    try:
        send_mail(subject, body, from_email, [to], fail_silently=True, connection=connection)
        return True
    except Exception:
        logger.exception("send_email failed for %s", to)
        return False


def send_html_email(to, subject, text_body, html_body):
    """Send a multipart (text + HTML) email through the platform SMTP server."""
    if not to:
        return False
    connection, from_email = _platform_email()
    try:
        msg = EmailMultiAlternatives(subject, text_body, from_email, [to], connection=connection)
        msg.attach_alternative(html_body, "text/html")
        msg.send(fail_silently=True)
        return True
    except Exception:
        logger.exception("send_html_email failed for %s", to)
        return False


def send_sms(phone, body):
    """Stub. Wire Twilio here when TWILIO_* settings exist."""
    if not getattr(settings, "TWILIO_ACCOUNT_SID", ""):
        logger.info("SMS (stub) to %s: %s", phone, body)
        return False
    # TODO Phase 3: Twilio client send
    return False


def send_whatsapp(phone, body):
    """Stub. Wire Meta WhatsApp Business API here in Phase 3."""
    if not getattr(settings, "WHATSAPP_TOKEN", ""):
        logger.info("WhatsApp (stub) to %s: %s", phone, body)
        return False
    return False
