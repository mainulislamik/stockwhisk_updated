from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from core.api import TenantScopedViewSet
from core.permissions import HasPermCode, IsTenantMember
from core.tenant_context import set_current_tenant

from .models import ServiceTicket, Warranty, WarrantyClaim
from .serializers import (
    ServiceTicketSerializer,
    TicketCreateSerializer,
    TicketPartInputSerializer,
    WarrantyClaimSerializer,
    WarrantySerializer,
)
from .services import (
    add_ticket_part,
    change_ticket_status,
    create_ticket,
    lookup_warranties,
)


class WarrantyViewSet(TenantScopedViewSet):
    serializer_class = WarrantySerializer
    # Viewing warranties/coverage only needs read access; editing/voiding needs
    # manage_service.
    required_perm = "view_service"
    required_write_perm = "manage_service"

    def get_queryset(self):
        from django.db.models import Q
        from django.utils import timezone
        qs = Warranty.objects.select_related("product", "customer")
        # Coverage only counts once the item is SOLD — hide warranties for units
        # still in stock (their clock hasn't started).
        qs = qs.filter(Q(sale_item__isnull=False) | Q(product_unit__status="sold"))
        # By default also hide ended (expired) and voided coverage — it drops off
        # automatically once the expiry date passes. ?include_expired=1 = full history.
        if self.request.query_params.get("include_expired") not in {"1", "true"}:
            qs = qs.filter(expiry_date__gte=timezone.localdate()).exclude(
                status=Warranty.Status.VOID)
        if search := self.request.query_params.get("search"):
            qs = qs.filter(
                Q(product__name__icontains=search) |
                Q(serial_no__icontains=search) |
                Q(customer__name__icontains=search)
            )
        return qs

    @action(detail=False, methods=["get"])
    def lookup(self, request):
        """Counter lookup by ?phone= or ?invoice_no= (staff only)."""
        qs = lookup_warranties(
            request.user.shop,
            phone=request.query_params.get("phone"),
            invoice_no=request.query_params.get("invoice_no"),
        )
        return Response(WarrantySerializer(qs, many=True).data)


class WarrantyClaimViewSet(TenantScopedViewSet):
    serializer_class = WarrantyClaimSerializer
    required_perm = "view_service"
    required_write_perm = "manage_service"

    def get_queryset(self):
        return WarrantyClaim.objects.select_related("warranty")


class ServiceTicketViewSet(TenantScopedViewSet):
    # Viewing repair tickets/status is read; create/edit/change-status needs
    # manage_service.
    required_perm = "view_service"
    required_write_perm = "manage_service"

    def get_queryset(self):
        return ServiceTicket.objects.select_related("customer", "technician").prefetch_related(
            "parts", "history"
        )

    def get_serializer_class(self):
        return TicketCreateSerializer if self.action == "create" else ServiceTicketSerializer

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        ticket = create_ticket(
            shop=request.user.shop, customer=d.get("customer"),
            customer_name=d.get("customer_name", ""), customer_phone=d.get("customer_phone", ""),
            device_description=d["device_description"], complaint=d["complaint"],
            service_charge=d.get("service_charge", 0),
            estimated_delivery=d.get("estimated_delivery"), created_by=request.user,
        )
        advance = d.get("advance_paid", 0)
        if advance > 0:
            from .services import collect_ticket_payment
            collect_ticket_payment(ticket, amount=advance, method="cash", received_by=request.user)
        return Response(ServiceTicketSerializer(ticket).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def change_status(self, request, pk=None):
        ticket = self.get_object()
        new_status = request.data.get("status")
        if new_status not in ServiceTicket.Status.values:
            return Response({"detail": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)
        change_ticket_status(
            ticket=ticket, new_status=new_status,
            note=request.data.get("note", ""), changed_by=request.user,
        )
        # Re-fetch so freshly created history/parts aren't hidden by the
        # prefetch cache captured in get_object().
        fresh = self.get_queryset().get(pk=ticket.pk)
        return Response(ServiceTicketSerializer(fresh).data)

    @action(detail=True, methods=["post"])
    def add_part(self, request, pk=None):
        ticket = self.get_object()
        ser = TicketPartInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        add_ticket_part(
            ticket=ticket, product=d["product"], quantity=d["quantity"],
            unit_cost=d.get("unit_cost"), unit_price=d.get("unit_price"),
            from_stock=d["from_stock"], created_by=request.user,
        )
        fresh = self.get_queryset().get(pk=ticket.pk)
        return Response(ServiceTicketSerializer(fresh).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def add_payment(self, request, pk=None):
        ticket = self.get_object()
        amount = request.data.get("amount")
        if not amount:
            return Response({"detail": "Amount is required."}, status=status.HTTP_400_BAD_REQUEST)
        from .services import collect_ticket_payment
        from decimal import Decimal
        try:
            collect_ticket_payment(ticket, amount=Decimal(amount), method="cash", received_by=request.user)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        fresh = self.get_queryset().get(pk=ticket.pk)
        return Response(ServiceTicketSerializer(fresh).data)


class ServiceDashboardView(APIView):
    permission_classes = [IsTenantMember, HasPermCode]
    required_perm = "view_service"

    def initial(self, request, *args, **kwargs):
        set_current_tenant(getattr(request.user, "shop", None))
        request.tenant = getattr(request.user, "shop", None)
        super().initial(request, *args, **kwargs)

    def get(self, request):
        from django.db.models import Count
        from django.utils import timezone

        shop = request.user.shop
        open_ticket_qs = ServiceTicket.objects.exclude(
            status__in=[ServiceTicket.Status.DELIVERED, ServiceTicket.Status.CANCELLED]
        )
        by_status = list(open_ticket_qs.values("status").annotate(n=Count("id")))
        overdue = open_ticket_qs.filter(
            estimated_delivery__lt=timezone.localdate()
        ).count()
        workload = list(
            open_ticket_qs.exclude(technician__isnull=True)
            .values("technician__email").annotate(n=Count("id"))
        )
        expiring = Warranty.objects.filter(status=Warranty.Status.EXPIRING_SOON).count()
        return Response({
            "open_by_status": by_status,
            "overdue_tickets": overdue,
            "technician_workload": workload,
            "warranties_expiring_soon": expiring,
        })
