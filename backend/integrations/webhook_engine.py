"""
Generic Webhook & Event Ingestion Engine for StockWhisk Integrations.

Manages the complete resilient webhook lifecycle:
RECEIVED -> AUTHENTICATED -> VALIDATED -> DEDUPLICATED -> QUEUED -> PROCESSING -> SUCCESS
With retry and failure loops:
PROCESSING -> FAILED -> RETRY -> SUCCESS or RETRY_LIMIT_REACHED -> FAILED_PERMANENTLY
"""
import base64
import hashlib
import hmac
import json
import logging
from datetime import timedelta
from typing import Any, Callable, Dict, Optional, Tuple

from django.db import DatabaseError, IntegrityError, transaction
from django.utils import timezone

from core.tenant_context import tenant_context
from .models import IntegrationAuditLog, IntegrationEvent, IntegrationLog, WebhookEndpoint
from .audit import record_integration_audit

logger = logging.getLogger("integrations.webhooks")

# Redacted keys for payload & header security
SENSITIVE_KEY_PATTERNS = {
    "password",
    "secret",
    "token",
    "api_key",
    "apikey",
    "authorization",
    "access_token",
    "private_key",
    "client_secret",
}

# Webhook timestamp tolerance (5 minutes) for replay attack defense
MAX_TIMESTAMP_TOLERANCE_SECONDS = 300


def check_timestamp_freshness(headers: Dict[str, str], max_skew_seconds: int = MAX_TIMESTAMP_TOLERANCE_SECONDS) -> Tuple[bool, Optional[str]]:
    """
    Validates webhook timestamp freshness against replay attacks.
    Inspects standard timestamp headers: X-Webhook-Timestamp, X-Timestamp,
    X-Shopify-Webhook-Timestamp, X-WC-Webhook-Timestamp.
    """
    norm_headers = {k.lower().replace("_", "-"): str(v) for k, v in headers.items()}
    ts_val = (
        norm_headers.get("x-webhook-timestamp")
        or norm_headers.get("x-timestamp")
        or norm_headers.get("x-shopify-webhook-timestamp")
        or norm_headers.get("x-wc-webhook-timestamp")
    )
    if not ts_val:
        return True, None

    import datetime
    now_ts = timezone.now().timestamp()
    req_ts = None
    try:
        # Try UNIX epoch timestamp (seconds or milliseconds)
        req_ts = float(ts_val)
        if req_ts > 1e11:  # Milliseconds
            req_ts = req_ts / 1000.0
    except (ValueError, TypeError):
        try:
            dt = datetime.datetime.fromisoformat(ts_val.replace("Z", "+00:00"))
            if timezone.is_naive(dt):
                dt = timezone.make_aware(dt)
            req_ts = dt.timestamp()
        except Exception:
            return False, "Malformed webhook timestamp header."

    if req_ts is not None:
        skew = now_ts - req_ts
        if skew > max_skew_seconds:
            return False, f"Webhook timestamp expired ({int(skew)}s older than {max_skew_seconds}s limit; replay rejected)."
        if skew < -60:  # Allow max 60s future skew for slight server clock drift
            return False, f"Webhook timestamp is in the future ({int(-skew)}s ahead)."

    return True, None


def sanitize_secrets(data: Any) -> Any:
    """
    Recursively sanitize dictionaries/lists to ensure sensitive credentials never
    leak into stored event logs, headers, or exception traces.
    """
    if isinstance(data, dict):
        cleaned = {}
        for k, v in data.items():
            key_str = str(k).lower()
            if any(pattern in key_str for pattern in SENSITIVE_KEY_PATTERNS):
                cleaned[k] = "[REDACTED]"
            elif isinstance(v, (dict, list)):
                cleaned[k] = sanitize_secrets(v)
            else:
                cleaned[k] = v
        return cleaned
    elif isinstance(data, list):
        return [sanitize_secrets(item) for item in data]
    return data


