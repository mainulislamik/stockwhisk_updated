"""
Transparent profit + financial position.

Rule (never violated): Gross Profit = Revenue − COGS; Net = Gross − Expenses.
COGS uses the cost SNAPSHOTTED on each sale item. Returns reduce revenue.
Services take ``shop`` explicitly and use ``all_objects`` with an explicit
shop filter so they are safe to call from Celery tasks and tests where no
thread-local tenant is set.
"""
from decimal import Decimal

from django.db.models import DecimalField, ExpressionWrapper, F, Sum
from django.db.models.functions import Coalesce

from crm.models import Customer
from purchasing.models import Supplier
from sales.models import Sale, SaleItem, SaleReturn, SaleReturnItem, Payment

from .models import Expense, ExpenseCategory, LedgerEntry

ZERO = Decimal("0")
_DEC = DecimalField(max_digits=18, decimal_places=2)


def _sum(qs, expr):
    return qs.aggregate(v=Coalesce(Sum(expr, output_field=_DEC), ZERO, output_field=_DEC))["v"]


def profit_summary(shop, start=None, end=None):
    """Return a dict with revenue, COGS, gross/net profit, expenses for a range,
    including both product sales and service/repair revenue."""
    from service.models import ServiceTicket, ServiceTicketPart

    sales = Sale.all_objects.filter(shop_id=shop.id).exclude(status__in=[Sale.Status.CANCELLED, Sale.Status.QUOTATION])
    items = SaleItem.all_objects.filter(shop_id=shop.id).exclude(
        sale__status__in=[Sale.Status.CANCELLED, Sale.Status.QUOTATION]
    )
    returns = SaleReturn.all_objects.filter(shop_id=shop.id)
    expenses = Expense.all_objects.filter(shop_id=shop.id).exclude(category__name="Product Purchase")
    payments = Payment.all_objects.filter(shop_id=shop.id)
    tickets = ServiceTicket.all_objects.filter(shop_id=shop.id).exclude(
        status=ServiceTicket.Status.CANCELLED
    )

    if start is not None:
        sales = sales.filter(sale_date__gte=start)
        items = items.filter(sale__sale_date__gte=start)
        returns = returns.filter(created_at__gte=start)
        expenses = expenses.filter(spent_on__gte=start)
        payments = payments.filter(paid_at__gte=start)
        tickets = tickets.filter(received_at__gte=start)
    if end is not None:
        sales = sales.filter(sale_date__lte=end)
        items = items.filter(sale__sale_date__lte=end)
        returns = returns.filter(created_at__lte=end)
        expenses = expenses.filter(spent_on__lte=end)
        payments = payments.filter(paid_at__lte=end)
        tickets = tickets.filter(received_at__lte=end)

    # Product sales revenue & COGS
    sales_revenue = _sum(items, "subtotal") - _sum(sales, "discount")
    sales_cogs = _sum(
        items,
        ExpressionWrapper(F("quantity") * F("unit_cost"), output_field=_DEC),
    )
    returns_amount = _sum(returns, "total_refund")
    returned_cogs = _sum(
        SaleReturnItem.all_objects.filter(
            sale_return__in=returns.filter(restocked=True)
        ),
        ExpressionWrapper(F("quantity") * F("sale_item__unit_cost"), output_field=_DEC),
    )

    # Service / repair ticket revenue & parts COGS
    ticket_service_charges = _sum(tickets, "service_charge")
    ticket_discounts = _sum(tickets, "discount")
    ticket_parts = ServiceTicketPart.all_objects.filter(ticket__in=tickets)
    ticket_parts_revenue = _sum(
        ticket_parts,
        ExpressionWrapper(F("quantity") * F("unit_price"), output_field=_DEC),
    )
    ticket_parts_cogs = _sum(
        ticket_parts,
        ExpressionWrapper(F("quantity") * F("unit_cost"), output_field=_DEC),
    )
    service_revenue = max(ZERO, ticket_service_charges + ticket_parts_revenue - ticket_discounts)

    # Total combined revenue and COGS
    gross_revenue = sales_revenue + service_revenue
    revenue = max(ZERO, gross_revenue - returns_amount)
    cogs = (sales_cogs - returned_cogs) + ticket_parts_cogs
    total_expenses = _sum(expenses, "amount")

    gross_profit = revenue - cogs
    net_profit = gross_profit - total_expenses
    
    payment_totals_qs = payments.values("method").annotate(total=Sum("amount"))
    payment_methods = {item["method"]: item["total"] for item in payment_totals_qs}

    return {
        "revenue": revenue,
        "gross_revenue": gross_revenue,
        "returns": returns_amount,
        "returns_count": returns.count(),
        "cogs": cogs,
        "gross_profit": gross_profit,
        "expenses": total_expenses,
        "net_profit": net_profit,
        "sales_count": sales.count() + tickets.count(),
        "payment_methods": payment_methods,
    }


DEFAULT_EXPENSE_CATEGORIES = [
    "Rent", "Electricity", "Salary", "Transport", "Marketing", "Internet", "Other",
]


def seed_expense_categories(shop):
    """Create the preset expense categories for a shop (idempotent)."""
    for name in DEFAULT_EXPENSE_CATEGORIES:
        ExpenseCategory.all_objects.get_or_create(shop_id=shop.id, name=name)


