"""
Subscription feature gating — the single reusable place plan restrictions live.

Use as a DRF permission (``FeatureRequired.as_permission("multi_branch")``) or
as a plain guard (``require_feature(shop, "api_access")``) in service code.
Never scatter ``if shop.plan.tier == ...`` checks through the codebase.
"""
from rest_framework.permissions import BasePermission

from .exceptions import FeatureNotAvailable


def require_feature(shop, flag: str):
    """Raise FeatureNotAvailable if ``shop`` lacks ``flag``. Returns True else."""
    if shop is None or not shop.has_feature(flag):
        raise FeatureNotAvailable(flag)
    return True


class FeatureRequired(BasePermission):
    """
    DRF permission that gates a view behind a plan feature flag.

    Subclass via ``FeatureRequired.as_permission("advanced_analytics")`` or set
    ``feature_flag`` on the view.
    """

    feature_flag: str | None = None
    message = "Your subscription plan does not include this feature."

    @classmethod
    def as_permission(cls, flag: str):
        return type(f"FeatureRequired_{flag}", (cls,), {"feature_flag": flag})

    def has_permission(self, request, view):
        flag = getattr(view, "feature_flag", None) or self.feature_flag
        if flag is None:
            return True
        shop = getattr(request, "tenant", None)
        return bool(shop and shop.has_feature(flag))


# Backward compatibility alias
FeatureGate = FeatureRequired


def require_module(shop, module_key: str):
    """Raise PermissionDenied if shop lacks module_key."""
    from tenants.modules import is_module_enabled
    from rest_framework.exceptions import PermissionDenied
    if not is_module_enabled(shop, module_key):
        raise PermissionDenied(f"Module '{module_key}' is not enabled for your shop.")
    return True


class ModuleRequired(BasePermission):
    """
    DRF permission that gates an entire ViewSet or APIView behind a shop's modular entitlement.
    Example:
        permission_classes = [IsAuthenticated, ModuleRequired.as_permission("manufacturing")]
    """
    module_key: str | None = None
    message = "This module is not enabled for your shop. Please upgrade your subscription."
    code = "MODULE_NOT_ENABLED"

    @classmethod
    def as_permission(cls, module_key: str):
        return type(f"ModuleRequired_{module_key}", (cls,), {"module_key": module_key})

    def has_permission(self, request, view):
        key = getattr(view, "module_key", None) or self.module_key
        if not key:
            return True
        shop = getattr(request, "tenant", None) or getattr(getattr(request, "user", None), "shop", None)
        if not shop:
            return True  # Non-shop users (superadmins, etc.) bypass tenant module gates
        from tenants.modules import is_module_enabled
        keys = [k.strip() for k in key.split(",") if k.strip()]
        return any(is_module_enabled(shop, k) for k in keys)

