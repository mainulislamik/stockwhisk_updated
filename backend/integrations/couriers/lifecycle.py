"""
Courier Shipment Lifecycle Transition Engine for StockWhisk (Phase 12).
Orchestrates status normalization, transition precedence, out-of-order handling,
idempotent deduplication, status history audit trail, and internal business actions (Sale, ExternalOrder).

Strict Constraints:
- RTO (RETURNED) is treated strictly as a logistics event.
- NEVER automatically restock inventory on RTO without physical return inspection.
- Out-of-order events do not regress terminal or later states.
- Duplicate events do not create redundant history or re-trigger business side-effects.
"""
from dataclasses import dataclass
from decimal import Decimal
import logging
from typing import Dict, Optional, Tuple

from django.db import transaction
from django.utils import timezone

from integrations.couriers.base import ShipmentStatus
from integrations.models import CourierShipment, CourierStatusHistory, ExternalOrder
from sales.models import Sale

logger = logging.getLogger(__name__)

# State precedence ordering (higher number = further along in delivery pipeline)
STATE_PRECEDENCE: Dict[str, int] = {
    ShipmentStatus.PENDING: 10,
    ShipmentStatus.READY_TO_SHIP: 20,
    ShipmentStatus.PICKUP_REQUESTED: 30,
    ShipmentStatus.PICKED_UP: 40,
    ShipmentStatus.IN_TRANSIT: 50,
    ShipmentStatus.OUT_FOR_DELIVERY: 60,
    ShipmentStatus.DELIVERY_FAILED: 65,  # Intermediate exception: can be retried or become RETURNED
    ShipmentStatus.DELIVERED: 100,      # Terminal
    ShipmentStatus.CANCELLED: 100,      # Terminal
    ShipmentStatus.RETURNED: 100,       # Terminal logistics state
}

TERMINAL_STATES = {
    ShipmentStatus.DELIVERED,
    ShipmentStatus.CANCELLED,
    ShipmentStatus.RETURNED,
}


@dataclass
class TransitionResult:
    """Structured result of a courier shipment lifecycle transition."""
    shipment: CourierShipment
    transitioned: bool
    is_duplicate: bool
    is_out_of_order: bool
    old_status: str
    new_status: str
    message: str


def is_out_of_order_transition(current_status: str, new_status: str) -> bool:
    """
    Determine if an incoming status update represents an out-of-order event.

    Rules:
    - If current_status is terminal (DELIVERED, CANCELLED, RETURNED), non-terminal updates
      (like IN_TRANSIT, PICKED_UP, OUT_FOR_DELIVERY) are out-of-order and must not regress state.
    - If already DELIVERED, it cannot be CANCELLED by a delayed cancellation event.
    - If DELIVERY_FAILED, moving back to OUT_FOR_DELIVERY or IN_TRANSIT is a legitimate retry attempt.
    - For other states, if new_status has lower precedence than current_status, it is out-of-order.
    """
    if current_status == new_status:
        return False

    if current_status in TERMINAL_STATES:
        if new_status not in TERMINAL_STATES:
            return True
        if current_status == ShipmentStatus.DELIVERED and new_status == ShipmentStatus.CANCELLED:
            return True
        if current_status == ShipmentStatus.CANCELLED and new_status != ShipmentStatus.CANCELLED:
            return True
        if current_status == ShipmentStatus.RETURNED and new_status != ShipmentStatus.RETURNED:
            return True

    # Retry case: A failed delivery attempt can be sent OUT_FOR_DELIVERY again
    if current_status == ShipmentStatus.DELIVERY_FAILED and new_status in (
        ShipmentStatus.OUT_FOR_DELIVERY,
        ShipmentStatus.IN_TRANSIT,
    ):
        return False

    # Standard precedence comparison
    current_rank = STATE_PRECEDENCE.get(current_status, 0)
    new_rank = STATE_PRECEDENCE.get(new_status, 0)
    return new_rank < current_rank


