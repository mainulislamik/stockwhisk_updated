"""
External Order API ViewSets for StockWhisk Integration Platform (Phase 7).

Provides REST endpoints for querying, ingesting, and managing external eCommerce orders.
"""
import logging
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import ExternalOrder, Integration
from .order_engine import (
    OrderSyncError,
    MalformedOrderPayloadError,
    TenantAuthenticationError,
    UnmappedProductOrderError,
    InvalidQuantityError,
    InsufficientStockOrderError,
    ExternalAPIError,
    process_external_order,
    update_external_order_state,
    partially_cancel_order_reservation,
    StandardOrderDTO,
)
from .serializers import ExternalOrderSerializer
from .validators import CrossTenantBoundaryViolation

logger = logging.getLogger("integrations.orders")


class ExternalOrderViewSet(viewsets.ModelViewSet):
    """
    ViewSet for viewing and managing external eCommerce orders.
    Enforces tenant scoping via TenantScopedModel / get_queryset.
    """
    queryset = ExternalOrder.all_objects.all()
    serializer_class = ExternalOrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        from core.tenant_context import set_current_tenant
        if request.user and request.user.is_authenticated and hasattr(request.user, "shop") and request.user.shop:
            set_current_tenant(request.user.shop)

    def get_queryset(self):
        shop = getattr(self.request.user, "shop", None)
        if not shop:
            return ExternalOrder.all_objects.none()

        qs = ExternalOrder.all_objects.filter(shop=shop).select_related(
            "integration", "sale", "customer"
        )
        integration_id = self.request.query_params.get("integration")
        if integration_id:
            qs = qs.filter(integration_id=integration_id)

        sync_status = self.request.query_params.get("sync_status")
        if sync_status:
            qs = qs.filter(sync_status=sync_status)

        external_order_id = self.request.query_params.get("external_order_id")
        if external_order_id:
            qs = qs.filter(external_order_id=external_order_id)

        search = self.request.query_params.get("search")
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(external_order_id__icontains=search)
                | Q(external_order_number__icontains=search)
                | Q(customer_name__icontains=search)
                | Q(customer_phone__icontains=search)
            )

        return qs

    @action(detail=False, methods=["post"], url_path="ingest")
    def ingest_order(self, request):
        """
        Directly ingest an external order payload.
        Expected JSON:
        {
            "integration_id": "<uuid>",
            "order": { ... }
        }
        """
        shop = getattr(request.user, "shop", None)
        if not shop:
            return Response({"error": "No active shop found for user."}, status=status.HTTP_403_FORBIDDEN)

        integration_id = request.data.get("integration_id")
        order_data = request.data.get("order") or request.data.get("payload")

        if not integration_id:
            return Response(
                {"error": "Missing required field: integration_id"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not order_data or not isinstance(order_data, dict):
            return Response(
                {"error": "Missing or invalid 'order' payload object."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            integration = Integration.all_objects.get(id=integration_id, shop=shop)
        except Integration.DoesNotExist:
            return Response(
                {"error": f"Integration with id {integration_id} not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            external_order, created = process_external_order(
                shop=shop,
                integration=integration,
                order_payload=order_data,
            )
            serializer = self.get_serializer(external_order)
            return Response(
                {
                    "message": "Order processed successfully." if created else "Order already synchronized (idempotent).",
                    "created": created,
                    "order": serializer.data,
                },
                status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
            )
        except (TenantAuthenticationError, CrossTenantBoundaryViolation) as e:
            return Response({"error": str(e), "error_type": getattr(e, "error_type", "TenantViolation")}, status=status.HTTP_403_FORBIDDEN)
        except MalformedOrderPayloadError as e:
            return Response({"error": str(e), "error_type": e.error_type}, status=status.HTTP_400_BAD_REQUEST)
        except InvalidQuantityError as e:
            return Response({"error": str(e), "error_type": e.error_type}, status=status.HTTP_400_BAD_REQUEST)
        except UnmappedProductOrderError as e:
            return Response({"error": str(e), "error_type": e.error_type, "details": e.details}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
        except InsufficientStockOrderError as e:
            return Response({"error": str(e), "error_type": e.error_type, "details": e.details}, status=status.HTTP_409_CONFLICT)
        except OrderSyncError as e:
            return Response({"error": str(e), "error_type": e.error_type}, status=e.status_code)
        except Exception:
            logger.exception("Unexpected error during external order ingestion")
            return Response({"error": "An internal error occurred during order ingestion."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel_order(self, request, pk=None):
        """
        Manually trigger cancellation of external order:
        releases inventory reservation and marks internal Sale as CANCELLED.
        """
        external_order = self.get_object()
        dto = StandardOrderDTO(
            external_order_id=external_order.external_order_id,
            external_status="cancelled",
        )
        updated = update_external_order_state(external_order, dto)
        return Response(self.get_serializer(updated).data)

    @action(detail=True, methods=["post"], url_path="partial-cancel")
    def partial_cancel(self, request, pk=None):
        """
        Partially cancel an item reservation on an external order.
        Request body: {"product_id": 12, "quantity": "2.00", "reason": "Customer changed mind"}
        """
        from decimal import Decimal

        external_order = self.get_object()
        if not external_order.sale:
            return Response({"error": "No internal sale associated with order."}, status=status.HTTP_400_BAD_REQUEST)

        product_id = request.data.get("product_id")
        quantity = request.data.get("quantity")
        reason = request.data.get("reason", "Partial cancellation via API")

        if not product_id or not quantity:
            return Response({"error": "product_id and quantity are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            qty = Decimal(str(quantity))
            if qty <= 0:
                raise ValueError("Quantity must be positive.")
        except Exception:
            return Response({"error": "Invalid quantity."}, status=status.HTTP_400_BAD_REQUEST)

        res = partially_cancel_order_reservation(
            shop=external_order.shop,
            sale_id=str(external_order.sale.id),
            product_id=int(product_id),
            quantity=qty,
            reason=reason,
        )
        if not res:
            return Response({"error": "Active reservation not found for given product."}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            "message": f"Successfully released {qty} for product #{product_id}.",
            "reservation_id": res.id,
            "remaining_reserved_quantity": str(res.quantity),
            "status": res.status,
        })

    @action(detail=True, methods=["post"], url_path="commit")
    def commit_order(self, request, pk=None):
        """
        Commits an external order upon dispatch/completion:
        executes physical SALE_OUT stock movement and marks Sale as PAID.
        """
        external_order = self.get_object()
        dto = StandardOrderDTO(
            external_order_id=external_order.external_order_id,
            external_status="completed",
        )
        updated = update_external_order_state(external_order, dto)
        return Response(self.get_serializer(updated).data)
