"""
Product Channel Mapping ViewSet for StockWhisk Integrations (Phase 5).

Provides REST endpoints for:
- Mapping list & CRUD (/api/integrations/mappings/)
- Search mapping (/api/integrations/mappings/search/?...)
- Disconnect mapping (/api/integrations/mappings/{id}/disconnect/)
- Unmapped products (/api/integrations/mappings/unmapped/?integration_id=...)
- Conflicting mappings audit (/api/integrations/mappings/conflicts/?integration_id=...)
"""
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.tenant_context import set_current_tenant
from .mapping_services import (
    create_or_update_product_mapping,
    detect_conflicting_mappings,
    disconnect_product_mapping,
    get_unmapped_products,
    search_product_mapping,
    MappingConflictError,
    MappingValidationError,
)
from .models import Integration, ProductChannelMapping
from .permissions import CanManageIntegrations, CanViewIntegrations, IsActiveTenant
from .serializers import ProductChannelMappingSerializer
from .validators import validate_tenant_boundary


class ProductChannelMappingViewSet(viewsets.ModelViewSet):
    """
    Tenant-scoped ViewSet for managing mappings between StockWhisk products
    and external channel items.
    """
    serializer_class = ProductChannelMappingSerializer
    permission_classes = [IsAuthenticated, IsActiveTenant, CanViewIntegrations]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.user and request.user.is_authenticated and hasattr(request.user, "shop"):
            set_current_tenant(request.user.shop)

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated or not hasattr(user, "shop") or not user.shop:
            return ProductChannelMapping.all_objects.none()
        return ProductChannelMapping.all_objects.filter(shop=user.shop)

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy", "disconnect"]:
            return [IsAuthenticated(), IsActiveTenant(), CanManageIntegrations()]
        return super().get_permissions()

    def perform_create(self, serializer):
        user = self.request.user
        integration = serializer.validated_data.get("integration")
        product = serializer.validated_data.get("product")
        variation = serializer.validated_data.get("variation")

        # Multi-tenant and object boundary validation
        validate_tenant_boundary(shop=user.shop, integration=integration, product=product)

        try:
            mapping, _ = create_or_update_product_mapping(
                shop=user.shop,
                integration=integration,
                product=product,
                variation=variation,
                external_product_id=serializer.validated_data.get("external_product_id"),
                external_variation_id=serializer.validated_data.get("external_variation_id", ""),
                external_sku=serializer.validated_data.get("external_sku", ""),
                is_sync_enabled=serializer.validated_data.get("is_sync_enabled", True),
                metadata=serializer.validated_data.get("metadata", {}),
            )
            serializer.instance = mapping
        except MappingConflictError as exc:
            raise ValidationError({"conflict": str(exc)})
        except (MappingValidationError, ValidationError) as exc:
            raise ValidationError({"error": str(exc)})

    def perform_update(self, serializer):
        user = self.request.user
        integration = serializer.validated_data.get("integration") or serializer.instance.integration
        product = serializer.validated_data.get("product") or serializer.instance.product
        validate_tenant_boundary(shop=user.shop, integration=integration, product=product)
        serializer.save()

    def perform_destroy(self, instance):
        disconnect_product_mapping(shop=self.request.user.shop, mapping_id=instance.id, soft=False)

    @action(detail=True, methods=["post"], url_path="disconnect")
    def disconnect(self, request, pk=None):
        """Disconnect mapping without deleting row (soft disconnect)."""
        mapping = self.get_object()
        try:
            disconnect_product_mapping(shop=request.user.shop, mapping_id=mapping.id, soft=True)
            return Response({"status": "disconnected", "id": mapping.id})
        except Exception as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["get"], url_path="search")
    def search(self, request):
        """
        Search for mapping by external IDs, SKU, or StockWhisk Product ID.
        """
        integration_id = request.query_params.get("integration_id")
        if not integration_id:
            return Response(
                {"error": "integration_id query parameter is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        integration = Integration.all_objects.filter(shop=request.user.shop, id=integration_id).first()
        if not integration:
            return Response({"error": "Integration not found"}, status=status.HTTP_404_NOT_FOUND)

        ext_prod_id = request.query_params.get("external_product_id")
        ext_var_id = request.query_params.get("external_variation_id")
        sku = request.query_params.get("sku")
        product_id = request.query_params.get("product_id")
        variation_id = request.query_params.get("variation_id")

        mapping = search_product_mapping(
            shop=request.user.shop,
            integration=integration,
            external_product_id=ext_prod_id,
            external_variation_id=ext_var_id,
            sku=sku,
            product_id=int(product_id) if product_id else None,
            variation_id=int(variation_id) if variation_id else None,
        )

        if not mapping:
            return Response({"matched": False, "mapping": None}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            "matched": True,
            "mapping": ProductChannelMappingSerializer(mapping).data,
        })

    @action(detail=False, methods=["get"], url_path="unmapped")
    def unmapped(self, request):
        """List products in this shop that have no active mapping in the channel."""
        integration_id = request.query_params.get("integration_id")
        if not integration_id:
            return Response(
                {"error": "integration_id query parameter is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        integration = Integration.all_objects.filter(shop=request.user.shop, id=integration_id).first()
        if not integration:
            return Response({"error": "Integration not found"}, status=status.HTTP_404_NOT_FOUND)

        unmapped_items = get_unmapped_products(shop=request.user.shop, integration=integration)
        return Response({"count": len(unmapped_items), "results": unmapped_items})

    @action(detail=False, methods=["get"], url_path="conflicts")
    def conflicts(self, request):
        """Audit existing mappings to detect duplicate external SKUs or conflicting IDs."""
        integration_id = request.query_params.get("integration_id")
        if not integration_id:
            return Response(
                {"error": "integration_id query parameter is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        integration = Integration.all_objects.filter(shop=request.user.shop, id=integration_id).first()
        if not integration:
            return Response({"error": "Integration not found"}, status=status.HTTP_404_NOT_FOUND)

        conflicts_list = detect_conflicting_mappings(shop=request.user.shop, integration=integration)
        return Response({"count": len(conflicts_list), "conflicts": conflicts_list})

    @action(detail=True, methods=["post"], url_path="sync-inventory")
    def sync_inventory(self, request, pk=None):
        """Immediately triggers inventory synchronization for this mapping."""
        mapping = self.get_object()
        from .inventory_engine import sync_product_inventory
        result = sync_product_inventory(mapping)
        return Response({
            "mapping_id": mapping.id,
            "status": result.status,
            "success": result.success,
            "error_type": result.error_type,
            "error_message": result.error_message,
        })

    @action(detail=True, methods=["post"], url_path="sync-stock")
    def sync_stock(self, request, pk=None):
        """Alias for sync-inventory."""
        return self.sync_inventory(request, pk=pk)

