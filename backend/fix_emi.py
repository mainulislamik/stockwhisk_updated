import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from sales.models import EMISchedule
from core.tenant_context import set_tenant_filter_bypass
from decimal import Decimal

def fix_emi_schedules():
    set_tenant_filter_bypass(True)
    schedules = EMISchedule.all_objects.all()
    count = 0
    for s in schedules:
        inst_info = [(i.id, i.installment_number, float(i.amount), float(i.paid_amount), i.status) for i in s.installments.all()]
        print(f"DEBUG: Schedule {s.id} (Invoice: {s.sale.invoice_no}), Status: '{s.status}', Total Due: {s.total_due}, Total Paid: {s.total_paid}, Total EMI: {s.total_emi_amount}, Installments: {inst_info}")
        if s.total_due <= Decimal("0") and s.status != "completed":
            print(f"Fixing Schedule {s.id} (Invoice: {s.sale.invoice_no})...")
            s.status = "completed"
            s.save(update_fields=["status"])
            count += 1
    print(f"Fixed {count} EMI schedules.")

if __name__ == "__main__":
    fix_emi_schedules()
