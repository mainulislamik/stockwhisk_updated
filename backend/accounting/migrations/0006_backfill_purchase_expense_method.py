"""Backfill the payment method on historical purchase-payment expenses.

Product-purchase payments used to book their Expense row with an empty
``payment_method`` (the value was never threaded through), so the POS/Finance
"Method" column was blank for every "Purchase payment PO-…" row. Going forward
the method is stored correctly; this migration fixes the existing rows by
matching each expense back to its PurchasePayment (same shop + PO + amount) and
falling back to "cash" (the historical default) when no unambiguous match
exists — e.g. payments made at receive time, which never created a
PurchasePayment record.
"""
from django.db import migrations

_PREFIX = "Purchase payment "


def backfill(apps, schema_editor):
    Expense = apps.get_model("accounting", "Expense")
    PurchaseOrder = apps.get_model("purchasing", "PurchaseOrder")
    PurchasePayment = apps.get_model("purchasing", "PurchasePayment")

    expenses = Expense.objects.filter(
        payment_method="", note__startswith=_PREFIX
    ).only("id", "shop_id", "amount", "note")

    for exp in expenses.iterator():
        po_number = (exp.note or "")[len(_PREFIX):].strip()
        method = "cash"
        if po_number:
            po = PurchaseOrder.objects.filter(
                shop_id=exp.shop_id, po_number=po_number
            ).only("id").first()
            if po is not None:
                pays = list(
                    PurchasePayment.objects.filter(
                        purchase_order_id=po.id, amount=exp.amount
                    ).values_list("method", flat=True)[:2]
                )
                # Only trust the match when it's unambiguous (exactly one).
                if len(pays) == 1 and pays[0]:
                    method = pays[0]
        # Store uppercased to match the manual-expense convention (CASH/BANK/…).
        Expense.objects.filter(pk=exp.pk).update(payment_method=method.upper())


def noop(apps, schema_editor):
    # Non-reversible data fix; leaving the backfilled values in place is safe.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounting", "0005_rename_accounting_dail_idx_accounting__shop_id_8af6ae_idx"),
        ("purchasing", "0008_alter_supplierpayment_method"),
    ]

    operations = [
        migrations.RunPython(backfill, noop),
    ]
