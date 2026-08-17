from rest_framework import serializers

from catalog.models import Product
from crm.models import Customer

from .models import (
    ServiceTicket,
    ServiceTicketPart,
    ServiceTicketStatusHistory,
    Warranty,
    WarrantyClaim,
)


class WarrantySerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True, default=None)

    class Meta:
        model = Warranty
        fields = [
            "id", "sale_item", "product", "product_name", "customer", "customer_name",
            "serial_no", "period_months", "start_date", "expiry_date", "terms", "status",
        ]
        read_only_fields = ["expiry_date"]


class WarrantyClaimSerializer(serializers.ModelSerializer):
    class Meta:
        model = WarrantyClaim
        fields = ["id", "warranty", "claim_date", "issue_description", "resolution", "resolved_by", "status"]


class TicketPartSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    warranty_months = serializers.IntegerField(source="product.warranty_months", read_only=True, default=None)
    line_total = serializers.ReadOnlyField()

    class Meta:
        model = ServiceTicketPart
        fields = ["id", "product", "product_name", "warranty_months", "quantity", "unit_cost", "unit_price", "line_total", "from_stock"]


class TicketHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceTicketStatusHistory
        fields = ["id", "from_status", "to_status", "note", "changed_by", "created_at"]


class ServiceTicketSerializer(serializers.ModelSerializer):
    parts = TicketPartSerializer(many=True, read_only=True)
    history = TicketHistorySerializer(many=True, read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    parts_total = serializers.ReadOnlyField()
    bill_total = serializers.ReadOnlyField()
    due = serializers.ReadOnlyField()

    class Meta:
        model = ServiceTicket
        fields = [
            "id", "ticket_no", "branch", "customer", "customer_name", "customer_phone",
            "device_description", "complaint",
            "received_at", "technician", "status", "service_charge", "estimated_delivery",
            "actual_delivery", "is_overdue", "parts", "history", "created_at",
            "paid", "parts_total", "bill_total", "due",
        ]
        read_only_fields = ["ticket_no", "actual_delivery", "status"]

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        # If walk-in fields are empty, fall back to the registered Customer record.
        if not rep.get("customer_name") and instance.customer_id:
            rep["customer_name"] = instance.customer.name
        if not rep.get("customer_phone") and instance.customer_id:
            rep["customer_phone"] = instance.customer.phone
        return rep


class TicketCreateSerializer(serializers.Serializer):
    customer = serializers.PrimaryKeyRelatedField(queryset=Customer.objects, required=False, allow_null=True)
    # Walk-in identity captured directly on the ticket when no Customer record is used.
    customer_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    customer_phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    device_description = serializers.CharField(max_length=200)
    complaint = serializers.CharField()
    service_charge = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    advance_paid = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    estimated_delivery = serializers.DateField(required=False, allow_null=True)


class TicketPartInputSerializer(serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects)
    quantity = serializers.DecimalField(max_digits=12, decimal_places=2, default=1)
    unit_cost = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    # Customer sell price; defaults to the product's selling price when omitted.
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    from_stock = serializers.BooleanField(default=True)
