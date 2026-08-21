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

    def destroy(self, request, *args, **kwargs):
        from django.db.models import ProtectedError
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "Cannot delete this supplier because they have existing purchase orders, products, or payment records."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["post"], url_path="pay-due")
    def pay_due(self, request, pk=None):
        supplier = self.get_object()
        amount = request.data.get("amount")
        method = request.data.get("method", "cash")
        note = request.data.get("note", "")

        if not amount:
            return Response({"detail": "Amount is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from decimal import Decimal
            amount = Decimal(str(amount))
            from .services import pay_supplier
            pay_supplier(
                supplier=supplier, amount=amount, method=method,
                note=note, created_by=request.user
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        supplier.refresh_from_db()
        return Response(self.get_serializer(supplier).data)

    @action(detail=True, methods=["get"], url_path="statement")
    def statement(self, request, pk=None):
        """Chronological ledger statement of purchase orders and dues for this supplier."""
        supplier = self.get_object()
        pos = PurchaseOrder.objects.filter(supplier=supplier).order_by("-order_date")
        po_data = [
            {
                "type": "PURCHASE_ORDER",
                "id": po.id,
                "po_number": po.po_number,
                "date": po.order_date,
                "status": po.status,
                "total": po.total,
                "paid": po.paid,
                "due": po.due,
            }
            for po in pos
        ]
        return Response({
            "supplier": self.get_serializer(supplier).data,
            "transactions": po_data,
        })


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
        """Receive the PO into stock. Body: {"paid": <amount>, "method": <cash|bank|...>}."""
        from django.db import IntegrityError

        po = self.get_object()
        try:
            po = receive_purchase_order(
                po=po, paid=Decimal(request.data.get("paid", 0)),
                payment_method=request.data.get("method", "cash"),
                created_by=request.user,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except IntegrityError:
            return Response(
                {"detail": "A barcode in this batch already exists in stock. "
                           "Please use unique barcodes and try again."},
                status=status.HTTP_400_BAD_REQUEST)
        return Response(PurchaseOrderSerializer(po).data)

    @action(detail=True, methods=["post"], url_path="return")
    def process_return(self, request, pk=None):
        """Return goods from a received PO to supplier. Body: {"lines": [{"item_id": 1, "quantity": 2}], "reason": "...", "refund_amount": 1000}."""
        from .services import create_purchase_return
        po = self.get_object()
        lines = request.data.get("lines", [])
        if not lines:
            return Response({"detail": "Return lines are required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            val = create_purchase_return(
                po=po, lines=lines, reason=request.data.get("reason", ""),
                refund_amount=request.data.get("refund_amount"), created_by=request.user,
            )
            return Response({"detail": "Purchase return processed successfully.", "total_returned": float(val)})
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
