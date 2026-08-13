"""Create / refresh the public read-only demo shop with rich sample data.

Idempotent: run on every deploy. Creates a demo shop with an owner
(admin@demo.stockwhisk.com / admin) plus ~75 days of realistic data across every
page — products, customers, suppliers, purchases, sales, warranties, service
tickets and expenses. Writes from this shop are blocked by DemoReadOnlyMiddleware.
"""
import random
from datetime import timedelta as _td
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone as _tz

from accounts.models import User
from core.tenant_context import set_current_tenant
from tenants.models import Shop

DEMO_EMAIL = "admin@demo.stockwhisk.com"
DEMO_PASSWORD = "admin"
DAYS = 75  # history window

PRODUCTS = [
    # name, category, cost, price, warranty_months, stock
    ("A4TECH KRS-82 Wired Keyboard", "Accessories", 700, 1100, 12, 300),
    ("Logitech M170 Wireless Mouse", "Accessories", 550, 850, 12, 300),
    ("HP 65W Laptop Adapter", "Accessories", 400, 700, 6, 300),
    ("Samsung 24\" LED Monitor", "Electronics", 9500, 12500, 24, 200),
    ("TP-Link Archer C6 Router", "Networking", 2200, 3200, 12, 200),
    ("Sandisk 64GB Pendrive", "Storage", 450, 750, 60, 400),
    ("Xiaomi 10000mAh Power Bank", "Electronics", 1300, 1900, 6, 250),
    ("HDMI 1.5m Cable", "Accessories", 120, 300, 0, 500),
    ("WD 1TB External HDD", "Storage", 4200, 5500, 24, 150),
    ("Dell WB7022 Webcam", "Accessories", 4800, 6200, 12, 120),
    ("JBL Go 3 Bluetooth Speaker", "Electronics", 2900, 3900, 12, 180),
    ("Rapoo Wireless Keyboard+Mouse", "Accessories", 1400, 2100, 12, 200),
    ("Netac 256GB SSD", "Storage", 1900, 2700, 36, 220),
    ("Havit HV-N92 Headphone", "Accessories", 380, 650, 6, 260),
    ("Asus 8-Port Gigabit Switch", "Networking", 1600, 2400, 24, 130),
    ("UPS 650VA", "Electronics", 3200, 4300, 12, 90),
]

CUSTOMERS = [
    ("Rahim Uddin", "01711000001", "Mirpur, Dhaka"),
    ("Karim Traders", "01711000002", "Uttara, Dhaka"),
    ("Nusrat Jahan", "01711000003", "Agrabad, Chattogram"),
    ("Shahin Alam", "01711000004", "Sylhet"),
    ("Tania Akter", "01711000005", "Rajshahi"),
    ("Digital Point", "01711000006", "Elephant Road, Dhaka"),
    ("Mizanur Rahman", "01711000007", "Khulna"),
    ("Farhana Islam", "01711000008", "Bashundhara, Dhaka"),
    ("Sabbir Hossain", "01711000009", "Gazipur"),
    ("Green IT Store", "01711000010", "Mouchak, Dhaka"),
]

SUPPLIERS = [
    ("Global Tech Distribution", "Global Tech Ltd", "01811000001"),
    ("Star Computers Wholesale", "Star Computers", "01811000002"),
    ("Prime Electronics BD", "Prime Electronics", "01811000003"),
    ("Ryans Trade", "Ryans", "01811000004"),
]

EXPENSES = [
    ("Shop rent", 15000, "bank"),
    ("Electricity bill", 3200, "cash"),
    ("Staff salary", 22000, "bank"),
    ("Internet bill", 1500, "bkash"),
    ("Marketing / Facebook ads", 5000, "card"),
    ("Transport", 1800, "cash"),
    ("Office supplies", 900, "cash"),
    ("Tea & refreshments", 700, "cash"),
]

TICKETS = [
    ("HP Laptop 15s", "laptop", "screen", "in_repair", 1500),
    ("Dell Optiplex Desktop", "desktop", "power", "diagnosing", 800),
    ("Samsung Galaxy A54", "phone", "battery", "ready_for_pickup", 1200),
    ("Asus TUF Gaming", "laptop", "software", "delivered", 900),
    ("iPad Air", "tablet", "liquid", "awaiting_parts", 2500),
    ("PS5 Console", "console", "power", "received", 0),
    ("Lenovo ThinkPad", "laptop", "screen", "delivered", 2200),
    ("iPhone 12", "phone", "battery", "ready_for_pickup", 1800),
    ("HP Pavilion", "laptop", "virus", "delivered", 600),
    ("Acer Monitor", "other", "power", "diagnosing", 500),
    ("Xbox Series S", "console", "software", "in_repair", 1100),
    ("Redmi Note 12", "phone", "screen", "delivered", 1600),
]


