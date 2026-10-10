"""
Signals for StockWhisk Integrations (Phase 6).

Listens to StockMovement post-save to push stock updates to external eCommerce channels.
"""
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver

from inventory.models import StockMovement
from .inventory_engine import trigger_inventory_sync_for_movement

logger = logging.getLogger("integrations.signals")


@receiver(post_save, sender=StockMovement)
def on_stock_movement_created(sender, instance, created, **kwargs):
    """
    Triggers outbound inventory synchronization whenever an immutable StockMovement
    is recorded in StockWhisk (POS sales, purchases, adjustments, returns, damage).
    """
    if created and instance and instance.id:
        try:
            trigger_inventory_sync_for_movement(instance.id)
        except Exception as exc:
            logger.error(f"Error handling stock movement #{instance.id} signal: {exc}")
