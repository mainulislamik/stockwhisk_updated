"""Shared OTP email delivery (mirrors the public signup OTP, incl. the
platform's own SMTP settings from PlatformConfig)."""
from django.conf import settings
from django.core.mail import get_connection, send_mail


def send_otp_email(email, otp, *, subject="Your StockWhisk Verification Code",
                   intro="Welcome to StockWhisk!"):
    from platform_admin.models import PlatformConfig

    config = PlatformConfig.get_solo()
    connection = None
    from_email = settings.DEFAULT_FROM_EMAIL
    if config.smtp_host and config.smtp_user:
        connection = get_connection(
            backend="platform_admin.email_backend.UnverifiedSTARTTLSBackend",
            host=config.smtp_host, port=config.smtp_port,
            username=config.smtp_user, password=config.smtp_password,
            use_tls=config.smtp_use_tls,
        )
        from_email = config.smtp_default_from or settings.DEFAULT_FROM_EMAIL

    send_mail(
        subject=subject,
        message=f"{intro}\n\nYour verification code is: {otp}\n\nThis code expires in 3 minutes.",
        from_email=from_email,
        recipient_list=[email],
        fail_silently=False,
        connection=connection,
    )
