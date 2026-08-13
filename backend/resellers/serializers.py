from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import ResellerCommission, ResellerProfile

User = get_user_model()


class ResellerRegisterSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    company_name = serializers.CharField(max_length=180, required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    country = serializers.CharField(max_length=80, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value.lower()

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        validate_password(attrs["password"])
        return attrs


class ResellerProfileSerializer(serializers.ModelSerializer):
    """Reseller's own profile. Identity/rate/status fields are read-only."""
    email = serializers.EmailField(source="user.email", read_only=True)
    full_name = serializers.SerializerMethodField()
    referral_link = serializers.CharField(read_only=True)

    class Meta:
        model = ResellerProfile
        fields = [
            "reseller_code", "referral_code", "referral_link", "email", "full_name",
            "company_name", "phone", "address", "country",
            "commission_rate", "status",
        ]
        # Reseller may only edit contact fields; never identity/rate/status.
        read_only_fields = ["reseller_code", "referral_code", "commission_rate", "status"]

    def get_full_name(self, obj):
        return (f"{obj.user.first_name} {obj.user.last_name}").strip() or obj.user.email


class ResellerShopSummarySerializer(serializers.Serializer):
    """Read-only, minimal shop info for a reseller. No secrets/credentials."""
    id = serializers.IntegerField()
    name = serializers.CharField()
    code = serializers.CharField(source="slug", required=False)
    owner_name = serializers.SerializerMethodField()
    plan = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    on_trial = serializers.SerializerMethodField()
    trial_ends_at = serializers.DateTimeField(required=False)
    created_at = serializers.DateTimeField(required=False)
    attributed_at = serializers.DateTimeField(source="reseller_attributed_at", required=False)

    def get_owner_name(self, obj):
        owner = obj.users.filter(role="owner").first() if hasattr(obj, "users") else None
        if not owner:
            return ""
        return (f"{owner.first_name} {owner.last_name}").strip() or owner.email

    def get_plan(self, obj):
        return getattr(getattr(obj, "plan", None), "name", "") or ""

    def get_on_trial(self, obj):
        return bool(getattr(obj, "on_trial", False))

    def get_status(self, obj):
        if not getattr(obj, "is_active", True):
            return "suspended"
        return "trial" if getattr(obj, "on_trial", False) else "active"


class ResellerCommissionSerializer(serializers.ModelSerializer):
    period = serializers.SerializerMethodField()

    class Meta:
        model = ResellerCommission
        fields = [
            "id", "period", "period_year", "period_month", "shop_name",
            "gross_profit", "commission_rate", "commission_amount", "status",
            "approved_at", "paid_at", "payment_reference", "created_at",
        ]

    def get_period(self, obj):
        return f"{obj.period_year}-{obj.period_month:02d}"
