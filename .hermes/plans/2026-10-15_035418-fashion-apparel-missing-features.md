# Fashion & Apparel Ecosystem — Missing Features Implementation Plan

> **For Hermes:** Use `subagent-driven-development` or step-by-step TDD execution to implement this plan task-by-task.

**Goal:** Complete the fashion and apparel ecosystem on StockWhisk by implementing the 5 missing core capabilities: Alteration & Fitting Suite, Garment Size & Measurement Guide, 1-Click Size & Color Swap at POS, Broken-Size Matrix Stock-Ratio Analytics, and Mix-and-Match Outfit Bundles.

**Architecture:** 
- Decoupled backend APIs in Django (`sales`, `catalog`, `reports`) gated strictly by `apparel_catalog` and `apparel_alterations` tenant module flags so non-fashion shops remain unaffected.
- Relational single source of truth (`ProductVariation` & `StockMovement` immutable ledger) maintaining stock integrity across exchanges, returns, and combo sales.
- Clean Next.js UI adhering to StockWhisk Light theme standards (`#0f172a` / `#475569`, official logos, empty as `—`), accessible both on desktop and mobile web.

**Tech Stack:** Django REST Framework 3.14+, PostgreSQL 16, Next.js 14.2 (App Router), TypeScript, Bootstrap 5 / Tailwind CSS, Lucide / Bootstrap Icons.

---

## Task Breakdown & Roadmap

### Task 1: Backend Model & API for Garment Alterations (`apparel_alterations`)

**Objective:** Extend `Sale` model and provide a dedicated REST endpoint for alteration jobs (listing, filtering by status, updating tailor assignment, due dates, and completion status).

**Files:**
- Modify: `backend/sales/models.py:45-75`
- Modify: `backend/sales/serializers.py:15-60`
- Modify: `backend/sales/views.py:80-130`
- Modify: `backend/sales/urls.py:10-30`
- Test: `backend/sales/tests/test_alterations.py`

**Step 1: Write failing test**
```python
# backend/sales/tests/test_alterations.py
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from tenants.models import Shop
from sales.models import Sale
from accounts.models import User

class AlterationAPITest(TestCase):
    def setUp(self):
        self.shop = Shop.objects.create(name="Fashion Hub", business_type="fashion")
        self.user = User.objects.create_user(username="tailor@demo.com", shop=self.shop)
        self.sale = Sale.objects.create(
            shop=self.shop,
            total=Decimal("1500.00"),
            alteration_notes="Hem pants 2 inches and taper waist",
            alteration_status="pending",
            alteration_due_date=timezone.now().date(),
            tailor_name="Master Rafiq",
            created_by=self.user,
        )

    def test_alterations_list_endpoint(self):
        self.client.force_login(self.user)
        res = self.client.get("/api/v1/sales/alterations/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data.get("results", res.data)), 1)
        self.assertEqual(res.data["results"][0]["tailor_name"], "Master Rafiq")
```

**Step 2: Run test to verify failure**
Run: `python manage.py test sales.tests.test_alterations`
Expected: FAIL — `FieldError: Unknown field(s) (alteration_due_date, tailor_name)` or 404 URL not found.

**Step 3: Implement minimal backend code**
1. Add fields to `Sale` in `backend/sales/models.py`:
   ```python
   alteration_due_date = models.DateField(null=True, blank=True)
   tailor_name         = models.CharField(max_length=100, blank=True, default="")
   alteration_charge   = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
   ```
2. Run migration: `python manage.py makemigrations sales && python manage.py migrate`
3. Create `AlterationSaleSerializer` in `backend/sales/serializers.py` exposing invoice, customer name/phone, garment details, alteration fields, and status.
4. Add `AlterationViewSet` in `backend/sales/views.py` with actions `update_status` and filter backend for `alteration_status` (`pending`, `in_progress`, `ready`, `delivered`).
5. Register in `backend/sales/urls.py` as `router.register(r"alterations", AlterationViewSet, basename="alterations")`.

**Step 4: Run test to verify pass**
Run: `python manage.py test sales.tests.test_alterations`
Expected: PASS (1 test passed).

**Step 5: Commit**
```bash
git add backend/sales/
git commit -m "feat(sales): add alteration fields, serializer and REST endpoint"
```

---

### Task 2: Frontend POS Alteration Modal & In-Cart Controls

