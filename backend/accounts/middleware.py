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
        if user is None or not getattr(user, "is_authenticated", False):
            return response

        cache_key = f"last_seen_bump:{user.pk}"
        if cache.get(cache_key):
            return response

        # Update only this column; avoid touching the rest of the row.
        get_user_model().objects.filter(pk=user.pk).update(last_seen=timezone.now())
        cache.set(cache_key, 1, BUMP_EVERY_SECONDS)
        return response
