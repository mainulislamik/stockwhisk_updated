from rest_framework import serializers

from catalog.models import Product, ProductVariation
from crm.models import Customer

from .models import Payment, Sale, SaleItem, SaleReturn


class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True, default="")
    product_barcode = serializers.CharField(source="product.barcode", read_only=True, default="")
    product_warranty_months = serializers.IntegerField(source="product.warranty_months", read_only=True, default=0)
    product_replacement_guarantee_days = serializers.IntegerField(source="product.replacement_guarantee_days", read_only=True, default=0)
    unit_barcodes = serializers.SerializerMethodField()
    unit_warranties = serializers.SerializerMethodField()
    unit_replacement_guarantees = serializers.SerializerMethodField()

    def get_unit_barcodes(self, obj):
        if not getattr(obj, "sale", None):
            return []
        units = getattr(obj.sale, "units", None)
        if hasattr(units, "all"):
            units = units.all()
        if not units:
            return []
        return [u.barcode for u in units if u.product_id == obj.product_id]

    def get_unit_warranties(self, obj):
        if not getattr(obj, "sale", None):
            return []
        units = getattr(obj.sale, "units", None)
        if hasattr(units, "all"):
            units = units.all()
        if not units:
            return []
        return [
            u.warranty_months if u.warranty_months is not None else getattr(obj.product, "warranty_months", 0)
            for u in units if u.product_id == obj.product_id
        ]
    def get_unit_replacement_guarantees(self, obj):
        if not getattr(obj, "sale", None):
            return []
        units = getattr(obj.sale, "units", None)
        if hasattr(units, "all"):
            units = units.all()
        if not units:
            return []
        return [
            u.replacement_guarantee_days if u.replacement_guarantee_days is not None else getattr(obj.product, "replacement_guarantee_days", 0)
            for u in units if u.product_id == obj.product_id
        ]

    class Meta:
        model = SaleItem
        fields = [
            "id", "product", "product_name", "product_sku", "product_barcode", "product_warranty_months", "product_replacement_guarantee_days", "unit_barcodes", "unit_warranties", "unit_replacement_guarantees", "variation", "quantity",
            "unit_price", "unit_cost", "discount", "subtotal",
        ]
        read_only_fields = ["unit_cost", "subtotal"]


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ["id", "amount", "method", "paid_at", "note"]


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    due = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True, default=None)
    bill_name = serializers.SerializerMethodField()
    bill_phone = serializers.SerializerMethodField()

    def get_bill_name(self, obj):
        return obj.bill_name

    def get_bill_phone(self, obj):
        return obj.bill_phone

    class Meta:
        model = Sale
        fields = [
            "id", "invoice_no", "customer", "customer_name", "bill_name", "bill_phone",
            "branch", "sale_date",
            "subtotal", "discount", "delivery_charge", "tax", "total", "paid", "due", "status",
            "note", "items", "payments", "created_at",
        ]
        read_only_fields = fields


# ---- Input serializers for the checkout service -----------------------------

class SaleItemInputSerializer(serializers.Serializer):
    # Pass the MANAGER (not .all()) so tenant scoping resolves per-request,
    # not at import time when no tenant is in context.
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects)
    variation = serializers.PrimaryKeyRelatedField(
        queryset=ProductVariation.objects, required=False, allow_null=True
    )
    quantity = serializers.DecimalField(max_digits=14, decimal_places=2)
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    discount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    unit_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list
    )


class PaymentInputSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    method = serializers.ChoiceField(choices=Payment.Method.choices, default=Payment.Method.CASH)


class SaleCreateSerializer(serializers.Serializer):
    customer = serializers.PrimaryKeyRelatedField(
        queryset=Customer.objects, required=False, allow_null=True
    )
    discount = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, default=0)
    delivery_charge = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, default=0)
    tax = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, default=0)
    note = serializers.CharField(required=False, allow_blank=True, default="")
    items = SaleItemInputSerializer(many=True)
    payments = PaymentInputSerializer(many=True, required=False, default=list)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("A sale needs at least one item.")
        return value


class ReturnLineInputSerializer(serializers.Serializer):
    sale_item = serializers.PrimaryKeyRelatedField(queryset=SaleItem.objects)
    quantity = serializers.DecimalField(max_digits=14, decimal_places=2)


class SaleReturnInputSerializer(serializers.Serializer):
    lines = ReturnLineInputSerializer(many=True)
    reason = serializers.CharField(required=False, allow_blank=True, default="")
    refund_method = serializers.ChoiceField(
        choices=SaleReturn.RefundMethod.choices, default=SaleReturn.RefundMethod.CASH
    )
    refund_reference = serializers.CharField(required=False, allow_blank=True, default="")
    restock = serializers.BooleanField(default=True)
    exchange_items = SaleItemInputSerializer(many=True, required=False, default=list)

    def validate_lines(self, value):
        if not value:
            raise serializers.ValidationError("At least one return line is required.")
        return value


class SaleReturnSerializer(serializers.ModelSerializer):
    class Meta:
        model = SaleReturn
        fields = [
            "id", "sale", "reason", "total_refund", "refund_method",
            "refund_reference", "exchange_sale", "created_at",
        ]
