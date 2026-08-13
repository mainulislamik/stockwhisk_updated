"""DRF permission classes for tenant membership and RBAC."""
from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsTenantMember(BasePermission):
    """Authenticated user that belongs to a shop (i.e. a real tenant user)."""

    message = "You must belong to a shop to access this resource."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.shop_id is not None)


class IsPlatformStaff(BasePermission):
    """Platform super-admin (staff user with no shop)."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_staff)


# Codes whose denial is always security-relevant and thus audited.
SENSITIVE_PERMS = {"delete_sale", "view_profit", "manage_users", "manage_expenses"}


def log_permission_denied(request, code, view_name=""):
    """Write a permission-denied entry to the audit log (best-effort)."""
    from audit.models import AuditLog
    from audit.services import record

    user = getattr(request, "user", None)
    record(
        action=AuditLog.Action.PERMISSION_CHANGE,
        actor=user if getattr(user, "is_authenticated", False) else None,
        shop=getattr(user, "shop", None),
        target_model="Permission", target_id=code,
        description=f"Denied '{code}' on {view_name}",
        metadata={"path": request.path, "method": request.method},
    )


class HasPermCode(BasePermission):
    """
    Checks a feature-level RBAC code declared on the view as ``required_perm``.

    Read/write split (optional): a view may also declare ``required_write_perm``.
    When it does, safe methods (GET/HEAD/OPTIONS) require the *read* code
    (``required_perm``) OR the write code — so a manage-level permission always
    implies read — while unsafe methods (POST/PUT/PATCH/DELETE) require the
    *write* code. Views that declare only ``required_perm`` behave exactly as
    before (that code gates every method).

    Owners/platform staff pass automatically (handled in ``User.has_perm_code``).
    Denials of sensitive permissions are audited.
    """

    def has_permission(self, request, view):
        read_code = getattr(view, "required_perm", None)
        write_code = getattr(view, "required_write_perm", None)

        # No RBAC declared → allow (other permission classes still apply).
        if read_code is None and write_code is None:
            return True

        user = request.user
        if not (user and user.is_authenticated):
            return False

        if request.method in SAFE_METHODS:
            # Reading: any of the declared codes is sufficient (manage ⇒ view).
            codes = [c for c in (read_code, write_code) if c]
            allowed = any(user.has_perm_code(c) for c in codes)
            denied_code = read_code or write_code
        else:
            # Writing: require the write code (falls back to the single code).
            denied_code = write_code or read_code
            allowed = user.has_perm_code(denied_code)

        if not allowed and (denied_code in SENSITIVE_PERMS or getattr(view, "audit_denials", False)):
            log_permission_denied(request, denied_code, view.__class__.__name__)
        return allowed
