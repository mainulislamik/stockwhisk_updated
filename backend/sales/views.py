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
        try:
            sale = create_sale(
                shop=request.user.shop,
                customer=data.get("customer"),
                discount=data.get("discount", 0),
                tax=data.get("tax", 0),
                note=data.get("note", ""),
                items=data["items"],
                payments=data.get("payments", []),
                created_by=request.user,
                is_emi=data.get("is_emi", False),
                emi_months=data.get("emi_months", 0),
                down_payment=data.get("down_payment", 0),
                emi_interest_percent=data.get("emi_interest_percent", 0),
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
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
        from sales.serializers import SaleSerializer
        
        # We need to find the SaleItem for this product
        sale_item = sale.items.filter(product=unit.product).first()
        if not sale_item:
            return Response({"detail": "Could not locate the sale item for this unit."}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "unit": ProductUnitSerializer(unit).data,
            "sale": SaleSerializer(sale).data,
            "sale_item_id": sale_item.id
        })

    @action(detail=False, methods=["post"], url_path="process-scan-return")
    def process_scan_return(self, request):
        try:
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
            sale_item = sale.items.filter(product=unit.product).first()
            if not sale_item:
                return Response({"detail": "Sale item not found."}, status=status.HTTP_400_BAD_REQUEST)

            restock = (action_type == "restock")

            # 1. Process the refund via create_return
            try:
                from decimal import Decimal
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
        except Exception as e:
            import traceback
            return Response({"detail": "Traceback: " + traceback.format_exc()}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=["post"], url_path="replace-unit")
    def replace_unit(self, request):
        if not request.user.has_perm_code("process_return"):
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)

        old_barcode = request.data.get("old_barcode", "").strip()
        new_barcode = request.data.get("new_barcode", "").strip()

        if not old_barcode or not new_barcode:
            return Response({"detail": "Both old and new barcodes are required."}, status=status.HTTP_400_BAD_REQUEST)

        from catalog.models import ProductUnit
        old_unit = ProductUnit.all_objects.filter(shop_id=request.user.shop_id, barcode=old_barcode).first()
        new_unit = ProductUnit.all_objects.filter(shop_id=request.user.shop_id, barcode=new_barcode).first()

        if not old_unit or not new_unit:
            return Response({"detail": "One or both barcodes not found."}, status=status.HTTP_400_BAD_REQUEST)

        if old_unit.status != ProductUnit.Status.SOLD or not old_unit.sale_id:
            return Response({"detail": f"Old unit must be SOLD. Current status: {old_unit.get_status_display()}"}, status=status.HTTP_400_BAD_REQUEST)

        if new_unit.status != ProductUnit.Status.IN_STOCK:
            return Response({"detail": f"New unit must be IN STOCK. Current status: {new_unit.get_status_display()}"}, status=status.HTTP_400_BAD_REQUEST)

        sale = old_unit.sale
        # ProductUnit is product-level (no variation), so match the sale line by product.
        old_sale_item = sale.items.filter(product=old_unit.product).first()
        
        if not old_sale_item:
            return Response({"detail": "Sale item for old unit not found on the invoice."}, status=status.HTTP_400_BAD_REQUEST)

        from django.db import transaction
        from django.utils import timezone
        
        with transaction.atomic():
            # Same product → a 1:1 unit swap.
            if old_unit.product_id == new_unit.product_id:
                old_unit.status = ProductUnit.Status.TESTING_PENDING
                old_unit.sale = None
                old_unit.sold_at = None
                old_unit.save(update_fields=["status", "sale", "sold_at"])

                new_unit.status = ProductUnit.Status.SOLD
                new_unit.sale = sale
                new_unit.sold_at = timezone.now()
                new_unit.save(update_fields=["status", "sale", "sold_at"])
                
                from service.models import Warranty
                warranty = Warranty.all_objects.filter(product_unit_id=old_unit.id).first()
                if warranty:
                    warranty.product_unit = new_unit
                    warranty.save(update_fields=["product_unit"])
                
                return Response({"detail": "Unit exchanged successfully (same product)."})

            else:
                from inventory.models import MovementType
                from inventory.services import apply_movement
                from .models import SaleItem
                from decimal import Decimal
                
                if old_sale_item.quantity <= Decimal("1"):
                    old_sale_item.delete()
                else:
                    old_sale_item.quantity -= Decimal("1")
                    old_sale_item.save()

                if old_unit.product.track_inventory:
                    apply_movement(
                        shop=sale.shop, product=old_unit.product, variation=None,
                        movement_type=MovementType.SALE_RETURN_IN, quantity=Decimal("1"),
                        unit_cost=old_sale_item.unit_cost, reference_type="Sale",
                        reference_id=sale.id, note="Exchange: return old unit", created_by=request.user
                    )
                
                old_unit.status = ProductUnit.Status.TESTING_PENDING
                old_unit.sale = None
                old_unit.sold_at = None
                old_unit.save(update_fields=["status", "sale", "sold_at"])
                
                new_sale_item = sale.items.filter(product=new_unit.product).first()
                if new_sale_item:
                    new_sale_item.quantity += Decimal("1")
                    new_sale_item.save()
                else:
                    unit_cost = new_unit.product.cost_price
                    new_sale_item = SaleItem.objects.create(
                        shop=sale.shop, sale=sale, product=new_unit.product, variation=None,
                        quantity=Decimal("1"), unit_price=new_unit.product.selling_price, unit_cost=unit_cost,
                        discount=Decimal("0")
                    )

                if new_unit.product.track_inventory:
                    apply_movement(
                        shop=sale.shop, product=new_unit.product, variation=None,
                        movement_type=MovementType.SALE_OUT, quantity=Decimal("1"),
                        unit_cost=new_sale_item.unit_cost, reference_type="Sale",
                        reference_id=sale.id, note="Exchange: sell new unit", created_by=request.user
                    )
                
                new_unit.status = ProductUnit.Status.SOLD
                new_unit.sale = sale
                new_unit.sold_at = timezone.now()
                new_unit.save(update_fields=["status", "sale", "sold_at"])
                
                months = new_unit.product.warranty_months or 0
                if months > 0:
                    from service.models import Warranty
                    Warranty.all_objects.create(
                        shop_id=sale.shop.id, product=new_unit.product, product_unit=new_unit,
                        customer=sale.customer, sale_item=new_sale_item,
                        serial_no=f"{sale.invoice_no}-{new_sale_item.id}-EXC",
                        period_months=months, start_date=timezone.localdate()
                    )

                subtotal = sum(item.subtotal for item in sale.items.all())
                total = subtotal - sale.discount + (sale.tax or Decimal("0"))
                
                old_total = sale.total or Decimal("0")
                sale.subtotal = subtotal
                sale.total = total
                
                from sales.services import _resolve_status
                sale.status = _resolve_status(total, sale.paid or Decimal("0"))
                sale.save(update_fields=["subtotal", "total", "status", "updated_at"])
                
                if sale.customer_id:
                    customer = sale.customer
                    customer.due_balance = (customer.due_balance or Decimal("0")) + (total - old_total)
                    customer.total_purchased = (customer.total_purchased or Decimal("0")) + (total - old_total)
                    customer.save(update_fields=["due_balance", "total_purchased"])

                return Response({"detail": "Unit exchanged with price adjustment.", "new_total": total})


