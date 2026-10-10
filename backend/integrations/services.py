"""
Integration Service Layer.

Provides high-level business operations for managing integrations, lifecycle transitions,
credential updates, and audit logging. Keeps views and background workers thin.
"""
from typing import Any, Dict, Optional

from django.db import transaction
from django.utils import timezone

import audit.services
from .models import (
    Integration,
    IntegrationAuditLog,
    IntegrationCategory,
    IntegrationCredential,
    IntegrationLog,
    IntegrationProvider,
    IntegrationStatus,
    SyncJob,
)
from .audit import record_integration_audit


@transaction.atomic
def create_integration(
    *,
    shop,
    name: str,
    category: str,
    provider: str,
    base_url: str = "",
    config: Optional[Dict[str, Any]] = None,
    credentials: Optional[Dict[str, Any]] = None,
    created_by=None,
) -> Integration:
    """
    Create a new integration for a shop and optionally configure its credentials.
    Audited via audit.services.record.
    """
    name = (name or "").strip()
    if not name:
        raise ValueError("Integration name is required.")

    if category not in IntegrationCategory.values:
        raise ValueError(f"Invalid category '{category}'. Must be one of {IntegrationCategory.values}")

    if provider not in IntegrationProvider.values:
        raise ValueError(f"Invalid provider '{provider}'. Must be one of {IntegrationProvider.values}")

    integration = Integration(
        shop=shop,
        name=name,
        category=category,
        provider=provider,
        base_url=(base_url or "").strip(),
        config=config or {},
        created_by=created_by,
        status=IntegrationStatus.DRAFT,
    )
    integration.save()

    # Create associated credential record
    cred = IntegrationCredential(
        shop=shop,
        integration=integration,
    )
    if credentials:
        cred.set_credentials(
            api_key=credentials.get("api_key", ""),
            api_secret=credentials.get("api_secret", ""),
            access_token=credentials.get("access_token", ""),
            webhook_secret=credentials.get("webhook_secret", ""),
            extra=credentials.get("extra"),
            token_expires_at=credentials.get("token_expires_at"),
        )
        if cred.has_credentials():
            integration.status = IntegrationStatus.CONNECTED
            integration.connected_at = timezone.now()
            integration.save(update_fields=["status", "connected_at", "updated_at"])

    # Auto-provision webhook endpoint and secret token for custom website integrations
    if provider == IntegrationProvider.CUSTOM_WEBHOOK:
        import secrets
        from .models import WebhookEndpoint
        webhook_sec = (credentials or {}).get("webhook_secret", "").strip()
        if not webhook_sec:
            webhook_sec = f"whsec_{secrets.token_hex(20)}"
            cred.set_credentials(webhook_secret=webhook_sec)

        integration.status = IntegrationStatus.CONNECTED
        integration.connected_at = timezone.now()
        integration.save(update_fields=["status", "connected_at", "updated_at"])

        WebhookEndpoint.all_objects.get_or_create(
            shop=shop,
            integration=integration,
            defaults={
                "name": f"{name} Webhook & API",
                "secret_token": webhook_sec,
                "is_active": True,
            },
        )

    cred.save()

    # Audit Trail
    audit.services.record(
        action=audit.services.AuditLog.Action.CREATE,
        actor=created_by,
        shop=shop,
        target=integration,
        description=f"Created {integration.get_provider_display()} integration '{integration.name}'",
        changes={
            "provider": ["", provider],
            "category": ["", category],
            "name": ["", name],
        },
    )

    # Internal Integration Log
    record_log(
        integration=integration,
        level="info",
        action="create",
        message=f"Integration '{name}' initialized with status {integration.status}.",
    )

    if integration.status == IntegrationStatus.CONNECTED:
        record_integration_audit(
            shop=shop,
            action=str(IntegrationAuditLog.Action.INTEGRATION_CONNECTED),
            integration=integration,
            event_type="integration.connected",
            internal_id=str(integration.id),
            status="success",
            actor=created_by,
            description=f"Integration '{name}' connected.",
            details={"provider": provider, "category": category},
        )

    return integration


@transaction.atomic
def update_integration(
    *,
    integration: Integration,
    name: Optional[str] = None,
    base_url: Optional[str] = None,
    is_active: Optional[bool] = None,
    config: Optional[Dict[str, Any]] = None,
    actor=None,
) -> Integration:
    """
    Update non-credential configuration fields of an existing integration.
    """
    changes = {}
    update_fields = ["updated_at"]

    if name is not None and name.strip() and name.strip() != integration.name:
        changes["name"] = [integration.name, name.strip()]
        integration.name = name.strip()
        update_fields.append("name")

    if base_url is not None and base_url.strip() != integration.base_url:
        changes["base_url"] = [integration.base_url, base_url.strip()]
        integration.base_url = base_url.strip()
        update_fields.append("base_url")

    if is_active is not None and is_active != integration.is_active:
        changes["is_active"] = [integration.is_active, is_active]
        integration.is_active = is_active
        update_fields.append("is_active")

    if config is not None:
        merged_config = dict(integration.config or {})
        merged_config.update(config)
        changes["config"] = [integration.config, merged_config]
        integration.config = merged_config
        update_fields.append("config")

    if len(update_fields) > 1:
        integration.save(update_fields=update_fields)
        audit.services.record(
            action=audit.services.AuditLog.Action.UPDATE,
            actor=actor,
            shop=integration.shop,
            target=integration,
            description=f"Updated settings for integration '{integration.name}'",
            changes=changes,
        )
        record_log(
            integration=integration,
            level="info",
            action="update",
            message=f"Updated fields: {', '.join(k for k in changes.keys())}",
            details=changes,
        )

    return integration


@transaction.atomic
def update_credentials(
    *,
    integration: Integration,
    api_key: Optional[str] = None,
    api_secret: Optional[str] = None,
    access_token: Optional[str] = None,
    webhook_secret: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
    token_expires_at=None,
    actor=None,
) -> IntegrationCredential:
    """
    Safely update encrypted credentials for an integration.
    Never logs raw secrets to AuditLog or IntegrationLog.
    """
    cred, _ = IntegrationCredential.all_objects.get_or_create(
        shop=integration.shop,
        integration=integration,
    )

    cred.set_credentials(
        api_key=api_key if api_key is not None else "",
        api_secret=api_secret if api_secret is not None else "",
        access_token=access_token if access_token is not None else "",
        webhook_secret=webhook_secret if webhook_secret is not None else "",
        extra=extra,
        token_expires_at=token_expires_at,
    )
    cred.save()

    # Update integration lifecycle to connected if previously draft
    if integration.status == IntegrationStatus.DRAFT and cred.has_credentials():
        integration.mark_connected()

    audit.services.record(
        action=audit.services.AuditLog.Action.UPDATE,
        actor=actor,
        shop=integration.shop,
        target=integration,
        description=f"Rotated/updated credentials for integration '{integration.name}'",
        changes={"credentials": ["[REDACTED]", "[ROTATED]"]},
    )

    record_log(
        integration=integration,
        level="info",
        action="credentials_update",
        message="Integration credentials successfully rotated.",
    )

    record_integration_audit(
        shop=integration.shop,
        action=str(IntegrationAuditLog.Action.CREDENTIALS_CHANGED),
        integration=integration,
        event_type="credentials.changed",
        internal_id=str(integration.id),
        status="success",
        actor=actor,
        description=f"Credentials updated/rotated for integration '{integration.name}'.",
        changes={"credentials": ["[REDACTED]", "[ROTATED]"]},
    )

    return cred