**Objective:** Add a dedicated "✂️ অল্টারেশন (Alteration)" action in the POS cart (`pos/page.tsx`) so cashiers can attach fitting notes, tailor name, delivery date, and alteration fees.

**Files:**
- Modify: `frontend/src/app/app/pos/page.tsx:980-1010` & `2450-2520`
- Modify: `frontend/src/app/app/pos/customer/page.tsx:210-240`

**Step 1: Code minimal implementation**
1. In `pos/page.tsx`, create state:
   ```typescript
   const [showAlterationModal, setShowAlterationModal] = useState(false);
   const [alterationForm, setAlterationForm] = useState({
     notes: "",
     tailor_name: "",
     due_date: "",
     charge: 0,
     selectedCartLine: null as string | null,
   });
   ```
2. Render "✂️ অল্টারেশন" button in the cart summary toolbar for fashion shops (`isFashionShop`):
   ```tsx
   {isFashionShop && (
     <button
       type="button"
       className={`btn btn-sm py-1.5 px-2.5 rounded-3 fw-semibold ${alterationForm.notes ? "btn-purple text-white shadow-sm" : "btn-outline-secondary"}`}
       style={alterationForm.notes ? { backgroundColor: "#7c3aed", borderColor: "#7c3aed" } : {}}
       onClick={() => setShowAlterationModal(true)}
     >
       ✂️ {alterationForm.notes ? (lang === "bn" ? "অল্টারেশন যুক্ত" : "Alteration Added") : (lang === "bn" ? "অল্টারেশন" : "Alteration")}
     </button>
   )}
   ```
3. Pass `alteration_notes`, `alteration_due_date`, `tailor_name`, and `alteration_charge` in checkout payloads for both online (`/pos/checkout/`) and offline IndexedDB queue.
4. Render quick badges on affected cart line items.

**Step 2: Verification**
- Load `/app/pos` in fashion shop mode.
- Add an apparel item to cart, click "✂️ অল্টারেশন", enter "হাতা ১ ইঞ্চি ছোট" and delivery date.
- Submit fast cash sale.
- Inspect resulting Sale record: `alteration_notes` and `alteration_status="pending"` saved cleanly.

**Step 3: Commit**
```bash
git add frontend/src/app/app/pos/
git commit -m "feat(pos): add alteration notes and tailor modal in cart checkout"
```

---

### Task 3: Dedicated Alteration Job Board & Slip Printer (`/app/alterations`)

**Objective:** Build `/app/alterations/page.tsx` for in-house tailors and managers to monitor tickets, change status, print 80mm tailor slips, and trigger WhatsApp pickup alerts.

**Files:**
- Create: `frontend/src/app/app/alterations/page.tsx`
- Modify: `frontend/src/components/Nav.tsx:85-160`
- Modify: `frontend/src/components/AppShell.tsx:45-60`

**Step 1: Code minimal implementation**
1. Create `frontend/src/app/app/alterations/page.tsx`:
   - Filter pills: `সব (All)`, `অপেক্ষমান (Pending)`, `কাজ চলছে (In Progress)`, `প্রস্তুত (Ready)`, `ডেলিভারড (Delivered)`.
   - Card/Table grid showing: Ticket #, Invoice #, Customer Name, Phone, Items & Fitting Note, Assigned Tailor, Due Date, Current Status badge.
   - Action buttons:
     - **Status Dropdown:** Instant status update via `PATCH /api/v1/sales/alterations/{id}/update_status/`.
     - **WhatsApp Alert:** Generates pre-filled message: `https://wa.me/880...?text=Dear {Customer}, Your garment alteration for Invoice {Invoice} is ready for pickup at {ShopName}.`
     - **Print Tailor Token:** 80mm thermal receipt with customer phone, garment size, and cutting instructions to pin onto the clothes hanger.
2. In `frontend/src/components/Nav.tsx`:
   - Under Fashion & Apparel shops (`hasModule("apparel_alterations")` or `hasModule("apparel_catalog")`), render:
     ```tsx
     <Item href="/app/alterations" icon="bi-scissors" label={lang === "bn" ? "পোশাক অল্টারেশন ও ফিটিং" : "Garment Alterations"} />
     ```

**Step 2: Verification**
- Access `/app/alterations` in browser.
- Verify pending tickets appear with tailor instructions.
- Click status toggle to "ready" — verify badge changes to green.
- Click WhatsApp button — verify URL formats correctly with customer phone and text.

