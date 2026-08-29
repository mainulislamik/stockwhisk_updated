# Complete User Flows

This document details every major user flow step-by-step, including preconditions, postconditions, expected results, and related APIs.

---

### 1. User Registration & Onboarding Flow
*   **Preconditions:** User has a valid phone number.
*   **Actor:** New User/Shop Owner
*   **Steps:**
    1. Enter name, phone, email, shop name.
    2. Request OTP.
    3. Enter OTP and set password.
*   **Expected Results:** Shop created, User created as Owner, JWT token returned.
*   **Error Scenarios:** Invalid OTP, Phone already exists.
*   **APIs:** `POST /api/auth/register`, `POST /api/auth/verify-otp`

### 2. Login & Authentication Flow
*   **Preconditions:** Account exists and is verified.
*   **Actor:** Any User
*   **Steps:**
    1. Enter phone and password.
    2. Click login.
*   **Expected Results:** JWT access and refresh tokens returned, User profile loaded.
*   **Error Scenarios:** Invalid credentials, Inactive account.
*   **APIs:** `POST /api/auth/token`

### 3. POS Checkout Flow
*   **Preconditions:** Cash drawer open, products in stock.
*   **Actor:** Cashier
*   **Steps:**
    1. Scan barcode or search product.
    2. Add to cart, adjust qty/price.
    3. Select/add customer.
    4. Select payment method(s) and enter amounts.
    5. Submit sale.
*   **Expected Results:** Sale created, stock deducted, ledger updated, invoice printed.
*   **Error Scenarios:** Insufficient stock, Invalid payment amount.
*   **APIs:** `GET /api/pos/products`, `POST /api/pos/checkout`

### 4. Product Creation Flow
*   **Preconditions:** User has product management permission.
*   **Actor:** Manager/Admin
*   **Steps:**
    1. Navigate to Products > Add New.
    2. Enter name, category, brand, cost, price.
    3. Toggle `is_serialized` or `track_inventory`.
    4. Save.
*   **Expected Results:** Product record created.
*   **Error Scenarios:** Duplicate SKU.
*   **APIs:** `POST /api/inventory/products`

### 5. Product Purchase/Stock-In Flow
*   **Preconditions:** Supplier exists.
*   **Actor:** Manager/Admin
*   **Steps:**
    1. Select Supplier.
    2. Add products, define cost and qty.
    3. If serialized, enter/scan serial numbers.
    4. Enter payment amount (full, partial, or credit).
    5. Save Purchase.
*   **Expected Results:** Stock increased, Supplier payable updated, Ledger updated.
*   **Error Scenarios:** Missing serials for serialized item.
*   **APIs:** `POST /api/inventory/purchases`

### 6. Sales Return & Refund Flow
*   **Preconditions:** Original sale exists.
*   **Actor:** Cashier/Manager
*   **Steps:**
    1. Lookup invoice.
    2. Select items to return and condition (restock or damage).
    3. Process refund amount.
*   **Expected Results:** Stock adjusted based on condition, cash deducted, return invoice generated.
*   **Error Scenarios:** Return qty exceeds sale qty.
*   **APIs:** `POST /api/pos/returns`

### 7. Product Exchange/Replacement Flow
*   **Preconditions:** Customer returning defective unit within warranty.
*   **Actor:** Manager
*   **Steps:**
    1. Lookup serial/invoice.
    2. Mark old unit as `TESTING_PENDING`.
    3. Issue new unit from stock.
    4. Transfer warranty.
*   **Expected Results:** Inventory swapped, warranty updated.
*   **Error Scenarios:** No replacement stock available.
*   **APIs:** `POST /api/inventory/exchanges`

### 8. Due Collection Flow
*   **Preconditions:** Customer has `due_balance > 0`.
*   **Actor:** Cashier
*   **Steps:**
    1. Select Customer.
    2. Enter collection amount and payment method.
    3. Apply to specific invoices or auto-apply to oldest.
    4. Save.
*   **Expected Results:** Customer due reduced, cash increased, sale status updated.
*   **Error Scenarios:** Collection exceeds due.
*   **APIs:** `POST /api/customers/collect-due`

### 9. EMI Creation & Payment Flow
*   **Preconditions:** Customer approved for EMI.
*   **Actor:** Manager
*   **Steps:**
    1. At POS, select EMI payment.
    2. Set down payment, interest rate, months.
    3. Generate schedule.
    4. Accept down payment.
