"""
Website Connector Interface & Exceptions for StockWhisk Integrations (Phase 9).
Provides strict isolation between external e-commerce platforms and StockWhisk core business logic.
"""
from abc import ABC, abstractmethod
from typing import Any, Callable, Dict, List, Optional, Tuple, Type
from decimal import Decimal


# ==============================================================================
# Domain Exceptions
# ==============================================================================

class ConnectorError(Exception):
    """Base exception for all external website connector errors."""
    def __init__(self, message: str, status_code: Optional[int] = None, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}


class ConnectorAuthError(ConnectorError):
    """Raised on authentication/credential failures (e.g. 401 Unauthorized, invalid token/key)."""
    pass


class ConnectorRateLimitError(ConnectorError):
    """Raised when the remote website API returns HTTP 429 Too Many Requests."""
    def __init__(self, message: str, retry_after: int = 60, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=429, details=details)
        self.retry_after = retry_after


class ConnectorTimeoutError(ConnectorError):
    """Raised when a request to the external website times out."""
    pass


class ConnectorServerError(ConnectorError):
    """Raised when the remote website returns HTTP 500, 502, 503, or 504."""
    pass


class ConnectorMalformedResponseError(ConnectorError):
    """Raised when the remote website returns invalid, unparseable, or unexpected payload shapes."""
    pass


class ConnectorMissingProductError(ConnectorError):
    """Raised when an external product or variation cannot be found or is missing in the catalog."""
    pass


class ConnectorMissingSKUError(ConnectorError):
    """Raised when a required SKU is missing or blank on an external item."""
    pass


class ConnectorWebhookError(ConnectorError):
    """Raised when webhook registration, deletion, or verification fails."""
    pass


class ConnectorDuplicateWebhookError(ConnectorWebhookError):
    """Raised when a webhook event has already been ingested or is duplicate."""
    pass


# ==============================================================================
# Abstract Website Connector Base Class
# ==============================================================================

class BaseWebsiteConnector(ABC):
    """
    Abstract interface for website platform connectors.
    All operations supported by external platforms must be exposed through this abstraction.
    """

    def __init__(self, integration):
        self.integration = integration
        self.shop = integration.shop

    # --- Core Platform Operations ---

    @abstractmethod
    def connect(self) -> bool:
        """Establishes connection and transitions integration status to CONNECTED."""
        pass

    @abstractmethod
    def disconnect(self) -> bool:
        """Disconnects integration and halts active sync."""
        pass

    @abstractmethod
    def validate_credentials(self) -> bool:
        """Validates API credentials against the remote website."""
        pass

    @abstractmethod
    def fetch_products(self, page: int = 1, limit: int = 50) -> List[Dict[str, Any]]:
        """Fetches product catalog items from the external website."""
        pass

    @abstractmethod
    def create_product(self, product_data: Dict[str, Any]) -> Dict[str, Any]:
        """Creates a product on the external website."""
        pass

    @abstractmethod
    def update_product(self, external_product_id: str, product_data: Dict[str, Any]) -> Dict[str, Any]:
        """Updates a product on the external website."""
        pass

    @abstractmethod
    def update_inventory(self, external_product_id: str, external_variation_id: str, available_quantity: Decimal) -> Dict[str, Any]:
        """Pushes Available-To-Sell (ATS) stock quantity to the external website."""
        pass

    @abstractmethod
    def fetch_order(self, external_order_id: str) -> Dict[str, Any]:
        """Fetches a single order from the external website."""
        pass

    @abstractmethod
    def fetch_orders(self, status: Optional[str] = None, page: int = 1, limit: int = 50) -> List[Dict[str, Any]]:
        """Fetches recent orders from the external website."""
        pass

    @abstractmethod
    def update_order_status(self, external_order_id: str, status: str, tracking_info: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Updates order status on the external website."""
        pass

    @abstractmethod
    def register_webhook(self, event_name: str, target_url: str) -> Dict[str, Any]:
        """Registers a webhook endpoint on the external website."""
        pass

    @abstractmethod
    def delete_webhook(self, webhook_id: str) -> bool:
        """Removes a registered webhook from the external website."""
        pass

    # --- Product, Inventory & Order Flows ---

    @abstractmethod
    def map_product(
        self,
        product,
        external_product_id: str,
        variation=None,
        external_variation_id: str = "",
        external_sku: str = "",
        sync_stock: bool = True,
        sync_price: bool = True,
    ):
        """Creates or updates a channel mapping between internal StockWhisk product and external product."""
        pass

    @abstractmethod
    def export_and_map_product(
        self,
        product,
        variation=None,
        price: Optional[Decimal] = None,
        sync_stock: bool = True,
    ):
        """Exports a StockWhisk product to external website and establishes mapping."""
        pass

    @abstractmethod
    def import_and_map_product(
        self,
        external_item: Dict[str, Any],
        default_unit=None,
    ):
        """Imports an external product into StockWhisk catalog and establishes channel mapping."""
        pass

    @abstractmethod
    def verify_webhook_signature(self, raw_body: bytes, signature_header: str) -> bool:
        """Cryptographically verifies incoming webhook HMAC signature."""
        pass

    @abstractmethod
    def parse_inbound_order(self, payload: Dict[str, Any]):
        """Translates platform-specific order dictionary into StockWhisk StandardOrderDTO."""
        pass

    @abstractmethod
    def handle_inbound_order_webhook(self, raw_body: bytes, signature_header: str):
        """Processes inbound webhook payload, maps items, creates order & reserves stock."""
        pass

    @abstractmethod
    def sync_stock_to_external(self, product, variation=None) -> Dict[str, Any]:
        """Calculates ATS stock and pushes to external website."""
        pass

    @abstractmethod
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
        """Executes a callable with bounded exponential backoff for transient failures."""
        pass
