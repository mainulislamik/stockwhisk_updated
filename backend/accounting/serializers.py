from rest_framework import serializers

from .models import Expense, ExpenseCategory, DailySettlement, Investment


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = ["id", "name"]


class ExpenseSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True, default=None)

    class Meta:
        model = Expense
        fields = [
            "id", "category", "category_name", "amount", "spent_on",
            "payment_method", "note", "created_at",
        ]


class DailySettlementSerializer(serializers.ModelSerializer):
    closed_by_name = serializers.CharField(source="closed_by.get_full_name", read_only=True)

    class Meta:
        model = DailySettlement
        fields = [
            "id", "opened_at", "closed_at", "opening_cash", "expected_cash",
            "actual_cash", "discrepancy", "total_sales", "total_expenses",
            "total_refunds", "expected_investment", "actual_investment",
            "investment_discrepancy", "total_purchases", "total_capital_investment",
            "status", "closed_by", "closed_by_name"
        ]
        read_only_fields = [
            "opened_at", "closed_at", "expected_cash", "discrepancy",
            "total_sales", "total_expenses", "total_refunds",
            "expected_investment", "investment_discrepancy", "total_purchases",
            "total_capital_investment", "status", "closed_by"
        ]


class InvestmentSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)
    type_display = serializers.CharField(source="get_type_display", read_only=True)

    class Meta:
        model = Investment
        fields = [
            "id", "investor_name", "type", "type_display", "amount",
            "invested_on", "payment_method", "reference", "note",
            "created_by", "created_by_name", "created_at"
        ]
        read_only_fields = ["created_by", "created_at"]
