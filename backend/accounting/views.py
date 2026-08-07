from django.utils.dateparse import parse_datetime
from rest_framework.response import Response
from rest_framework.views import APIView

from core.api import TenantScopedViewSet
from core.permissions import HasPermCode, IsTenantMember
from core.tenant_context import set_current_tenant

from .models import Expense, ExpenseCategory
from .serializers import ExpenseCategorySerializer, ExpenseSerializer
from .services import cash_flow, financial_position, profit_summary, record_expense


class ExpenseCategoryViewSet(TenantScopedViewSet):
    serializer_class = ExpenseCategorySerializer
    required_perm = "manage_expenses"

    def get_queryset(self):
        return ExpenseCategory.objects.all()


class ExpenseViewSet(TenantScopedViewSet):
    serializer_class = ExpenseSerializer
    required_perm = "manage_expenses"

    def get_queryset(self):
        return Expense.objects.select_related("category")

    def perform_create(self, serializer):
        # Route through the service so the cash ledger stays in sync.
        v = serializer.validated_data
        expense = record_expense(
            shop=self.request.user.shop, amount=v["amount"], spent_on=v["spent_on"],
            category=v.get("category"), payment_method=v.get("payment_method", ""),
            note=v.get("note", ""), created_by=self.request.user,
        )
        serializer.instance = expense


class _ReportBase(APIView):
    permission_classes = [IsTenantMember, HasPermCode]
    required_perm = "view_profit"

    def initial(self, request, *args, **kwargs):
        set_current_tenant(getattr(request.user, "shop", None))
        request.tenant = getattr(request.user, "shop", None)
        super().initial(request, *args, **kwargs)


class ProfitReportView(_ReportBase):
    def get(self, request):
        start = parse_datetime(request.query_params.get("start", "") or "")
        end = parse_datetime(request.query_params.get("end", "") or "")
        return Response(profit_summary(request.user.shop, start=start, end=end))


class FinancialPositionView(_ReportBase):
    def get(self, request):
        return Response(financial_position(request.user.shop))


class CashFlowView(_ReportBase):
    def get(self, request):
        start = parse_datetime(request.query_params.get("start", "") or "")
        end = parse_datetime(request.query_params.get("end", "") or "")
        return Response(cash_flow(request.user.shop, start=start, end=end))


from django.db.models import Sum
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from sales.models import Sale, SaleReturn
from .models import DailySettlement, LedgerEntry
from .serializers import DailySettlementSerializer

class DailySettlementViewSet(TenantScopedViewSet):
    serializer_class = DailySettlementSerializer
    required_perm = "view_profit"

    def get_queryset(self):
        return DailySettlement.objects.all()

    def list(self, request, *args, **kwargs):
        import traceback
        try:
            return super().list(request, *args, **kwargs)
        except Exception as e:
            return Response({"error": str(e), "traceback": traceback.format_exc()}, status=500)

    @action(detail=False, methods=["get"])
    def current(self, request):
        import traceback
        try:
            settlement = self.get_queryset().filter(status=DailySettlement.Status.OPEN).first()
            if not settlement:
                return Response(None)
            
            ledger_sum = LedgerEntry.objects.filter(
                shop=request.tenant, 
                account=LedgerEntry.Account.CASH, 
                created_at__gte=settlement.opened_at
            ).aggregate(t=Sum("amount"))["t"] or 0
            
            settlement.expected_cash = float(settlement.opening_cash) + float(ledger_sum)
            return Response(self.get_serializer(settlement).data)
        except Exception as e:
            return Response({"error": str(e), "traceback": traceback.format_exc()}, status=500)

    @action(detail=False, methods=["post"])
    def open(self, request):
        if self.get_queryset().filter(status=DailySettlement.Status.OPEN).exists():
            raise ValidationError("A settlement is already open.")
        opening_cash = request.data.get("opening_cash", 0)
        settlement = DailySettlement.objects.create(
            shop=request.tenant,
            opening_cash=opening_cash,
            expected_cash=opening_cash,
        )
        return Response(self.get_serializer(settlement).data)

    @action(detail=False, methods=["post"])
    def close(self, request):
        settlement = self.get_queryset().filter(status=DailySettlement.Status.OPEN).first()
        if not settlement:
            raise ValidationError("No open settlement found.")
        
        actual_cash = request.data.get("actual_cash", 0)
        
        ledger_sum = LedgerEntry.objects.filter(
            shop=request.tenant, 
            account=LedgerEntry.Account.CASH, 
            created_at__gte=settlement.opened_at
        ).aggregate(t=Sum("amount"))["t"] or 0
        
        expected_cash = float(settlement.opening_cash) + float(ledger_sum)
        
        sales_sum = Sale.objects.filter(shop=request.tenant, created_at__gte=settlement.opened_at).aggregate(t=Sum("total"))["t"] or 0
        expenses_sum = Expense.objects.filter(shop=request.tenant, created_at__gte=settlement.opened_at).aggregate(t=Sum("amount"))["t"] or 0
        refunds_sum = SaleReturn.objects.filter(shop=request.tenant, created_at__gte=settlement.opened_at).aggregate(t=Sum("total_refund"))["t"] or 0
        
        settlement.expected_cash = expected_cash
        settlement.actual_cash = actual_cash
        settlement.discrepancy = float(actual_cash) - float(expected_cash)
        settlement.total_sales = sales_sum
        settlement.total_expenses = expenses_sum
        settlement.total_refunds = refunds_sum
        settlement.status = DailySettlement.Status.CLOSED
        settlement.closed_at = timezone.now()
        settlement.closed_by = request.user
        settlement.save()
        
        return Response(self.get_serializer(settlement).data)
