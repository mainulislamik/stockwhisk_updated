"""
Provider-Independent Courier Integration Architecture.
Defines abstract contracts, standardized DTOs, normalized shipment states, and error hierarchy.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple


class ShipmentStatus:
    """
    Standardized normalized shipment states across all external courier providers.
    """
    PENDING = "pending"
    READY_TO_SHIP = "ready_to_ship"
    PICKUP_REQUESTED = "pickup_requested"
    PICKED_UP = "picked_up"
    IN_TRANSIT = "in_transit"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    DELIVERY_FAILED = "delivery_failed"
    CANCELLED = "cancelled"
    RETURNED = "returned"

    ALL = {
        PENDING,
        READY_TO_SHIP,
        PICKUP_REQUESTED,
        PICKED_UP,
        IN_TRANSIT,
        OUT_FOR_DELIVERY,
        DELIVERED,
        DELIVERY_FAILED,
        CANCELLED,
        RETURNED,
    }


# ==============================================================================
# Error Hierarchy
# ==============================================================================

class CourierError(Exception):
    """Base exception for all courier-related failures."""
    def __init__(self, message: str, raw_response: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.raw_response = raw_response or {}


class CourierAuthError(CourierError):
    """Authentication or authorization failure (e.g. invalid API key, expired token)."""
    pass


class CourierValidationError(CourierError):
    """Invalid input payload (e.g. invalid phone, missing address, negative weight)."""
    pass


class CourierUnsupportedOperationError(CourierError):
    """Raised when an operation is not supported by the underlying courier provider."""
    pass


class CourierShipmentNotFoundError(CourierError):
    """Raised when the specified tracking ID or consignment is not found at the courier."""
    pass


class CourierRateLimitError(CourierError):
    """HTTP 429 Too Many Requests from the courier provider."""
    pass


class CourierTimeoutError(CourierError):
    """Network connection timeout communicating with the courier API."""
    pass


class CourierServerError(CourierError):
    """HTTP 5xx server-side error at the courier provider."""
    pass


class CourierDuplicateEventError(CourierError):
    """Raised when an incoming webhook or callback event ID was already processed."""
    pass


# ==============================================================================
# Data Transfer Objects (DTOs)
# ==============================================================================

@dataclass
class ShipmentRequestDTO:
    """Standardized input payload for booking a new shipment."""
    recipient_name: str
    recipient_phone: str
    recipient_address: str
    recipient_city: str = ""
    recipient_zone: str = ""
    recipient_area: str = ""
    cod_amount: Decimal = Decimal("0.00")
    weight_kg: Decimal = Decimal("0.50")
    item_description: str = ""
    special_instruction: str = ""
    pickup_store_id: str = ""
    pickup_address: Dict[str, Any] = field(default_factory=dict)
    sale_id: Optional[int] = None
    external_order_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ShipmentResponseDTO:
    """Standardized response from the courier after creating a shipment."""
    tracking_id: str
    consignment_id: str = ""
    tracking_url: str = ""
    status: str = ShipmentStatus.PENDING
    raw_status: str = ""
    delivery_fee: Decimal = Decimal("0.00")
    cod_charge: Decimal = Decimal("0.00")
    raw_response: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PickupRequestDTO:
    """Standardized input payload for requesting physical parcel pickup."""
    shipment_tracking_ids: List[str]
    pickup_address: Dict[str, Any] = field(default_factory=dict)
    pickup_time: Optional[datetime] = None
    note: str = ""


@dataclass
class PickupResponseDTO:
    """Standardized response from the courier after requesting parcel pickup."""
    pickup_id: str
    status: str = "requested"
    scheduled_time: Optional[datetime] = None
    raw_response: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TrackingEventDTO:
    """Individual checkpoint or milestone in a parcel's transit history."""
    status: str
    raw_status: str
    event_time: datetime
    location: str = ""
    remarks: str = ""
    actor: str = ""


@dataclass
class TrackingResultDTO:
    """Comprehensive tracking information with chronological timeline."""
    tracking_id: str
    current_status: str
    raw_status: str
    events: List[TrackingEventDTO] = field(default_factory=list)
    delivered_at: Optional[datetime] = None
    collected_amount: Decimal = Decimal("0.00")
    raw_response: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CancelResultDTO:
    """Standardized response after attempting to cancel a shipment."""
    tracking_id: str
    success: bool
    status: str = ShipmentStatus.CANCELLED
    raw_status: str = ""
    cancellation_reason: str = ""
    raw_response: Dict[str, Any] = field(default_factory=dict)


# ==============================================================================
# Abstract Base Adapter
# ==============================================================================

class BaseCourierAdapter(ABC):
    """
    Abstract contract for all courier provider adapters.
    Provider-specific logic (Pathao, Steadfast, RedX, etc.) is fully encapsulated
    behind this interface.
    """

    supports_cancellation: bool = True
    supports_pickup_request: bool = True

    def __init__(self, account):
        """
        Initialize the adapter with a tenant's CourierAccount instance.
        Validates tenant isolation and retrieves credentials.
        """
        self.account = account
        self.shop = account.shop
        self.credentials = self._load_credentials()

    def _load_credentials(self) -> Dict[str, Any]:
        """Load and decrypt credentials from the associated CourierCredential."""
        if hasattr(self.account, "credential") and self.account.credential:
            return self.account.credential.get_credentials()
        return {}

    @abstractmethod
    def validate_credentials(self) -> bool:
        """
        Test and verify whether the configured credentials are valid with the provider.
        Raises CourierAuthError or returns False on failure.
        """
        pass

    @abstractmethod
    def create_shipment(self, request: ShipmentRequestDTO) -> ShipmentResponseDTO:
        """
        Book a new consignment with the courier.
        Returns a ShipmentResponseDTO containing tracking_id and initial status.
        """
        pass

    @abstractmethod
    def request_pickup(self, request: PickupRequestDTO) -> PickupResponseDTO:
        """
        Request physical courier rider pickup for one or more consignments.
        """
        pass

    @abstractmethod
    def track_shipment(self, tracking_id: str) -> TrackingResultDTO:
        """
        Query real-time tracking information and milestone history.
        """
        pass

    @abstractmethod
    def get_status(self, tracking_id: str) -> Tuple[str, str]:
        """
        Fetch the current status of a shipment.
        Returns a tuple: (normalized_status, raw_status).
        """
        pass

    @abstractmethod
    def cancel_shipment(self, tracking_id: str, reason: str = "") -> CancelResultDTO:
        """
        Cancel a previously booked shipment with the courier before pickup.
        """
        pass

    @abstractmethod
    def normalize_status(self, raw_status: str) -> str:
        """
        Map external provider-specific status strings into one of the standardized
        ShipmentStatus enum choices.
        """
        pass
