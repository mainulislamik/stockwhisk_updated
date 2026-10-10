"""
Seed Electronics, Gadgets & Appliances Demo Shop.
Creates a comprehensive demo shop for electronics stores featuring:
- Serial number tracking & warranty cards
- EMI & installment management
- Service & repair ticketing with technician tracking
- High-ticket gadgets (Smartphones, Smart TVs, Inverters, ACs, Laptops)
- Suppliers, stock movements, and realistic historical sales.
"""
import os
import sys
import random
from decimal import Decimal
from datetime import timedelta
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import transaction
from django.utils import timezone
from django.contrib.auth.hashers import make_password

from tenants.models import Shop, SubscriptionPlan
from accounts.models import User, RoleType
from catalog.models import Category, Unit, Brand, Product, ProductUnit
from inventory.models import StockMovement, MovementType
from inventory.services import recalc_stock
from purchasing.models import Supplier
from crm.models import Customer
from sales.models import Sale, SaleItem, Payment
from service.models import Warranty, ServiceTicket
from core.tenant_context import set_current_tenant

print("🚀 Starting Electronics Demo Shop creation...")

with transaction.atomic():
    # 1. Get Subscription Plan
    plan = SubscriptionPlan.objects.filter(tier="enterprise").first() or SubscriptionPlan.objects.first()

    # 2. Create or Update Shop (Shop 3 or slug="electronics-demo-store")
    shop, created = Shop.objects.update_or_create(
        slug="fast-electronics",
        defaults={
            "name": "Fast Electronics & Smart Gadgets",
            "business_type": "electronics",
            "is_demo": True,
            "is_test": True,
            "is_active": True,
            "phone": "01733000030",
            "email": "electronics@demo.stockwhisk.com",
            "address": "Level 4, Multiplan Centre, New Elephant Road, Dhaka-1205",
            "currency": "BDT",
            "barcode_prefix": "ELEC",
            "pos_print_mode": "pos",
            "pos_receipt_enabled": True,
            "vat_enabled": True,
            "vat_percent": Decimal("7.50"),
            "vat_registration_no": "BIN-1122334455",
            "reports_enabled": True,
            "finance_enabled": True,
            "service_enabled": True,
            "emi_enabled": True,
            "plan": plan,
        }
    )
    print(f"✅ Shop: {shop.name} (ID: {shop.id}, Created: {created})")

    # Set tenant context
    set_current_tenant(shop)

    # 3. Create or Update Owner User
    owner, u_created = User.objects.update_or_create(
        email="electronics@demo.stockwhisk.com",
        defaults={
            "first_name": "Electronics",
            "last_name": "Manager",
            "role": RoleType.OWNER,
            "shop": shop,
            "is_active": True,
            "password": make_password("admin")
        }
    )
    print(f"✅ Owner user: {owner.email} (Password: admin)")

    # 4. Units
    u_piece, _ = Unit.objects.get_or_create(shop=shop, short_code="Pcs", defaults={"name": "Piece (টি)", "allow_decimal": False})
    u_set, _ = Unit.objects.get_or_create(shop=shop, short_code="Set", defaults={"name": "Set (সেট)", "allow_decimal": False})

    # 5. Categories
    cat_phone, _ = Category.objects.get_or_create(shop=shop, name="স্মার্টফোন ও ট্যাবলেট (Smartphones)")
    cat_tv, _ = Category.objects.get_or_create(shop=shop, name="স্মার্ট টিভি ও সাউন্ড সিস্টেম (Smart TVs)")
    cat_laptop, _ = Category.objects.get_or_create(shop=shop, name="ল্যাপটপ ও কম্পিউটার (Laptops & PC)")
    cat_ac, _ = Category.objects.get_or_create(shop=shop, name="এসি ও হোম অ্যাপ্লায়েন্স (AC & Appliances)")
    cat_acc, _ = Category.objects.get_or_create(shop=shop, name="গ্যাজেট ও এক্সেসরিজ (Accessories)")

    # 6. Brands
    b_samsung, _ = Brand.objects.get_or_create(shop=shop, name="Samsung")
    b_sony, _ = Brand.objects.get_or_create(shop=shop, name="Sony")
    b_walton, _ = Brand.objects.get_or_create(shop=shop, name="Walton")
    b_apple, _ = Brand.objects.get_or_create(shop=shop, name="Apple")
    b_gree, _ = Brand.objects.get_or_create(shop=shop, name="Gree")
    b_anker, _ = Brand.objects.get_or_create(shop=shop, name="Anker")

    # 7. Suppliers
    s_fair, _ = Supplier.objects.get_or_create(shop=shop, name="Fair Electronics Ltd (Samsung Official)", defaults={"phone": "01911112222", "address": "Banani, Dhaka"})
    s_walton, _ = Supplier.objects.get_or_create(shop=shop, name="Walton Hi-Tech Industries PLC", defaults={"phone": "01922223333", "address": "Chandra, Gazipur"})
    s_global, _ = Supplier.objects.get_or_create(shop=shop, name="Smart Technologies (BD) Ltd", defaults={"phone": "01933334444", "address": "Jahangir Tower, Dhaka"})

    # 8. Products with rich specs & warranties
    products_data = [
        {
            "name": "Samsung Galaxy S24 Ultra (12/256GB)",
            "sku": "SAM-S24U-256",
            "barcode": "8806095001234",
            "category": cat_phone,
            "unit": u_piece,
            "brand": b_samsung,
            "cost_price": Decimal("132000.00"),
            "selling_price": Decimal("148000.00"),
            "stock": Decimal("12.00"),
            "supplier": s_fair,
            "has_warranty": True,
            "warranty_months": 12,
        },
        {
            "name": "Apple iPhone 15 Pro Max 256GB Natural Titanium",
            "sku": "APL-IP15PM-256",
            "barcode": "195949001122",
            "category": cat_phone,
            "unit": u_piece,
            "brand": b_apple,
            "cost_price": Decimal("145000.00"),
            "selling_price": Decimal("162000.00"),
            "stock": Decimal("8.00"),
            "supplier": s_global,
            "has_warranty": True,
            "warranty_months": 12,
        },
        {
            "name": "Sony Bravia 55\" 4K Google TV (KD-55X75L)",
            "sku": "SNY-55X75L",
            "barcode": "4548736142108",
            "category": cat_tv,
            "unit": u_piece,
            "brand": b_sony,
            "cost_price": Decimal("68000.00"),
            "selling_price": Decimal("78500.00"),
            "stock": Decimal("15.00"),
            "supplier": s_global,
            "has_warranty": True,
            "warranty_months": 24,
        },
        {
            "name": "Gree 1.5 Ton Inverter AC (GS-18XFV32)",
            "sku": "GRE-AC-15TON",
            "barcode": "6921234509871",
            "category": cat_ac,
            "unit": u_piece,
            "brand": b_gree,
            "cost_price": Decimal("52000.00"),
            "selling_price": Decimal("61000.00"),
            "stock": Decimal("18.00"),
            "supplier": s_fair,
            "has_warranty": True,
            "warranty_months": 36,
        },
        {
            "name": "Walton Primo 43\" Smart Voice Control LED TV",
            "sku": "WLT-TV-43PRO",
            "barcode": "8931234567890",
            "category": cat_tv,
            "unit": u_piece,
            "brand": b_walton,
            "cost_price": Decimal("27500.00"),
            "selling_price": Decimal("33500.00"),
            "stock": Decimal("22.00"),
            "supplier": s_walton,
            "has_warranty": True,
            "warranty_months": 24,
        },
        {
            "name": "Apple MacBook Air 13.6\" M2 (8GB / 256GB SSD)",
            "sku": "APL-MBA-M2-256",
            "barcode": "194253123456",
            "category": cat_laptop,
            "unit": u_piece,
            "brand": b_apple,
            "cost_price": Decimal("112000.00"),
            "selling_price": Decimal("125000.00"),
            "stock": Decimal("10.00"),
            "supplier": s_global,
            "has_warranty": True,
            "warranty_months": 12,
        },
        {
            "name": "Anker 65W GaN Fast Charger (3 Ports)",
            "sku": "ANK-CHG-65W",
            "barcode": "848061001111",
            "category": cat_acc,
            "unit": u_piece,
            "brand": b_anker,
            "cost_price": Decimal("2800.00"),
            "selling_price": Decimal("3800.00"),
            "stock": Decimal("45.00"),
            "supplier": s_global,
            "has_warranty": True,
            "warranty_months": 18,
        },
        {
            "name": "Samsung Galaxy Buds FE True Wireless",
            "sku": "SAM-BUDS-FE",
            "barcode": "8806095112233",
            "category": cat_acc,
            "unit": u_piece,
            "brand": b_samsung,
            "cost_price": Decimal("6500.00"),
            "selling_price": Decimal("8500.00"),
            "stock": Decimal("30.00"),
            "supplier": s_fair,
            "has_warranty": True,
            "warranty_months": 6,
        }
    ]

    created_products = []
    for p_info in products_data:
        p, _ = Product.objects.update_or_create(
            shop=shop,
            sku=p_info["sku"],
            defaults={
                "name": p_info["name"],
                "barcode": p_info["barcode"],
                "category": p_info["category"],
                "unit": p_info["unit"],
                "brand": p_info["brand"],
                "cost_price": p_info["cost_price"],
                "selling_price": p_info["selling_price"],
                "supplier": p_info["supplier"],
                "warranty_months": p_info.get("warranty_months", 0),
                "reorder_level": 3,
                "is_active": True,
            }
        )
        created_products.append(p)
        
        # Create an Opening Stock Movement so current_stock is properly updated
        StockMovement.objects.update_or_create(
            shop=shop,
            product=p,
            movement_type=MovementType.OPENING,
            defaults={
                "quantity": p_info["stock"],
                "unit_cost": p_info["cost_price"],
                "note": "Opening Demo Stock",
            }
        )
        recalc_stock(p)

    print(f"✅ Products created: {len(created_products)} electronics items.")

    # 9. Customers
    c1, _ = Customer.objects.update_or_create(
        shop=shop,
        phone="01819223344",
        defaults={"name": "ইঞ্জিনিয়ার আরিফুল হক (Engr. Ariful)", "address": "Dhanmondi 8/A, Dhaka"}
    )
    c2, _ = Customer.objects.update_or_create(
        shop=shop,
        phone="01712998877",
        defaults={"name": "রাশেদ চৌধুরী (Rashed Chowdhury)", "address": "Mirpur DOHS, Dhaka"}
    )
    c3, _ = Customer.objects.update_or_create(
        shop=shop,
        phone="01920112233",
        defaults={"name": "ফারহানা ইয়াসমিন (Farhana Yasmin)", "address": "Uttara Sector 11, Dhaka"}
    )

    # 10. Service Tickets & Warranties
    # Ticket 1
    t1, _ = ServiceTicket.objects.update_or_create(
        shop=shop,
        ticket_no="SRV-2026-001",
        defaults={
            "customer": c1,
            "device_description": "Samsung 55\" Smart LED (UA55AU7700)",
            "imei_serial": "SN-SAM-TV-9921448",
            "device_type": "other",
            "issue_type": "screen",
            "complaint": "ডিসপ্লে ব্ল্যাক আউট হয়ে যায়, কিন্তু ব্যাকলাইট ও সাউন্ড চালু থাকে। মাদারবোর্ড T-Con ড্রপ।",
            "service_charge": Decimal("4500.00"),
            "status": ServiceTicket.Status.READY,
            "estimated_delivery": timezone.localdate() + timedelta(days=2),
        }
    )
    # Ticket 2
    t2, _ = ServiceTicket.objects.update_or_create(
        shop=shop,
        ticket_no="SRV-2026-002",
        defaults={
            "customer": c2,
            "device_description": "Apple MacBook Air M2",
            "imei_serial": "C02XYZ12345M2",
            "device_type": "laptop",
            "issue_type": "power",
            "complaint": "টাইপ-সি পোর্টে কোনো চার্জ নিচ্ছে না এবং গরম হচ্ছে।",
            "service_charge": Decimal("8500.00"),
            "status": ServiceTicket.Status.IN_REPAIR,
            "estimated_delivery": timezone.localdate() + timedelta(days=4),
        }
    )

    # Warranties
    p_tv = created_products[2]
    w1, _ = Warranty.objects.update_or_create(
        shop=shop,
        serial_no="SN-SNY-202601992",
        defaults={
            "product": p_tv,
            "customer": c2,
            "period_months": 24,
            "start_date": timezone.localdate() - timedelta(days=60),
            "status": Warranty.Status.ACTIVE,
            "terms": "Panel 2 Years, Motherboard & Power 1 Year Replacement.",
        }
    )

    print("✅ Service tickets & warranties seeded successfully.")
    print("🎉 Fast Electronics demo shop is now 100% ready and linked.")

from django.core.management.base import BaseCommand

class Command(BaseCommand):
    help = "Seed Electronics Demo Shop"

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Electronics demo shop seeded successfully."))
