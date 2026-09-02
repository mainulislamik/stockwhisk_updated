from decimal import Decimal
from django.db.models import Sum, Q
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from core.api import TenantScopedViewSet
from core.permissions import HasPermCode, IsTenantMember
from .models import BatchStatus, ProductionBatch
from .serializers import (
    ProductionBatchCancelSerializer,
    ProductionBatchCompleteSerializer,
    ProductionBatchCreateSerializer,
    ProductionBatchSerializer,
)
from .services import (
    cancel_production_batch,
    complete_production_batch,
    start_production_batch,
)


class ProductionBatchViewSet(TenantScopedViewSet):
    """
    CRUD and lifecycle operations for 2-step dynamic yield production batches.
    """
    serializer_class = ProductionBatchSerializer
    required_perm = "view_inventory"
    required_write_perm = "manage_inventory"

    def get_queryset(self):
        qs = ProductionBatch.objects.select_related(
            "output_product", "output_product__unit", "output_variation", "created_by", "completed_by"
        ).prefetch_related("materials__product", "materials__product__unit", "materials__variation")

        if st := self.request.query_params.get("status"):
            qs = qs.filter(status=st)

        if q := self.request.query_params.get("q"):
            q_clean = q.strip()
            qs = qs.filter(
                Q(batch_number__icontains=q_clean)
                | Q(output_product__name__icontains=q_clean)
                | Q(notes__icontains=q_clean)
            )

        return qs

    def create(self, request, *args, **kwargs):
        shop = getattr(request.user, "shop", None)
        if not shop:
            return Response({"detail": "No tenant found."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ProductionBatchCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        batch = start_production_batch(
            shop=shop,
            user=request.user,
            materials_data=data["materials"],
            notes=data.get("notes", ""),
            additional_cost=data.get("additional_cost", 0),
            additional_cost_note=data.get("additional_cost_note", ""),
        )

        read_serializer = self.get_serializer(batch)
        return Response(read_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        batch = self.get_object()
        serializer = ProductionBatchCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        completed_batch = complete_production_batch(
            batch=batch,
            output_product_id=data["output_product_id"],
            output_quantity=data["output_quantity"],
            output_variation_id=data.get("output_variation_id"),
            additional_cost=data.get("additional_cost"),
            additional_cost_note=data.get("additional_cost_note"),
            update_product_cost=data.get("update_product_cost", True),
            user=request.user,
        )

        read_serializer = self.get_serializer(completed_batch)
        return Response(read_serializer.data)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        batch = self.get_object()
        serializer = ProductionBatchCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        cancelled_batch = cancel_production_batch(
            batch=batch,
            reason=serializer.validated_data.get("reason", ""),
            user=request.user,
        )

        read_serializer = self.get_serializer(cancelled_batch)
        return Response(read_serializer.data)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        qs = self.get_queryset()
        in_progress_count = qs.filter(status=BatchStatus.IN_PROGRESS).count()
        completed_count = qs.filter(status=BatchStatus.COMPLETED).count()
        total_produced = qs.filter(status=BatchStatus.COMPLETED).aggregate(
            total=Sum("output_quantity")
        )["total"] or Decimal("0.00")
        total_material_cost = qs.filter(status=BatchStatus.COMPLETED).aggregate(
            total=Sum("total_material_cost")
        )["total"] or Decimal("0.00")

        return Response({
            "in_progress_count": in_progress_count,
            "completed_count": completed_count,
            "total_units_produced": total_produced,
            "total_material_cost_utilized": total_material_cost,
        })
