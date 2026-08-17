import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from catalog.models import Product, ProductUnit
from inventory.models import StockMovement

try:
    p = Product.all_objects.get(id=935)
    print(f"Product: {p.name} (ID: {p.id})")
    print(f"Current Stock: {p.current_stock}")

    units_in_stock = ProductUnit.all_objects.filter(product=p, status='in_stock').count()
    units_total = ProductUnit.all_objects.filter(product=p).count()
    print(f"Units In Stock: {units_in_stock}")
    print(f"Total Units: {units_total}")

    movements = StockMovement.all_objects.filter(product=p).order_by('created_at')
    print("Movements:")
    total = 0
    for m in movements:
        print(f"  [{m.created_at}] {m.movement_type}: {m.quantity}")
        total += m.quantity
    print(f"Ledger Sum: {total}")

except Exception as e:
    print(f"Error: {e}")
