"""Generate reseller commissions for one closed calendar month.

Idempotent — safe to run repeatedly / on a monthly schedule. Defaults to the
previous month (the last fully-closed period).

    python manage.py generate_reseller_commissions            # last month
    python manage.py generate_reseller_commissions --year 2026 --month 7
"""
import datetime

from django.core.management.base import BaseCommand
from django.utils import timezone

from resellers.services import generate_commissions_for_month


class Command(BaseCommand):
    help = "Generate reseller commissions for a closed month (default: previous month)."

    def add_arguments(self, parser):
        parser.add_argument("--year", type=int)
        parser.add_argument("--month", type=int)

    def handle(self, *args, **options):
        year, month = options.get("year"), options.get("month")
        if not (year and month):
            first_of_this_month = timezone.now().replace(day=1)
            prev = first_of_this_month - datetime.timedelta(days=1)
            year, month = prev.year, prev.month
        created, skipped = generate_commissions_for_month(year, month)
        self.stdout.write(self.style.SUCCESS(
            f"{year}-{month:02d}: created {created} commission(s), "
            f"skipped {skipped} (on trial / suspended / zero-or-negative profit)."
        ))
