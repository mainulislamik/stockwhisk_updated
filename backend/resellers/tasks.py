"""Celery tasks for the reseller programme."""
import datetime

from celery import shared_task
from django.utils import timezone

from .services import generate_commissions_for_month


@shared_task(ignore_result=True)
def generate_previous_month_commissions():
    """Generate reseller commissions for the just-closed calendar month.

    Runs on the 1st of each month (see beat schedule). Idempotent — the
    per-(reseller, shop, month) unique constraint means re-running never
    double-charges, so a retry or manual run is always safe.
    """
    first_of_this_month = timezone.now().replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )
    prev = first_of_this_month - datetime.timedelta(days=1)
    created, skipped = generate_commissions_for_month(prev.year, prev.month)
    return {"year": prev.year, "month": prev.month, "created": created, "skipped": skipped}
