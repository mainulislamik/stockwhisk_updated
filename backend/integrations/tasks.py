"""
Celery background tasks for the StockWhisk Integrations Platform.
Handles asynchronous webhook ingestion, scheduled retries, and background synchronization.
"""
import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger("integrations.tasks")


@shared_task(bind=True, max_retries=5, ignore_result=True)
def process_integration_event(self, event_id: int):
    """
    Background worker task to process an incoming IntegrationEvent.
    Executes within the event's tenant context with idempotency guarantees.
    """
    from .models import IntegrationEvent
    from .webhook_engine import execute_event_processing

    try:
        event = execute_event_processing(event_id)
        # If in RETRY status and has next_retry_at, schedule celery retry if requested
        if event.status == IntegrationEvent.Status.RETRY and event.next_retry_at:
            delay = max(5, int((event.next_retry_at - timezone.now()).total_seconds()))
            logger.info(f"Scheduling Celery retry for event #{event_id} in {delay}s")
            process_integration_event.apply_async(args=[event_id], countdown=delay)
    except Exception as exc:
        logger.error(f"Error processing integration event #{event_id}: {exc}")
        # Retry the Celery task itself if an unhandled worker exception occurred
        raise self.retry(exc=exc, countdown=30)


@shared_task(bind=True, max_retries=3, default_retry_delay=60, ignore_result=True)
def sync_inventory_mapping_task(self, mapping_id: int):
    """
    Asynchronous Celery task to synchronize inventory for a single ProductChannelMapping.
    Retries recoverable errors (timeout, server error, rate limit) with exponential backoff.
    """
    from .inventory_engine import sync_product_inventory

    try:
        result = sync_product_inventory(mapping_id)
        if result.status in ["retry", "rate_limited"] and self.request.retries < self.max_retries:
            countdown = result.retry_after or (60 * (2 ** self.request.retries))
            logger.info(f"Retrying inventory sync for mapping #{mapping_id} in {countdown}s (Attempt {self.request.retries + 1})")
            raise self.retry(countdown=countdown)
    except Exception as exc:
        if self.request.retries < self.max_retries:
            countdown = 60 * (2 ** self.request.retries)
            raise self.retry(exc=exc, countdown=countdown)
        logger.error(f"Permanent failure syncing inventory for mapping #{mapping_id}: {exc}")


@shared_task(ignore_result=True)
def sync_bulk_inventory_task(integration_id: int, mapping_ids=None, job_type="bulk_inventory_sync"):
    """
    Asynchronous Celery task to execute bulk inventory synchronization for an integration.
    """
    from .models import Integration
    from .inventory_engine import execute_bulk_inventory_sync

    integration = Integration.all_objects.filter(id=integration_id).first()
    if integration:
        execute_bulk_inventory_sync(integration, mapping_ids=mapping_ids, job_type=job_type)


@shared_task(ignore_result=True)
def retry_failed_inventory_syncs_task():
    """
    Periodic poller task to re-enqueue mappings stuck in PENDING_SYNC or transient error status.
    """
    from .models import ProductChannelMapping

    pending_mappings = list(
        ProductChannelMapping.all_objects.filter(
            is_sync_enabled=True,
            sync_inventory=True,
            sync_status=ProductChannelMapping.SyncStatus.PENDING_SYNC,
            integration__is_active=True,
        ).values_list("id", flat=True)[:50]
    )

    for mapping_id in pending_mappings:
        sync_inventory_mapping_task.delay(mapping_id)


@shared_task(ignore_result=True)
def retry_failed_events_task(batch_size: int = 50):
    """
    Periodic recovery task for Phase 13:
    Re-enqueues due retry events and stuck queued events.
    """
    from .recovery import retry_eligible_events

    return retry_eligible_events(batch_size=batch_size)


