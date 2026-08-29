# Regression Testing Plan

## Purpose
Ensure that new code changes do not break existing functionality across the StockWhisk multi-tenant SaaS application.

## Regression Test Suite Organization

### Critical Path Tests (Must pass before ANY release)
1. User login and authentication
2. POS checkout (scan → cart → payment → invoice)
3. Product creation and stock tracking
4. Sales return and refund
5. Due collection
6. Daily settlement
7. Multi-tenant data isolation

### Module Regression Tests
#### POS Module
- **Key Test Cases:** Add to cart by barcode, apply discount, split payment, generate invoice.
- **Data Dependencies:** Active products with stock, valid tax configurations.
- **Expected Execution Time:** 5 mins (Automated), 15 mins (Manual)

#### Products Module
- **Key Test Cases:** Create product with variants, update pricing, bulk import, barcode generation.
- **Data Dependencies:** Categories, Brands, Units defined.
- **Expected Execution Time:** 3 mins (Automated)

#### Inventory Module
- **Key Test Cases:** Stock transfer between branches, stock adjustment, low stock alerts.
- **Data Dependencies:** Multiple branches/warehouses, existing stock.
- **Expected Execution Time:** 4 mins (Automated)

#### Sales & Returns
- **Key Test Cases:** View sales history, process full return, process partial return, refund to customer balance.
- **Data Dependencies:** Completed sales records.
- **Expected Execution Time:** 5 mins (Automated)

#### CRM Module
- **Key Test Cases:** Add customer, update credit limit, customer ledger view.
- **Data Dependencies:** None.
- **Expected Execution Time:** 2 mins (Automated)

#### EMI Module
- **Key Test Cases:** Create EMI plan, calculate interest, process monthly installment, calculate late fees.
- **Data Dependencies:** EMI-enabled products, active customers.
- **Expected Execution Time:** 6 mins (Automated)

#### Accounting Module
- **Key Test Cases:** Chart of accounts tree, journal entry, trial balance generation, P&L report.
- **Data Dependencies:** Existing financial transactions.
- **Expected Execution Time:** 7 mins (Automated)

#### Service Module
- **Key Test Cases:** Create service job, assign technician, update job status, invoice service.
- **Data Dependencies:** Active technicians, service items.
- **Expected Execution Time:** 4 mins (Automated)

#### Purchasing Module
- **Key Test Cases:** Create PO, receive goods, supplier payment, purchase return.
- **Data Dependencies:** Active suppliers, product master data.
- **Expected Execution Time:** 5 mins (Automated)

#### Settings Module
- **Key Test Cases:** Update store profile, configure tax rates, role management, receipt template changes.
- **Data Dependencies:** Admin access.
- **Expected Execution Time:** 3 mins (Automated)

### Integration Tests
- **POS → Stock deduction → Accounting ledger:** Verify that a sale correctly reduces inventory and logs revenue.
- **Purchase → Stock increase → Supplier payable:** Verify receiving a PO increases stock and updates supplier balance.
- **Return → Stock restock → Cash refund ledger:** Verify returns increase stock and debit the cash account.
- **Due collection → Cash increase → Customer balance update:** Verify receiving payment clears customer dues and credits cash.
- **Settlement → Expected cash calculation:** Verify end-of-day settlement correctly aggregates all cash inflows/outflows.

## Execution Schedule
- Before every production deployment
- After database migrations
- After major feature additions
- Weekly scheduled runs (Automated)

## Tools & Framework
- **Backend:** `pytest` + Django TestCase
- **Frontend:** Manual smoke testing checklist (Future: Playwright/Cypress)
- **API:** Postman collection or automated scripts

## Rollback Criteria
- **P1 Failures:** Any P1 test failure blocks deployment immediately.
- **P2 Failures:** Require team review; generally blocks unless an acceptable workaround is approved.
- **P3 Failures:** Are logged in the issue tracker for resolution in the next sprint, deployment may proceed.
