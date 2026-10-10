"""
Inbound Webhook Intake & Management Views.

Provides:
- WebhookIntakeView: Fast asynchronous HTTP ingestion receiver for external webhooks.
- WebhookEndpointViewSet: Tenant-scoped CRUD management of registered webhook endpoints.
"""
import hmac
import logging
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsTenantMember
from core.tenant_context import tenant_context
from .inventory_engine import get_inventory_levels
from .models import ExternalOrder, IntegrationEvent, WebhookEndpoint
from .permissions import CanManageIntegrations, CanViewIntegrations, IsActiveTenant
from .serializers import IntegrationEventSerializer, WebhookEndpointSerializer
from .throttling import IntegrationInboundThrottle
from .validators import validate_tenant_boundary
from .webhook_engine import execute_event_processing, ingest_webhook

logger = logging.getLogger("integrations.webhooks")

# Maximum permitted payload size for inbound webhooks (1MB) to prevent memory exhaustion DoS
MAX_WEBHOOK_BODY_SIZE = 1 * 1024 * 1024


class WebhookIntakeView(APIView):
    """
    Public inbound receiver endpoint for external store/courier webhooks.
    Does NOT require session/JWT auth, but authenticates requests via signatures/tokens
    configured on the specific WebhookEndpoint.

    Returns quickly (HTTP 202/200) after signature check, validation, and queuing.
    """

    permission_classes = [permissions.AllowAny]
    authentication_classes = []  # Bypass standard session/token authentication
    throttle_classes = [IntegrationInboundThrottle]

    def post(self, request, endpoint_id):
        # Enforce strict request size limits against DoS attacks
        content_length = request.META.get("CONTENT_LENGTH")
        if content_length:
            try:
                if int(content_length) > MAX_WEBHOOK_BODY_SIZE:
                    return Response(
                        {"error": "Request entity too large. Maximum size is 1MB."},
                        status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    )
            except (ValueError, TypeError):
                pass

        if len(request.body) > MAX_WEBHOOK_BODY_SIZE:
            return Response(
                {"error": "Request entity too large. Maximum size is 1MB."},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )
        endpoint = (
            WebhookEndpoint.all_objects.select_related("shop", "integration")
            .filter(id=endpoint_id, is_active=True)
            .first()
        )
        if not endpoint:
            return Response(
                {"error": "Webhook endpoint not found or inactive."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not endpoint.integration.is_active:
            return Response(
                {"error": "Associated integration is inactive or disconnected."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Ingest, authenticate signature, validate, deduplicate, and queue
        result, http_status = ingest_webhook(
            endpoint=endpoint,
            raw_body=request.body,
            headers=request.headers,
        )

        # Synchronous execution support (for direct checkout APIs that need the invoice_no right away)
        if (
            http_status == status.HTTP_202_ACCEPTED
            and (request.query_params.get("sync") == "true" or request.headers.get("X-Sync") == "true")
            and result.get("event_id")
        ):
            proc_event = execute_event_processing(result["event_id"])
            ext_order = ExternalOrder.all_objects.filter(
                shop=endpoint.shop, external_order_id=proc_event.external_event_id
            ).first()
            if ext_order and ext_order.sale:
                return Response(
                    {
                        "status": "success",
                        "event_id": proc_event.id,
                        "external_order_id": ext_order.external_order_id,
                        "invoice_no": ext_order.sale.invoice_no,
                        "sale_id": ext_order.sale.id,
                        "total_amount": float(ext_order.sale.total),
                        "message": "Order successfully processed and sale created.",
                    },
                    status=status.HTTP_200_OK,
                )

        return Response(result, status=http_status)

    def get(self, request, endpoint_id):
        """
        Public inbound GET endpoint for external custom websites.
        Allows real-time inventory level check (ATS, on-hand, reserved) for SKUs or barcodes.
        Secured via secret token header or query parameter.
        """
        endpoint = (
            WebhookEndpoint.all_objects.select_related("shop", "integration")
            .filter(id=endpoint_id, is_active=True)
            .first()
        )
        if not endpoint:
            return Response(
                {"error": "Webhook endpoint not found or inactive."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not endpoint.integration.is_active:
            return Response(
                {"error": "Associated integration is inactive or disconnected."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Authenticate secret token
        auth_secret = (
            request.headers.get("X-Webhook-Secret")
            or request.headers.get("X-Secret-Token")
            or request.headers.get("Authorization", "").replace("Bearer ", "").strip()
            or request.query_params.get("token")
        )
        if endpoint.secret_token and (
            not auth_secret or not hmac.compare_digest(auth_secret, endpoint.secret_token)
        ):
            return Response(
                {"error": "Unauthorized: missing or invalid secret token."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        sku = request.query_params.get("sku", "").strip()
        barcode = request.query_params.get("barcode", "").strip()

        from catalog.models import Product, ProductVariation

        with tenant_context(endpoint.shop):
            if sku:
                item = ProductVariation.all_objects.filter(shop=endpoint.shop, sku=sku).first()
                if not item:
                    item = Product.all_objects.filter(shop=endpoint.shop, sku=sku).first()
            elif barcode:
                item = ProductVariation.all_objects.filter(shop=endpoint.shop, barcode=barcode).first()
                if not item:
                    item = Product.all_objects.filter(shop=endpoint.shop, barcode=barcode).first()
            else:
                # Return catalog inventory overview
                products = Product.all_objects.filter(shop=endpoint.shop, is_active=True)[:100]
                catalog_list = []
                for p in products:
                    levels = get_inventory_levels(p)
                    catalog_list.append(
                        {
                            "id": p.id,
                            "name": p.name,
                            "sku": p.sku,
                            "barcode": p.barcode or "",
                            "selling_price": float(p.selling_price),
                            "on_hand": float(levels["on_hand"]),
                            "reserved": float(levels["reserved"]),
                            "available": float(levels["available"]),
                            "in_stock": levels["available"] > 0,
                        }
                    )
                return Response(
                    {
                        "shop": endpoint.shop.name,
                        "channel": endpoint.integration.name,
                        "count": len(catalog_list),
                        "products": catalog_list,
                    }
                )

            if not item:
                return Response(
                    {"error": f"Product not found with identifier '{sku or barcode}'."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            levels = get_inventory_levels(item)
            return Response(
                {
                    "id": item.id,
                    "name": item.name if hasattr(item, "name") else item.product.name,
                    "sku": item.sku,
                    "barcode": getattr(item, "barcode", "") or "",
                    "selling_price": float(
                        item.selling_price if hasattr(item, "selling_price") else item.product.selling_price
                    ),
                    "on_hand": float(levels["on_hand"]),
                    "reserved": float(levels["reserved"]),
                    "available": float(levels["available"]),
                    "in_stock": levels["available"] > 0,
                }
            )


class WebhookEndpointViewSet(viewsets.ModelViewSet):
    """
    Tenant-scoped CRUD endpoints for registering and managing webhook endpoints.
    Restricted to Owners and Managers.
    """

    permission_classes = [
        permissions.IsAuthenticated,
        IsTenantMember,
        IsActiveTenant,
        CanManageIntegrations,
    ]
    serializer_class = WebhookEndpointSerializer

    def get_queryset(self):
        shop = getattr(self.request, "shop", None) or getattr(self.request.user, "shop", None)
        if not shop:
            return WebhookEndpoint.all_objects.none()
        return WebhookEndpoint.all_objects.filter(shop=shop).select_related("integration")

    def perform_create(self, serializer):
        integration = serializer.validated_data.get("integration")
        validate_tenant_boundary(shop=self.request.user.shop, integration=integration)
        serializer.save(shop=self.request.user.shop)

    def perform_update(self, serializer):
        integration = serializer.validated_data.get("integration")
        if integration:
            validate_tenant_boundary(shop=self.request.user.shop, integration=integration)
        serializer.save()


class IntegrationEventViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Tenant-scoped ReadOnly ViewSet for inspecting Integration Events,
    monitoring failed integrations, and executing manual retries (Phase 13).
    """
    permission_classes = [
        permissions.IsAuthenticated,
        IsTenantMember,
        IsActiveTenant,
        CanViewIntegrations,
    ]
    serializer_class = IntegrationEventSerializer

    def get_queryset(self):
        shop = getattr(self.request, "shop", None) or getattr(self.request.user, "shop", None)
        if not shop:
            return IntegrationEvent.all_objects.none()
        qs = IntegrationEvent.all_objects.filter(shop=shop)

        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param.lower())

        category_param = self.request.query_params.get("category")
        if category_param:
            qs = qs.filter(error_details__category=category_param.upper())

        integration_id = self.request.query_params.get("integration_id")
        if integration_id:
            qs = qs.filter(integration_id=integration_id)

        event_type = self.request.query_params.get("event_type")
        if event_type:
            qs = qs.filter(event_type=event_type)

        return qs.order_by("-updated_at")

    @action(detail=False, methods=["get"], url_path="failed")
    def failed_events(self, request):
        """
        Visibility endpoint listing all currently failed, retry, or permanently failed events.
        """
        qs = self.get_queryset().filter(
            status__in=[
                IntegrationEvent.Status.FAILED,
                IntegrationEvent.Status.RETRY,
                IntegrationEvent.Status.FAILED_PERMANENTLY,
                IntegrationEvent.Status.RETRY_LIMIT_REACHED,
            ]
        )
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="retry")
    def retry_event(self, request, pk=None):
        """
        Manual retry endpoint for an integration event.
        Guards against duplicate processing on already-successful events.
        """
        event = self.get_object()
        actor = getattr(request.user, "email", "Admin")
        force = request.data.get("force", False)

        from .recovery import manual_retry_event

        updated_event, executed, message = manual_retry_event(
            event_id=event.id,
            force=force,
            actor=actor,
        )

        serializer = self.get_serializer(updated_event)
        http_status = status.HTTP_200_OK if executed else status.HTTP_400_BAD_REQUEST
        return Response(
            {
                "success": executed,
                "message": message,
                "event": serializer.data,
                "event_id": updated_event.id,
            },
            status=http_status,
        )

