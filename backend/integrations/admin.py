"""
Django Admin Configuration for Integrations.
"""
from django.contrib import admin

from .models import (
    ExternalOrder,
    Integration,
    IntegrationAuditLog,
    IntegrationCredential,
    IntegrationEvent,
    IntegrationLog,
    InventoryReservation,
    ProductChannelMapping,
    SyncError,
    SyncJob,
    WebhookEndpoint,
)


@admin.register(Integration)
class IntegrationAdmin(admin.ModelAdmin):
    list_display = ["id", "name", "category", "provider", "shop", "status", "is_active", "connected_at", "last_synced_at"]
    list_filter = ["category", "provider", "status", "is_active", "shop"]
    search_fields = ["name", "base_url", "webhook_slug"]
    readonly_fields = ["connected_at", "last_synced_at", "last_error_at", "error_message", "created_at", "updated_at"]


@admin.register(IntegrationCredential)
class IntegrationCredentialAdmin(admin.ModelAdmin):
    list_display = ["id", "integration", "shop", "is_configured_display", "token_expires_at", "updated_at"]
    search_fields = ["integration__name"]
    readonly_fields = [
        "encrypted_api_key",
        "encrypted_api_secret",
        "encrypted_access_token",
        "encrypted_webhook_secret",
        "encrypted_extra",
        "created_at",
        "updated_at",
    ]

    def is_configured_display(self, obj):
        return obj.has_credentials()
    is_configured_display.boolean = True
    is_configured_display.short_description = "Configured"


@admin.register(IntegrationLog)
class IntegrationLogAdmin(admin.ModelAdmin):
    list_display = ["id", "integration", "shop", "level", "action", "message", "created_at"]
    list_filter = ["level", "action", "shop"]
    search_fields = ["message", "action", "integration__name"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(SyncJob)
class SyncJobAdmin(admin.ModelAdmin):
    list_display = ["id", "integration", "shop", "job_type", "status", "items_processed", "items_failed", "started_at", "finished_at"]
    list_filter = ["status", "job_type", "shop"]
    search_fields = ["job_type", "integration__name", "error_summary"]
    readonly_fields = ["started_at", "finished_at", "created_at", "updated_at"]


@admin.register(ProductChannelMapping)
class ProductChannelMappingAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "integration",
        "product",
        "variation",
        "external_product_id",
        "external_variation_id",
        "external_sku",
        "sync_status",
        "is_sync_enabled",
        "updated_at",
    ]
    list_filter = ["sync_status", "is_sync_enabled", "shop", "integration"]
    search_fields = ["product__name", "external_product_id", "external_sku", "internal_sku"]
    readonly_fields = ["id", "created_at", "updated_at"]


@admin.register(WebhookEndpoint)
class WebhookEndpointAdmin(admin.ModelAdmin):
    list_display = ["id", "name", "integration", "shop", "is_active", "max_retries", "created_at"]
    list_filter = ["is_active", "shop"]
    search_fields = ["name", "integration__name"]
    readonly_fields = ["id", "created_at", "updated_at"]


@admin.register(IntegrationEvent)
class IntegrationEventAdmin(admin.ModelAdmin):
    list_display = ["id", "integration", "shop", "external_event_id", "event_type", "status", "attempt_count", "created_at"]
    list_filter = ["status", "event_type", "shop"]
    search_fields = ["external_event_id", "event_type", "integration__name"]
    readonly_fields = ["created_at", "updated_at", "processed_at", "received_at", "authenticated_at", "validated_at", "queued_at", "processing_started_at"]


@admin.register(SyncError)
class SyncErrorAdmin(admin.ModelAdmin):
    list_display = ["id", "integration", "shop", "error_type", "error_code", "status_code", "is_resolved", "retry_count", "created_at"]
    list_filter = ["error_type", "is_resolved", "shop", "integration"]
    search_fields = ["error_type", "error_message", "error_code", "integration__name"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(InventoryReservation)
class InventoryReservationAdmin(admin.ModelAdmin):
    list_display = ["id", "integration", "shop", "product", "variation", "quantity", "status", "reference_type", "reference_id", "created_at"]
    list_filter = ["status", "shop", "integration"]
    search_fields = ["product__name", "reference_id", "reference_type"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(ExternalOrder)
class ExternalOrderAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "external_order_id",
        "external_order_number",
        "integration",
        "shop",
        "sync_status",
        "external_status",
        "customer_name",
        "total",
        "created_at",
    ]
    list_filter = ["sync_status", "external_status", "shop", "integration"]
    search_fields = ["external_order_id", "external_order_number", "customer_name", "customer_phone"]
    readonly_fields = ["id", "sale", "idempotency_key", "created_at", "updated_at"]


@admin.register(IntegrationAuditLog)
class IntegrationAuditLogAdmin(admin.ModelAdmin):
    list_display = ["id", "action", "shop", "status", "event_type", "internal_id", "external_id", "created_at"]
    list_filter = ["status", "action", "event_type", "shop"]
    search_fields = ["external_id", "internal_id", "correlation_id", "shop__name", "description"]
    readonly_fields = [
        "id",
        "shop",
        "integration",
        "courier_account",
        "action",
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
        "description",
        "details",
        "changes",
        "created_at",
        "updated_at",
    ]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


