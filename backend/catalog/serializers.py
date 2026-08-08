from rest_framework import serializers

from .models import Brand, Category, Product, ProductVariation, Unit, ProductUnit


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
        fields = ["id", "name", "short_code"]


class ProductVariationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariation
        fields = [
            "id", "product", "name", "attributes", "sku", "barcode",
            "cost_price", "selling_price", "current_stock", "is_active",
        ]
        read_only_fields = ["current_stock"]


class ProductSerializer(serializers.ModelSerializer):
    variations = ProductVariationSerializer(many=True, read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    units = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "name", "sku", "barcode", "category", "brand", "unit",
            "description", "cost_price", "selling_price", "tax_percent",
            "track_inventory", "reorder_level", "current_stock",
            "is_low_stock", "is_active", "variations", "warranty_months",
            "units",
        ]
        read_only_fields = ["current_stock", "is_low_stock"]

    def get_units(self, obj):
        if not getattr(obj, "track_inventory", True):
            return []
        units = obj.units.filter(status=ProductUnit.Status.IN_STOCK)
        return ProductUnitSerializer(units, many=True).data

class ProductUnitSerializer(serializers.ModelSerializer):
    effective_cost_price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    effective_selling_price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    effective_warranty_months = serializers.IntegerField(read_only=True)

    class Meta:
        model = ProductUnit
        fields = [
            'id', 'product', 'barcode', 'status', 'cost_price', 'selling_price', 
            'warranty_months', 'effective_cost_price', 'effective_selling_price', 
            'effective_warranty_months', 'created_at'
        ]
        read_only_fields = ['id', 'effective_cost_price', 'effective_selling_price', 'effective_warranty_months', 'created_at']