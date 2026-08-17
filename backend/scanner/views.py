from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

class ScannerAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        barcode = request.data.get("barcode")
        if not barcode:
            return Response({"error": "Barcode is required"}, status=400)
            
        shop_id = request.user.shop_id
        
        # Broadcast to the WebSocket group
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"scanner_shop_{shop_id}",
            {
                "type": "barcode_scanned",
                "barcode": barcode
            }
        )
        return Response({"status": "success", "barcode": barcode})