def apply_shipment_transition(
    shipment: CourierShipment,
    new_status: str,
    raw_status: str = "",
    event_time: Optional[timezone.datetime] = None,
    location: str = "",
    remarks: str = "",
    actor: str = "System",
    collected_amount: Optional[Decimal] = None,
    raw_payload: Optional[Dict] = None,
) -> TransitionResult:
    """
    Atomically transition a CourierShipment to a new normalized status,
    with out-of-order protection, deduplication, audit logging, and business actions.
    """
    now = event_time or timezone.now()
    raw_payload = raw_payload or {}

    with transaction.atomic():
        # Lock shipment row for update (avoid outer join locking issues in Postgres)
        shipment = (
            CourierShipment.all_objects.select_for_update()
            .get(id=shipment.id)
        )
        current_status = shipment.status

        # 1. Deduplication check: duplicate status
        if current_status == new_status:
            # Check if collected amount needs update
            updated = False
            if collected_amount is not None and collected_amount > shipment.collected_amount:
                shipment.collected_amount = collected_amount
                updated = True

            raw_changed = bool(raw_status and raw_status != shipment.raw_status)
            if raw_changed:
                shipment.raw_status = raw_status
                updated = True

            if updated:
                shipment.save(update_fields=["collected_amount", "raw_status", "updated_at"])

            if raw_changed:
                # New raw signal mapped to same normalized status — record in audit history
                CourierStatusHistory.all_objects.create(
                    shop=shipment.shop,
                    shipment=shipment,
                    from_status=current_status,
                    to_status=current_status,
                    raw_status=raw_status,
                    event_time=now,
                    location=location,
                    remarks=remarks or f"Raw courier update '{raw_status}' mapped to '{current_status}'",
                    actor=actor,
                    raw_payload=raw_payload,
                )

            return TransitionResult(
                shipment=shipment,
                transitioned=False,
                is_duplicate=not raw_changed,
                is_out_of_order=False,
                old_status=current_status,
                new_status=new_status,
                message=(
                    f"Raw courier update '{raw_status}' recorded under '{current_status}'."
                    if raw_changed
                    else f"Duplicate status '{new_status}' received. No state change applied."
                ),
            )

        # 2. Out-of-order check
        if is_out_of_order_transition(current_status, new_status):
            # Record status history entry noting out-of-order delivery without mutating current status
            history_remarks = (
                f"Out-of-order event '{new_status}' (raw: '{raw_status}') received while shipment "
                f"is in '{current_status}'. Status preserved."
            )
            if remarks:
                history_remarks = f"{history_remarks} | Note: {remarks}"

            CourierStatusHistory.all_objects.create(
                shop=shipment.shop,
                shipment=shipment,
                from_status=current_status,
                to_status=current_status,  # Preserves current status
                raw_status=raw_status or shipment.raw_status,
                event_time=now,
                location=location,
                remarks=history_remarks,
                actor=actor,
                raw_payload=raw_payload,
            )

            logger.warning(
                "Out-of-order courier event ignored for shipment #%s: %s -> %s",
                shipment.tracking_id,
                current_status,
                new_status,
            )

            return TransitionResult(
                shipment=shipment,
                transitioned=False,
                is_duplicate=False,
                is_out_of_order=True,
                old_status=current_status,
                new_status=new_status,
                message=f"Out-of-order status '{new_status}' ignored. Current status '{current_status}' retained.",
            )

        # 3. Valid transition: apply state change
        old_status = current_status
        shipment.status = new_status
        shipment.raw_status = raw_status or new_status

        # Set specific lifecycle timestamps
        if new_status == ShipmentStatus.PICKUP_REQUESTED and not shipment.pickup_requested_at:
            shipment.pickup_requested_at = now
        elif new_status == ShipmentStatus.PICKED_UP and not shipment.picked_up_at:
            shipment.picked_up_at = now
        elif new_status == ShipmentStatus.DELIVERED and not shipment.delivered_at:
            shipment.delivered_at = now
        elif new_status == ShipmentStatus.CANCELLED and not shipment.cancelled_at:
            shipment.cancelled_at = now
        elif new_status == ShipmentStatus.RETURNED and not shipment.returned_at:
            shipment.returned_at = now

        if collected_amount is not None:
            shipment.collected_amount = collected_amount

        shipment.save()

        # 4. Record append-only audit trail
        CourierStatusHistory.all_objects.create(
            shop=shipment.shop,
            shipment=shipment,
            from_status=old_status,
            to_status=new_status,
            raw_status=raw_status,
            event_time=now,
            location=location,
            remarks=remarks or f"Transitioned from {old_status} to {new_status}",
            actor=actor,
            raw_payload=raw_payload,
        )

        # 5. Trigger appropriate StockWhisk internal business actions
        trigger_shipment_business_actions(
            shipment=shipment,
            old_status=old_status,
            new_status=new_status,
            event_time=now,
            remarks=remarks,
        )

        return TransitionResult(
            shipment=shipment,
            transitioned=True,
            is_duplicate=False,
            is_out_of_order=False,
            old_status=old_status,
            new_status=new_status,
            message=f"Shipment transitioned successfully from '{old_status}' to '{new_status}'.",
        )


