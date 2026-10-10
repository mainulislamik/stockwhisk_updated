"""
StockWhisk Integration Platform Models.

Defines the foundational entities for external store and courier integrations:
- Integration: Master tenant-scoped integration account and lifecycle state.
- IntegrationCredential: Encrypted at rest (AES-256-GCM) credential container.
- IntegrationLog: Structured append-only audit and troubleshooting log.
- SyncJob: Asynchronous synchronization job tracker.
- IntegrationEvent: Generic inbound/outbound event store with idempotency dedup.
"""
from decimal import Decimal
from typing import Optional
import uuid

from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.db import models
from django.utils import timezone

from core.models import TenantScopedModel
from .crypto import (
    decrypt_dict,
    decrypt_secret,
    encrypt_dict,
    encrypt_secret,
    mask_credential,
)


class IntegrationCategory(models.TextChoices):
    ECOMMERCE = "ecommerce", "E-Commerce Store"
    COURIER = "courier", "Courier / Logistics"
    CUSTOM = "custom", "Custom Webhook / API"


class IntegrationProvider(models.TextChoices):
    WOOCOMMERCE = "woocommerce", "WooCommerce"
    SHOPIFY = "shopify", "Shopify"
    PATHAO = "pathao", "Pathao Courier"
    STEADFAST = "steadfast", "Steadfast Courier"
    REDX = "redx", "RedX"
    CUSTOM_WEBHOOK = "custom_webhook", "Custom Webhook"


class IntegrationStatus(models.TextChoices):
    DRAFT = "draft", "Draft / Unconfigured"
    CONNECTED = "connected", "Connected / Active"
    DISCONNECTED = "disconnected", "Disconnected"
    PAUSED = "paused", "Paused"
    ERROR = "error", "Error"


