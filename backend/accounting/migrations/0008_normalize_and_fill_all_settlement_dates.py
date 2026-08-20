"""Normalize all DailySettlement opened_at timestamps, remove duplicates, and fill every missing date."""
from decimal import Decimal
from datetime import datetime, time, timedelta
from django.db import migrations
from django.db.models import Sum
from django.utils import timezone


def normalize_and_fill_all_dates(apps, schema_editor):
    LedgerEntry = apps.get_model("accounting", "LedgerEntry")
    DailySettlement = apps.get_model("accounting", "DailySettlement")
    Expense = apps.get_model("accounting", "Expense")
    Sale = apps.get_model("sales", "Sale")
    SaleReturn = apps.get_model("sales", "SaleReturn")
    Shop = apps.get_model("tenants", "Shop")

    today = timezone.localdate()
    yesterday = today - timedelta(days=1)

    for shop in Shop.objects.all().iterator():
        # 1. Clean up and normalize existing past settlements
        settlements = list(DailySettlement.objects.filter(shop_id=shop.id).order_by("opened_at", "id"))
        seen_dates = {}
        for s in settlements:
            s_date = timezone.localdate(s.opened_at)
            # If it's today, keep open or closed as is
            if s_date >= today:
                continue

            # If it's a past date
            day_start = timezone.make_aware(datetime.combine(s_date, time.min))
            day_end = timezone.make_aware(datetime.combine(s_date, time.max))

            if s_date in seen_dates:
                # Duplicate for same day — remove
                s.delete()
                continue

            s.opened_at = day_start
            s.closed_at = day_end
            s.status = "closed"
            s.save(update_fields=["opened_at", "closed_at", "status"])
            seen_dates[s_date] = s

        # 2. Determine start date (earliest activity or Aug 1, 2026)
        earliest_settle = DailySettlement.objects.filter(shop_id=shop.id).order_by("opened_at").first()
        earliest_sale = Sale.objects.filter(shop_id=shop.id).order_by("created_at").first()
        earliest_ledger = LedgerEntry.objects.filter(shop_id=shop.id).order_by("created_at").first()

        dates = [datetime(2026, 8, 1).date()]
        if earliest_settle and earliest_settle.opened_at:
            dates.append(timezone.localdate(earliest_settle.opened_at))
        if earliest_sale and earliest_sale.created_at:
            dates.append(timezone.localdate(earliest_sale.created_at))
        if earliest_ledger and earliest_ledger.created_at:
            dates.append(timezone.localdate(earliest_ledger.created_at))

        start_date = min(dates)

        # Refresh existing dates
        existing_dates = set(
            DailySettlement.objects.filter(shop_id=shop.id).values_list("opened_at__date", flat=True)
        )

        curr_date = start_date
        while curr_date <= yesterday:
            if curr_date not in existing_dates:
                day_start = timezone.make_aware(datetime.combine(curr_date, time.min))
                day_end = timezone.make_aware(datetime.combine(curr_date, time.max))

                cash_in = LedgerEntry.objects.filter(
                    shop_id=shop.id, account="CASH",
                    created_at__range=(day_start, day_end), amount__gt=0
                ).aggregate(t=Sum("amount"))["t"] or Decimal("0")

                cash_out = abs(LedgerEntry.objects.filter(
                    shop_id=shop.id, account="CASH",
                    created_at__range=(day_start, day_end), amount__lt=0
                ).aggregate(t=Sum("amount"))["t"] or Decimal("0"))

                net_cash = cash_in - cash_out
                sales_sum = Sale.objects.filter(
                    shop_id=shop.id, created_at__range=(day_start, day_end)
                ).aggregate(t=Sum("total"))["t"] or Decimal("0")

                expenses_sum = Expense.objects.filter(
                    shop_id=shop.id, created_at__range=(day_start, day_end)
                ).aggregate(t=Sum("amount"))["t"] or Decimal("0")

                refunds_sum = SaleReturn.objects.filter(
                    shop_id=shop.id, created_at__range=(day_start, day_end)
                ).aggregate(t=Sum("total_refund"))["t"] or Decimal("0")

                actual = max(Decimal("0"), net_cash)
                disc = actual - net_cash

                settle = DailySettlement.objects.create(
                    shop_id=shop.id,
                    opening_cash=Decimal("0"),
                    expected_cash=net_cash,
                    actual_cash=actual,
                    discrepancy=disc,
                    total_sales=sales_sum,
                    total_expenses=expenses_sum,
                    total_refunds=refunds_sum,
                    status="closed",
                    closed_at=day_end,
                )
                settle.opened_at = day_start
                settle.save(update_fields=["opened_at"])
                existing_dates.add(curr_date)

            curr_date += timedelta(days=1)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounting", "0007_backfill_service_ledger_and_settlements"),
    ]

    operations = [
        migrations.RunPython(normalize_and_fill_all_dates, noop),
    ]
