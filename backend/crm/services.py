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
        LedgerEntry.objects.create(
            shop_id=customer.shop_id, account=LedgerEntry.Account.CASH, amount=amount,
            source_type="CustomerPayment", source_id=str(payment.id),
            description=f"Due collection from {customer.name}",
        )
        
    return payment
