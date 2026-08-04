from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ActiveUsersView,
    APIKeyAdminViewSet,
    BackupDownloadView,
    BackupRestoreView,
    ContactMessageViewSet,
    ManualPaymentAdminViewSet,
    PlanView,
    PlatformDashboardView,
    RevenueByMethodView,
    ShopAdminViewSet,
    StopImpersonationView,
    TutorialVideoViewSet,
)

app_name = "platform_admin"

router = DefaultRouter()
router.register("shops", ShopAdminViewSet, basename="admin-shops")
router.register("manual-payments", ManualPaymentAdminViewSet, basename="admin-manual-payments")
router.register("api-keys", APIKeyAdminViewSet, basename="admin-api-keys")
router.register("messages", ContactMessageViewSet, basename="admin-messages")
router.register("tutorials", TutorialVideoViewSet, basename="admin-tutorials")

urlpatterns = [
    path("dashboard/", PlatformDashboardView.as_view(), name="dashboard"),
    path("revenue-by-method/", RevenueByMethodView.as_view(), name="revenue-by-method"),
    path("active-users/", ActiveUsersView.as_view(), name="active-users"),
    path("plan/", PlanView.as_view(), name="plan"),
    path("backups/download/", BackupDownloadView.as_view(), name="backup-download"),
    path("backups/restore/", BackupRestoreView.as_view(), name="backup-restore"),
    path("impersonate/stop/", StopImpersonationView.as_view(), name="impersonate_stop"),
    path("imports/", include("imports.api")),
    path("", include(router.urls)),
]
