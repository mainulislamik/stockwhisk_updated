from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CashFlowView,
    ExpenseCategoryViewSet,
    ExpenseViewSet,
    FinancialPositionView,
    ProfitReportView,
    DailySettlementViewSet,
    InvestmentViewSet,
)

router = DefaultRouter()
router.register("expense-categories", ExpenseCategoryViewSet, basename="expense-category")
router.register("expenses", ExpenseViewSet, basename="expense")
router.register("investments", InvestmentViewSet, basename="investment")
router.register("daily-settlements", DailySettlementViewSet, basename="daily-settlement")

urlpatterns = [
    path("reports/profit/", ProfitReportView.as_view(), name="profit-report"),
    path("reports/position/", FinancialPositionView.as_view(), name="financial-position"),
    path("reports/cash-flow/", CashFlowView.as_view(), name="cash-flow"),
] + router.urls
