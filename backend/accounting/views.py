from django.utils.dateparse import parse_datetime
from rest_framework.decorators import action
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
        qs = Expense.objects.select_related("category")
        if search := self.request.query_params.get("search"):
            from django.db.models import Q
            qs = qs.filter(Q(note__icontains=search) | Q(category__name__icontains=search) | Q(payment_method__icontains=search))
        return qs

    @action(detail=False, methods=["get"])
    def total(self, request):
        """Sum of all expenses (page-independent header figure)."""
        from django.db.models import Sum
        total = self.get_queryset().aggregate(t=Sum("amount"))["t"] or 0
        return Response({"total": total})

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


from datetime import datetime, time
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
        return DailySettlement.objects.all().order_by("-opened_at", "-id")

    def _auto_close_past_settlements(self, shop):
        """Auto-close past unclosed shifts, normalize opened_at, and backfill ALL dates up to yesterday."""
        from datetime import datetime, time, timedelta
        from django.utils import timezone

        today = timezone.localdate()
        yesterday = today - timedelta(days=1)

        # 1. Normalize and close any past settlements
        past_settlements = list(DailySettlement.objects.filter(shop=shop).order_by("id"))
        seen_dates = {}
        for past in past_settlements:
            ref_dt = past.closed_at or past.opened_at
            p_date = timezone.localdate(ref_dt)

            # Skip today
            if p_date >= today:
                continue

            day_start = timezone.make_aware(datetime.combine(p_date, time.min))
            day_end = timezone.make_aware(datetime.combine(p_date, time.max))

            if p_date in seen_dates:
                past.delete()
                continue

            cash_in = LedgerEntry.objects.filter(
                shop=shop, 
                account=LedgerEntry.Account.CASH, 
                created_at__range=(day_start, day_end),
                amount__gt=0
            ).aggregate(t=Sum("amount"))["t"] or 0
            
            cash_out = abs(LedgerEntry.objects.filter(
                shop=shop, 
                account=LedgerEntry.Account.CASH, 
                created_at__range=(day_start, day_end),
                amount__lt=0
            ).aggregate(t=Sum("amount"))["t"] or 0)
            
            net_cash = float(cash_in) - float(cash_out)
            expected_cash = float(past.opening_cash) + net_cash
            sales_sum = Sale.objects.filter(shop=shop, created_at__range=(day_start, day_end)).aggregate(t=Sum("total"))["t"] or 0
            expenses_sum = Expense.objects.filter(shop=shop, created_at__range=(day_start, day_end)).aggregate(t=Sum("amount"))["t"] or 0
            refunds_sum = SaleReturn.objects.filter(shop=shop, created_at__range=(day_start, day_end)).aggregate(t=Sum("total_refund"))["t"] or 0
            
            actual = max(0.0, expected_cash) if past.status == DailySettlement.Status.OPEN or float(past.actual_cash) == 0 else float(past.actual_cash)
            disc = actual - expected_cash

            DailySettlement.objects.filter(id=past.id).update(
                opened_at=day_start,
                closed_at=day_end,
                status=DailySettlement.Status.CLOSED,
                expected_cash=expected_cash,
                actual_cash=actual,
                discrepancy=disc,
                total_sales=sales_sum,
                total_expenses=expenses_sum,
                total_refunds=refunds_sum,
            )
            seen_dates[p_date] = past

        # 2. Find earliest date (earliest activity or Aug 1, 2026) and fill every missing date
        earliest_settle = DailySettlement.objects.filter(shop=shop).order_by("opened_at").first()
        earliest_ledger = LedgerEntry.objects.filter(shop=shop).order_by("created_at").first()
        earliest_sale = Sale.objects.filter(shop=shop).order_by("created_at").first()

        dates = [datetime(2026, 8, 1).date()]
        if earliest_settle and earliest_settle.opened_at:
            dates.append(timezone.localdate(earliest_settle.opened_at))
        if earliest_ledger and earliest_ledger.created_at:
            dates.append(timezone.localdate(earliest_ledger.created_at))
        if earliest_sale and earliest_sale.created_at:
            dates.append(timezone.localdate(earliest_sale.created_at))

        start_date = min(dates)
        existing_dates = set(
            DailySettlement.objects.filter(shop=shop).values_list("opened_at__date", flat=True)
        )

        curr_date = start_date
        while curr_date <= yesterday:
            if curr_date not in existing_dates:
                day_start = timezone.make_aware(datetime.combine(curr_date, time.min))
                day_end = timezone.make_aware(datetime.combine(curr_date, time.max))

                cash_in = LedgerEntry.objects.filter(
                    shop=shop, account=LedgerEntry.Account.CASH,
                    created_at__range=(day_start, day_end), amount__gt=0
                ).aggregate(t=Sum("amount"))["t"] or 0

                cash_out = abs(LedgerEntry.objects.filter(
                    shop=shop, account=LedgerEntry.Account.CASH,
                    created_at__range=(day_start, day_end), amount__lt=0
                ).aggregate(t=Sum("amount"))["t"] or 0)

                net_cash = float(cash_in) - float(cash_out)
                sales_sum = Sale.objects.filter(
                    shop=shop, created_at__range=(day_start, day_end)
                ).aggregate(t=Sum("total"))["t"] or 0

                expenses_sum = Expense.objects.filter(
                    shop=shop, created_at__range=(day_start, day_end)
                ).aggregate(t=Sum("amount"))["t"] or 0

                refunds_sum = SaleReturn.objects.filter(
                    shop=shop, created_at__range=(day_start, day_end)
                ).aggregate(t=Sum("total_refund"))["t"] or 0

                actual = max(0.0, net_cash)
                disc = actual - net_cash
                DailySettlement.objects.create(
                    shop=shop,
                    opened_at=day_start,
                    closed_at=day_end,
                    opening_cash=0,
                    expected_cash=net_cash,
                    actual_cash=actual,
                    discrepancy=disc,
                    total_sales=sales_sum,
                    total_expenses=expenses_sum,
                    total_refunds=refunds_sum,
                    status=DailySettlement.Status.CLOSED,
                )
                existing_dates.add(curr_date)

            curr_date += timedelta(days=1)

    def list(self, request, *args, **kwargs):
        import traceback
        try:
            if request.tenant:
                self._auto_close_past_settlements(request.tenant)
            return super().list(request, *args, **kwargs)
        except Exception as e:
            return Response({"error": str(e), "traceback": traceback.format_exc()}, status=500)

    @action(detail=False, methods=["get"])
    def current(self, request):
        import traceback
        try:
            if request.tenant:
                self._auto_close_past_settlements(request.tenant)
            
            today = timezone.localdate()
            
            # Check if today already has a closed settlement
            today_closed = self.get_queryset().filter(opened_at__date=today, status=DailySettlement.Status.CLOSED).first()
            
            # Check if today has an open settlement
            settlement = self.get_queryset().filter(opened_at__date=today, status=DailySettlement.Status.OPEN).first()
            
            if not settlement and not today_closed:
                start_of_day = timezone.make_aware(datetime.combine(today, time.min))
                settlement = DailySettlement.objects.create(
                    shop=request.tenant,
                    opening_cash=0,
                    expected_cash=0,
                )
                settlement.opened_at = start_of_day
                settlement.save(update_fields=['opened_at'])
            
            active_obj = settlement or today_closed
            if not active_obj:
                return Response(None)
            
            start_time = active_obj.opened_at
            end_time = active_obj.closed_at or timezone.now()
            
            cash_in = LedgerEntry.objects.filter(
                shop=request.tenant, 
                account=LedgerEntry.Account.CASH, 
                created_at__range=(start_time, end_time),
                amount__gt=0
            ).aggregate(t=Sum("amount"))["t"] or 0
            
            cash_out = abs(LedgerEntry.objects.filter(
                shop=request.tenant, 
                account=LedgerEntry.Account.CASH, 
                created_at__range=(start_time, end_time),
                amount__lt=0
            ).aggregate(t=Sum("amount"))["t"] or 0)
            
            ledger_net = float(cash_in) - float(cash_out)
            expected_cash = float(active_obj.opening_cash) + ledger_net
            if active_obj.status == DailySettlement.Status.OPEN:
                active_obj.expected_cash = expected_cash
            
            data = self.get_serializer(active_obj).data
            data["cash_in"] = float(cash_in)
            data["cash_out"] = float(cash_out)
            data["sales_total"] = float(Sale.objects.filter(shop=request.tenant, sale_date__range=(start_time, end_time)).exclude(status=Sale.Status.CANCELLED).aggregate(t=Sum("total"))["t"] or 0)
            data["expenses_total"] = float(Expense.objects.filter(shop=request.tenant, created_at__range=(start_time, end_time)).aggregate(t=Sum("amount"))["t"] or 0)
            data["refunds_total"] = float(SaleReturn.objects.filter(shop=request.tenant, created_at__range=(start_time, end_time)).aggregate(t=Sum("total_refund"))["t"] or 0)
            return Response(data)
        except Exception as e:
            return Response({"error": str(e), "traceback": traceback.format_exc()}, status=500)

    @action(detail=False, methods=["post"])
    def open(self, request):
        today = timezone.localdate()
        if self.get_queryset().filter(opened_at__date=today, status=DailySettlement.Status.OPEN).exists():
            raise ValidationError("A settlement for today is already open.")
        
        opening_cash = request.data.get("opening_cash", 0)
        start_of_day = timezone.make_aware(datetime.combine(today, time.min))
        settlement = DailySettlement.objects.create(
            shop=request.tenant,
            opening_cash=opening_cash,
            expected_cash=opening_cash,
        )
        settlement.opened_at = start_of_day
        settlement.save(update_fields=['opened_at'])
        return Response(self.get_serializer(settlement).data)

    @action(detail=False, methods=["post"])
    def close(self, request):
        today = timezone.localdate()
        settlement = self.get_queryset().filter(opened_at__date=today, status=DailySettlement.Status.OPEN).first()
        if not settlement:
            settlement = self.get_queryset().filter(status=DailySettlement.Status.OPEN).first()
            
        if not settlement:
            raise ValidationError("No open settlement found.")
        
        actual_cash = request.data.get("actual_cash", 0)
        start_time = settlement.opened_at
        end_time = timezone.now()
        
        cash_in = LedgerEntry.objects.filter(
            shop=request.tenant, 
            account=LedgerEntry.Account.CASH, 
            created_at__range=(start_time, end_time),
            amount__gt=0
        ).aggregate(t=Sum("amount"))["t"] or 0
        
        cash_out = abs(LedgerEntry.objects.filter(
            shop=request.tenant, 
            account=LedgerEntry.Account.CASH, 
            created_at__range=(start_time, end_time),
            amount__lt=0
        ).aggregate(t=Sum("amount"))["t"] or 0)
        
        expected_cash = float(settlement.opening_cash) + float(cash_in) - float(cash_out)
        
        sales_sum = Sale.objects.filter(shop=request.tenant, created_at__range=(start_time, end_time)).aggregate(t=Sum("total"))["t"] or 0
        expenses_sum = Expense.objects.filter(shop=request.tenant, created_at__range=(start_time, end_time)).aggregate(t=Sum("amount"))["t"] or 0
        refunds_sum = SaleReturn.objects.filter(shop=request.tenant, created_at__range=(start_time, end_time)).aggregate(t=Sum("total_refund"))["t"] or 0
        
        settlement.expected_cash = expected_cash
        settlement.actual_cash = actual_cash
        settlement.discrepancy = float(actual_cash) - float(expected_cash)
        settlement.total_sales = sales_sum
        settlement.total_expenses = expenses_sum
        settlement.total_refunds = refunds_sum
        settlement.status = DailySettlement.Status.CLOSED
        settlement.closed_at = end_time
        settlement.closed_by = request.user
        settlement.save()
        
        return Response(self.get_serializer(settlement).data)

    @action(detail=False, methods=["post"])
    def reopen(self, request):
        today = timezone.localdate()
        settlement = self.get_queryset().filter(opened_at__date=today, status=DailySettlement.Status.CLOSED).first()
        if not settlement:
            raise ValidationError("No closed settlement found for today to reopen.")
        
        settlement.status = DailySettlement.Status.OPEN
        settlement.closed_at = None
        settlement.closed_by = None
        settlement.actual_cash = 0
        settlement.discrepancy = 0
        settlement.save()
        
        return Response(self.get_serializer(settlement).data)

    @action(detail=True, methods=["post", "patch"])
    def adjust(self, request, pk=None):
        """Adjust a closed historical settlement's actual counted cash or opening cash."""
        settlement = self.get_object()
        actual_cash = request.data.get("actual_cash")
        opening_cash = request.data.get("opening_cash")
        
        if opening_cash is not None:
            settlement.opening_cash = opening_cash
            
        if actual_cash is not None:
            settlement.actual_cash = actual_cash
            
        settlement.discrepancy = float(settlement.actual_cash) - float(settlement.expected_cash)
        settlement.closed_by = request.user
        settlement.save()
        return Response(self.get_serializer(settlement).data)
