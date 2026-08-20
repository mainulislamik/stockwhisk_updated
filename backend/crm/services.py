from decimal import Decimal
from django.db import transaction
from accounting.models import LedgerEntry
from .models import CustomerPayment

ZERO = Decimal("0")

@transaction.atomic
def pay_customer_due(*, customer, amount, method=CustomerPayment.Method.CASH,
                     reference="", note="", created_by=None):
    """
    Pay down a customer's outstanding receivable. Records a CustomerPayment,
    reduces the customer's cached ``due_balance``, and writes a cash inflow
    unless the method is SETTLEMENT.
    """
    amount = Decimal(amount)
    if amount <= 0:
        raise ValueError("Amount must be positive.")
    
    outstanding = customer.due_balance or ZERO
    if amount > outstanding:
        raise ValueError(f"Amount exceeds outstanding due of {outstanding}.")

    payment = CustomerPayment.objects.create(
        shop_id=customer.shop_id, customer=customer, amount=amount,
        method=method, reference=reference, note=note, created_by=created_by,
    )
    
    customer.due_balance = outstanding - amount
    customer.save(update_fields=["due_balance"])
    
    if method != CustomerPayment.Method.SETTLEMENT:
        pm_str = str(method).lower()
        acct = LedgerEntry.Account.BANK if pm_str in ["bank", "bkash", "nagad", "card"] else LedgerEntry.Account.CASH
        LedgerEntry.objects.create(
            shop_id=customer.shop_id, account=acct, amount=amount,
            source_type="CustomerPayment", source_id=str(payment.id),
            description=f"Due collection ({method}) from {customer.name}",
        )

    # Sync payment with any unpaid delivered service tickets for this customer
    try:
        from service.models import ServiceTicket
        from django.db.models import F
        rem = amount
        unpaid_tickets = ServiceTicket.objects.filter(
            customer=customer, paid__lt=F("service_charge")
        ).exclude(status=ServiceTicket.Status.CANCELLED).order_by("created_at")
        for t in unpaid_tickets:
            if rem <= 0:
                break
            t_due = t.due
            if t_due > 0:
                pay_t = min(rem, t_due)
                t.paid = (t.paid or Decimal("0")) + pay_t
                t.save(update_fields=["paid", "updated_at"])
                rem -= pay_t
    except Exception:
        pass
        
    return payment
