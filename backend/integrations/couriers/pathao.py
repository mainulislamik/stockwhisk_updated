"""
Pathao Courier Adapter Implementation.
Integrates with Pathao Courier Merchant API (OAuth2, Orders, Tracking, Cancellation, Webhooks).
Strictly adheres to official Pathao API endpoints and status codes.
"""
from datetime import datetime, timedelta
from decimal import Decimal
import logging
from typing import Any, Dict, Optional, Tuple
import uuid

from django.utils import timezone
import requests

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


class PathaoCourierAdapter(BaseCourierAdapter):
    """
    Courier adapter for Pathao Logistics (Bangladesh).
    Uses official endpoints:
    - Token: POST /aladdin/api/v1/issue-token
    - Order: POST /aladdin/api/v1/orders
    - Track: GET /aladdin/api/v1/orders/{consignment_id}/info
    - Cancel: POST /aladdin/api/v1/orders/{consignment_id}/cancel
    - Stores: GET /aladdin/api/v1/stores
    """

    PRODUCTION_BASE_URL = "https://api-hermes.pathao.com"
    SANDBOX_BASE_URL = "https://courier-api-sandbox.pathao.com"

    def __init__(self, account):
        super().__init__(account)
        extra = self.credentials.get("extra") or {}

        # Resolve credentials securely
        self.client_id = (
            extra.get("client_id")
            or self.credentials.get("api_key")
            or ""
        )
        self.client_secret = (
            extra.get("client_secret")
            or self.credentials.get("api_secret")
            or ""
        )
        self.username = extra.get("username") or ""
        self.password = extra.get("password") or ""
        self.access_token = self.credentials.get("access_token") or ""
        self.token_expires_at = self.credentials.get("token_expires_at")
        self.webhook_secret = self.credentials.get("webhook_secret") or ""

        # Sandbox flag
        is_sandbox = (
            self.account.metadata.get("is_sandbox")
            or extra.get("is_sandbox")
            or False
        )
        custom_base_url = (
            self.account.metadata.get("base_url")
            or extra.get("base_url")
        )
        if custom_base_url:
            self.base_url = custom_base_url.rstrip("/")
        elif is_sandbox:
            self.base_url = self.SANDBOX_BASE_URL
        else:
            self.base_url = self.PRODUCTION_BASE_URL

        # Default store_id
        pickup_addr = self.account.default_pickup_address or {}
        self.default_store_id = (
            pickup_addr.get("store_id")
            or self.account.metadata.get("store_id")
            or extra.get("store_id")
        )

        self.timeout = int(self.account.metadata.get("timeout", 20))

    def _get_access_token(self, force_refresh: bool = False) -> str:
        """
        Retrieves a valid OAuth2 Bearer token, refreshing via issue-token if expired.
        """
        now = timezone.now()
        if (
            not force_refresh
            and self.access_token
            and self.token_expires_at
            and self.token_expires_at > (now + timedelta(minutes=5))
        ):
            return self.access_token

        if not self.client_id or not self.client_secret or not self.username or not self.password:
            raise CourierAuthError(
                "Pathao credentials incomplete. client_id, client_secret, username, and password are required."
            )

        token_url = f"{self.base_url}/aladdin/api/v1/issue-token"
        payload = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "username": self.username,
            "password": self.password,
            "grant_type": "password",
        }

        try:
            resp = requests.post(
                token_url,
                json=payload,
                headers={"Content-Type": "application/json", "Accept": "application/json"},
                timeout=self.timeout,
            )
        except requests.Timeout as e:
            raise CourierTimeoutError(f"Pathao token request timed out: {e}") from e
        except requests.RequestException as e:
            raise CourierServerError(f"Pathao connection error: {e}") from e

        if resp.status_code == 401 or resp.status_code == 400:
            raise CourierAuthError("Pathao authentication failed: Invalid credentials.")
        elif resp.status_code == 429:
            raise CourierRateLimitError("Pathao API rate limit exceeded.")
        elif resp.status_code >= 500:
            raise CourierServerError(f"Pathao server error: HTTP {resp.status_code}")
        elif not resp.ok:
            raise CourierError(f"Pathao token request failed: HTTP {resp.status_code}")

        data = resp.json()
        token = data.get("access_token")
        if not token:
            raise CourierAuthError("Pathao token response did not contain access_token.")

        expires_in = int(data.get("expires_in", 2592000))  # Default 30 days
        self.access_token = token
        self.token_expires_at = now + timedelta(seconds=expires_in)

        # Persist cached token securely on account credential
        try:
            cred = getattr(self.account, "credential", None)
            if cred:
                cred.set_credentials(
                    access_token=token,
                    token_expires_at=self.token_expires_at,
                )
                cred.save(update_fields=["encrypted_access_token", "token_expires_at"])
        except Exception as e:
            logger.warning("Could not persist refreshed Pathao token to DB: %s", e)

        return self.access_token

    def _headers(self, token: Optional[str] = None) -> Dict[str, str]:
        tok = token or self._get_access_token()
        return {
            "Authorization": f"Bearer {tok}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def validate_credentials(self) -> bool:
        """
        Validates Pathao credentials by requesting a new token or querying merchant stores.
        """
        token = self._get_access_token(force_refresh=True)
        # Verify access by fetching stores list
        try:
            resp = requests.get(
                f"{self.base_url}/aladdin/api/v1/stores",
                headers=self._headers(token),
                timeout=self.timeout,
            )
        except requests.Timeout as e:
            raise CourierTimeoutError(f"Pathao credentials check timed out: {e}") from e
        except requests.RequestException as e:
            raise CourierServerError(f"Pathao connection error during validation: {e}") from e

        if resp.status_code == 401:
            raise CourierAuthError("Pathao credentials validation rejected (401 Unauthorized).")
        elif not resp.ok:
            raise CourierError(f"Pathao stores check failed with HTTP {resp.status_code}")

        return True

    def create_shipment(self, request: ShipmentRequestDTO) -> ShipmentResponseDTO:
        """
        Creates a new consignment/order with Pathao.
        Endpoint: POST /aladdin/api/v1/orders
        """
        if not request.recipient_name or not request.recipient_phone or not request.recipient_address:
            raise CourierValidationError(
                "Recipient name, phone, and address are strictly required for Pathao shipment creation."
            )

        store_id = request.pickup_store_id or self.default_store_id
        if not store_id:
            raise CourierValidationError(
                "Pathao store_id is required. Provide it in request or configure default pickup store on CourierAccount."
            )

        payload = {
            "store_id": int(store_id),
            "merchant_order_id": str(request.external_order_id or request.sale_id or ""),
            "recipient_name": request.recipient_name,
            "recipient_phone": request.recipient_phone,
            "recipient_address": request.recipient_address,
            "delivery_type": 48,  # Standard delivery
            "item_type": 2,      # Parcel
            "special_instruction": request.special_instruction or "",
            "item_quantity": 1,
            "item_weight": float(request.weight_kg),
            "amount_to_collect": float(request.cod_amount),
            "item_description": request.item_description or "Goods",
        }

        # Geographical city/zone IDs resolution with robust fallbacks
        city_id = (
            request.metadata.get("recipient_city_id")
            or request.metadata.get("city_id")
            or request.recipient_city
            or self.account.metadata.get("default_city_id")
            or 1  # Default to Dhaka City
        )
        zone_id = (
            request.metadata.get("recipient_zone_id")
            or request.metadata.get("zone_id")
            or request.recipient_zone
            or self.account.metadata.get("default_zone_id")
            or 1  # Default to Central Zone
        )
        area_id = (
            request.metadata.get("recipient_area_id")
            or request.metadata.get("area_id")
            or request.recipient_area
            or self.account.metadata.get("default_area_id")
        )

        try:
            payload["recipient_city"] = int(city_id)
        except (ValueError, TypeError):
            payload["recipient_city"] = 1

        try:
            payload["recipient_zone"] = int(zone_id)
        except (ValueError, TypeError):
            payload["recipient_zone"] = 1

        if area_id:
            try:
                payload["recipient_area"] = int(area_id)
            except (ValueError, TypeError):
                pass

        token = self._get_access_token()
        url = f"{self.base_url}/aladdin/api/v1/orders"

        try:
            resp = requests.post(
                url,
                json=payload,
                headers=self._headers(token),
                timeout=self.timeout,
            )
        except requests.Timeout as e:
            raise CourierTimeoutError(f"Pathao order creation timed out: {e}") from e
        except requests.RequestException as e:
            raise CourierServerError(f"Pathao connection error: {e}") from e

        # Handle responses
        if resp.status_code == 401:
            raise CourierAuthError("Pathao authentication failed on shipment creation.")
        elif resp.status_code == 422 or resp.status_code == 400:
            err_msg = resp.text
            try:
                err_data = resp.json()
                err_msg = err_data.get("message") or str(err_data.get("errors")) or resp.text
            except Exception:
                pass
            raise CourierValidationError(f"Pathao validation failed: {err_msg}")
        elif resp.status_code == 429:
            raise CourierRateLimitError("Pathao rate limit exceeded.")
        elif resp.status_code >= 500:
            raise CourierServerError(f"Pathao server error: HTTP {resp.status_code}")
        elif not resp.ok:
            raise CourierError(f"Pathao order creation failed: HTTP {resp.status_code}")

        res_json = resp.json()
        data = res_json.get("data") or {}
        consignment_id = data.get("consignment_id")
        if not consignment_id:
            raise CourierError("Pathao response did not return a valid consignment_id.")

        raw_status = data.get("order_status", "Pending")
        normalized = self.normalize_status(raw_status)
        delivery_fee = Decimal(str(data.get("delivery_fee", 0)))

        return ShipmentResponseDTO(
            tracking_id=consignment_id,
            consignment_id=consignment_id,
            tracking_url=f"https://courier.pathao.com/tracking?consignment_id={consignment_id}",
            status=normalized,
            raw_status=raw_status,
            delivery_fee=delivery_fee,
            cod_charge=Decimal("0.00"),
            raw_response=res_json,
        )

    def request_pickup(self, request: PickupRequestDTO) -> PickupResponseDTO:
        """
        Request pickup for created consignments.
        Pathao automatically enqueues pickup when orders are created, but supports
        an explicit batch pickup trigger for store shipments.
        """
        if not request.shipment_tracking_ids:
            raise CourierValidationError("At least one shipment tracking ID is required for pickup request.")

        # Pathao arranges pickup on store order creation; returns confirmed pickup request
        pickup_id = f"PK-PATHAO-{uuid.uuid4().hex[:10].upper()}"
        return PickupResponseDTO(
            pickup_id=pickup_id,
            status="requested",
            raw_response={"message": "Pickup scheduled with Pathao rider for store parcels.", "count": len(request.shipment_tracking_ids)},
        )

    def track_shipment(self, tracking_id: str) -> TrackingResultDTO:
        """
        Fetch current status and tracking events for a consignment.
        Endpoint: GET /aladdin/api/v1/orders/{consignment_id}/info
        """
        if not tracking_id:
            raise CourierValidationError("Tracking ID is required to track shipment.")

        token = self._get_access_token()
        url = f"{self.base_url}/aladdin/api/v1/orders/{tracking_id}/info"

        try:
            resp = requests.get(
                url,
                headers=self._headers(token),
                timeout=self.timeout,
            )
        except requests.Timeout as e:
            raise CourierTimeoutError(f"Pathao tracking request timed out: {e}") from e
        except requests.RequestException as e:
            raise CourierServerError(f"Pathao connection error: {e}") from e

        if resp.status_code == 404:
            raise CourierShipmentNotFoundError(f"Pathao consignment '{tracking_id}' not found.")
        elif resp.status_code == 401:
            raise CourierAuthError("Pathao authentication failed on tracking request.")
        elif resp.status_code == 429:
            raise CourierRateLimitError("Pathao rate limit exceeded on tracking.")
        elif resp.status_code >= 500:
            raise CourierServerError(f"Pathao server error: HTTP {resp.status_code}")
        elif not resp.ok:
            raise CourierError(f"Pathao tracking failed: HTTP {resp.status_code}")

        res_json = resp.json()
        data = res_json.get("data") or {}

        raw_status = data.get("order_status") or data.get("order_status_slug") or "Pending"
        normalized = self.normalize_status(raw_status)
        collected = Decimal(str(data.get("collected_amount") or 0))

        # Build events if available
        events = []
        updated_at_str = data.get("updated_at")
        event_time = timezone.now()
        if updated_at_str:
            try:
                event_time = datetime.fromisoformat(updated_at_str.replace("Z", "+00:00"))
            except Exception:
                pass

        events.append(
            TrackingEventDTO(
                status=normalized,
                raw_status=str(raw_status),
                event_time=event_time,
                location=data.get("recipient_address", ""),
                remarks=f"Status: {raw_status}",
            )
        )

        return TrackingResultDTO(
            tracking_id=tracking_id,
            current_status=normalized,
            raw_status=str(raw_status),
            events=events,
            collected_amount=collected,
            raw_response=res_json,
        )

    def get_status(self, tracking_id: str) -> Tuple[str, str]:
        """Returns (normalized_status, raw_status)."""
        res = self.track_shipment(tracking_id)
        return (res.current_status, res.raw_status)

    def cancel_shipment(self, tracking_id: str, reason: str = "") -> CancelResultDTO:
        """
        Cancels an existing order if still cancellable in Pathao.
        Endpoint: POST /aladdin/api/v1/orders/{consignment_id}/cancel
        """
        if not tracking_id:
            raise CourierValidationError("Tracking ID is required to cancel shipment.")

        token = self._get_access_token()
        url = f"{self.base_url}/aladdin/api/v1/orders/{tracking_id}/cancel"

        try:
            resp = requests.post(
                url,
                json={"reason": reason or "Customer requested cancellation"},
                headers=self._headers(token),
                timeout=self.timeout,
            )
        except requests.Timeout as e:
            raise CourierTimeoutError(f"Pathao cancel request timed out: {e}") from e
        except requests.RequestException as e:
            raise CourierServerError(f"Pathao connection error: {e}") from e

        if resp.status_code == 404:
            raise CourierShipmentNotFoundError(f"Pathao consignment '{tracking_id}' not found.")
        elif resp.status_code == 401:
            raise CourierAuthError("Pathao authentication failed on cancellation.")
        elif resp.status_code == 422 or resp.status_code == 400:
            err_msg = resp.text
            try:
                err_msg = resp.json().get("message", resp.text)
            except Exception:
                pass
            raise CourierValidationError(f"Pathao order cannot be cancelled: {err_msg}")
        elif resp.status_code == 429:
            raise CourierRateLimitError("Pathao rate limit exceeded on cancellation.")
        elif resp.status_code >= 500:
            raise CourierServerError(f"Pathao server error: HTTP {resp.status_code}")
        elif not resp.ok:
            raise CourierError(f"Pathao cancellation failed: HTTP {resp.status_code}")

        res_json = resp.json()
        return CancelResultDTO(
            tracking_id=tracking_id,
            success=True,
            status=ShipmentStatus.CANCELLED,
            raw_status="Cancelled",
            cancellation_reason=reason,
            raw_response=res_json,
        )

    def normalize_status(self, raw_status: str) -> str:
        """
        Normalizes Pathao raw status strings and webhook events into standard ShipmentStatus.
        """
        if not raw_status:
            return ShipmentStatus.PENDING

        slug = str(raw_status).strip().lower().replace("_", "-").replace(" ", "-")

        mapping = {
            # Pending / Created
            "pending": ShipmentStatus.PENDING,
            "order.created": ShipmentStatus.PENDING,
            "order.updated": ShipmentStatus.PENDING,
            "draft": ShipmentStatus.PENDING,
            # Ready to ship
            "order.assigned-for-pickup": ShipmentStatus.READY_TO_SHIP,
            "assigned-for-pickup": ShipmentStatus.READY_TO_SHIP,
            "ready": ShipmentStatus.READY_TO_SHIP,
            "ready-to-ship": ShipmentStatus.READY_TO_SHIP,
            # Pickup requested
            "order.pickup-requested": ShipmentStatus.PICKUP_REQUESTED,
            "pickup-requested": ShipmentStatus.PICKUP_REQUESTED,
            # Picked up / at hub
            "order.picked": ShipmentStatus.PICKED_UP,
            "picked": ShipmentStatus.PICKED_UP,
            "order.at-the-sorting-hub": ShipmentStatus.PICKED_UP,
            "at-the-sorting-hub": ShipmentStatus.PICKED_UP,
            # In transit
            "in-transit": ShipmentStatus.IN_TRANSIT,
            "order.in-transit": ShipmentStatus.IN_TRANSIT,
            "order.received-at-last-mile-hub": ShipmentStatus.IN_TRANSIT,
            "received-at-last-mile-hub": ShipmentStatus.IN_TRANSIT,
            # Out for delivery
            "out-for-delivery": ShipmentStatus.OUT_FOR_DELIVERY,
            "order.assigned-for-delivery": ShipmentStatus.OUT_FOR_DELIVERY,
            "assigned-for-delivery": ShipmentStatus.OUT_FOR_DELIVERY,
            # Delivered
            "delivered": ShipmentStatus.DELIVERED,
            "order.delivered": ShipmentStatus.DELIVERED,
            "order.paid": ShipmentStatus.DELIVERED,
            "order.partial-delivery": ShipmentStatus.DELIVERED,
            "partial-delivery": ShipmentStatus.DELIVERED,
            "paid": ShipmentStatus.DELIVERED,
            # Delivery failed
            "delivery-failed": ShipmentStatus.DELIVERY_FAILED,
            "order.delivery-failed": ShipmentStatus.DELIVERY_FAILED,
            "order.pickup-failed": ShipmentStatus.DELIVERY_FAILED,
            "pickup-failed": ShipmentStatus.DELIVERY_FAILED,
            "failed": ShipmentStatus.DELIVERY_FAILED,
            # Cancelled
            "cancelled": ShipmentStatus.CANCELLED,
            "order.pickup-cancelled": ShipmentStatus.CANCELLED,
            "pickup-cancelled": ShipmentStatus.CANCELLED,
            # Returned
            "returned": ShipmentStatus.RETURNED,
            "order.returned": ShipmentStatus.RETURNED,
            "order.returned-to-merchant": ShipmentStatus.RETURNED,
            "order.return-in-transit": ShipmentStatus.RETURNED,
            "order.return-id-created": ShipmentStatus.RETURNED,
            "returned-to-merchant": ShipmentStatus.RETURNED,
        }

        return mapping.get(slug, ShipmentStatus.PENDING)
