from rest_framework import serializers

from .models import Customer


class CustomerSerializer(serializers.ModelSerializer):
    days_since_last_purchase = serializers.IntegerField(read_only=True)

    class Meta:
        model = Customer
        fields = [
            "id", "name", "phone", "email", "address", "segment",
            "due_balance", "credit_limit", "total_purchased", "last_purchase_at",
            "date_of_birth", "anniversary_date",
            "days_since_last_purchase", "is_active",
        ]
        read_only_fields = ["due_balance", "total_purchased", "last_purchase_at"]

    def validate_phone(self, value):
        value = value.strip()
        if not value:
            return value
        
        qs = Customer.objects.filter(phone=value)
        if self.instance:
            qs = qs.exclude(id=self.instance.id)
            
        if qs.exists():
            raise serializers.ValidationError("A customer with this mobile number already exists.")
            
        return value
