from django.db.models import Q, F
from core.services import BaseService
from .models import Product, Category, Brand

class ProductService(BaseService[Product]):
    model = Product

    @classmethod
    def get_catalog_queryset(cls, low_stock: bool = False, search: str = None, light: bool = False):
        """Returns the tenant-scoped product catalog, optimized with related entities.

        ``light=True`` skips prefetching each product's in-stock units — used by
        list/table views that only need product fields, so a shop with thousands
        of serialized units doesn't pull them all just to render a product list.
        """
        from django.db.models import Prefetch
        from .models import ProductUnit
        qs = cls.get_queryset().select_related("category", "brand", "unit").prefetch_related("variations")
        if not light:
            in_stock_prefetch = Prefetch(
                "units",
                queryset=ProductUnit.objects.filter(status=ProductUnit.Status.IN_STOCK),
                to_attr="prefetched_in_stock_units"
            )
            qs = qs.prefetch_related(in_stock_prefetch)
        
        if low_stock:
            qs = qs.filter(track_inventory=True, current_stock__lte=F("reorder_level"))
            
        if search:
            # Match on a unit barcode only when that unit is still IN STOCK, so a
            # product does not resurface in POS because of an already-sold unit
            # that happens to share the scanned barcode.
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(sku__icontains=search) |
                Q(barcode__icontains=search) |
                Q(units__barcode__icontains=search, units__status=ProductUnit.Status.IN_STOCK)
            ).distinct()
            
        return qs
