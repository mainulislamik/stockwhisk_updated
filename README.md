# StockWhisk — separated frontend + backend

A rebuild of the StockWhisk inventory-management app with a **Next.js + TypeScript**
frontend that reproduces the original Bootstrap UI, talking to the existing
**Django REST Framework** backend. Backend and frontend live in separate folders
and run as separate Docker containers.

```
.
├── backend/            Django 5 + DRF API (JWT auth). Serves /api/*
├── frontend/           Next.js 14 (App Router, TypeScript). Reproduces the UI.
└── docker-compose.yml  postgres + redis + backend + worker + beat + frontend
```

## Run with Docker (recommended)

```bash
docker compose up -d --build
```

Then open:

- **Frontend (the app):** http://localhost:3000
- **Backend API docs (Swagger):** http://localhost:8000/api/docs/

The backend container automatically waits for Postgres, runs migrations, and
collects static files on start.

### Create the first shop / login

The backend is multi-tenant; you sign in with a shop owner account. Create one via
the API (or Django admin):

```bash
# create a superuser for /admin (optional)
docker compose exec backend python manage.py createsuperuser

# OR register a shop + owner through the public API:
curl -X POST http://localhost:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{"shop_name":"My Shop","owner_email":"owner@example.com","owner_password":"changeme123","business_type":"general"}'
```

Then log in at http://localhost:3000/login with that email + password.

## How the pieces talk

- The browser calls the backend directly at `NEXT_PUBLIC_API_BASE`
  (`http://localhost:8000` by default). **CORS is enabled on the backend**, so
  cross-origin calls from the frontend are allowed.
- Auth is **JWT** (`/api/auth/token/`). The frontend stores access/refresh tokens
  in localStorage and refreshes automatically on 401.
- Permissions from `/api/auth/my-permissions/` drive the same permission-gated
  sidebar and actions as the original app.

> If you serve the backend on a different host/port, set the frontend build arg
> `NEXT_PUBLIC_API_BASE` (in `docker-compose.yml`) to that origin and rebuild the
> frontend image.

## Local development (without Docker)

```bash
# backend
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000

# frontend (new terminal)
cd frontend
npm install
# point the proxy at the local backend
echo "BACKEND_INTERNAL_URL=http://localhost:8000" > .env.local
npm run dev
```

Frontend on http://localhost:3000, backend on http://localhost:8000.

## Pages implemented (matching the original UI)

Dashboard · POS · Products (list / profile / edit / purchase / item lookup / barcodes)
· Inventory & stock · Sales (invoices / detail / sold products / selling details)
· Customers · Dues · Suppliers · Purchases · Expenses · Accounting · Reports
· Service (repair tickets / detail / warranties / warranty coverage)
· Notifications · Users & Roles · Settings · System Backups · Tutorials.
