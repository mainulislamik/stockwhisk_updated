"""
Authentication mechanisms for external integration callers and inbound requests.

Provides:
- IntegrationTokenAuthentication: Bearer-token authentication for integration runners.
- IntegrationWebhookSignatureAuthentication: Signature verification for inbound webhooks.
- Sets thread-local tenant strictly to the integration's owning shop.
"""
import base64
import hashlib
import hmac
from rest_framework import authentication, exceptions

from core.tenant_context import set_current_tenant
from .models import Integration


class IntegrationPrincipal:
    """Lightweight principal representing an authenticated integration channel."""

    is_authenticated = True

    def __init__(self, integration):
        self.integration = integration
        self.shop = integration.shop
        self.shop_id = integration.shop_id

    def __str__(self):
        return f"integration:{self.integration.provider}#{self.integration.id} (shop:{self.shop_id})"


class IntegrationTokenAuthentication(authentication.BaseAuthentication):
    """
    Authenticates an integration runner using an integration access token:
    Authorization: Bearer <access_token>
    Or X-Integration-Token: <token>
    """
    keyword = "Bearer"

    def authenticate(self, request):
        token = request.META.get("HTTP_X_INTEGRATION_TOKEN")
        if not token:
            header = authentication.get_authorization_header(request).decode()
            if header.startswith(self.keyword + " "):
                token = header[len(self.keyword) + 1:].strip()

        if not token:
            return None

        # Look up integration by matching decrypted access_token or api_key
        # We can look up integrations matching the slug in URL if present
        integration_slug = request.resolver_match.kwargs.get("slug") if request.resolver_match else None
        pk = request.resolver_match.kwargs.get("pk") if request.resolver_match else None

        qs = Integration.all_objects.select_related("shop", "credential").filter(is_active=True)
        if integration_slug:
            qs = qs.filter(webhook_slug=integration_slug)
        elif pk:
            qs = qs.filter(pk=pk)

        # Find matching integration
        matched_integration = None
        for item in qs:
            if not hasattr(item, "credential"):
                continue
            creds = item.credential.get_credentials()
            if token in (creds.get("access_token"), creds.get("api_key"), creds.get("webhook_secret")):
                matched_integration = item
                break

        if not matched_integration:
            raise exceptions.AuthenticationFailed("Invalid or expired integration credentials.")

        if not matched_integration.shop.is_active:
            raise exceptions.AuthenticationFailed("Shop is inactive or suspended.")

        # Bind tenant context strictly to this integration's owning shop
        request.tenant = matched_integration.shop
        set_current_tenant(matched_integration.shop)

        return (IntegrationPrincipal(matched_integration), matched_integration)


def verify_hmac_sha256(raw_body: bytes, secret: str, signature: str) -> bool:
    """
    Verify HMAC-SHA256 signature against raw body bytes.
    Handles hex or base64 encoded signatures.
    """
    if not secret or not signature:
        return False

    computed = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).digest()
    computed_hex = computed.hex()
    computed_b64 = base64.b64encode(computed).decode("utf-8")

    return hmac.compare_digest(signature, computed_hex) or hmac.compare_digest(signature, computed_b64)
