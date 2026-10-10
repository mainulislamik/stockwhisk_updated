"""
Courier Integration Engine & Business Services.
Orchestrates courier adapters, database persistence, state transitions,
audit timelines, and idempotent webhook event processing.
"""
from decimal import Decimal
import logging
from typing import Dict, List, Optional, Tuple

from django.db import transaction
from django.utils import timezone

logger = logging.getLogger("integrations.couriers")

from core.tenant_context import bypass_tenant_scope
from ..models import (
    CourierAccount,
    CourierEvent,
    CourierShipment,
    CourierStatusHistory,
    IntegrationAuditLog,
)
from ..validators import validate_tenant_boundary
from ..audit import record_integration_audit
from .base import (
    BaseCourierAdapter,
    CourierDuplicateEventError,
    CourierError,
    CourierShipmentNotFoundError,
    PickupRequestDTO,
    PickupResponseDTO,
    ShipmentRequestDTO,
    ShipmentStatus,
)


def create_shipment(
    account: CourierAccount,
    request: ShipmentRequestDTO,
    sale=None,
    external_order=None,
    adapter: Optional[BaseCourierAdapter] = None,
) -> CourierShipment:
    """
    Book a shipment through the courier adapter and persist it to the database
    with tenant boundary enforcement and initial status history.
    """
    from . import get_courier_adapter

    # 0. Active courier check
    if not account.is_active:
        raise CourierError(f"Courier account '{account.name}' is inactive or disconnected.")

    # 1. Tenant boundary validation
    validate_tenant_boundary(
        shop=account.shop,
        order=sale,
        integration=account.integration,
        external_order=external_order,
        courier_account=account,
    )

    # 2. Idempotency & duplicate shipment check on retries
    if sale is not None:
        existing = (
            CourierShipment.all_objects.filter(shop=account.shop, sale=sale)
            .exclude(status=CourierShipment.ShipmentStatus.CANCELLED)
            .first()
        )
        if existing:
            logger.info(
                f"Shipment already exists for Sale #{sale.id}: {existing.tracking_id}. "
                f"Returning existing to prevent duplicate shipment on retry."
            )
            return existing

    if external_order is not None:
        existing = (
            CourierShipment.all_objects.filter(shop=account.shop, external_order=external_order)
            .exclude(status=CourierShipment.ShipmentStatus.CANCELLED)
            .first()
        )
        if existing:
            logger.info(
                f"Shipment already exists for ExternalOrder #{external_order.id}: {existing.tracking_id}. "
                f"Returning existing to prevent duplicate shipment on retry."
            )
            return existing

    idempotency_key = request.metadata.get("idempotency_key") if request.metadata else None
    if idempotency_key:
        existing = (
            CourierShipment.all_objects.filter(
                shop=account.shop,
                account=account,
                metadata__idempotency_key=idempotency_key,
            )
            .exclude(status=CourierShipment.ShipmentStatus.CANCELLED)
            .first()
        )
        if existing:
            logger.info(
                f"Shipment with idempotency key '{idempotency_key}' already exists: {existing.tracking_id}. "
                f"Returning existing to prevent duplicate shipment on retry."
            )
            return existing

    # 3. Call courier adapter
    if adapter is None:
        adapter = get_courier_adapter(account)
    res = adapter.create_shipment(request)

    # 4. Persist shipment & initial timeline in database
    with transaction.atomic():
        shipment = CourierShipment.all_objects.create(
            shop=account.shop,
            account=account,
            sale=sale,
            external_order=external_order,
            tracking_id=res.tracking_id,
            consignment_id=res.consignment_id,
            tracking_url=res.tracking_url,
            status=res.status,
            raw_status=res.raw_status,
            cod_amount=request.cod_amount,
            delivery_fee=res.delivery_fee,
            cod_charge=res.cod_charge,
            recipient_name=request.recipient_name,
            recipient_phone=request.recipient_phone,
            recipient_address=request.recipient_address,
            recipient_city=request.recipient_city,
            recipient_zone=request.recipient_zone,
            recipient_area=request.recipient_area,
            weight_kg=request.weight_kg,
            item_description=request.item_description,
            special_instruction=request.special_instruction,
            pickup_store_id=request.pickup_store_id,
            pickup_address=request.pickup_address,
            raw_payload=res.raw_response,
            metadata=request.metadata,
        )

        CourierStatusHistory.all_objects.create(
            shop=account.shop,
            shipment=shipment,
            from_status="",
            to_status=res.status,
            raw_status=res.raw_status,
            event_time=timezone.now(),
            location=request.pickup_store_id or "Origin Hub",
            remarks="Shipment booked via courier adapter",
            actor="System",
            raw_payload=res.raw_response,
        )

        record_integration_audit(
            shop=account.shop,
            action=str(IntegrationAuditLog.Action.SHIPMENT_CREATED),
            courier_account=account,
            event_type="shipment.created",
            internal_id=str(shipment.id),
            external_id=shipment.consignment_id or shipment.tracking_id,
            status="success",
            description=f"Shipment booked with {account.name}: {shipment.tracking_id}",
            details={"tracking_id": shipment.tracking_id, "consignment_id": shipment.consignment_id, "cod_amount": str(shipment.cod_amount)},
        )

    return shipment


