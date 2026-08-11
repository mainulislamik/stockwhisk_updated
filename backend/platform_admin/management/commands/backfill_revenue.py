"""
Backfill the PlatformRevenue ledger from existing PAID subscription invoices.

Safe to run repeatedly — invoices already present in the ledger (matched by
invoice number) are skipped. Run once after deploying the revenue feature:

    python manage.py backfill_revenue
"""
from decimal import Decimal

from django.core.management.base import BaseCommand

from billing.models import SubscriptionInvoice
from core.tenant_context import bypass_tenant_scope
from platform_admin.models import PlatformRevenue


class Command(BaseCommand):
    help = "Create PlatformRevenue rows from existing PAID subscription invoices."

    def handle(self, *args, **options):
        created = skipped = 0
        with bypass_tenant_scope():
            existing = set(
                PlatformRevenue.objects.exclude(invoice_number="")
                .values_list("invoice_number", flat=True)
            )
            paid = (
                SubscriptionInvoice.all_objects
                .filter(status=SubscriptionInvoice.Status.PAID)
                .select_related("shop", "plan")
            )
            for inv in paid:
                if inv.number and inv.number in existing:
                    skipped += 1
                    continue
                shop = inv.shop
                PlatformRevenue.objects.create(
                    shop=shop,
                    shop_name=(getattr(shop, "name", "") or ""),
                    shop_code=(shop.shop_code if shop else ""),
                    plan_tier=(inv.plan.tier if inv.plan else ""),
                    invoice_number=inv.number,
                    amount=(inv.amount or Decimal("0")),
                    cycle=(inv.cycle or "monthly"),
                    period_start=inv.period_start,
                    period_end=inv.period_end,
                    is_test=(getattr(shop, "is_test", False) if shop else False),
                    occurred_at=inv.created_at,
                )
                created += 1

        self.stdout.write(self.style.SUCCESS(
            f"Backfill complete: created={created}, skipped (already in ledger)={skipped}"
        ))
