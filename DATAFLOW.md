# StockWhisk — Data Flow Documentation

> A single reference that lets **any person or AI model** understand every major
> operation in this system: what the pieces are, how a request travels, where
> data is stored, and how money, stock, and records stay consistent.
>
> Diagrams are [Mermaid](https://mermaid.js.org/) — they render automatically on
> GitHub and in most Markdown viewers. Read top-to-bottom: it goes from the
> 10,000-ft view down to individual transactional flows.

---

## 1. What StockWhisk is

**StockWhisk** is a **multi-tenant retail ERP + Point-of-Sale (POS) SaaS**. One
deployment serves many independent shops ("tenants"). Each shop manages its own
products, inventory, sales, customers, suppliers, purchases, expenses, staff,
warranties, and repair tickets. A **platform (super) admin** operates across all
tenants.

- **Backend:** Django 5 + Django REST Framework, JWT + session auth. Serves both
  a JSON API (`/api/*`) and a **server-rendered shop UI** (the `web` app,
  mounted at `/`) built with Django templates + Alpine.js + Bootstrap.
- **Frontend (optional/alternate):** a Next.js 14 app in `frontend/` that
  reproduces the UI against the same API. The primary shipped UI is the
  server-rendered `web` app.
- **Async:** Celery workers + beat scheduler, Redis broker.
- **Data:** PostgreSQL (prod) / MySQL / SQLite (dev) — engine is env-switchable.
- **Edge:** Caddy reverse proxy (TLS, static/media).

### Tech-stack at a glance

| Concern            | Choice                                                            |
|--------------------|-------------------------------------------------------------------|
| Web framework      | Django 5, Django REST Framework                                   |
| Auth               | SimpleJWT (API) + Django sessions (server-rendered UI)            |
| Async / scheduled  | Celery worker + Celery beat (`django_celery_beat`), Redis broker  |
| Cache              | Redis (falls back to in-memory locmem)                            |
| DB                 | Postgres / MySQL / SQLite (`DB_ENGINE`)                           |
| Multi-tenancy      | Shared DB, shared schema, scoped by `shop_id`                     |
| External services  | Anthropic Claude (AI insights), WhatsApp Cloud API, SMTP email, Google Drive (backups) |
| Reverse proxy      | Caddy                                                             |

---

## 2. Level 0 — System context (who talks to the system)

```mermaid
flowchart TB
    subgraph external[External Actors]
        owner([Shop Owner / Manager])
        cashier([Cashier / Staff])
        customer([Walk-in / Registered Customer])
        supplier([Supplier])
        superadmin([Platform Super Admin])
        apiclient([Enterprise API Client])
    end

    subgraph system[StockWhisk Platform]
        app[[StockWhisk<br/>Backend + UI]]
    end

    subgraph thirdparty[Third-party Services]
        claude[/Anthropic Claude API/]
        whatsapp[/WhatsApp Cloud API/]
        smtp[/SMTP Email/]
        gdrive[/Google Drive/]
    end

    owner -->|manage shop, view reports| app
    cashier -->|ring up sales at POS| app
    customer -->|receives invoice / WhatsApp msg| app
    supplier -->|goods received, payments recorded| app
    superadmin -->|operate platform, impersonate, backups| app
    apiclient -->|REST /api/v1 with API key| app

    app -->|AI insight prompts| claude
    app -->|order/warranty alerts| whatsapp
    app -->|OTP, receipts, reminders| smtp
    app -->|nightly DB backup| gdrive
```

**Reading it:** humans and API clients act on the platform; the platform reaches
out to four external services for AI, messaging, email, and off-site backups.

---

## 3. Deployment / container view (docker-compose)

```mermaid
flowchart LR
    browser([Browser]) --> caddy

    subgraph compose[docker-compose stack]
        caddy[Caddy<br/>:80/:443] --> frontend[Next.js frontend<br/>:3000]
        caddy --> backend
        frontend -->|/api/*| backend[Django + Gunicorn<br/>:8000]
        backend <--> db[(PostgreSQL)]
        backend <--> redis[(Redis)]
        worker[Celery worker] <--> db
        worker <--> redis
        beat[Celery beat] --> redis
        beat <--> db
    end

    backend -. static/media volumes .- caddy
```

- **`backend`** — Gunicorn serving `config.wsgi` (API + server-rendered UI).
- **`worker`** — executes background jobs (emails, backups, reminders).
- **`beat`** — enqueues periodic jobs on a schedule (see §12).
- **`redis`** — Celery broker + result backend + cache.
- **`db`** — the single source of truth for all tenant data.

> When `REDIS_URL` is unset, Celery runs **eagerly** (synchronously in-process) —
> handy for local dev without Redis.

---

## 4. Multi-tenancy — the rule that governs *every* data flow

This is the single most important concept. Get it and the rest follows.

**Strategy:** *shared database, shared schema, scoped by `shop_id`.* Every
tenant-owned table has a `shop` foreign key. A request never says "give me
products" — it always effectively means "give me **this shop's** products."

```mermaid
flowchart TB
    req[Incoming request] --> mw[TenantMiddleware]

    mw --> imp{Impersonation<br/>session set?}
    imp -->|yes| setshop[request.tenant = impersonated Shop]
    imp -->|no| usershop{Authenticated<br/>user has shop?}
    usershop -->|yes| setshop2[request.tenant = user.shop]
    usershop -->|no| noshop[request.tenant = None]

    setshop --> tl[set_current_tenant in thread-local]
    setshop2 --> tl
    noshop --> tl

    tl --> view[View / service runs]
    view --> mgr[TenantManager.get_queryset]

    mgr --> bypass{bypass_tenant_scope<br/>active?}
    bypass -->|yes super-admin| allrows[Return ALL rows]
    bypass -->|no| hastenant{tenant set?}
    hastenant -->|yes| filtered["filter(shop_id=tenant)"]
    hastenant -->|no| empty["EMPTY queryset (fail-closed)"]

    view --> resp[Response] --> clear[clear_current_tenant]
```

Key mechanics (in `core/`):

- **`core/middleware.py::TenantMiddleware`** resolves the tenant per request and
  stores it in a **thread-local** (`core/tenant_context.py`). It's always cleared
  at the end of the request so a reused worker thread never leaks a stale tenant.
- **`core/models.py::TenantManager`** is the default `.objects` manager on every
  `TenantScopedModel`. It auto-injects `filter(shop_id=<current tenant>)`.
  - **Fail-closed:** if no tenant is set, it returns an **empty** queryset — a
    forgotten scope can never leak another shop's data.
  - **`all_objects`** is the unscoped escape hatch (migrations, analytics,
    platform admin) that handles isolation itself.
  - **`bypass_tenant_scope()`** lets trusted cross-tenant code (super admin,
    cross-tenant analytics) opt out — deliberately verbose so it's easy to audit.
- **`TenantScopedModel.save()`** auto-stamps `shop_id` from the thread-local on
  create, preventing "forgot to set shop" bugs.

> ⚠️ Because the tenant lives in a thread-local, **Celery tasks and management
> commands must set it explicitly** via `tenant_context(shop)` or
> `set_current_tenant(shop)` — they have no middleware to do it for them.

---

## 5. Level 1 — Major processes & data stores

The system decomposes into these process clusters (Django apps) around a shared
database. Arrows show the dominant direction of data flow.

```mermaid
flowchart TB
    actor([User / API client])

    subgraph edge[Interface layer]
        webui[web<br/>server-rendered UI]
        api[DRF API<br/>/api/*]
        pubapi[public_api<br/>/api/v1 + API key]
    end

    subgraph core_layer[Cross-cutting core]
        accounts[accounts<br/>Users + RBAC]
        tenants[tenants<br/>Shop / Branch / Plan]
        audit[audit<br/>AuditLog]
    end

    subgraph business[Business processes]
        catalog[catalog<br/>Products / Units]
        inventory[inventory<br/>Stock ledger]
        pos[pos<br/>Cart / checkout]
        sales[sales<br/>Invoices / returns / EMI]
        purchasing[purchasing<br/>POs / suppliers]
        crm[crm<br/>Customers]
        accounting[accounting<br/>Ledger / expenses]
        service[service<br/>Warranty / repairs]
        analytics[analytics<br/>Aggregations]
        billing[billing<br/>Subscriptions]
        notifications[notifications<br/>Alerts / WhatsApp]
        reports[reports<br/>Exports]
    end

    db[(Relational DB)]

    actor --> webui & api & pubapi
    webui & api & pubapi --> accounts
    accounts --> tenants

    webui --> pos --> sales
    api --> sales
    sales --> inventory
    sales --> accounting
    sales --> crm
    sales --> service
    purchasing --> inventory
    purchasing --> accounting
    purchasing --> catalog
    inventory --> catalog

    business --> db
    core_layer --> db
    sales --> audit
    purchasing --> audit
    analytics --> db
    notifications -.-> business
```

### Primary data stores (tables) and their owners

| Store (model)                     | App          | Role in the system                                             |
|-----------------------------------|--------------|----------------------------------------------------------------|
| `Shop`, `Branch`, `SubscriptionPlan`, `Subscription` | tenants   | Tenant roots + billing tier / limits                         |
| `User`, `Role`, `Permission`      | accounts     | Identity + fine-grained RBAC                                    |
| `Product`, `ProductVariation`, `ProductUnit`, `Category`, `Brand`, `Unit` | catalog | Sellable catalog; `ProductUnit` = one serialized physical item |
| `StockMovement`                   | inventory    | **Append-only stock ledger — source of truth for stock**       |
| `Sale`, `SaleItem`, `Payment`, `SaleReturn`, `SaleReturnItem`, `EMISchedule`, `EMIInstallment` | sales | Invoices, line items, receipts, returns, installments |
| `Customer`                        | crm          | Buyers, dues, loyalty, WhatsApp consent                        |
| `Supplier`, `PurchaseOrder`, `PurchaseOrderItem`, `PurchasePayment`, `SupplierPayment` | purchasing | Procurement + payables |
| `LedgerEntry`, `Expense`, `RecurringExpense`, `ExpenseCategory`, `DailySettlement` | accounting | **Append-only cash ledger**, costs, EOD settlement |
| `Warranty`, `WarrantyClaim`, `ServiceTicket`, ...  | service | Post-sale warranty + repair workflow                           |
| `AuditLog`                        | audit        | Who did what, per shop                                          |
| `Notification`, alert configs     | notifications| In-app + WhatsApp alerts                                        |
| `APIKey`                          | public_api   | Hashed keys for the Enterprise REST surface                    |

**Two ledgers are the backbone of correctness:**

1. **`StockMovement`** — every stock change is one immutable, signed row.
   `Product.current_stock` is only a **cache** derived from summing movements.
2. **`LedgerEntry`** — every cash movement (in +, out −) is one immutable row.

Because both are append-only, you can always reconstruct *why* stock or cash is
what it is — and reconcile the caches against the ledgers.

---

## 6. Authentication & onboarding flows

### 6a. Shop registration with email OTP

```mermaid
sequenceDiagram
    autonumber
    actor U as New Owner
    participant API as accounts API
    participant PR as PendingRegistration
    participant Mail as SMTP
    participant Shop as Shop + User + Roles

    U->>API: POST register (shop, owner, password)
    API->>PR: store details + 6-digit OTP + expiry
    API->>Mail: email OTP to owner
    Mail-->>U: OTP code
    U->>API: POST verify (email, OTP)
    API->>PR: validate OTP + not expired
    API->>Shop: create Shop, owner User, seed default Roles
    API-->>U: success -> can log in
```

Registration details are parked in **`PendingRegistration`** until the OTP is
verified — no half-created shops. Password reset uses the same OTP pattern via
`PasswordResetOTP`.

### 6b. Login & request authorization (two auth modes)

```mermaid
flowchart TB
    subgraph apis[API clients]
        a1[POST /api/auth/token/] -->|email+pw| jwt[JWT access + refresh]
        jwt -->|Bearer token| a2[Authenticated API calls]
        a2 -->|401 expired| refresh[POST /api/auth/token/refresh/]
    end

    subgraph webui[Server-rendered UI]
        w1[POST web:login] --> sess[Django session cookie]
        sess --> w2[Authenticated page requests]
    end

    a2 --> rbac
    w2 --> rbac

    subgraph rbac[Authorization]
        rbac1{is platform staff<br/>or superuser?} -->|yes| allow[Allow]
        rbac1 -->|no| rbac2{role == OWNER?}
        rbac2 -->|yes| allow
        rbac2 -->|no| rbac3["Role.permissions<br/>contains code?"]
        rbac3 -->|yes| allow
        rbac3 -->|no| deny[403 Deny]
    end
```

- **JWT** (`SimpleJWT`) for API clients; token endpoints are throttled `10/min`
  per IP as a brute-force guard. Access token 60 min, refresh 7 days.
- **Session** auth for the server-rendered UI.
- **RBAC** (`accounts/models.py::User.has_perm_code`): platform staff and shop
  **owners** get everything; other roles resolve fine-grained permission codes
  (e.g. `view_profit`, `delete_sale`, `manage_users`) through their shop's
  editable `Role` rows. The UI reads `/api/auth/my-permissions/` to gate the
  sidebar and actions.

---

## 7. ⭐ The core transaction — POS sale / checkout

This is the transactional heart of the app (`sales/services.py::create_sale`).
**Everything happens in one atomic DB transaction** — if any step fails, nothing
commits.

```mermaid
sequenceDiagram
    autonumber
    actor C as Cashier (POS)
    participant W as web.pos_checkout
    participant S as create_sale (atomic)
    participant P as Product (lock)
    participant Inv as StockMovement ledger
    participant Sale as Sale + SaleItem
    participant Pay as Payment + LedgerEntry
    participant Cust as Customer
    participant Unit as ProductUnit + Warranty
    participant Aud as AuditLog
    participant N as Low-stock alert

    C->>W: Submit cart (items, payments, customer, idempotency_key)
    W->>S: create_sale(...)

    S->>S: idempotency_key seen before? -> return existing Sale
    S->>P: SELECT ... FOR UPDATE on tracked products
    S->>S: validate stock >= qty (block oversell / TOCTOU)
    S->>Sale: create Sale (invoice_no, retry on collision)

    loop each line item
        S->>Sale: create SaleItem (snapshot unit_cost = COGS)
        S->>Inv: apply_movement(SALE_OUT, qty) -> ledger row + stock cache--
    end

    S->>S: apply customer discount %, shop VAT if enabled
    loop each payment
        S->>Pay: create Payment
        S->>Pay: create LedgerEntry (CASH +amount)
    end
    S->>Sale: set subtotal/total/paid/status (paid/partial/due)

    opt EMI sale
        S->>Sale: create EMISchedule + EMIInstallments
        S->>N: queue send_emi_welcome_email (async)
    end

    opt saved customer
        S->>Cust: total_purchased +=, due_balance +=, last_purchase_at
    end

    S->>Unit: flip ProductUnits to SOLD, bind buyer + start Warranty
    S->>Aud: record CREATE audit log
    S-->>W: Sale committed
    W-->>C: Invoice / receipt

    Note over N: after commit only
    S->>N: alert_low_stock_realtime(sold products)
```

### Why each guard exists

| Guard | Problem it prevents |
|-------|---------------------|
| `idempotency_key` (unique per shop) | Double-click / retry creating **duplicate sales** |
| `select_for_update()` on products | Two concurrent checkouts both passing the stock check and **overselling into negative** (TOCTOU) |
| `invoice_no` retry loop | Two sales computing the same `count()+1` invoice number → unique-constraint 500 |
| `unit_cost` **snapshot** on `SaleItem` | Later cost changes silently rewriting historical **COGS / profit** |
| `transaction.on_commit` for alerts | Alerting on a sale that **rolled back** |
| One atomic block | Partial writes: stock moved but payment lost, etc. |

**Data touched by one checkout:** `Sale`, `SaleItem`, `Payment`, `LedgerEntry`,
`StockMovement`, `Product.current_stock`, `ProductUnit`, `Warranty`, `Customer`,
optionally `EMISchedule`/`EMIInstallment`, and `AuditLog`.

---

## 8. Inventory — the append-only stock ledger

Stock is **never edited directly**. The only sanctioned mutation is
`inventory/services.py::apply_movement`, which writes an immutable
`StockMovement` and nudges the `current_stock` cache.

```mermaid
flowchart TB
    subgraph sources[Movement sources]
        sale[Sale checkout] -->|SALE_OUT -| am
        ret[Sale return] -->|SALE_RETURN_IN +| am
        recv[Purchase received] -->|PURCHASE_IN +| am
        pret[Purchase return] -->|PURCHASE_RETURN_OUT -| am
        adj[Manual adjust] -->|ADJUST_IN/OUT| am
        dmg[Damage/loss] -->|DAMAGE_OUT -| am
        opn[Opening balance] -->|OPENING +| am
        xfer[Branch transfer] -->|TRANSFER_IN/OUT| am
    end

    am[apply_movement] --> mv[(StockMovement<br/>signed qty, immutable)]
    am --> cache["Product.current_stock += signed delta (F-expression, O-1)"]
    am --> vcache[ProductVariation.current_stock += delta]
    am --> units{barcodes<br/>provided?}
    units -->|incoming| mkunit[create ProductUnit rows IN_STOCK]
    units -->|outgoing| rmunit[remove matching ProductUnits]
    am --> inval[invalidate dashboard cache]

    mv -. nightly reconcile .-> recalc[recalc_stock<br/>SUM movements = truth]
    recalc --> cache
```

- **Sign convention:** outgoing types (`SALE_OUT`, `DAMAGE_OUT`, `ADJUST_OUT`,
  `PURCHASE_RETURN_OUT`, `TRANSFER_OUT`) store **negative** quantities; summing
  the column yields current stock.
- **Cache vs. truth:** the hot path updates `current_stock` incrementally with a
  DB-side `F()` expression (atomic, O(1)). The nightly `reconcile_stock` task
  re-sums the ledger as the authoritative repair — a drift safety net.
- **`restock()`** additionally rolls `Product.cost_price` into a **weighted
  average** so margins stay honest when purchase prices change.
- **`ProductUnit`** = one physically serialized item (its own barcode). A POS
  scan resolves a unit barcode → product + per-unit price/warranty snapshot.

---

## 9. Purchasing — procurement to payables

```mermaid
sequenceDiagram
    autonumber
    actor Buyer as Owner / Inventory Mgr
    participant PO as create_purchase_order
    participant Recv as receive_purchase_order (atomic)
    participant Inv as StockMovement
    participant Cat as Product / ProductUnit
    participant Acc as Expense + LedgerEntry
    participant Sup as Supplier

    Buyer->>PO: draft PO (supplier, items, unit costs, barcodes)
    PO-->>Buyer: PurchaseOrder (DRAFT)

    Buyer->>Recv: receive PO (+ optional payment)
    loop each PO item
        Recv->>Inv: apply_movement(PURCHASE_IN, qty)
        Recv->>Cat: update cost, materialize ProductUnits + Warranties
    end
    Recv->>Acc: post "Product Purchase" Expense + cash-out LedgerEntry
    Recv->>Sup: increase supplier due_balance
    Recv-->>Buyer: PO RECEIVED, stock live

    Buyer->>Sup: pay_supplier / add_purchase_payment
    Sup->>Acc: cash-out LedgerEntry, reduce due_balance
```

Receiving a PO is where procurement becomes real stock **and** a real cost:
inventory goes up via the ledger, cost/units are recorded, and the spend hits
accounting (an `Expense` + a negative `LedgerEntry`). Supplier payables track
`Supplier.due_balance`.

---

## 10. Returns, EMI, and dues

### 10a. Sale return (partial or full)

```mermaid
flowchart LR
    r[SaleReturn] --> items[SaleReturnItem per line]
    items --> restock{restocked?}
    restock -->|yes| in["StockMovement SALE_RETURN_IN (+), COGS credited back"]
    restock -->|no| loss[Damaged/discarded: cost stays a loss]
    r --> refund[Record refund method + reference<br/>refund is manual/offline]
    r --> recv[Reduce receivable / Customer due]
    r --> status[Sale -> returned / partially_returned]
    r --> unit[ProductUnit -> RETURNED, warranty voided]
```

Refunds are **recorded, not executed** — the system tracks method + reference;
no live payout gateway. `restocked=True` credits COGS back (goods weren't truly
sold); `False` keeps the cost as a loss.

### 10b. EMI (installment sales)

`create_sale(is_emi=True)` builds an **`EMISchedule`** + N **`EMIInstallment`**
rows (principal + interest − down payment, spread monthly with rounding put on
the last installment). A welcome email is queued async; `send_emi_reminders`
(scheduled) chases upcoming/overdue installments.

### 10c. Customer dues (receivables)

`collect_customer_due` allocates a payment **oldest-invoice-first (FIFO)** across
a customer's open sales; each allocation flows through `add_payment` so per-sale
status, the cash `LedgerEntry`, and `Customer.due_balance` all stay consistent.

---

## 11. Accounting & profit (transparent, never faked)

```mermaid
flowchart TB
    subgraph inflow[Money in +]
        salep[Sale payments] --> ledger
        duecol[Due collections] --> ledger
    end
    subgraph outflow[Money out -]
        exp[Expenses] --> ledger
        recexp[Recurring expenses] --> ledger
        purch[Purchase payments] --> ledger
        refund[Refunds/voids] --> ledger
    end

    ledger[(LedgerEntry<br/>append-only cash ledger)]

    subgraph profit[Profit calculation - analytics.services]
        rev[Revenue = sales ex-VAT] --> calc
        cogs[COGS = Σ snapshotted SaleItem unit_cost] --> calc
        retc[Returns credit COGS back if restocked] --> calc
        expc[Expenses subtracted explicitly] --> calc
        calc[["Gross/Net profit"]]
    end

    ledger -.reconciles.-> eod[DailySettlement<br/>expected vs actual cash]
```

- **VAT is a pass-through liability**, not revenue: it inflates the invoice total
  (what the customer owes) but is excluded from profit.
- **COGS is honest**: computed from the `unit_cost` snapshotted on each
  `SaleItem` at sale time, never `selling − purchase` at report time.
- **`DailySettlement`** closes a shift/day: expected vs actual cash, discrepancy.

---

## 12. Asynchronous & scheduled data flows (Celery)

```mermaid
flowchart LR
    beat[Celery beat] -->|hourly| ls[inventory.scan_low_stock]
    beat -->|daily| sub[billing.check_subscription_expiry]
    beat -->|daily| rec[accounting.generate_recurring_expenses]
    beat -->|daily| war[service.scan_warranty_expiry]
    beat -->|daily| rc[inventory.reconcile_stock]
    beat -->|daily| dn[notifications.delete_old_notifications]

    subgraph evt[Event-triggered async]
        chk[Checkout EMI] --> emailw[sales.send_emi_welcome_email]
        emirem[sales.send_emi_reminders]
        bk[Super admin] --> drive[platform_admin.perform_drive_backup]
    end

    ls --> notif[(Notification)]
    war --> notif
    sub --> notif
    rc --> stock[recompute current_stock]
    rec --> expense[(Expense + LedgerEntry)]
    drive --> gd[/Google Drive/]
    emailw --> smtp[/SMTP/]
```

| Task | Cadence | What it does |
|------|---------|--------------|
| `inventory.scan_low_stock` | hourly | Digest low-stock alerts for DAILY-mode shops |
| `inventory.reconcile_stock` | daily | Re-sum ledger → repair `current_stock` drift |
| `billing.check_subscription_expiry` | daily | Flag/expire subscriptions past period end |
| `accounting.generate_recurring_expenses` | daily | Materialize `RecurringExpense` → `Expense` |
| `service.scan_warranty_expiry` | daily | Warn on warranties nearing expiry |
| `notifications.delete_old_notifications` | daily | Prune old in-app notifications |
| `sales.send_emi_welcome_email` / `send_emi_reminders` | event / scheduled | EMI comms |
| `platform_admin.perform_drive_backup` | on demand | DB dump → Google Drive |

> Remember §4: each task must set the tenant context for the shop it operates on.

---

## 13. Notifications & external messaging

```mermaid
flowchart TB
    trigger[Business event<br/>low stock, warranty, subscription] --> notify[notifications.notify]
    notify --> inapp[(Notification row -> in-app bell)]
    notify --> cfg{channel enabled +<br/>customer consent?}
    cfg -->|WhatsApp| wa[whatsapp.send_template]
    cfg -->|Email| mail[SMTP]
    wa -->|POST graph.facebook.com| meta[/WhatsApp Cloud API/]
    meta -.webhook verify.-> verify[whatsapp.verify_webhook]
```

- **In-app**: `Notification` rows drive the notification bell.
- **WhatsApp**: `notifications/whatsapp.py::send_template` POSTs to the Meta
  Graph API; gated on channel config **and** per-customer consent
  (`Customer.whatsapp_consent`). Degrades gracefully when unconfigured.
- **Email**: console backend in dev, SMTP in prod; a missing host simply means
  no email is sent (never blocks a request).

---

## 14. AI insights (Anthropic Claude)

```mermaid
sequenceDiagram
    autonumber
    actor Owner
    participant AN as analytics.services
    participant Cache as daily cap counter
    participant Claude as Anthropic Claude API

    Owner->>AN: request AI insight
    AN->>Cache: under AI_INSIGHTS_DAILY_CAP for this shop today?
    alt within cap
        AN->>AN: aggregate shop metrics (sales, stock, profit)
        AN->>Claude: prompt (model = ANTHROPIC_MODEL)
        Claude-->>AN: natural-language insight
        AN-->>Owner: insight text
    else cap reached
        AN-->>Owner: served cached / capped
    end
```

Configured in `config/settings.py`: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`
(default `claude-opus-4-8`), and `AI_INSIGHTS_DAILY_CAP` (Claude calls per shop
per day) to bound cost. Only **aggregated** shop metrics are sent — never raw
customer PII dumps.

---

## 15. Platform admin (cross-tenant) & the public API

```mermaid
flowchart TB
    subgraph super[Platform Super Admin - is_staff, no shop]
        dash[Cross-tenant dashboard] --> bypass[bypass_tenant_scope]
        imp["Impersonate shop owner (audited)"] --> sess[sets impersonate_shop_id session]
        backup[Trigger Drive backup] --> gd[/Google Drive/]
        imports[Bulk data import pipeline]
    end

    subgraph pub[Enterprise Public API - /api/v1]
        key[API key in header] --> hashcmp["hash_key compare vs APIKey"]
        hashcmp --> throttle["throttle: public_api / enterprise rates"]
        throttle --> gated["Data gated to Enterprise plan feature flag"]
    end

    bypass --> alltenants[(All shops' data)]
    sess --> tenantmw[TenantMiddleware picks impersonated shop]
```

- **Super admin** uses `bypass_tenant_scope()` for cross-tenant views and can
  **impersonate** an owner (sets a session key the middleware honors — see §4),
  with actions written to `AuditLog`.
- **Public API** (`/api/v1`) authenticates via **hashed API keys**, is
  rate-limited per key, and its data surface is **gated to the Enterprise plan**
  through the feature-flag system on `SubscriptionPlan.features`.

---

## 16. Feature gating & subscription limits

```mermaid
flowchart LR
    req[Feature-gated action] --> gate[core.gating FeatureGate]
    gate --> active{shop.is_active?}
    active -->|no| block[Blocked]
    active -->|yes| plan{shop.plan.has_feature flag?}
    plan -->|no| block
    plan -->|yes| limits{within max_users /<br/>max_branches / max_products?}
    limits -->|no| block
    limits -->|yes| allow[Allowed]
```

`SubscriptionPlan` carries a JSON `features` map (editable without migrations)
plus hard limits (`max_users`, `max_branches`, `max_products`).
`Shop.has_feature()` is the central check used by the `FeatureGate`
permission/decorator.

---

## 17. End-to-end example — one item, cradle to grave

Following a single physical phone through the system ties every flow together:

```mermaid
flowchart LR
    a["1. Purchase Order created (supplier, cost)"] --> b["2. PO received: PURCHASE_IN movement, ProductUnit IN_STOCK, Expense + LedgerEntry out, supplier due up"]
    b --> c["3. POS scan resolves unit barcode -> product + price/warranty"]
    c --> d["4. Checkout: SALE_OUT movement, SaleItem COGS snapshot, Payment + LedgerEntry in, ProductUnit SOLD, Warranty starts, Customer due/total updated, AuditLog"]
    d --> e["5. Analytics: revenue - COGS - expenses = profit; dashboard cache"]
    e --> f["6. Post-sale: warranty expiry scan, optional service ticket / return"]
```

Every step leaves an **immutable ledger row** (stock and/or cash) plus an
**audit trail**, so the state is always explainable and reconcilable.

---

## 18. Cross-cutting invariants (the rules that keep data honest)

1. **Tenant isolation is default-on and fail-closed.** No tenant → no rows.
2. **Stock and cash are append-only ledgers;** cached balances are derived and
   reconcilable, never authoritative.
3. **Costs are snapshotted at transaction time** so historical profit is stable.
4. **Money-moving operations are atomic** — all-or-nothing DB transactions.
5. **Idempotency + row locking** guard the checkout hot path against duplicates
   and overselling.
6. **Refunds/payouts are recorded, not executed** — no live financial gateway.
7. **Every significant mutation is audited** (`AuditLog`) per shop.
8. **External calls degrade gracefully** — missing WhatsApp/email/AI config never
   breaks a core flow.

---

### Where to look in the code

| To understand… | Start at |
|----------------|----------|
| Multi-tenancy | `backend/core/middleware.py`, `backend/core/tenant_context.py`, `backend/core/models.py` |
| A sale end-to-end | `backend/sales/services.py::create_sale` |
| Stock movement | `backend/inventory/services.py::apply_movement` |
| Purchasing | `backend/purchasing/services.py` |
| Accounting/profit | `backend/accounting/models.py`, `backend/analytics/services.py` |
| RBAC | `backend/accounts/models.py`, `backend/accounts/rbac.py` |
| Server-rendered UI routes | `backend/web/urls.py`, `backend/web/views.py` |
| API routes | `backend/config/urls.py` + each app's `urls.py` |
| Scheduled jobs | `backend/config/celery.py` + each app's `tasks.py` |
| Feature gating | `backend/core/gating.py`, `backend/tenants/models.py` |

---

*Generated from a source-code walkthrough of the StockWhisk backend. Diagrams are
Mermaid; view on GitHub or any Mermaid-aware Markdown renderer.*
