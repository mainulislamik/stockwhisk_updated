from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from django.http import HttpResponse
from rest_framework.permissions import AllowAny

from analytics.services import low_stock_list, out_of_stock_list
from core.permissions import HasPermCode, IsTenantMember, IsTenantMemberOrPlatformStaff
from core.tenant_context import set_current_tenant, bypass_tenant_scope

from .models import Notification, ShopAlertConfig, ShopWhatsAppConfig
from .services import get_alert_config
from .whatsapp import verify_webhook


def _get_shop_wa_config(shop_id: int):
    with bypass_tenant_scope():
        cfg = ShopWhatsAppConfig.all_objects.filter(shop_id=shop_id).first()
        if not cfg:
            cfg = ShopWhatsAppConfig.all_objects.create(shop_id=shop_id)
        return cfg


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
        fields = [
            "low_stock_enabled", "mode", "email_enabled", "sms_enabled", "whatsapp_enabled",
            "daily_report_enabled", "weekly_report_enabled", "monthly_report_enabled", "report_recipient_email",
            "whatsapp_daily_digest_enabled", "whatsapp_digest_phone"
        ]


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


from urllib.parse import quote
from django.utils import timezone
from . import baileys
from sales.models import Sale


class WhatsAppConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopWhatsAppConfig
        fields = [
            "enabled",
            "use_platform_number",
            "phone_number_id",
            "session_id",
            "is_connected",
            "connected_phone",
            "connected_name",
            "default_mode",
            "auto_send_pos",
            "last_connected_at",
        ]