class Integration(TenantScopedModel):
    """
    Primary integration account representing a connection between a Shop (tenant)
    and an external e-commerce platform or courier service.
    """

    name = models.CharField(max_length=120, help_text="User-friendly name, e.g. 'Main WooCommerce Store'")
    category = models.CharField(max_length=30, choices=IntegrationCategory.choices, db_index=True)
    provider = models.CharField(max_length=40, choices=IntegrationProvider.choices, db_index=True)
    status = models.CharField(
        max_length=30,
        choices=IntegrationStatus.choices,
        default=IntegrationStatus.DRAFT,
        db_index=True,
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Master toggle. When False, all sync, webhooks, and dispatching are halted.",
    )
    base_url = models.URLField(
        blank=True,
        help_text="Remote platform base URL (e.g. 'https://mystore.com')",
    )
    webhook_slug = models.CharField(
        max_length=64,
        blank=True,
        db_index=True,
        help_text="Unique endpoint slug for receiving webhooks for this integration.",
    )
    config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Non-sensitive configuration (flags, sync options, rate limits).",
    )

    # Lifecycle & health tracking
    connected_at = models.DateTimeField(null=True, blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    last_error_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_integrations",
    )

    class Meta:
        ordering = ["-created_at"]
        unique_together = [("shop", "provider", "name")]
        indexes = [
            models.Index(fields=["shop", "category", "is_active"]),
            models.Index(fields=["shop", "status"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_provider_display()}) - Shop #{self.shop_id}"

    # Lifecycle management methods
    def mark_connected(self):
        self.status = IntegrationStatus.CONNECTED
        self.connected_at = timezone.now()
        self.error_message = ""
        self.save(update_fields=["status", "connected_at", "error_message", "updated_at"])

    def mark_error(self, message: str):
        self.status = IntegrationStatus.ERROR
        self.last_error_at = timezone.now()
        self.error_message = (message or "")[:2000]
        self.save(update_fields=["status", "last_error_at", "error_message", "updated_at"])

    def pause(self):
        self.status = IntegrationStatus.PAUSED
        self.save(update_fields=["status", "updated_at"])

    def resume(self):
        self.status = IntegrationStatus.CONNECTED
        self.error_message = ""
        self.save(update_fields=["status", "error_message", "updated_at"])

    def disconnect(self):
        self.status = IntegrationStatus.DISCONNECTED
        self.save(update_fields=["status", "updated_at"])


class IntegrationCredential(TenantScopedModel):
    """
    Encrypted credentials container for an Integration.
    All secrets are encrypted at rest using AES-256-GCM with tenant-derived HKDF keys.
    Values are NEVER exposed in plain text in standard API responses.
    """

    integration = models.OneToOneField(
        Integration,
        on_delete=models.CASCADE,
        related_name="credential",
    )

    encrypted_api_key = models.TextField(blank=True)
    encrypted_api_secret = models.TextField(blank=True)
    encrypted_access_token = models.TextField(blank=True)
    encrypted_webhook_secret = models.TextField(blank=True)
    encrypted_extra = models.TextField(
        blank=True,
        help_text="Encrypted JSON dictionary for provider-specific credentials (client_id, etc.).",
    )
    token_expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Credentials for {self.integration.name} (Shop #{self.shop_id})"

    def set_credentials(
        self,
        *,
        api_key: str = "",
        api_secret: str = "",
        access_token: str = "",
        webhook_secret: str = "",
        extra: Optional[dict] = None,
        token_expires_at=None,
    ):
        """Encrypt and store credentials."""
        shop_id = self.shop_id or self.integration.shop_id
        if api_key != "":
            self.encrypted_api_key = encrypt_secret(api_key, shop_id) if api_key else ""
        if api_secret != "":
            self.encrypted_api_secret = encrypt_secret(api_secret, shop_id) if api_secret else ""
        if access_token != "":
            self.encrypted_access_token = encrypt_secret(access_token, shop_id) if access_token else ""
        if webhook_secret != "":
            self.encrypted_webhook_secret = encrypt_secret(webhook_secret, shop_id) if webhook_secret else ""
        if extra is not None:
            self.encrypted_extra = encrypt_dict(extra, shop_id) if extra else ""
        if token_expires_at is not None:
            self.token_expires_at = token_expires_at

    def get_credentials(self) -> dict:
        """Decrypt and return credentials dictionary in memory. Strictly for internal adapter use."""
        shop_id = self.shop_id or self.integration.shop_id
        return {
            "api_key": decrypt_secret(self.encrypted_api_key, shop_id),
            "api_secret": decrypt_secret(self.encrypted_api_secret, shop_id),
            "access_token": decrypt_secret(self.encrypted_access_token, shop_id),
            "webhook_secret": decrypt_secret(self.encrypted_webhook_secret, shop_id),
            "extra": decrypt_dict(self.encrypted_extra, shop_id),
            "token_expires_at": self.token_expires_at,
        }

    def has_credentials(self) -> bool:
        """Check if any credentials are configured."""
        return bool(
            self.encrypted_api_key
            or self.encrypted_api_secret
            or self.encrypted_access_token
            or self.encrypted_webhook_secret
            or self.encrypted_extra
        )

    def get_masked_overview(self) -> dict:
        """Return safe masked representation for frontend/API consumption."""
        shop_id = self.shop_id or self.integration.shop_id
        creds = self.get_credentials()
        return {
            "has_api_key": bool(self.encrypted_api_key),
            "api_key_masked": mask_credential(creds["api_key"]),
            "has_api_secret": bool(self.encrypted_api_secret),
            "has_access_token": bool(self.encrypted_access_token),
            "access_token_masked": mask_credential(creds["access_token"]),
            "has_webhook_secret": bool(self.encrypted_webhook_secret),
            "token_expires_at": self.token_expires_at,
            "has_extra": bool(self.encrypted_extra),
            "is_configured": self.has_credentials(),
        }


class IntegrationLog(TenantScopedModel):
    """
    Append-only log for integration lifecycle changes, synchronization audits, and errors.
    """

    class Level(models.TextChoices):
        INFO = "info", "Info"
        WARNING = "warning", "Warning"
        ERROR = "error", "Error"

    LogLevel = Level

    integration = models.ForeignKey(
        Integration,
        on_delete=models.CASCADE,
        related_name="logs",
        null=True,
        blank=True,
    )
    level = models.CharField(max_length=20, choices=Level.choices, default=Level.INFO, db_index=True)
    action = models.CharField(max_length=80, db_index=True, help_text="e.g. 'connect', 'sync_attempt', 'error'")
    message = models.CharField(max_length=255)
    details = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["shop", "integration", "created_at"]),
            models.Index(fields=["shop", "level", "created_at"]),
        ]

    def save(self, *args, **kwargs):
        if self.pk and not kwargs.get("force_insert"):
            raise PermissionDenied("Integration logs are append-only and cannot be modified.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionDenied("Integration logs are append-only and cannot be deleted.")

    def __str__(self):
        target = self.integration.name if self.integration else "System"
        return f"[{self.level.upper()}] {target}: {self.message} ({self.created_at})"


class IntegrationAuditLog(TenantScopedModel):
    """
    Immutable audit log for integration lifecycle changes, transactions, sync events,
    webhook ingestion, and security-relevant modifications.
    Enforces append-only immutability.
    """
    class Action(models.TextChoices):
        INTEGRATION_CONNECTED = "integration_connected", "Integration Connected"
        INTEGRATION_DISCONNECTED = "integration_disconnected", "Integration Disconnected"
        CREDENTIALS_CHANGED = "credentials_changed", "Credentials Changed"
        MAPPING_CREATED = "mapping_created", "Mapping Created"
        MAPPING_CHANGED = "mapping_changed", "Mapping Changed"
        MAPPING_REMOVED = "mapping_removed", "Mapping Removed"
        WEBHOOK_RECEIVED = "webhook_received", "Webhook Received"
        ORDER_IMPORTED = "order_imported", "Order Imported"
        INVENTORY_SYNCHRONIZED = "inventory_synchronized", "Inventory Synchronized"
        SHIPMENT_CREATED = "shipment_created", "Shipment Created"
        SHIPMENT_CANCELLED = "shipment_cancelled", "Shipment Cancelled"
        RETRY_TRIGGERED = "retry_triggered", "Retry Triggered"
        INTEGRATION_FAILED = "integration_failed", "Integration Failed"
        STATUS_CHANGED = "status_changed", "Status Changed"
        CONNECTION_VALIDATED = "connection_validated", "Connection Validated"
        OTHER = "other", "Other Action"

    class Status(models.TextChoices):
        SUCCESS = "success", "Success"
        FAILED = "failed", "Failed"
        WARNING = "warning", "Warning"
        PENDING = "pending", "Pending"
        RETRY = "retry", "Retry Scheduled"

    integration = models.ForeignKey(
        Integration,
        on_delete=models.CASCADE,
        related_name="audit_logs",
        null=True,
        blank=True,
    )
    courier_account = models.ForeignKey(
        "CourierAccount",
        on_delete=models.CASCADE,
        related_name="audit_logs",
        null=True,
        blank=True,
    )
    action = models.CharField(max_length=80, choices=Action.choices, db_index=True)
    event_type = models.CharField(max_length=100, blank=True, db_index=True, help_text="e.g. order.created, inventory.sync")
    internal_id = models.CharField(max_length=100, blank=True, db_index=True, help_text="Internal ID, e.g. Sale ID or Product ID")
    external_id = models.CharField(max_length=150, blank=True, db_index=True, help_text="External ID, e.g. WooCommerce Order ID or Pathao Consignment ID")
    status = models.CharField(max_length=50, choices=Status.choices, default=Status.SUCCESS, db_index=True)
    attempt_count = models.PositiveIntegerField(default=1)
    duration_ms = models.PositiveIntegerField(default=0, help_text="Operation execution duration in milliseconds")
    error_type = models.CharField(max_length=100, blank=True, db_index=True, help_text="e.g. RateLimitExceeded, Timeout, AuthenticationError")
    error_message = models.TextField(blank=True)
    http_status = models.PositiveIntegerField(null=True, blank=True)
    correlation_id = models.CharField(max_length=100, blank=True, db_index=True, help_text="Tracing/correlation ID")
    request_id = models.CharField(max_length=100, blank=True, db_index=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="integration_audit_records",
    )
    description = models.CharField(max_length=255, blank=True)
    details = models.JSONField(default=dict, blank=True)
    changes = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["shop", "action", "created_at"], name="int_audit_shop_act_idx"),
            models.Index(fields=["shop", "status", "created_at"], name="int_audit_shop_stat_idx"),
            models.Index(fields=["shop", "event_type", "created_at"], name="int_audit_shop_evt_idx"),
            models.Index(fields=["correlation_id"], name="int_audit_corr_idx"),
            models.Index(fields=["external_id"], name="int_audit_ext_idx"),
        ]

    def save(self, *args, **kwargs):
        if self.pk and not kwargs.get("force_insert"):
            raise PermissionDenied("Integration audit logs are immutable and cannot be updated.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionDenied("Integration audit logs are immutable and cannot be deleted.")

    def __str__(self):
        target = self.integration.name if self.integration else (self.courier_account.name if self.courier_account else "Global")
        return f"[{self.status.upper()}] {self.action} on {target} ({self.created_at})"


class SyncJob(TenantScopedModel):
    """
    Tracks state and outcome of asynchronous synchronization jobs (inventory, orders, catalog).
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"
        CANCELLED = "cancelled", "Cancelled"

    integration = models.ForeignKey(
        Integration,
        on_delete=models.CASCADE,
        related_name="sync_jobs",
    )
    job_type = models.CharField(max_length=50, db_index=True, help_text="e.g. 'inventory_sync', 'order_sync'")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    items_processed = models.PositiveIntegerField(default=0)
    items_failed = models.PositiveIntegerField(default=0)
    error_summary = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["shop", "integration", "status"]),
            models.Index(fields=["shop", "created_at"]),
        ]

    def __str__(self):
        return f"{self.job_type} ({self.status}) for {self.integration.name}"


class ProductChannelMapping(TenantScopedModel):
    """
    Bi-directional mapping between a StockWhisk product/variation and an external
    eCommerce/channel product/variation (e.g. WooCommerce, Shopify).

    Enforces:
    - Multi-tenant strict scoping (via TenantScopedModel).
    - Unique external product/variation per channel.
    - Unique internal product/variation per channel.
    - Stable identifier priority: External IDs & SKUs.
    """

    class SyncStatus(models.TextChoices):
        ACTIVE = "active", "Active"
        SYNCED = "synced", "Synced"
        PENDING_SYNC = "pending_sync", "Pending Sync"
        PAUSED = "paused", "Paused"
        DISCONNECTED = "disconnected", "Disconnected"
        CONFLICT = "conflict", "Conflict"
        ERROR = "error", "Error"

    integration = models.ForeignKey(
        Integration,
        on_delete=models.CASCADE,
        related_name="product_mappings",
    )
    product = models.ForeignKey(
        "catalog.Product",
        on_delete=models.CASCADE,
        related_name="channel_mappings",
    )
    variation = models.ForeignKey(
        "catalog.ProductVariation",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="channel_mappings",
    )

    # Internal snapshot identifiers
    internal_sku = models.CharField(
        max_length=120,
        blank=True,
        db_index=True,
        help_text="StockWhisk product/variation SKU snapshot",
    )

    # External stable identifiers
    external_product_id = models.CharField(
        max_length=120,
        db_index=True,
        help_text="External website product ID (e.g. WooCommerce 8492, Shopify 789123456)",
    )
    external_variation_id = models.CharField(
        max_length=120,
        blank=True,
        default="",
        db_index=True,
        help_text="External website variation ID (if applicable, else empty string)",
    )
    external_sku = models.CharField(
        max_length=120,
        blank=True,
        default="",
        db_index=True,
        help_text="SKU assigned on the external eCommerce channel",
    )

    # Synchronization state and metadata
    sync_status = models.CharField(
        max_length=20,
        choices=SyncStatus.choices,
        default=SyncStatus.ACTIVE,
        db_index=True,
    )
    is_sync_enabled = models.BooleanField(
        default=True,
        help_text="If False, inventory and price updates will be skipped for this item",
    )
    sync_inventory = models.BooleanField(
        default=True,
        help_text="Whether inventory synchronization is enabled for this mapping",
    )
    error_message = models.TextField(blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Extra channel-specific metadata (e.g. external categories, tax classes)",
    )

    class Meta:
        ordering = ["-updated_at"]
        constraints = [
            # 1. External identity unique per channel & shop
            models.UniqueConstraint(
                fields=["shop", "integration", "external_product_id", "external_variation_id"],
                name="uniq_shop_channel_external_item",
            ),
            # 2. Internal item unique per channel & shop (one external mapping per internal item)
            models.UniqueConstraint(
                fields=["shop", "integration", "product", "variation"],
                name="uniq_shop_channel_internal_item",
            ),
        ]
        indexes = [
            models.Index(fields=["shop", "integration", "sync_status"]),
            models.Index(fields=["shop", "integration", "external_sku"]),
            models.Index(fields=["shop", "integration", "internal_sku"]),
        ]

    def __str__(self):
        item_label = f"Product #{self.product_id}"
        if self.variation_id:
            item_label += f" (Var #{self.variation_id})"
        ext_label = f"Ext #{self.external_product_id}"
        if self.external_variation_id:
            ext_label += f":{self.external_variation_id}"
        return f"[{self.integration.name}] {item_label} <-> {ext_label} ({self.sync_status})"

    @property
    def is_active(self) -> bool:
        """Indicates whether this mapping is actively maintained (not disconnected)."""
        return self.sync_status != self.SyncStatus.DISCONNECTED


class SyncError(TenantScopedModel):
    """
    Detailed recording of failure events during integration synchronization (Phase 6).
    Tracks error categorization (timeout, server_error, rate_limit, invalid_credentials, etc.).
    """
    job = models.ForeignKey(
        SyncJob,
        on_delete=models.CASCADE,
        related_name="errors",
        null=True,
        blank=True,
    )
    integration = models.ForeignKey(
        Integration,
        on_delete=models.CASCADE,
        related_name="sync_errors",
    )
    mapping = models.ForeignKey(
        ProductChannelMapping,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sync_errors",
    )
    error_type = models.CharField(max_length=60, db_index=True)
    error_code = models.CharField(max_length=50, blank=True)
    status_code = models.IntegerField(null=True, blank=True)
    error_message = models.TextField()
    raw_payload = models.JSONField(default=dict, blank=True)
    is_resolved = models.BooleanField(default=False, db_index=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    retry_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["shop", "integration", "error_type"]),
            models.Index(fields=["shop", "is_resolved"]),
        ]

    def __str__(self):
        return f"[{self.error_type}] {self.integration.name}: {self.error_message[:50]}"


class InventoryReservation(TenantScopedModel):
    """
    Audit log of temporary stock reservations held for pending eCommerce orders (Phase 6).
    Prevents overselling between online sales and in-store POS.
    """
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        COMMITTED = "committed", "Committed"
        RELEASED = "released", "Released"
        EXPIRED = "expired", "Expired"

    integration = models.ForeignKey(
        Integration,
        on_delete=models.CASCADE,
        related_name="reservations",
    )
    product = models.ForeignKey(
        "catalog.Product",
        on_delete=models.CASCADE,
        related_name="reservations",
    )
    variation = models.ForeignKey(
        "catalog.ProductVariation",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="reservations",
    )
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    reference_type = models.CharField(max_length=50, blank=True, help_text="e.g. 'WebOrder', 'Hold'")
    reference_id = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["shop", "integration", "status"]),
            models.Index(fields=["reference_type", "reference_id"]),
        ]

    def __str__(self):
        return f"Reservation of {self.quantity} for {self.product.name} ({self.status})"


class WebhookEndpoint(TenantScopedModel):
    """
    Registered webhook endpoint for receiving external platform callbacks.
    Securely associates inbound HTTP endpoints with an active Integration.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    integration = models.ForeignKey(
        Integration,
        on_delete=models.CASCADE,
        related_name="webhook_endpoints",
    )
    name = models.CharField(max_length=150)
    is_active = models.BooleanField(default=True, db_index=True)
    secret_token = models.CharField(
        max_length=255,
        blank=True,
        help_text="Secret or signature signing key for validating inbound webhook authenticity",
    )
    subscribed_events = models.JSONField(
        default=list,
        blank=True,
        help_text="List of accepted event types (empty = accept all)",
    )
    max_retries = models.PositiveSmallIntegerField(default=3)
    retry_delay_seconds = models.PositiveIntegerField(default=60)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["shop", "integration", "is_active"]),
        ]

    def __str__(self):
        return f"WebhookEndpoint {self.name} [{self.integration.name}]"


