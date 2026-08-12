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
    # name, category, barcode, cost, price, warranty_months, stock
    ("A4TECH KRS-82 Wired Keyboard", "Accessories", "DEMO100001", 700, 1100, 12, 40),
    ("Logitech M170 Wireless Mouse", "Accessories", "DEMO100002", 550, 850, 12, 60),
    ("HP 65W Laptop Adapter", "Accessories", "DEMO100003", 400, 700, 6, 35),
    ("Samsung 24\" LED Monitor", "Electronics", "DEMO100004", 9500, 12500, 24, 12),
    ("TP-Link Archer C6 Router", "Electronics", "DEMO100005", 2200, 3200, 12, 20),
    ("Sandisk 64GB Pendrive", "Accessories", "DEMO100006", 450, 750, 60, 100),
    ("Xiaomi 10000mAh Power Bank", "Electronics", "DEMO100007", 1300, 1900, 6, 25),
    ("HDMI 1.5m Cable", "Accessories", "DEMO100008", 120, 300, 0, 150),
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

        # A handful of sales (some fully paid, one partial → shows a due)
        def sell(items, customer, pay_ratio=1.0):
            total = sum(Decimal(q) * Decimal(pr) for _, q, pr in items)
            create_sale(
                shop=shop,
                items=[{"product": p, "quantity": Decimal(q), "unit_price": Decimal(pr)} for p, q, pr in items],
                customer=customer,
                payments=[{"amount": (total * Decimal(str(pay_ratio))).quantize(Decimal("1")), "method": "cash"}],
                created_by=owner,
            )

        sell([(prods[0], 1, 1100), (prods[1], 2, 850)], custs[0], 1.0)
        sell([(prods[3], 1, 12500)], custs[1], 0.5)      # partial → due
        sell([(prods[5], 3, 750), (prods[7], 2, 300)], custs[2], 1.0)
        sell([(prods[4], 1, 3200)], None, 1.0)            # walk-in

        self.stdout.write(self.style.SUCCESS(
            f"Demo ready: shop #{shop.id}, {len(prods)} products, {len(custs)} customers, 4 sales."
        ))
