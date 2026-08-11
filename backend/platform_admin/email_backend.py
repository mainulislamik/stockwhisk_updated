import ssl

from django.core.mail.backends.smtp import EmailBackend as _SMTPEmailBackend


class UnverifiedSTARTTLSBackend(_SMTPEmailBackend):
    """SMTP backend that still encrypts (STARTTLS/SSL) but does not verify the
    server certificate.

    We use this for the platform's own mail server, which runs on the internal
    Docker network with a self-signed certificate. Django 5.1+ verifies certs by
    default (via ssl.create_default_context), which rejects self-signed certs.
    The traffic never leaves the host, so skipping verification is safe here.
    """

    @property
    def ssl_context(self):
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        return context
