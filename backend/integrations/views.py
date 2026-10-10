"""
Integration Management Views & Endpoints.

Provides tenant-scoped CRUD and lifecycle endpoints for integrations.
Adheres strictly to core.permissions and tenant isolation.
"""
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsTenantMember
from core.tenant_context import set_current_tenant
from .models import (
    CourierAccount,
    CourierShipment,
    Integration,
    IntegrationEvent,
    IntegrationLog,
    ProductChannelMapping,
    SyncJob,
)
from .permissions import (
    CanManageIntegrationCredentials,
    CanManageIntegrations,
    CanViewIntegrations,
    IsActiveTenant,
    IsIntegrationTenantOwner,
)
from .serializers import (
    CourierAccountSerializer,
    CourierShipmentSerializer,
    IntegrationCreateSerializer,
    IntegrationCredentialUpdateSerializer,
    IntegrationEventSerializer,
    IntegrationLogSerializer,
    IntegrationSerializer,
    SyncJobSerializer,
)
from .services import (
    change_status,
    create_integration,
    update_credentials,
    update_integration,
)
from .throttling import IntegrationCredentialThrottle, IntegrationSyncThrottle
from .validators import validate_tenant_boundary


class IntegrationViewSet(viewsets.ModelViewSet):
    """
    CRUD viewset for managing shop integrations.
    Requires authenticated user with shop-level access and appropriate RBAC permissions.
    """
    permission_classes = [IsAuthenticated, IsTenantMember, IsActiveTenant, CanViewIntegrations, IsIntegrationTenantOwner]
    serializer_class = IntegrationSerializer

    def get_permissions(self):
        """
        Dynamically apply strict permission rules per action:
        - update-credentials requires CanManageIntegrationCredentials (Owner-only).
        - create/update/destroy/change-status requires CanManageIntegrations.
        - list/retrieve/logs/sync-jobs/events requires CanViewIntegrations.
        """
        base_perms = [IsAuthenticated(), IsTenantMember(), IsActiveTenant(), IsIntegrationTenantOwner()]
        if self.action in ("set_credentials",):
            return [*base_perms, CanManageIntegrationCredentials()]
        if self.action in (
            "create",
            "update",
            "partial_update",
            "destroy",
            "update_lifecycle_status",
            "validate_connection",
            "disconnect",
            "retry_failures",
        ):
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
            return Integration.all_objects.none()
        return (
            Integration.all_objects.filter(shop=shop)
            .select_related("credential")
            .prefetch_related("logs")
            .all()
        )

    def create(self, request, *args, **kwargs):
        serializer = IntegrationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        credentials = {}
        for k in ["api_key", "api_secret", "access_token", "webhook_secret", "extra"]:
            if k in data:
                credentials[k] = data[k]

        shop = getattr(request, "shop", None) or request.user.shop
        integration = create_integration(
            shop=shop,
            name=data["name"],
            category=data["category"],
            provider=data["provider"],
            base_url=data.get("base_url", ""),
            config=data.get("config", {}),
            credentials=credentials if credentials else None,
            created_by=request.user,
        )

        output_serializer = IntegrationSerializer(integration)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        integration = self.get_object()
        name = request.data.get("name")
        base_url = request.data.get("base_url")
        is_active = request.data.get("is_active")
        config = request.data.get("config")

        integration = update_integration(
            integration=integration,
            name=name,
            base_url=base_url,
            is_active=is_active,
            config=config,
            actor=request.user,
        )
        return Response(IntegrationSerializer(integration).data)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="update-credentials", throttle_classes=[IntegrationCredentialThrottle])
    def set_credentials(self, request, pk=None):
        """Rotate or set encrypted credentials for an integration."""
        integration = self.get_object()
        validate_tenant_boundary(shop=request.user.shop, integration=integration)
        serializer = IntegrationCredentialUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        cred = update_credentials(
            integration=integration,
            api_key=data.get("api_key"),
            api_secret=data.get("api_secret"),
            access_token=data.get("access_token"),
            webhook_secret=data.get("webhook_secret"),
            extra=data.get("extra"),
            actor=request.user,
        )

        return Response(
            {"detail": "Credentials successfully updated.", "overview": cred.get_masked_overview()},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="change-status")
    def update_lifecycle_status(self, request, pk=None):
        """Transition integration status (pause, resume, disconnect)."""
        integration = self.get_object()
        new_status = request.data.get("status")
        reason = request.data.get("reason", "")

        try:
            integration = change_status(
                integration=integration,
                new_status=new_status,
                reason=reason,
                actor=request.user,
            )
            return Response(IntegrationSerializer(integration).data)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["get"], url_path="logs")
    def list_logs(self, request, pk=None):
        """List audit and operation logs for this integration."""
        integration = self.get_object()
        logs = integration.logs.all()[:100]
        return Response(IntegrationLogSerializer(logs, many=True).data)

    @action(detail=True, methods=["get"], url_path="sync-jobs")
    def list_sync_jobs(self, request, pk=None):
        """List sync jobs for this integration."""
        integration = self.get_object()
        jobs = integration.sync_jobs.all()[:50]
        return Response(SyncJobSerializer(jobs, many=True).data)

    @action(detail=True, methods=["get"], url_path="events")
    def list_events(self, request, pk=None):
        """List received integration events for this integration."""
        integration = self.get_object()
        events = integration.events.all()[:50]
        return Response(IntegrationEventSerializer(events, many=True).data)

    @action(detail=True, methods=["post"], url_path="validate-connection")
    def validate_connection(self, request, pk=None):
        """Validate website/channel connection via connector validate_credentials()."""
        integration = self.get_object()
        from .connectors import get_connector
        try:
            connector = get_connector(integration)
            is_valid = connector.validate_credentials()
            if is_valid:
                integration.mark_connected()
                IntegrationLog.all_objects.create(
                    shop=integration.shop,
                    integration=integration,
                    level=IntegrationLog.LogLevel.INFO,
                    action="connection_validated",
                    message=f"Connection to '{integration.name}' ({integration.get_provider_display()}) validated successfully.",
                )
                return Response({"success": True, "message": "Connection validated successfully."})
            else:
                integration.mark_error("Connection validation failed. Provider returned negative response.")
                return Response(
                    {"success": False, "message": "Connection test failed. Provider could not be authenticated."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except Exception as exc:
            integration.mark_error(f"Connection test error: {str(exc)}")
            return Response(
                {"success": False, "message": f"Connection error: {str(exc)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["post"], url_path="disconnect")
    def disconnect(self, request, pk=None):
        """Disconnect integration."""
        integration = self.get_object()
        integration.disconnect()
        IntegrationLog.all_objects.create(
            shop=integration.shop,
            integration=integration,
            level=IntegrationLog.LogLevel.INFO,
            action="integration_disconnected",
            message=f"Integration '{integration.name}' was disconnected.",
        )
        return Response(IntegrationSerializer(integration).data)

    @action(detail=True, methods=["get"], url_path="failures")
    def list_failures(self, request, pk=None):
        """List failed events and sync errors for this integration."""
        integration = self.get_object()
        events = integration.events.filter(
            status__in=[
                IntegrationEvent.Status.FAILED,
                IntegrationEvent.Status.RETRY,
                IntegrationEvent.Status.FAILED_PERMANENTLY,
            ]
        ).order_by("-created_at")[:50]
        return Response(IntegrationEventSerializer(events, many=True).data)

    @action(detail=True, methods=["post"], url_path="retry-failures")
    def retry_failures(self, request, pk=None):
        """Trigger recovery for failed events on this integration."""
        integration = self.get_object()
        from .recovery import manual_retry_event
        failed_events = integration.events.filter(
            status__in=[
                IntegrationEvent.Status.FAILED,
                IntegrationEvent.Status.RETRY,
                IntegrationEvent.Status.FAILED_PERMANENTLY,
            ]
        )[:20]
        retried = 0
        for evt in failed_events:
            try:
                manual_retry_event(evt.id, actor=request.user.email)
                retried += 1
            except Exception:
                pass
        return Response({
            "success": True,
            "retried_count": retried,
            "message": f"Triggered recovery for {retried} failed events.",
        })


class IntegrationLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Subscriber-facing audit and activity logs for integrations.
    """
    permission_classes = [IsAuthenticated, IsTenantMember, IsActiveTenant, CanViewIntegrations]
    serializer_class = IntegrationLogSerializer

    def get_queryset(self):
        shop = getattr(self.request, "shop", None) or getattr(getattr(self.request, "user", None), "shop", None)
        if not shop:
            return IntegrationLog.all_objects.none()
        return IntegrationLog.all_objects.filter(shop=shop).select_related("integration").order_by("-created_at")


class IntegrationDashboardViewSet(viewsets.ViewSet):
    """
    Consolidated subscriber-facing dashboard metrics endpoint.
    Aggregates websites, couriers, mappings, events, and shipment health.
    """
    permission_classes = [IsAuthenticated, IsTenantMember, IsActiveTenant, CanViewIntegrations]

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        return self.list(request)

    def list(self, request):
        shop = getattr(request, "shop", None) or getattr(getattr(request, "user", None), "shop", None)
        if not shop:
            return Response({"error": "Shop context not found"}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Websites summary
        integrations = list(Integration.all_objects.filter(shop=shop).select_related("credential"))
        web_total = len(integrations)
        web_connected = sum(1 for i in integrations if i.status == "connected")
        web_error = sum(1 for i in integrations if i.status == "error")
        web_disconnected = sum(1 for i in integrations if i.status == "disconnected")

        # 2. Couriers summary
        couriers = list(CourierAccount.all_objects.filter(shop=shop).select_related("credential"))
        courier_total = len(couriers)
        courier_active = sum(1 for c in couriers if c.is_active)

        # 3. Product mappings summary
        mappings = ProductChannelMapping.all_objects.filter(shop=shop)
        mapping_total = mappings.count()
        mapping_active = mappings.filter(is_sync_enabled=True).count()

        # 4. Events summary
        events = IntegrationEvent.all_objects.filter(shop=shop)
        event_total = events.count()
        event_pending = events.filter(status=IntegrationEvent.Status.QUEUED).count()
        event_retry = events.filter(status=IntegrationEvent.Status.RETRY).count()
        event_failed = events.filter(
            status__in=[IntegrationEvent.Status.FAILED, IntegrationEvent.Status.FAILED_PERMANENTLY]
        ).count()
        event_success = events.filter(status=IntegrationEvent.Status.SUCCESS).count()

        # 5. Shipments summary
        shipments = CourierShipment.all_objects.filter(shop=shop)
        shipment_total = shipments.count()
        shipment_in_transit = shipments.filter(
            status__in=[CourierShipment.ShipmentStatus.IN_TRANSIT, CourierShipment.ShipmentStatus.OUT_FOR_DELIVERY]
        ).count()
        shipment_delivered = shipments.filter(status=CourierShipment.ShipmentStatus.DELIVERED).count()
        shipment_failed = shipments.filter(
            status__in=[CourierShipment.ShipmentStatus.DELIVERY_FAILED, CourierShipment.ShipmentStatus.CANCELLED]
        ).count()

        # 6. Recent logs & failed events
        recent_logs = IntegrationLog.all_objects.filter(shop=shop).order_by("-created_at")[:10]
        recent_failures = events.filter(
            status__in=[IntegrationEvent.Status.FAILED, IntegrationEvent.Status.RETRY, IntegrationEvent.Status.FAILED_PERMANENTLY]
        ).order_by("-created_at")[:10]

        return Response({
            "stats": {
                "websites": {
                    "total": web_total,
                    "connected": web_connected,
                    "error": web_error,
                    "disconnected": web_disconnected,
                },
                "couriers": {
                    "total": courier_total,
                    "active": courier_active,
                    "inactive": courier_total - courier_active,
                },
                "mappings": {
                    "total": mapping_total,
                    "active": mapping_active,
                },
                "events": {
                    "total": event_total,
                    "pending": event_pending,
                    "retry": event_retry,
                    "failed": event_failed,
                    "success": event_success,
                },
                "shipments": {
                    "total": shipment_total,
                    "in_transit": shipment_in_transit,
                    "delivered": shipment_delivered,
                    "failed": shipment_failed,
                },
            },
            "websites": IntegrationSerializer(integrations, many=True).data,
            "couriers": CourierAccountSerializer(couriers, many=True).data,
            "recent_failures": IntegrationEventSerializer(recent_failures, many=True).data,
            "failed_events": IntegrationEventSerializer(recent_failures, many=True).data,
            "recent_logs": IntegrationLogSerializer(recent_logs, many=True).data,
        })

