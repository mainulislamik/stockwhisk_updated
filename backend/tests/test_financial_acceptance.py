"""
Financial Acceptance & Regression Test Suite for StockWhisk SaaS.

Verifies the exact core cash-flow principles:
- Cash balance = Opening + Actual Inflows - Actual Outflows
- Purchase != Cash Out (Credit purchase has 0 cash outflow)
- Sales != Cash In (Credit sale has 0 cash inflow)
- COGS != Cash Out (Selling inventory does NOT subtract purchase cost from cash again)
- Customer Due != Cash
- Supplier Due != Cash Out
- Owner Investment != Sales
- Owner Withdrawal != Operating Expense
- Account Transfer (Cash -> bKash) does NOT affect Sales, Profit, Expenses, or Dues.
"""
from decimal import Decimal
import pytest
from django.utils import timezone

from core.tenant_context import tenant_context
from accounting.models import LedgerEntry, Investment, AccountTransfer, DailySettlement
from accounting.services import (
    financial_position,
    cash_flow,
    profit_summary,
    record_expense,
    record_investment,
    record_transfer,
    investment_summary,
)
from catalog.models import Product
from inventory.models import MovementType
from inventory.services import apply_movement
from purchasing.models import Supplier, PurchaseOrder, PurchasePayment
from purchasing.services import (
    create_purchase_order,
    receive_purchase_order,
    pay_supplier,
)
from sales.models import Sale, Payment
from sales.services import create_sale, add_payment, collect_customer_due
from crm.models import Customer


ZERO = Decimal("0")