class Command(BaseCommand):
    help = "Create or refresh the public read-only demo shop with rich sample data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset", action="store_true",
            help="Delete the existing demo shop (and its data) first, then reseed fresh.",
        )

    def _purge_shop(self, shop):
        """Delete every row scoped to this shop, then the shop itself.

        Product.shop (and others) are PROTECT, so we can't just delete the shop.
        Instead we sweep all models that have a ``shop`` FK, retrying across a few
        passes so PROTECT chains (children before parents) resolve automatically.
        """
        from django.apps import apps
        shop_models = [M for M in apps.get_models() if "shop" in [f.name for f in M._meta.fields]]
        for _ in range(10):
            progressed = False
            for Model in shop_models:
                mgr = getattr(Model, "all_objects", Model.objects)
                qs = mgr.filter(shop_id=shop.id)
                try:
                    if qs.exists():
                        qs.delete()
                        progressed = True
                except Exception:
                    pass  # blocked by protected children — retry next pass
            if not progressed:
                break
        Shop.objects.filter(pk=shop.pk).delete()

    @transaction.atomic
    def handle(self, *args, **options):
        from tenants.services import register_shop

        if options.get("reset"):
            for demo in Shop.objects.filter(is_demo=True):
                self._purge_shop(demo)
            self.stdout.write(self.style.WARNING("Reset: removed existing demo shop(s)."))

        owner = User.objects.filter(email=DEMO_EMAIL).select_related("shop").first()
        if owner:
            shop = owner.shop
            self.stdout.write("Demo owner exists — refreshing.")
        else:
            shop, owner = register_shop(
                name="StockWhisk Demo Store", owner_email=DEMO_EMAIL,
                owner_password=DEMO_PASSWORD, owner_name="Demo Owner",
                phone="01700000000", address="123 Demo Road, Dhaka",
            )
            self.stdout.write("Created demo shop + owner.")

        shop.is_demo = True
        shop.is_test = True
        shop.is_active = True
        shop.trial_ends_at = _tz.now() + _td(days=3650)
        # Turn on every optional feature so the demo shows the full owner UI
        # (EMI, VAT, delivery, WhatsApp invoice) — matches a fully-configured shop.
        shop.emi_enabled = True
        shop.vat_enabled = True
        shop.vat_percent = Decimal("5")
        shop.delivery_enabled = True
        shop.whatsapp_invoice_enabled = True
        shop.save(update_fields=[
            "is_demo", "is_test", "is_active", "trial_ends_at",
            "emi_enabled", "vat_enabled", "vat_percent", "delivery_enabled", "whatsapp_invoice_enabled",
        ])
        owner.set_password(DEMO_PASSWORD)
        owner.is_active = True
        owner.save(update_fields=["password", "is_active"])

        set_current_tenant(shop)

        from catalog.models import Category, Product
        if Product.all_objects.filter(shop_id=shop.id).exists():
            self.stdout.write(self.style.SUCCESS("Demo data already present — done."))
            return

        random.seed(7)
        from catalog.models import ProductUnit
        from crm.models import Customer
        from inventory.services import apply_movement
        from sales.services import create_sale

        prefix = shop.effective_barcode_prefix

        # Categories
        cat_names = sorted({p[1] for p in PRODUCTS})
        cats = {n: Category.all_objects.create(shop_id=shop.id, name=n) for n in cat_names}

        # Products + serialized in-stock units. Each product gets individual
        # units (barcode + warranty), exactly like the real software — so POS
        # shows the "Select Units to Sell" modal when a product is clicked.
        prods = []
        stock_left = {}  # product_id -> units still in stock (caps seeded sales)
        for i, (name, cat, cost, price, warranty, _stock) in enumerate(PRODUCTS, start=1):
            p = Product.all_objects.create(
                shop_id=shop.id, name=name, category=cats[cat],
                barcode=f"{prefix}{100000 + i}", sku=f"SKU-{1000 + i}",
                cost_price=Decimal(cost), selling_price=Decimal(price),
                warranty_months=warranty, track_inventory=True,
            )
            n_units = random.randint(50, 90)
            apply_movement(product=p, movement_type="opening", quantity=Decimal(n_units),
                           unit_cost=Decimal(cost), shop=shop, created_by=owner)
            ProductUnit.all_objects.bulk_create([
                ProductUnit(
                    shop_id=shop.id, product=p, barcode=f"{prefix}U{i:02d}{u:04d}",
                    cost_price=Decimal(cost), selling_price=Decimal(price),
                    warranty_months=(warranty or None), status=ProductUnit.Status.IN_STOCK,
                )
                for u in range(1, n_units + 1)
            ])
            stock_left[p.id] = n_units
            prods.append(p)

        # Customers
        custs = [Customer.all_objects.create(shop_id=shop.id, name=n, phone=ph, address=a) for n, ph, a in CUSTOMERS]

        # Suppliers + a few received purchase orders
        n_po = 0
        try:
            # Savepoint: if a purchase fails, roll back just this part and keep
            # the outer transaction usable for the rest of the demo data.
            with transaction.atomic():
                from purchasing.models import Supplier
                from purchasing.services import create_purchase_order, receive_purchase_order
                suppliers = [Supplier.all_objects.create(shop_id=shop.id, name=n, company_name=c, phone=ph) for n, c, ph in SUPPLIERS]
                for sup in suppliers:
                    for _ in range(random.randint(1, 2)):
                        picks = random.sample(prods, random.randint(2, 4))
                        items = [{"product": p, "quantity": Decimal(random.randint(6, 14)), "unit_cost": p.cost_price} for p in picks]
                        po = create_purchase_order(shop=shop, supplier=sup, items=items, created_by=owner)
                        total = sum(i["quantity"] * i["unit_cost"] for i in items)
                        receive_purchase_order(po=po, paid=(total * Decimal("0.7")).quantize(Decimal("1")), created_by=owner)
                        n_po += 1
        except Exception as e:  # purchasing is optional to the demo
            n_po = 0
            self.stdout.write(self.style.WARNING(f"Skipped purchases: {e}"))

        # Sales spread across the history window
        methods = ["cash", "cash", "bkash", "card", "nagad"]
        n_sales = 0
        for d in range(DAYS, -1, -1):
            for _ in range(random.randint(1, 3)):
                # Only sell products that still have units, and never more than
                # remain — so create_sale can't hit an out-of-stock error.
                available = [p for p in prods if stock_left[p.id] >= 1]
                if not available:
                    continue
                picks = random.sample(available, min(random.randint(1, 3), len(available)))
                items = []
                for p in picks:
                    q = min(random.randint(1, 2), stock_left[p.id])
                    if q <= 0:
                        continue
                    items.append({"product": p, "quantity": Decimal(q), "unit_price": p.selling_price})
                    stock_left[p.id] -= q
                if not items:
                    continue
                total = sum(i["quantity"] * i["unit_price"] for i in items)
                ratio = random.choice([Decimal("1"), Decimal("1"), Decimal("1"), Decimal("0.5"), Decimal("0")])
                amount = (total * ratio).quantize(Decimal("1"))
                cust = random.choice(custs + [None, None])
                create_sale(
                    shop=shop, items=items, customer=cust,
                    payments=[{"amount": amount, "method": random.choice(methods)}] if amount > 0 else [],
                    created_by=owner, sale_date=_tz.now() - _td(days=d),
                )
                n_sales += 1

        # Warranties (active / expiring / expired mix)
        from service.models import ServiceTicket, Warranty
        n_warr = 0
        for _ in range(14):
            prod = random.choice([p for p in prods if p.warranty_months])
            cust = random.choice(custs)
            days_ago = random.randint(1, DAYS + 300)  # some already expired
            Warranty.all_objects.create(
                shop_id=shop.id, product=prod, customer=cust,
                serial_no=f"SN-{prod.id}-{days_ago:04d}", period_months=prod.warranty_months,
                start_date=(_tz.now() - _td(days=days_ago)).date(),
            )
            n_warr += 1

        # Service / repair tickets
        for i, (device, dtype, itype, status, charge) in enumerate(TICKETS, start=1):
            cust = random.choice(custs + [None])
            ServiceTicket.all_objects.create(
                shop_id=shop.id, ticket_no=f"SVC-{i:06d}",
                customer=cust, customer_name="" if cust else "Walk-in",
                device_description=device, device_type=dtype, issue_type=itype,
                complaint=f"Reported: {itype} issue on {device}.",
                status=status, service_charge=Decimal(charge),
                received_at=_tz.now() - _td(days=random.randint(0, 30)),
            )

        # Expenses (Finance page)
        from accounting.models import Expense, ExpenseCategory
        exp_cats = list(ExpenseCategory.all_objects.filter(shop_id=shop.id))
        n_exp = 0
        for note, amount, method in EXPENSES:
            for _ in range(random.randint(1, 3)):
                Expense.all_objects.create(
                    shop_id=shop.id, category=(random.choice(exp_cats) if exp_cats else None),
                    amount=Decimal(amount), spent_on=(_tz.now() - _td(days=random.randint(0, DAYS))).date(),
                    payment_method=method, note=note, created_by=owner,
                )
                n_exp += 1

        self.stdout.write(self.style.SUCCESS(
            f"Demo ready (shop #{shop.id}): {len(prods)} products, {len(custs)} customers, "
            f"{len(SUPPLIERS)} suppliers, {n_po} purchases, {n_sales} sales, "
            f"{n_warr} warranties, {len(TICKETS)} service tickets, {n_exp} expenses."
        ))
