from django.core.management.base import BaseCommand
from catalog.models import Product, ProductUnit

class Command(BaseCommand):
    help = 'Synchronizes IN_STOCK ProductUnits to match Product.current_stock by deleting excess units (FIFO).'

    def handle(self, *args, **options):
        products = Product.all_objects.all()
        fixed = 0
        
        for p in products:
            current = int(p.current_stock or 0)
            in_stock_units = ProductUnit.all_objects.filter(product=p, status=ProductUnit.Status.IN_STOCK).order_by('created_at')
            unit_count = in_stock_units.count()
            
            if unit_count > current:
                excess = unit_count - max(current, 0)
                excess_ids = list(in_stock_units.values_list('id', flat=True)[:excess])
                # Mark as sold instead of deleting to avoid any foreign key issues
                ProductUnit.all_objects.filter(id__in=excess_ids).update(status=ProductUnit.Status.SOLD)
                self.stdout.write(f"Fixed {p.name} (ID: {p.id}): marked {excess} excess units as SOLD. (was {unit_count}, target {max(current, 0)})")
                fixed += 1
            elif unit_count < current:
                missing = current - unit_count
                import time
                timestamp = int(time.time())
                new_units = []
                for i in range(missing):
                    barcode = f"SYNC-{p.id}-{timestamp}-{i+1:03d}"
                    new_units.append(ProductUnit(
                        shop_id=p.shop_id,
                        product=p,
                        barcode=barcode,
                        status=ProductUnit.Status.IN_STOCK,
                        cost_price=p.cost_price,
                        selling_price=p.selling_price
                    ))
                if new_units:
                    ProductUnit.all_objects.bulk_create(new_units)
                self.stdout.write(f"Fixed {p.name} (ID: {p.id}): auto-created {missing} missing units with SYNC- barcodes.")
                fixed += 1
                
        self.stdout.write(self.style.SUCCESS(f"Successfully synced units for {fixed} products."))
