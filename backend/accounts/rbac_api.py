"""
RBAC management API for Shop Owners (8.2).

Owners can view the permission catalog and edit which permissions each of their
shop's roles holds. Any change is audited. Non-owners are blocked by the
``manage_users`` permission.
"""
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from audit.models import AuditLog
from audit.services import record
from core.permissions import HasPermCode, IsTenantMember
from core.tenant_context import set_current_tenant

from .models import Permission, Role


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ["id", "code", "name", "category", "description"]


class RoleSerializer(serializers.ModelSerializer):
    permission_codes = serializers.SlugRelatedField(
        source="permissions", slug_field="code", many=True, read_only=True
    )

    class Meta:
        model = Role
        fields = ["id", "role_type", "name", "is_system", "permission_codes"]
        read_only_fields = ["role_type", "is_system"]


class _OwnerScoped:
    def initial(self, request, *args, **kwargs):
        set_current_tenant(getattr(request.user, "shop", None))
        request.tenant = getattr(request.user, "shop", None)
        super().initial(request, *args, **kwargs)


class PermissionCatalogView(_OwnerScoped, APIView):
    permission_classes = [IsTenantMember, HasPermCode]
    required_perm = "manage_users"

    def get(self, request):
        return Response(PermissionSerializer(Permission.objects.all(), many=True).data)


class MyPermissionsView(APIView):
    """Effective permission codes for the current user (drives UI hiding)."""

    permission_classes = [IsTenantMember]

    def get(self, request):
        user = request.user
        if user.role == "owner":
            codes = list(Permission.objects.values_list("code", flat=True))
        else:
            codes = list(
                Role.objects.filter(shop_id=user.shop_id, role_type=user.role)
                .values_list("permissions__code", flat=True)
            )
        return Response({"role": user.role, "permissions": [c for c in codes if c]})


class RoleViewSet(_OwnerScoped, viewsets.ModelViewSet):
    """Owner-managed role permission matrix, scoped to the owner's shop."""

    serializer_class = RoleSerializer
    permission_classes = [IsTenantMember, HasPermCode]
    required_perm = "manage_users"
    http_method_names = ["get", "post"]  # edit perms via set_permissions action

    def get_queryset(self):
        return (
            Role.objects.filter(shop_id=self.request.user.shop_id)
            .order_by("role_type")
            .prefetch_related("permissions")
        )

    @action(detail=True, methods=["post"])
    def set_permissions(self, request, pk=None):
        """Body: {"codes": ["view_sales", "create_sale", ...]}."""
        role = self.get_object()
        codes = request.data.get("codes", [])
        perms = list(Permission.objects.filter(code__in=codes))
        role.permissions.set(perms)
        record(
            action=AuditLog.Action.PERMISSION_CHANGE, actor=request.user,
            shop=request.user.shop, target=role,
            description=f"Set {role.role_type} permissions",
            changes={"codes": codes},
        )
        return Response(RoleSerializer(role).data)


from django.contrib.auth import get_user_model
User = get_user_model()
from .serializers import ShopUserSerializer

