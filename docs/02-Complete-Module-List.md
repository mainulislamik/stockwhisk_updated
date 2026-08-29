# Complete Module List

This document provides a detailed inventory of all Django apps (modules) within the StockWhisk system.

## 1. tenants
- **Description:** Core multi-tenancy management. Handles the creation and configuration of isolated shop environments.
- **Key Models:** `Shop` (Tenant entity), `Branch` (Physical locations), `Subscription` (Tenant plan details).
- **Key API Endpoints:** `/api/tenants/shops/`, `/api/tenants/branches/`
- **Dependencies:** None (Core dependency for almost all other modules).
- **Status:** Active

## 2. accounts
- **Description:** User authentication, authorization, and profile management.
- **Key Models:** `User` (Custom auth model), `Role` (RBAC group), `Permission` (System capabilities), `Registration` (OTP/Sign-up flow).
- **Key API Endpoints:** `/api/accounts/login/`, `/api/accounts/register/`, `/api/accounts/roles/`
- **Dependencies:** `tenants`
- **Status:** Active

## 3. catalog
- **Description:** Product information management (PIM). Defines what is sold.
- **Key Models:** `Product`, `Category`, `Brand`, `Unit`, `ProductVariation` (Size/Color), `ProductUnit` (Unique serial instances).
- **Key API Endpoints:** `/api/catalog/products/`, `/api/catalog/categories/`
- **Dependencies:** `tenants`
- **Status:** Active

## 4. inventory
- **Description:** Tracks the movement and stock levels of products across branches.
- **Key Models:** `StockMovement` (Ledger of additions/deductions).
- **Key API Endpoints:** `/api/inventory/movements/`, `/api/inventory/adjust/`
- **Dependencies:** `tenants`, `catalog`
- **Status:** Active

## 5. crm
- **Description:** Customer Relationship Management.
- **Key Models:** `Customer` (Profile & balances), `CustomerPayment` (Due collections).
- **Key API Endpoints:** `/api/crm/customers/`, `/api/crm/payments/`
- **Dependencies:** `tenants`
- **Status:** Active

## 6. purchasing
- **Description:** Procurement and supplier management.
- **Key Models:** `Supplier`, `PurchaseOrder`, `PurchaseOrderItem`, `PurchasePayment`, `SupplierPayment`.
- **Key API Endpoints:** `/api/purchasing/suppliers/`, `/api/purchasing/orders/`
- **Dependencies:** `tenants`, `catalog`, `inventory`
- **Status:** Active

## 7. sales
- **Description:** Core sales processing and historical invoice tracking.
- **Key Models:** `Sale` (Invoice), `SaleItem`, `Payment` (Transaction), `SaleReturn`, `SaleReturnItem`, `EMISchedule`, `EMIInstallment`.
- **Key API Endpoints:** `/api/sales/invoices/`, `/api/sales/returns/`, `/api/sales/emi/`
- **Dependencies:** `tenants`, `catalog`, `crm`, `inventory`, `accounting`
- **Status:** Active

## 8. pos
- **Description:** Highly optimized views tailored specifically for the fast-checkout Point of Sale interface.
- **Key Models:** (Relies on `sales` models).
- **Key API Endpoints:** `/api/pos/checkout/`, `/api/pos/cart/`
- **Dependencies:** `sales`, `catalog`, `crm`
- **Status:** Active

## 9. accounting
- **Description:** General ledger and financial tracking.
- **Key Models:** `Expense`, `ExpenseCategory`, `RecurringExpense`, `LedgerEntry` (Append-only cash flow), `DailySettlement`, `Investment`, `AccountTransfer`.
- **Key API Endpoints:** `/api/accounting/expenses/`, `/api/accounting/ledger/`, `/api/accounting/settlements/`
- **Dependencies:** `tenants`
- **Status:** Active

## 10. analytics
- **Description:** Aggregation views for dashboards and data visualization.
- **Key Models:** None (Uses raw SQL/ORM aggregations on other models).
- **Key API Endpoints:** `/api/analytics/dashboard/`, `/api/analytics/sales-summary/`
- **Dependencies:** `sales`, `inventory`, `accounting`
- **Status:** Active

