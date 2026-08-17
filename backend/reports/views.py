"""Report export endpoints (8.6). ?type=<report>&format=csv|excel|pdf."""
from django.utils.dateparse import parse_datetime
from rest_framework.response import Response
from rest_framework.views import APIView
from decimal import Decimal

from core.permissions import HasPermCode, IsTenantMember
from core.tenant_context import set_current_tenant
from django.db.models import Q

from .datasets import BUILDERS
from .exporters import export


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
    """Unified cash-flow: POS sale items + delivered repair ticket parts + service charges.
    Uses Python-level merging (not DB UNION) to avoid type-mismatch 500 errors across
    different database engines.
    """
    permission_classes = [IsTenantMember]

    def get(self, request):
        from sales.models import SaleItem
        from service.models import ServiceTicketPart, ServiceTicket

        shop = getattr(request.user, "shop", None)
        search = request.query_params.get("search", "").strip()

        rows = []

        # ---- 1. POS Sale Items -----------------------------------------------
        sale_items = SaleItem.objects.filter(
            sale__shop=shop
        ).select_related("sale", "product").order_by("-sale__sale_date", "-sale__id")

        if search:
            sale_items = sale_items.filter(
                Q(sale__invoice_no__icontains=search) |
                Q(sale__customer_name__icontains=search) |
                Q(product__name__icontains=search)
            )

        for si in sale_items:
            rows.append({
                "record_type": "sale",
                "ref_id": si.sale_id,
                "invoice": si.sale.invoice_no or f"#{si.sale_id}",
                "customer": si.sale.customer_name or "Walk-in",
                "date": str(si.sale.sale_date)[:10] if si.sale.sale_date else "",
                "pname": si.product.name if si.product else "",
                "qty": si.quantity,
                "price": si.unit_price,
                "disc": si.discount,
                "sub": si.subtotal,
            })

        # ---- 2. Delivered Ticket Parts ---------------------------------------
        ticket_parts = ServiceTicketPart.objects.filter(
            ticket__shop=shop, ticket__status="delivered"
        ).select_related("ticket", "product").order_by("-ticket__updated_at", "-ticket__id")

        if search:
            ticket_parts = ticket_parts.filter(
                Q(ticket__ticket_no__icontains=search) |
                Q(ticket__customer_name__icontains=search) |
                Q(product__name__icontains=search)
            )

        for tp in ticket_parts:
            rows.append({
                "record_type": "ticket",
                "ref_id": tp.ticket_id,
                "invoice": tp.ticket.ticket_no or f"#{tp.ticket_id}",
                "customer": tp.ticket.customer_name or "Walk-in",
                "date": str(tp.ticket.updated_at)[:10] if tp.ticket.updated_at else "",
                "pname": tp.product.name if tp.product else "",
                "qty": tp.quantity,
                "price": tp.unit_price,
                "disc": Decimal("0"),
                "sub": (tp.quantity or Decimal("0")) * (tp.unit_price or Decimal("0")),
            })

        # ---- 3. Delivered Ticket Service Charges ----------------------------
        try:
            tickets_with_svc = ServiceTicket.objects.filter(
                shop=shop, status="delivered", service_charge__gt=0
            ).only("id", "ticket_no", "customer_name", "service_charge", "updated_at").order_by("-updated_at", "-id")

            if search:
                tickets_with_svc = tickets_with_svc.filter(
                    Q(ticket_no__icontains=search) |
                    Q(customer_name__icontains=search)
                )

            for t in tickets_with_svc:
                svc = t.service_charge or Decimal("0")
                # discount may not exist yet if migration not applied - use getattr safely
                disc = getattr(t, "discount", None) or Decimal("0")
                rows.append({
                    "record_type": "ticket",
                    "ref_id": t.id,
                    "invoice": t.ticket_no or f"#{t.id}",
                    "customer": t.customer_name or "Walk-in",
                    "date": str(t.updated_at)[:10] if t.updated_at else "",
                    "pname": "Service Charge",
                    "qty": Decimal("1"),
                    "price": svc,
                    "disc": disc,
                    "sub": max(Decimal("0"), svc - disc),
                })
        except Exception:
            pass  # if discount column missing, skip service charge rows gracefully


        # ---- Sort newest first -----------------------------------------------
        rows.sort(key=lambda r: (r["date"], r["ref_id"]), reverse=True)

        # ---- Python pagination -----------------------------------------------
        try:
            page_num = int(request.query_params.get("page", 1))
        except (ValueError, TypeError):
            page_num = 1
        try:
            page_size = int(request.query_params.get("page_size", 25))
        except (ValueError, TypeError):
            page_size = 25

        total = len(rows)
        start_idx = (page_num - 1) * page_size
        end_idx = start_idx + page_size
        page_rows = rows[start_idx:end_idx]

        # ---- Format for frontend ---------------------------------------------
        formatted = []
        for i, row in enumerate(page_rows):
            unique_key = f"{row['record_type']}-{row['ref_id']}-{row['pname']}-{start_idx + i}"
            formatted.append({
                "saleId": row["ref_id"],
                "type": row["record_type"],
                "invoice": row["invoice"],
                "customer": row["customer"],
                "date": row["date"],
                "item": {
                    "id": unique_key,
                    "product_name": row["pname"],
                    "quantity": str(row["qty"]),
                    "unit_price": str(row["price"]),
                    "discount": str(row["disc"]),
                    "subtotal": str(row["sub"]),
                },
            })

        base_url = request.build_absolute_uri(request.path)
        qs = request.query_params.copy()

        def make_url(p):
            qs["page"] = str(p)
            return f"{base_url}?{'&'.join(f'{k}={v}' for k, v in qs.items())}"

        return Response({
            "count": total,
            "next": make_url(page_num + 1) if end_idx < total else None,
            "previous": make_url(page_num - 1) if page_num > 1 else None,
            "results": formatted,
        })
