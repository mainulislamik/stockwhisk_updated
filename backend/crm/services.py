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
    reduces the customer's cached ``due_balance``, writes a cash/bank inflow
    unless the method is SETTLEMENT, and allocates the payment across open
    sales invoices and service tickets in FIFO order.
    """
    amount = Decimal(amount)
    if amount <= 0:
        raise ValueError("Amount must be positive.")
    
    from .models import Customer
    customer = Customer.objects.select_for_update().get(id=customer.id)
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

    rem = amount

    # 1. Sync payment across open sales invoices (FIFO)
    try:
        from sales.models import Sale, Payment as SalePayment
        from sales.services import _resolve_status

        open_sales = list(
            Sale.objects.filter(
                customer=customer,
                status__in=[Sale.Status.DUE, Sale.Status.PARTIAL, Sale.Status.PARTIALLY_RETURNED],
            ).order_by("sale_date", "id")
        )
        for s in open_sales:
            if rem <= 0:
                break
            s_due = s.due
            if s_due > 0:
                portion = min(rem, s_due)
                s_method = method if method in SalePayment.Method.values else SalePayment.Method.CASH
                SalePayment.objects.create(
                    shop_id=s.shop_id, sale=s, amount=portion,
                    method=s_method,
                    note=f"CRM Due Payment #{payment.id}",
                )
                s.paid = (s.paid or ZERO) + portion
                s.status = _resolve_status(s.total, s.paid)
                s.save(update_fields=["paid", "status"])

                # If sale has an EMI schedule, allocate portion across unpaid installments
                if hasattr(s, "emi_schedule") and s.emi_schedule:
                    from sales.models import EMIInstallment, EMISchedule
                    from django.utils import timezone
                    rem_emi = portion
                    for inst in s.emi_schedule.installments.exclude(status=EMIInstallment.Status.PAID).order_by("installment_number"):
                        if rem_emi <= ZERO:
                            break
                        needed = inst.amount - (inst.paid_amount or ZERO)
                        apply_inst = min(rem_emi, needed)
                        inst.paid_amount = (inst.paid_amount or ZERO) + apply_inst
                        rem_emi -= apply_inst
                        if inst.paid_amount >= inst.amount:
                            inst.status = EMIInstallment.Status.PAID
                        else:
                            inst.status = EMIInstallment.Status.PARTIAL
                        inst.paid_at = timezone.now()
                        inst.save(update_fields=["paid_amount", "status", "paid_at"])

                    s.emi_schedule.refresh_from_db()
                    if s.emi_schedule.total_due <= ZERO:
                        s.emi_schedule.status = EMISchedule.Status.COMPLETED
                        s.emi_schedule.save(update_fields=["status"])

                rem -= portion
    except Exception:
        pass

    # 2. Sync payment with any unpaid delivered service tickets (FIFO)
    if rem > 0:
        try:
            from service.models import ServiceTicket
            unpaid_tickets = ServiceTicket.objects.filter(
                customer=customer, status=ServiceTicket.Status.DELIVERED
            ).order_by("received_at", "id")
            for t in unpaid_tickets:
                if rem <= 0:
                    break
                t_due = t.due
                if t_due > 0:
                    pay_t = min(rem, t_due)
                    t.paid = (t.paid or ZERO) + pay_t
                    t.save(update_fields=["paid", "updated_at"])
                    rem -= pay_t
        except Exception:
            pass

    from analytics.services import invalidate_dashboard_cache
    invalidate_dashboard_cache(customer.shop_id)
        
    return payment
