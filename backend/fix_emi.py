import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from sales.models import EMISchedule
from decimal import Decimal

def fix_emi_schedules():
    schedules = EMISchedule.all_objects.all()
    count = 0
    for s in schedules:
        print(f"DEBUG: Schedule {s.id} (Invoice: {s.sale.invoice_no}), Status: '{s.status}', Total Due: {s.total_due}, Total Paid: {s.total_paid}, Total EMI Amount: {s.total_emi_amount}")
        if s.total_due <= Decimal("0") and s.status != "completed":
            print(f"Fixing Schedule {s.id} (Invoice: {s.sale.invoice_no})...")
            s.status = "completed"
            s.save(update_fields=["status"])
            count += 1
    print(f"Fixed {count} EMI schedules.")

if __name__ == "__main__":
    fix_emi_schedules()