def record_expense(*, shop, amount, spent_on, category=None, payment_method="", note="", created_by=None):
    """Create an expense AND post the outflow to the appropriate ledger (CASH or BANK)."""
    amount = Decimal(amount)
    expense = Expense.all_objects.create(
        shop_id=shop.id, category=category, amount=amount, spent_on=spent_on,
        payment_method=payment_method, note=note, created_by=created_by,
    )
    pm = (payment_method or "").upper()
    acct = LedgerEntry.Account.BANK if pm in ["BANK", "BKASH", "NAGAD", "CARD"] else LedgerEntry.Account.CASH
    LedgerEntry.all_objects.create(
        shop_id=shop.id, account=acct, amount=-amount,
        source_type="Expense", source_id=str(expense.id),
        description=note or (category.name if category else "Expense"),
    )
    return expense


def cash_flow(shop, start, end):
    """opening + inflow - outflow = closing, computed from the cash ledger."""
    ledger = LedgerEntry.all_objects.filter(shop_id=shop.id, account=LedgerEntry.Account.CASH)
    opening = _sum(ledger.filter(created_at__lt=start), "amount") if start else ZERO
    in_range = ledger
    if start:
        in_range = in_range.filter(created_at__gte=start)
    if end:
        in_range = in_range.filter(created_at__lte=end)
    inflow = _sum(in_range.filter(amount__gt=0), "amount")
    outflow = _sum(in_range.filter(amount__lt=0), "amount")  # negative
    closing = opening + inflow + outflow
    return {
        "opening_cash": opening, "inflow": inflow,
        "outflow": -outflow, "closing_cash": closing,
    }


from purchasing.models import Supplier, PurchaseOrder, PurchasePayment
from sales.models import Sale, SaleItem, SaleReturn, SaleReturnItem, Payment

from .models import Expense, ExpenseCategory, LedgerEntry, Investment


def record_investment(*, shop, investor_name, amount, type="capital", invested_on=None, payment_method="cash", reference="", note="", created_by=None):
    """Create an Investment and post inflow into LedgerEntry."""
    from django.utils import timezone
    amount = Decimal(amount)
    invested_on = invested_on or timezone.localdate()
    inv = Investment.all_objects.create(
        shop_id=shop.id,
        investor_name=investor_name,
        type=type,
        amount=amount,
        invested_on=invested_on,
        payment_method=payment_method,
        reference=reference,
        note=note,
        created_by=created_by,
    )
    pm = (payment_method or "").upper()
    acct = LedgerEntry.Account.BANK if pm in ["BANK", "BKASH", "NAGAD", "CARD"] else LedgerEntry.Account.CASH
    LedgerEntry.all_objects.create(
        shop_id=shop.id,
        account=acct,
        amount=amount,  # positive inflow
        source_type="Investment",
        source_id=str(inv.id),
        description=note or f"Investment by {investor_name} ({type})",
    )
    return inv


def investment_summary(shop, start=None, end=None):
    """
    Comprehensive Investment calculations:
    - Capital / Partner Investments: recorded directly in Investment model.
    - Inventory / Purchase Investments: all purchase orders (total_amount) or received purchases.
    - Total Investment: Capital + Purchases.
    """
    from datetime import datetime, date

    start_date = start.date() if isinstance(start, datetime) else start
    end_date = end.date() if isinstance(end, datetime) else end

    capital_investment = ZERO
    by_type = {}
    investors_count = 0
    try:
        investments = Investment.all_objects.filter(shop_id=shop.id)
        if start_date is not None:
            investments = investments.filter(invested_on__gte=start_date)
        if end_date is not None:
            investments = investments.filter(invested_on__lte=end_date)

        capital_investment = _sum(investments, "amount")
        for item in investments.values("type").annotate(total=Sum("amount")):
            by_type[item["type"]] = item["total"]
        investors_count = investments.values("investor_name").distinct().count()
    except Exception:
        pass

    purchase_investment = ZERO
    purchases_count = 0
    try:
        purchases = PurchaseOrder.all_objects.filter(shop_id=shop.id).exclude(status=PurchaseOrder.Status.CANCELLED)
        if start is not None:
            purchases = purchases.filter(created_at__gte=start)
        if end is not None:
            purchases = purchases.filter(created_at__lte=end)
        purchase_investment = _sum(purchases, "total_amount")
        purchases_count = purchases.count()
    except Exception:
        pass

    total_investment = capital_investment + purchase_investment

    return {
        "capital_investment": capital_investment,
        "purchase_investment": purchase_investment,
        "total_investment": total_investment,
        "investors_count": investors_count,
        "by_type": by_type,
        "purchases_count": purchases_count,
    }


def financial_position(shop):
    """Cash balance, receivables (customer dues), payables (supplier dues), and total investments."""
    cash = _sum(
        LedgerEntry.all_objects.filter(shop_id=shop.id, account=LedgerEntry.Account.CASH),
        "amount",
    )
    bank = _sum(
        LedgerEntry.all_objects.filter(shop_id=shop.id, account=LedgerEntry.Account.BANK),
        "amount",
    )
    receivables = _sum(Customer.all_objects.filter(shop_id=shop.id), "due_balance")
    payables = _sum(Supplier.all_objects.filter(shop_id=shop.id), "due_balance")

    inv = investment_summary(shop)

    return {
        "cash_balance": cash,
        "bank_balance": bank,
        "receivables": receivables,
        "payables": payables,
        "total_investment": inv["total_investment"],
        "capital_investment": inv["capital_investment"],
        "purchase_investment": inv["purchase_investment"],
        "investors_count": inv["investors_count"],
    }
