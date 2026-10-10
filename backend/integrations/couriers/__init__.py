"""
Courier Integration Package.
Provider-independent abstraction layer, adapter registry, and lifecycle engine.
"""
from typing import Dict, Type

from .base import (
    BaseCourierAdapter,
    CancelResultDTO,
    CourierAuthError,
    CourierDuplicateEventError,
    CourierError,
    CourierRateLimitError,
    CourierServerError,
    CourierShipmentNotFoundError,
    CourierTimeoutError,
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
from .engine import (
    cancel_shipment,
    create_shipment,
    handle_inbound_courier_event,
    request_pickup,
    track_and_sync_shipment,
)
from .lifecycle import (
    apply_shipment_transition,
    is_out_of_order_transition,
    STATE_PRECEDENCE,
    TERMINAL_STATES,
    TransitionResult,
)
from .mock_adapter import MockCourierAdapter
from .pathao import PathaoCourierAdapter
from .steadfast import SteadfastCourierAdapter
from .redx import RedXCourierAdapter

# Adapter Registry mapping CourierProvider value -> BaseCourierAdapter subclass
COURIER_ADAPTER_REGISTRY: Dict[str, Type[BaseCourierAdapter]] = {
    "mock": MockCourierAdapter,
    "custom": MockCourierAdapter,
    "pathao": PathaoCourierAdapter,
    "steadfast": SteadfastCourierAdapter,
    "redx": RedXCourierAdapter,
    "paperfly": MockCourierAdapter,
}


def register_courier_adapter(provider: str, adapter_cls: Type[BaseCourierAdapter]):
    """Register an adapter class for a courier provider."""
    COURIER_ADAPTER_REGISTRY[provider.lower()] = adapter_cls


def get_courier_adapter(account) -> BaseCourierAdapter:
    """
    Factory function: retrieve and instantiate the appropriate courier adapter
    for a given CourierAccount instance.
    """
    provider = getattr(account, "provider", "custom").lower()
    adapter_cls = COURIER_ADAPTER_REGISTRY.get(provider)
    if not adapter_cls:
        raise CourierUnsupportedOperationError(
            f"No courier adapter registered for provider '{provider}'."
        )
    return adapter_cls(account)


__all__ = [
    "BaseCourierAdapter",
    "ShipmentStatus",
    "ShipmentRequestDTO",
    "ShipmentResponseDTO",
    "PickupRequestDTO",
    "PickupResponseDTO",
    "TrackingEventDTO",
    "TrackingResultDTO",
    "CancelResultDTO",
    "CourierError",
    "CourierAuthError",
    "CourierValidationError",
    "CourierUnsupportedOperationError",
    "CourierShipmentNotFoundError",
    "CourierRateLimitError",
    "CourierTimeoutError",
    "CourierServerError",
    "CourierDuplicateEventError",
    "MockCourierAdapter",
    "PathaoCourierAdapter",
    "COURIER_ADAPTER_REGISTRY",
    "register_courier_adapter",
    "get_courier_adapter",
    "create_shipment",
    "request_pickup",
    "track_and_sync_shipment",
    "cancel_shipment",
    "handle_inbound_courier_event",
    "apply_shipment_transition",
    "is_out_of_order_transition",
    "TransitionResult",
]
