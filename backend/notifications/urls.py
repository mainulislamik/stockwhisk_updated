from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AlertConfigView,
    SendTestReportView,
    NotificationViewSet,
    StockAlertsWidgetView,
    WhatsAppConfigView,
    WhatsAppWebhookView,
    WhatsAppStatusView,
    WhatsAppQRView,
    WhatsAppDisconnectView,
    WhatsAppSendInvoiceView,
)

router = DefaultRouter()
router.register("notifications", NotificationViewSet, basename="notification")

urlpatterns = [
    path("alert-config/", AlertConfigView.as_view(), name="alert-config"),
    path("alert-config/send-test-report/", SendTestReportView.as_view(), name="alert-config-send-test-report"),
    path("stock-alerts/", StockAlertsWidgetView.as_view(), name="stock-alerts-widget"),
    path("whatsapp/config/", WhatsAppConfigView.as_view(), name="whatsapp-config"),
    path("whatsapp/status/", WhatsAppStatusView.as_view(), name="whatsapp-status"),
    path("whatsapp/qr/", WhatsAppQRView.as_view(), name="whatsapp-qr"),
    path("whatsapp/disconnect/", WhatsAppDisconnectView.as_view(), name="whatsapp-disconnect"),
    path("whatsapp/send-invoice/", WhatsAppSendInvoiceView.as_view(), name="whatsapp-send-invoice"),
    path("whatsapp/webhook/", WhatsAppWebhookView.as_view(), name="whatsapp-webhook"),
] + router.urls
