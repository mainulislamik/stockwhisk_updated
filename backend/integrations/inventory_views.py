"""
Inventory Synchronization Views for StockWhisk Integrations (Phase 6).

Provides REST endpoints for:
- SyncError inspection & resolution (/api/integrations/sync-errors/)
- InventoryReservation inspection (/api/integrations/reservations/)
- Integration inventory status & bulk sync (/api/integrations/channels/{id}/inventory-status/, /sync-inventory/)
"""
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.tenant_context import set_current_tenant
from .inventory_engine import (
    execute_bulk_inventory_sync,
    get_channel_inventory_summary,
    release_inventory_reservation,
    sync_product_inventory,
)
from .models import Integration, InventoryReservation, ProductChannelMapping, SyncError
from .permissions import CanManageIntegrations, CanViewIntegrations, IsActiveTenant
from .serializers import InventoryReservationSerializer, SyncErrorSerializer
from .tasks import sync_bulk_inventory_task, sync_inventory_mapping_task


class SyncErrorViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Tenant-scoped ViewSet for inspecting synchronization errors.
    """
    serializer_class = SyncErrorSerializer
    permission_classes = [IsAuthenticated, IsActiveTenant, CanViewIntegrations]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.user and request.user.is_authenticated and hasattr(request.user, "shop"):
            set_current_tenant(request.user.shop)

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated or not hasattr(user, "shop") or not user.shop:
            return SyncError.all_objects.none()
        qs = SyncError.all_objects.filter(shop=user.shop)
        integration_id = self.request.query_params.get("integration_id")
        if integration_id:
            qs = qs.filter(integration_id=integration_id)
        error_type = self.request.query_params.get("error_type")
        if error_type:
            qs = qs.filter(error_type=error_type)
        is_resolved = self.request.query_params.get("is_resolved")
        if is_resolved is not None:
            qs = qs.filter(is_resolved=is_resolved.lower() in ["true", "1"])
        return qs

    @action(detail=True, methods=["post"], url_path="resolve")
    def resolve_error(self, request, pk=None):
        error = self.get_object()
        error.is_resolved = True
        error.save(update_fields=["is_resolved", "updated_at"])
        return Response({"status": "resolved", "id": error.id})


class InventoryReservationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Tenant-scoped ViewSet for inspecting inventory reservations.
    """
    serializer_class = InventoryReservationSerializer
    permission_classes = [IsAuthenticated, IsActiveTenant, CanViewIntegrations]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.user and request.user.is_authenticated and hasattr(request.user, "shop"):
            set_current_tenant(request.user.shop)

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated or not hasattr(user, "shop") or not user.shop:
            return InventoryReservation.all_objects.none()
        return InventoryReservation.all_objects.filter(shop=user.shop)

    @action(detail=True, methods=["post"], url_path="release")
    def release_reservation(self, request, pk=None):
        """
        Manually release a reservation (full or partial).
        Payload: {"quantity": "2.00", "reason": "Manual release via API"}
        """
        from decimal import Decimal

        reservation = self.get_object()
        quantity_str = request.data.get("quantity")
        reason = request.data.get("reason", "Manual release via API")
        qty = None
        if quantity_str is not None:
            try:
                qty = Decimal(str(quantity_str))
                if qty <= 0:
                    raise ValueError()
            except Exception:
                return Response({"error": "Invalid release quantity."}, status=status.HTTP_400_BAD_REQUEST)

        updated = release_inventory_reservation(reservation, quantity=qty, reason=reason)
        return Response(self.get_serializer(updated).data)
