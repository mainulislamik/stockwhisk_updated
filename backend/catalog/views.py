from core.api import TenantScopedViewSet

from .models import Brand, Category, Product, ProductVariation, Unit, ProductUnit
from .serializers import (
    BrandSerializer,
    CategorySerializer,
    ProductSerializer,
    ProductVariationSerializer,
    UnitSerializer,
    ProductUnitSerializer,
)


class CategoryViewSet(TenantScopedViewSet):
    serializer_class = CategorySerializer
    required_perm = "manage_products"

    def get_queryset(self):
        return Category.objects.all()

class ProductUnitViewSet(TenantScopedViewSet):
    serializer_class = ProductUnitSerializer
    required_perm = "manage_products"

    def get_queryset(self):
        qs = ProductUnit.objects.all()
        product_id = self.request.query_params.get("product")
        if product_id:
            qs = qs.filter(product_id=product_id)
        status = self.request.query_params.get("status")
        if status:
            qs = qs.filter(status=status)
        barcode = self.request.query_params.get("barcode")
        if barcode:
            qs = qs.filter(barcode=barcode.strip())
        return qs



class BrandViewSet(TenantScopedViewSet):
    serializer_class = BrandSerializer
    required_perm = "manage_products"

    def get_queryset(self):
        return Brand.objects.all()


class UnitViewSet(TenantScopedViewSet):
    serializer_class = UnitSerializer
    required_perm = "manage_products"

    def get_queryset(self):
        return Unit.objects.all()


from .services import ProductService

class ProductViewSet(TenantScopedViewSet):
    serializer_class = ProductSerializer
    required_perm = "manage_products"

    def get_queryset(self):
        params = self.request.query_params
        low_stock = params.get("low_stock") in {"1", "true"}
        search = params.get("search")
        qs = ProductService.get_catalog_queryset(low_stock=low_stock, search=search)
        ordering = params.get("ordering")
        allowed = {
            "current_stock", "-current_stock", "name", "-name", "sku", "-sku",
            "cost_price", "-cost_price", "selling_price", "-selling_price",
        }
        if ordering in allowed:
            qs = qs.order_by(ordering, "name")
        return qs

    def perform_update(self, serializer):
        old_price = self.get_object().selling_price
        product = serializer.save()
        
        # Cascade selling price changes to all unsold stock units
        if product.selling_price != old_price:
            ProductUnit.objects.filter(
                product=product,
                status=ProductUnit.Status.IN_STOCK
            ).update(selling_price=product.selling_price)


class ProductVariationViewSet(TenantScopedViewSet):
    serializer_class = ProductVariationSerializer
    required_perm = "manage_products"

    def get_queryset(self):
        return ProductVariation.objects.select_related("product")