**Step 3: Commit**
```bash
git add frontend/src/app/app/alterations/ frontend/src/components/Nav.tsx
git commit -m "feat(alterations): add full tailor management board and nav links"
```

---

### Task 4: Garment Size Chart & Measurement Guide

**Objective:** Enable garment measurement storage (Chest, Length, Waist, Shoulder, Sleeve in inches) in product catalogs and show a quick reference guide in POS.

**Files:**
- Modify: `backend/catalog/models.py:210-230`
- Modify: `backend/catalog/serializers.py:165-190`
- Modify: `frontend/src/components/FashionVariantMatrix.tsx:400-520`
- Modify: `frontend/src/app/app/pos/page.tsx:1500-1550`

**Step 1: Implement backend changes**
1. In `backend/catalog/models.py`, add `size_chart = models.JSONField(default=dict, blank=True)` to `Product`.
   Schema:
   ```json
   {
     "unit": "inch",
     "sizes": {
       "M": { "chest": "38", "length": "28", "shoulder": "17.5", "sleeve": "24" },
       "L": { "chest": "40", "length": "29", "shoulder": "18.5", "sleeve": "25" }
     }
   }
   ```
2. Add `size_chart` to `ProductSerializer` in `backend/catalog/serializers.py`.
3. Run `python manage.py makemigrations catalog && python manage.py migrate`.

**Step 2: Implement frontend changes**
1. In `FashionVariantMatrix.tsx`:
   - Add "📏 সাইজ চার্ট ও মাপ (Size Chart)" tab.
   - Provide 1-click presets: "👕 পাঞ্জাবি (Panjabi)", "👔 ফর্মাল শার্ট (Shirt)", "👕 টি-শার্ট (T-Shirt)", "👖 প্যান্ট (Pants)".
   - Auto-fill measurement inputs per selected size with editable inches/cm cells.
2. In `pos/page.tsx`:
   - Next to the size selector pills, add a "📏 সাইজ গাইড" button.
   - Clicking opens a high-contrast modal showing exact chest/length measurements for that product so sales assistants can answer sizing questions instantly.

**Step 3: Verification**
- Create/edit a Panjabi with Size 40 and 42 measurements.
- Open POS, select Panjabi, click "📏 সাইজ গাইড" — confirm chest and length measurements display cleanly.

**Step 4: Commit**
```bash
git add backend/catalog/ frontend/src/components/FashionVariantMatrix.tsx frontend/src/app/app/pos/page.tsx
git commit -m "feat(catalog,pos): add size measurement chart and POS quick guide"
```

---

### Task 5: 1-Click Size & Color Swap Mode in POS (Instant Size Exchange)

**Objective:** Provide a fast, dedicated "🔄 Size Swap" mode in POS to exchange a garment's size/color from an existing invoice without financial mismatch or manual return hurdles.

**Files:**
- Modify: `frontend/src/app/app/pos/page.tsx:1100-1250`
- Modify: `backend/sales/views.py:200-240` (or `sales/services.py`)

**Step 1: Implement exchange mechanics**
1. In `frontend/src/app/app/pos/page.tsx`, add state:
   `const [isSwapMode, setIsSwapMode] = useState(false);`
2. Workflow:
   - Cashier clicks "🔄 সাইজ এক্সচেঞ্জ" button or presses shortcut.
   - Enters or scans previous invoice number.
   - Fetches sale items; cashier selects the item being returned (e.g., T-Shirt Navy M).
   - Cashier selects the replacement item (e.g., T-Shirt Navy L).
   - If retail prices match: Net Balance = ৳0.00.
   - If upgrade (e.g. higher-priced variant or addition): collects price difference.
3. On submit:
   - Backend service performs ledger movements atomically:
     - `MovementType.SALE_RETURN` for original variant (+1 stock).
     - `MovementType.SALE_OUT` for new variant (-1 stock).
   - Generates Exchange Invoice slip showing: *"Exchanged: Size M ➜ Size L"*.

**Step 2: Verification**
- Conduct a test sale for a Size M shirt.
- Run Size Swap mode in POS: return Size M and take Size L.
- Check database: Size M stock increased by 1, Size L stock decreased by 1, accounting balance = 0.

