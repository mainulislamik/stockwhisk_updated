"""
Online-presence tracking.

Bumps ``User.last_seen`` on each authenticated request so the super-admin
active-users table can show a live "online now" green dot. Throttled via the
cache to at most one DB write per ``BUMP_EVERY_SECONDS`` per user, so it costs
essentially nothing on hot paths.

Why ``process_response`` and not ``process_request``: the tenant SPA authenticates
with JWT (Bearer token), which DRF resolves inside the view — not in Django's
session-based ``AuthenticationMiddleware``. At request time ``request.user`` is
still AnonymousUser for those calls. By response time DRF has authenticated and
synced the user onto the underlying request, so we can read it reliably here.
"""
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils import timezone
from django.utils.deprecation import MiddlewareMixin

BUMP_EVERY_SECONDS = 60


class LastSeenMiddleware(MiddlewareMixin):
    def process_response(self, request, response):
        user = getattr(request, "user", None)
        if user is None or not getattr(user, "is_authenticated", False) or not hasattr(user, "pk"):
            return response

        cache_key = f"last_seen_bump:{user.pk}"
        if cache.get(cache_key):
            return response

        # Update only this column; avoid touching the rest of the row.
        get_user_model().objects.filter(pk=user.pk).update(last_seen=timezone.now())
        cache.set(cache_key, 1, BUMP_EVERY_SECONDS)
        return response


class DemoReadOnlyMiddleware:
    """Make demo-shop users strictly read-only.

    The demo shop lets anyone browse the full owner interface without touching
    real data. We resolve the JWT here (DRF hasn't authenticated yet at request
    time) and reject any state-changing request from a demo user with 403, so
    the guard covers every API view regardless of its own permissions.
    """

    SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}
    # Auth flows the demo user still needs (login / refresh / logout).
    ALLOWED_UNSAFE = ("/api/auth/token", "/api/auth/logout", "/api/auth/token/refresh")

    def __init__(self, get_response):
        self.get_response = get_response
        from rest_framework_simplejwt.authentication import JWTAuthentication
        self._jwt = JWTAuthentication()

    def __call__(self, request):
        if (
            request.method not in self.SAFE_METHODS
            and request.path.startswith("/api/")
            and not any(request.path.startswith(p) for p in self.ALLOWED_UNSAFE)
        ):
            user = self._resolve_user(request)
            shop = getattr(user, "shop", None) if user else None
            if shop is not None and getattr(shop, "is_demo", False):
                from django.http import JsonResponse
                return JsonResponse(
                    {"detail": "This is a read-only demo — changes are disabled."},
                    status=403,
                )
        return self.get_response(request)

    def _resolve_user(self, request):
        try:
            result = self._jwt.authenticate(request)
            return result[0] if result else None
        except Exception:
            return None
