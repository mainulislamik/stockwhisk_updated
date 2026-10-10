"""
Integration Foundation Serializers.

Provides clean representations of integrations, sync jobs, and events.
Ensures that credentials are NEVER exposed in plain text.
"""
from rest_framework import serializers

from .models import (
    CourierAccount,
    CourierCredential,
    CourierProvider,
    CourierShipment,
    ExternalOrder,
    Integration,
    IntegrationAuditLog,
    IntegrationCategory,
    IntegrationCredential,
    IntegrationEvent,
    IntegrationLog,
    IntegrationProvider,
    IntegrationStatus,
    InventoryReservation,
    ProductChannelMapping,
    SyncError,
    SyncJob,
    WebhookEndpoint,
)


class IntegrationCredentialSerializer(serializers.ModelSerializer):
    """Safe read-only serializer showing only masked credential overview."""
    overview = serializers.SerializerMethodField()

    class Meta:
        model = IntegrationCredential
        fields = ["overview", "created_at", "updated_at"]
        read_only_fields = fields

    def get_overview(self, obj):
        return obj.get_masked_overview()


class IntegrationSerializer(serializers.ModelSerializer):
    credentials_overview = serializers.SerializerMethodField()
    webhook_endpoint = serializers.SerializerMethodField()
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    provider_display = serializers.CharField(source="get_provider_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Integration
        fields = [
            "id",
            "name",
            "category",
            "category_display",
            "provider",
            "provider_display",
            "status",
            "status_display",
            "is_active",
            "base_url",
            "webhook_slug",
            "config",
            "connected_at",
            "last_synced_at",
            "last_error_at",
            "error_message",
            "credentials_overview",
            "webhook_endpoint",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "category_display",
            "provider_display",
            "status_display",
            "connected_at",
            "last_synced_at",
            "last_error_at",
            "error_message",
            "credentials_overview",
            "webhook_endpoint",
            "created_at",
            "updated_at",
        ]

    def get_credentials_overview(self, obj):
        if hasattr(obj, "credential"):
            return obj.credential.get_masked_overview()
        return {"is_configured": False}

    def get_webhook_endpoint(self, obj):
        from .models import WebhookEndpoint
        endpoint = WebhookEndpoint.all_objects.filter(shop=obj.shop, integration=obj, is_active=True).first()
        if endpoint:
            return {
                "id": str(endpoint.id),
                "name": endpoint.name,
                "url": f"/api/integrations/webhooks/{endpoint.id}/",
                "secret_token": endpoint.secret_token,
                "is_active": endpoint.is_active,
            }
        return None


class IntegrationCreateSerializer(serializers.Serializer):
    """Payload serializer for creating an integration with optional credentials."""
    name = serializers.CharField(max_length=120)
    category = serializers.ChoiceField(choices=IntegrationCategory.choices)
    provider = serializers.ChoiceField(choices=IntegrationProvider.choices)
    base_url = serializers.URLField(required=False, allow_blank=True)
    config = serializers.DictField(required=False, default=dict)

    # Optional initial credentials
    api_key = serializers.CharField(required=False, allow_blank=True, write_only=True)
    api_secret = serializers.CharField(required=False, allow_blank=True, write_only=True)
    access_token = serializers.CharField(required=False, allow_blank=True, write_only=True)
    webhook_secret = serializers.CharField(required=False, allow_blank=True, write_only=True)
    extra = serializers.DictField(required=False, write_only=True)


class IntegrationCredentialUpdateSerializer(serializers.Serializer):
    """Payload serializer for updating credentials. Write-only secrets."""
    api_key = serializers.CharField(required=False, allow_blank=True, write_only=True)
    api_secret = serializers.CharField(required=False, allow_blank=True, write_only=True)
    access_token = serializers.CharField(required=False, allow_blank=True, write_only=True)
    webhook_secret = serializers.CharField(required=False, allow_blank=True, write_only=True)
    extra = serializers.DictField(required=False, write_only=True)


class IntegrationLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = IntegrationLog
        fields = [
            "id",
            "level",
            "action",
            "message",
            "details",
            "created_at",
        ]
        read_only_fields = fields


class IntegrationAuditLogSerializer(serializers.ModelSerializer):
    shop_id = serializers.IntegerField(source="shop.id", read_only=True)
    shop_name = serializers.CharField(source="shop.name", read_only=True)
    action_display = serializers.CharField(source="get_action_display", read_only=True)
    integration_name = serializers.CharField(source="integration.name", read_only=True, default=None)
    courier_account_name = serializers.CharField(source="courier_account.name", read_only=True, default=None)
    actor_email = serializers.CharField(source="actor.email", read_only=True, default=None)
    details = serializers.SerializerMethodField()
    changes = serializers.SerializerMethodField()

    class Meta:
        model = IntegrationAuditLog
        fields = [
            "id",
            "shop_id",
            "shop_name",
            "integration",
            "integration_name",
            "courier_account",
            "courier_account_name",
            "action",
            "action_display",
            "event_type",
            "internal_id",
            "external_id",
            "status",
            "attempt_count",
            "duration_ms",
            "error_type",
            "error_message",
            "http_status",
            "correlation_id",
            "request_id",
            "actor",
            "actor_email",
            "description",
            "details",
            "changes",
            "created_at",
        ]
        read_only_fields = fields

    def get_details(self, obj):
        from .audit import sanitize_audit_payload
        return sanitize_audit_payload(obj.details)

    def get_changes(self, obj):
        from .audit import sanitize_audit_payload
        return sanitize_audit_payload(obj.changes)


class SyncJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = SyncJob
        fields = [
            "id",
            "job_type",
            "status",
            "started_at",
            "finished_at",
            "items_processed",
            "items_failed",
            "error_summary",
            "metadata",
            "created_at",
        ]
        read_only_fields = fields


class WebhookEndpointSerializer(serializers.ModelSerializer):
    webhook_url = serializers.SerializerMethodField()
    secret_token = serializers.CharField(write_only=True, required=False, allow_blank=True)
    has_secret_token = serializers.SerializerMethodField()
    masked_secret = serializers.SerializerMethodField()

    class Meta:
        model = WebhookEndpoint
        fields = [
            "id",
            "integration",
            "name",
            "is_active",
            "secret_token",
            "has_secret_token",
            "masked_secret",
            "subscribed_events",
            "max_retries",
            "retry_delay_seconds",
            "webhook_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "webhook_url", "has_secret_token", "masked_secret", "created_at", "updated_at"]

    def get_webhook_url(self, obj):
        request = self.context.get("request")
        path = f"/api/integrations/webhooks/{obj.id}/"
        if request:
            return request.build_absolute_uri(path)
        return path

    def get_has_secret_token(self, obj) -> bool:
        return bool(obj.secret_token and obj.secret_token.strip())

    def get_masked_secret(self, obj) -> str:
        if not obj.secret_token or not obj.secret_token.strip():
            return "None"
        token = obj.secret_token.strip()
        if len(token) <= 8:
            return "********"
        return f"{token[:4]}****{token[-4:]}"


class IntegrationEventSerializer(serializers.ModelSerializer):
    error_category = serializers.SerializerMethodField()

    class Meta:
        model = IntegrationEvent
        fields = [
            "id",
            "external_event_id",
            "event_type",
            "status",
            "attempt_count",
            "max_retries",
            "error_category",
            "error_message",
            "error_details",
            "received_at",
            "authenticated_at",
            "validated_at",
            "queued_at",
            "processing_started_at",
            "processed_at",
            "last_retry_at",
            "next_retry_at",
            "created_at",
        ]
        read_only_fields = fields

    def get_error_category(self, obj):
        if isinstance(obj.error_details, dict):
            return obj.error_details.get("category", "")
        return ""


class ProductChannelMappingSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    variation_name = serializers.CharField(source="variation.name", read_only=True, default=None)
    integration_name = serializers.CharField(source="integration.name", read_only=True, default="")
    integration_platform = serializers.CharField(source="integration.platform", read_only=True, default="")
    product_sku = serializers.CharField(source="product.sku", read_only=True, default="")
    status = serializers.CharField(source="sync_status", read_only=True)
    sync_inventory_enabled = serializers.BooleanField(source="sync_inventory", required=False)
    last_inventory_sync_at = serializers.DateTimeField(source="last_synced_at", read_only=True)

    class Meta:
        model = ProductChannelMapping
        fields = [
            "id",
            "integration",
            "integration_name",
            "integration_platform",
            "product",
            "variation",
            "product_name",
            "variation_name",
            "product_sku",
            "internal_sku",
            "external_product_id",
            "external_variation_id",
            "external_sku",
            "sync_status",
            "status",
            "is_sync_enabled",
            "sync_inventory",
            "sync_inventory_enabled",
            "error_message",
            "last_synced_at",
            "last_inventory_sync_at",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "internal_sku", "error_message", "created_at", "updated_at"]


class SyncErrorSerializer(serializers.ModelSerializer):
    class Meta:
        model = SyncError
        fields = [
            "id",
            "job",
            "integration",
            "mapping",
            "error_type",
            "error_code",
            "status_code",
            "error_message",
            "raw_payload",
            "is_resolved",
            "resolved_at",
            "retry_count",
            "created_at",
        ]
        read_only_fields = fields


class InventoryReservationSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = InventoryReservation
        fields = [
            "id",
            "integration",
            "product",
            "variation",
            "product_name",
            "quantity",
            "reference_type",
            "reference_id",
            "status",
            "expires_at",
            "metadata",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class ExternalOrderSerializer(serializers.ModelSerializer):
    integration_name = serializers.CharField(source="integration.name", read_only=True)
    sale_invoice_no = serializers.CharField(source="sale.invoice_no", read_only=True, default=None)

    class Meta:
        model = ExternalOrder
        fields = [
            "id",
            "integration",
            "integration_name",
            "sale",
            "sale_invoice_no",
            "customer",
            "external_order_id",
            "external_order_number",
            "external_status",
            "sync_status",
            "customer_name",
            "customer_phone",
            "customer_email",
            "shipping_address",
            "billing_address",
            "currency",
            "subtotal",
            "discount",
            "tax",
            "shipping_charge",
            "total",
            "paid_amount",
            "payment_method",
            "payment_status",
            "idempotency_key",
            "items_payload",
            "raw_payload",
            "error_message",
            "processed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "integration_name",
            "sale",
            "sale_invoice_no",
            "sync_status",
            "idempotency_key",
            "processed_at",
            "created_at",
            "updated_at",
        ]


class CourierAccountSerializer(serializers.ModelSerializer):
    """
    Subscriber-facing serializer for Courier Accounts.
    Strictly masks and protects all credentials.
    """
    provider_display = serializers.CharField(source="get_provider_display", read_only=True)
    has_credentials = serializers.SerializerMethodField()
    masked_credentials = serializers.SerializerMethodField()

    class Meta:
        model = CourierAccount
        fields = [
            "id",
            "name",
            "provider",
            "provider_display",
            "merchant_id",
            "is_active",
            "is_default",
            "default_pickup_address",
            "metadata",
            "has_credentials",
            "masked_credentials",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "provider_display",
            "has_credentials",
            "masked_credentials",
            "created_at",
            "updated_at",
        ]

    def get_has_credentials(self, obj):
        cred = getattr(obj, "credential", None)
        return bool(cred and cred.has_credentials())

    def get_masked_credentials(self, obj):
        cred = getattr(obj, "credential", None)
        if not cred:
            return {}
        overview = cred.get_masked_overview()
        # Also include extra keys mask without exposing secrets
        try:
            raw_creds = cred.get_credentials()
            extra = raw_creds.get("extra") or {}
            overview.update({
                "has_client_id": bool(extra.get("client_id")),
                "has_client_secret": bool(extra.get("client_secret")),
                "has_username": bool(extra.get("username")),
                "has_password": bool(extra.get("password")),
                "has_store_id": bool(extra.get("store_id")),
                "store_id": extra.get("store_id", ""),
            })
        except Exception:
            pass
        return overview


class CourierAccountCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Write-only credential input serializer for configuring Courier Accounts.
    Credentials are encrypted upon receipt and never returned back in responses.
    """
    merchant_id = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="")
    api_key = serializers.CharField(write_only=True, required=False, allow_blank=True)
    api_secret = serializers.CharField(write_only=True, required=False, allow_blank=True)
    access_token = serializers.CharField(write_only=True, required=False, allow_blank=True)
    webhook_secret = serializers.CharField(write_only=True, required=False, allow_blank=True)
    client_id = serializers.CharField(write_only=True, required=False, allow_blank=True)
    client_secret = serializers.CharField(write_only=True, required=False, allow_blank=True)
    username = serializers.CharField(write_only=True, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    store_id = serializers.CharField(write_only=True, required=False, allow_blank=True)
    extra = serializers.DictField(write_only=True, required=False)

    def validate_merchant_id(self, value):
        return value or ""

    class Meta:
        model = CourierAccount
        fields = [
            "id",
            "name",
            "provider",
            "merchant_id",
            "is_active",
            "is_default",
            "default_pickup_address",
            "metadata",
            "api_key",
            "api_secret",
            "access_token",
            "webhook_secret",
            "client_id",
            "client_secret",
            "username",
            "password",
            "store_id",
            "extra",
        ]
        read_only_fields = ["id"]


class CourierShipmentSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for tracking Courier Shipments and delivery status.
    """
    account_name = serializers.CharField(source="account.name", read_only=True)
    provider = serializers.CharField(source="account.provider", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    sale_invoice_no = serializers.CharField(source="sale.invoice_no", read_only=True, default=None)
    external_order_number = serializers.CharField(
        source="external_order.external_order_number", read_only=True, default=None
    )

    class Meta:
        model = CourierShipment
        fields = [
            "id",
            "account",
            "account_name",
            "provider",
            "sale",
            "sale_invoice_no",
            "external_order",
            "external_order_number",
            "tracking_id",
            "consignment_id",
            "tracking_url",
            "status",
            "status_display",
            "raw_status",
            "cod_amount",
            "collected_amount",
            "delivery_fee",
            "cod_charge",
            "recipient_name",
            "recipient_phone",
            "recipient_address",
            "recipient_city",
            "recipient_zone",
            "recipient_area",
            "weight_kg",
            "item_description",
            "special_instruction",
            "pickup_store_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields




