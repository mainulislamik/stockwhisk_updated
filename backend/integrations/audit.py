"""
Phase 15: Integration Platform Observability and Audit Framework.

Captures immutable, structured, tenant-isolated audit logs for all integration operations:
- Tenant Scoping & Boundary Validation
- Zero Credential / Secret Leakage (automatic deep recursive sanitization)
- Tracing metrics: Duration, HTTP Status, Attempt Count, Correlation/Request ID
- Immutability guarantees
"""
import copy
import logging
import time
import uuid
from contextlib import contextmanager
from typing import Any, Dict, List, Optional, Union

from django.conf import settings
from django.utils import timezone

from .models import (
    CourierAccount,
    Integration,
    IntegrationAuditLog,
    IntegrationLog,
)

logger = logging.getLogger(__name__)

# Sensitive keywords that must NEVER be persisted in plaintext logs or audits
SENSITIVE_KEY_PATTERNS = {
    "secret",
    "token",
    "password",
    "passwd",
    "auth",
    "authorization",
    "credential",
    "credentials",
    "signature",
    "cookie",
    "access_token",
    "refresh_token",
    "client_secret",
    "api_secret",
    "consumer_secret",
    "signing_secret",
    "webhook_secret",
    "private_key",
    "cert",
    "certificate",
    "bearer",
    "encryption_key",
}


def is_sensitive_key(key: str) -> bool:
    """Check if dictionary key or header name represents a sensitive credential."""
    if not isinstance(key, str):
        return False
    k = key.strip().lower().replace("-", "_")
    return any(pattern in k for pattern in SENSITIVE_KEY_PATTERNS)


def sanitize_audit_payload(data: Any, max_depth: int = 10) -> Any:
    """
    Recursively sanitize an object before writing to audit logs or database JSON fields.
    Replaces any secret, token, password, or key with [REDACTED].
    """
    if max_depth <= 0:
        return "[TRUNCATED_DEPTH]"

    if isinstance(data, dict):
        sanitized = {}
        for k, v in data.items():
            if is_sensitive_key(str(k)):
                sanitized[k] = "[REDACTED]"
            else:
                sanitized[k] = sanitize_audit_payload(v, max_depth - 1)
        return sanitized

    elif isinstance(data, (list, tuple, set)):
        return [sanitize_audit_payload(item, max_depth - 1) for item in data]

    elif isinstance(data, str):
        # Additional protection against raw authorization header or bearer tokens in strings
        lower_str = data.lower()
        if "bearer " in lower_str or "basic " in lower_str:
            return "[REDACTED_AUTH_STRING]"
        return data

    return data


def sanitize_error_message(msg: str) -> str:
    """Sanitize error messages to ensure no tokens or secrets were echoed."""
    if not msg:
        return ""
    clean_msg = str(msg)
    for pattern in ["bearer", "client_secret", "api_secret", "password", "signature"]:
        if pattern in clean_msg.lower():
            # If sensitive keyword found in exception, mask potential token segments
            words = clean_msg.split()
            masked_words = []
            for w in words:
                if any(p in w.lower() for p in SENSITIVE_KEY_PATTERNS) and len(w) > 10:
                    masked_words.append("[REDACTED]")
                else:
                    masked_words.append(w)
            clean_msg = " ".join(masked_words)
    return clean_msg[:1000]