class EMIScheduleViewSet(viewsets.ReadOnlyModelViewSet):
    """
    List and view EMI Schedules and process payments for installments.
    """
    from .serializers import EMIScheduleSerializer
    serializer_class = EMIScheduleSerializer

    def get_queryset(self):
        from .models import EMISchedule
        qs = EMISchedule.objects.all().select_related("sale", "customer").prefetch_related("installments")
        status = self.request.query_params.get("status")
        if status:
            qs = qs.filter(status=status)
        return qs

    @action(detail=True, methods=["post"], url_path="pay-installment/(?P<installment_id>[^/.]+)")
    def pay_installment(self, request, pk=None, installment_id=None):
        if not request.user.has_perm_code("process_payment"):
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)
            
        schedule = self.get_object()
        from .models import EMIInstallment
        try:
            installment = schedule.installments.get(id=installment_id)
        except EMIInstallment.DoesNotExist:
            return Response({"detail": "Installment not found."}, status=status.HTTP_404_NOT_FOUND)

        if installment.status == EMIInstallment.Status.PAID:
            return Response({"detail": "Installment is already paid."}, status=status.HTTP_400_BAD_REQUEST)

        amount = Decimal(request.data.get("amount", installment.amount - installment.paid_amount))
        if amount <= Decimal("0"):
            return Response({"detail": "Amount must be positive."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                installment.paid_amount += amount
                if installment.paid_amount >= installment.amount:
                    installment.status = EMIInstallment.Status.PAID
                else:
                    installment.status = EMIInstallment.Status.PARTIAL
                installment.paid_at = timezone.now()
                installment.save(update_fields=["paid_amount", "status", "paid_at"])

                # Check if schedule is fully paid
                if schedule.total_due <= Decimal("0"):
                    from .models import EMISchedule
                    schedule.status = EMISchedule.Status.COMPLETED
                    schedule.save(update_fields=["status"])

                # Also record as a payment against the sale
                from sales.services import add_payment
                add_payment(
                    sale=schedule.sale,
                    amount=amount,
                    method=request.data.get("method", "cash"),
                    created_by=request.user,
                )
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        # Refresh schedule to return updated data
        schedule.refresh_from_db()
        return Response(self.get_serializer(schedule).data)
