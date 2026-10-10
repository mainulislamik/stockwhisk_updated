"""
Custom Webhook Website Connector Implementation for StockWhisk (Phase 9).
Provides bi-directional synchronization between custom e-commerce stores / webhooks and StockWhisk.
Adheres strictly to the connector abstraction and isolation principles.
"""
import hashlib
import hmac
import json
import logging
import time
from decimal import Decimal, InvalidOperation
from typing import Any, Callable, Dict, List, Optional, Tuple, Type
import requests

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from catalog.models import Product, ProductVariation, Unit
from core.tenant_context import tenant_context
from ..inventory_engine import (
    BaseInventoryAdapter,
    ExternalRateLimitError,
    ExternalServerError,
    ExternalTimeoutError,
    InsufficientStockOrderError,
    InvalidCredentialsError,
    InventorySyncResult,
    get_inventory_levels,
    register_inventory_adapter,
)
from ..mapping_services import (
    MappingConflictError,
    create_or_update_product_mapping,
    search_product_mapping,
)
from ..models import (
    ExternalOrder,
    Integration,
    IntegrationCredential,
    IntegrationLog,
    IntegrationProvider,
    IntegrationStatus,
    ProductChannelMapping,
    WebhookEndpoint,
)
from ..order_engine import (
    InvalidQuantityError,
    MalformedOrderPayloadError,
    StandardOrderDTO,
    StandardOrderItemDTO,
    UnmappedProductOrderError,
    parse_and_validate_order_payload,
    process_external_order,
    resolve_product_mapping,
)
from .base import (
    BaseWebsiteConnector,
    ConnectorAuthError,
    ConnectorDuplicateWebhookError,
    ConnectorError,
    ConnectorMalformedResponseError,
    ConnectorMissingProductError,
    ConnectorMissingSKUError,
    ConnectorRateLimitError,
    ConnectorServerError,
    ConnectorTimeoutError,
    ConnectorWebhookError,
)

logger = logging.getLogger("integrations.connectors.custom_webhook")


