import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from catalog.models import Product
from notifications.models import Notification, NotificationType
from notifications.services import notify

for p in Product.objects.all():
    if p.track_inventory and p.is_low_stock:
        out = p.current_stock <= 0
        already = Notification.all_objects.filter(shop_id=p.shop_id, is_read=False, metadata__product_id=p.id).exists()
        if not already:
            notify(
                shop=p.shop,
                type=NotificationType.OUT_OF_STOCK if out else NotificationType.LOW_STOCK,
                title=f"{'Out of stock' if out else 'Low stock'}: {p.name}",
                message=(f"{p.name} is out of stock." if out else f"{p.name} is low: {p.current_stock} left."),
                metadata={"product_id": p.id, "current_stock": str(p.current_stock)}
            )
print('Done!')