def request_pickup(
    account: CourierAccount,
    tracking_ids: List[str],
    pickup_address: Optional[Dict] = None,
    note: str = "",
    adapter: Optional[BaseCourierAdapter] = None,
) -> PickupResponseDTO:
    """
    Request pickup for one or more consignments and update their statuses to PICKUP_REQUESTED.
    """
    from . import get_courier_adapter

    if adapter is None:
        adapter = get_courier_adapter(account)

    dto = PickupRequestDTO(
        shipment_tracking_ids=tracking_ids,
        pickup_address=pickup_address or account.default_pickup_address or {},
        note=note,
    )
    res = adapter.request_pickup(dto)

    with transaction.atomic():
        shipments = CourierShipment.all_objects.filter(
            shop=account.shop,
            account=account,
            tracking_id__in=tracking_ids,
        )
        now = timezone.now()
        for shipment in shipments:
            old_status = shipment.status
            shipment.status = ShipmentStatus.PICKUP_REQUESTED
            shipment.raw_status = "pickup_requested"
            shipment.pickup_requested_at = now
            shipment.save(update_fields=["status", "raw_status", "pickup_requested_at", "updated_at"])

            CourierStatusHistory.all_objects.create(
                shop=account.shop,
                shipment=shipment,
                from_status=old_status,
                to_status=ShipmentStatus.PICKUP_REQUESTED,
                raw_status="pickup_requested",
                event_time=now,
                location="Pickup Warehouse",
                remarks=f"Pickup scheduled: {res.pickup_id}",
                actor="System",
                raw_payload=res.raw_response,
            )

    return res


def track_and_sync_shipment(
    shipment: CourierShipment,
    adapter: Optional[BaseCourierAdapter] = None,
) -> CourierShipment:
    """
    Fetch real-time tracking from courier adapter and sync status and timeline history
    via the lifecycle transition engine.
    """
    from . import get_courier_adapter
    from .lifecycle import apply_shipment_transition

    if adapter is None:
        adapter = get_courier_adapter(shipment.account)

    tracking_res = adapter.track_shipment(shipment.tracking_id)
    now = timezone.now()

    result = apply_shipment_transition(
        shipment=shipment,
        new_status=tracking_res.current_status,
        raw_status=tracking_res.raw_status,
        event_time=now,
        remarks="Status synced from courier tracking API",
        actor="CourierSync",
        collected_amount=tracking_res.collected_amount if tracking_res.collected_amount > 0 else None,
        raw_payload=tracking_res.raw_response,
    )

    return result.shipment


def cancel_shipment(
    shipment: CourierShipment,
    reason: str = "",
    adapter: Optional[BaseCourierAdapter] = None,
) -> CourierShipment:
    """
    Cancel an active shipment with the courier and update internal records
    via the lifecycle transition engine.
    """
    from . import get_courier_adapter
    from .lifecycle import apply_shipment_transition

    if adapter is None:
        adapter = get_courier_adapter(shipment.account)

    res = adapter.cancel_shipment(shipment.tracking_id, reason=reason)
    now = timezone.now()

    result = apply_shipment_transition(
        shipment=shipment,
        new_status=res.status,
        raw_status=res.raw_status,
        event_time=now,
        remarks=f"Cancellation processed: {reason}",
        actor="System",
        raw_payload=res.raw_response,
    )

    record_integration_audit(
        shop=shipment.shop,
        action=str(IntegrationAuditLog.Action.SHIPMENT_CANCELLED),
        courier_account=shipment.account,
        event_type="shipment.cancelled",
        internal_id=str(shipment.id),
        external_id=shipment.consignment_id or shipment.tracking_id,
        status="success",
        description=f"Shipment {shipment.tracking_id} cancelled: {reason}",
        details={"tracking_id": shipment.tracking_id, "reason": reason},
    )

    return result.shipment


def handle_inbound_courier_event(
    account: CourierAccount,
    event_id: str,
    event_type: str,
    payload: Dict,
    adapter: Optional[BaseCourierAdapter] = None,
) -> Tuple[CourierEvent, bool]:
    """
    Idempotently process an incoming courier webhook or status callback.
    Returns (courier_event, created) where created=False indicates a duplicate.
    """
    from . import get_courier_adapter
    from .lifecycle import apply_shipment_transition

    if not event_id:
        raise CourierError("Inbound courier event missing event_id.")

    # 1. Idempotency Check: deduplicate by (shop, account, event_id)
    existing = CourierEvent.all_objects.filter(
        shop=account.shop,
        account=account,
        event_id=event_id,
    ).first()
    if existing:
        return existing, False

    if adapter is None:
        adapter = get_courier_adapter(account)

    # 2. Extract parcel tracking identifiers
    tracking_id = (
        payload.get("tracking_id")
        or payload.get("consignment_id")
        or payload.get("tracking_code")
        or payload.get("invoice")
        or ""
    )

    shipment = None
    if tracking_id:
        shipment = CourierShipment.all_objects.filter(
            shop=account.shop,
            account=account,
            tracking_id=tracking_id,
        ).first()
        if not shipment:
            shipment = CourierShipment.all_objects.filter(
                shop=account.shop,
                account=account,
                consignment_id=tracking_id,
            ).first()

    raw_status = payload.get("status") or payload.get("event") or ""
    now = timezone.now()

    # 3. Update shipment via lifecycle engine if found
    if shipment and raw_status:
        normalized = adapter.normalize_status(raw_status)
        collected_val = payload.get("collected_amount") or payload.get("cod_amount")
        collected_amount = None
        if collected_val is not None:
            try:
                collected_amount = Decimal(str(collected_val))
            except Exception:
                pass

        apply_shipment_transition(
            shipment=shipment,
            new_status=normalized,
            raw_status=raw_status,
            event_time=now,
            location=payload.get("hub") or payload.get("location") or "",
            remarks=payload.get("remarks") or f"Webhook update: {event_type}",
            actor="Webhook",
            collected_amount=collected_amount,
            raw_payload=payload,
        )

    # 4. Record event
    event = CourierEvent.all_objects.create(
        shop=account.shop,
        account=account,
        shipment=shipment,
        event_id=event_id,
        event_type=event_type,
        status="processed",
        processed_at=now,
        payload=payload,
    )

    return event, True
