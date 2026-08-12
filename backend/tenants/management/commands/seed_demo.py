"""Create / refresh the public read-only demo shop.

Idempotent: run on every deploy. Creates a demo shop with an owner
(admin@demo.stockwhisk.com / admin) and a bit of realistic sample data so the
public 'Live Demo' shows a populated owner interface. Writes from this shop are
blocked by DemoReadOnlyMiddleware.
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import User
from core.tenant_context import set_current_tenant
from tenants.models import Shop

DEMO_EMAIL = "admin@demo.stockwhisk.com"
DEMO_PASSWORD = "admin"

PRODUCTS = [
    # name, category, barcode, cost, price, warranty_months, stock (generous so
    # the seeded sales never run a product out of stock)
    ("A4TECH KRS-82 Wired Keyboard", "Accessories", "DEMO100001", 700, 1100, 12, 200),
    ("Logitech M170 Wireless Mouse", "Accessories", "DEMO100002", 550, 850, 12, 200),
    ("HP 65W Laptop Adapter", "Accessories", "DEMO100003", 400, 700, 6, 200),
    ("Samsung 24\" LED Monitor", "Electronics", "DEMO100004", 9500, 12500, 24, 150),
    ("TP-Link Archer C6 Router", "Electronics", "DEMO100005", 2200, 3200, 12, 150),
    ("Sandisk 64GB Pendrive", "Accessories", "DEMO100006", 450, 750, 60, 300),
    ("Xiaomi 10000mAh Power Bank", "Electronics", "DEMO100007", 1300, 1900, 6, 150),
    ("HDMI 1.5m Cable", "Accessories", "DEMO100008", 120, 300, 0, 300),
]

CUSTOMERS = [
    ("Rahim Uddin", "01711000001", "Mirpur, Dhaka"),
    ("Karim Store", "01711000002", "Uttara, Dhaka"),
    ("Nusrat Jahan", "01711000003", "Chattogram"),
]


class Command(BaseCommand):
    help = "Create or refresh the public read-only demo shop + sample data."

    @transaction.atomic
    def handle(self, *args, **options):
        from tenants.services import register_shop

        owner = User.objects.filter(email=DEMO_EMAIL).select_related("shop").first()
        if owner:
            shop = owner.shop
            self.stdout.write("Demo owner exists — refreshing.")
        else:
            shop, owner = register_shop(
                name="StockWhisk Demo Store",
                owner_email=DEMO_EMAIL,
                owner_password=DEMO_PASSWORD,
                owner_name="Demo Owner",
                phone="01700000000",
                address="123 Demo Road, Dhaka",
            )
            self.stdout.write("Created demo shop + owner.")

        # Always keep it a demo, active, never-expiring, and admin/admin.
        from django.utils import timezone
        from datetime import timedelta
        shop.is_demo = True
        shop.is_test = True
        shop.is_active = True
        shop.trial_ends_at = timezone.now() + timedelta(days=3650)
        shop.save(update_fields=["is_demo", "is_test", "is_active", "trial_ends_at"])
        owner.set_password(DEMO_PASSWORD)
        owner.is_active = True
        owner.save(update_fields=["password", "is_active"])

        set_current_tenant(shop)

        from catalog.models import Category, Product
        if Product.all_objects.filter(shop_id=shop.id).exists():
            self.stdout.write(self.style.SUCCESS("Demo data already present — done."))
            return

        from crm.models import Customer
        from inventory.services import apply_movement
        from sales.services import create_sale

        # Categories
        cats = {}
        for cname in {"Electronics", "Accessories"}:
            cats[cname] = Category.all_objects.create(shop_id=shop.id, name=cname)

        # Products + opening stock
        prods = []
        for name, cat, barcode, cost, price, warranty, stock in PRODUCTS:
            p = Product.all_objects.create(
                shop_id=shop.id, name=name, category=cats.get(cat),
                barcode=f"{shop.effective_barcode_prefix}{barcode}",
                cost_price=Decimal(cost), selling_price=Decimal(price),
                warranty_months=warranty, track_inventory=True,
            )
            apply_movement(
                product=p, movement_type="opening", quantity=Decimal(stock),
                unit_cost=Decimal(cost), shop=shop, created_by=owner,
            )
            prods.append(p)

        # Customers
        custs = [Customer.all_objects.create(shop_id=shop.id, name=n, phone=ph, address=a) for n, ph, a in CUSTOMERS]

        # Sales spread over the last ~25 days so dashboards/charts show a trend.
        import random
        from datetime import timedelta as _td
        from django.utils import timezone as _tz
        random.seed(42)  # deterministic demo

        def sell(items, customer, pay_ratio, days_ago, method="cash"):
            total = sum(Decimal(q) * Decimal(pr) for _, q, pr in items)
            amount = (total * Decimal(str(pay_ratio))).quantize(Decimal("1"))
            create_sale(
                shop=shop,
                items=[{"product": p, "quantity": Decimal(q), "unit_price": Decimal(pr)} for p, q, pr in items],
                customer=customer,
                payments=[{"amount": amount, "method": method}] if amount > 0 else [],
                created_by=owner,
                sale_date=_tz.now() - _td(days=days_ago),
            )

        methods = ["cash", "bkash", "card", "nagad"]
        n_sales = 0
        for d in range(25, -1, -1):
            # 0–3 sales per day
            for _ in range(random.randint(0, 3)):
                picks = random.sample(prods, random.randint(1, 3))
                items = [(p, random.randint(1, 2), int(p.selling_price)) for p in picks]
                cust = random.choice(custs + [None, None])  # some walk-ins
                ratio = random.choice([1.0, 1.0, 1.0, 0.5, 0.0])  # some dues
                sell(items, cust, ratio, d, random.choice(methods))
                n_sales += 1

        # ── Warranties (mix of active / expiring / expired) ──
        from service.models import ServiceTicket, Warranty
        warr_specs = [
            (prods[3], custs[0], 24, 20),   # active
            (prods[4], custs[1], 12, 40),   # active
            (prods[6], custs[2], 6, 160),   # expired
            (prods[0], custs[0], 12, 350),  # expired
            (prods[3], custs[1], 24, 5),    # fresh
            (prods[6], custs[2], 6, 155),   # expiring soon
        ]
        warranties = []
        for prod, cust, months, days_ago in warr_specs:
            w = Warranty.all_objects.create(
                shop_id=shop.id, product=prod, customer=cust,
                serial_no=f"SN-{prod.id}{days_ago:04d}", period_months=months,
                start_date=(_tz.now() - _td(days=days_ago)).date(),
            )
            warranties.append(w)

        # ── Service / repair tickets ──
        ticket_specs = [
            ("HP Laptop 15s", "laptop", "screen", "in_repair", 1500, custs[0], 3),
            ("Dell Optiplex Desktop", "desktop", "power", "diagnosing", 800, custs[1], 1),
            ("Samsung Galaxy A54", "phone", "battery", "ready_for_pickup", 1200, custs[2], 5),
            ("Asus TUF Gaming", "laptop", "software", "delivered", 900, custs[0], 12),
            ("iPad Air", "tablet", "liquid", "awaiting_parts", 2500, custs[1], 2),
            ("PS5 Console", "console", "power", "received", 0, None, 0),
        ]
        for i, (device, dtype, itype, status, charge, cust, days_ago) in enumerate(ticket_specs, start=1):
            ServiceTicket.all_objects.create(
                shop_id=shop.id, ticket_no=f"SVC-{i:06d}",
                customer=cust, customer_name="" if cust else "Walk-in",
                device_description=device, device_type=dtype, issue_type=itype,
                complaint=f"Reported issue: {itype} on {device}.",
                status=status, service_charge=Decimal(charge),
                received_at=_tz.now() - _td(days=days_ago),
            )

        self.stdout.write(self.style.SUCCESS(
            f"Demo ready: shop #{shop.id}, {len(prods)} products, {len(custs)} customers, "
            f"{n_sales} sales, {len(warranties)} warranties, {len(ticket_specs)} service tickets."
        ))
