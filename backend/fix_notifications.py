import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from catalog.models import Product
from notifications.models import Notification, NotificationType
from notifications.services import notify
from tenants.models import Shop

# Get the first shop
shop = Shop.objects.first()
if shop:
    # Ensure there is at least one low stock product to test with
    test_prod, _ = Product.all_objects.get_or_create(
        shop=shop, 
        sku="TEST-LOW-STOCK", 
        defaults={
            "name": "Test Low Stock Item",
            "track_inventory": True,
            "reorder_level": 5,
        }
    )
    # Force the stock to 3 to trigger the alert
    Product.all_objects.filter(id=test_prod.id).update(current_stock=3)

for p in Product.objects.all():
    # Force reload stock from db
    p.refresh_from_db()
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
