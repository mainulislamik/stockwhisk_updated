"""Celery tasks for stock alerts."""
from decimal import Decimal

from celery import shared_task
from django.db.models import Sum

from analytics.services import low_stock_list, out_of_stock_list
from notifications.models import NotificationType
from notifications.services import get_alert_config, notify
from tenants.models import Shop


@shared_task
def reconcile_stock():
    """Nightly safety net: re-sum the immutable movement ledger and correct any
    drift in the cached ``Product.current_stock``. The hot write path updates the
    cache incrementally (O(1)); this catches any divergence from crashes, manual
    edits, or races. Mirrors the ``reconcile_stock`` management command."""
    from catalog.models import Product
    from inventory.models import StockMovement

    totals = {
        row["product_id"]: row["s"] or Decimal("0")
        for row in StockMovement.all_objects.values("product_id").annotate(s=Sum("quantity"))
    }
    fixed = 0
    for p in Product.all_objects.all().iterator():
        expected = totals.get(p.id, Decimal("0"))
        if Decimal(p.current_stock or 0) != expected:
            Product.all_objects.filter(pk=p.id).update(current_stock=expected)
            fixed += 1
    return {"drift_fixed": fixed}


@shared_task
def scan_low_stock():
    """Scan every active shop and raise low/out-of-stock notifications."""
    raised = 0
    for shop in Shop.objects.filter(is_active=True):
        cfg = get_alert_config(shop)
        if not cfg.low_stock_enabled:
            continue
        low = low_stock_list(shop)
        out = out_of_stock_list(shop)
        if not low and not out:
            continue

        lines = [f"• {p['name']} — out of stock" for p in out] + [
            f"• {p['name']} — low ({p['current_stock']}/{p['reorder_level']})" for p in low
        ]
        # Keep the message short: a summary + a few examples, not every item.
        PREVIEW = 8
        parts = []
        if out and low:
            parts.append(f"{len(out)} item(s) out of stock and {len(low)} running low.")
        elif out:
            parts.append(f"{len(out)} item(s) out of stock.")
        else:
            parts.append(f"{len(low)} item(s) running low.")
        parts.append("")
        parts.extend(lines[:PREVIEW])
        if len(lines) > PREVIEW:
            parts.append(f"…and {len(lines) - PREVIEW} more. Open Inventory & stock to review and reorder.")
        notify(
            shop=shop,
            type=NotificationType.OUT_OF_STOCK if out else NotificationType.LOW_STOCK,
            title=f"{len(out)} out-of-stock, {len(low)} low-stock item(s)",
            message="\n".join(parts),
            metadata={"low_ids": [p["id"] for p in low], "out_ids": [p["id"] for p in out]},
            email=cfg.email_enabled, sms=cfg.sms_enabled, whatsapp=cfg.whatsapp_enabled,
        )
        raised += 1
    return {"shops_notified": raised}
