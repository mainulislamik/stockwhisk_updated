# StockWhisk SaaS — Agent Engineering Context (AGENTS.md)

## Architecture Overview
- **Type:** Multi-Tenant Retail Point-of-Sale (POS) & ERP SaaS Platform.
- **Backend:** Django REST Framework, PostgreSQL, Dockerized stack.
- **Frontend:** Next.js (TypeScript), Tailwind / MUI, Desktop & Mobile Responsive Web.
- **Subsystems:** Offline POS IndexedDB cache, Auto-Sync Engine, ATS Webhook.

## Critical Business Rules
1. **Offline POS Core:**
   - Catalog cache endpoint: `/api/pos/catalog-cache/`
   - Offline invoice format: `#OFF-INV-...`
   - Sync endpoint: `/api/pos/offline-sync/`
   - Cart crash recovery with IndexedDB backup.
   - `DemoReadOnlyMiddleware` must exempt `/api/pos/*`.
2. **Admin & Authentication:**
   - PlatformShell with 4-tab shop manager and 25 modular plugins.
   - Switch user / impersonate: `/login-as` -> `/api/auth/me/`.
   - Phased delivery (PHASE 0 -> PHASE N).
   - 2-step OTP registration at `/register`.
3. **UI / UX Standards:**
   - High Contrast Light mode (`#0f172a` / `#475569`).
   - Official logos only, empty values as `—`.
   - Mobile and desktop responsive (no thermal printer/cash drawer dependencies).

## Operational Safety
- Zero downtime deployments (ZDD).
- Never touch unrelated containers on the VPS (`163.227.239.114`).
- Clean test data immediately after verification runs.