class IntegrationEvent(TenantScopedModel):
    """
    Inbound/outbound event store for webhooks, tracking updates, and platform callbacks.
    Enforces idempotency deduplication via unique (shop, integration, external_event_id).
    Manages complete webhook lifecycle:
    RECEIVED -> AUTHENTICATED -> VALIDATED -> DEDUPLICATED -> QUEUED -> PROCESSING -> SUCCESS
    With resilient failure/retry loops:
    PROCESSING -> FAILED -> RETRY -> SUCCESS or RETRY_LIMIT_REACHED -> FAILED_PERMANENTLY
    """

    class Status(models.TextChoices):
        RECEIVED = "received", "Received"
        AUTHENTICATED = "authenticated", "Authenticated"
        VALIDATED = "validated", "Validated"
        DEDUPLICATED = "deduplicated", "Deduplicated"
        QUEUED = "queued", "Queued"
        PROCESSING = "processing", "Processing"
        SUCCESS = "success", "Success"
        FAILED = "failed", "Failed"
        RETRY = "retry", "Retry"
        RETRY_LIMIT_REACHED = "retry_limit_reached", "Retry Limit Reached"
        FAILED_PERMANENTLY = "failed_permanently", "Failed Permanently"
        # Compatibility aliases
        PENDING = "pending", "Pending"
        PROCESSED = "processed", "Processed"
        IGNORED = "ignored", "Ignored"

    integration = models.ForeignKey(
        Integration,
        on_delete=models.CASCADE,
        related_name="events",
    )
    endpoint = models.ForeignKey(
        WebhookEndpoint,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="events",
    )
    external_event_id = models.CharField(max_length=150, db_index=True)
    event_type = models.CharField(max_length=100, db_index=True)
    payload = models.JSONField(default=dict)
    raw_payload = models.TextField(blank=True, help_text="Raw payload storage for audit/re-processing")
    headers = models.JSONField(default=dict, blank=True, help_text="Sanitized request headers (secrets stripped)")
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.RECEIVED,
        db_index=True,
    )
    attempt_count = models.PositiveIntegerField(default=0)
    max_retries = models.PositiveIntegerField(default=3)
    error_message = models.TextField(blank=True)
    error_details = models.JSONField(default=dict, blank=True)

    # Lifecycle Timestamps
    received_at = models.DateTimeField(null=True, blank=True)
    authenticated_at = models.DateTimeField(null=True, blank=True)
    validated_at = models.DateTimeField(null=True, blank=True)
    queued_at = models.DateTimeField(null=True, blank=True)
    processing_started_at = models.DateTimeField(null=True, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    last_retry_at = models.DateTimeField(null=True, blank=True)
    next_retry_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = [("shop", "integration", "external_event_id")]
        indexes = [
            models.Index(fields=["shop", "integration", "status", "created_at"]),
            models.Index(fields=["shop", "status", "next_retry_at"]),
        ]

    def __str__(self):
        return f"Event {self.event_type} [{self.external_event_id}] - {self.status}"


class ExternalOrder(TenantScopedModel):
    """
    Generic External eCommerce Order Mapping and Ingestion Model (Phase 7).
    Connects external channel orders to StockWhisk Sales and manages synchronization state.
    """
    class SyncStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        SYNCED = "synced", "Synced"
        UPDATED = "updated", "Updated"
        ON_HOLD = "on_hold", "On Hold"
        CONFLICT = "conflict", "Conflict"
        FAILED = "failed", "Failed"
        CANCELLED = "cancelled", "Cancelled"
        COMPLETED = "completed", "Completed"

    integration = models.ForeignKey(
        Integration,
        on_delete=models.CASCADE,
        related_name="external_orders",
    )
    sale = models.ForeignKey(
        "sales.Sale",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="external_orders",
        help_text="StockWhisk Sale created for this external order",
    )
    customer = models.ForeignKey(
        "crm.Customer",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="external_orders",
    )
    external_order_id = models.CharField(max_length=150, db_index=True)
    external_order_number = models.CharField(max_length=150, blank=True)
    external_status = models.CharField(max_length=50, blank=True, default="pending")
    sync_status = models.CharField(
        max_length=30,
        choices=SyncStatus.choices,
        default=SyncStatus.PENDING,
        db_index=True,
    )
    customer_name = models.CharField(max_length=150, blank=True)
    customer_phone = models.CharField(max_length=50, blank=True)
    customer_email = models.CharField(max_length=150, blank=True)
    shipping_address = models.TextField(blank=True)
    billing_address = models.TextField(blank=True)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    tax = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    shipping_charge = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    paid_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    currency = models.CharField(max_length=10, default="BDT")
    payment_method = models.CharField(max_length=50, blank=True)
    payment_status = models.CharField(max_length=50, blank=True)
    idempotency_key = models.CharField(max_length=128, blank=True, db_index=True)
    payload_hash = models.CharField(max_length=64, blank=True)
    raw_payload = models.JSONField(default=dict, blank=True)
    items_payload = models.JSONField(default=list, blank=True)
    error_message = models.TextField(blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["shop", "integration", "external_order_id"],
                name="uniq_external_order_per_channel",
            ),
        ]
        indexes = [
            models.Index(fields=["shop", "integration", "sync_status"]),
            models.Index(fields=["shop", "external_order_id"]),
            models.Index(fields=["shop", "idempotency_key"]),
        ]

    def __str__(self):
        return f"ExternalOrder #{self.external_order_id} [{self.integration.name}] - {self.sync_status}"