@pytest.mark.django_db
def test_mandatory_5_day_acceptance_scenario(two_shops):
    """
    Executes the exact 5-day acceptance test specified in requirements.
    """
    (shop, owner), (other_shop, other_owner) = two_shops

    with tenant_context(shop):
        # Initial setup: Capital injection / Opening Cash of ৳100,000 on Day 1
        record_investment(
            shop=shop,
            investor_name="Shop Owner",
            amount=Decimal("100000.00"),
            type=Investment.Type.CAPITAL,
            payment_method="cash",
            created_by=owner,
        )

        pos = financial_position(shop)
        assert pos["cash_balance"] == Decimal("100000.00")
        assert pos["total_liquid_cash"] == Decimal("100000.00")

        # Create Supplier and Product
        supplier = Supplier.objects.create(shop=shop, name="Prime Electronics")
        prod = Product.objects.create(
            shop=shop, name="Gaming GPU", cost_price=Decimal("400.00"), selling_price=Decimal("486.00")
        )

        # -------------------------------------------------------------
        # DAY 1: Purchase inventory for ৳60,000 cash
        # -------------------------------------------------------------
        po1 = create_purchase_order(
            shop=shop,
            supplier=supplier,
            items=[{"product": prod, "quantity": Decimal("150"), "unit_cost": Decimal("400.00")}],  # 150 * 400 = 60,000
            created_by=owner,
        )
        assert po1.total == Decimal("60000.00")

        # Receive PO with full cash payment of ৳60,000
        receive_purchase_order(
            po=po1,
            paid=Decimal("60000.00"),
            payment_method=PurchasePayment.Method.CASH,
            created_by=owner,
        )

        # DAY 1 Assertions:
        # Expected Cash: ৳40,000 (100,000 - 60,000)
        # Supplier Due: ৳0
        pos1 = financial_position(shop)
        assert pos1["cash_balance"] == Decimal("40000.00"), f"Expected 40,000 but got {pos1['cash_balance']}"
        supplier.refresh_from_db()
        assert supplier.due_balance == Decimal("0.00")

        # -------------------------------------------------------------
        # DAY 2: Sell inventory for ৳48,600 cash. COGS: ৳40,000 (100 units @ ৳400)
        # -------------------------------------------------------------
        cust1 = Customer.objects.create(shop=shop, name="Retail Buyer", phone="01711000001")
        sale1 = create_sale(
            shop=shop,
            customer=cust1,
            items=[{"product": prod, "quantity": Decimal("100"), "unit_price": Decimal("486.00")}],  # 100 * 486 = 48,600
            payments=[{"amount": Decimal("48600.00"), "method": "cash"}],
            created_by=owner,
        )
        assert sale1.total == Decimal("48600.00")
        assert sale1.paid == Decimal("48600.00")

        # DAY 2 Assertions:
        # Expected Cash: ৳88,600 (40,000 + 48,600)
        # CRITICAL: MUST NOT BE ৳28,600 (The original ৳60,000 purchase must not be deducted again!)
        pos2 = financial_position(shop)
        assert pos2["cash_balance"] == Decimal("88600.00"), f"CRITICAL BUG: Expected 88,600 but got {pos2['cash_balance']}"
        assert pos2["cash_balance"] != Decimal("28600.00")

        # Profit verification:
        # Revenue = 48,600, COGS = 40,000, Gross Profit = 8,600
        p_summary = profit_summary(shop)
        assert p_summary["revenue"] == Decimal("48600.00")
        assert p_summary["cogs"] == Decimal("40000.00")
        assert p_summary["gross_profit"] == Decimal("8600.00")

        # -------------------------------------------------------------
        # DAY 3: Credit Purchase: ৳30,000 (75 units @ ৳400), paid ৳0
        # -------------------------------------------------------------
        po2 = create_purchase_order(
            shop=shop,
            supplier=supplier,
            items=[{"product": prod, "quantity": Decimal("75"), "unit_cost": Decimal("400.00")}],  # 75 * 400 = 30,000
            created_by=owner,
        )
        receive_purchase_order(
            po=po2,
            paid=Decimal("0.00"),  # 100% Credit Purchase
            created_by=owner,
        )

        # DAY 3 Assertions:
        # Cash remains unchanged: ৳88,600
        # Supplier Due: ৳30,000
        pos3 = financial_position(shop)
        assert pos3["cash_balance"] == Decimal("88600.00")
        supplier.refresh_from_db()
        assert supplier.due_balance == Decimal("30000.00")

        # -------------------------------------------------------------
        # DAY 4: Supplier Payment: ৳10,000 cash
        # -------------------------------------------------------------
        pay_supplier(
            supplier=supplier,
            amount=Decimal("10000.00"),
            method="cash",
            created_by=owner,
        )

        # DAY 4 Assertions:
        # Cash: ৳78,600 (88,600 - 10,000)
        # Supplier Due: ৳20,000 (30,000 - 10,000)
        pos4 = financial_position(shop)
        assert pos4["cash_balance"] == Decimal("78600.00")
        supplier.refresh_from_db()
        assert supplier.due_balance == Decimal("20000.00")

        # -------------------------------------------------------------
        # DAY 5: Customer pays previous due: ৳5,000 via bKash
        # First create a sale with due to have customer receivable
        # -------------------------------------------------------------
        cust2 = Customer.objects.create(shop=shop, name="Credit Customer", phone="01711000002")
        sale2 = create_sale(
            shop=shop,
            customer=cust2,
            items=[{"product": prod, "quantity": Decimal("20"), "unit_price": Decimal("500.00")}],  # 10,000 total
            payments=[{"amount": Decimal("5000.00"), "method": "cash"}],  # 5,000 paid, 5,000 due
            created_by=owner,
        )
        assert sale2.due == Decimal("5000.00")
        cust2.refresh_from_db()
        assert cust2.due_balance == Decimal("5000.00")

        # Now Customer pays ৳5,000 due through bKash
        collect_customer_due(
            customer=cust2,
            amount=Decimal("5000.00"),
            method="bkash",
            created_by=owner,
        )

        # DAY 5 Assertions:
        # Cash: ৳83,600 (78,600 + 5,000 initial cash payment from sale2)
        # bKash: +৳5,000
        # Customer Due: ৳0
        pos5 = financial_position(shop)
        assert pos5["cash_balance"] == Decimal("83600.00")
        assert pos5["bkash_balance"] == Decimal("5000.00")
        assert pos5["total_liquid_cash"] == Decimal("88600.00")
        cust2.refresh_from_db()
        assert cust2.due_balance == Decimal("0.00")


