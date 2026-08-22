"""Fix product purchase as inventory investment (not operating expense) and eliminate negative settlement values."""
from datetime import datetime, time
from django.db import migrations
from django.db.models import Sum
import django.utils.timezone


def fix_purchases_and_settlements(apps, schema_editor):
    Expense = apps.get_model("accounting", "Expense")
    ExpenseCategory = apps.get_model("accounting", "ExpenseCategory")
    LedgerEntry = apps.get_model("accounting", "LedgerEntry")
    DailySettlement = apps.get_model("accounting", "DailySettlement")
    Shop = apps.get_model("tenants", "Shop")

    # 1. Convert Product Purchase Expense rows into pure LedgerEntry investment records
    purchase_cats = ExpenseCategory.objects.filter(name="Product Purchase")
    purchase_expenses = Expense.objects.filter(category__in=purchase_cats)

    for exp in purchase_expenses.iterator():
        # Update associated LedgerEntry to source_type="PurchasePayment"
        LedgerEntry.objects.filter(
            shop_id=exp.shop_id,
            source_type="Expense",
            source_id=str(exp.id)
        ).update(
            source_type="PurchasePayment",
            description=exp.note or "Product Purchase Investment"
        )
        exp.delete()

    purchase_cats.delete()

    # 2. Fix negative DailySettlement values for all shops
    for shop in Shop.objects.all().iterator():
        settlements = list(DailySettlement.objects.filter(shop_id=shop.id).order_by("id"))
        for s in settlements:
            s_date = django.utils.timezone.localdate(s.opened_at)
            day_start = django.utils.timezone.make_aware(datetime.combine(s_date, time.min))
            day_end = django.utils.timezone.make_aware(datetime.combine(s_date, time.max))

            cash_in = LedgerEntry.objects.filter(
                shop_id=shop.id,
                account="cash",
                created_at__range=(day_start, day_end),
                amount__gt=0
            ).aggregate(t=Sum("amount"))["t"] or 0

            cash_out = abs(LedgerEntry.objects.filter(
                shop_id=shop.id,
                account="cash",
                created_at__range=(day_start, day_end),
                amount__lt=0
            ).aggregate(t=Sum("amount"))["t"] or 0)

            opening = max(0.0, float(s.opening_cash or 0))
            net_cash = float(cash_in) - float(cash_out)
            expected_cash = max(0.0, opening + net_cash)

            actual_cash = max(0.0, float(s.actual_cash or 0))
            if actual_cash == 0 and s.status == "closed":
                actual_cash = expected_cash

            discrepancy = actual_cash - expected_cash

            expenses_sum = Expense.objects.filter(
                shop_id=shop.id,
                spent_on__range=(day_start.date(), day_end.date())
            ).aggregate(t=Sum("amount"))["t"] or 0

            DailySettlement.objects.filter(id=s.id).update(
                opening_cash=opening,
                expected_cash=expected_cash,
                actual_cash=actual_cash,
                discrepancy=discrepancy,
                total_expenses=expenses_sum,
            )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounting", "0009_alter_dailysettlement_opened_at_and_fix_dates"),
    ]

    operations = [
        migrations.RunPython(fix_purchases_and_settlements, noop),
    ]