# ==============================================================================
# PHASE 10: Courier Integration Domain Models
# ==============================================================================


class CourierProvider(models.TextChoices):
    PATHAO = "pathao", "Pathao Courier"
    STEADFAST = "steadfast", "Steadfast Courier"
    REDX = "redx", "RedX Logistics"
    PAPERFLY = "paperfly", "Paperfly"
    CUSTOM = "custom", "Custom / Generic Courier"
    MOCK = "mock", "Mock Test Courier"


class CourierAccount(TenantScopedModel):
    """
    Courier Provider Account configuration per tenant.
    Allows each tenant (subscriber) to connect their own courier accounts independently.
    """
    integration = models.ForeignKey(
        Integration,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="courier_accounts",
    )
    name = models.CharField(max_length=150)
    provider = models.CharField(
        max_length=50,
        choices=CourierProvider.choices,
        default=CourierProvider.CUSTOM,
        db_index=True,
    )
    merchant_id = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    is_default = models.BooleanField(default=False)
    default_pickup_address = models.JSONField(default=dict, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["shop", "provider", "is_active"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_provider_display()}) - Shop #{self.shop_id}"


class CourierCredential(TenantScopedModel):
    """
    Encrypted credentials container for a tenant's CourierAccount.
    Strictly isolated per-tenant and encrypted using AES-256-GCM.
    """
    account = models.OneToOneField(
        CourierAccount,
        on_delete=models.CASCADE,
        related_name="credential",
    )
    encrypted_api_key = models.TextField(blank=True)
    encrypted_api_secret = models.TextField(blank=True)
    encrypted_access_token = models.TextField(blank=True)
    encrypted_webhook_secret = models.TextField(blank=True)
    encrypted_extra = models.TextField(
        blank=True,
        help_text="Encrypted JSON dictionary for provider-specific credentials (client_id, user, pass, etc.).",
    )
    token_expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Credentials for {self.account.name} (Shop #{self.shop_id})"

    def set_credentials(
        self,
        *,
        api_key: str = "",
        api_secret: str = "",
        access_token: str = "",
        webhook_secret: str = "",
        extra: Optional[dict] = None,
        token_expires_at=None,
    ):
        """Encrypt and store credentials securely per-tenant."""
        shop_id = self.shop_id or self.account.shop_id
        if api_key != "":
            self.encrypted_api_key = encrypt_secret(api_key, shop_id) if api_key else ""
        if api_secret != "":
            self.encrypted_api_secret = encrypt_secret(api_secret, shop_id) if api_secret else ""
        if access_token != "":
            self.encrypted_access_token = encrypt_secret(access_token, shop_id) if access_token else ""
        if webhook_secret != "":
            self.encrypted_webhook_secret = encrypt_secret(webhook_secret, shop_id) if webhook_secret else ""
        if extra is not None:
            self.encrypted_extra = encrypt_dict(extra, shop_id) if extra else ""
        if token_expires_at is not None:
            self.token_expires_at = token_expires_at

    def get_credentials(self) -> dict:
        """Decrypt and return credentials dictionary in memory for adapter use."""
        shop_id = self.shop_id or self.account.shop_id
        return {
            "api_key": decrypt_secret(self.encrypted_api_key, shop_id),
            "api_secret": decrypt_secret(self.encrypted_api_secret, shop_id),
            "access_token": decrypt_secret(self.encrypted_access_token, shop_id),
            "webhook_secret": decrypt_secret(self.encrypted_webhook_secret, shop_id),
            "extra": decrypt_dict(self.encrypted_extra, shop_id),
            "token_expires_at": self.token_expires_at,
        }

    def has_credentials(self) -> bool:
        return bool(
            self.encrypted_api_key
            or self.encrypted_api_secret
            or self.encrypted_access_token
            or self.encrypted_webhook_secret
            or self.encrypted_extra
        )

    def get_masked_overview(self) -> dict:
        shop_id = self.shop_id or self.account.shop_id
        creds = self.get_credentials()
        return {
            "has_api_key": bool(self.encrypted_api_key),
            "api_key_masked": mask_credential(creds["api_key"]),
            "has_api_secret": bool(self.encrypted_api_secret),
            "has_access_token": bool(self.encrypted_access_token),
            "access_token_masked": mask_credential(creds["access_token"]),
            "has_webhook_secret": bool(self.encrypted_webhook_secret),
            "token_expires_at": self.token_expires_at,
        }


class CourierShipment(TenantScopedModel):
    """
    Courier Shipment representing a physical consignment dispatched through a courier.
    Tracks normalized lifecycle states while preserving raw external provider statuses.
    """
    class ShipmentStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        READY_TO_SHIP = "ready_to_ship", "Ready to Ship"
        PICKUP_REQUESTED = "pickup_requested", "Pickup Requested"
        PICKED_UP = "picked_up", "Picked Up"
        IN_TRANSIT = "in_transit", "In Transit"
        OUT_FOR_DELIVERY = "out_for_delivery", "Out for Delivery"
        DELIVERED = "delivered", "Delivered"
        DELIVERY_FAILED = "delivery_failed", "Delivery Failed"
        CANCELLED = "cancelled", "Cancelled"
        RETURNED = "returned", "Returned"

    account = models.ForeignKey(
        CourierAccount,
        on_delete=models.CASCADE,
        related_name="shipments",
    )
    sale = models.ForeignKey(
        "sales.Sale",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="courier_shipments",
    )
    external_order = models.ForeignKey(
        "integrations.ExternalOrder",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="courier_shipments",
    )

    tracking_id = models.CharField(max_length=120, db_index=True)
    consignment_id = models.CharField(max_length=120, blank=True, db_index=True)
    tracking_url = models.URLField(max_length=500, blank=True)

    status = models.CharField(
        max_length=30,
        choices=ShipmentStatus.choices,
        default=ShipmentStatus.PENDING,
        db_index=True,
    )
    raw_status = models.CharField(max_length=100, blank=True)

    cod_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    collected_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    cod_charge = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))

    recipient_name = models.CharField(max_length=150)
    recipient_phone = models.CharField(max_length=30)
    recipient_address = models.TextField()
    recipient_city = models.CharField(max_length=100, blank=True)
    recipient_zone = models.CharField(max_length=100, blank=True)
    recipient_area = models.CharField(max_length=100, blank=True)

    weight_kg = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0.50"))
    item_description = models.TextField(blank=True)
    special_instruction = models.TextField(blank=True)

    pickup_store_id = models.CharField(max_length=100, blank=True)
    pickup_address = models.JSONField(default=dict, blank=True)

    pickup_requested_at = models.DateTimeField(null=True, blank=True)
    picked_up_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    returned_at = models.DateTimeField(null=True, blank=True)

    raw_payload = models.JSONField(default=dict, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["shop", "account", "tracking_id"],
                name="uniq_courier_shipment_per_account",
            ),
        ]
        indexes = [
            models.Index(fields=["shop", "status"]),
            models.Index(fields=["shop", "tracking_id"]),
            models.Index(fields=["shop", "consignment_id"]),
        ]

    def __str__(self):
        return f"Shipment #{self.tracking_id} [{self.get_status_display()}] - Shop #{self.shop_id}"


