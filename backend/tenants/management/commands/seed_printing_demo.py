import os
import sys
sys.path.insert(0, '/app')
from decimal import Decimal
from datetime import timedelta
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import transaction
from django.utils import timezone
from django.contrib.auth.hashers import make_password

from tenants.models import Shop, SubscriptionPlan, Branch
from accounts.models import User, RoleType
from catalog.models import Category, Unit, Brand, Product
from inventory.models import StockMovement, MovementType
from inventory.services import recalc_stock
from purchasing.models import Supplier
from crm.models import Customer
from service.models import ServiceJob, ServiceJobMaterial, ServiceJobStatusHistory
from accounting.models import LedgerEntry
from core.tenant_context import set_current_tenant

print("🚀 Starting Printing, Media & Online Services Modern Demo Shop creation...")

with transaction.atomic():
    # 1. Get or Create Subscription Plan
    plan = SubscriptionPlan.objects.filter(tier="enterprise").first() or SubscriptionPlan.objects.first()

    # 2. Create or Update Shop
    shop, created = Shop.objects.update_or_create(
        slug="printing-media-demo",
        defaults={
            "name": "StockWhisk Printing, Media & Online Services",
            "business_type": "printing",
            "is_demo": True,
            "is_test": True,
            "is_active": True,
            "phone": "01711000030",
            "email": "printing@demo.stockwhisk.com",
            "address": "Holding 12, Cyber Point Plaza, Zindabazar, Sylhet",
            "currency": "BDT",
            "barcode_prefix": "SWP",
            "pos_print_mode": "pos",
            "pos_receipt_enabled": True,
            "vat_enabled": False,
            "reports_enabled": True,
            "finance_enabled": True,
            "service_enabled": True,
            "plan": plan,
        }
    )
    print(f"✅ Shop: {shop.name} (ID: {shop.id}, Created: {created})")

    set_current_tenant(shop)

    # 3. Create or Update Branch
    branch, _ = Branch.objects.update_or_create(
        shop=shop,
        code="MAIN",
        defaults={
            "name": "Main Service Counter",
            "phone": "01711000030",
            "address": "Holding 12, Cyber Point Plaza, Zindabazar, Sylhet",
            "is_main": True,
            "is_active": True,
        }
    )

    # 4. Create Owner User
    user, u_created = User.objects.update_or_create(
        email="printing@demo.stockwhisk.com",
        defaults={
            "first_name": "Printing",
            "last_name": "Admin",
            "phone": "01711000030",
            "role": RoleType.OWNER,
            "shop": shop,
            "branch": branch,
            "is_active": True,
            "password": make_password("demo12345"),
        }
    )
    print(f"👤 Demo User: {user.phone} / demo12345 (ID: {user.id})")

    # 5. Seed Units
    units_data = [
        ("Piece", "pcs", Unit.MeasureType.COUNT, False),
        ("Sheet / পাতা", "sheet", Unit.MeasureType.COUNT, False),
        ("Ream / রিম", "ream", Unit.MeasureType.COUNT, False),
        ("Square Feet / স্কয়ার ফিট", "sqft", Unit.MeasureType.LENGTH, True),
        ("Goj / গজ", "গজ", Unit.MeasureType.LENGTH, True),
        ("Meter / মিটার", "মি.", Unit.MeasureType.LENGTH, True),
        ("Packet / প্যাকেট", "pkt", Unit.MeasureType.COUNT, False),
        ("Pouch / পাউচ", "pouch", Unit.MeasureType.COUNT, False),
        ("Roll / রোল", "roll", Unit.MeasureType.COUNT, False),
    ]
    units = {}
    for name, code, m_type, allow_dec in units_data:
        u = Unit.all_objects.filter(shop_id=shop.id, short_code=code).first()
        if not u:
            u = Unit.all_objects.create(
                shop=shop,
                short_code=code,
                name=name,
                measure_type=m_type,
                allow_decimal=allow_dec,
            )
        units[code] = u

    # 6. Seed Categories
    cat_names = [
        ("অনলাইন ও সরকারি সেবা", "online-services"),
        ("ব্যানার ও সাইনবোর্ড প্রিন্ট", "banner-printing"),
        ("ফটোকপি ও ডকুমেন্ট প্রিন্টিং", "photocopy-printing"),
        ("কাঁচামাল ও প্রিন্টিং পেপার", "raw-materials"),
        ("স্টেশনারি ও অফিস সাপ্লাই", "stationery-supplies"),
    ]
    categories = {}
    for c_name, c_slug in cat_names:
        c = Category.all_objects.filter(shop_id=shop.id, name=c_name).first()
        if not c:
            c = Category.all_objects.create(shop=shop, name=c_name, is_active=True)
        categories[c_slug] = c

    # 7. Seed Products / Raw Materials
    products_data = [
        ("Double A A4 80GSM Paper Ream (500 Sheets)", "MAT-A4-01", "893500110001", "raw-materials", "ream", 480.00, 550.00, 50),
        ("PaperOne Legal 80GSM Paper Ream (500 Sheets)", "MAT-LEG-01", "893500110002", "raw-materials", "ream", 520.00, 620.00, 30),
        ("A4 Lamination Pouch 100 Micron (100 Pcs Pkt)", "MAT-LAM-01", "893500110003", "raw-materials", "pkt", 350.00, 500.00, 40),
        ("PVC Flex Banner Roll 10ft x 150ft (1500 sq.ft)", "MAT-BAN-01", "893500110004", "raw-materials", "roll", 7500.00, 10500.00, 10),
        ("Glossy Photo Paper A4 200GSM (50 Pcs Pkt)", "MAT-PHT-01", "893500110005", "raw-materials", "pkt", 220.00, 320.00, 35),
        ("Epson 673 EcoTank Ink Set (6 Colors)", "MAT-INK-01", "893500110006", "raw-materials", "pcs", 4200.00, 5200.00, 12),
        ("ID Card Ribbon + Holder Case", "STA-ID-01", "893500110007", "stationery-supplies", "pcs", 15.00, 30.00, 200),
        ("Spiral Binding Ring Coil 12mm", "STA-BIN-01", "893500110008", "stationery-supplies", "pcs", 8.00, 20.00, 150),
        ("A4 B&W Photocopy (Per Page)", "SRV-PC-BW", "893500110009", "photocopy-printing", "sheet", 1.00, 3.00, 0),
        ("A4 Color Print (Per Page)", "SRV-PRT-COL", "893500110010", "photocopy-printing", "sheet", 3.00, 10.00, 0),
    ]

    products = {}
    for p_name, sku, barcode, cat_slug, u_code, cost, price, stock_qty in products_data:
        p, _ = Product.all_objects.update_or_create(
            shop_id=shop.id,
            sku=sku,
            defaults={
                "name": p_name,
                "barcode": barcode,
                "category": categories[cat_slug],
                "unit": units[u_code],
                "cost_price": Decimal(str(cost)),
                "selling_price": Decimal(str(price)),
                "current_stock": Decimal(str(stock_qty)),
                "is_active": True,
                "track_inventory": stock_qty > 0,
            }
        )
        products[sku] = p

        if stock_qty > 0:
            StockMovement.all_objects.filter(shop_id=shop.id, product=p, movement_type=MovementType.PURCHASE_IN).delete()
            StockMovement.all_objects.create(
                shop=shop,
                product=p,
                movement_type=MovementType.PURCHASE_IN,
                quantity=Decimal(str(stock_qty)),
                unit_cost=Decimal(str(cost)),
                note="Initial stock for Printing Demo Shop",
                created_by=user,
            )
            recalc_stock(p)

    # 8. Customers
    customers_data = [
        ("মো: রফিকুল ইসলাম", "01711223344", "rafiq@gmail.com", "Housing Estate, Sylhet"),
        ("তানজিলা আক্তার", "01812345678", "tanjila@gmail.com", "Subidbazar, Sylhet"),
        ("মেসার্স আল-মদিনা এন্টারপ্রাইজ", "01911998877", "almadina@biz.com", "Zindabazar Commercial Area, Sylhet"),
        ("ইমন আহমেদ", "01611334455", "imon.ahmed@gmail.com", "Shahi Eidgah, Sylhet"),
        ("আব্দুল্লাহ আল নোমান", "01755667788", "noman@gmail.com", "Amberkhana, Sylhet"),
    ]
    customers = {}
    for c_name, c_phone, c_email, c_addr in customers_data:
        cust, _ = Customer.all_objects.update_or_create(
            shop_id=shop.id,
            phone=c_phone,
            defaults={
                "name": c_name,
                "email": c_email,
                "address": c_addr,
            }
        )
        customers[c_phone] = cust

    # 9. Clean up and Seed Realistic Demo Service Jobs
    ServiceJob.all_objects.filter(shop_id=shop.id).delete()

    jobs_data = [
        {
            "job_number": "JOB-2026-0001",
            "customer": customers["01711223344"],
            "customer_name": "মো: রফিকুল ইসলাম",
            "customer_phone": "01711223344",
            "service_type": "ই-পাসপোর্ট আবেদন (১০ বছর / ৪৮ পাতা)",
            "reference_no": "OID-2026-98124",
            "specifications": {"pages": 48, "validity_years": 10, "type": "Regular"},
            "govt_fee": Decimal("5750.00"),
            "service_charge": Decimal("500.00"),
            "finishing_charge": Decimal("0.00"),
            "other_charge": Decimal("0.00"),
            "discount": Decimal("0.00"),
            "total_bill": Decimal("6250.00"),
            "advance_paid": Decimal("6250.00"),
            "due_amount": Decimal("0.00"),
            "material_cost": Decimal("20.00"),
            "status": ServiceJob.Status.READY,
            "delivery_date": timezone.now() + timedelta(days=1),
            "notes": "অনলাইন চালান পরিশোধিত। আবেদন প্রিন্ট কপি রেডি।",
        },
        {
            "job_number": "JOB-2026-0002",
            "customer": customers["01812345678"],
            "customer_name": "তানজিলা আক্তার",
            "customer_phone": "01812345678",
            "service_type": "পুলিশ ক্লিয়ারেন্স সার্টিফিকেট আবেদন",
            "reference_no": "PCC-DH-48921",
            "specifications": {"district": "Sylhet", "thana": "Kotwali"},
            "govt_fee": Decimal("500.00"),
            "service_charge": Decimal("250.00"),
            "finishing_charge": Decimal("0.00"),
            "other_charge": Decimal("0.00"),
            "discount": Decimal("0.00"),
            "total_bill": Decimal("750.00"),
            "advance_paid": Decimal("500.00"),
            "due_amount": Decimal("250.00"),
            "material_cost": Decimal("15.00"),
            "status": ServiceJob.Status.PROCESSING,
            "delivery_date": timezone.now() + timedelta(days=2),
            "notes": "কাউন্সিলর প্রত্যয়ন সংযুক্ত করা হয়েছে।",
        },
        {
            "job_number": "JOB-2026-0003",
            "customer": customers["01911998877"],
            "customer_name": "মেসার্স আল-মদিনা এন্টারপ্রাইজ",
            "customer_phone": "01911998877",
            "service_type": "পিভিসি ব্যানার ও সাইনবোর্ড প্রিন্ট + রিভেট ফিনিশিং",
            "reference_no": "BAN-12x4-001",
            "specifications": {
                "category": "banner",
                "width_ft": 12,
                "height_ft": 4,
                "total_sqft": 48,
                "rate_per_sqft": 25,
                "finishing": {"eyelets": {"enabled": True, "count": 6}, "pipe": {"enabled": True}}
            },
            "artwork_url": "https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&w=1200&q=80",
            "design_approved": True,
            "design_approved_at": timezone.now() - timedelta(hours=5),
            "govt_fee": Decimal("0.00"),
            "service_charge": Decimal("1200.00"),
            "finishing_charge": Decimal("240.00"), # 6 eyelets + 12ft pipe
            "other_charge": Decimal("0.00"),
            "discount": Decimal("0.00"),
            "total_bill": Decimal("1440.00"),
            "advance_paid": Decimal("1440.00"),
            "due_amount": Decimal("0.00"),
            "material_cost": Decimal("350.00"),
            "status": ServiceJob.Status.DELIVERED,
            "delivery_date": timezone.now() - timedelta(hours=4),
            "actual_delivery_date": timezone.now() - timedelta(hours=2),
            "notes": "আইলেট এবং পাইপ ফিটিং সম্পন্ন। কাস্টমার ডেলিভারি নিয়েছে।",
        },
        {
            "job_number": "JOB-2026-0004",
            "customer": customers["01611334455"],
            "customer_name": "ইমন আহমেদ",
            "customer_phone": "01611334455",
            "service_type": "অফসেট প্রেস - ৩ পার্ট ক্যাশ মেমো (১,০০০ সেট)",
            "reference_no": "OFF-MEMO-504",
            "specifications": {
                "category": "offset",
                "plates_count": 2,
                "paper_sheets": 1000,
                "color": "2 Color (Red & Black)",
                "binding": "Serial Numbering & Perforation"
            },
            "artwork_url": "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=1200&q=80",
            "design_approved": False,
            "govt_fee": Decimal("0.00"),
            "service_charge": Decimal("1300.00"), # 2 plates + print
            "finishing_charge": Decimal("250.00"), # numbering + binding
            "other_charge": Decimal("0.00"),
            "discount": Decimal("0.00"),
            "total_bill": Decimal("1550.00"),
            "advance_paid": Decimal("500.00"),
            "due_amount": Decimal("1050.00"),
            "material_cost": Decimal("400.00"),
            "status": ServiceJob.Status.PROCESSING,
            "delivery_date": timezone.now() + timedelta(days=2),
            "notes": "ডিজাইন প্রুফ গ্রাহকের অনুমোদনের অপেক্ষায় আছে।",
        },
        {
            "job_number": "JOB-2026-0005",
            "customer": customers["01755667788"],
            "customer_name": "আব্দুল্লাহ আল নোমান",
            "customer_phone": "01755667788",
            "service_type": "ফটোকপি ও লিগ্যাল ডকুমেন্ট প্রিন্টিং",
            "reference_no": "DOC-CPY-88",
            "specifications": {
                "category": "photocopy",
                "meter_start": 24500,
                "meter_end": 24650,
                "total_copies": 150,
                "sheets_deducted": 150
            },
            "govt_fee": Decimal("0.00"),
            "service_charge": Decimal("375.00"),
            "finishing_charge": Decimal("50.00"), # spiral binding
            "other_charge": Decimal("0.00"),
            "discount": Decimal("0.00"),
            "total_bill": Decimal("425.00"),
            "advance_paid": Decimal("0.00"),
            "due_amount": Decimal("425.00"),
            "material_cost": Decimal("150.00"),
            "status": ServiceJob.Status.READY,
            "delivery_date": timezone.now() + timedelta(hours=2),
            "notes": "১৫০ পাতা ফটোকপি ও স্পাইরাল বাইন্ডিং সম্পন্ন।",
        },
    ]

    for j_data in jobs_data:
        job = ServiceJob.objects.create(
            shop=shop,
            branch=branch,
            created_by=user,
            **j_data
        )

        ServiceJobStatusHistory.objects.create(
            shop=shop,
            job=job,
            from_status="",
            to_status=job.status,
            note=f"Initial demo job created with status {job.status}",
            changed_by=user,
        )

        if job.advance_paid > 0:
            LedgerEntry.objects.create(
                shop=shop,
                account=LedgerEntry.Account.CASH,
                amount=job.advance_paid,
                source_type="ServiceJob",
                source_id=str(job.id),
                description=f"Payment for Demo Job #{job.job_number} ({job.service_type})",
            )

        if job.job_number == "JOB-2026-0003":
            ServiceJobMaterial.objects.create(
                shop=shop,
                job=job,
                product=products["MAT-BAN-01"],
                quantity=Decimal("48.00"),
                unit_cost=Decimal("7.00"),
                subtotal=Decimal("336.00"),
                from_stock=True,
            )

    print(f"📋 Seeded {len(jobs_data)} realistic Modernized Service Jobs!")

print("🎉 Modernized Printing Demo Shop ready!")

from django.core.management.base import BaseCommand
class Command(BaseCommand):
    help = "Seed Printing Demo Shop"
    def handle(self, *args, **options):
        pass
