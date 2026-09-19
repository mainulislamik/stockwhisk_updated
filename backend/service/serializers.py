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
    product_name = serializers.CharField(source="product.display_name", read_only=True)
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

    def validate(self, attrs):
        warranty = attrs.get("warranty")
        if warranty:
            from django.utils import timezone
            from .models import Warranty
            if warranty.status in [Warranty.Status.EXPIRED, Warranty.Status.VOID]:
                raise serializers.ValidationError(f"Cannot file claim on a {warranty.get_status_display().lower()} warranty.")
            if warranty.expiry_date and warranty.expiry_date < timezone.localdate():
                raise serializers.ValidationError("This warranty has already expired.")
        return attrs


class TicketPartSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.display_name", read_only=True)
    product_barcode = serializers.CharField(source="product.barcode", read_only=True, default="")
    product_sku = serializers.CharField(source="product.sku", read_only=True, default="")
    warranty_months = serializers.IntegerField(source="product.warranty_months", read_only=True, default=None)
    line_total = serializers.ReadOnlyField()

    class Meta:
        model = ServiceTicketPart
        fields = [
            "id", "product", "product_name", "product_barcode", "product_sku",
            "warranty_months", "quantity", "unit_cost", "unit_price", "line_total", "from_stock"
        ]


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
            "id", "ticket_no", "track_token", "branch", "customer", "customer_name", "customer_phone",
            "device_description", "imei_serial", "complaint",
            "received_at", "technician", "status", "service_charge", "discount", "estimated_delivery",
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
    imei_serial = serializers.CharField(max_length=60, required=False, allow_blank=True)
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


from .models import (
    ServiceJob,
    ServiceJobMaterial,
    ServiceJobStatusHistory,
)


class ServiceJobMaterialSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)

    class Meta:
        model = ServiceJobMaterial
        fields = [
            "id", "product", "product_name", "product_sku",
            "quantity", "unit_cost", "subtotal", "from_stock", "created_at"
        ]


class ServiceJobStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ServiceJobStatusHistory
        fields = ["id", "from_status", "to_status", "note", "changed_by_name", "created_at"]

    def get_changed_by_name(self, obj):
        if obj.changed_by:
            return obj.changed_by.get_full_name() or obj.changed_by.username
        return "System"


class ServiceJobSerializer(serializers.ModelSerializer):
    materials = ServiceJobMaterialSerializer(many=True, read_only=True)
    history = ServiceJobStatusHistorySerializer(many=True, read_only=True)
    created_by_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ServiceJob
        fields = [
            "id", "job_number", "track_token", "branch", "customer",
            "customer_name", "customer_phone", "service_type", "reference_no",
            "specifications", "govt_fee", "service_charge", "material_cost",
            "other_charge", "discount", "total_bill", "advance_paid", "due_amount",
            "status", "status_display", "delivery_date", "actual_delivery_date",
            "notes", "created_by", "created_by_name", "materials", "history",
            "created_at", "updated_at"
        ]
        read_only_fields = ["job_number", "track_token", "total_bill", "due_amount", "created_by"]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return "Staff"


class ServiceJobCreateSerializer(serializers.Serializer):
    customer = serializers.PrimaryKeyRelatedField(queryset=Customer.objects, required=False, allow_null=True)
    customer_name = serializers.CharField(max_length=150)
    customer_phone = serializers.CharField(max_length=30)
    service_type = serializers.CharField(max_length=100)
    reference_no = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    specifications = serializers.DictField(required=False, default=dict)
    govt_fee = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    service_charge = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    other_charge = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    discount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    advance_paid = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    payment_method = serializers.CharField(required=False, default="cash")
    delivery_date = serializers.DateTimeField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class ServiceJobStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=ServiceJob.Status.choices)
    note = serializers.CharField(required=False, allow_blank=True, default="")


class ServiceJobPaymentSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    payment_method = serializers.CharField(required=False, default="cash")
    note = serializers.CharField(required=False, allow_blank=True, default="")


class ServiceJobMaterialInputSerializer(serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects)
    quantity = serializers.DecimalField(max_digits=12, decimal_places=2, default=1)
    unit_cost = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    from_stock = serializers.BooleanField(default=True)