@transaction.atomic
def change_status(
    *,
    integration: Integration,
    new_status: str,
    reason: str = "",
    actor=None,
) -> Integration:
    """
    Transition integration lifecycle status (e.g. connected, paused, disconnected).
    """
    if new_status not in IntegrationStatus.values:
        raise ValueError(f"Invalid status '{new_status}'.")

    old_status = integration.status
    if old_status == new_status:
        return integration

    if new_status == IntegrationStatus.CONNECTED:
        integration.mark_connected()
    elif new_status == IntegrationStatus.PAUSED:
        integration.pause()
    elif new_status == IntegrationStatus.DISCONNECTED:
        integration.disconnect()
    elif new_status == IntegrationStatus.ERROR:
        integration.mark_error(reason)
    else:
        integration.status = new_status
        integration.save(update_fields=["status", "updated_at"])

    audit.services.record(
        action=audit.services.AuditLog.Action.UPDATE,
        actor=actor,
        shop=integration.shop,
        target=integration,
        description=f"Changed integration status from {old_status} to {new_status}",
        changes={"status": [old_status, new_status], "reason": ["", reason]},
    )

    record_log(
        integration=integration,
        level="error" if new_status == IntegrationStatus.ERROR else "info",
        action="status_change",
        message=f"Status transitioned from {old_status} to {new_status}. {reason}".strip(),
    )

    if new_status == IntegrationStatus.DISCONNECTED:
        audit_action = str(IntegrationAuditLog.Action.INTEGRATION_DISCONNECTED)
    elif new_status == IntegrationStatus.CONNECTED:
        audit_action = str(IntegrationAuditLog.Action.INTEGRATION_CONNECTED)
    elif new_status == IntegrationStatus.ERROR:
        audit_action = str(IntegrationAuditLog.Action.INTEGRATION_FAILED)
    else:
        audit_action = str(IntegrationAuditLog.Action.STATUS_CHANGED)

    record_integration_audit(
        shop=integration.shop,
        action=audit_action,
        integration=integration,
        event_type=f"status.{new_status}",
        internal_id=str(integration.id),
        status="failed" if new_status == IntegrationStatus.ERROR else "success",
        actor=actor,
        error_message=reason if new_status == IntegrationStatus.ERROR else "",
        description=f"Integration '{integration.name}' status transitioned from {old_status} to {new_status}.",
        changes={"status": [old_status, new_status], "reason": ["", reason]},
    )

    return integration


def record_log(
    *,
    integration: Integration,
    level: str,
    action: str,
    message: str,
    details: Optional[Dict[str, Any]] = None,
) -> IntegrationLog:
    """Write an append-only entry to IntegrationLog."""
    return IntegrationLog.all_objects.create(
        shop=integration.shop,
        integration=integration,
        level=level,
        action=action[:80],
        message=message[:255],
        details=details or {},
    )


def create_sync_job(
    *,
    integration: Integration,
    job_type: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> SyncJob:
    """Register the start of an asynchronous synchronization job."""
    return SyncJob.all_objects.create(
        shop=integration.shop,
        integration=integration,
        job_type=job_type,
        status=SyncJob.Status.RUNNING,
        started_at=timezone.now(),
        metadata=metadata or {},
    )


def complete_sync_job(
    *,
    job: SyncJob,
    items_processed: int = 0,
    items_failed: int = 0,
    error_summary: str = "",
) -> SyncJob:
    """Record completion of a synchronization job."""
    job.finished_at = timezone.now()
    job.items_processed = items_processed
    job.items_failed = items_failed
    job.error_summary = error_summary
    job.status = SyncJob.Status.COMPLETED if items_failed == 0 else SyncJob.Status.FAILED
    job.save(update_fields=["finished_at", "items_processed", "items_failed", "error_summary", "status", "updated_at"])

    # Update integration's last_synced_at
    integration = job.integration
    integration.last_synced_at = job.finished_at
    if items_failed > 0:
        integration.last_error_at = job.finished_at
        integration.error_message = error_summary[:2000]
    integration.save(update_fields=["last_synced_at", "last_error_at", "error_message", "updated_at"])

    return job