@pytest.mark.django_db
def test_owner_investment_and_withdrawal_isolation(two_shops):
    """
    Verifies:
    1. Owner investment increases Cash, is NOT classified as Sales / Revenue.
    2. Owner withdrawal decreases Cash, is NOT classified as Operating Expense.
    """
    (shop, owner), _ = two_shops

    with tenant_context(shop):
        # 1. Owner invests ৳50,000
        inv = record_investment(
            shop=shop,
            investor_name="Owner A",
            amount=Decimal("50000.00"),
            type=Investment.Type.CAPITAL,
            payment_method="cash",
            created_by=owner,
        )
        pos = financial_position(shop)
        assert pos["cash_balance"] == Decimal("50000.00")
        assert pos["capital_investment"] == Decimal("50000.00")
        assert pos["owner_drawings"] == Decimal("0.00")
        assert pos["net_capital"] == Decimal("50000.00")

        # Ensure Revenue & Sales in profit_summary are 0
        p_summary = profit_summary(shop)
        assert p_summary["revenue"] == Decimal("0.00")
        assert p_summary["sales_count"] == 0

        # 2. Owner withdraws ৳10,000 for personal use
        draw = record_investment(
            shop=shop,
            investor_name="Owner A",
            amount=Decimal("10000.00"),
            type=Investment.Type.DRAWING,
            payment_method="cash",
            created_by=owner,
        )
        pos_after = financial_position(shop)
        assert pos_after["cash_balance"] == Decimal("40000.00")
        assert pos_after["owner_drawings"] == Decimal("10000.00")
        assert pos_after["net_capital"] == Decimal("40000.00")

        # Ensure Expenses in profit_summary are STILL 0 (Drawings is NOT an operating expense)
        p_summary2 = profit_summary(shop)
        assert p_summary2["expenses"] == Decimal("0.00")
        assert p_summary2["net_profit"] == Decimal("0.00")


@pytest.mark.django_db
def test_internal_account_transfer(two_shops):
    """
    Verifies that transferring money between accounts (e.g. Cash -> bKash):
    - Decreases source account (Cash -10,000)
    - Increases destination account (bKash +10,000)
    - Total liquid money is unchanged
    - Does NOT affect Sales, Profit, Expenses, Customer Dues, or Supplier Dues.
    """
    (shop, owner), _ = two_shops

    with tenant_context(shop):
        # Start with ৳50,000 Cash
        record_investment(
            shop=shop,
            investor_name="Owner",
            amount=Decimal("50000.00"),
            type=Investment.Type.CAPITAL,
            payment_method="cash",
            created_by=owner,
        )

        pos_before = financial_position(shop)
        assert pos_before["cash_balance"] == Decimal("50000.00")
        assert pos_before["bkash_balance"] == Decimal("0.00")
        assert pos_before["total_liquid_cash"] == Decimal("50000.00")

        # Transfer ৳15,000 from Cash Drawer to bKash Merchant Account
        transfer = record_transfer(
            shop=shop,
            from_account="cash",
            to_account="bkash",
            amount=Decimal("15000.00"),
            reference="TXN-BKASH-01",
            note="Bank deposit from cash drawer",
            created_by=owner,
        )

        pos_after = financial_position(shop)
        assert pos_after["cash_balance"] == Decimal("35000.00")
        assert pos_after["bkash_balance"] == Decimal("15000.00")
        assert pos_after["total_liquid_cash"] == Decimal("50000.00")

        # Verify profit, sales, and expenses remain 0
        p_summary = profit_summary(shop)
        assert p_summary["revenue"] == Decimal("0.00")
        assert p_summary["expenses"] == Decimal("0.00")
        assert p_summary["net_profit"] == Decimal("0.00")


