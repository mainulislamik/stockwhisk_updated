"""
Phase 15: Superadmin Observability and Tenant Audit Views.

Provides:
1. SuperadminObservabilityView: Global platform-wide visibility across all tenants
   for connected integrations, failed events, integration errors, active courier connections,
   synchronization activity, and shipment integration activity.
2. IntegrationAuditLogViewSet: Tenant-scoped, immutable audit log viewer for shop owners.
"""
from datetime import timedelta
import logging

from django.db.models import Count
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.tenant_context import set_current_tenant
from .models import (
    CourierAccount,
    CourierShipment,
    Integration,
    IntegrationAuditLog,
    IntegrationEvent,
    IntegrationLog,
    IntegrationStatus,
    ProductChannelMapping,
    SyncError,
    SyncJob,
)
from .permissions import CanViewIntegrations, IsActiveTenant, IsIntegrationTenantOwner
from .serializers import IntegrationAuditLogSerializer

logger = logging.getLogger("integrations.observability")


class SuperadminObservabilityView(APIView):
    """
    Superadmin-only API for full cross-tenant observability into the integration platform.
    Requires staff/superuser privileges (IsAdminUser).
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request, *args, **kwargs):
        now = timezone.now()
        since_24h = now - timedelta(hours=24)

        # 1. Connected Integrations
        all_integrations = Integration.all_objects.all()
        active_integrations = all_integrations.filter(status=IntegrationStatus.CONNECTED)
        by_provider = dict(
            all_integrations.values_list("provider").annotate(count=Count("id")).order_by("-count")
        )
        by_status = dict(
            all_integrations.values_list("status").annotate(count=Count("id")).order_by("-count")
        )
        recent_integrations = [
            {
                "id": i.id,
                "name": i.name,
                "shop_id": i.shop_id,
                "shop_name": getattr(i.shop, "name", f"Shop #{i.shop_id}"),
                "provider": i.provider,
                "status": i.status,
                "created_at": i.created_at.isoformat() if i.created_at else None,
            }
            for i in all_integrations.select_related("shop").order_by("-created_at")[:10]
        ]

        # 2. Failed Events & Recovery Queue
        all_events = IntegrationEvent.all_objects.all()
        failed_permanently_count = all_events.filter(
            status__in=[IntegrationEvent.Status.FAILED_PERMANENTLY, IntegrationEvent.Status.RETRY_LIMIT_REACHED]
        ).count()
        retry_queue_count = all_events.filter(
            status__in=[IntegrationEvent.Status.RETRY, IntegrationEvent.Status.QUEUED]
        ).count()

        # Category breakdown for failed events
        category_counts = {}
        for ev in all_events.filter(status__in=[
            IntegrationEvent.Status.FAILED_PERMANENTLY,
            IntegrationEvent.Status.RETRY_LIMIT_REACHED,
            IntegrationEvent.Status.RETRY,
        ]).values("error_details"):
            details = ev.get("error_details") or {}
            cat = details.get("category") or "UNKNOWN"
            category_counts[cat] = category_counts.get(cat, 0) + 1

        recent_failed = [
            {
                "id": ev.id,
                "shop_id": ev.shop_id,
                "shop_name": getattr(ev.shop, "name", f"Shop #{ev.shop_id}"),
                "integration_name": getattr(ev.integration, "name", "Unknown"),
                "event_type": ev.event_type,
                "external_event_id": ev.external_event_id,
                "status": ev.status,
                "attempt_count": ev.attempt_count,
                "error_message": ev.error_message[:200] if ev.error_message else "",
                "created_at": ev.created_at.isoformat() if ev.created_at else None,
            }
            for ev in all_events.filter(status__in=[
                IntegrationEvent.Status.FAILED_PERMANENTLY,
                IntegrationEvent.Status.RETRY_LIMIT_REACHED,
                IntegrationEvent.Status.RETRY,
            ]).select_related("shop", "integration").order_by("-created_at")[:10]
        ]

        # 3. Integration Errors
        errors_24h_count = IntegrationLog.all_objects.filter(
            level=IntegrationLog.Level.ERROR,
            created_at__gte=since_24h,
        ).count()
        recent_errors = [
            {
                "id": log.id,
                "shop_id": log.shop_id,
                "shop_name": getattr(log.shop, "name", f"Shop #{log.shop_id}"),
                "action": log.action,
                "message": log.message,
                "level": log.level,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in IntegrationLog.all_objects.filter(level=IntegrationLog.Level.ERROR).select_related("shop").order_by("-created_at")[:10]
        ]

        # 4. Active Courier Connections
        courier_qs = CourierAccount.all_objects.all()
        active_couriers_count = courier_qs.filter(is_active=True).count()
        courier_by_provider = dict(
            courier_qs.values_list("provider").annotate(count=Count("id")).order_by("-count")
        )
        courier_accounts_list = [
            {
                "id": ca.id,
                "shop_id": ca.shop_id,
                "shop_name": getattr(ca.shop, "name", f"Shop #{ca.shop_id}"),
                "name": ca.name,
                "provider": ca.provider,
                "is_active": ca.is_active,
                "is_default": ca.is_default,
                "created_at": ca.created_at.isoformat() if ca.created_at else None,
            }
            for ca in courier_qs.select_related("shop").order_by("-created_at")[:15]
        ]

        # 5. Synchronization Activity
        sync_jobs = SyncJob.all_objects.all()
        sync_activity = {
            "total_jobs": sync_jobs.count(),
            "running_jobs": sync_jobs.filter(status="running").count(),
            "completed_jobs": sync_jobs.filter(status="completed").count(),
            "failed_jobs": sync_jobs.filter(status="failed").count(),
            "inventory_synced_records": IntegrationAuditLog.all_objects.filter(
                action=str(IntegrationAuditLog.Action.INVENTORY_SYNCHRONIZED),
                status="success",
            ).count(),
            "orders_imported_records": IntegrationAuditLog.all_objects.filter(
                action=str(IntegrationAuditLog.Action.ORDER_IMPORTED),
                status="success",
            ).count(),
        }

        # 6. Shipment Integration Activity
        shipments_qs = CourierShipment.all_objects.all()
        shipments_by_status = dict(
            shipments_qs.values_list("status").annotate(count=Count("id")).order_by("-count")
        )
        recent_shipments = [
            {
                "id": s.id,
                "shop_id": s.shop_id,
                "shop_name": getattr(s.shop, "name", f"Shop #{s.shop_id}"),
                "account_name": getattr(s.account, "name", "Unknown"),
                "provider": getattr(s.account, "provider", "Unknown"),
                "tracking_id": s.tracking_id,
                "consignment_id": s.consignment_id,
                "status": s.status,
                "cod_amount": str(s.cod_amount),
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in shipments_qs.select_related("shop", "account").order_by("-created_at")[:10]
        ]

        # 7. Recent Global Audit Trail
        recent_audits = IntegrationAuditLog.all_objects.select_related("shop", "integration", "courier_account", "actor").order_by("-created_at")[:20]
        serialized_audits = IntegrationAuditLogSerializer(recent_audits, many=True).data

        return Response({
            "connected_integrations": {
                "total_active": active_integrations.count(),
                "total_all": all_integrations.count(),
                "by_provider": by_provider,
                "by_status": by_status,
                "recent": recent_integrations,
            },
            "failed_events": {
                "total_failed_permanently": failed_permanently_count,
                "total_retry_queue": retry_queue_count,
                "by_error_category": category_counts,
                "recent_failed": recent_failed,
            },
            "integration_errors": {
                "total_errors_24h": errors_24h_count,
                "recent_errors": recent_errors,
            },
            "active_courier_connections": {
                "total_active": active_couriers_count,
                "total_all": courier_qs.count(),
                "by_provider": courier_by_provider,
                "accounts": courier_accounts_list,
            },
            "synchronization_activity": sync_activity,
            "shipment_integration_activity": {
                "total_shipments": shipments_qs.count(),
                "by_status": shipments_by_status,
                "recent_shipments": recent_shipments,
            },
            "recent_audit_trail": serialized_audits,
        })


class IntegrationAuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Tenant-scoped Read-Only API for subscribers to view and inspect their audit logs.
    Strictly isolated to request.user.shop.
    """
    serializer_class = IntegrationAuditLogSerializer
    permission_classes = [IsAuthenticated, IsActiveTenant, CanViewIntegrations]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        shop = getattr(request, "shop", None) or getattr(getattr(request, "user", None), "shop", None)
        if shop:
            set_current_tenant(shop)

    def get_queryset(self):
        shop = getattr(self.request, "shop", None) or getattr(getattr(self.request, "user", None), "shop", None)
        if not shop:
            return IntegrationAuditLog.all_objects.none()

        qs = (
            IntegrationAuditLog.all_objects.filter(shop=shop)
            .select_related("shop", "integration", "courier_account", "actor")
            .order_by("-created_at")
        )

        # Filters
        action_param = self.request.query_params.get("action")
        if action_param:
            qs = qs.filter(action=action_param)

        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)

        event_type = self.request.query_params.get("event_type")
        if event_type:
            qs = qs.filter(event_type=event_type)

        correlation_id = self.request.query_params.get("correlation_id")
        if correlation_id:
            qs = qs.filter(correlation_id=correlation_id)

        external_id = self.request.query_params.get("external_id")
        if external_id:
            qs = qs.filter(external_id=external_id)

        integration_id = self.request.query_params.get("integration_id")
        if integration_id:
            qs = qs.filter(integration_id=integration_id)

        courier_id = self.request.query_params.get("courier_id")
        if courier_id:
            qs = qs.filter(courier_account_id=courier_id)

        return qs
