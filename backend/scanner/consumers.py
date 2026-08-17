import json
from channels.generic.websocket import AsyncWebsocketConsumer

class ScannerConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.shop_id = self.scope['url_route']['kwargs']['shop_id']
        self.group_name = f"scanner_shop_{self.shop_id}"

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def barcode_scanned(self, event):
        barcode = event['barcode']
        await self.send(text_data=json.dumps({
            'barcode': barcode
        }))