def verify_signature(
    endpoint: WebhookEndpoint,
    headers: Dict[str, str],
    raw_body: bytes,
) -> bool:
    """
    Generic webhook signature and token verifier.
    Supports HMAC-SHA256 (hex and base64) and direct secret tokens.
    """
    secret = endpoint.secret_token
    if not secret:
        # No verification token required on this endpoint
        return True

    # Normalize header keys to lowercase
    norm_headers = {k.lower().replace("_", "-"): str(v) for k, v in headers.items()}

    # Check for direct shared secret header
    auth_header = (
        norm_headers.get("x-webhook-secret")
        or norm_headers.get("x-secret-token")
        or norm_headers.get("authorization")
    )
    if auth_header:
        token = auth_header.replace("Bearer ", "").strip()
        if hmac.compare_digest(token, secret):
            return True

    # Check for HMAC-SHA256 signatures
    signature_header = (
        norm_headers.get("x-hub-signature-256")
        or norm_headers.get("x-wc-webhook-signature")
        or norm_headers.get("x-shopify-hmac-sha256")
        or norm_headers.get("x-signature")
    )
    if not signature_header:
        return False

    secret_bytes = secret.encode("utf-8")
    expected_hmac = hmac.new(secret_bytes, raw_body, hashlib.sha256)
    expected_hex = expected_hmac.hexdigest()
    expected_b64 = base64.b64encode(expected_hmac.digest()).decode("utf-8")

    sig = signature_header.strip()
    if sig.startswith("sha256="):
        sig = sig[7:]

    # Constant-time comparison against both hex and base64 representations
    return hmac.compare_digest(sig, expected_hex) or hmac.compare_digest(sig, expected_b64)


class EventDispatcher:
    """
    Extensible handler registry for domain events.
    Connectors or business workflows register callbacks without hardcoding them in the engine.
    """

    _handlers: Dict[str, list[Callable[[IntegrationEvent], None]]] = {}

    @classmethod
    def register(cls, event_type: str, handler: Callable[[IntegrationEvent], None]) -> None:
        if event_type not in cls._handlers:
            cls._handlers[event_type] = []
        cls._handlers[event_type].append(handler)

    @classmethod
    def clear(cls) -> None:
        cls._handlers.clear()

    @classmethod
    def dispatch(cls, event: IntegrationEvent) -> None:
        handlers = cls._handlers.get(event.event_type, [])
        # Also execute wildcard handlers
        wildcards = cls._handlers.get("*", [])
        all_handlers = handlers + wildcards
        if all_handlers:
            for handler in all_handlers:
                handler(event)
        else:
            # Built-in automatic dispatch for order webhooks
            payload = event.payload if isinstance(event.payload, dict) else {}
            has_order_structure = (
                "items" in payload
                or "line_items" in payload
                or event.event_type in (
                    "order.created",
                    "order.updated",
                    "order.placed",
                    "orders/create",
                    "orders/updated",
                    "order",
                    "new_order",
                )
            )
            if has_order_structure and event.integration:
                from .order_engine import process_external_order
                process_external_order(
                    shop=event.shop,
                    integration=event.integration,
                    order_payload=payload,
                )