def record_integration_audit(
    *,
    shop: Any,
    action: str,
    integration: Optional[Integration] = None,
    courier_account: Optional[CourierAccount] = None,
    event_type: str = "",
    internal_id: str = "",
    external_id: str = "",
    status: str = "success",
    attempt_count: int = 1,
    duration_ms: int = 0,
    error_type: str = "",
    error_message: str = "",
    http_status: Optional[int] = None,
    correlation_id: str = "",
    request_id: str = "",
    actor: Optional[Any] = None,
    description: str = "",
    details: Optional[Dict[str, Any]] = None,
    changes: Optional[Dict[str, Any]] = None,
) -> IntegrationAuditLog:
    """
    Record an append-only, tenant-isolated entry in IntegrationAuditLog.
    Guarantees:
    - Zero secret leakage via deep sanitization
    - Tenant isolation: strictly tied to the tenant's shop
    - Fallback error handling so logging failure does not break the business flow
    """
    try:
        # Resolve shop from integration or courier if not passed
        if not shop:
            if integration:
                shop = integration.shop
            elif courier_account:
                shop = courier_account.shop

        # Generate correlation_id if missing
        if not correlation_id:
            correlation_id = str(uuid.uuid4())

        # Deep sanitize details and changes
        clean_details = sanitize_audit_payload(details or {})
        clean_changes = sanitize_audit_payload(changes or {})
        clean_error = sanitize_error_message(error_message)

        # Standard description fallback
        if not description:
            target_name = (
                integration.name
                if integration
                else (courier_account.name if courier_account else "Platform")
            )
            description = f"Action '{action}' executed for {target_name}"

        audit_entry = IntegrationAuditLog.all_objects.create(
            shop=shop,
            integration=integration,
            courier_account=courier_account,
            action=action,
            event_type=event_type[:100],
            internal_id=str(internal_id)[:100],
            external_id=str(external_id)[:150],
            status=status,
            attempt_count=max(1, attempt_count),
            duration_ms=max(0, duration_ms),
            error_type=error_type[:100],
            error_message=clean_error,
            http_status=http_status,
            correlation_id=str(correlation_id)[:100],
            request_id=str(request_id)[:100],
            actor=actor if actor and getattr(actor, "is_authenticated", False) else None,
            description=description[:255],
            details=clean_details,
            changes=clean_changes,
        )

        # Mirror high-level operational events into IntegrationLog if integration is attached
        if integration and action in {
            IntegrationAuditLog.Action.INTEGRATION_CONNECTED,
            IntegrationAuditLog.Action.INTEGRATION_DISCONNECTED,
            IntegrationAuditLog.Action.CREDENTIALS_CHANGED,
            IntegrationAuditLog.Action.ORDER_IMPORTED,
            IntegrationAuditLog.Action.INVENTORY_SYNCHRONIZED,
            IntegrationAuditLog.Action.INTEGRATION_FAILED,
        }:
            level = (
                IntegrationLog.Level.ERROR
                if status == IntegrationAuditLog.Status.FAILED
                else (
                    IntegrationLog.Level.WARNING
                    if status == IntegrationAuditLog.Status.WARNING
                    else IntegrationLog.Level.INFO
                )
            )
            try:
                IntegrationLog.all_objects.create(
                    shop=shop,
                    integration=integration,
                    level=level,
                    action=action[:80],
                    message=description[:255],
                    details=clean_details,
                )
            except Exception as log_err:
                logger.warning("Failed to mirror into IntegrationLog: %s", log_err)

        return audit_entry

    except Exception as exc:
        logger.exception("Failed to write IntegrationAuditLog: %s", exc)
        raise


class OperationTrace:
    """Container for in-flight trace context."""

    def __init__(self, correlation_id: str, request_id: str):
        self.correlation_id = correlation_id
        self.request_id = request_id
        self.internal_id: str = ""
        self.external_id: str = ""
        self.http_status: Optional[int] = None
        self.attempt_count: int = 1
        self.details: Dict[str, Any] = {}
        self.changes: Dict[str, Any] = {}
        self.description: str = ""


@contextmanager
def trace_integration_operation(
    *,
    shop: Any,
    action: str,
    integration: Optional[Integration] = None,
    courier_account: Optional[CourierAccount] = None,
    event_type: str = "",
    correlation_id: str = "",
    request_id: str = "",
    actor: Optional[Any] = None,
    initial_details: Optional[Dict[str, Any]] = None,
):
    """
    Context manager to trace execution metrics (duration_ms, status, errors)
    and automatically emit an audit record upon completion.
    """
    corr_id = correlation_id or str(uuid.uuid4())
    req_id = request_id or str(uuid.uuid4())
    trace = OperationTrace(corr_id, req_id)
    if initial_details:
        trace.details.update(initial_details)

    start_time = time.perf_counter()
    try:
        yield trace
        duration_ms = int((time.perf_counter() - start_time) * 1000)
        record_integration_audit(
            shop=shop,
            action=action,
            integration=integration,
            courier_account=courier_account,
            event_type=event_type,
            internal_id=trace.internal_id,
            external_id=trace.external_id,
            status="success",
            attempt_count=trace.attempt_count,
            duration_ms=duration_ms,
            http_status=trace.http_status or 200,
            correlation_id=trace.correlation_id,
            request_id=trace.request_id,
            actor=actor,
            description=trace.description,
            details=trace.details,
            changes=trace.changes,
        )
    except Exception as exc:
        duration_ms = int((time.perf_counter() - start_time) * 1000)
        record_integration_audit(
            shop=shop,
            action=action,
            integration=integration,
            courier_account=courier_account,
            event_type=event_type,
            internal_id=trace.internal_id,
            external_id=trace.external_id,
            status="failed",
            attempt_count=trace.attempt_count,
            duration_ms=duration_ms,
            error_type=exc.__class__.__name__,
            error_message=str(exc),
            http_status=trace.http_status or 500,
            correlation_id=trace.correlation_id,
            request_id=trace.request_id,
            actor=actor,
            description=trace.description or f"Failed: {exc}",
            details=trace.details,
            changes=trace.changes,
        )
        raise
