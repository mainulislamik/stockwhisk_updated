from datetime import timedelta

from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.response import Response

from core.api import TenantScopedViewSet

from .models import Customer
from .serializers import CustomerSerializer


class CustomerViewSet(TenantScopedViewSet):
    serializer_class = CustomerSerializer
    # Viewing customers, dues and balances only needs read access; creating/
    # editing/deleting a customer and recording a due payment (pay-due) still
    # need manage_customers.
    required_perm = "view_customers"
    required_write_perm = "manage_customers"
    required_module = "sales_crm"

    def get_queryset(self):
        qs = Customer.objects.all()
        params = getattr(self.request, "query_params", getattr(self.request, "GET", {}))
        if segment := params.get("segment"):
            qs = qs.filter(segment=segment)
        if params.get("with_due") in {"1", "true"}:
            qs = qs.filter(due_balance__gt=0)
        if search := params.get("search"):
            from django.db.models import Q
            qs = qs.filter(Q(name__icontains=search) | Q(phone__icontains=search))
        return qs

    @action(detail=False, methods=["get"], url_path="export")
    def export_customers(self, request):
        from core.export_utils import generate_csv_response
        headers = ["ID", "গ্রাহকের নাম / Name", "মোবাইল / Phone", "ঠিকানা / Address", "সেগমেন্ট", "বকেয়া / Due", "অগ্রিম ব্যালেন্স / Advance", "মোট কেনাকাটা / Total Purchased"]
        rows = []
        for c in self.get_queryset():
            rows.append([
                c.id,
                c.name,
                c.phone or "—",
                c.address or "—",
                c.segment or "general",
                c.due_balance,
                c.advance_balance,
                c.total_purchased,
            ])
        return generate_csv_response("customers_export.csv", headers, rows)

    def create(self, request, *args, **kwargs):
        phone = request.data.get("phone", "").strip()
        if phone:
            existing = self.get_queryset().filter(phone=phone).first()
            if existing:
                from rest_framework import status
                serializer = self.get_serializer(existing)
                return Response(serializer.data, status=status.HTTP_200_OK)
        return super().create(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        from django.db.models import ProtectedError
        from rest_framework import status
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "Cannot delete this customer because they have existing transaction or payment records. You can deactivate them instead."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"], url_path="dues-total")
    def dues_total(self, request):
        """Sum of all outstanding dues (for the Dues page header, independent of
        which page is shown)."""
        from django.db.models import Sum
        total = Customer.objects.filter(due_balance__gt=0).aggregate(t=Sum("due_balance"))["t"] or 0
        return Response({"total": total})

    @action(detail=False, methods=["get"])
    def inactive(self, request):
        """Customers with no purchase in N (default 60) days."""
        days = int(request.query_params.get("days", 60))
        cutoff = timezone.now() - timedelta(days=days)
        qs = self.get_queryset().filter(last_purchase_at__lt=cutoff)
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=False, methods=["get"], url_path="birthdays")
    def birthdays(self, request):
        """Customers with birthdays in the current (or given) month."""
        month = int(request.query_params.get("month", timezone.now().month))
        qs = self.get_queryset().filter(date_of_birth__month=month)
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=False, methods=["get"], url_path="anniversaries")
    def anniversaries(self, request):
        """Customers with anniversaries in the current (or given) month."""
        month = int(request.query_params.get("month", timezone.now().month))
        qs = self.get_queryset().filter(anniversary_date__month=month)
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=True, methods=["post"], url_path="pay-due")
    def pay_due(self, request, pk=None):
        customer = self.get_object()
        amount = request.data.get("amount")
        method = request.data.get("method", "cash")
        note = request.data.get("note", "")

        if not amount:
            from rest_framework import status
            return Response({"detail": "Amount is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from decimal import Decimal
            amount = Decimal(str(amount))
            from .services import pay_customer_due
            pay_customer_due(
                customer=customer, amount=amount, method=method,
                note=note, created_by=request.user
            )
        except Exception as e:
            from rest_framework import status
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        customer.refresh_from_db()
        return Response(self.get_serializer(customer).data)

    @action(detail=True, methods=["post"], url_path="receive-payment")
    def receive_payment(self, request, pk=None):
        return self.pay_due(request, pk=pk)

    @action(detail=True, methods=["get"], url_path="statement")
    def statement(self, request, pk=None):
        """Chronological ledger statement of sales and payments for this customer with running balance."""
        customer = self.get_object()
        from sales.models import Sale
        from .models import CustomerPayment
        import dateutil.parser

        from_date = request.query_params.get("from_date")
        to_date = request.query_params.get("to_date")

        sales_qs = Sale.objects.filter(customer=customer)
        payments_qs = CustomerPayment.objects.filter(customer=customer)

        if from_date:
            try:
                dt_from = dateutil.parser.parse(from_date)
                sales_qs = sales_qs.filter(sale_date__gte=dt_from)
                payments_qs = payments_qs.filter(payment_date__gte=dt_from)
            except Exception:
                pass
        if to_date:
            try:
                dt_to = dateutil.parser.parse(to_date)
                sales_qs = sales_qs.filter(sale_date__lte=dt_to)
                payments_qs = payments_qs.filter(payment_date__lte=dt_to)
            except Exception:
                pass

        entries = []
        for s in sales_qs:
            entries.append({
                "type": "INVOICE",
                "id": s.id,
                "ref_no": s.invoice_no,
                "date": s.sale_date,
                "description": f"Invoice #{s.invoice_no} ({s.status})",
                "debit": float(s.total or 0),
                "credit": float(s.paid or 0),
                "due": float(s.due or 0),
            })

        for p in payments_qs:
            entries.append({
                "type": "PAYMENT",
                "id": p.id,
                "ref_no": f"PAY-{p.id}",
                "date": p.payment_date,
                "description": f"Due Payment ({p.get_method_display()}) {p.note}".strip(),
                "debit": 0.0,
                "credit": float(p.amount or 0),
                "due": 0.0,
            })

        # Sort chronologically
        entries.sort(key=lambda x: x["date"])

        # Calculate running balance
        running_due = 0.0
        for item in entries:
            # Sale increases due by (total - paid); direct payment decreases due by amount
            if item["type"] == "INVOICE":
                running_due += (item["debit"] - item["credit"])
            elif item["type"] == "PAYMENT":
                running_due -= item["credit"]
            item["running_balance"] = round(running_due, 2)

        return Response({
            "customer": self.get_serializer(customer).data,
            "summary": {
                "total_purchased": float(customer.total_purchased or 0),
                "current_due": float(customer.due_balance or 0),
                "advance_balance": float(customer.advance_balance or 0),
                "total_transactions": len(entries),
            },
            "transactions": entries,
        })
