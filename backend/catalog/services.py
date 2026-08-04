from django.db.models import Q, F
from core.services import BaseService
from .models import Product, Category, Brand

class ProductService(BaseService[Product]):
    model = Product

    @classmethod
    def get_catalog_queryset(cls, low_stock: bool = False, search: str = None):
        """Returns the tenant-scoped product catalog, optimized with related entities."""
        qs = cls.get_queryset().select_related("category", "brand", "unit").prefetch_related("variations")
        
        if low_stock:
            qs = qs.filter(track_inventory=True, current_stock__lte=F("reorder_level"))
            
        if search:
            qs = qs.filter(
                Q(name__icontains=search) | 
                Q(sku__icontains=search) | 
                Q(barcode__icontains=search)
            )
            
        return qs
