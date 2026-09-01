from rest_framework import serializers

from .models import Brand, Category, Product, ProductVariation, Unit, ProductUnit

# Permissions that grant sight of internal cost/margin figures. A pure POS
# reader (view_products only, e.g. a Cashier) sees none of these.
COST_VIEW_PERMS = ("manage_products", "view_profit", "manage_purchasing")


def _can_view_cost(context) -> bool:
    request = context.get("request") if context else None
    user = getattr(request, "user", None)
    # Only interactive RBAC users (Cashier, Manager, …) get cost-filtered. API-key
    # / anonymous / service principals have no `has_perm_code` and keep the legacy
    # behaviour (cost visible) — so the public API and internal callers are unchanged.
    if user is None or not hasattr(user, "has_perm_code"):
        return True
    if not getattr(user, "is_authenticated", False):
        return True
    return any(user.has_perm_code(c) for c in COST_VIEW_PERMS)


class HideCostMixin:
    """Strips internal cost fields from the output for users who lack a
    cost-viewing permission. Only affects reads — write validation is untouched."""

    COST_FIELDS = ("cost_price", "effective_cost_price")

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not _can_view_cost(self.context):
            for field in self.COST_FIELDS:
                data.pop(field, None)
        return data


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "parent", "is_active"]


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ["id", "name", "is_active"]


class UnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
        fields = ["id", "name", "short_code", "measure_type", "allow_decimal"]


class ProductVariationSerializer(HideCostMixin, serializers.ModelSerializer):
    class Meta:
        model = ProductVariation
        fields = [
            "id", "product", "name", "attributes", "sku", "barcode",
            "cost_price", "selling_price", "current_stock", "is_active",
        ]
        read_only_fields = ["current_stock"]


class ProductSerializer(HideCostMixin, serializers.ModelSerializer):
    variations = ProductVariationSerializer(many=True, read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    unit_detail = serializers.SerializerMethodField()
    units = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "name", "sku", "barcode", "category", "brand", "unit",
            "purchase_unit", "purchase_multiplier",
            "description", "cost_price", "selling_price", "tax_percent",
            "track_inventory", "reorder_level", "current_stock",
            "is_low_stock", "is_active", "variations", "warranty_months",
            "replacement_guarantee_days",
            "units", "unit_detail",
        ]
        read_only_fields = ["current_stock", "is_low_stock"]

    def get_unit_detail(self, obj):
        if obj.unit_id is None:
            return None
        return {
            "id": obj.unit_id,
            "name": obj.unit.name if obj.unit_id else None,
            "short_code": getattr(obj.unit, "short_code", ""),
            "measure_type": getattr(obj.unit, "measure_type", "count"),
            "allow_decimal": getattr(obj.unit, "allow_decimal", False),
        }

    def get_units(self, obj):
        if not getattr(obj, "track_inventory", True):
            return []

        # Light mode (list/table views): skip units entirely for a small payload.
        request = self.context.get("request")
        if request is not None and request.query_params.get("light") in {"1", "true"}:
            return []

        # Use prefetched IN_STOCK units if available to prevent N+1 queries
        if hasattr(obj, "prefetched_in_stock_units"):
            units = obj.prefetched_in_stock_units
        else:
            units = obj.units.filter(status=ProductUnit.Status.IN_STOCK)
            
        # Pass context so the nested serializer can apply the same cost-hiding.
        return ProductUnitSerializer(units, many=True, context=self.context).data


class ProductUnitSerializer(HideCostMixin, serializers.ModelSerializer):
    effective_cost_price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    effective_selling_price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    effective_warranty_months = serializers.IntegerField(read_only=True)
    effective_replacement_guarantee_days = serializers.IntegerField(read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    sale_id = serializers.IntegerField(read_only=True, default=None)
    sale_invoice_no = serializers.SerializerMethodField()
    sold_at = serializers.DateTimeField(read_only=True)
    warranty_status = serializers.SerializerMethodField()
    repair_status = serializers.SerializerMethodField()

    class Meta:
        model = ProductUnit
        fields = [
            'id', 'product', 'barcode', 'status', 'cost_price', 'selling_price',
            'warranty_months', 'replacement_guarantee_days', 'effective_cost_price', 'effective_selling_price',
            'effective_warranty_months', 'effective_replacement_guarantee_days', 'product_name', 'created_at',
            'sale_id', 'sale_invoice_no', 'sold_at', 'warranty_status', 'repair_status',
        ]
        read_only_fields = ['id', 'effective_cost_price', 'effective_selling_price', 'effective_warranty_months', 'effective_replacement_guarantee_days', 'created_at']

    def get_sale_invoice_no(self, obj):
        return obj.sale.invoice_no if obj.sale_id and obj.sale else None

    def get_warranty_status(self, obj):
        from service.models import Warranty
        w = Warranty.all_objects.filter(product_unit_id=obj.id).order_by("-created_at").first()
        if not w:
            return None
        try:
            return str(w.compute_status())
        except Exception:
            return w.status

    def get_repair_status(self, obj):
        from service.models import ServiceTicket
        t = (ServiceTicket.all_objects.filter(warranty__product_unit_id=obj.id)
             .order_by("-created_at").first())
        return t.status if t else None