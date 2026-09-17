import os
import sys
import random
from decimal import Decimal
from datetime import timedelta
import django

# Setup django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import transaction
from django.utils import timezone
from django.contrib.auth.hashers import make_password

from tenants.models import Shop, SubscriptionPlan
from accounts.models import User, RoleType
from catalog.models import Category, Unit, Brand, Product
from inventory.models import StockMovement, MovementType
from inventory.services import recalc_stock
from purchasing.models import Supplier
from crm.models import Customer
from sales.models import Sale, SaleItem, Payment
from core.tenant_context import set_current_tenant

print("🚀 Starting Super Shop & Grocery Demo Shop creation...")

with transaction.atomic():
    # 1. Get or Create Super Shop Plan
    plan = SubscriptionPlan.objects.filter(tier="enterprise").first() or SubscriptionPlan.objects.first()

    # 2. Create or Update Shop
    shop, created = Shop.objects.update_or_create(
        slug="supershop-demo-store",
        defaults={
            "name": "StockWhisk Super Shop & Grocery",
            "business_type": "supershop",
            "is_demo": True,
            "is_test": True,
            "is_active": True,
            "phone": "01711000020",
            "email": "supershop@demo.stockwhisk.com",
            "address": "Plot 45, Gulshan Avenue, Dhaka-1212",
            "currency": "BDT",
            "barcode_prefix": "SWG",
            "pos_print_mode": "pos",
            "pos_receipt_enabled": True,
            "vat_enabled": True,
            "vat_percent": Decimal("5.00"),
            "vat_registration_no": "BIN-9876543210",
            "reports_enabled": True,
            "finance_enabled": True,
            "service_enabled": False,
            "plan": plan,
        }
    )
    print(f"✅ Shop: {shop.name} (ID: {shop.id}, Created: {created})")

    # Set thread tenant context
    set_current_tenant(shop)

    # 3. Create or Update Owner User
    owner, u_created = User.objects.update_or_create(
        email="supershop@demo.stockwhisk.com",
        defaults={
            "first_name": "SuperStore",
            "last_name": "Manager",
            "role": RoleType.OWNER,
            "shop": shop,
            "is_active": True,
            "password": make_password("admin")
        }
    )
    print(f"✅ Owner user: {owner.email} (Password: admin)")

    # 4. Units
    u_kg, _ = Unit.objects.get_or_create(shop=shop, name="kg", defaults={"short_code": "কেজি", "measure_type": Unit.MeasureType.WEIGHT, "allow_decimal": True})
    u_gm, _ = Unit.objects.get_or_create(shop=shop, name="gm", defaults={"short_code": "গ্রাম", "measure_type": Unit.MeasureType.WEIGHT, "allow_decimal": True})
    u_pcs, _ = Unit.objects.get_or_create(shop=shop, name="pcs", defaults={"short_code": "পিস", "measure_type": Unit.MeasureType.COUNT, "allow_decimal": False})
    u_ltr, _ = Unit.objects.get_or_create(shop=shop, name="litre", defaults={"short_code": "লিটার", "measure_type": Unit.MeasureType.VOLUME, "allow_decimal": True})
    u_pack, _ = Unit.objects.get_or_create(shop=shop, name="pack", defaults={"short_code": "প্যাকেট", "measure_type": Unit.MeasureType.COUNT, "allow_decimal": False})
    u_goj, _ = Unit.objects.get_or_create(shop=shop, name="Goj", defaults={"short_code": "গজ", "measure_type": Unit.MeasureType.LENGTH, "allow_decimal": True})
    u_meter, _ = Unit.objects.get_or_create(shop=shop, name="Meter", defaults={"short_code": "মি.", "measure_type": Unit.MeasureType.LENGTH, "allow_decimal": True})

    # 5. Categories
    cat_grains, _ = Category.objects.get_or_create(shop=shop, name="চাল, ডাল ও তেল (Grains & Oil)")
    cat_veg, _ = Category.objects.get_or_create(shop=shop, name="তাজা শাকসবজি ও ফলমূল (Fresh Produce)")
    cat_dairy, _ = Category.objects.get_or_create(shop=shop, name="ডেইরি ও বেকারি (Dairy & Bakery)")
    cat_meat, _ = Category.objects.get_or_create(shop=shop, name="মাছ ও মাংস (Meat & Fish)")
    cat_snacks, _ = Category.objects.get_or_create(shop=shop, name="স্ন্যাকস ও পানীয় (Snacks & Drinks)")
    cat_toiletries, _ = Category.objects.get_or_create(shop=shop, name="টয়লেট্রিজ ও ক্লিনিং (Personal Care)")

    # 6. Brands
    b_rupchanda, _ = Brand.objects.get_or_create(shop=shop, name="Rupchanda")
    b_teer, _ = Brand.objects.get_or_create(shop=shop, name="Teer")
    b_fresh, _ = Brand.objects.get_or_create(shop=shop, name="Fresh")
    b_aarong, _ = Brand.objects.get_or_create(shop=shop, name="Aarong Dairy")
    b_pran, _ = Brand.objects.get_or_create(shop=shop, name="PRAN")
    b_unilever, _ = Brand.objects.get_or_create(shop=shop, name="Unilever")
    b_local, _ = Brand.objects.get_or_create(shop=shop, name="Fresh Farm / Local")

    # 7. Suppliers
    s_city, _ = Supplier.objects.get_or_create(shop=shop, name="City Group Ltd (Teer)", defaults={"phone": "01711111111", "address": "Motijheel, Dhaka"})
    s_meghna, _ = Supplier.objects.get_or_create(shop=shop, name="Meghna Group (Fresh)", defaults={"phone": "01722222222", "address": "Gulshan, Dhaka"})
    s_pran, _ = Supplier.objects.get_or_create(shop=shop, name="PRAN-RFL Foods Ltd", defaults={"phone": "01733333333", "address": "Badda, Dhaka"})
    s_unilever, _ = Supplier.objects.get_or_create(shop=shop, name="Unilever Bangladesh Ltd", defaults={"phone": "01744444444", "address": "Tejgaon, Dhaka"})

    # 8. Products List (20 rich supershop items)
    products_data = [
        # Fresh weight scale items (EAN-13 Weigh scale barcodes)
        {
            "name": "দেশি গোল আলু (Local Potato)",
            "sku": "VEG-001",
            "barcode": "200000100500",
            "category": cat_veg,
            "unit": u_kg,
            "brand": b_local,
            "cost_price": Decimal("35.00"),
            "selling_price": Decimal("45.00"),
            "stock": Decimal("450.00"),
            "supplier": s_meghna
        },
        {
            "name": "দেশি পেঁয়াজ (Local Red Onion)",
            "sku": "VEG-002",
            "barcode": "200000201000",
            "category": cat_veg,
            "unit": u_kg,
            "brand": b_local,
            "cost_price": Decimal("55.00"),
            "selling_price": Decimal("70.00"),
            "stock": Decimal("380.00"),
            "supplier": s_meghna
        },
        {
            "name": "আমদানি করা ফুজি আপেল (Fuji Apple)",
            "sku": "FRT-001",
            "barcode": "200000301500",
            "category": cat_veg,
            "unit": u_kg,
            "brand": b_local,
            "cost_price": Decimal("240.00"),
            "selling_price": Decimal("295.00"),
            "stock": Decimal("120.00"),
            "supplier": s_meghna
        },
        {
            "name": "ব্রয়লার মুরগির মাংস (Broiler Chicken Cleaned)",
            "sku": "MET-001",
            "barcode": "200000401250",
            "category": cat_meat,
            "unit": u_kg,
            "brand": b_local,
            "cost_price": Decimal("165.00"),
            "selling_price": Decimal("200.00"),
            "stock": Decimal("180.00"),
            "supplier": s_pran
        },
        {
            "name": "তাজা রুই মাছ (Fresh Rui Fish 1-2kg)",
            "sku": "FSH-001",
            "barcode": "200000502000",
            "category": cat_meat,
            "unit": u_kg,
            "brand": b_local,
            "cost_price": Decimal("280.00"),
            "selling_price": Decimal("350.00"),
            "stock": Decimal("90.00"),
            "supplier": s_meghna
        },
        # Packaged Grocery Essentials
        {
            "name": "রূপচাঁদা ফর্টিফাইড সয়াবিন তেল ৫ লিটার",
            "sku": "OIL-005L",
            "barcode": "894110000105",
            "category": cat_grains,
            "unit": u_pcs,
            "brand": b_rupchanda,
            "cost_price": Decimal("790.00"),
            "selling_price": Decimal("890.00"),
            "stock": Decimal("85.00"),
            "supplier": s_city
        },
        {
            "name": "তীর পরিশোধিত সয়াবিন তেল ১ লিটার",
            "sku": "OIL-001L",
            "barcode": "894110000101",
            "category": cat_grains,
            "unit": u_pcs,
            "brand": b_teer,
            "cost_price": Decimal("160.00"),
            "selling_price": Decimal("182.00"),
            "stock": Decimal("210.00"),
            "supplier": s_city
        },
        {
            "name": "মিনিকেট প্রিমিয়াম চাল ২৫ কেজি বস্তা",
            "sku": "RICE-25KG",
            "barcode": "894110000201",
            "category": cat_grains,
            "unit": u_pcs,
            "brand": b_fresh,
            "cost_price": Decimal("1680.00"),
            "selling_price": Decimal("1850.00"),
            "stock": Decimal("60.00"),
            "supplier": s_meghna
        },
        {
            "name": "তীর পরিশোধিত প্রিমিয়াম আটা ২ কেজি",
            "sku": "ATTA-2KG",
            "barcode": "894110000302",
            "category": cat_grains,
            "unit": u_pcs,
            "brand": b_teer,
            "cost_price": Decimal("110.00"),
            "selling_price": Decimal("128.00"),
            "stock": Decimal("140.00"),
            "supplier": s_city
        },
        {
            "name": "ফ্রেশ প্রিমিয়াম মসুর ডাল ১ কেজি",
            "sku": "DAL-1KG",
            "barcode": "894110000401",
            "category": cat_grains,
            "unit": u_pcs,
            "brand": b_fresh,
            "cost_price": Decimal("130.00"),
            "selling_price": Decimal("148.00"),
            "stock": Decimal("160.00"),
            "supplier": s_meghna
        },
        # Dairy & Bakery
        {
            "name": "আড়ং পাস্তুরিত তরল দুধ ১ লিটার",
            "sku": "MILK-1L",
            "barcode": "894110000501",
            "category": cat_dairy,
            "unit": u_pcs,
            "brand": b_aarong,
            "cost_price": Decimal("78.00"),
            "selling_price": Decimal("90.00"),
            "stock": Decimal("110.00"),
            "supplier": s_pran
        },
        {
            "name": "প্রাণ প্রিমিয়াম টোস্ট বিস্কুট ৩৫০ গ্রাম",
            "sku": "TOAST-350G",
            "barcode": "894110000601",
            "category": cat_dairy,
            "unit": u_pcs,
            "brand": b_pran,
            "cost_price": Decimal("44.00"),
            "selling_price": Decimal("55.00"),
            "stock": Decimal("190.00"),
            "supplier": s_pran
        },
        {
            "name": "আড়ং প্রিমিয়াম সল্টেড বাটার ২০০ গ্রাম",
            "sku": "BTR-200G",
            "barcode": "894110000502",
            "category": cat_dairy,
            "unit": u_pcs,
            "brand": b_aarong,
            "cost_price": Decimal("190.00"),
            "selling_price": Decimal("230.00"),
            "stock": Decimal("75.00"),
            "supplier": s_pran
        },
        # Snacks & Drinks
        {
            "name": "কোকা-কোলা রিফ্রেশিং ১.২৫ লিটার",
            "sku": "COKE-125L",
            "barcode": "894110000701",
            "category": cat_snacks,
            "unit": u_pcs,
            "brand": b_pran,
            "cost_price": Decimal("64.00"),
            "selling_price": Decimal("75.00"),
            "stock": Decimal("150.00"),
            "supplier": s_pran
        },
        {
            "name": "নেসক্যাফে ক্লাসিক কফি জার ৫০ গ্রাম",
            "sku": "COFFEE-50G",
            "barcode": "894110001001",
            "category": cat_snacks,
            "unit": u_pcs,
            "brand": b_fresh,
            "cost_price": Decimal("220.00"),
            "selling_price": Decimal("265.00"),
            "stock": Decimal("90.00"),
            "supplier": s_meghna
        },
        # Toiletries & Household
        {
            "name": "সানসিল্ক ব্ল্যাক শাইন শ্যাম্পু ৩৫০ মিলি",
            "sku": "SHMP-350ML",
            "barcode": "894110000801",
            "category": cat_toiletries,
            "unit": u_pcs,
            "brand": b_unilever,
            "cost_price": Decimal("310.00"),
            "selling_price": Decimal("370.00"),
            "stock": Decimal("80.00"),
            "supplier": s_unilever
        },
        {
            "name": "হুইল ২ইন১ ডিটারজেন্ট পাউডার ১ কেজি",
            "sku": "DET-1KG",
            "barcode": "894110000901",
            "category": cat_toiletries,
            "unit": u_pcs,
            "brand": b_unilever,
            "cost_price": Decimal("125.00"),
            "selling_price": Decimal("145.00"),
            "stock": Decimal("130.00"),
            "supplier": s_unilever
        },
        {
            "name": "লাইফবয় টোটাল ১০ সাবান ১০০ গ্রাম",
            "sku": "SOAP-100G",
            "barcode": "894110000802",
            "category": cat_toiletries,
            "unit": u_pcs,
            "brand": b_unilever,
            "cost_price": Decimal("42.00"),
            "selling_price": Decimal("50.00"),
            "stock": Decimal("250.00"),
            "supplier": s_unilever
        },
    ]

    # Create Products & Stock Movements
    created_products = []
    for pdata in products_data:
        prod, _ = Product.objects.update_or_create(
            shop=shop,
            barcode=pdata["barcode"],
            defaults={
                "name": pdata["name"],
                "sku": pdata["sku"],
                "category": pdata["category"],
                "unit": pdata["unit"],
                "brand": pdata["brand"],
                "cost_price": pdata["cost_price"],
                "selling_price": pdata["selling_price"],
                "supplier": pdata["supplier"],
                "warranty_months": 0,
                "is_active": True
            }
        )
        created_products.append(prod)

        # Opening Stock Movement
        StockMovement.objects.filter(shop=shop, product=prod, movement_type=MovementType.OPENING).delete()
        StockMovement.objects.create(
            shop=shop,
            product=prod,
            movement_type=MovementType.OPENING,
            quantity=pdata["stock"],
            unit_cost=pdata["cost_price"],
            note="Initial supershop inventory balance"
        )
        recalc_stock(prod)

    print(f"✅ Created {len(created_products)} rich supershop products & stock ledgers!")

    # 9. Customers
    cust_walkin, _ = Customer.objects.get_or_create(shop=shop, name="Walk-in Customer (নগদ ক্রেতা)", defaults={"phone": "01700000000", "address": "Dhaka"})
    cust1, _ = Customer.objects.get_or_create(shop=shop, name="ডা. তানভীর আহমেদ (Regular Member)", defaults={"phone": "01711223344", "address": "Gulshan-2, Dhaka"})
    cust2, _ = Customer.objects.get_or_create(shop=shop, name="সুলতানা পারভীন (Gold Club)", defaults={"phone": "01811556677", "address": "Banani, Dhaka"})
    cust3, _ = Customer.objects.get_or_create(shop=shop, name="আহসান উল্লাহ", defaults={"phone": "01911889900", "address": "Baridhara, Dhaka"})

    # 10. Generate Sample Sales History (past 15 days)
    now = timezone.now()
    sales_created = 0
    inv_counter = 1
    for day_offset in range(14, -1, -1):
        sale_date = now - timedelta(days=day_offset, hours=random.randint(1, 10))
        daily_sales_count = random.randint(3, 5)
        for s_idx in range(daily_sales_count):
            sale_cust = random.choice([cust_walkin, cust_walkin, cust1, cust2, cust3])
            chosen_prods = random.sample(created_products, random.randint(2, 4))
            
            subtotal = Decimal("0.00")
            discount_total = Decimal("0.00")
            items_to_create = []

            for cp in chosen_prods:
                if cp.unit == u_kg:
                    qty = Decimal(str(random.choice([0.5, 0.75, 1.0, 1.25, 1.5, 2.0])))
                else:
                    qty = Decimal(str(random.randint(1, 3)))
                
                price = cp.selling_price
                cost = cp.cost_price
                line_total = qty * price
                subtotal += line_total
                
                item_discount = Decimal(str(random.choice([0, 5, 10]))) if random.random() > 0.6 else Decimal("0")
                discount_total += item_discount

                items_to_create.append({
                    "product": cp,
                    "quantity": qty,
                    "unit_price": price,
                    "cost_price": cost,
                    "discount": item_discount,
                    "line_total": line_total - item_discount
                })

            vat_amount = (subtotal - discount_total) * Decimal("0.05")
            grand_total = subtotal - discount_total + vat_amount
            paid_amount = grand_total

            inv_no = f"SWG-INV-2609-{inv_counter:04d}"
            inv_counter += 1

            sale = Sale.objects.create(
                shop=shop,
                invoice_no=inv_no,
                customer=sale_cust,
                customer_name=sale_cust.name,
                customer_phone=sale_cust.phone,
                sale_date=sale_date,
                subtotal=subtotal,
                discount=discount_total,
                tax=vat_amount,
                total=grand_total,
                paid=paid_amount,
                status=Sale.Status.PAID,
                created_by=owner
            )

            for item_info in items_to_create:
                SaleItem.objects.create(
                    shop=shop,
                    sale=sale,
                    product=item_info["product"],
                    quantity=item_info["quantity"],
                    unit_price=item_info["unit_price"],
                    unit_cost=item_info["cost_price"],
                    discount=item_info["discount"],
                    subtotal=item_info["line_total"]
                )
                StockMovement.objects.create(
                    shop=shop,
                    product=item_info["product"],
                    movement_type=MovementType.SALE_OUT,
                    quantity=-item_info["quantity"],
                    unit_cost=item_info["cost_price"],
                    reference_id=f"SALE-{sale.id}",
                    note=f"POS Sale #{sale.invoice_no}"
                )

            Payment.objects.create(
                shop=shop,
                sale=sale,
                amount=paid_amount,
                method=random.choice([Payment.Method.CASH, Payment.Method.CASH, Payment.Method.BKASH, Payment.Method.CARD])
            )
            
            sales_created += 1

    # Re-calc final stock
    for prod in created_products:
        recalc_stock(prod)

    print(f"✅ Generated {sales_created} realistic POS sales with weight-scale & You Saved discounts!")

print("🎉 Super Shop & Grocery Demo Store successfully populated and ready!")
