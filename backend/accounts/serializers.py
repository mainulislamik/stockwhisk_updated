from rest_framework import serializers

from tenants.models import Shop

from .models import User


class ShopRegistrationSerializer(serializers.Serializer):
    """Public self-service shop signup payload."""

    shop_name = serializers.CharField(max_length=150)
    owner_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    owner_email = serializers.EmailField()
    owner_password = serializers.CharField(write_only=True, min_length=8)
    business_type = serializers.ChoiceField(
        choices=Shop.BusinessType.choices, default=Shop.BusinessType.GENERAL
    )
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    address = serializers.CharField(max_length=500, required=False, allow_blank=True)
    referral_code = serializers.CharField(max_length=20, required=False, allow_blank=True)

    def validate_owner_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value


class VerifyOTPRegistrationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6)


class RequestPasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        if not User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("No user found with this email.")
        return value


class VerifyPasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6)
    new_password = serializers.CharField(write_only=True, min_length=8)


class UserSerializer(serializers.ModelSerializer):
    shop_name = serializers.CharField(source="shop.name", read_only=True, default=None)
    shop_phone = serializers.CharField(source="shop.phone", read_only=True, default=None)
    shop_code = serializers.CharField(source="shop.shop_code", read_only=True, default=None)
    shop_logo = serializers.SerializerMethodField()
    shop_emi_enabled = serializers.BooleanField(source="shop.emi_enabled", read_only=True, default=False)
    shop_delivery_enabled = serializers.BooleanField(source="shop.delivery_enabled", read_only=True, default=True)
    shop_whatsapp_enabled = serializers.BooleanField(source="shop.whatsapp_invoice_enabled", read_only=True, default=True)
    shop_is_demo = serializers.BooleanField(source="shop.is_demo", read_only=True, default=False)
    shop_barcode_prefix = serializers.CharField(source="shop.effective_barcode_prefix", read_only=True, default="")
    # True when this user is an approved (active) reseller — lets the normal login
    # panel route them to the reseller portal instead of the (shop-less) app.
    is_reseller = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "phone",
            "role", "shop", "shop_name", "shop_code", "shop_phone", "shop_logo",
            "shop_emi_enabled", "shop_delivery_enabled", "shop_whatsapp_enabled", "shop_is_demo", "shop_barcode_prefix", "branch", "is_staff",
            "is_reseller",
        ]
        read_only_fields = ["id", "email", "role", "shop", "shop_name", "shop_code", "shop_phone", "shop_logo", "shop_emi_enabled", "shop_delivery_enabled", "shop_whatsapp_enabled", "shop_is_demo", "shop_barcode_prefix", "branch", "is_staff", "is_reseller"]

    def get_is_reseller(self, obj):
        profile = getattr(obj, "reseller_profile", None)
        return bool(profile and profile.status == "active")

    def get_shop_logo(self, obj):
        if obj.shop and obj.shop.logo:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.shop.logo.url)
            return obj.shop.logo.url
        return None


class ShopSettingsSerializer(serializers.ModelSerializer):
    shop_code = serializers.CharField(read_only=True, default=None)

    class Meta:
        model = Shop
        fields = [
            "id", "shop_code", "name", "phone", "email", "address", "business_type",
            "currency", "vat_enabled", "vat_percent", "vat_registration_no",
            "invoice_settings", "logo", "emi_enabled", "delivery_enabled", "whatsapp_invoice_enabled", "barcode_prefix"
        ]
        read_only_fields = ["id", "shop_code"]

    def validate_barcode_prefix(self, value):
        cleaned = "".join(c for c in (value or "").upper() if c.isalnum())[:5]
        if cleaned and len(cleaned) < 2:
            raise serializers.ValidationError("Prefix must be at least 2 letters/digits.")
        return cleaned


class ShopUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "phone",
            "role", "is_active", "password", "last_login"
        ]
        read_only_fields = ["id", "last_login"]

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        if not password:
            # Fallback to random password if none provided
            password = User.objects.make_random_password()
        
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        
        # Inject the generated password back into the representation 
        # so the frontend can display it to the owner once.
        user._generated_password = password
        return user

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if hasattr(instance, "_generated_password"):
            data["temporary_password"] = instance._generated_password
        return data