class WhatsAppConfigView(_Scoped, APIView):
    """Shop WhatsApp sender config. Token is write-only for Enterprise creds."""

    permission_classes = [IsTenantMember]

    def get(self, request):
        cfg, _ = ShopWhatsAppConfig.objects.get_or_create(shop_id=request.user.shop_id)
        gw_status = baileys.get_gateway_status(request.user.shop_id)
        if gw_status.get("connected"):
            cfg.is_connected = True
            cfg.connected_phone = gw_status.get("phone") or cfg.connected_phone
            cfg.connected_name = gw_status.get("name") or cfg.connected_name
            cfg.save(update_fields=["is_connected", "connected_phone", "connected_name"])
        elif gw_status.get("status") == "disconnected" and cfg.is_connected:
            cfg.is_connected = False
            cfg.save(update_fields=["is_connected"])

        data = WhatsAppConfigSerializer(cfg).data
        data["gateway_status"] = gw_status.get("status")
        return Response(data)

    def patch(self, request):
        cfg, _ = ShopWhatsAppConfig.objects.get_or_create(shop_id=request.user.shop_id)
        ser = WhatsAppConfigSerializer(cfg, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        if "access_token" in request.data:
            cfg.access_token = request.data["access_token"]
            cfg.save(update_fields=["access_token"])
        return Response(WhatsAppConfigSerializer(cfg).data)


class WhatsAppQRView(_Scoped, APIView):
    """Generate or retrieve live WhatsApp connection QR code for the shop or platform admin."""
    permission_classes = [IsTenantMemberOrPlatformStaff]

    def get(self, request):
        shop_id = getattr(request.user, "shop_id", 1) or 1
        cfg = _get_shop_wa_config(shop_id)
        qr_data = baileys.get_gateway_qr(shop_id)
        if not qr_data.get("qr") and not qr_data.get("connected"):
            import time
            time.sleep(2.0)
            qr_data = baileys.get_gateway_qr(shop_id)

        if qr_data.get("connected"):
            cfg.is_connected = True
            cfg.connected_phone = qr_data.get("phone") or cfg.connected_phone
            cfg.last_connected_at = timezone.now()
            cfg.save(update_fields=["is_connected", "connected_phone", "last_connected_at"])

        return Response({
            "qr": qr_data.get("qr"),
            "status": qr_data.get("status"),
            "connected": qr_data.get("connected", False),
            "phone": qr_data.get("phone") or cfg.connected_phone,
        })


class WhatsAppStatusView(_Scoped, APIView):
    """Check WhatsApp connection status for this shop or platform admin."""
    permission_classes = [IsTenantMemberOrPlatformStaff]

    def get(self, request):
        shop_id = getattr(request.user, "shop_id", 1) or 1
        cfg = _get_shop_wa_config(shop_id)
        gw_status = baileys.get_gateway_status(shop_id)

        is_conn = bool(gw_status.get("connected"))
        if is_conn != cfg.is_connected:
            cfg.is_connected = is_conn
            if is_conn:
                cfg.connected_phone = gw_status.get("phone") or cfg.connected_phone
                cfg.connected_name = gw_status.get("name") or cfg.connected_name
                cfg.last_connected_at = timezone.now()
            cfg.save(update_fields=["is_connected", "connected_phone", "connected_name", "last_connected_at"])

        return Response({
            "connected": is_conn,
            "status": gw_status.get("status"),
            "phone": gw_status.get("phone") or cfg.connected_phone,
            "name": gw_status.get("name") or cfg.connected_name,
            "default_mode": cfg.default_mode,
            "auto_send_pos": cfg.auto_send_pos,
        })


class WhatsAppDisconnectView(_Scoped, APIView):
    """Disconnect and purge WhatsApp session for this shop or platform admin."""
    permission_classes = [IsTenantMemberOrPlatformStaff]

    def post(self, request):
        shop_id = getattr(request.user, "shop_id", 1) or 1
        cfg = _get_shop_wa_config(shop_id)
        baileys.disconnect_gateway(shop_id)
        cfg.is_connected = False
        cfg.connected_phone = ""
        cfg.connected_name = ""
        cfg.save(update_fields=["is_connected", "connected_phone", "connected_name"])
        return Response({"success": True, "message": "WhatsApp session disconnected successfully"})


class WhatsAppPairingCodeView(_Scoped, APIView):
    """Generate an 8-character manual OTP / pairing code to link WhatsApp without QR scan."""
    permission_classes = [IsTenantMemberOrPlatformStaff]

    def post(self, request):
        shop_id = getattr(request.user, "shop_id", 1) or 1
        cfg = _get_shop_wa_config(shop_id)
        phone = request.data.get("phone", "").strip()
        if not phone:
            return Response({"error": "WhatsApp phone number is required (e.g. 017XXXXXXXX)."}, status=status.HTTP_400_BAD_REQUEST)

        result = baileys.request_gateway_pairing_code(phone, shop_id=shop_id)
        if result.get("success") and result.get("pairingCode"):
            return Response({
                "success": True,
                "pairing_code": result["pairingCode"],
                "phone": phone,
                "expires_in": 120,
            })
        return Response({
            "success": False,
            "error": result.get("error", "Failed to generate pairing code.")
        }, status=status.HTTP_400_BAD_REQUEST)


class WhatsAppSendInvoiceView(_Scoped, APIView):
    """
    Dual-mode WhatsApp Invoice Dispatch:
    - Mode 'direct': 1-tap automated delivery via connected shop WhatsApp session
    - Mode 'browser': Traditional wa.me browser link with prefilled memo
    """
    permission_classes = [IsTenantMember]

    def post(self, request):
        shop_id = request.user.shop_id
        shop = request.user.shop
        sale_id = request.data.get("sale_id")
        requested_mode = request.data.get("mode")  # "direct" or "browser" or None
        custom_phone = request.data.get("phone")

        if not sale_id:
            return Response({"error": "sale_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            sale = Sale.objects.filter(shop_id=shop_id).get(id=sale_id)
        except Sale.DoesNotExist:
            return Response({"error": "Sale not found"}, status=status.HTTP_404_NOT_FOUND)

        cfg, _ = ShopWhatsAppConfig.objects.get_or_create(shop_id=shop_id)
        target_mode = requested_mode or cfg.default_mode or "direct"

        raw_phone = custom_phone or sale.bill_phone or ""
        digits = "".join(c for c in raw_phone if c.isdigit())
        if not digits:
            return Response({"error": "Customer phone number is missing"}, status=status.HTTP_400_BAD_REQUEST)

        if digits.startswith("0") and len(digits) == 11:
            intl_phone = "88" + digits
        elif digits.startswith("880") or (digits.startswith("88") and len(digits) >= 12):
            intl_phone = digits
        elif len(digits) == 10:
            intl_phone = "880" + digits
        else:
            intl_phone = digits

        msg_text = baileys.format_invoice_message(sale, shop, request=request)
        wa_browser_url = f"https://wa.me/{intl_phone}?text={quote(msg_text)}"

        if target_mode == "browser":
            return Response({
                "success": True,
                "mode": "browser",
                "wa_url": wa_browser_url,
                "message": msg_text,
                "phone": intl_phone,
            })

        # Direct Mode (1-Tap): Check if gateway session is connected
        gw_status = baileys.get_gateway_status(shop_id)
        if not gw_status.get("connected"):
            return Response({
                "success": False,
                "fallback_mode": "browser",
                "wa_url": wa_browser_url,
                "message": msg_text,
                "phone": intl_phone,
                "error": "Shop WhatsApp is not connected. Opening WhatsApp Web link instead.",
            })

        # Send via Baileys gateway
        dispatch_res = baileys.send_whatsapp_message(shop_id, intl_phone, msg_text)
        if dispatch_res.get("success"):
            return Response({
                "success": True,
                "mode": "direct",
                "message_id": dispatch_res.get("message_id"),
                "phone": intl_phone,
                "invoice_no": sale.invoice_no,
            })
        else:
            return Response({
                "success": False,
                "fallback_mode": "browser",
                "wa_url": wa_browser_url,
                "phone": intl_phone,
                "error": dispatch_res.get("error", "Dispatch failed"),
            })


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


class SendTestOwnerWhatsAppReportView(_Scoped, APIView):
    """
    On-demand endpoint allowing a shop owner or admin to trigger an instant test run
    of the 10:00 PM WhatsApp executive briefing message to their phone.
    """
    permission_classes = [IsTenantMember]

    def post(self, request):
        shop = getattr(request.user, "shop", None)
        if not shop:
            return Response({"detail": "No shop found."}, status=status.HTTP_400_BAD_REQUEST)

        dry_run = request.data.get("dry_run", False)
        if dry_run:
            from .owner_digest import send_throttled_owner_daily_reports
            res = send_throttled_owner_daily_reports(dry_run=True, target_shop_id=shop.id)
            return Response(res)

        from .owner_digest import (
            get_daily_business_metrics,
            build_daily_report_whatsapp_message,
            resolve_owner_phone,
        )
        from .baileys import send_platform_whatsapp_message

        target_phone = request.data.get("phone") or resolve_owner_phone(shop)
        if not target_phone:
            return Response({"detail": "No recipient WhatsApp phone number provided or found on shop."}, status=status.HTTP_400_BAD_REQUEST)

        metrics = get_daily_business_metrics(shop)
        message_text = build_daily_report_whatsapp_message(shop, metrics)

        res = send_platform_whatsapp_message(target_phone, message_text)
        return Response({
            "success": res.get("success", False),
            "phone": target_phone,
            "message_preview": message_text,
            "gateway_result": res,
        })
