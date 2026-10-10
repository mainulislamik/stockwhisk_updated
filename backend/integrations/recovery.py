"""
StockWhisk Integrations Recovery & Error Classification Architecture (Phase 13).

Provides:
1. Structured Error Categories:
   - AUTHENTICATION_ERROR
   - AUTHORIZATION_ERROR
   - VALIDATION_ERROR
   - NOT_FOUND
   - RATE_LIMITED
   - TIMEOUT
   - NETWORK_ERROR
   - EXTERNAL_SERVER_ERROR
   - DUPLICATE_EVENT
   - MAPPING_ERROR
   - INSUFFICIENT_STOCK
   - BUSINESS_RULE_ERROR
2. Transient vs. Permanent Failure Classification:
   - Transient (retryable with exponential backoff):
     TIMEOUT, NETWORK_ERROR, EXTERNAL_SERVER_ERROR, RATE_LIMITED
   - Permanent (fail fast, no endless retries):
     AUTHENTICATION_ERROR, AUTHORIZATION_ERROR, VALIDATION_ERROR,
     NOT_FOUND, DUPLICATE_EVENT, MAPPING_ERROR, INSUFFICIENT_STOCK, BUSINESS_RULE_ERROR
3. Exponential Backoff with Rate-Limit Awareness (Retry-After header support)
4. State Transitions & Audit Trails (IntegrationEvent, SyncError, IntegrationLog)
5. Manual Retry Execution & Visibility APIs
6. Duplicate Prevention Guards for Orders & Courier Shipments
"""
import logging
import random
import socket
import urllib.error
from datetime import timedelta
from decimal import InvalidOperation
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple, Union

from django.core.exceptions import ObjectDoesNotExist, PermissionDenied, ValidationError
from django.db import DatabaseError, IntegrityError, models, transaction
from django.db.models import Q
from django.utils import timezone

from core.tenant_context import tenant_context
from .models import (
    Integration,
    IntegrationAuditLog,
    IntegrationEvent,
    IntegrationLog,
    SyncError,
)
from .audit import record_integration_audit
from .webhook_engine import sanitize_secrets

logger = logging.getLogger("integrations.recovery")


# ==============================================================================
# 1. Structured Error Categories & Transient / Permanent Classification
# ==============================================================================

class IntegrationErrorCategory(str, Enum):
    AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR"
    AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    NOT_FOUND = "NOT_FOUND"
    RATE_LIMITED = "RATE_LIMITED"
    TIMEOUT = "TIMEOUT"
    NETWORK_ERROR = "NETWORK_ERROR"
    EXTERNAL_SERVER_ERROR = "EXTERNAL_SERVER_ERROR"
    DUPLICATE_EVENT = "DUPLICATE_EVENT"
    MAPPING_ERROR = "MAPPING_ERROR"
    INSUFFICIENT_STOCK = "INSUFFICIENT_STOCK"
    BUSINESS_RULE_ERROR = "BUSINESS_RULE_ERROR"


# Transient errors suitable for exponential backoff retries
TRANSIENT_CATEGORIES: Set[IntegrationErrorCategory] = {
    IntegrationErrorCategory.TIMEOUT,
    IntegrationErrorCategory.NETWORK_ERROR,
    IntegrationErrorCategory.EXTERNAL_SERVER_ERROR,
    IntegrationErrorCategory.RATE_LIMITED,
}

# Permanent errors that must fail fast without repeated retries
PERMANENT_CATEGORIES: Set[IntegrationErrorCategory] = {
    IntegrationErrorCategory.AUTHENTICATION_ERROR,
    IntegrationErrorCategory.AUTHORIZATION_ERROR,
    IntegrationErrorCategory.VALIDATION_ERROR,
    IntegrationErrorCategory.NOT_FOUND,
    IntegrationErrorCategory.DUPLICATE_EVENT,
    IntegrationErrorCategory.MAPPING_ERROR,
    IntegrationErrorCategory.INSUFFICIENT_STOCK,
    IntegrationErrorCategory.BUSINESS_RULE_ERROR,
}