class CourierStatusHistory(TenantScopedModel):
    """
    Append-only tracking event timeline for a CourierShipment.
    """
    shipment = models.ForeignKey(
        CourierShipment,
        on_delete=models.CASCADE,
        related_name="status_history",
    )
    from_status = models.CharField(max_length=30, blank=True)
    to_status = models.CharField(
        max_length=30,
        choices=CourierShipment.ShipmentStatus.choices,
    )
    raw_status = models.CharField(max_length=100, blank=True)
    event_time = models.DateTimeField(default=timezone.now)
    location = models.CharField(max_length=200, blank=True)
    remarks = models.TextField(blank=True)
    actor = models.CharField(max_length=100, blank=True)
    raw_payload = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-event_time", "-created_at"]
        indexes = [
            models.Index(fields=["shop", "shipment", "to_status"]),
        ]

    def __str__(self):
        return f"{self.shipment.tracking_id}: {self.from_status} -> {self.to_status} at {self.event_time}"


class CourierEvent(TenantScopedModel):
    """
    Inbound courier webhook / status callback event store.
    Provides strict idempotency and audit logs for deduplicating incoming events.
    """
    account = models.ForeignKey(
        CourierAccount,
        on_delete=models.CASCADE,
        related_name="events",
    )
    shipment = models.ForeignKey(
        CourierShipment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="events",
    )
    event_id = models.CharField(max_length=150, db_index=True)
    event_type = models.CharField(max_length=100)
    status = models.CharField(max_length=30, default="received")
    processed_at = models.DateTimeField(null=True, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["shop", "account", "event_id"],
                name="uniq_courier_event_per_account",
            ),
        ]
        indexes = [
            models.Index(fields=["shop", "event_id"]),
            models.Index(fields=["shop", "account", "status"]),
        ]

    def __str__(self):
        return f"CourierEvent #{self.event_id} ({self.event_type}) - Shop #{self.shop_id}"


