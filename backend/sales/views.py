from decimal import Decimal

from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import HasPermCode, IsTenantMember
from core.tenant_context import set_current_tenant

from .models import Sale
from .returns import create_return
from .serializers import (
    SaleCreateSerializer,
    SaleReturnInputSerializer,
    SaleReturnSerializer,
    SaleSerializer,
)
from .services import add_payment, cancel_sale, create_sale


class SaleViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin,
    mixins.CreateModelMixin, viewsets.GenericViewSet,
):
    permission_classes = [IsTenantMember, HasPermCode]
    required_perm = "create_sale"

    def initial(self, request, *args, **kwargs):
        set_current_tenant(getattr(request.user, "shop", None))
        request.tenant = getattr(request.user, "shop", None)
        super().initial(request, *args, **kwargs)

    def get_queryset(self):
        # items__product: the serializer reads product.name per line, so prefetch
        # the products too or it's an N+1 (one product query per sale line).
        qs = Sale.objects.select_related("customer").prefetch_related(
            "items__product", "payments", "units"
        )
        if s := self.request.query_params.get("status"):
            qs = qs.filter(status=s)
        if self.request.query_params.get("with_due") in {"1", "true"}:
            qs = qs.exclude(status__in=[Sale.Status.PAID, Sale.Status.CANCELLED])
        if search := self.request.query_params.get("search"):
            from django.db.models import Q
            qs = qs.filter(
                Q(invoice_no__icontains=search) |
                Q(customer_name__icontains=search) |
                Q(customer_phone__icontains=search) |
                Q(customer__name__icontains=search) |
                Q(customer__phone__icontains=search)
            )
        return qs

    def get_serializer_class(self):
        return SaleCreateSerializer if self.action == "create" else SaleSerializer

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        sale = create_sale(
            shop=request.user.shop,
            customer=data.get("customer"),
            discount=data.get("discount", 0),
            tax=data.get("tax", 0),
            note=data.get("note", ""),
            items=data["items"],
            payments=data.get("payments", []),
            created_by=request.user,
        )
        return Response(SaleSerializer(sale).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def add_payment(self, request, pk=None):
        sale = self.get_object()
        try:
            sale = add_payment(
                sale=sale, amount=Decimal(request.data.get("amount", 0)),
                method=request.data.get("method", "cash"), created_by=request.user,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(SaleSerializer(sale).data)

    @action(detail=True, methods=["post"], url_path="return")
    def return_items(self, request, pk=None):
        """Full/partial return, optionally with exchange items (8.4)."""
        if not request.user.has_perm_code("process_return"):
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)
        sale = self.get_object()
        ser = SaleReturnInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        lines = [{"sale_item": l["sale_item"], "quantity": l["quantity"]} for l in data["lines"]]
        try:
            sret, exchange, net = create_return(
                sale=sale, lines=lines, reason=data["reason"],
                refund_method=data["refund_method"],
                refund_reference=data["refund_reference"],
                restock=data["restock"],
                exchange_items=data.get("exchange_items") or None,
                created_by=request.user,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            "sale_return": SaleReturnSerializer(sret).data,
            "exchange_sale": SaleSerializer(exchange).data if exchange else None,
            "net_amount": net,
            "sale_status": sale.status,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        if not request.user.has_perm_code("delete_sale"):
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)
        sale = self.get_object()
        try:
            sale = cancel_sale(sale=sale, created_by=request.user)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(SaleSerializer(sale).data)

    @action(detail=False, methods=["get"], url_path="scan-return")
    def scan_return(self, request):
        barcode = request.query_params.get("barcode", "").strip()
        if not barcode:
            return Response({"detail": "Barcode is required."}, status=status.HTTP_400_BAD_REQUEST)

        from catalog.models import ProductUnit
        unit = ProductUnit.all_objects.filter(shop_id=request.user.shop_id, barcode=barcode).first()
        if not unit:
            return Response({"detail": "Barcode not found."}, status=status.HTTP_404_NOT_FOUND)
        if unit.status != ProductUnit.Status.SOLD or not unit.sale_id:
            return Response(
                {"detail": f"This unit is currently {unit.get_status_display()}, not sold."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        sale = unit.sale
        from catalog.serializers import ProductUnitSerializer
        
        # We need to find the SaleItem for this product/variation
        # For simplicity, we just filter by product and variation. If there are multiple, first is fine (they are identical items)
        sale_item = sale.items.filter(product=unit.product, variation=unit.variation).first()
        if not sale_item:
            return Response({"detail": "Could not locate the sale item for this unit."}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "unit": ProductUnitSerializer(unit).data,
            "sale": SaleSerializer(sale).data,
            "sale_item_id": sale_item.id
        })

    @action(detail=False, methods=["post"], url_path="process-scan-return")
    def process_scan_return(self, request):
        if not request.user.has_perm_code("process_return"):
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)

        barcode = request.data.get("barcode", "").strip()
        action_type = request.data.get("action", "restock")
        refund_method = request.data.get("refund_method", "cash")

        from catalog.models import ProductUnit
        unit = ProductUnit.all_objects.filter(shop_id=request.user.shop_id, barcode=barcode).first()
        if not unit or unit.status != ProductUnit.Status.SOLD or not unit.sale_id:
            return Response({"detail": "Invalid or unsold barcode."}, status=status.HTTP_400_BAD_REQUEST)

        sale = unit.sale
        sale_item = sale.items.filter(product=unit.product, variation=unit.variation).first()
        if not sale_item:
            return Response({"detail": "Sale item not found."}, status=status.HTTP_400_BAD_REQUEST)

        restock = (action_type == "restock")

        # 1. Process the refund via create_return
        try:
            lines = [{"sale_item": sale_item, "quantity": Decimal("1")}]
            create_return(
                sale=sale,
                lines=lines,
                reason=f"Barcode scan return: {action_type}",
                refund_method=refund_method,
                restock=restock,
                created_by=request.user
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Update the physical unit status
        if action_type == "restock":
            unit.status = ProductUnit.Status.IN_STOCK
            unit.sale = None
            unit.sold_at = None
        elif action_type == "defective":
            unit.status = ProductUnit.Status.DEFECTIVE
        elif action_type == "return_supplier":
            unit.status = ProductUnit.Status.RETURNED_SUPPLIER

        unit.save(update_fields=["status", "sale", "sold_at"])

        return Response({"detail": "Return processed successfully.", "new_status": unit.status})