def classify_error(
    exc: Optional[Exception] = None,
    status_code: Optional[int] = None,
    error_message: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> Tuple[IntegrationErrorCategory, bool, Optional[int]]:
    """
    Categorizes any integration error into one of the 12 structured error categories,
    determines whether it is transient (retryable) or permanent, and extracts retry_after if available.

    Returns:
        (category, is_transient, retry_after_seconds)
    """
    details = details or {}
    msg = ""
    if exc:
        msg = f"{exc.__class__.__name__}: {str(exc)}".lower()
    elif error_message:
        msg = str(error_message).lower()

    retry_after: Optional[int] = None
    if exc and hasattr(exc, "retry_after") and getattr(exc, "retry_after"):
        try:
            retry_after = int(getattr(exc, "retry_after"))
        except (ValueError, TypeError):
            pass
    elif "retry_after" in details:
        try:
            retry_after = int(details["retry_after"])
        except (ValueError, TypeError):
            pass

    # 1. Match by Status Code
    if status_code is not None:
        if status_code == 401:
            return IntegrationErrorCategory.AUTHENTICATION_ERROR, False, None
        if status_code == 403:
            return IntegrationErrorCategory.AUTHORIZATION_ERROR, False, None
        if status_code == 404:
            return IntegrationErrorCategory.NOT_FOUND, False, None
        if status_code == 409:
            return IntegrationErrorCategory.DUPLICATE_EVENT, False, None
        if status_code == 429:
            return IntegrationErrorCategory.RATE_LIMITED, True, retry_after or 60
        if status_code in (400, 422):
            return IntegrationErrorCategory.VALIDATION_ERROR, False, None
        if status_code in (408, 504):
            return IntegrationErrorCategory.TIMEOUT, True, None
        if status_code in (500, 502, 503):
            return IntegrationErrorCategory.EXTERNAL_SERVER_ERROR, True, None

    # 2. Match by Exception Class or Module Type
    if exc:
        exc_name = exc.__class__.__name__

        # Authentication Errors
        if exc_name in (
            "ConnectorAuthError",
            "CourierAuthError",
            "TenantAuthenticationError",
            "InvalidCredentialsError",
            "AuthenticationFailed",
            "NotAuthenticated",
        ):
            return IntegrationErrorCategory.AUTHENTICATION_ERROR, False, None

        # Authorization Errors
        if isinstance(exc, PermissionDenied) or exc_name in (
            "InsufficientPermissionsError",
            "PermissionDenied",
        ):
            return IntegrationErrorCategory.AUTHORIZATION_ERROR, False, None

        # Rate Limiting
        if exc_name in (
            "ConnectorRateLimitError",
            "CourierRateLimitError",
            "ExternalRateLimitError",
            "Throttled",
        ):
            return IntegrationErrorCategory.RATE_LIMITED, True, retry_after or 60

        # Timeouts
        if (
            isinstance(exc, (TimeoutError, socket.timeout))
            or exc_name in (
                "ConnectorTimeoutError",
                "CourierTimeoutError",
                "ExternalTimeoutError",
                "ConnectTimeout",
                "ReadTimeout",
            )
        ):
            return IntegrationErrorCategory.TIMEOUT, True, None

        # Network Errors
        if (
            isinstance(exc, (ConnectionError, socket.error, urllib.error.URLError))
            or exc_name in (
                "ConnectionRefusedError",
                "ConnectionResetError",
                "ConnectionAbortedError",
                "SSLError",
                "ProxyError",
            )
        ):
            return IntegrationErrorCategory.NETWORK_ERROR, True, None

        # Server Errors
        if exc_name in (
            "ConnectorServerError",
            "CourierServerError",
            "ExternalServerError",
        ):
            return IntegrationErrorCategory.EXTERNAL_SERVER_ERROR, True, None

        # Duplicate Events
        if exc_name in (
            "ConnectorDuplicateWebhookError",
            "CourierDuplicateEventError",
        ):
            return IntegrationErrorCategory.DUPLICATE_EVENT, False, None

        # Mapping Errors
        if exc_name in (
            "UnmappedProductError",
            "UnmappedProductOrderError",
            "ConnectorMissingProductError",
            "ConnectorMissingSKUError",
            "MissingIdentifierError",
        ):
            return IntegrationErrorCategory.MAPPING_ERROR, False, None

        # Insufficient Stock
        if exc_name in ("InsufficientStockOrderError",):
            return IntegrationErrorCategory.INSUFFICIENT_STOCK, False, None

        # Validation Errors
        if (
            isinstance(exc, ValidationError)
            or exc_name in (
                "MalformedOrderPayloadError",
                "CourierValidationError",
                "ConnectorMalformedResponseError",
                "InvalidQuantityError",
            )
        ):
            return IntegrationErrorCategory.VALIDATION_ERROR, False, None

        # Not Found
        if (
            isinstance(exc, ObjectDoesNotExist)
            or exc_name in (
                "CourierShipmentNotFoundError",
                "ExternalProductDeletedError",
                "NotFound",
            )
        ):
            return IntegrationErrorCategory.NOT_FOUND, False, None

        # Database Integrity Error (unique constraint violations = duplicate event)
        if isinstance(exc, IntegrityError):
            if "unique" in msg or "duplicate" in msg:
                return IntegrationErrorCategory.DUPLICATE_EVENT, False, None
            return IntegrationErrorCategory.VALIDATION_ERROR, False, None

        # Business Rule Violations
        if isinstance(exc, InvalidOperation) or exc_name in (
            "BusinessRuleViolationError",
            "InvalidTransitionError",
        ):
            return IntegrationErrorCategory.BUSINESS_RULE_ERROR, False, None

    # 3. String & Keyword Heuristics
    if any(k in msg for k in ["rate limit", "too many requests", "429", "throttle"]):
        return IntegrationErrorCategory.RATE_LIMITED, True, retry_after or 60

    if any(k in msg for k in ["timeout", "timed out", "connect timeout", "read timeout", "deadline exceeded"]):
        return IntegrationErrorCategory.TIMEOUT, True, None

    if any(k in msg for k in ["connection refused", "network unreachable", "dns", "connection reset", "broken pipe", "failed to establish a new connection"]):
        return IntegrationErrorCategory.NETWORK_ERROR, True, None

    if any(k in msg for k in ["500", "502", "503", "bad gateway", "internal server error", "service unavailable", "upstream server"]):
        return IntegrationErrorCategory.EXTERNAL_SERVER_ERROR, True, None

    if any(k in msg for k in ["invalid credential", "unauthorized", "api key", "auth failure", "token expired", "signature verification failed"]):
        return IntegrationErrorCategory.AUTHENTICATION_ERROR, False, None

    if any(k in msg for k in ["forbidden", "permission denied", "access denied"]):
        return IntegrationErrorCategory.AUTHORIZATION_ERROR, False, None

    if any(k in msg for k in ["unmapped", "mapping error", "sku not found", "missing mapping"]):
        return IntegrationErrorCategory.MAPPING_ERROR, False, None

    if any(k in msg for k in ["insufficient stock", "out of stock", "ats insufficient", "stock allocation failed"]):
        return IntegrationErrorCategory.INSUFFICIENT_STOCK, False, None

    if any(k in msg for k in ["duplicate", "already processed", "idempotent"]):
        return IntegrationErrorCategory.DUPLICATE_EVENT, False, None

    if any(k in msg for k in ["malformed", "invalid payload", "schema validation", "missing required field"]):
        return IntegrationErrorCategory.VALIDATION_ERROR, False, None

    if any(k in msg for k in ["not found", "does not exist", "404"]):
        return IntegrationErrorCategory.NOT_FOUND, False, None

    # Fallback: Default to BUSINESS_RULE_ERROR for unknown internal exceptions (fail fast)
    return IntegrationErrorCategory.BUSINESS_RULE_ERROR, False, None


# ==============================================================================
# 2. Exponential Backoff Calculation
# ==============================================================================

def compute_backoff_delay(
    attempt_count: int,
    base_delay_seconds: int = 60,
    max_delay_seconds: int = 3600,
    retry_after: Optional[int] = None,
    jitter: bool = False,
) -> int:
    """
    Calculates the backoff delay in seconds for the given attempt.
    - If `retry_after` is provided (e.g. from HTTP 429 response), honors it directly.
    - Otherwise applies exponential backoff: base_delay * (2 ** (attempt - 1)).
    - Clamped to max_delay_seconds.
    """
    if retry_after is not None and retry_after > 0:
        return min(max_delay_seconds, int(retry_after))

    exponent = max(0, attempt_count - 1)
    delay = base_delay_seconds * (2 ** exponent)
    delay = min(max_delay_seconds, delay)

    if jitter and delay > 5:
        # Add up to 10% jitter to prevent thundering herd
        jitter_delta = random.randint(0, max(1, int(delay * 0.1)))
        delay += jitter_delta

    return int(delay)


# ==============================================================================
# 3. Event Failure State Machine & Audit Tracking
# ==============================================================================

def record_event_failure(
    event: IntegrationEvent,
    exc: Optional[Exception] = None,
    status_code: Optional[int] = None,
    error_message: Optional[str] = None,
    retry_after: Optional[int] = None,
    base_delay_seconds: int = 60,
    max_delay_seconds: int = 3600,
    increment_attempt: bool = True,
) -> IntegrationEvent:
    """
    Standardized failure transition for an IntegrationEvent:
    1. Classifies the error into one of the 12 structured categories.
    2. Determines transient vs permanent classification.
    3. If transient and attempts remain -> schedules RETRY with exponential backoff.
    4. If permanent or attempts exhausted -> sets FAILED_PERMANENTLY.
    5. Records append-only audit trail in IntegrationLog.
    """
    category, is_transient, extracted_retry_after = classify_error(
        exc=exc,
        status_code=status_code,
        error_message=error_message,
        details=event.error_details,
    )
    effective_retry_after = retry_after or extracted_retry_after

    raw_err = error_message or (str(exc) if exc else "Unknown integration error")
    sanitized_err = sanitize_secrets({"error": raw_err})["error"]

    now = timezone.now()

    with transaction.atomic():
        # Re-fetch event under row lock
        locked_event = (
            IntegrationEvent.all_objects.select_for_update()
            .filter(id=event.id)
            .first()
        )
        if not locked_event:
            return event

        # Increment attempt count if requested
        if increment_attempt:
            locked_event.attempt_count += 1

        # Update error details
        error_details = dict(locked_event.error_details or {})
        error_details.update({
            "category": category.value,
            "is_transient": is_transient,
            "exception": exc.__class__.__name__ if exc else "IntegrationError",
            "status_code": status_code,
            "failed_at": now.isoformat(),
            "attempt": locked_event.attempt_count,
        })
        if effective_retry_after:
            error_details["retry_after"] = effective_retry_after

        locked_event.error_message = sanitized_err
        locked_event.error_details = error_details

        # Branch: Transient Retry vs Permanent Failure
        if is_transient and locked_event.attempt_count < locked_event.max_retries:
            locked_event.status = IntegrationEvent.Status.RETRY
            locked_event.last_retry_at = now

            custom_base = base_delay_seconds
            if locked_event.endpoint and locked_event.endpoint.retry_delay_seconds:
                custom_base = locked_event.endpoint.retry_delay_seconds

            delay = compute_backoff_delay(
                attempt_count=locked_event.attempt_count,
                base_delay_seconds=custom_base,
                max_delay_seconds=max_delay_seconds,
                retry_after=effective_retry_after,
            )
            locked_event.next_retry_at = now + timedelta(seconds=delay)
            locked_event.save(
                update_fields=[
                    "status",
                    "attempt_count",
                    "error_message",
                    "error_details",
                    "last_retry_at",
                    "next_retry_at",
                    "updated_at",
                ]
            )

            IntegrationLog.all_objects.create(
                shop=locked_event.shop,
                integration=locked_event.integration,
                level=IntegrationLog.Level.WARNING,
                action="event_retry_scheduled",
                message=(
                    f"Event {locked_event.external_event_id} failed with [{category.value}]. "
                    f"Retry scheduled in {delay}s (Attempt {locked_event.attempt_count}/{locked_event.max_retries})."
                ),
                details={
                    "error": sanitized_err,
                    "category": category.value,
                    "next_retry_at": locked_event.next_retry_at.isoformat(),
                    "attempt": locked_event.attempt_count,
                },
            )
            record_integration_audit(
                shop=locked_event.shop,
                action=str(IntegrationAuditLog.Action.RETRY_TRIGGERED),
                integration=locked_event.integration,
                event_type=locked_event.event_type,
                internal_id=str(locked_event.id),
                external_id=locked_event.external_event_id,
                status="retry",
                attempt_count=locked_event.attempt_count,
                error_type=category.value,
                error_message=sanitized_err,
                http_status=status_code,
                description=f"Retry #{locked_event.attempt_count} scheduled for event {locked_event.external_event_id}.",
                details={"category": category.value, "next_retry_at": locked_event.next_retry_at.isoformat()},
            )
            logger.warning(
                f"IntegrationEvent #{locked_event.id} [{category.value}] transient failure. "
                f"Retry #{locked_event.attempt_count} scheduled at {locked_event.next_retry_at}"
            )
            return locked_event

        else:
            # Permanent failure OR Retry exhaustion
            if is_transient and locked_event.attempt_count >= locked_event.max_retries:
                locked_event.status = IntegrationEvent.Status.RETRY_LIMIT_REACHED
                locked_event.next_retry_at = None
                locked_event.save(update_fields=["status", "attempt_count", "error_message", "error_details", "next_retry_at", "updated_at"])

                locked_event.status = IntegrationEvent.Status.FAILED_PERMANENTLY
                locked_event.save(update_fields=["status", "updated_at"])

                IntegrationLog.all_objects.create(
                    shop=locked_event.shop,
                    integration=locked_event.integration,
                    level=IntegrationLog.Level.ERROR,
                    action="event_retry_exhausted",
                    message=(
                        f"Event {locked_event.external_event_id} reached retry exhaustion "
                        f"({locked_event.attempt_count}/{locked_event.max_retries}). Marked FAILED_PERMANENTLY."
                    ),
                    details={
                        "error": sanitized_err,
                        "category": category.value,
                        "attempt": locked_event.attempt_count,
                        "max_retries": locked_event.max_retries,
                    },
                )
                record_integration_audit(
                    shop=locked_event.shop,
                    action=str(IntegrationAuditLog.Action.INTEGRATION_FAILED),
                    integration=locked_event.integration,
                    event_type=locked_event.event_type,
                    internal_id=str(locked_event.id),
                    external_id=locked_event.external_event_id,
                    status="failed",
                    attempt_count=locked_event.attempt_count,
                    error_type=category.value,
                    error_message=sanitized_err,
                    http_status=status_code,
                    description=f"Event {locked_event.external_event_id} reached retry exhaustion ({locked_event.max_retries}). Marked FAILED_PERMANENTLY.",
                    details={"category": category.value, "attempt": locked_event.attempt_count, "exhausted": True},
                )
                logger.error(
                    f"IntegrationEvent #{locked_event.id} reached retry exhaustion ({locked_event.max_retries}). "
                    f"Marked FAILED_PERMANENTLY."
                )
            else:
                # Permanent failure (non-transient: invalid credentials, malformed data, etc.)
                locked_event.status = IntegrationEvent.Status.FAILED_PERMANENTLY
                locked_event.next_retry_at = None
                locked_event.save(
                    update_fields=[
                        "status",
                        "attempt_count",
                        "error_message",
                        "error_details",
                        "next_retry_at",
                        "updated_at",
                    ]
                )

                IntegrationLog.all_objects.create(
                    shop=locked_event.shop,
                    integration=locked_event.integration,
                    level=IntegrationLog.Level.ERROR,
                    action="event_failed_permanently",
                    message=(
                        f"Event {locked_event.external_event_id} failed permanently with [{category.value}]: {sanitized_err}"
                    ),
                    details={"error": sanitized_err, "category": category.value},
                )
                record_integration_audit(
                    shop=locked_event.shop,
                    action=str(IntegrationAuditLog.Action.INTEGRATION_FAILED),
                    integration=locked_event.integration,
                    event_type=locked_event.event_type,
                    internal_id=str(locked_event.id),
                    external_id=locked_event.external_event_id,
                    status="failed",
                    attempt_count=locked_event.attempt_count,
                    error_type=category.value,
                    error_message=sanitized_err,
                    http_status=status_code,
                    description=f"Event {locked_event.external_event_id} failed permanently with [{category.value}].",
                    details={"category": category.value, "attempt": locked_event.attempt_count},
                )
                logger.error(
                    f"IntegrationEvent #{locked_event.id} failed permanently [{category.value}]. No retry scheduled."
                )

            return locked_event


# ==============================================================================
# 4. Manual Retry Execution & Duplicate Prevention
# ==============================================================================

def manual_retry_event(
    event_id: int,
    force: bool = False,
    actor: str = "Admin",
) -> Tuple[IntegrationEvent, bool, str]:
    """
    Allows a tenant operator to manually re-trigger a failed, retry-exhausted,
    or permanently failed integration event.

    Guards:
    - If event has already SUCCEEDED and not `force`: aborts immediately to prevent duplicate orders/shipments.
    - If event is currently in PROCESSING: aborts to prevent concurrent duplicate processing.

    Returns:
        (event, success, message)
    """
    from .webhook_engine import execute_event_processing

    with transaction.atomic():
        event = (
            IntegrationEvent.all_objects.select_for_update()
            .filter(id=event_id)
            .first()
        )
        if not event:
            raise ValueError(f"IntegrationEvent #{event_id} does not exist.")

        # Guard: Prevent duplicate execution if already succeeded
        if event.status == IntegrationEvent.Status.SUCCESS and not force:
            logger.info(f"Manual retry aborted for Event #{event_id}: already successfully processed.")
            return event, False, "Event already succeeded. Retry aborted to prevent duplicate execution."

        # Guard: Prevent concurrent processing race condition
        if event.status == IntegrationEvent.Status.PROCESSING:
            logger.warning(f"Manual retry aborted for Event #{event_id}: currently in processing state.")
            return event, False, "Event is currently processing. Manual retry aborted."

        # Reset state for retry
        prev_status = event.status
        event.status = IntegrationEvent.Status.QUEUED
        event.next_retry_at = None
        event.save(update_fields=["status", "next_retry_at", "updated_at"])

        IntegrationLog.all_objects.create(
            shop=event.shop,
            integration=event.integration,
            level=IntegrationLog.Level.INFO,
            action="event_manual_retry_initiated",
            message=f"Manual retry initiated by {actor} (previous status: {prev_status}).",
            details={"actor": actor, "previous_status": prev_status},
        )

        record_integration_audit(
            shop=event.shop,
            action=str(IntegrationAuditLog.Action.RETRY_TRIGGERED),
            integration=event.integration,
            event_type=event.event_type,
            internal_id=str(event.id),
            external_id=event.external_event_id,
            status="pending",
            description=f"Manual retry initiated by {actor} (previous status: {prev_status}).",
            details={"actor": actor, "previous_status": prev_status, "trigger": "manual"},
        )

    # Execute processing within tenant context
    try:
        updated_event = execute_event_processing(event.id)
        if updated_event.status == IntegrationEvent.Status.SUCCESS:
            return updated_event, True, "Event re-processed successfully."
        else:
            return updated_event, False, f"Event processing failed: {updated_event.error_message}"
    except Exception as exc:
        record_event_failure(event, exc=exc)
        event.refresh_from_db()
        return event, False, f"Manual retry encountered error: {str(exc)}"


# ==============================================================================
# 5. Failed Event Visibility & Recovery Queries
# ==============================================================================

def query_failed_events(
    shop,
    integration_id: Optional[int] = None,
    category: Optional[Union[IntegrationErrorCategory, str]] = None,
    status: Optional[str] = None,
    limit: int = 50,
):
    """
    Provides tenant-scoped visibility into failed and retry-scheduled events.
    """
    qs = IntegrationEvent.all_objects.filter(shop=shop)

    if status:
        qs = qs.filter(status=status)
    else:
        # Default to all failure and retry states
        qs = qs.filter(
            status__in=[
                IntegrationEvent.Status.FAILED,
                IntegrationEvent.Status.RETRY,
                IntegrationEvent.Status.RETRY_LIMIT_REACHED,
                IntegrationEvent.Status.FAILED_PERMANENTLY,
            ]
        )

    if integration_id:
        qs = qs.filter(integration_id=integration_id)

    if category:
        cat_val = category.value if isinstance(category, IntegrationErrorCategory) else str(category)
        qs = qs.filter(error_details__category=cat_val)

    return qs.order_by("-updated_at")[:limit]


def retry_eligible_events(batch_size: int = 100) -> List[int]:
    """
    Finds events scheduled in RETRY status whose next_retry_at timestamp has arrived,
    and executes them. Used by background workers or Celery beat periodic pollers.
    """
    from .webhook_engine import execute_event_processing

    now = timezone.now()
    eligible_ids = list(
        IntegrationEvent.all_objects.filter(
            models.Q(status=IntegrationEvent.Status.RETRY, next_retry_at__lte=now)
            | models.Q(status=IntegrationEvent.Status.QUEUED)
        )
        .order_by("created_at")
        .values_list("id", flat=True)[:batch_size]
    )

    processed_ids = []
    for event_id in eligible_ids:
        try:
            execute_event_processing(event_id)
            processed_ids.append(event_id)
        except Exception as exc:
            logger.error(f"Error executing scheduled retry for Event #{event_id}: {exc}")

    return processed_ids
