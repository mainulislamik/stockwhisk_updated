import os
import sys
import random
from decimal import Decimal
from datetime import timedelta
import django

# Setup django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.utils import timezone

from tenants.models import Shop
from accounts.models import User
from catalog.models import Category, Unit, Brand, Product, ProductVariation
from crm.models import Customer
from purchasing.models import Supplier
from inventory.models import StockMovement, MovementType
from inventory.services import recalc_stock
from sales.models import Sale, SaleItem, Payment
from sales.services import create_sale
from core.tenant_context import set_current_tenant

print("🚀 Starting Fashion & Apparel Demo Store Creation & Seeding...")

with transaction.atomic():
    # 1. Create or Update Shop
    shop, created = Shop.objects.update_or_create(
        slug="fashion-demo-store",
        defaults={
            "name": "StockWhisk Fashion & Apparel",
            "business_type": "fashion",
            "is_demo": True,
            "is_test": True,
            "is_active": True,
            "phone": "01711000030",
            "email": "fashion@demo.stockwhisk.com",
            "address": "Level 3, Block D, Jamuna Future Park, Dhaka",
            "currency": "BDT",
            "barcode_prefix": "SWF",
            "pos_print_mode": "pos",
            "vat_enabled": True,
            "vat_percent": Decimal("5.00"),
            "service_enabled": False,
            "reports_enabled": True,
            "finance_enabled": True,
        }
    )
    set_current_tenant(shop)
    print(f"✅ Shop: {shop.name} (ID: {shop.id}) ready.")

    # 2. Owner user
    user, _ = User.objects.update_or_create(
        email="fashion@demo.stockwhisk.com",
        defaults={
            "first_name": "Fashion",
            "last_name": "Manager",
            "shop": shop,
            "role": "owner",
            "password": make_password("admin"),
            "is_active": True,
        }
    )
    print("✅ Owner User created: fashion@demo.stockwhisk.com (Password: admin)")

    # 3. Units
    u_pcs, _ = Unit.objects.get_or_create(shop=shop, name="pcs", defaults={"short_code": "পিস", "measure_type": Unit.MeasureType.COUNT, "allow_decimal": False})
    u_set, _ = Unit.objects.get_or_create(shop=shop, name="set", defaults={"short_code": "সেট", "measure_type": Unit.MeasureType.COUNT, "allow_decimal": False})
    u_pair, _ = Unit.objects.get_or_create(shop=shop, name="pair", defaults={"short_code": "জোড়া", "measure_type": Unit.MeasureType.COUNT, "allow_decimal": False})

    # 4. Categories
    cat_panjabi, _ = Category.objects.get_or_create(shop=shop, name="পাঞ্জাবি ও কাবলি (Panjabi & Kabli)")
    cat_shirts, _ = Category.objects.get_or_create(shop=shop, name="শার্ট ও পোলো টি-শার্ট (Shirts & Polo)")
    cat_denim, _ = Category.objects.get_or_create(shop=shop, name="ডেনিম জিন্স ও গ্যাবার্ডিন (Denim & Chinos)")
    cat_saree, _ = Category.objects.get_or_create(shop=shop, name="শাড়ি ও এক্সক্লুসিভ কালেকশন (Sarees)")
    cat_kurti, _ = Category.objects.get_or_create(shop=shop, name="থ্রি-পিস ও ডিজাইনার কুর্তি (Three-piece & Kurtis)")
    cat_kids, _ = Category.objects.get_or_create(shop=shop, name="বাচ্চাদের উৎসবের পোশাক (Kids Wear)")
    cat_accessories, _ = Category.objects.get_or_create(shop=shop, name="লেদার বেল্ট ও এক্সেসরিজ (Accessories)")

    # 5. Brands
    b_aarong, _ = Brand.objects.get_or_create(shop=shop, name="Aarong")
    b_sailor, _ = Brand.objects.get_or_create(shop=shop, name="Sailor")
    b_richman, _ = Brand.objects.get_or_create(shop=shop, name="Richman")
    b_lubnan, _ = Brand.objects.get_or_create(shop=shop, name="Lubnan")
    b_cats_eye, _ = Brand.objects.get_or_create(shop=shop, name="Cats Eye")
    b_apex, _ = Brand.objects.get_or_create(shop=shop, name="Apex")

    # 6. Suppliers
    s_beximco, _ = Supplier.objects.get_or_create(shop=shop, name="Beximco Apparels Ltd", defaults={"phone": "01788888888", "address": "Savar, Dhaka"})
    s_aarong_sup, _ = Supplier.objects.get_or_create(shop=shop, name="BRAC Aarong Production Centre", defaults={"phone": "01799999999", "address": "Tejgaon, Dhaka"})
    s_ecstasy, _ = Supplier.objects.get_or_create(shop=shop, name="Ecstasy Lifestyle Ltd", defaults={"phone": "01755555555", "address": "Banani, Dhaka"})

    # 7. Customers
    c_vip1, _ = Customer.objects.update_or_create(
        shop=shop,
        phone="01711223344",
        defaults={
            "name": "আসিফ ইকবাল (Fashion Gold Member)",
            "email": "asif@fashion.demo",
            "address": "House 12, Road 5, Dhanmondi, Dhaka",
            "loyalty_points": 450,
            "membership_id": "SWF-GOLD-501"
        }
    )
    c_vip2, _ = Customer.objects.update_or_create(
        shop=shop,
        phone="01811223344",
        defaults={
            "name": "নুসরাত জাহান (Platinum Club)",
            "email": "nusrat@fashion.demo",
            "address": "Sector 4, Uttara, Dhaka",
            "loyalty_points": 680,
            "membership_id": "SWF-PLAT-502"
        }
    )
    c_walkin, _ = Customer.objects.update_or_create(
        shop=shop,
        phone="01911223344",
        defaults={
            "name": "ওয়াক-ইন কাস্টমার (Walk-in)",
            "loyalty_points": 50,
            "membership_id": "SWF-REG-503"
        }
    )

    # 8. Diverse Apparel Products with Size/Color Variants
    products_spec = [
        {
            "name": "প্রিমিয়াম কটন এমব্রয়ডারি পাঞ্জাবি (Navy Blue)",
            "sku": "PANJ-NAVY",
            "barcode": "894220000100",
            "category": cat_panjabi,
            "unit": u_pcs,
            "brand": b_lubnan,
            "supplier": s_beximco,
            "cost": Decimal("1400.00"),
            "sell": Decimal("2250.00"),
            "variants": [
                {"name": "Navy Blue / M (38)", "sku": "PANJ-NAV-M", "barcode": "894220000101", "size": "38", "color": "Navy Blue", "stock": 15},
                {"name": "Navy Blue / L (40)", "sku": "PANJ-NAV-L", "barcode": "894220000102", "size": "40", "color": "Navy Blue", "stock": 25},
                {"name": "Navy Blue / XL (42)", "sku": "PANJ-NAV-XL", "barcode": "894220000103", "size": "42", "color": "Navy Blue", "stock": 20},
                {"name": "Navy Blue / XXL (44)", "sku": "PANJ-NAV-XXL", "barcode": "894220000104", "size": "44", "color": "Navy Blue", "stock": 10},
            ]
        },
        {
            "name": "রয়্যাল সিল্ক ডিজাইনার কাবলি সেট (Maroon)",
            "sku": "KABLI-MRN",
            "barcode": "894220000200",
            "category": cat_panjabi,
            "unit": u_set,
            "brand": b_richman,
            "supplier": s_beximco,
            "cost": Decimal("2100.00"),
            "sell": Decimal("3450.00"),
            "variants": [
                {"name": "Maroon / M (38)", "sku": "KABLI-MRN-M", "barcode": "894220000201", "size": "38", "color": "Maroon", "stock": 12},
                {"name": "Maroon / L (40)", "sku": "KABLI-MRN-L", "barcode": "894220000202", "size": "40", "color": "Maroon", "stock": 18},
                {"name": "Maroon / XL (42)", "sku": "KABLI-MRN-XL", "barcode": "894220000203", "size": "42", "color": "Maroon", "stock": 14},
            ]
        },
        {
            "name": "স্লিম ফিট স্ট্রেচ ডেনিম জিন্স প্যান্ট (Deep Indigo)",
            "sku": "JEANS-INDIGO",
            "barcode": "894220000300",
            "category": cat_denim,
            "unit": u_pcs,
            "brand": b_sailor,
            "supplier": s_ecstasy,
            "cost": Decimal("1100.00"),
            "sell": Decimal("1850.00"),
            "variants": [
                {"name": "Deep Indigo / 30", "sku": "JNS-IND-30", "barcode": "894220000301", "size": "30", "color": "Deep Indigo", "stock": 15},
                {"name": "Deep Indigo / 32", "sku": "JNS-IND-32", "barcode": "894220000302", "size": "32", "color": "Deep Indigo", "stock": 25},
                {"name": "Deep Indigo / 34", "sku": "JNS-IND-34", "barcode": "894220000303", "size": "34", "color": "Deep Indigo", "stock": 20},
                {"name": "Deep Indigo / 36", "sku": "JNS-IND-36", "barcode": "894220000304", "size": "36", "color": "Deep Indigo", "stock": 12},
            ]
        },
        {
            "name": "১০০% প্রিমিয়াম সুতি পিকে পোলো টি-শার্ট (Classic Olive)",
            "sku": "POLO-OLIVE",
            "barcode": "894220000400",
            "category": cat_shirts,
            "unit": u_pcs,
            "brand": b_sailor,
            "supplier": s_ecstasy,
            "cost": Decimal("450.00"),
            "sell": Decimal("750.00"),
            "variants": [
                {"name": "Olive / S", "sku": "POLO-OLV-S", "barcode": "894220000401", "size": "S", "color": "Classic Olive", "stock": 20},
                {"name": "Olive / M", "sku": "POLO-OLV-M", "barcode": "894220000402", "size": "M", "color": "Classic Olive", "stock": 35},
                {"name": "Olive / L", "sku": "POLO-OLV-L", "barcode": "894220000403", "size": "L", "color": "Classic Olive", "stock": 30},
                {"name": "Olive / XL", "sku": "POLO-OLV-XL", "barcode": "894220000404", "size": "XL", "color": "Classic Olive", "stock": 18},
            ]
        },
        {
            "name": "হ্যান্ডলুম ঢাকাই জামদানি শাড়ি (Black & Gold Zari)",
            "sku": "SAREE-JAMDANI",
            "barcode": "894220000500",
            "category": cat_saree,
            "unit": u_pcs,
            "brand": b_aarong,
            "supplier": s_aarong_sup,
            "cost": Decimal("3800.00"),
            "sell": Decimal("5800.00"),
            "stock": Decimal("18.00"),
        },
        {
            "name": "ডিজাইনার জর্জেট পার্টি থ্রি-পিস (Pastel Pink)",
            "sku": "KURTI-PINK",
            "barcode": "894220000600",
            "category": cat_kurti,
            "unit": u_set,
            "brand": b_aarong,
            "supplier": s_aarong_sup,
            "cost": Decimal("2200.00"),
            "sell": Decimal("3600.00"),
            "variants": [
                {"name": "Pink / M", "sku": "KRT-PNK-M", "barcode": "894220000601", "size": "M", "color": "Pastel Pink", "stock": 15},
                {"name": "Pink / L", "sku": "KRT-PNK-L", "barcode": "894220000602", "size": "L", "color": "Pastel Pink", "stock": 20},
                {"name": "Pink / XL", "sku": "KRT-PNK-XL", "barcode": "894220000603", "size": "XL", "color": "Pastel Pink", "stock": 12},
            ]
        },
        {
            "name": "বাচ্চাদের উৎসবের ঈদ পাঞ্জাবি সেট (Aqua Blue)",
            "sku": "KIDS-PANJ-AQUA",
            "barcode": "894220000700",
            "category": cat_kids,
            "unit": u_set,
            "brand": b_aarong,
            "supplier": s_aarong_sup,
            "cost": Decimal("750.00"),
            "sell": Decimal("1250.00"),
            "variants": [
                {"name": "Aqua / 4-5 Yrs", "sku": "KID-AQ-4", "barcode": "894220000701", "size": "4-5 Yrs", "color": "Aqua Blue", "stock": 15},
                {"name": "Aqua / 6-7 Yrs", "sku": "KID-AQ-6", "barcode": "894220000702", "size": "6-7 Yrs", "color": "Aqua Blue", "stock": 18},
                {"name": "Aqua / 8-9 Yrs", "sku": "KID-AQ-8", "barcode": "894220000703", "size": "8-9 Yrs", "color": "Aqua Blue", "stock": 14},
            ]
        },
        {
            "name": "জেনুইন লেদার ফর্মাল বেল্ট ও ক্লাসিক ওয়ালেট কম্বো",
            "sku": "ACC-BELT-WALLET",
            "barcode": "894220000800",
            "category": cat_accessories,
            "unit": u_set,
            "brand": b_apex,
            "supplier": s_beximco,
            "cost": Decimal("850.00"),
            "sell": Decimal("1450.00"),
            "stock": Decimal("35.00"),
        }
    ]

    all_products = []
    for p_data in products_spec:
        prod, _ = Product.objects.update_or_create(
            shop=shop,
            barcode=p_data["barcode"],
            defaults={
                "name": p_data["name"],
                "sku": p_data["sku"],
                "category": p_data["category"],
                "unit": p_data["unit"],
                "brand": p_data["brand"],
                "supplier": p_data["supplier"],
                "cost_price": p_data["cost"],
                "selling_price": p_data["sell"],
                "is_active": True,
            }
        )
        all_products.append(prod)

        # Handle variants
        if "variants" in p_data:
            total_var_stock = Decimal("0")
            for v_data in p_data["variants"]:
                var, _ = ProductVariation.objects.update_or_create(
                    shop=shop,
                    product=prod,
                    sku=v_data["sku"],
                    defaults={
                        "name": v_data["name"],
                        "barcode": v_data["barcode"],
                        "cost_price": p_data["cost"],
                        "selling_price": p_data["sell"],
                        "attributes": {"size": v_data["size"], "color": v_data["color"]},
                        "is_active": True,
                    }
                )
                total_var_stock += Decimal(str(v_data["stock"]))
            # Create opening stock
            StockMovement.objects.filter(shop=shop, product=prod, movement_type=MovementType.OPENING).delete()
            StockMovement.objects.create(
                shop=shop,
                product=prod,
                movement_type=MovementType.OPENING,
                quantity=total_var_stock,
                unit_cost=p_data["cost"],
                note="Opening stock for variants"
            )
            recalc_stock(prod)
        else:
            StockMovement.objects.filter(shop=shop, product=prod, movement_type=MovementType.OPENING).delete()
            StockMovement.objects.create(
                shop=shop,
                product=prod,
                movement_type=MovementType.OPENING,
                quantity=p_data["stock"],
                unit_cost=p_data["cost"],
                note="Opening stock"
            )
            recalc_stock(prod)

    print(f"✅ Created {len(all_products)} Fashion products with variants and stock movements!")

    # 9. Realistic Past 30 Days Fashion Sales History
    now = timezone.now()
    sales_created = 0
    for day_offset in range(25, -1, -1):
        sale_time = now - timedelta(days=day_offset, hours=random.randint(1, 8), minutes=random.randint(5, 55))
        num_sales_today = random.randint(1, 3)
        for _ in range(num_sales_today):
            p = random.choice(all_products)
            cust = random.choice([c_vip1, c_vip2, c_walkin, None])
            qty = Decimal(str(random.randint(1, 2)))
            price = p.selling_price
            subtot = qty * price
            tax_val = round(subtot * Decimal("0.05"), 2)
            total_val = subtot + tax_val
            
            alteration_note = "প্যান্টের দৈর্ঘ্য ১.৫ ইঞ্চি কমানো (Hemming)" if p.category == cat_denim else ""
            alteration_st = "delivered" if day_offset > 2 else ("in_progress" if alteration_note else "")

            sale = create_sale(
                shop=shop,
                customer=cust,
                items=[{"product": p, "quantity": qty, "unit_price": price, "discount": Decimal("0")}],
                payments=[{"method": Payment.Method.CASH if random.random() > 0.4 else Payment.Method.CARD, "amount": total_val}],
                tax=tax_val,
                sale_date=sale_time,
                created_by=user,
                alteration_notes=alteration_note,
                alteration_status=alteration_st,
                note=f"Fashion POS Sale - {p.name[:20]}"
            )
            sales_created += 1

    print(f"✅ Generated {sales_created} realistic Fashion Sales transactions with alteration notes!")

print("🎉 StockWhisk Fashion & Apparel Demo Store Creation Complete!")
