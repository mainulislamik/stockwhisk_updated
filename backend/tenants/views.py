from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .modules import (
    MODULE_CATALOG,
    MODULE_CATEGORIES,
    PRESET_PACKAGES,
    get_shop_modules,
    is_module_enabled,
    get_default_modules,
)


class ShopModulesView(APIView):
    """
    Returns the full modular catalog, preset packages, and the resolved
    module status for the authenticated user's shop.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        shop = getattr(request.user, "shop", None)
        if not shop and not request.user.is_staff:
            return Response(
                {"detail": "No shop associated with user."},
                status=status.HTTP_400_BAD_REQUEST
            )

        shop_modules = get_shop_modules(shop) if shop else get_default_modules()
        return Response({
            "catalog": MODULE_CATALOG,
            "categories": MODULE_CATEGORIES,
            "presets": PRESET_PACKAGES,
            "shop_modules": shop_modules,
            "shop_id": shop.id if shop else None,
            "shop_name": shop.name if shop else "Platform Admin",
        })


DEFAULT_INVOICE_SETTINGS = {
    "invoice_prefix": "INV",
    "header_note": "",
    "footer_note": "ধন্যবাদ, আবার আসবেন!",
    "return_policy": "বিক্রিত পণ্য ৭ দিনের মধ্যে পরিবর্তনযোগ্য (রসিদ আবশ্যক)।",
    "show_logo": True,
    "show_sku": True,
    "show_vat": False,
    "show_previous_due": True,
    "show_customer_phone": True,
    "show_warranty": True,
    "receipt_language": "bn",
    "paper_size": "80mm",
    "pos_ui_layout": "standard",
}


class ShopInvoiceSettingsView(APIView):
    """
    Get or update the invoice & receipt customization settings for the authenticated shop.
    Supports dynamic customization for computer/mobile/thermal printing.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        shop = getattr(request.user, "shop", None)
        if not shop:
            return Response({"detail": "No shop associated with user."}, status=status.HTTP_400_BAD_REQUEST)
        merged = dict(DEFAULT_INVOICE_SETTINGS)
        if shop.invoice_settings:
            merged.update(shop.invoice_settings)
        return Response(merged)

    def patch(self, request):
        shop = getattr(request.user, "shop", None)
        if not shop:
            return Response({"detail": "No shop associated with user."}, status=status.HTTP_400_BAD_REQUEST)
        if request.user.role not in ["owner", "admin"] and not request.user.is_superuser:
            return Response({"detail": "Only shop owner/admin can change receipt settings."}, status=status.HTTP_403_FORBIDDEN)

        current = dict(shop.invoice_settings or {})
        for k, v in request.data.items():
            current[k] = v
        shop.invoice_settings = current
        shop.save(update_fields=["invoice_settings"])

        merged = dict(DEFAULT_INVOICE_SETTINGS)
        merged.update(shop.invoice_settings)
        return Response(merged)