class CustomWebhookConnector(BaseWebsiteConnector):
    """
    Website platform connector for Custom Webhook / API integrations.
    Supports bi-directional flow:
    - Products: fetch, create, update, mapping, import, export
    - Orders: webhook ingestion, parsing, mapping, StockWhisk order creation, stock reservation
    - Inventory: outbound ATS push to custom webhook endpoints
    - Webhooks: registration, signature verification, duplicate prevention, and deletion
    """

    DEFAULT_TIMEOUT = 10

    def __init__(self, integration: Integration):
        super().__init__(integration)
        self._cached_credentials = None

    def _get_credentials(self) -> Dict[str, Any]:
        """Fetch decrypted credentials for this integration."""
        if self._cached_credentials is not None:
            return self._cached_credentials

        try:
            cred_obj = IntegrationCredential.all_objects.get(
                shop=self.shop,
                integration=self.integration,
            )
            self._cached_credentials = cred_obj.get_credentials()
            return self._cached_credentials
        except IntegrationCredential.DoesNotExist:
            return {
                "api_key": "",
                "api_secret": "",
                "access_token": "",
                "webhook_secret": "",
                "extra": {},
            }

    def _get_auth_headers(self) -> Dict[str, str]:
        """Generate authentication headers."""
        creds = self._get_credentials()
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "StockWhisk-CustomWebhook-Connector/1.0",
        }
        if creds.get("access_token"):
            headers["Authorization"] = f"Bearer {creds['access_token']}"
        elif creds.get("api_key"):
            headers["X-API-Key"] = creds["api_key"]
            if creds.get("api_secret"):
                headers["X-API-Secret"] = creds["api_secret"]
        return headers

    def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        timeout: Optional[int] = None,
    ) -> Any:
        """
        Executes outbound HTTP requests with rigorous error handling and status code mapping.
        """
        base_url = (self.integration.base_url or "").rstrip("/")
        if not base_url:
            raise ConnectorAuthError("Integration base_url is not configured.")

        url = f"{base_url}/{endpoint.lstrip('/')}"
        headers = self._get_auth_headers()
        req_timeout = timeout or self.DEFAULT_TIMEOUT

        try:
            response = requests.request(
                method=method.upper(),
                url=url,
                headers=headers,
                json=data if data is not None else None,
                params=params,
                timeout=req_timeout,
            )
        except requests.exceptions.Timeout as e:
            logger.warning("Timeout connecting to external website %s: %s", url, str(e))
            raise ConnectorTimeoutError(f"Request to {url} timed out.") from e
        except requests.exceptions.RequestException as e:
            logger.error("Connection error to external website %s: %s", url, str(e))
            raise ConnectorServerError(f"Network error connecting to external website: {str(e)}") from e

        # Handle HTTP status codes
        if response.status_code == 401:
            raise ConnectorAuthError("Authentication failed: invalid credentials (HTTP 401).", status_code=401)
        elif response.status_code == 403:
            raise ConnectorAuthError("Permission denied: insufficient API scope (HTTP 403).", status_code=403)
        elif response.status_code == 429:
            retry_after = 60
            if "Retry-After" in response.headers:
                try:
                    retry_after = int(response.headers["Retry-After"])
                except ValueError:
                    pass
            raise ConnectorRateLimitError(
                "Rate limit exceeded (HTTP 429).",
                retry_after=retry_after,
            )
        elif response.status_code >= 500:
            raise ConnectorServerError(
                f"External server error (HTTP {response.status_code}): {response.text[:200]}",
                status_code=response.status_code,
            )
        elif response.status_code >= 400:
            raise ConnectorError(
                f"Client error from external platform (HTTP {response.status_code}): {response.text[:200]}",
                status_code=response.status_code,
            )

        # Parse response
        if response.status_code == 204 or not response.content.strip():
            return {}

        try:
            return response.json()
        except ValueError as e:
            raise ConnectorMalformedResponseError("Invalid JSON returned by external website.") from e

    def execute_with_retry(
        self,
        operation: Callable[[], Any],
        max_attempts: int = 3,
        backoff_seconds: float = 0.1,
        retryable_exceptions: Tuple[Type[Exception], ...] = (
            ConnectorTimeoutError,
            ConnectorServerError,
            ConnectorRateLimitError,
        ),
    ) -> Any:
        """
        Executes a callable with bounded exponential backoff for transient network/server failures.
        Permanent errors (401, 403, 400, malformed JSON) fail immediately.
        """
        last_error = None
        current_backoff = backoff_seconds

        for attempt in range(1, max_attempts + 1):
            try:
                return operation()
            except retryable_exceptions as e:
                last_error = e
                logger.warning(
                    "Transient error in connector operation (attempt %d/%d): %s",
                    attempt,
                    max_attempts,
                    str(e),
                )
                if attempt == max_attempts:
                    break
                if isinstance(e, ConnectorRateLimitError) and e.retry_after > 0:
                    sleep_time = min(float(e.retry_after), 2.0)
                else:
                    sleep_time = current_backoff
                time.sleep(sleep_time)
                current_backoff *= 2
            except Exception:
                # Non-transient errors bubble up immediately
                raise

        if last_error:
            raise last_error

    # --------------------------------------------------------------------------
    # Connector Operations Implementation
    # --------------------------------------------------------------------------

    def connect(self) -> bool:
        """Establishes connection and transitions integration status to CONNECTED."""
        if not self.validate_credentials():
            self.integration.mark_error("Credential validation failed during connect.")
            return False

        with transaction.atomic():
            self.integration.mark_connected()
            IntegrationLog.all_objects.create(
                shop=self.shop,
                integration=self.integration,
                action="connector_connected",
                level=IntegrationLog.Level.INFO,
                message="Successfully connected custom webhook connector.",
            )
        return True

    def disconnect(self) -> bool:
        """Disconnects integration and halts active synchronization."""
        with transaction.atomic():
            self.integration.status = IntegrationStatus.DISCONNECTED
            self.integration.is_active = False
            self.integration.save(update_fields=["status", "is_active", "updated_at"])
            IntegrationLog.all_objects.create(
                shop=self.shop,
                integration=self.integration,
                action="connector_disconnected",
                level=IntegrationLog.Level.INFO,
                message="Custom webhook connector disconnected by user.",
            )
        return True

    def validate_credentials(self) -> bool:
        """Validates credentials against remote website."""
        from ..models import WebhookEndpoint
        # Inbound custom webhook integration: StockWhisk is the API provider.
        endpoint = WebhookEndpoint.all_objects.filter(
            shop=self.shop, integration=self.integration, is_active=True
        ).first()
        if endpoint:
            return True

        creds = self._get_credentials()
        has_api_creds = bool(creds.get("api_key") or creds.get("access_token"))

        if not has_api_creds:
            if creds.get("webhook_secret"):
                return True
            raise ConnectorAuthError("Missing API key or access token.")

        if self.integration.base_url:
            try:
                res = self._request("GET", "api/v1/auth/verify", timeout=5)
                return bool(res.get("valid", True))
            except ConnectorAuthError:
                raise
            except Exception as e:
                try:
                    self._request("GET", "api/v1/health", timeout=5)
                    return True
                except Exception:
                    raise ConnectorAuthError(f"Credential validation failed: {str(e)}")
        return True

    def fetch_products(self, page: int = 1, limit: int = 50) -> List[Dict[str, Any]]:
        """Fetches product catalog items from external website."""
        payload = self._request("GET", "api/v1/products", params={"page": page, "limit": limit})
        if isinstance(payload, list):
            items = payload
        elif isinstance(payload, dict) and "products" in payload:
            items = payload["products"]
        elif isinstance(payload, dict) and "data" in payload:
            items = payload["data"]
        else:
            raise ConnectorMalformedResponseError("Unexpected response shape for product fetch.")

        cleaned = []
        for item in items:
            if not isinstance(item, dict):
                continue
            ext_id = str(item.get("id") or item.get("external_id") or "")
            sku = str(item.get("sku") or "").strip()
            name = str(item.get("name") or item.get("title") or "").strip()
            if not ext_id:
                raise ConnectorMissingProductError("Item missing external identifier.")
            cleaned.append({
                "external_product_id": ext_id,
                "external_variation_id": str(item.get("variation_id") or ""),
                "external_sku": sku,
                "name": name,
                "price": str(item.get("price") or "0.00"),
                "stock_quantity": item.get("stock_quantity", 0),
            })
        return cleaned

    def create_product(self, product_data: Dict[str, Any]) -> Dict[str, Any]:
        """Creates a product on the external website."""
        sku = str(product_data.get("sku") or "").strip()
        if not sku:
            raise ConnectorMissingSKUError("Cannot export product without SKU.")
        return self._request("POST", "api/v1/products", data=product_data)

    def update_product(self, external_product_id: str, product_data: Dict[str, Any]) -> Dict[str, Any]:
        """Updates product information on the external website."""
        if not external_product_id:
            raise ConnectorMissingProductError("external_product_id is required.")
        return self._request("PUT", f"api/v1/products/{external_product_id}", data=product_data)

    def update_inventory(
        self,
        external_product_id: str,
        external_variation_id: str = "",
        available_quantity: Decimal = Decimal("0"),
    ) -> Dict[str, Any]:
        """Pushes calculated Available-To-Sell (ATS) stock quantity to external website."""
        if not external_product_id:
            raise ConnectorMissingProductError("Cannot update inventory without external_product_id.")

        endpoint = f"api/v1/inventory/{external_product_id}"
        if external_variation_id:
            endpoint += f"/variations/{external_variation_id}"

        payload = {
            "external_product_id": external_product_id,
            "external_variation_id": external_variation_id,
            "available_quantity": float(available_quantity),
            "updated_at": timezone.now().isoformat(),
        }
        return self._request("POST", endpoint, data=payload)

    def fetch_order(self, external_order_id: str) -> Dict[str, Any]:
        """Fetches a single order by external ID."""
        if not external_order_id:
            raise ConnectorMalformedResponseError("external_order_id is required.")
        res = self._request("GET", f"api/v1/orders/{external_order_id}")
        if not isinstance(res, dict):
            raise ConnectorMalformedResponseError("Order response must be a dictionary.")
        return res

    def fetch_orders(self, status: Optional[str] = None, page: int = 1, limit: int = 50) -> List[Dict[str, Any]]:
        """Fetches orders list from external website."""
        params = {"page": page, "limit": limit}
        if status:
            params["status"] = status
        res = self._request("GET", "api/v1/orders", params=params)
        if isinstance(res, list):
            return res
        elif isinstance(res, dict) and "orders" in res:
            return res["orders"]
        elif isinstance(res, dict) and "data" in res:
            return res["data"]
        raise ConnectorMalformedResponseError("Orders response must be a list or data container.")

    def update_order_status(
        self,
        external_order_id: str,
        status: str,
        tracking_info: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Pushes order fulfillment/cancellation state to external website."""
        if not external_order_id:
            raise ConnectorMalformedResponseError("external_order_id is required.")
        payload = {
            "status": status,
            "tracking_info": tracking_info or {},
            "updated_at": timezone.now().isoformat(),
        }
        return self._request("POST", f"api/v1/orders/{external_order_id}/status", data=payload)

    def register_webhook(self, event_name: str, target_url: str) -> Dict[str, Any]:
        """Registers webhook on external website."""
        if not event_name or not target_url:
            raise ConnectorWebhookError("event_name and target_url are required.")
        payload = {
            "event": event_name,
            "target_url": target_url,
        }
        return self._request("POST", "api/v1/webhooks", data=payload)

    def delete_webhook(self, webhook_id: str) -> bool:
        """Deletes webhook on external website."""
        if not webhook_id:
            raise ConnectorWebhookError("webhook_id is required.")
        self._request("DELETE", f"api/v1/webhooks/{webhook_id}")
        return True

    # --------------------------------------------------------------------------
    # Product Flow (Mapping integration with Phase 5)
    # --------------------------------------------------------------------------

    def map_product(
        self,
        product: Product,
        external_product_id: str,
        variation: Optional[ProductVariation] = None,
        external_variation_id: str = "",
        external_sku: str = "",
        sync_stock: bool = True,
        sync_price: bool = True,
    ) -> ProductChannelMapping:
        """
        Creates or updates a channel mapping between internal StockWhisk product and external product.
        """
        if not external_product_id:
            raise ConnectorMissingProductError("external_product_id is required for mapping.")

        mapping, _ = create_or_update_product_mapping(
            shop=self.shop,
            integration=self.integration,
            product=product,
            external_product_id=str(external_product_id),
            variation=variation,
            external_variation_id=str(external_variation_id) if external_variation_id else "",
            external_sku=external_sku or (variation.sku if variation else product.sku),
            is_sync_enabled=sync_stock,
        )
        if hasattr(mapping, "sync_inventory"):
            mapping.sync_inventory = sync_stock
            mapping.save(update_fields=["sync_inventory", "updated_at"])
        return mapping

    def export_and_map_product(
        self,
        product: Product,
        variation: Optional[ProductVariation] = None,
        price: Optional[Decimal] = None,
        sync_stock: bool = True,
    ) -> ProductChannelMapping:
        """
        Exports a StockWhisk product to external website and establishes a Phase 5 mapping.
        """
        sku = (variation.sku if variation else product.sku) or ""
        if not sku:
            raise ConnectorMissingSKUError(f"Product #{product.id} has no SKU; cannot export.")

        sell_price = price or (variation.price if variation and hasattr(variation, "price") else product.selling_price)
        levels = get_inventory_levels(product, variation)

        product_payload = {
            "name": f"{product.name} ({variation.name})" if variation else product.name,
            "sku": sku,
            "price": str(sell_price),
            "stock_quantity": float(levels["available"]),
            "manage_stock": True,
        }

        remote_res = self.create_product(product_payload)
        external_id = str(remote_res.get("id") or remote_res.get("external_id") or "")
        if not external_id:
            raise ConnectorMalformedResponseError("Remote platform did not return created product ID.")

        return self.map_product(
            product=product,
            external_product_id=external_id,
            variation=variation,
            external_variation_id=str(remote_res.get("variation_id") or ""),
            external_sku=sku,
            sync_stock=sync_stock,
        )

    def import_and_map_product(
        self,
        external_item: Dict[str, Any],
        default_unit: Optional[Unit] = None,
    ) -> ProductChannelMapping:
        """
        Imports an external product into StockWhisk catalog (if missing) and establishes channel mapping.
        """
        ext_id = str(external_item.get("id") or external_item.get("external_product_id") or "")
        sku = str(external_item.get("sku") or external_item.get("external_sku") or "").strip()
        name = str(external_item.get("name") or external_item.get("title") or f"Web Item {ext_id}").strip()
        price = Decimal(str(external_item.get("price") or "0.00"))

        if not ext_id:
            raise ConnectorMissingProductError("Missing external product identifier in import payload.")
        if not sku:
            raise ConnectorMissingSKUError("Cannot import external product without SKU.")

        # Check existing mapping
        existing_mapping = ProductChannelMapping.all_objects.filter(
            shop=self.shop,
            integration=self.integration,
            external_product_id=ext_id,
        ).first()
        if existing_mapping:
            return existing_mapping

        # Find or create internal product
        product = Product.all_objects.filter(shop=self.shop, sku=sku).first()
        if not product:
            unit = default_unit or Unit.all_objects.filter(shop=self.shop).first()
            if not unit:
                unit, _ = Unit.all_objects.get_or_create(
                    shop=self.shop,
                    name="Piece",
                    defaults={"short_code": "pcs", "measure_type": "count", "allow_decimal": False},
                )
            product = Product.all_objects.create(
                shop=self.shop,
                name=name,
                sku=sku,
                selling_price=price,
                unit=unit,
                current_stock=Decimal("0.00"),
            )

        return self.map_product(
            product=product,
            external_product_id=ext_id,
            external_sku=sku,
            sync_stock=True,
        )

    # --------------------------------------------------------------------------
    # Webhook Verification & Order Processing Pipeline
    # --------------------------------------------------------------------------

    def verify_webhook_signature(self, raw_body: bytes, signature_header: str) -> bool:
        """
        Cryptographically verifies incoming webhook HMAC-SHA256 signature.
        """
        if not signature_header:
            return False

        creds = self._get_credentials()
        secret = creds.get("webhook_secret", "")
        if not secret:
            endpoint = WebhookEndpoint.all_objects.filter(shop=self.shop, integration=self.integration).first()
            if endpoint:
                secret = endpoint.secret_token

        if not secret:
            logger.warning("No webhook secret configured for integration #%s", self.integration.id)
            return False

        expected = hmac.new(
            secret.encode("utf-8"),
            raw_body,
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(expected.lower(), signature_header.lower())

    def parse_inbound_order(self, payload: Dict[str, Any]) -> StandardOrderDTO:
        """
        Translates platform-specific order dictionary into StockWhisk StandardOrderDTO.
        Reuses core order normalization logic.
        """
        if not isinstance(payload, dict):
            raise ConnectorMalformedResponseError("Order payload must be a JSON dictionary.")

        try:
            return parse_and_validate_order_payload(payload)
        except (MalformedOrderPayloadError, InvalidQuantityError) as e:
            raise ConnectorMalformedResponseError(str(e)) from e

    def handle_inbound_order_webhook(self, raw_body: bytes, signature_header: str) -> Tuple[ExternalOrder, bool]:
        """
        End-to-End Inbound Webhook Handler:
        1. Verify HMAC cryptographic signature
        2. Parse JSON
        3. Translate into StandardOrderDTO
        4. Ingest via StockWhisk order engine (resolving mappings, creating sale, and reserving stock)
        """
        if not self.verify_webhook_signature(raw_body, signature_header):
            raise ConnectorAuthError("Invalid webhook signature.")

        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except (ValueError, UnicodeDecodeError) as e:
            raise ConnectorMalformedResponseError("Failed to decode webhook JSON body.") from e

        # Duplicate webhook / event check
        event_id = str(payload.get("event_id") or payload.get("id") or "").strip()
        if event_id:
            existing = ExternalOrder.all_objects.filter(
                shop=self.shop,
                integration=self.integration,
                raw_payload__event_id=event_id,
            ).first()
            if existing:
                raise ConnectorDuplicateWebhookError(f"Duplicate webhook event: {event_id}")

        dto = self.parse_inbound_order(payload)
        try:
            return process_external_order(self.shop, self.integration, dto)
        except UnmappedProductOrderError as e:
            raise ConnectorMissingProductError(str(e)) from e

    def sync_stock_to_external(self, product: Product, variation: Optional[ProductVariation] = None) -> Dict[str, Any]:
        """
        Outbound Inventory Flow:
        Fetches current Available-To-Sell (ATS) stock from inventory engine and pushes to external website.
        """
        mapping = ProductChannelMapping.all_objects.filter(
            shop=self.shop,
            integration=self.integration,
            product=product,
            variation=variation,
            is_sync_enabled=True,
        ).first()

        if not mapping:
            raise ConnectorMissingProductError(
                f"Product #{product.id} (variation: {variation.id if variation else 'None'}) is not mapped to this channel."
            )

        if not mapping.sync_inventory:
            logger.info("Stock sync disabled for mapping #%s", mapping.id)
            return {"skipped": True, "reason": "sync_stock disabled"}

        # Calculate ATS = on_hand - reserved
        levels = get_inventory_levels(product, variation)
        available_qty = levels["available"]

        # Push to external platform
        res = self.update_inventory(
            external_product_id=mapping.external_product_id,
            external_variation_id=mapping.external_variation_id,
            available_quantity=available_qty,
        )

        mapping.last_synced_at = timezone.now()
        mapping.sync_status = "SYNCED"
        mapping.save(update_fields=["last_synced_at", "sync_status", "updated_at"])

        return res


# ==============================================================================
# Central Inventory Engine Adapter Registration
# ==============================================================================

class CustomWebhookInventoryAdapter(BaseInventoryAdapter):
    """
    Adapter bridging the central StockWhisk inventory engine to the CustomWebhookConnector.
    """

    def __init__(self, integration: Integration):
        super().__init__(integration)
        self.connector = CustomWebhookConnector(integration)

    def update_remote_stock(self, mapping: ProductChannelMapping, available_quantity: Decimal) -> InventorySyncResult:
        try:
            res = self.connector.update_inventory(
                external_product_id=mapping.external_product_id,
                external_variation_id=mapping.external_variation_id,
                available_quantity=available_quantity,
            )
            return InventorySyncResult(
                success=True,
                status="SUCCESS",
                available_quantity=available_quantity,
                status_code=200,
                raw_payload=res,
            )
        except ConnectorTimeoutError as e:
            raise ExternalTimeoutError(str(e)) from e
        except ConnectorRateLimitError as e:
            raise ExternalRateLimitError(str(e), retry_after=e.retry_after) from e
        except ConnectorServerError as e:
            raise ExternalServerError(str(e), status_code=e.status_code) from e
        except ConnectorAuthError as e:
            raise InvalidCredentialsError(str(e)) from e
        except Exception as e:
            return InventorySyncResult(
                success=False,
                status="FAILED",
                available_quantity=available_quantity,
                error_type="unhandled_exception",
                error_message=str(e),
                status_code=getattr(e, "status_code", 500),
                raw_payload={"error": str(e)},
            )

    def fetch_remote_stock(self, mapping: ProductChannelMapping) -> InventorySyncResult:
        try:
            products = self.connector.fetch_products(limit=100)
            target_id = mapping.external_variation_id or mapping.external_product_id
            for p in products:
                if p["external_product_id"] == target_id or p.get("external_variation_id") == target_id:
                    qty = Decimal(str(p.get("stock_quantity", 0)))
                    return InventorySyncResult(
                        success=True,
                        status="SUCCESS",
                        available_quantity=qty,
                        status_code=200,
                        raw_payload=p,
                    )
            return InventorySyncResult(
                success=False,
                status="FAILED",
                available_quantity=Decimal("0.00"),
                status_code=404,
                error_type="not_found",
                error_message="Product not found on remote channel",
            )
        except Exception as e:
            return InventorySyncResult(
                success=False,
                status="FAILED",
                available_quantity=Decimal("0.00"),
                status_code=500,
                error_type="remote_error",
                error_message=str(e),
            )


# Register inventory adapter for custom_webhook provider
register_inventory_adapter(IntegrationProvider.CUSTOM_WEBHOOK, CustomWebhookInventoryAdapter)
register_inventory_adapter("custom_webhook", CustomWebhookInventoryAdapter)
