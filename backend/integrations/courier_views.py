"""
Courier Integration Management Views & Endpoints.

Provides tenant-isolated CRUD, credential configuration, connection testing,
and shipment tracking endpoints for subscribers.
"""
import logging
from decimal import Decimal

logger = logging.getLogger(__name__)

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsTenantMember
from core.tenant_context import set_current_tenant
from .couriers import (
    get_courier_adapter,
    create_shipment as create_courier_shipment,
    track_and_sync_shipment,
    cancel_shipment as cancel_courier_shipment,
    ShipmentRequestDTO,
)
from .models import (
    CourierAccount,
    CourierCredential,
    CourierShipment,
    IntegrationAuditLog,
    IntegrationLog,
)
from .audit import record_integration_audit
from .permissions import (
    CanManageIntegrationCredentials,
    CanManageIntegrations,
    CanViewIntegrations,
    IsActiveTenant,
    IsIntegrationTenantOwner,
)
from .serializers import (
    CourierAccountCreateUpdateSerializer,
    CourierAccountSerializer,
    CourierShipmentSerializer,
)
from .validators import validate_tenant_boundary


class CourierAccountViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for tenant-owned courier accounts.
    Allows subscribers to connect, test, configure, and monitor courier integrations.
    """
    permission_classes = [
        IsAuthenticated,
        IsTenantMember,
        IsActiveTenant,
        CanViewIntegrations,
        IsIntegrationTenantOwner,
    ]

    def get_permissions(self):
        base_perms = [
            IsAuthenticated(),
            IsTenantMember(),
            IsActiveTenant(),
            IsIntegrationTenantOwner(),
        ]
        if self.action in ("create", "update", "partial_update", "destroy", "toggle_active", "validate_credentials"):
            return [*base_perms, CanManageIntegrations()]
        return [*base_perms, CanViewIntegrations()]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        shop = getattr(request, "shop", None) or getattr(getattr(request, "user", None), "shop", None)
        if shop:
            set_current_tenant(shop)

    def get_queryset(self):
        shop = getattr(self.request, "shop", None) or getattr(getattr(self.request, "user", None), "shop", None)
        if not shop:
            return CourierAccount.all_objects.none()
        return (
            CourierAccount.all_objects.filter(shop=shop)
            .select_related("credential")
            .order_by("-is_default", "-created_at")
        )

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return CourierAccountCreateUpdateSerializer
        return CourierAccountSerializer

    def _extract_credentials(self, validated_data):
        creds = {}
        for key in ["api_key", "api_secret", "access_token", "webhook_secret"]:
            if key in validated_data:
                creds[key] = validated_data.pop(key)

        extra = dict(validated_data.pop("extra", {}) or {})
        for extra_key in ["client_id", "client_secret", "username", "password", "store_id"]:
            if extra_key in validated_data:
                val = validated_data.pop(extra_key)
                if val:
                    extra[extra_key] = val
        if extra:
            creds["extra"] = extra
        return creds

    def perform_create(self, serializer):
        shop = self.request.user.shop
        validate_tenant_boundary(shop=shop)

        # Handle is_default logic: if setting this one default, unset others
        is_default = serializer.validated_data.get("is_default", False)
        if is_default:
            CourierAccount.all_objects.filter(shop=shop, is_default=True).update(is_default=False)

        creds = self._extract_credentials(serializer.validated_data)
        account = serializer.save(shop=shop)

        if creds:
            credential, _ = CourierCredential.all_objects.get_or_create(account=account, shop=shop)
            credential.set_credentials(
                api_key=creds.get("api_key", ""),
                api_secret=creds.get("api_secret", ""),
                access_token=creds.get("access_token", ""),
                webhook_secret=creds.get("webhook_secret", ""),
                extra=creds.get("extra", None),
            )
            credential.save()

        IntegrationLog.all_objects.create(
            shop=shop,
            level=IntegrationLog.LogLevel.INFO,
            action="courier_account_created",
            message=f"Courier account '{account.name}' ({account.get_provider_display()}) connected.",
            details={"account_id": account.id, "provider": account.provider},
        )
        record_integration_audit(
            shop=shop,
            action=str(IntegrationAuditLog.Action.INTEGRATION_CONNECTED),
            courier_account=account,
            event_type="courier.connected",
            internal_id=str(account.id),
            status="success",
            description=f"Courier account '{account.name}' ({account.get_provider_display()}) connected.",
            details={"provider": account.provider, "name": account.name},
        )

    def perform_update(self, serializer):
        shop = self.request.user.shop
        validate_tenant_boundary(shop=shop)

        is_default = serializer.validated_data.get("is_default", False)
        if is_default:
            CourierAccount.all_objects.filter(shop=shop, is_default=True).exclude(pk=serializer.instance.pk).update(is_default=False)

        creds = self._extract_credentials(serializer.validated_data)
        account = serializer.save()

        if creds:
            credential, _ = CourierCredential.all_objects.get_or_create(account=account, shop=shop)
            credential.set_credentials(
                api_key=creds.get("api_key", ""),
                api_secret=creds.get("api_secret", ""),
                access_token=creds.get("access_token", ""),
                webhook_secret=creds.get("webhook_secret", ""),
                extra=creds.get("extra", None),
            )
            credential.save()

        IntegrationLog.all_objects.create(
            shop=shop,
            level=IntegrationLog.LogLevel.INFO,
            action="courier_account_updated",
            message=f"Courier account '{account.name}' settings updated.",
            details={"account_id": account.id, "provider": account.provider},
        )
        if creds:
            record_integration_audit(
                shop=shop,
                action=str(IntegrationAuditLog.Action.CREDENTIALS_CHANGED),
                courier_account=account,
                event_type="courier.credentials_updated",
                internal_id=str(account.id),
                status="success",
                description=f"Courier account '{account.name}' credentials updated.",
                changes={"credentials": ["[REDACTED]", "[ROTATED]"]},
            )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        out_serializer = CourierAccountSerializer(serializer.instance)
        return Response(out_serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        out_serializer = CourierAccountSerializer(instance)
        return Response(out_serializer.data)

    @action(detail=True, methods=["post"], url_path="validate-credentials")
    def validate_credentials(self, request, pk=None):
        """
        Validate courier credentials against provider API without leaking secrets.
        """
        account = self.get_object()
        try:
            adapter = get_courier_adapter(account)
            is_valid = adapter.validate_credentials()
            if is_valid:
                IntegrationLog.all_objects.create(
                    shop=account.shop,
                    level=IntegrationLog.LogLevel.INFO,
                    action="courier_credentials_validated",
                    message=f"Courier credentials for '{account.name}' validated successfully.",
                )
                return Response({
                    "success": True,
                    "message": f"Credentials validated successfully. Authenticated with {account.get_provider_display()}."
                })
            else:
                return Response({
                    "success": False,
                    "message": f"Authentication failed with {account.get_provider_display()}. Please check credentials."
                }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({
                "success": False,
                "message": f"Validation error: {str(exc)}"
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="toggle-active")
    def toggle_active(self, request, pk=None):
        """Connect / Disconnect courier account."""
        account = self.get_object()
        account.is_active = not account.is_active
        account.save(update_fields=["is_active", "updated_at"])
        action_name = "activated" if account.is_active else "deactivated"
        IntegrationLog.all_objects.create(
            shop=account.shop,
            level=IntegrationLog.LogLevel.INFO,
            action=f"courier_account_{action_name}",
            message=f"Courier account '{account.name}' was {action_name}.",
        )
        record_integration_audit(
            shop=account.shop,
            action=str(IntegrationAuditLog.Action.INTEGRATION_CONNECTED if account.is_active else IntegrationAuditLog.Action.INTEGRATION_DISCONNECTED),
            courier_account=account,
            event_type=f"courier.{action_name}",
            internal_id=str(account.id),
            status="success",
            description=f"Courier account '{account.name}' was {action_name}.",
            details={"is_active": account.is_active},
        )
        return Response(CourierAccountSerializer(account).data)

    @action(detail=True, methods=["get"], url_path="shipments")
    def list_shipments(self, request, pk=None):
        """List shipments created through this courier account."""
        account = self.get_object()
        shipments = CourierShipment.all_objects.filter(account=account).order_by("-created_at")[:50]
        return Response(CourierShipmentSerializer(shipments, many=True).data)

    @action(detail=True, methods=["get"], url_path="failures")
    def list_failures(self, request, pk=None):
        """List failed/cancelled shipments for this courier account."""
        account = self.get_object()
        failed_shipments = CourierShipment.all_objects.filter(
            account=account,
            status__in=[CourierShipment.ShipmentStatus.DELIVERY_FAILED, CourierShipment.ShipmentStatus.CANCELLED],
        ).order_by("-created_at")[:50]
        return Response(CourierShipmentSerializer(failed_shipments, many=True).data)


class CourierShipmentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only viewset for subscribers to inspect and monitor courier shipments.
    """
    permission_classes = [IsAuthenticated, IsTenantMember, IsActiveTenant, CanViewIntegrations]
    serializer_class = CourierShipmentSerializer

    def get_queryset(self):
        shop = getattr(self.request, "shop", None) or getattr(getattr(self.request, "user", None), "shop", None)
        if not shop:
            return CourierShipment.all_objects.none()

        qs = CourierShipment.all_objects.filter(shop=shop).select_related("account", "sale", "external_order")

        # Optional filters
        account_id = self.request.query_params.get("account_id")
        if account_id:
            qs = qs.filter(account_id=account_id)

        shipment_status = self.request.query_params.get("status")
        if shipment_status:
            qs = qs.filter(status=shipment_status)

        tracking_id = self.request.query_params.get("tracking_id")
        if tracking_id:
            qs = qs.filter(tracking_id__icontains=tracking_id)

        return qs.order_by("-created_at")

    @action(detail=False, methods=["post"], url_path="book")
    def book_shipment(self, request):
        """
        Book a new shipment with a courier account.
        """
        shop = getattr(self.request, "shop", None) or getattr(getattr(self.request, "user", None), "shop", None)
        if not shop:
            return Response({"detail": "Active tenant shop context required."}, status=status.HTTP_400_BAD_REQUEST)

        account_id = request.data.get("account_id")
        if not account_id:
            return Response({"detail": "account_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        account = CourierAccount.all_objects.filter(shop=shop, id=account_id).first()
        if not account:
            return Response({"detail": "Courier account not found."}, status=status.HTTP_404_NOT_FOUND)

        recipient_name = request.data.get("recipient_name")
        recipient_phone = request.data.get("recipient_phone")
        recipient_address = request.data.get("recipient_address")

        if not recipient_name or not recipient_phone or not recipient_address:
            return Response(
                {"detail": "recipient_name, recipient_phone, and recipient_address are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cod_amount = Decimal(str(request.data.get("cod_amount") or "0.00"))
        weight_kg = Decimal(str(request.data.get("weight_kg") or "0.50"))

        sale_id = request.data.get("sale_id")
        sale = None
        if sale_id:
            from sales.models import Sale
            sale = Sale.all_objects.filter(shop=shop, id=sale_id).first()

        req_dto = ShipmentRequestDTO(
            recipient_name=str(recipient_name),
            recipient_phone=str(recipient_phone),
            recipient_address=str(recipient_address),
            recipient_city=str(request.data.get("recipient_city") or ""),
            recipient_zone=str(request.data.get("recipient_zone") or ""),
            recipient_area=str(request.data.get("recipient_area") or ""),
            cod_amount=cod_amount,
            weight_kg=weight_kg,
            item_description=str(request.data.get("item_description") or "Goods"),
            special_instruction=str(request.data.get("special_instruction") or ""),
            pickup_store_id=str(request.data.get("pickup_store_id") or ""),
            sale_id=sale.id if sale else None,
            metadata=request.data.get("metadata") or {},
        )

        try:
            shipment = create_courier_shipment(account=account, request=req_dto, sale=sale)
            return Response(CourierShipmentSerializer(shipment).data, status=status.HTTP_201_CREATED)
        except Exception as exc:
            logger.exception("Failed to book shipment")
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="track")
    def track_shipment(self, request, pk=None):
        shipment = self.get_object()
        try:
            track_and_sync_shipment(shipment)
            shipment.refresh_from_db()
            return Response(CourierShipmentSerializer(shipment).data)
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel_shipment(self, request, pk=None):
        shipment = self.get_object()
        reason = request.data.get("reason", "Cancelled by merchant")
        try:
            cancel_courier_shipment(shipment, reason=reason)
            shipment.refresh_from_db()
            return Response(CourierShipmentSerializer(shipment).data)
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