**Step 3: Commit**
```bash
git add frontend/src/app/app/pos/ backend/sales/
git commit -m "feat(pos): implement 1-click size and color exchange with ledger sync"
```

---

### Task 6: Broken-Size & Matrix Stock-Ratio Analytics Report

**Objective:** Provide fashion merchants with a visual 2D matrix stock heatmap that highlights "broken sizes" (where popular sizes are sold out while peripheral sizes linger).

**Files:**
- Create: `backend/reports/fashion_views.py`
- Modify: `backend/reports/urls.py`
- Create: `frontend/src/app/app/reports/fashion/page.tsx`
- Modify: `frontend/src/app/app/reports/page.tsx`

**Step 1: Implement backend endpoint**
1. Create `/api/v1/reports/fashion-matrix/`:
   - Queries all products for the tenant shop where `size_variants` is populated.
   - Calculates total stock, variant breakdown, and flags `is_broken_size: True` if `any(v.stock == 0) and any(v.stock > 0)`.
   - Returns size ratio distribution.

**Step 2: Implement frontend view**
1. Create `frontend/src/app/app/reports/fashion/page.tsx`:
   - Summary stat cards: Total Garment Styles, Balanced Garments, Broken-Size Garments Alert.
   - Filter: "🔴 শুধুমাত্র ব্রোকেন-সাইজ দেখান (Broken Sizes Only)".
   - Table with 2D Size Heatmap Pills:
     - Red (`0`): Out of Stock (জরুরী রিস্টক প্রয়োজন)
     - Yellow (`1-3`): Low Stock
     - Green (`>3`): Adequate Stock
   - 1-Click "Create Purchase Order for Out-of-Stock Sizes" action.

**Step 3: Verification**
- Load `/app/reports/fashion` on a shop with mixed variant stock.
- Verify products with 0 stock in M/L but >0 in XL appear under the Broken Sizes filter.
- Verify heatmap colors render accurately.

**Step 4: Commit**
```bash
git add backend/reports/ frontend/src/app/app/reports/
git commit -m "feat(reports): add broken-size matrix heatmap and ratio report"
```

---

### Task 7: Mix-and-Match Fashion Outfit Combo

**Objective:** Enable selling composite clothing sets (e.g. Panjabi + Pajama, Suit + Pant, 3-Piece) where customer selects different sizes for each piece in a single discounted package.

**Files:**
- Modify: `backend/catalog/models.py:240-270`
- Modify: `frontend/src/app/app/pos/page.tsx:1650-1750`

**Step 1: Implement combo logic**
1. In `Product` model, add `is_outfit_combo = models.BooleanField(default=False)` and `combo_items = models.JSONField(default=list, blank=True)`.
2. In POS, when an Outfit Combo product is added:
   - A modal prompts the cashier to choose:
     - Part 1: পাঞ্জাবির সাইজ ও কালার (e.g. Size 42 Navy)
     - Part 2: পায়জামার সাইজ ও কালার (e.g. Size 38 White)
   - On checkout, stock is deducted from both individual variant items in the ledger, while the invoice displays the discounted set price.

**Step 2: Verification**
- Create a Combo Set "Eid Royal Package" with Panjabi + Pajama.
- Add to cart in POS, select Panjabi 42 and Pajama 38.
- Verify checkout deducts stock from both variations.

**Step 3: Commit**
```bash
git add backend/catalog/ frontend/src/app/app/pos/
git commit -m "feat(catalog,pos): support mix-and-match fashion outfit combo sets"
```

---

## Deployment & Verification Strategy

1. **Local Test & Build Check:**
   - Run backend check: `python manage.py check`
   - Run frontend TypeScript build: `npm run build`
2. **Push to Upstream Git:**
   - Commit all changes to `mainulislamik/stockwhisk_updated.git` on `main`.
3. **VPS Production Rollout:**
   - SSH into `163.227.239.114`.
   - Run `git pull origin main`.
   - Execute database migrations: `docker exec stockwhisk_updated-backend-1 python manage.py migrate`.
   - Build frontend container: `docker compose build frontend`.
   - Recreate containers: `docker compose up -d --no-deps backend frontend worker beat`.
4. **End-to-End Live Verification:**
   - Test full flow: Product Size Chart ➜ Alteration Cart Entry ➜ Ticket Dashboard ➜ Size Swap ➜ Matrix Report.
   - Auto-purge all test records after verification.
