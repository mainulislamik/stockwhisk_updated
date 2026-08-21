from rest_framework.decorators import action
from rest_framework.response import Response

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

    @action(detail=False, methods=["get"], url_path="warranty-groups")
    def warranty_groups(self, request):
        """In-stock units grouped by product + effective warranty duration, so a
        product whose units carry different warranties shows one row per duration."""
        from collections import defaultdict

        units = (
            self.get_queryset()
            .filter(status=ProductUnit.Status.IN_STOCK)
            .values("product_id", "product__name", "product__sku",
                    "warranty_months", "product__warranty_months")
        )
        counts = defaultdict(int)
        meta = {}
        for u in units:
            eff = u["warranty_months"] or u["product__warranty_months"] or 0
            if eff <= 0:
                continue
            key = (u["product_id"], eff)
            counts[key] += 1
            meta[key] = (u["product__name"], u["product__sku"])

        result = [{
            "product_id": pid,
            "product_name": meta[(pid, eff)][0],
            "sku": meta[(pid, eff)][1],
            "warranty_months": eff,
            "count": c,
        } for (pid, eff), c in counts.items()]
        result.sort(key=lambda r: (r["product_name"] or "", -r["warranty_months"]))
        return Response(result)



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
    # Browsing/searching/selecting products (POS grid, product lists) only needs
    # read access; creating/editing/deleting still needs manage_products.
    required_perm = "view_products"
    required_write_perm = "manage_products"

    def get_queryset(self):
        params = self.request.query_params
        low_stock = params.get("low_stock") in {"1", "true"}
        search = params.get("search")
        light = params.get("light") in {"1", "true"}
        qs = ProductService.get_catalog_queryset(low_stock=low_stock, search=search, light=light)
        if params.get("in_stock") in {"1", "true"}:
            from django.db.models import Q
            qs = qs.filter(Q(track_inventory=False) | Q(current_stock__gt=0))
        ordering = params.get("ordering")
        allowed = {
            "current_stock", "-current_stock", "name", "-name", "sku", "-sku",
            "cost_price", "-cost_price", "selling_price", "-selling_price",
        }
        if ordering in allowed:
            qs = qs.order_by(ordering, "name")
        return qs

    def perform_update(self, serializer):
        old_product = self.get_object()
        old_selling = old_product.selling_price
        old_cost = old_product.cost_price
        product = serializer.save()
        
        # Cascade selling price changes to all unsold stock units
        if product.selling_price != old_selling:
            ProductUnit.objects.filter(
                product=product,
                status=ProductUnit.Status.IN_STOCK
            ).update(selling_price=product.selling_price)

        # Record price audit trail
        if product.selling_price != old_selling or product.cost_price != old_cost:
            from audit.models import AuditLog
            from audit.services import record
            changes = {}
            if product.selling_price != old_selling:
                changes["selling_price"] = [str(old_selling), str(product.selling_price)]
            if product.cost_price != old_cost:
                changes["cost_price"] = [str(old_cost), str(product.cost_price)]
            record(
                action=AuditLog.Action.PRICE_CHANGE,
                actor=self.request.user,
                shop=product.shop,
                target_model="Product",
                target_id=str(product.id),
                description=f"Updated prices for {product.name}",
                changes=changes,
            )

    def destroy(self, request, *args, **kwargs):
        from django.db.models import ProtectedError
        from rest_framework import status
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "Cannot delete this product because it has existing sales, purchases, or inventory transaction history."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"], url_path="export-csv")
    def export_csv(self, request):
        """Export full inventory list to CSV for spreadsheet reporting."""
        import csv
        from django.http import HttpResponse

        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="inventory_stock.csv"'
        writer = csv.writer(response)
        writer.writerow(["ID", "Name", "SKU", "Barcode", "Category", "Cost Price", "Selling Price", "Stock", "Inventory Value"])

        qs = self.get_queryset()
        for p in qs:
            cat_name = p.category.name if getattr(p, "category", None) else ""
            cost = p.cost_price or 0
            stock = p.current_stock or 0
            inv_val = cost * stock
            writer.writerow([p.id, p.name, p.sku, p.barcode or "", cat_name, cost, p.selling_price, stock, inv_val])

        return response


class ProductVariationViewSet(TenantScopedViewSet):
    serializer_class = ProductVariationSerializer
    required_perm = "manage_products"

    def get_queryset(self):
        return ProductVariation.objects.select_related("product")