## 11. billing
- **Description:** SaaS platform subscription billing and invoice management.
- **Key Models:** `SubscriptionInvoice`, `ManualPayment` (Proof uploads).
- **Key API Endpoints:** `/api/billing/invoices/`, `/api/billing/upload-payment/`
- **Dependencies:** `tenants`
- **Status:** Active

## 12. branches
- **Description:** Logistics for moving physical goods between different shop branches.
- **Key Models:** `StockTransfer`, `StockTransferItem`.
- **Key API Endpoints:** `/api/branches/transfers/`
- **Dependencies:** `tenants`, `inventory`, `catalog`
- **Status:** Active

## 13. notifications
- **Description:** Alerting system for users (In-app, SMS, Email, WhatsApp).
- **Key Models:** `Notification`, `ShopAlertConfig`, `ShopWhatsAppConfig`.
- **Key API Endpoints:** `/api/notifications/list/`, `/api/notifications/config/`
- **Dependencies:** `tenants`, `accounts`
- **Status:** Active

## 14. service
- **Description:** Warranty claim processing and repair ticketing system.
- **Key Models:** `Warranty`, `WarrantyClaim`, `ServiceTicket`, `ServiceTicketPart`, `ServiceTicketStatusHistory`.
- **Key API Endpoints:** `/api/service/tickets/`, `/api/service/warranty/`
- **Dependencies:** `tenants`, `catalog`, `sales`, `inventory`
- **Status:** Active

## 15. resellers
- **Description:** Partner portal for tracking referrals and commissions.
- **Key Models:** `ResellerProfile`, `ResellerCommission`.
- **Key API Endpoints:** `/api/resellers/profile/`, `/api/resellers/commissions/`
- **Dependencies:** `accounts`, `tenants`, `billing`
- **Status:** Active

## 16. public_api
- **Description:** External developer API access layer.
- **Key Models:** `APIKey`.
- **Key API Endpoints:** `/api/public/v1/...`
- **Dependencies:** Core models across apps.
- **Status:** Planned/Active

## 17. platform_admin
- **Description:** Super admin tools for managing the entire SaaS platform.
- **Key Models:** `PlatformConfig`, `TutorialVideo`, `BlogPost`, `SoftwareRelease`, `ShopDataBackup`.
- **Key API Endpoints:** `/admin/...` (Django Admin or custom internal API)
- **Dependencies:** `tenants`, `billing`
- **Status:** Active

## 18. reports
- **Description:** Dedicated views for generating and exporting complex CSV/PDF reports.
- **Key Models:** (Relies on models across apps).
- **Key API Endpoints:** `/api/reports/sales/`, `/api/reports/inventory/`
- **Dependencies:** `sales`, `inventory`, `accounting`, `crm`
- **Status:** Active

## 19. scanner
- **Description:** Utilities supporting mobile barcode scanner integration.
- **Key Models:** N/A
- **Key API Endpoints:** `/api/scanner/process/`
- **Dependencies:** `catalog`, `sales`
- **Status:** Active

## 20. imports
- **Description:** Bulk data ingestion utilities (e.g., importing legacy catalogs).
- **Key Models:** N/A (Tracks import jobs via Celery).
- **Key API Endpoints:** `/api/imports/csv/`
- **Dependencies:** `catalog`, `crm`
- **Status:** Active

## 21. web
- **Description:** Handles server-rendered templates (e.g., public landing pages, invoice PDFs, password reset emails).
- **Key Models:** N/A
- **Dependencies:** Various
- **Status:** Active

## 22. core
- **Description:** Foundational utilities and middleware, particularly for multi-tenancy.
- **Key Components:** `TenantScopedModel` (Base model ensuring tenant isolation), `TenantManager`, `TenantMiddleware` (Extracts tenant from request), `tenant_context` (Thread-local storage).
- **Dependencies:** None
- **Status:** Active
