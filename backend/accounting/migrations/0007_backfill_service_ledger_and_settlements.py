"""Backfill ServiceTicket payments into LedgerEntry and backfill missing daily settlements.

1. Any ServiceTicket with paid > 0 that doesn't have a matching LedgerEntry is given one.
2. Any past dates with transactions are ensured to have closed DailySettlement records.
"""
from decimal import Decimal
from datetime import datetime, time, timedelta
from django.db import migrations
from django.db.models import Sum
from django.utils import timezone


def backfill_service_ledger_and_settlements(apps, schema_editor):
    LedgerEntry = apps.get_model("accounting", "LedgerEntry")
    DailySettlement = apps.get_model("accounting", "DailySettlement")
    Expense = apps.get_model("accounting", "Expense")
    ServiceTicket = apps.get_model("service", "ServiceTicket")
    Sale = apps.get_model("sales", "Sale")
    SaleReturn = apps.get_model("sales", "SaleReturn")
    Shop = apps.get_model("tenants", "Shop")

    # 1. Backfill LedgerEntry for ServiceTickets
    for ticket in ServiceTicket.objects.filter(paid__gt=0).iterator():
        exists = LedgerEntry.objects.filter(
            source_type="ServiceTicket", source_id=str(ticket.id)
        ).exists()
        if not exists:
            # Create matching CASH LedgerEntry
            entry = LedgerEntry.objects.create(
                shop_id=ticket.shop_id,
                account="CASH",
                amount=ticket.paid,
                source_type="ServiceTicket",
                source_id=str(ticket.id),
                description=f"Payment for repair ticket {ticket.ticket_no}",
            )
            if ticket.received_at:
                entry.created_at = ticket.received_at
                entry.save(update_fields=["created_at"])

    # 2. Backfill DailySettlements for all shops
    today = timezone.localdate()
    yesterday = today - timedelta(days=1)

    for shop in Shop.objects.all().iterator():
        # Find earliest activity
        earliest_settle = DailySettlement.objects.filter(shop_id=shop.id).order_by("opened_at").first()
        earliest_ledger = LedgerEntry.objects.filter(shop_id=shop.id).order_by("created_at").first()
        earliest_sale = Sale.objects.filter(shop_id=shop.id).order_by("created_at").first()

        dates = []
        if earliest_settle and earliest_settle.opened_at:
            dates.append(timezone.localdate(earliest_settle.opened_at))
        if earliest_ledger and earliest_ledger.created_at:
            dates.append(timezone.localdate(earliest_ledger.created_at))
        if earliest_sale and earliest_sale.created_at:
            dates.append(timezone.localdate(earliest_sale.created_at))

        if not dates:
            continue

        start_date = min(dates)
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

                if cash_in > 0 or cash_out > 0 or sales_sum > 0 or expenses_sum > 0:
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
        ("accounting", "0006_backfill_purchase_expense_method"),
        ("service", "0009_link_service_customers"),
        ("sales", "0010_sale_correction_fields"),
    ]

    operations = [
        migrations.RunPython(backfill_service_ledger_and_settlements, noop),
    ]
