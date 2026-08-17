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
                # Delete oldest excess units
                excess_ids = list(in_stock_units.values_list('id', flat=True)[:excess])
                ProductUnit.all_objects.filter(id__in=excess_ids).delete()
                self.stdout.write(f"Fixed {p.name}: deleted {excess} excess units.")
                fixed += 1
                
        self.stdout.write(self.style.SUCCESS(f"Successfully synced units for {fixed} products."))