def ingest_webhook(
    endpoint: WebhookEndpoint,
    raw_body: bytes,
    headers: Dict[str, str],
) -> Tuple[Dict[str, Any], int]:
    """
    Executes the ingestion lifecycle:
    RECEIVED -> AUTHENTICATED -> VALIDATED -> DEDUPLICATED -> QUEUED

    Returns (response_payload, http_status_code).
    """
    now = timezone.now()
    sanitized_headers = sanitize_secrets(dict(headers))
    raw_text = raw_body.decode("utf-8", errors="replace")

    # 1. AUTHENTICATED check
    if not verify_signature(endpoint, headers, raw_body):
        IntegrationLog.all_objects.create(
            shop=endpoint.shop,
            integration=endpoint.integration,
            level=IntegrationLog.Level.WARNING,
            action="webhook_auth_failed",
            message=f"Signature verification failed for endpoint {endpoint.name}",
            details={"headers": sanitized_headers},
        )
        record_integration_audit(
            shop=endpoint.shop,
            action=str(IntegrationAuditLog.Action.WEBHOOK_RECEIVED),
            integration=endpoint.integration,
            status="failed",
            http_status=401,
            error_type="SignatureVerificationFailed",
            error_message=f"Signature verification failed for endpoint {endpoint.name}",
            description=f"Webhook signature authentication rejected for endpoint '{endpoint.name}'.",
            details={"endpoint_id": str(endpoint.id)},
        )
        return {"error": "Invalid webhook signature or secret."}, 401

    # 1b. Replay attack defense (timestamp freshness validation)
    is_fresh, freshness_err = check_timestamp_freshness(headers)
    if not is_fresh:
        logger.warning(f"Webhook replay detected for endpoint {endpoint.name}: {freshness_err}")
        record_integration_audit(
            shop=endpoint.shop,
            action=str(IntegrationAuditLog.Action.WEBHOOK_RECEIVED),
            integration=endpoint.integration,
            status="failed",
            http_status=400,
            error_type="ReplayAttackDetected",
            error_message=freshness_err or "Timestamp freshness validation failed.",
            description=f"Webhook rejected due to stale or future timestamp on '{endpoint.name}'.",
            details={"endpoint_id": str(endpoint.id)},
        )
        return {"error": freshness_err}, 400

    # 2. VALIDATED check (parse payload and extract identifiers)
    try:
        if not raw_text.strip():
            payload = {}
        else:
            payload = json.loads(raw_text)
            if not isinstance(payload, dict):
                payload = {"data": payload}
    except Exception:
        return {"error": "Malformed or invalid JSON payload."}, 400

    # Extract external_event_id and event_type
    norm_headers = {k.lower(): str(v) for k, v in headers.items()}
    external_event_id = (
        payload.get("id")
        or payload.get("event_id")
        or payload.get("idempotency_key")
        or norm_headers.get("x-event-id")
        or norm_headers.get("x-delivery")
    )
    if not external_event_id:
        # Fallback to deterministic hash of raw body if no explicit event id provided
        external_event_id = hashlib.sha256(raw_body).hexdigest()[:32]
    else:
        external_event_id = str(external_event_id)

    event_type = (
        payload.get("event")
        or payload.get("event_type")
        or payload.get("topic")
        or norm_headers.get("x-event-type")
        or "generic.event"
    )

    # 3. DEDUPLICATED check (Idempotency)
    # Check if an event already exists with this (shop, integration, external_event_id)
    existing_event = IntegrationEvent.all_objects.filter(
        shop=endpoint.shop,
        integration=endpoint.integration,
        external_event_id=external_event_id,
    ).first()

    if existing_event:
        # If already successfully processed or currently queued/processing, do NOT re-enqueue
        if existing_event.status in (
            IntegrationEvent.Status.SUCCESS,
            IntegrationEvent.Status.QUEUED,
            IntegrationEvent.Status.PROCESSING,
        ):
            return {
                "status": "deduplicated",
                "message": "Event already received and processed or in progress.",
                "event_id": existing_event.id,
                "duplicate": True,
            }, 200

    # 4. QUEUED: Create event record atomically
    sanitized_payload = sanitize_secrets(payload) if isinstance(payload, dict) else payload
    try:
        with transaction.atomic():
            event = IntegrationEvent.all_objects.create(
                shop=endpoint.shop,
                integration=endpoint.integration,
                endpoint=endpoint,
                external_event_id=external_event_id,
                event_type=event_type,
                payload=sanitized_payload,
                raw_payload=raw_text,
                headers=sanitized_headers,
                status=IntegrationEvent.Status.QUEUED,
                received_at=now,
                authenticated_at=now,
                validated_at=now,
                queued_at=now,
                max_retries=endpoint.max_retries,
            )
            record_integration_audit(
                shop=endpoint.shop,
                action=str(IntegrationAuditLog.Action.WEBHOOK_RECEIVED),
                integration=endpoint.integration,
                event_type=event_type,
                internal_id=str(event.id),
                external_id=external_event_id,
                status="success",
                http_status=200,
                description=f"Webhook event '{event_type}' received and queued.",
                details={"endpoint_id": str(endpoint.id), "endpoint_name": endpoint.name},
            )
    except IntegrityError:
        # Concurrent duplicate delivery race condition: another request just inserted it
        existing = IntegrationEvent.all_objects.filter(
            shop=endpoint.shop,
            integration=endpoint.integration,
            external_event_id=external_event_id,
        ).first()
        return {
            "status": "deduplicated",
            "message": "Concurrent duplicate event delivery intercepted.",
            "event_id": existing.id if existing else None,
            "duplicate": True,
        }, 200
    except DatabaseError as db_err:
        logger.error(f"Database error during webhook event persistence: {db_err}")
        return {
            "error": "Database error while storing event.",
            "retry": True,
        }, 500

    # 5. Enqueue Celery Task
    try:
        from .tasks import process_integration_event

        process_integration_event.delay(event.id)
    except Exception as exc:
        # Celery broker down or connection failure
        logger.error(f"Celery dispatch failed for event {event.id}: {exc}")
        event.error_message = f"Celery queue dispatch delayed: {str(exc)}"
        event.save(update_fields=["error_message"])
        return {
            "status": "queued",
            "message": "Webhook recorded in database; async dispatch queued.",
            "event_id": event.id,
        }, 202

    return {
        "status": "queued",
        "message": "Webhook accepted and queued for processing.",
        "event_id": event.id,
    }, 202


