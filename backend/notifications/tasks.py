from datetime import timedelta
from django.utils import timezone
from celery import shared_task

from .models import Notification

@shared_task
def delete_old_notifications():
    """
    Delete all notifications older than 7 days to prevent database bloat.
    """
    cutoff_date = timezone.now() - timedelta(days=7)
    deleted, _ = Notification.objects.filter(created_at__lt=cutoff_date).delete()
    return deleted