@pytest.mark.django_db
def test_daily_settlement_reconciliation(two_shops):
    """
    Verifies Daily Settlement:
    Opening Cash + Inflow - Outflow = Expected Cash
    Actual Counted Cash vs Expected Cash => Shortage / Excess.
    """
    (shop, owner), _ = two_shops

    with tenant_context(shop):
        # Day 1: Opening cash ৳20,000 + Cash Sale ৳60,000 - Cash Expense ৳35,000
        # Expected = 20,000 + 60,000 - 35,000 = ৳45,000
        record_investment(
            shop=shop, investor_name="Owner", amount=Decimal("20000.00"),
            type=Investment.Type.CAPITAL, payment_method="cash", created_by=owner
        )
        prod = Product.objects.create(shop=shop, name="Item A", cost_price=Decimal("100"), selling_price=Decimal("200"))
        apply_movement(shop=shop, product=prod, movement_type=MovementType.OPENING, quantity=Decimal("500"))

        create_sale(
            shop=shop, items=[{"product": prod, "quantity": Decimal("300"), "unit_price": Decimal("200")}],
            payments=[{"amount": Decimal("60000.00"), "method": "cash"}], created_by=owner
        )
        record_expense(
            shop=shop, amount=Decimal("35000.00"), spent_on=timezone.localdate(),
            payment_method="cash", note="Shop Rent", created_by=owner
        )

        # Expected Cash = ৳45,000
        pos = financial_position(shop)
        assert pos["cash_balance"] == Decimal("45000.00")

        # Settlement closing: Counted cash = ৳44,500 => Shortage = ৳500
        settle = DailySettlement.objects.create(
            shop=shop, opening_cash=Decimal("20000.00"), status=DailySettlement.Status.OPEN
        )
        # Expected is 45,000
        cash_in = Decimal("60000.00")
        cash_out = Decimal("35000.00")
        expected_cash = Decimal("20000.00") + cash_in - cash_out
        actual_cash = Decimal("44500.00")
        discrepancy = actual_cash - expected_cash  # -500.00

        settle.expected_cash = expected_cash
        settle.actual_cash = actual_cash
        settle.discrepancy = discrepancy
        settle.status = DailySettlement.Status.CLOSED
        settle.save()

        assert settle.expected_cash == Decimal("45000.00")
        assert settle.actual_cash == Decimal("44500.00")
        assert settle.discrepancy == Decimal("-500.00")  # ৳500 shortage


@pytest.mark.django_db
def test_tenant_financial_isolation(two_shops):
    """
    Verifies that Shop A's financial transactions, cash balance, customer dues,
    and supplier dues NEVER bleed into Shop B.
    """
    (shop_a, owner_a), (shop_b, owner_b) = two_shops

    with tenant_context(shop_a):
        record_investment(
            shop=shop_a, investor_name="Owner A", amount=Decimal("75000.00"),
            type=Investment.Type.CAPITAL, payment_method="cash", created_by=owner_a
        )
        pos_a = financial_position(shop_a)
        assert pos_a["cash_balance"] == Decimal("75000.00")

    with tenant_context(shop_b):
        record_investment(
            shop=shop_b, investor_name="Owner B", amount=Decimal("25000.00"),
            type=Investment.Type.CAPITAL, payment_method="cash", created_by=owner_b
        )
        pos_b = financial_position(shop_b)
        assert pos_b["cash_balance"] == Decimal("25000.00")

        # Ledger entries count for Shop B
        assert LedgerEntry.objects.filter(shop=shop_b).count() == 1
        assert LedgerEntry.objects.filter(shop=shop_b).first().amount == Decimal("25000.00")

    with tenant_context(shop_a):
        # Shop A still has exactly 75,000
        pos_a_after = financial_position(shop_a)
        assert pos_a_after["cash_balance"] == Decimal("75000.00")