def execute_event_processing(event_id: int) -> IntegrationEvent:
    """
    Processes an event through the state machine:
    QUEUED -> PROCESSING -> SUCCESS
    or:
    PROCESSING -> FAILED -> RETRY -> SUCCESS
    or:
    FAILED -> RETRY_LIMIT_REACHED -> FAILED_PERMANENTLY
    """
    with transaction.atomic():
        event = (
            IntegrationEvent.all_objects.select_for_update()
            .filter(id=event_id)
            .first()
        )
        if not event:
            raise ValueError(f"IntegrationEvent #{event_id} does not exist.")

        # Guard: If already successful, ignore to prevent duplicate execution
        if event.status == IntegrationEvent.Status.SUCCESS:
            return event

        # Transition to PROCESSING
        event.status = IntegrationEvent.Status.PROCESSING
        event.attempt_count += 1
        event.processing_started_at = timezone.now()
        event.save(update_fields=["status", "attempt_count", "processing_started_at", "updated_at"])

    # Execute business logic within tenant context
    with tenant_context(event.shop):
        try:
            EventDispatcher.dispatch(event)

            # Processing SUCCEEDED
            event.status = IntegrationEvent.Status.SUCCESS
            event.processed_at = timezone.now()
            event.error_message = ""
            event.save(update_fields=["status", "processed_at", "error_message", "updated_at"])

            IntegrationLog.all_objects.create(
                shop=event.shop,
                integration=event.integration,
                level=IntegrationLog.Level.INFO,
                action="event_processed_success",
                message=f"Event {event.event_type} [{event.external_event_id}] processed successfully.",
            )
            return event

        except Exception as exc:
            # Delegate to Phase 13 recovery engine for structured categorization,
            # transient vs. permanent decision, exponential backoff, and audit logging.
            from .recovery import record_event_failure

            base_delay = 60
            if event.endpoint and event.endpoint.retry_delay_seconds:
                base_delay = event.endpoint.retry_delay_seconds

            return record_event_failure(
                event=event,
                exc=exc,
                base_delay_seconds=base_delay,
                increment_attempt=False,
            )