*   **Expected Results:** EMI schedule created, initial payment recorded.
*   **Error Scenarios:** Invalid math configuration.
*   **APIs:** `POST /api/pos/checkout` (with EMI payload), `POST /api/emi/pay-installment`

### 10. Daily Settlement/Shift Closing Flow
*   **Preconditions:** End of day/shift.
*   **Actor:** Cashier/Manager
*   **Steps:**
    1. Open Settlement screen.
    2. Count physical cash.
    3. Enter actual cash amount.
    4. Submit.
*   **Expected Results:** Expected vs Actual calculated, discrepancy logged, shift closed.
*   **Error Scenarios:** Pending unhandled transactions.
*   **APIs:** `POST /api/accounting/settlements`

### 11. Expense Recording Flow
*   **Preconditions:** Expense categories configured.
*   **Actor:** Any staff (with permission)
*   **Steps:**
    1. Select Category.
    2. Enter amount, note, and payment source.
    3. Save.
*   **Expected Results:** Ledger cash reduced, Expense recorded.
*   **Error Scenarios:** Insufficient funds in selected account.
*   **APIs:** `POST /api/accounting/expenses`

### 12. Capital Investment & Drawing Flow
*   **Preconditions:** Owner account.
*   **Actor:** Owner
*   **Steps:**
    1. Go to Equity.
    2. Select Invest or Draw.
    3. Enter amount and account.
*   **Expected Results:** Ledger and Equity totals updated.
*   **APIs:** `POST /api/accounting/equity`

### 13. Account Transfer Flow
*   **Preconditions:** Multiple accounts exist (e.g., Cash, Bank).
*   **Actor:** Manager/Owner
*   **Steps:**
    1. Select From Account and To Account.
    2. Enter amount.
    3. Save.
*   **Expected Results:** Double ledger entry created, no net P&L change.
*   **Error Scenarios:** Transfer exceeds available balance.
*   **APIs:** `POST /api/accounting/transfers`

### 14. Warranty Verification Flow
*   **Preconditions:** None.
*   **Actor:** Staff
*   **Steps:**
    1. Scan/enter serial number or invoice ID.
    2. View status.
*   **Expected Results:** Displays Active/Expired status and days remaining.
*   **APIs:** `GET /api/inventory/warranty-check`

### 15. Service Ticket Lifecycle Flow
*   **Preconditions:** Device received for repair.
*   **Actor:** Technician/Manager
*   **Steps:**
    1. Create ticket (RECEIVED).
    2. Update to DIAGNOSING.
    3. Add parts and labor cost (IN_REPAIR).
    4. Mark READY and notify customer.
    5. Take payment and mark DELIVERED.
*   **Expected Results:** Ticket tracks history, parts deducted upon delivery, cash collected.
*   **APIs:** `POST /api/service/tickets`, `PATCH /api/service/tickets/{id}/status`

### 16. Barcode Generation & Printing Flow
*   **Preconditions:** Products exist.
*   **Actor:** Manager
*   **Steps:**
    1. Select products and quantities.
    2. Configure label size.
    3. Print via browser print dialog.
*   **Expected Results:** Labels sent to printer.
*   **APIs:** Frontend specific.

### 17. Item/Serial Lookup Flow
*   **Preconditions:** None.
*   **Actor:** Staff
*   **Steps:**
    1. Global search serial number.
    2. View product lifecycle (purchase, sale, return history).
*   **Expected Results:** Complete audit trail of unit.
*   **APIs:** `GET /api/inventory/serials/{serial}`

### 18. Staff User Creation & Permission Assignment Flow
*   **Preconditions:** Owner/Admin access.
*   **Actor:** Owner
*   **Steps:**
    1. Create user (name, phone, pin).
    2. Select Role (Cashier, Manager).
    3. Customize specific permissions if needed.
*   **Expected Results:** Staff can log in with scoped access.
*   **APIs:** `POST /api/users/staff`

### 19. Customer Profile & History Flow
*   **Preconditions:** Customer exists.
*   **Actor:** Any Staff
*   **Steps:**
    1. Open Customer profile.
    2. View stats, due balance, and past invoices.
*   **Expected Results:** Aggregated customer data displayed.
*   **APIs:** `GET /api/customers/{id}`

### 20. Report Generation & Export Flow
*   **Preconditions:** Data exists.
*   **Actor:** Manager/Owner
*   **Steps:**
    1. Navigate to Reports.
    2. Select date range and report type (Sales, P&L, Tax).
    3. Click Export to Excel/PDF.
*   **Expected Results:** File downloaded.
*   **APIs:** `GET /api/reports/sales?export=csv`
