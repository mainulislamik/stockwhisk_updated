"""
Website Connectors Registry & Public Interface for StockWhisk Integrations (Phase 9).
"""
from typing import Dict, Type
from .base import (
    BaseWebsiteConnector,
    ConnectorError,
    ConnectorAuthError,
    ConnectorRateLimitError,
    ConnectorTimeoutError,
    ConnectorServerError,
    ConnectorMalformedResponseError,
    ConnectorMissingProductError,
    ConnectorMissingSKUError,
    ConnectorWebhookError,
    ConnectorDuplicateWebhookError,
)
from .custom_webhook import CustomWebhookConnector, CustomWebhookInventoryAdapter

_CONNECTOR_REGISTRY: Dict[str, Type[BaseWebsiteConnector]] = {
    "custom_webhook": CustomWebhookConnector,
}


def register_connector(provider: str, connector_cls: Type[BaseWebsiteConnector]) -> None:
    """Registers a platform connector class for an integration provider."""
    _CONNECTOR_REGISTRY[str(provider).lower()] = connector_cls


def get_connector(integration) -> BaseWebsiteConnector:
    """
    Returns an instantiated connector for the given integration.
    Defaults to CustomWebhookConnector if the provider is custom_webhook or unregistered.
    """
    provider = str(getattr(integration, "provider", "")).lower()
    connector_cls = _CONNECTOR_REGISTRY.get(provider, CustomWebhookConnector)
    return connector_cls(integration)


__all__ = [
    "BaseWebsiteConnector",
    "ConnectorError",
    "ConnectorAuthError",
    "ConnectorRateLimitError",
    "ConnectorTimeoutError",
    "ConnectorServerError",
    "ConnectorMalformedResponseError",
    "ConnectorMissingProductError",
    "ConnectorMissingSKUError",
    "ConnectorWebhookError",
    "ConnectorDuplicateWebhookError",
    "CustomWebhookConnector",
    "CustomWebhookInventoryAdapter",
    "get_connector",
    "register_connector",
]
