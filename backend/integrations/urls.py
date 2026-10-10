"""
Integration Platform URL Routes.
"""
from django.urls import path
from rest_framework.routers import DefaultRouter

from .admin_views import IntegrationAuditLogViewSet, SuperadminObservabilityView
from .courier_views import CourierAccountViewSet, CourierShipmentViewSet
from .inventory_views import InventoryReservationViewSet, SyncErrorViewSet
from .mapping_views import ProductChannelMappingViewSet
from .order_views import ExternalOrderViewSet
from .views import (
    IntegrationDashboardViewSet,
    IntegrationLogViewSet,
    IntegrationViewSet,
)
from .webhook_views import (
    IntegrationEventViewSet,
    WebhookEndpointViewSet,
    WebhookIntakeView,
)

app_name = "integrations"

router = DefaultRouter(trailing_slash=False)
router.trailing_slash = "/?"
router.register(r"channels", IntegrationViewSet, basename="channel")
router.register(r"couriers", CourierAccountViewSet, basename="courier")
router.register(r"shipments", CourierShipmentViewSet, basename="shipment")
router.register(r"dashboard", IntegrationDashboardViewSet, basename="dashboard")
router.register(r"logs", IntegrationLogViewSet, basename="log")
router.register(r"endpoints", WebhookEndpointViewSet, basename="endpoint")
router.register(r"events", IntegrationEventViewSet, basename="event")
router.register(r"mappings", ProductChannelMappingViewSet, basename="mapping")
router.register(r"sync-errors", SyncErrorViewSet, basename="sync-error")
router.register(r"reservations", InventoryReservationViewSet, basename="reservation")
router.register(r"orders", ExternalOrderViewSet, basename="external-order")
router.register(r"audit-logs", IntegrationAuditLogViewSet, basename="audit-log")

urlpatterns = [
    path("webhooks/<uuid:endpoint_id>/", WebhookIntakeView.as_view(), name="webhook-intake"),
    path("admin/observability/?", SuperadminObservabilityView.as_view(), name="admin-observability"),
] + router.urls
