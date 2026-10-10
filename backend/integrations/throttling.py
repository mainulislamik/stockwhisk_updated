"""
Throttling policies for the StockWhisk Integrations Platform.
Defines rate limiting scopes for sensitive operations (credential rotation, sync trigger).
"""
from rest_framework.throttling import SimpleRateThrottle, UserRateThrottle


class IntegrationCredentialThrottle(UserRateThrottle):
    """
    Limits the rate of credential rotation/updates to prevent abuse or brute-force tampering.
    """
    scope = "integration_credentials"


class IntegrationSyncThrottle(SimpleRateThrottle):
    """
    Limits the frequency of on-demand synchronization jobs triggered by users.
    Scoped per shop to prevent hammering external APIs.
    """
    scope = "integration_sync"

    def get_cache_key(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated or not getattr(user, "shop_id", None):
            return None
        return f"throttle_sync_shop_{user.shop_id}"


class IntegrationInboundThrottle(SimpleRateThrottle):
    """
    Limits inbound requests/webhooks per integration endpoint.
    """
    scope = "integration_inbound"

    def get_cache_key(self, request, view):
        # Keyed on endpoint_id, slug, pk, or client IP
        endpoint_id = (
            view.kwargs.get("endpoint_id")
            or view.kwargs.get("slug")
            or view.kwargs.get("pk")
        )
        ip = self.get_ident(request)
        if endpoint_id:
            return f"throttle_inbound_{endpoint_id}_{ip}"
        return f"throttle_inbound_{ip}"
