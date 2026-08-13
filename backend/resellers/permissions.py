from rest_framework.permissions import BasePermission


class IsReseller(BasePermission):
    """Authenticated user with an ACTIVE reseller profile. Resellers are never
    shop members, so this is the only gate for the read-only partner portal."""

    message = "Active reseller access required."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        profile = getattr(user, "reseller_profile", None)
        return profile is not None and profile.status == profile.Status.ACTIVE