class ShopUserViewSet(_OwnerScoped, viewsets.ModelViewSet):
    """Owner-managed staff users, scoped to the owner's shop."""

    serializer_class = ShopUserSerializer
    permission_classes = [IsTenantMember, HasPermCode]
    required_perm = "manage_users"

    def get_queryset(self):
        return (
            User.objects.filter(shop_id=self.request.user.shop_id)
            .select_related("branch")
            .order_by("-is_active", "first_name", "email")
        )

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError
        shop = self.request.user.shop
        # 1. Enforce Subscription Plan max_users limit
        current_count = User.objects.filter(shop=shop).count()
        max_users = 2
        if hasattr(shop, "subscription") and shop.subscription and shop.subscription.plan:
            max_users = shop.subscription.plan.max_users or 2
        elif hasattr(shop, "is_free") and shop.is_free:
            max_users = 1000

        if current_count >= max_users:
            raise ValidationError(
                f"Your subscription plan allows a maximum of {max_users} user(s) (current: {current_count}). Please upgrade your plan to add more staff."
            )

        user = serializer.save(shop_id=self.request.user.shop_id)
        record(
            action=AuditLog.Action.CREATE,
            actor=self.request.user,
            shop=self.request.user.shop,
            target=user,
            description=f"Staff user '{user.email}' created with role '{user.role}' by owner",
            changes={"role": user.role, "branch_id": user.branch_id},
        )

    def perform_update(self, serializer):
        from rest_framework.exceptions import ValidationError
        from .models import RoleType
        target_user = self.get_object()
        actor = self.request.user

        # 2. Prevent Owner Self-Deactivation / Lockout
        if target_user.id == actor.id and "is_active" in serializer.validated_data and not serializer.validated_data["is_active"]:
            raise ValidationError("You cannot deactivate your own account.")

        if target_user.role == RoleType.OWNER and "is_active" in serializer.validated_data and not serializer.validated_data["is_active"]:
            raise ValidationError("The shop owner account cannot be deactivated.")

        # 3. Prevent Changing Owner's Role or Elevating Staff to Owner
        if target_user.role == RoleType.OWNER and "role" in serializer.validated_data and serializer.validated_data["role"] != RoleType.OWNER:
            raise ValidationError("Cannot change the shop owner's role.")

        if target_user.role != RoleType.OWNER and "role" in serializer.validated_data and serializer.validated_data["role"] == RoleType.OWNER:
            raise ValidationError("Cannot promote a staff user to Owner.")

        old_active = target_user.is_active
        old_role = target_user.role
        old_branch = target_user.branch_id

        updated = serializer.save()

        changes = {}
        if old_active != updated.is_active:
            changes["is_active"] = {"from": old_active, "to": updated.is_active}
        if old_role != updated.role:
            changes["role"] = {"from": old_role, "to": updated.role}
        if old_branch != updated.branch_id:
            changes["branch_id"] = {"from": old_branch, "to": updated.branch_id}

        if changes:
            record(
                action=AuditLog.Action.UPDATE,
                actor=actor,
                shop=actor.shop,
                target=updated,
                description=f"Staff user '{updated.email}' updated by owner",
                changes=changes,
            )

    def destroy(self, request, *args, **kwargs):
        from rest_framework import status
        from .models import RoleType
        user = self.get_object()
        if user.id == request.user.id:
            return Response({"detail": "You can't delete your own account."},
                            status=status.HTTP_400_BAD_REQUEST)
        if user.role == RoleType.OWNER:
            return Response({"detail": "The shop owner can't be deleted."},
                            status=status.HTTP_400_BAD_REQUEST)
        email = user.email
        record(action=AuditLog.Action.DELETE, actor=request.user,
               shop=request.user.shop, target=user,
               description=f"Staff user '{email}' deleted by owner")
        user.delete()
        return Response({"status": "deleted", "email": email}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def reset_password(self, request, pk=None):
        """Owner-initiated password reset for a staff user."""
        from rest_framework import status
        from .models import RoleType
        user = self.get_object()
        if user.id == request.user.id:
            return Response(
                {"detail": "To change your own password, please use Account Profile settings."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user.role == RoleType.OWNER:
            return Response(
                {"detail": "Cannot reset the shop owner's password via this endpoint."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        import secrets
        import string
        alphabet = string.ascii_letters + string.digits + "@#$%"
        req_data = getattr(request, "data", None) or {}
        new_pass = req_data.get("password") or "".join(secrets.choice(alphabet) for _ in range(10))
        user.set_password(new_pass)
        user.save(update_fields=["password"])

        record(
            action=AuditLog.Action.UPDATE,
            actor=request.user,
            shop=request.user.shop,
            target=user,
            description=f"Password for staff user '{user.email}' was reset by owner",
        )

        return Response({
            "status": "ok",
            "message": f"Password for {user.email} has been reset.",
            "temporary_password": new_pass,
        }, status=status.HTTP_200_OK)
