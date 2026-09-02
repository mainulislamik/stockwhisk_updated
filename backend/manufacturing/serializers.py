from decimal import Decimal
from rest_framework import serializers

from .models import BatchStatus, ProductionBatch, ProductionMaterial


class ProductionMaterialSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    unit_name = serializers.CharField(source="product.unit.name", read_only=True, default="Unit")
    unit_symbol = serializers.CharField(source="product.unit.symbol", read_only=True, default="")

    class Meta:
        model = ProductionMaterial
        fields = [
            "id",
            "product",
            "product_name",
            "product_sku",
            "variation",
            "quantity",
            "unit",
            "unit_name",
            "unit_symbol",
            "unit_cost",
            "subtotal",
        ]


class ProductionMaterialInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    variation_id = serializers.IntegerField(required=False, allow_null=True)
    quantity = serializers.DecimalField(max_digits=14, decimal_places=2)
    unit_cost = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)


class ProductionBatchSerializer(serializers.ModelSerializer):
    materials = ProductionMaterialSerializer(many=True, read_only=True)
    output_product_name = serializers.CharField(source="output_product.name", read_only=True, default=None)
    output_product_sku = serializers.CharField(source="output_product.sku", read_only=True, default=None)
    output_unit_name = serializers.CharField(source="output_product.unit.name", read_only=True, default="Unit")
    output_product_selling_price = serializers.DecimalField(
        source="output_product.selling_price", max_digits=12, decimal_places=2, read_only=True, default=0
    )
    created_by_name = serializers.SerializerMethodField()
    completed_by_name = serializers.SerializerMethodField()
    total_cost = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = ProductionBatch
        fields = [
            "id",
            "batch_number",
            "status",
            "started_at",
            "completed_at",
            "total_material_cost",
            "additional_cost",
            "additional_cost_note",
            "total_cost",
            "output_product",
            "output_product_name",
            "output_product_sku",
            "output_unit_name",
            "output_product_selling_price",
            "output_variation",
            "output_quantity",
            "calculated_unit_cost",
            "update_product_cost",
            "notes",
            "materials",
            "created_by",
            "created_by_name",
            "completed_by",
            "completed_by_name",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "batch_number",
            "status",
            "started_at",
            "completed_at",
            "total_material_cost",
            "calculated_unit_cost",
            "created_at",
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.email
        return None

    def get_completed_by_name(self, obj):
        if obj.completed_by:
            return f"{obj.completed_by.first_name} {obj.completed_by.last_name}".strip() or obj.completed_by.email
        return None


class ProductionBatchCreateSerializer(serializers.Serializer):
    materials = ProductionMaterialInputSerializer(many=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    additional_cost = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    additional_cost_note = serializers.CharField(required=False, allow_blank=True)


class ProductionBatchCompleteSerializer(serializers.Serializer):
    output_product_id = serializers.IntegerField()
    output_variation_id = serializers.IntegerField(required=False, allow_null=True)
    output_quantity = serializers.DecimalField(max_digits=14, decimal_places=2)
    additional_cost = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    additional_cost_note = serializers.CharField(required=False, allow_blank=True)
    update_product_cost = serializers.BooleanField(required=False, default=True)


class ProductionBatchCancelSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True)
