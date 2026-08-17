"""Report export endpoints (8.6). ?type=<report>&format=csv|excel|pdf."""
from django.utils.dateparse import parse_datetime
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasPermCode, IsTenantMember
from core.tenant_context import set_current_tenant

from .datasets import BUILDERS
from .exporters import export

from rest_framework.pagination import PageNumberPagination
from django.db.models import F, Value, CharField, DecimalField, IntegerField, Q
from django.db.models.functions import Cast, Coalesce
from django.db.models import DateField
from sales.models import SaleItem
from service.models import ServiceTicketPart, ServiceTicket


class ReportExportView(APIView):
    permission_classes = [IsTenantMember, HasPermCode]
    required_perm = "view_reports"

    def initial(self, request, *args, **kwargs):
        set_current_tenant(getattr(request.user, "shop", None))
        request.tenant = getattr(request.user, "shop", None)
        super().initial(request, *args, **kwargs)

    def get(self, request):
        report_type = request.query_params.get("type")
        # NB: 'format' is reserved by DRF content negotiation, so use a
        # distinct param name for the export file format.
        fmt = request.query_params.get("export_format", "csv")
        builder = BUILDERS.get(report_type)
        if builder is None:
            return Response(
                {"detail": f"Unknown report type. Options: {sorted(BUILDERS)}"},
                status=400,
            )
        start = parse_datetime(request.query_params.get("start", "") or "")
        end = parse_datetime(request.query_params.get("end", "") or "")
        title, columns, rows = builder(request.user.shop, start=start, end=end)
        return export(fmt, title, columns, rows)


class ReportCatalogView(APIView):
    """List available report types."""

    permission_classes = [IsTenantMember]

    def get(self, request):
        return Response({"reports": sorted(BUILDERS), "formats": ["csv", "excel", "pdf"]})

class SellingDetailsView(APIView):
    permission_classes = [IsTenantMember]

    def get(self, request):
        shop = getattr(request.user, "shop", None)
        search = request.query_params.get("search", "")
        
        q1 = SaleItem.objects.filter(sale__shop=shop).annotate(
            record_type=Value("sale", CharField()),
            ref_id=F("sale__id"),
            invoice=Coalesce(F("sale__invoice_no"), Value("", CharField())),
            customer=Coalesce(F("sale__customer_name"), Value("Walk-in", CharField())),
            date=Cast("sale__sale_date", DateField()),
            pname=Coalesce(F("product__name"), Value("", CharField())),
            qty=Cast("quantity", DecimalField()),
            price=Cast("unit_price", DecimalField()),
            disc=Cast("discount", DecimalField()),
            sub=Cast("subtotal", DecimalField()),
        ).values("record_type", "ref_id", "invoice", "customer", "date", "pname", "qty", "price", "disc", "sub")

        if search:
            q1 = q1.filter(
                Q(invoice__icontains=search) | 
                Q(customer__icontains=search) | 
                Q(pname__icontains=search)
            )

        q2 = ServiceTicketPart.objects.filter(ticket__shop=shop, ticket__status="delivered").annotate(
            record_type=Value("ticket", CharField()),
            ref_id=F("ticket__id"),
            invoice=Coalesce(F("ticket__ticket_no"), Value("", CharField())),
            customer=Coalesce(F("ticket__customer_name"), Value("Walk-in", CharField())),
            date=Cast("ticket__updated_at", DateField()),
            pname=Coalesce(F("product__name"), Value("", CharField())),
            qty=Cast("quantity", DecimalField()),
            price=Cast("unit_price", DecimalField()),
            disc=Value(0, DecimalField()),
            sub=Cast(F("quantity") * F("unit_price"), DecimalField()),
        ).values("record_type", "ref_id", "invoice", "customer", "date", "pname", "qty", "price", "disc", "sub")

        if search:
            q2 = q2.filter(
                Q(invoice__icontains=search) | 
                Q(customer__icontains=search) | 
                Q(pname__icontains=search)
            )

        q3 = ServiceTicket.objects.filter(shop=shop, status="delivered", service_charge__gt=0).annotate(
            record_type=Value("ticket", CharField()),
            ref_id=F("id"),
            invoice=Coalesce(F("ticket_no"), Value("", CharField())),
            customer=Coalesce(F("customer_name"), Value("Walk-in", CharField())),
            date=Cast("updated_at", DateField()),
            pname=Value("Service Charge", CharField()),
            qty=Value(1, DecimalField()),
            price=Cast("service_charge", DecimalField()),
            disc=Coalesce(Cast("discount", DecimalField()), Value(0, DecimalField())),
            sub=Cast(F("service_charge") - Coalesce(F("discount"), Value(0, DecimalField())), DecimalField()),
        ).values("record_type", "ref_id", "invoice", "customer", "date", "pname", "qty", "price", "disc", "sub")

        if search:
            q3 = q3.filter(
                Q(invoice__icontains=search) | 
                Q(customer__icontains=search)
            )

        combined = q1.union(q2, q3).order_by("-date", "-ref_id")

        paginator = PageNumberPagination()
        paginator.page_size = 25
        page = paginator.paginate_queryset(combined, request)
        
        # We can format it similarly to the frontend's flattened row format:
        # { saleId: number; invoice: string; customer: string; date: string; item: { product_name, quantity, unit_price, discount, subtotal } }
        formatted = []
        for row in page:
            formatted.append({
                "saleId": row["ref_id"],
                "type": row["record_type"],
                "invoice": row["invoice"],
                "customer": row["customer"],
                "date": row["date"],
                "item": {
                    "id": f"{row['record_type']}-{row['ref_id']}-{row['pname']}",
                    "product_name": row["pname"],
                    "quantity": str(row["qty"]),
                    "unit_price": str(row["price"]),
                    "discount": str(row["disc"]),
                    "subtotal": str(row["sub"]),
                }
            })

        return paginator.get_paginated_response(formatted)
