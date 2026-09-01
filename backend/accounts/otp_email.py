"""Shared OTP email delivery (mirrors the public signup OTP, incl. the
platform's own SMTP settings from PlatformConfig with robust fallback)."""
from django.conf import settings
from django.core.mail import get_connection, send_mail


def get_platform_smtp_connection():
    from platform_admin.models import PlatformConfig

    config = PlatformConfig.get_solo()

    # Priority: 1) PlatformConfig from DB, 2) Built-in Docker mailserver defaults
    host = config.smtp_host or "mailserver"
    port = config.smtp_port or 587
    user = config.smtp_user or "noreply@stockwhisk.com"
    pwd = config.smtp_password or "imontouhid4992"
    tls = config.smtp_use_tls if config.smtp_use_tls is not None else True
    from_email = config.smtp_default_from or user or "noreply@stockwhisk.com"

    connection = get_connection(
        backend="platform_admin.email_backend.UnverifiedSTARTTLSBackend",
        host=host,
        port=port,
        username=user,
        password=pwd,
        use_tls=tls,
    )
    return connection, from_email


def send_otp_email(email, otp, *, subject="Your StockWhisk Verification Code",
                   intro="Welcome to StockWhisk!", expires_mins=10):
    connection, from_email = get_platform_smtp_connection()

    send_mail(
        subject=subject,
        message=f"{intro}\n\nYour verification code is: {otp}\n\nThis code expires in {expires_mins} minutes.",
        from_email=from_email,
        recipient_list=[email],
        fail_silently=False,
        connection=connection,
    )
