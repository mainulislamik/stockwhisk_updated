"""
Integration Multi-Tenant Authorization & RBAC Permissions.

Defines fine-grained permission classes for integrations:
1. IsActiveTenant: Rejects requests from inactive or suspended shops.
2. CanViewIntegrations: Read access (Owner, Manager, Inventory Manager).
3. CanManageIntegrations: Write access (create/update/delete channel).
4. CanManageIntegrationCredentials: High-privilege access (rotate/set secrets; Owner-only by default).
5. IsIntegrationTenantOwner: Object-level check verifying obj.shop_id matches the active user's shop.
"""
from rest_framework.permissions import SAFE_METHODS, BasePermission

from accounts.models import RoleType
from core.permissions import log_permission_denied


class IsActiveTenant(BasePermission):
    """Rejects requests if the tenant shop is deactivated or suspended."""

    message = "Your shop account is currently inactive or suspended. Integration access is locked."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        shop = getattr(user, "shop", None)
        if not shop:
            return False
        return bool(shop.is_active and not getattr(shop, "suspended_at", None))


class CanViewIntegrations(BasePermission):
    """
    Controls read access to integrations.
    Allowed for: Owner, Manager, Inventory Manager, or users with 'view_integrations' perm.
    Disallowed for: Cashier, Accountant (unless explicitly granted).
    """

    message = "You do not have permission to view integrations."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated or not getattr(user, "shop_id", None):
            return False
        # Water-tight modular entitlement check
        shop = getattr(user, "shop", None)
        if shop:
            from tenants.modules import is_module_enabled
            if not is_module_enabled(shop, "integrations"):
                self.message = "The 'integrations' module is disabled for your shop. Please upgrade your subscription."
                return False
        if user.role in (RoleType.OWNER, RoleType.MANAGER, RoleType.INVENTORY_MANAGER):
            return True
        return user.has_perm_code("view_integrations")


class CanManageIntegrations(BasePermission):
    """
    Controls creation, editing, and lifecycle management of integrations.
    Allowed for: Owner, Manager, or users with 'manage_integrations' perm.
    """

    message = "You do not have permission to configure or modify integrations."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated or not getattr(user, "shop_id", None):
            return False
        if request.method in SAFE_METHODS:
            return True  # Read permissions handled by CanViewIntegrations
        if user.role in (RoleType.OWNER, RoleType.MANAGER):
            return True
        allowed = user.has_perm_code("manage_integrations")
        if not allowed:
            log_permission_denied(request, "manage_integrations", view.__class__.__name__)
        return allowed


class CanManageIntegrationCredentials(BasePermission):
    """
    Controls rotating or setting API keys, secrets, tokens, or webhook secrets.
    Strictly restricted to OWNER or users with 'manage_integration_credentials' permission.
    Managers, Cashiers, Accountants are strictly blocked.
    """

    message = "Only the shop owner or authorized administrators can view or update integration credentials."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated or not getattr(user, "shop_id", None):
            return False
        if user.role == RoleType.OWNER or user.is_platform_staff:
            return True
        allowed = user.has_perm_code("manage_integration_credentials")
        if not allowed:
            log_permission_denied(request, "manage_integration_credentials", view.__class__.__name__)
        return allowed


class IsIntegrationTenantOwner(BasePermission):
    """
    Object-level permission enforcing tenant ownership.
    Ensures that an object (Integration, SyncJob, IntegrationEvent, etc.) belongs to the user's active shop.
    """

    message = "Resource not found or belongs to a different shop."

    def has_object_permission(self, request, view, obj):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated or not getattr(user, "shop_id", None):
            return False
        obj_shop_id = getattr(obj, "shop_id", None)
        if obj_shop_id is None and hasattr(obj, "integration"):
            obj_shop_id = getattr(obj.integration, "shop_id", None)
        return obj_shop_id == user.shop_id
