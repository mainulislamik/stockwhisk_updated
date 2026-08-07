from decimal import Decimal

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from core.api import TenantScopedViewSet

from .models import PurchaseOrder, Supplier
from .serializers import (
    PurchaseOrderCreateSerializer,
    PurchaseOrderSerializer,
    SupplierSerializer,
)
from .services import create_purchase_order, receive_purchase_order


class SupplierViewSet(TenantScopedViewSet):
    serializer_class = SupplierSerializer
    required_perm = "manage_purchasing"

    def get_queryset(self):
        qs = Supplier.objects.all()
        if search := self.request.query_params.get("search"):
            from django.db.models import Q
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(phone__icontains=search) |
                Q(email__icontains=search)
            )
        return qs


class PurchaseOrderViewSet(TenantScopedViewSet):
    required_perm = "manage_purchasing"

    def get_queryset(self):
        return PurchaseOrder.objects.select_related("supplier").prefetch_related("items")

    def get_serializer_class(self):
        if self.action == "create":
            return PurchaseOrderCreateSerializer
        return PurchaseOrderSerializer

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        po = create_purchase_order(
            shop=request.user.shop,
            supplier=data["supplier"],
            branch=data.get("branch"),
            discount=data.get("discount", 0),
            note=data.get("note", ""),
            items=data["items"],
            created_by=request.user,
        )
        return Response(PurchaseOrderSerializer(po).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def receive(self, request, pk=None):
        """Receive the PO into stock. Body: {"paid": <amount>}."""
        po = self.get_object()
        try:
            po = receive_purchase_order(
                po=po, paid=Decimal(request.data.get("paid", 0)),
                created_by=request.user,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PurchaseOrderSerializer(po).data)
