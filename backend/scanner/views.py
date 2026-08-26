import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

logger = logging.getLogger(__name__)

class ScannerAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        barcode = request.data.get("barcode")
        if not barcode or not str(barcode).strip():
            return Response({"error": "Barcode is required", "detail": "Barcode data cannot be empty."}, status=400)
        
        barcode_clean = str(barcode).strip()
            
        shop_id = getattr(request.user, "shop_id", None)
        if not shop_id and getattr(request.user, "shop", None):
            shop_id = request.user.shop.id
            
        if not shop_id:
            return Response(
                {"error": "No shop found", "detail": "Your user account is not associated with an active shop."},
                status=400
            )
        
        # Broadcast to the WebSocket group
        channel_layer = get_channel_layer()
        if not channel_layer:
            logger.error("Channel layer not found for scanner broadcast")
            return Response({"error": "Server WebSocket channel layer unavailable"}, status=500)

        try:
            async_to_sync(channel_layer.group_send)(
                f"scanner_shop_{shop_id}",
                {
                    "type": "barcode_scanned",
                    "barcode": barcode_clean
                }
            )
        except Exception as exc:
            logger.error("Failed to broadcast barcode %s to scanner_shop_%s: %s", barcode_clean, shop_id, exc)
            return Response({"error": "Failed to broadcast to POS", "detail": str(exc)}, status=500)

        return Response({"status": "success", "barcode": barcode_clean, "shop_id": shop_id})

