from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ActiveUsersView,
    APIKeyAdminViewSet,
    BackupDownloadView,
    BackupRestoreView,
    MediaBackupDownloadView,
    MediaBackupRestoreView,
    PlatformConfigView,
    DriveAuthStartView,
    DriveAuthCallbackView,
    TriggerDriveBackupView,
    ContactMessageViewSet,
    ManualPaymentAdminViewSet,
    PlanView,
    PlatformDashboardView,
    RevenueByMethodView,
    ShopAdminViewSet,
    StopImpersonationView,
    TutorialVideoViewSet,
    ServerMetricsView,
    BlogPostAdminViewSet,
    PublicBlogViewSet,
    PublicPricingPlanViewSet,
    MailAccountView,
    MailSSOView,
    MailSSORedirectView,
    SmtpSettingsView,
    TestSmtpConnectionView,
)

app_name = "platform_admin"

router = DefaultRouter()
router.register("shops", ShopAdminViewSet, basename="admin-shops")
router.register("manual-payments", ManualPaymentAdminViewSet, basename="admin-manual-payments")
router.register("api-keys", APIKeyAdminViewSet, basename="admin-api-keys")
router.register("messages", ContactMessageViewSet, basename="admin-messages")
router.register("tutorials", TutorialVideoViewSet, basename="admin-tutorials")
router.register("blogs", BlogPostAdminViewSet, basename="admin-blogs")
router.register("public/blogs", PublicBlogViewSet, basename="public-blogs")
router.register("public/pricing", PublicPricingPlanViewSet, basename="public-pricing")

urlpatterns = [
    path("dashboard/", PlatformDashboardView.as_view(), name="dashboard"),
    path("metrics/", ServerMetricsView.as_view(), name="metrics"),
    path("revenue-by-method/", RevenueByMethodView.as_view(), name="revenue-by-method"),
    path("active-users/", ActiveUsersView.as_view(), name="active-users"),
    path("plan/", PlanView.as_view(), name="plan"),
    path("smtp-settings/", SmtpSettingsView.as_view(), name="smtp-settings"),
    path("smtp-test/", TestSmtpConnectionView.as_view(), name="smtp-test"),
    path("backups/download/", BackupDownloadView.as_view(), name="backup-download"),
    path("backups/restore/", BackupRestoreView.as_view(), name="backup-restore"),
    path("backups/media/download/", MediaBackupDownloadView.as_view(), name="media-backup-download"),
    path("backups/media/restore/", MediaBackupRestoreView.as_view(), name="media-backup-restore"),
    path("backups/drive-config/", PlatformConfigView.as_view(), name="platform-drive-config"),
    path("backups/drive-auth-url/", DriveAuthStartView.as_view(), name="platform-drive-auth-url"),
    path("backups/drive-callback/", DriveAuthCallbackView.as_view(), name="platform-drive-callback"),
    path("backups/drive-trigger/", TriggerDriveBackupView.as_view(), name="platform-drive-trigger"),
    path("impersonate/stop/", StopImpersonationView.as_view(), name="impersonate_stop"),
    path("mail-accounts/", MailAccountView.as_view(), name="mail-accounts"),
    path("mail-accounts/sso/", MailSSOView.as_view(), name="mail-accounts-sso"),
    path("mail-accounts/sso-redirect/", MailSSORedirectView.as_view(), name="mail-sso-redirect"),
    path("imports/", include("imports.api")),
    path("", include(router.urls)),
]
