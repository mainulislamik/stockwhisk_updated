"""
Reference & Mock Courier Adapter Implementation.
Demonstrates the full BaseCourierAdapter contract, status normalization,
error handling, and configurable operation support.
"""
from datetime import datetime
from decimal import Decimal
from typing import Dict, Optional, Tuple
import uuid

from django.utils import timezone

from .base import (
    BaseCourierAdapter,
    CancelResultDTO,
    CourierAuthError,
    CourierShipmentNotFoundError,
    CourierUnsupportedOperationError,
    CourierValidationError,
    PickupRequestDTO,
    PickupResponseDTO,
    ShipmentRequestDTO,
    ShipmentResponseDTO,
    ShipmentStatus,
    TrackingEventDTO,
    TrackingResultDTO,
)


class MockCourierAdapter(BaseCourierAdapter):
    """
    In-memory mock courier adapter for testing and architecture verification.
    """

    # Provider-specific raw status to normalized ShipmentStatus mapping
    STATUS_MAP: Dict[str, str] = {
        "order_placed": ShipmentStatus.PENDING,
        "pending": ShipmentStatus.PENDING,
        "created": ShipmentStatus.PENDING,
        "ready": ShipmentStatus.READY_TO_SHIP,
        "ready_for_pickup": ShipmentStatus.READY_TO_SHIP,
        "ready_to_ship": ShipmentStatus.READY_TO_SHIP,
        "pickup_requested": ShipmentStatus.PICKUP_REQUESTED,
        "call_driver": ShipmentStatus.PICKUP_REQUESTED,
        "picked_up": ShipmentStatus.PICKED_UP,
        "collected": ShipmentStatus.PICKED_UP,
        "received_at_hub": ShipmentStatus.PICKED_UP,
        "in_transit": ShipmentStatus.IN_TRANSIT,
        "dispatched": ShipmentStatus.IN_TRANSIT,
        "hub_transfer": ShipmentStatus.IN_TRANSIT,
        "out_for_delivery": ShipmentStatus.OUT_FOR_DELIVERY,
        "on_the_way": ShipmentStatus.OUT_FOR_DELIVERY,
        "rider_assigned": ShipmentStatus.OUT_FOR_DELIVERY,
        "delivered": ShipmentStatus.DELIVERED,
        "successful": ShipmentStatus.DELIVERED,
        "paid": ShipmentStatus.DELIVERED,
        "delivery_failed": ShipmentStatus.DELIVERY_FAILED,
        "failed": ShipmentStatus.DELIVERY_FAILED,
        "customer_refused": ShipmentStatus.DELIVERY_FAILED,
        "not_reached": ShipmentStatus.DELIVERY_FAILED,
        "cancelled": ShipmentStatus.CANCELLED,
        "void": ShipmentStatus.CANCELLED,
        "returned": ShipmentStatus.RETURNED,
        "return_completed": ShipmentStatus.RETURNED,
        "rto": ShipmentStatus.RETURNED,
    }

    def __init__(self, account, supports_cancellation: bool = True, supports_pickup_request: bool = True):
        super().__init__(account)
        self.supports_cancellation = supports_cancellation
        self.supports_pickup_request = supports_pickup_request
        # Local mock state storage for tracked shipments in memory during test session
        self._simulated_shipments: Dict[str, dict] = {}

    def normalize_status(self, raw_status: str) -> str:
        """Normalize raw provider status strings into normalized ShipmentStatus."""
        if not raw_status:
            return ShipmentStatus.PENDING
        clean_raw = str(raw_status).strip().lower()
        return self.STATUS_MAP.get(clean_raw, ShipmentStatus.PENDING)

    def validate_credentials(self) -> bool:
        """Verify presence and validity of credentials."""
        api_key = self.credentials.get("api_key", "")
        if not api_key or api_key == "INVALID" or api_key.startswith("invalid_"):
            raise CourierAuthError("Invalid or missing courier API credentials.")
        return True

    def create_shipment(self, request: ShipmentRequestDTO) -> ShipmentResponseDTO:
        """Book a simulated consignment with validation."""
        self.validate_credentials()

        # Validate mandatory customer fields
        if not request.recipient_phone:
            raise CourierValidationError("Recipient phone number is required.")
        if not request.recipient_address:
            raise CourierValidationError("Recipient delivery address is required.")
        if not request.recipient_name:
            raise CourierValidationError("Recipient name is required.")
        if request.weight_kg <= Decimal("0.00"):
            raise CourierValidationError("Parcel weight must be greater than 0.")

        tracking_id = f"MOCK-TRK-{uuid.uuid4().hex[:8].upper()}"
        consignment_id = f"CN-{uuid.uuid4().hex[:6].upper()}"
        raw_status = "created"
        normalized = self.normalize_status(raw_status)

        delivery_fee = Decimal("60.00")
        cod_charge = Decimal("10.00") if request.cod_amount > 0 else Decimal("0.00")

        self._simulated_shipments[tracking_id] = {
            "tracking_id": tracking_id,
            "consignment_id": consignment_id,
            "raw_status": raw_status,
            "normalized_status": normalized,
            "cod_amount": request.cod_amount,
            "request": request,
            "history": [
                {
                    "raw_status": raw_status,
                    "normalized_status": normalized,
                    "time": timezone.now(),
                    "location": "Merchant Warehouse",
                    "remarks": "Consignment created",
                }
            ],
        }

        return ShipmentResponseDTO(
            tracking_id=tracking_id,
            consignment_id=consignment_id,
            tracking_url=f"https://track.mockcourier.local/{tracking_id}",
            status=normalized,
            raw_status=raw_status,
            delivery_fee=delivery_fee,
            cod_charge=cod_charge,
            raw_response={"mock_order_id": consignment_id, "status": raw_status},
        )

    def request_pickup(self, request: PickupRequestDTO) -> PickupResponseDTO:
        """Simulate physical parcel pickup request."""
        if not self.supports_pickup_request:
            raise CourierUnsupportedOperationError(
                "Pickup request is not supported by this courier provider."
            )
        self.validate_credentials()

        if not request.shipment_tracking_ids:
            raise CourierValidationError("At least one shipment tracking ID is required for pickup.")

        for tid in request.shipment_tracking_ids:
            if tid in self._simulated_shipments:
                self._simulated_shipments[tid]["raw_status"] = "pickup_requested"
                self._simulated_shipments[tid]["normalized_status"] = ShipmentStatus.PICKUP_REQUESTED
                self._simulated_shipments[tid]["history"].append(
                    {
                        "raw_status": "pickup_requested",
                        "normalized_status": ShipmentStatus.PICKUP_REQUESTED,
                        "time": timezone.now(),
                        "location": "Pickup Point",
                        "remarks": "Pickup driver scheduled",
                    }
                )

        pickup_id = f"PK-{uuid.uuid4().hex[:6].upper()}"
        return PickupResponseDTO(
            pickup_id=pickup_id,
            status="requested",
            scheduled_time=timezone.now(),
            raw_response={"pickup_id": pickup_id, "count": len(request.shipment_tracking_ids)},
        )

    def track_shipment(self, tracking_id: str) -> TrackingResultDTO:
        """Query tracking status and timeline history."""
        self.validate_credentials()

        sim = self._simulated_shipments.get(tracking_id)
        if not sim:
            # Generate deterministic fallback for ad-hoc tracking queries
            return TrackingResultDTO(
                tracking_id=tracking_id,
                current_status=ShipmentStatus.IN_TRANSIT,
                raw_status="in_transit",
                events=[
                    TrackingEventDTO(
                        status=ShipmentStatus.PENDING,
                        raw_status="created",
                        event_time=timezone.now(),
                        location="Merchant Hub",
                        remarks="Shipment generated",
                    ),
                    TrackingEventDTO(
                        status=ShipmentStatus.IN_TRANSIT,
                        raw_status="in_transit",
                        event_time=timezone.now(),
                        location="Central Sorting Hub",
                        remarks="In transit to destination hub",
                    ),
                ],
                raw_response={"tracking_id": tracking_id, "status": "in_transit"},
            )

        events = [
            TrackingEventDTO(
                status=h["normalized_status"],
                raw_status=h["raw_status"],
                event_time=h["time"],
                location=h.get("location", ""),
                remarks=h.get("remarks", ""),
            )
            for h in sim.get("history", [])
        ]

        return TrackingResultDTO(
            tracking_id=tracking_id,
            current_status=sim["normalized_status"],
            raw_status=sim["raw_status"],
            events=events,
            raw_response=sim,
        )

    def get_status(self, tracking_id: str) -> Tuple[str, str]:
        """Fetch current status tuple (normalized_status, raw_status)."""
        self.validate_credentials()
        sim = self._simulated_shipments.get(tracking_id)
        if sim:
            return sim["normalized_status"], sim["raw_status"]
        return ShipmentStatus.IN_TRANSIT, "in_transit"

    def cancel_shipment(self, tracking_id: str, reason: str = "") -> CancelResultDTO:
        """Simulate shipment cancellation with feature-flag guard."""
        if not self.supports_cancellation:
            raise CourierUnsupportedOperationError(
                "Cancellation is not supported by this courier provider."
            )
        self.validate_credentials()

        if tracking_id in self._simulated_shipments:
            self._simulated_shipments[tracking_id]["raw_status"] = "cancelled"
            self._simulated_shipments[tracking_id]["normalized_status"] = ShipmentStatus.CANCELLED
            self._simulated_shipments[tracking_id]["history"].append(
                {
                    "raw_status": "cancelled",
                    "normalized_status": ShipmentStatus.CANCELLED,
                    "time": timezone.now(),
                    "location": "System",
                    "remarks": f"Shipment cancelled: {reason}",
                }
            )

        return CancelResultDTO(
            tracking_id=tracking_id,
            success=True,
            status=ShipmentStatus.CANCELLED,
            raw_status="cancelled",
            cancellation_reason=reason or "Merchant request",
            raw_response={"tracking_id": tracking_id, "cancelled": True},
        )
