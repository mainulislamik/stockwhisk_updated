"""Alter DailySettlement opened_at and fix all historical timestamps using direct SQL updates."""
from datetime import datetime, time, timedelta
from django.db import migrations, models
import django.utils.timezone


def fix_all_historical_dates(apps, schema_editor):
    DailySettlement = apps.get_model("accounting", "DailySettlement")
    Shop = apps.get_model("tenants", "Shop")

    today = django.utils.timezone.localdate()

    for shop in Shop.objects.all().iterator():
        settlements = list(DailySettlement.objects.filter(shop_id=shop.id).order_by("id"))
        seen_dates = {}
        for s in settlements:
            # Determine true target date from closed_at or opened_at
            ref_dt = s.closed_at or s.opened_at
            s_date = django.utils.timezone.localdate(ref_dt)

            if s_date >= today:
                continue

            day_start = django.utils.timezone.make_aware(datetime.combine(s_date, time.min))
            day_end = django.utils.timezone.make_aware(datetime.combine(s_date, time.max))

            if s_date in seen_dates:
                # Deduplicate
                s.delete()
                continue

            # Update directly in SQL so opened_at is strictly day_start
            DailySettlement.objects.filter(id=s.id).update(
                opened_at=day_start,
                closed_at=day_end,
                status="closed"
            )
            seen_dates[s_date] = s


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounting", "0008_normalize_and_fill_all_settlement_dates"),
    ]

    operations = [
        migrations.AlterField(
            model_name="dailysettlement",
            name="opened_at",
            field=models.DateTimeField(db_index=True, default=django.utils.timezone.now),
        ),
        migrations.RunPython(fix_all_historical_dates, noop),
    ]