def trigger_shipment_business_actions(
    shipment: CourierShipment,
    old_status: str,
    new_status: str,
    event_time: timezone.datetime,
    remarks: str = "",
):
    """
    Connect courier shipment status with StockWhisk's internal entities (Sale, ExternalOrder).

    CRITICAL INVENTORY & LOGISTICS RULES:
    1. DELIVERED:
       - Update Sale custom fields with delivery confirmation and COD collected.
       - If Sale is DUE/PARTIAL and full COD collected, adjust paid amount & status.
       - Complete ExternalOrder sync_status.
    2. DELIVERY_FAILED:
       - Flag failure on Sale and ExternalOrder for merchant attention.
       - Do NOT cancel Sale, as courier re-attempts are common.
    3. CANCELLED:
       - Flag cancellation on Sale and ExternalOrder.
    4. RETURNED (RTO - Return to Origin):
       - STRICT RULE: RTO is a LOGISTICS event.
       - NEVER automatically restock inventory.
       - Physical return inspection by warehouse staff must take place first.
       - Mark sale rto_status as 'received_pending_inspection'.
    """
    sale = shipment.sale
    external_order = shipment.external_order

    # A. Update StockWhisk Sale
    if sale:
        custom_fields = sale.custom_fields or {}
        custom_fields["courier_shipment_id"] = str(shipment.id)
        custom_fields["courier_tracking_id"] = shipment.tracking_id
        custom_fields["courier_delivery_status"] = new_status.lower()
        custom_fields["courier_status_updated_at"] = event_time.isoformat()

        if new_status == ShipmentStatus.DELIVERED:
            custom_fields["delivered_at"] = event_time.isoformat()
            if shipment.collected_amount > 0:
                custom_fields["courier_cod_collected"] = str(shipment.collected_amount)
                # If sale still has unpaid balance and COD was collected:
                if sale.status in (Sale.Status.DUE, Sale.Status.PARTIAL):
                    new_paid = min(sale.total, (sale.paid or Decimal("0.00")) + shipment.collected_amount)
                    sale.paid = new_paid
                    if sale.paid >= sale.total:
                        sale.status = Sale.Status.PAID
                    else:
                        sale.status = Sale.Status.PARTIAL

        elif new_status == ShipmentStatus.DELIVERY_FAILED:
            custom_fields["delivery_failure_reason"] = remarks or "Delivery attempt failed"
            custom_fields["delivery_failure_time"] = event_time.isoformat()

        elif new_status == ShipmentStatus.CANCELLED:
            custom_fields["courier_cancellation_reason"] = remarks or "Shipment cancelled"
            custom_fields["courier_cancelled_at"] = event_time.isoformat()

        elif new_status == ShipmentStatus.RETURNED:
            # RTO Logistics Event: strictly NO automatic inventory restocking
            custom_fields["rto_status"] = "received_pending_inspection"
            custom_fields["rto_received_at"] = event_time.isoformat()
            custom_fields["rto_remarks"] = remarks or "RTO parcel received from courier. Pending physical inspection."
            logger.info(
                "RTO logistics event recorded for Sale #%s (Shipment #%s). "
                "Automatic restocking omitted pending physical inspection.",
                sale.invoice_no,
                shipment.tracking_id,
            )

        sale.custom_fields = custom_fields
        sale.save()

    # B. Update ExternalOrder synchronization status if present
    if external_order:
        external_order.external_status = new_status.lower()
        if new_status == ShipmentStatus.DELIVERED:
            external_order.sync_status = ExternalOrder.SyncStatus.COMPLETED
        elif new_status == ShipmentStatus.CANCELLED:
            external_order.sync_status = ExternalOrder.SyncStatus.CANCELLED

        external_order.save(update_fields=["external_status", "sync_status", "updated_at"])
