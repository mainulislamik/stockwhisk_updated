from rest_framework import serializers

from .models import Expense, ExpenseCategory, DailySettlement


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
            "total_refunds", "status", "closed_by", "closed_by_name"
        ]
        read_only_fields = [
            "opened_at", "closed_at", "expected_cash", "discrepancy",
            "total_sales", "total_expenses", "total_refunds", "status", "closed_by"
        ]
