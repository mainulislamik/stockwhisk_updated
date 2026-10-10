"""
Steadfast Courier Adapter Implementation.
Integrates with Steadfast Courier Merchant API (Bangladesh).
Website: https://steadfast.com.bd
API Documentation: https://portal.steadfast.com.bd/api/v1
"""
from datetime import datetime
from decimal import Decimal
import logging
from typing import Any, Dict, Optional, Tuple
import uuid

import requests
from django.utils import timezone

from .base import (
    BaseCourierAdapter,
    CancelResultDTO,
    CourierAuthError,
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

logger = logging.getLogger(__name__)


class SteadfastCourierAdapter(BaseCourierAdapter):
    """
    Courier adapter for Steadfast Courier (Bangladesh).
    Standard API endpoints:
    - Create order: POST /create_order
    - Tracking by CID: GET /status_by_cid/{consignment_id}
    - Tracking by Tracking Code: GET /status_by_trackingcode/{tracking_code}
    - Tracking by Invoice: GET /status_by_invoice/{invoice}
    - Balance: GET /get_balance
    """

    PRODUCTION_BASE_URL = "https://portal.packzy.com/api/v1"

    def __init__(self, account):
        super().__init__(account)
        extra = self.credentials.get("extra") or {}
        self.api_key = (
            self.credentials.get("api_key")
            or extra.get("api_key")
            or ""
        )
        self.secret_key = (
            self.credentials.get("api_secret")
            or extra.get("secret_key")
            or extra.get("api_secret")
            or ""
        )
        self.base_url = (
            self.account.metadata.get("base_url")
            or self.PRODUCTION_BASE_URL
        ).rstrip("/")

        self.is_test = bool(
            self.account.metadata.get("is_sandbox")
            or self.account.metadata.get("mock_mode")
            or "mock" in self.base_url
            or not (self.api_key and self.secret_key)
        )
        self.timeout = int(self.account.metadata.get("timeout_seconds") or 15)

    def _headers(self) -> Dict[str, str]:
        return {
            "Api-Key": self.api_key,
            "Secret-Key": self.secret_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def validate_credentials(self) -> bool:
        """Validates credentials via /get_balance endpoint."""
        if self.is_test:
            return True
        if not self.api_key or not self.secret_key:
            raise CourierAuthError("Steadfast API Key and Secret Key are required.")

        try:
            resp = requests.get(
                f"{self.base_url}/get_balance",
                headers=self._headers(),
                timeout=self.timeout,
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") == 200:
                    return True
                raise CourierAuthError(data.get("message") or "Invalid Steadfast credentials.")
            elif resp.status_code in (401, 403):
                raise CourierAuthError("Steadfast authentication failed: invalid API key or secret.")
            else:
                raise CourierServerError(f"Steadfast server returned HTTP {resp.status_code}.")
        except requests.Timeout as e:
            raise CourierTimeoutError(f"Steadfast validation timed out: {e}") from e
        except requests.RequestException as e:
            raise CourierServerError(f"Steadfast connection error: {e}") from e

    def create_shipment(self, request: ShipmentRequestDTO) -> ShipmentResponseDTO:
        """
        Creates a new consignment/order with Steadfast.
        Endpoint: POST /create_order
        """
        if not request.recipient_name or not request.recipient_phone or not request.recipient_address:
            raise CourierValidationError(
                "Recipient name, phone, and address are required for Steadfast shipment creation."
            )

        invoice_no = str(request.external_order_id or request.sale_id or f"SW-{uuid.uuid4().hex[:8].upper()}")

        payload = {
            "invoice": invoice_no,
            "recipient_name": request.recipient_name,
            "recipient_phone": request.recipient_phone,
            "recipient_address": request.recipient_address,
            "cod_amount": float(request.cod_amount),
            "note": request.special_instruction or request.item_description or "StockWhisk Order",
        }

        # Handle Mock/Sandbox fallback
        if self.is_test:
            mock_cid = int(uuid.uuid4().int % 9000000 + 1000000)
            mock_tracking = f"STDF-{mock_cid}"
            return ShipmentResponseDTO(
                tracking_id=mock_tracking,
                consignment_id=str(mock_cid),
                tracking_url=f"https://steadfast.com.bd/t/{mock_tracking}",
                status=ShipmentStatus.PENDING,
                raw_status="in_review",
                delivery_fee=Decimal("70.00"),
                cod_charge=Decimal(str(round(float(request.cod_amount) * 0.01, 2))),
                raw_response={
                    "status": 200,
                    "message": "Order created successfully (simulated)",
                    "consignment": {
                        "consignment_id": mock_cid,
                        "invoice": invoice_no,
                        "tracking_code": mock_tracking,
                        "status": "in_review",
                    },
                },
            )

        try:
            resp = requests.post(
                f"{self.base_url}/create_order",
                json=payload,
                headers=self._headers(),
                timeout=self.timeout,
            )
        except requests.Timeout as e:
            raise CourierTimeoutError(f"Steadfast order creation timed out: {e}") from e
        except requests.RequestException as e:
            raise CourierServerError(f"Steadfast connection error: {e}") from e

        if resp.status_code in (401, 403):
            raise CourierAuthError("Steadfast authentication failed on shipment creation.")
        if resp.status_code == 429:
            raise CourierRateLimitError("Steadfast rate limit exceeded.")
        if resp.status_code >= 500:
            raise CourierServerError(f"Steadfast server error: HTTP {resp.status_code}")

        data = resp.json()
        if data.get("status") != 200:
            errors = data.get("errors") or data.get("message") or "Order creation failed"
            raise CourierValidationError(f"Steadfast error: {errors}")

        consignment = data.get("consignment") or {}
        cid = str(consignment.get("consignment_id") or "")
        tracking_code = str(consignment.get("tracking_code") or cid)

        return ShipmentResponseDTO(
            tracking_id=tracking_code,
            consignment_id=cid,
            tracking_url=f"https://steadfast.com.bd/t/{tracking_code}",
            status=self.normalize_status(consignment.get("status") or ""),
            raw_status=str(consignment.get("status") or ""),
            raw_response=data,
        )

    def track_shipment(self, tracking_id: str) -> TrackingResultDTO:
        """
        Queries live tracking status.
        Uses /status_by_trackingcode/{tracking_code} or /status_by_cid/{cid}
        """
        if self.is_test:
            return TrackingResultDTO(
                tracking_id=tracking_id,
                current_status=ShipmentStatus.IN_TRANSIT,
                raw_status="in_review",
                events=[
                    TrackingEventDTO(
                        status=ShipmentStatus.IN_TRANSIT,
                        raw_status="in_review",
                        event_time=timezone.now(),
                        location="Steadfast Central Hub",
                        remarks="Parcel received at central processing hub.",
                    )
                ],
                raw_response={"status": 200, "delivery_status": "in_review"},
            )

        endpoint = (
            f"{self.base_url}/status_by_cid/{tracking_id}"
            if tracking_id.isdigit()
            else f"{self.base_url}/status_by_trackingcode/{tracking_id}"
        )

        try:
            resp = requests.get(endpoint, headers=self._headers(), timeout=self.timeout)
        except requests.Timeout as e:
            raise CourierTimeoutError(f"Steadfast tracking timed out: {e}") from e
        except requests.RequestException as e:
            raise CourierServerError(f"Steadfast connection error: {e}") from e

        if resp.status_code == 404:
            raise CourierShipmentNotFoundError(f"Shipment {tracking_id} not found at Steadfast.")
        if resp.status_code != 200:
            raise CourierServerError(f"Steadfast returned HTTP {resp.status_code}")

        data = resp.json()
        raw_status = str(data.get("delivery_status") or "")
        canonical_status = self.normalize_status(raw_status)

        events = [
            TrackingEventDTO(
                status=canonical_status,
                raw_status=raw_status,
                event_time=timezone.now(),
                location="Steadfast Logistics Hub",
                remarks=f"Status: {raw_status}",
            )
        ]

        return TrackingResultDTO(
            tracking_id=tracking_id,
            current_status=canonical_status,
            raw_status=raw_status,
            events=events,
            raw_response=data,
        )

    def cancel_shipment(self, tracking_id: str, reason: str = "") -> CancelResultDTO:
        """Steadfast orders can only be cancelled before dispatch or manually via support."""
        if self.is_test:
            return CancelResultDTO(
                tracking_id=tracking_id,
                success=True,
                status=ShipmentStatus.CANCELLED,
                cancellation_reason=reason or "Steadfast shipment cancelled (simulated).",
            )
        raise CourierUnsupportedOperationError(
            "Steadfast does not support automated API order cancellation. Please cancel via Steadfast portal or customer support."
        )

    def request_pickup(self, request: PickupRequestDTO) -> PickupResponseDTO:
        """Steadfast performs automatic scheduled pickups based on merchant account configuration."""
        return PickupResponseDTO(
            pickup_id=f"PU-STDF-{uuid.uuid4().hex[:6].upper()}",
            scheduled_time=timezone.now(),
            status="confirmed",
        )

    def get_status(self, tracking_id: str) -> Tuple[str, str]:
        """Fetch normalized and raw status."""
        res = self.track_shipment(tracking_id)
        return (res.current_status, res.raw_status)

    def normalize_status(self, raw_status: str) -> str:
        """Maps Steadfast delivery statuses to StockWhisk canonical ShipmentStatus."""
        if not raw_status:
            return ShipmentStatus.PENDING

        s = str(raw_status).strip().lower()
        if s in ("in_review", "pending"):
            return ShipmentStatus.PENDING
        elif s in ("picked_up", "hold", "in_transit"):
            return ShipmentStatus.IN_TRANSIT
        elif s in ("delivered", "partial_delivered", "delivered_approval_pending"):
            return ShipmentStatus.DELIVERED
        elif s in ("cancelled", "canceled"):
            return ShipmentStatus.CANCELLED
        elif s in ("returned", "return"):
            return ShipmentStatus.RETURNED
        return ShipmentStatus.PENDING
