from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from django.http import HttpResponse
from rest_framework.permissions import AllowAny

from analytics.services import low_stock_list, out_of_stock_list
from core.permissions import IsTenantMember
from core.tenant_context import set_current_tenant

from .models import Notification, ShopAlertConfig, ShopWhatsAppConfig
from .services import get_alert_config
from .whatsapp import verify_webhook


class _Scoped:
    def initial(self, request, *args, **kwargs):
        set_current_tenant(getattr(request.user, "shop", None))
        request.tenant = getattr(request.user, "shop", None)
        super().initial(request, *args, **kwargs)


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "type", "title", "message", "metadata", "sent_channels", "is_read", "created_at"]


class NotificationViewSet(_Scoped, mixins.ListModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsTenantMember]
    serializer_class = NotificationSerializer

    def get_queryset(self):
        qs = Notification.objects.all().order_by("-created_at")
        if self.request.query_params.get("unread") in {"1", "true"}:
            qs = qs.filter(is_read=False)
        return qs

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        note = self.get_object()
        note.is_read = True
        note.save(update_fields=["is_read"])
        return Response({"status": "read"})

    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        count = Notification.objects.filter(is_read=False).count()
        return Response({"unread": count})

    @action(detail=False, methods=["post", "delete"])
    def clear_read(self, request):
        shop = getattr(request.user, "shop", None)
        if shop:
            Notification.all_objects.filter(shop_id=shop.id, is_read=True).delete()
        else:
            Notification.objects.filter(is_read=True).delete()
        return Response({"status": "cleared_read"})

    @action(detail=False, methods=["post", "delete"])
    def clear_all(self, request):
        shop = getattr(request.user, "shop", None)
        if shop:
            Notification.all_objects.filter(shop_id=shop.id).delete()
        else:
            Notification.objects.all().delete()
        return Response({"status": "cleared_all"})

    @action(detail=False, methods=["post"])
    def read_all(self, request):
        Notification.objects.filter(is_read=False).update(is_read=True)
        return Response({"status": "all_read"})


class AlertConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopAlertConfig
        fields = ["low_stock_enabled", "mode", "email_enabled", "sms_enabled", "whatsapp_enabled", "daily_report_enabled", "weekly_report_enabled", "monthly_report_enabled", "report_recipient_email"]


class AlertConfigView(_Scoped, APIView):
    permission_classes = [IsTenantMember]

    def get(self, request):
        cfg = get_alert_config(request.user.shop)
        return Response(AlertConfigSerializer(cfg).data)

    def patch(self, request):
        cfg = get_alert_config(request.user.shop)
        ser = AlertConfigSerializer(cfg, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class StockAlertsWidgetView(_Scoped, APIView):
    """Dashboard widget: current low/out items with a create-PO shortcut hint."""

    permission_classes = [IsTenantMember]

    def get(self, request):
        shop = request.user.shop
        low = low_stock_list(shop)
        out = out_of_stock_list(shop)
        # Suggested reorder qty = bring stock back up to the reorder level.
        for row in low + out:
            gap = (row.get("reorder_level") or 0) - (row.get("current_stock") or 0)
            row["suggested_reorder_qty"] = gap if gap > 0 else 0
        return Response({
            "out_of_stock": out,
            "low_stock": low,
            "create_po_url": "/api/purchasing/purchase-orders/",
        })


class WhatsAppConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopWhatsAppConfig
        fields = ["enabled", "use_platform_number", "phone_number_id"]


class WhatsAppConfigView(_Scoped, APIView):
    """Shop WhatsApp sender config. Token is write-only for Enterprise creds."""

    permission_classes = [IsTenantMember]

    def get(self, request):
        cfg, _ = ShopWhatsAppConfig.objects.get_or_create(shop_id=request.user.shop_id)
        return Response(WhatsAppConfigSerializer(cfg).data)

    def patch(self, request):
        cfg, _ = ShopWhatsAppConfig.objects.get_or_create(shop_id=request.user.shop_id)
        ser = WhatsAppConfigSerializer(cfg, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        if "access_token" in request.data:
            cfg.access_token = request.data["access_token"]
            cfg.save(update_fields=["access_token"])
        return Response(WhatsAppConfigSerializer(cfg).data)


class WhatsAppWebhookView(APIView):
    """Meta webhook: GET verifies, POST receives delivery/inbound events."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        challenge = verify_webhook(
            request.query_params.get("hub.mode"),
            request.query_params.get("hub.verify_token"),
            request.query_params.get("hub.challenge"),
        )
        if challenge is None:
            return HttpResponse("forbidden", status=403)
        return HttpResponse(challenge, content_type="text/plain")

    def post(self, request):
        # Inbound message / delivery status. Logged; deep handling is Phase 4+.
        import logging
        logging.getLogger("notifications.whatsapp").info("Webhook event: %s", request.data)
        return Response({"received": True})


class SendTestReportView(_Scoped, APIView):
    permission_classes = [IsTenantMember]

    def post(self, request):
        frequency = request.data.get("frequency", "daily")
        email = request.data.get("email") or request.user.email
        shop = getattr(request.user, "shop", None)
        from reports.scheduled_digest import send_shop_digest_email
        res = send_shop_digest_email(shop, frequency=frequency, target_email=email)
        return Response(res)
