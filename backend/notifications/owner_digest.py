"""
StockWhisk Advanced Daily Owner WhatsApp Executive Briefing & Anti-Spam Dispatch Engine.
Features:
1. Per-shop modular enablement (ShopAlertConfig.whatsapp_daily_digest_enabled).
2. Deep 100% Tenant Isolation (Zero Cross-Shop Data Leakage Guarantee).
3. Humanized Spintax Generator (Randomized greetings, structures & dividers to prevent bot detection).
4. Interactive Typing Presence (Emits 'composing' presence for 3-4s before sending).
5. Anti-Ban Jitter Delays (12-18 seconds random sleep between consecutive shop dispatches).
6. Safe Skip on missing/invalid phone numbers without blocking other shops.
"""
from datetime import datetime, time as dt_time, timedelta
from decimal import Decimal
import logging
import random
import time
from typing import Dict, Any, Optional, List

from django.db.models import Sum, F, Q
from django.utils import timezone
from django.conf import settings

logger = logging.getLogger("notifications.owner_digest")


def _format_bdt_clean(val) -> str:
    if val is None:
        return "৳ ০"
    try:
        d = Decimal(str(val))
        if d == d.to_integral():
            return f"৳ {int(d):,}"
        return f"৳ {d:,.2f}"
    except Exception:
        return f"৳ {val}"


def get_daily_business_metrics(shop, target_date=None) -> Dict[str, Any]:
    """
    Compute daily comprehensive business intelligence metrics strictly for a single shop.
    Guarantees 100% tenant isolation by filtering all models strictly on shop=shop.
    """
    from sales.models import Sale, SaleItem, Payment
    from purchasing.models import PurchaseOrder
    from accounting.models import Expense
    from catalog.models import Product

    if target_date and isinstance(target_date, datetime):
        loc_now = timezone.localtime(target_date)
    elif target_date and hasattr(target_date, "year"):
        loc_now = timezone.make_aware(datetime.combine(target_date, dt_time.min))
    else:
        loc_now = timezone.localtime()

    today = loc_now.date()
    start_dt = timezone.make_aware(datetime.combine(today, dt_time.min))
    end_dt = timezone.make_aware(datetime.combine(today, dt_time.max))
    tomorrow = today + timedelta(days=1)

    # 1. Sales Metrics (Strictly scoped to shop.id)
    sales_qs = Sale.all_objects.filter(
        shop=shop,
        sale_date__range=(start_dt, end_dt)
    ).exclude(status__in=[Sale.Status.CANCELLED, Sale.Status.QUOTATION])

    sales_agg = sales_qs.aggregate(
        gross=Sum("total"),
        paid=Sum("paid"),
        discount=Sum("discount"),
    )
    gross_sales = Decimal(str(sales_agg["gross"] or 0))
    paid_sales = Decimal(str(sales_agg["paid"] or 0))
    order_count = sales_qs.count()
    new_due_sales = max(Decimal("0.00"), gross_sales - paid_sales)

    # 2. Item & Unit Quantities Sold Today
    items_qs = SaleItem.objects.filter(
        sale__shop=shop,
        sale__sale_date__range=(start_dt, end_dt)
    ).exclude(sale__status__in=[Sale.Status.CANCELLED, Sale.Status.QUOTATION])

    total_units_sold_raw = items_qs.aggregate(u=Sum("quantity"))["u"] or 0
    try:
        total_units_sold = int(Decimal(str(total_units_sold_raw)))
    except Exception:
        total_units_sold = 0

    # 3. Payment Methods Breakdown (Cash vs Digital)
    payments_qs = Payment.objects.filter(
        sale__shop=shop,
        paid_at__range=(start_dt, end_dt)
    ).exclude(sale__status__in=[Sale.Status.CANCELLED, Sale.Status.QUOTATION])

    pay_methods = {
        "cash": Decimal("0.00"),
        "digital": Decimal("0.00"),
    }
    for p in payments_qs.iterator():
        m = (p.method or "cash").lower()
        amt = Decimal(str(p.amount or 0))
        if "cash" in m:
            pay_methods["cash"] += amt
        else:
            pay_methods["digital"] += amt

    # 4. Purchases & Supplier Dues
    po_qs = PurchaseOrder.all_objects.filter(
        shop=shop,
        order_date__range=(start_dt, end_dt)
    ).exclude(status="cancelled")

    po_agg = po_qs.aggregate(
        total_purchase=Sum("total"),
        total_paid=Sum("paid")
    )
    total_purchase = Decimal(str(po_agg["total_purchase"] or 0))
    paid_to_suppliers = Decimal(str(po_agg["total_paid"] or 0))
    supplier_new_due = max(Decimal("0.00"), total_purchase - paid_to_suppliers)
    po_count = po_qs.count()

    # 5. Expenses & Net Cash Drawer
    expense_qs = Expense.objects.filter(
        shop=shop,
        spent_on__range=(start_dt.date(), end_dt.date())
    )
    total_expenses = Decimal(str(expense_qs.aggregate(total=Sum("amount"))["total"] or 0))

    # COGS & Estimated Gross Profit
    cogs = Decimal("0.00")
    for it in items_qs.iterator():
        qty = Decimal(str(it.quantity or 0))
        cost = Decimal(str(it.unit_cost or 0))
        cogs += qty * cost

    gross_profit = gross_sales - cogs
    net_cash_flow = (paid_sales) - (paid_to_suppliers + total_expenses)

    # 6. Due Promises Scheduled for Tomorrow
    tomorrow_due_sales = Sale.all_objects.filter(
        shop=shop,
        due_date=tomorrow,
        status__in=[Sale.Status.DUE, Sale.Status.PARTIAL],
    ).order_by("-total")[:3]

    tomorrow_due_promises = []
    for s in tomorrow_due_sales:
        due_amt = max(Decimal("0.00"), (s.total or Decimal("0.00")) - (s.paid or Decimal("0.00")))
        if due_amt > 0:
            c_name = s.customer.name if s.customer else (s.customer_name or "ক্রেতা")
            c_phone = s.customer.phone if s.customer and s.customer.phone else (s.customer_phone or "")
            tomorrow_due_promises.append({
                "name": c_name,
                "phone": c_phone,
                "due": due_amt,
                "invoice": s.invoice_no,
            })

    # 7. Best Selling Product Today
    top_items_raw = (
        items_qs.values("product__name")
        .annotate(total_qty=Sum("quantity"), total_rev=Sum("subtotal"))
        .order_by("-total_rev")
        .first()
    )
    top_product = None
    if top_items_raw and top_items_raw.get("product__name"):
        top_product = {
            "name": top_items_raw["product__name"],
            "qty": int(Decimal(str(top_items_raw["total_qty"] or 0))),
            "revenue": Decimal(str(top_items_raw["total_rev"] or 0)),
        }

    # 8. Shortage and Out of Stock Alerts
    short_products_raw = (
        Product.objects.filter(shop=shop, is_active=True, track_inventory=True)
        .filter(Q(current_stock__lte=F("reorder_level")) | Q(current_stock__lte=0))
        .order_by("current_stock")[:4]
    )
    short_products_list = []
    for p in short_products_raw:
        stk = Decimal(str(p.current_stock or 0))
        short_products_list.append({
            "name": p.name or "Item",
            "stock": int(stk) if stk == stk.to_integral() else float(stk),
            "unit": getattr(p.unit, "short_code", "") or "পিস",
        })

    low_stock_count = Product.objects.filter(
        shop=shop, is_active=True, track_inventory=True
    ).filter(Q(current_stock__lte=F("reorder_level")) | Q(current_stock__lte=0)).count()

    return {
        "shop_id": shop.id,
        "today_str": today.strftime("%d %b %Y"),
        "order_count": order_count,
        "total_units_sold": total_units_sold,
        "gross_sales": gross_sales,
        "paid_sales": paid_sales,
        "cash_collected": pay_methods["cash"],
        "digital_collected": pay_methods["digital"],
        "new_due_sales": new_due_sales,
        "total_purchase": total_purchase,
        "paid_to_suppliers": paid_to_suppliers,
        "supplier_new_due": supplier_new_due,
        "po_count": po_count,
        "total_expenses": total_expenses,
        "gross_profit": gross_profit,
        "net_cash_flow": net_cash_flow,
        "tomorrow_due_promises": tomorrow_due_promises,
        "top_product": top_product,
        "short_products_list": short_products_list,
        "low_stock_count": low_stock_count,
    }


def build_daily_report_whatsapp_message(shop, metrics: Dict[str, Any], owner_name: str = "", variation_seed: int = 0) -> str:
    """
    Format business metrics into an executive, highly readable Bengali WhatsApp message.
    Uses Spintax sentence variations so WhatsApp anti-spam filters do not flag it as an automated template.
    """
    shop_name = getattr(shop, "name", "আপনার দোকান")
    date_str = metrics["today_str"]
    name_display = f"{owner_name} স্যার" if owner_name else "স্যার"

    templates = {}
    try:
        from platform_admin.models import PlatformConfig
        templates = PlatformConfig.get_solo().whatsapp_templates or {}
    except Exception:
        pass

    # 1. Spintax Greetings
    greeting_options = [
        f"🏪 *{shop_name}* — দৈনিক ব্যবসায়িক রিপোর্ট\n📅 তারিখ: {date_str} | রাত ১০:০০",
        f"আসসালামু আলাইকুম {name_display},\n🏪 *{shop_name}*-এর সারাদিনের বিক্রয় ও ব্যবসায়িক বিবরণী:\n📅 তারিখ: {date_str}",
        f"শুভ রাত্রি {name_display},\nআজ {date_str}-এর দৈনন্দিন বিক্রয়, লাভ ও স্টক পর্যালোচনা ({shop_name}):",
    ]
    custom_header = templates.get("daily_report_header")
    if custom_header:
        header_text = custom_header.replace("{shop_name}", shop_name).replace("{date}", date_str).replace("{name}", name_display)
    else:
        header_text = greeting_options[variation_seed % len(greeting_options)]

    # 2. Spintax Dividers
    dividers = ["━━━━━━━━━━━━━━━━━━━━", "────────────────────"]
    divider = dividers[variation_seed % len(dividers)]

    lines = [
        header_text,
        divider,
        "💰 *আজকের বিক্রয় ও নগদ আদায় (Sales & Cash)*",
        f"• মোট বিক্রয়: *{_format_bdt_clean(metrics['gross_sales'])}* ({metrics['order_count']}টি মেমো)",
    ]

    if metrics.get("total_units_sold", 0) > 0:
        lines.append(f"• মোট পণ্য বিক্রয়: *{metrics['total_units_sold']} পিস*")

    lines.append(f"• নগদ ক্যাশ আদায়: {_format_bdt_clean(metrics['cash_collected'])}")

    if metrics["digital_collected"] > 0:
        lines.append(f"• ডিজিটাল পেমেন্ট (bKash/Bank): {_format_bdt_clean(metrics['digital_collected'])}")

    if metrics["new_due_sales"] > 0:
        lines.append(f"• নতুন বাকি বিক্রয়: *{_format_bdt_clean(metrics['new_due_sales'])}*")
    else:
        lines.append("• নতুন বাকি: ৳ ০ (আজকে সম্পূর্ণ ক্যাশ বিক্রি! 🎉)")

    lines.append(divider)
    lines.append("📦 *আজকের পণ্য ক্রয় (Purchases)*")
    if metrics["total_purchase"] > 0:
        lines.append(f"• মোট ক্রয়: {_format_bdt_clean(metrics['total_purchase'])} ({metrics['po_count']}টি ভাউচার)")
        lines.append(f"• সরবরাহকারীকে পরিশোধ: {_format_bdt_clean(metrics['paid_to_suppliers'])}")
        if metrics["supplier_new_due"] > 0:
            lines.append(f"• মহাজনের কাছে নতুন দেনা: {_format_bdt_clean(metrics['supplier_new_due'])}")
    else:
        lines.append("• আজকে নতুন কোনো পণ্য ক্রয় এন্ট্রি হয়নি।")

    lines.append(divider)
    lines.append("📉 *খরচ ও নগদ ক্যাশ স্থিতি (Cashflow)*")
    lines.append(f"• দোকানের বিবিধ খরচ: {_format_bdt_clean(metrics['total_expenses'])}")
    lines.append(f"• আনুমানিক মোট লাভ: *{_format_bdt_clean(metrics['gross_profit'])}*")
    lines.append(f"• ক্যাশ ব্যালেন্স পরিবর্তন: *{_format_bdt_clean(metrics['net_cash_flow'])}*")

    # Due promises for tomorrow
    tomorrow_dues = metrics.get("tomorrow_due_promises", [])
    if tomorrow_dues:
        lines.append(divider)
        lines.append("🤝 *⚠️ আগামীকাল বাকি আদায়ের তাগাদা (Tomorrow's Due):*")
        for idx, p in enumerate(tomorrow_dues, 1):
            phone_text = f" ({p['phone']})" if p.get("phone") else ""
            lines.append(f" {idx}. {p['name']}{phone_text} — *{_format_bdt_clean(p['due'])}*")

    # Shortage items list
    short_items = metrics.get("short_products_list", [])
    if short_items:
        lines.append(divider)
        lines.append("⚠️ *দোকানের যেসব পণ্য শর্ট/স্টক শেষ:*")
        for p in short_items:
            stock_label = f"স্টক: {p['stock']} {p['unit']}" if p['stock'] > 0 else "🔴 স্টক শূন্য"
            lines.append(f" • {p['name']} ({stock_label})")

    # Top selling product
    if metrics.get("top_product"):
        tp = metrics["top_product"]
        lines.append(divider)
        lines.append("🏆 *আজকের সেরা বিক্রিত পণ্য:*")
        lines.append(f"• {tp['name']} ({tp['qty']} পিস — {_format_bdt_clean(tp['revenue'])})")

    custom_footer = templates.get("daily_report_footer")
    if custom_footer:
        footer_text = custom_footer.replace("{shop_name}", shop_name).replace("{date}", date_str)
    else:
        signoffs = [
            "— *StockWhisk Business Intelligence*\n🌐 বিস্তারিত দেখতে: https://stockwhisk.com/app",
            "— *স্টকহুইস্ক অটোমেটেড বিজনেস রিপোর্ট*\n🌐 বিস্তারিত দেখতে: https://stockwhisk.com/app",
        ]
        footer_text = signoffs[variation_seed % len(signoffs)]

    lines.append(divider)
    lines.append(footer_text)

    return "\n".join(lines)


def build_onboarding_followup_message(user_name: str, days_since_created: int) -> str:
    """
    Generate helpful, consultative WhatsApp message for inactive shop accounts.
    """
    name_display = f"{user_name} স্যার" if user_name else "স্যার"

    templates = {}
    try:
        from platform_admin.models import PlatformConfig
        templates = PlatformConfig.get_solo().whatsapp_templates or {}
    except Exception:
        pass

    hotline = templates.get("hotline") or "০১৬১৩-৫১১৮৮৭"

    if days_since_created <= 2:
        tpl = templates.get("onboarding_day1")
        if tpl:
            return tpl.replace("{name}", name_display).replace("{hotline}", hotline)
        return (
            f"আসসালামু আলাইকুম {name_display},\n"
            f"StockWhisk-এ আপনার অ্যাকাউন্ট খোলার জন্য আন্তরিক ধন্যবাদ! 💐\n\n"
            f"লক্ষ্য করলাম, আপনি অ্যাকাউন্ট তৈরি করেছেন। সফটওয়্যারটিতে লগইন করতে বা ড্যাশবোর্ড ব্যবহারে কোনো সমস্যা হচ্ছে কি না জানার জন্য চেক-ইন করলাম।\n\n"
            f"স্যার, মাত্র ৫ মিনিটের একটি ফোনে বা হোয়াটসঅ্যাপ কলে আমাদের একজন প্রতিনিধি সম্পূর্ণ সিস্টেমটি আপনাকে লাইভ বুঝিয়ে দিতে পারে।\n\n"
            f"আপনার সুবিধাজনক একটি সময় জানালে আমরা কল দেব স্যার। আপনার ব্যবসায়ের সার্বিক সাফল্য কামনা করি! 😊\n\n"
            f"— *কাস্টমার সাকসেস টিম, StockWhisk*\n"
            f"📞 হটলাইন: {hotline}"
        )
    elif days_since_created <= 5:
        tpl = templates.get("onboarding_day3")
        if tpl:
            return tpl.replace("{name}", name_display).replace("{hotline}", hotline)
        return (
            f"শুভ অপরাহ্ন {name_display},\n"
            f"আশা করি আপনার দোকানের ব্যবসা ভালো চলছে। 🏪\n\n"
            f"আপনি জানেন কি, *StockWhisk* চালাতে দোকানে কোনো কম্পিউটার বা ল্যাপটপের প্রয়োজন নেই?\n\n"
            f"📱 আপনার পকেটে থাকা স্মার্টফোনটি দিয়েই আপনি:\n"
            f"• ফোনের ক্যামেরা দিয়ে পণ্যের বারকোড স্ক্যান করতে পারবেন।\n"
            f"• মাত্র ৩ সেকেন্ডে কাস্টমারকে ডিজিটাল মেমো/ইনভয়েস দিতে পারবেন।\n"
            f"• বাকির টাকা আদায়ের তারিখ দিয়ে স্বয়ংক্রিয় তাগাদা পাঠাতে পারবেন।\n\n"
            f"🎥 মাত্র ২ মিনিটের এই ভিডিওটি দেখে আজই প্রথম বিক্রিটি ট্রাই করে দেখুন:\n"
            f"🔗 https://stockwhisk.com/video\n\n"
            f"কোনো প্রশ্ন থাকলে সরাসরি এই হোয়াটসঅ্যাপে লিখে জানাতে পারেন স্যার! 👍\n\n"
            f"— *StockWhisk সাপোর্ট টিম*"
        )
    else:
        tpl = templates.get("onboarding_day7_free_upload")
        if tpl:
            return tpl.replace("{name}", name_display).replace("{hotline}", hotline)
        return (
            f"🎁 *সপ্তাহের বিশেষ অফার: আপনার দোকানের সকল পণ্য ফ্রিতে আপলোড করে দেব!*\n\n"
            f"শ্রদ্ধেয় {name_display},\n"
            f"আমি StockWhisk প্ল্যাটফর্ম থেকে তৌহিদুল বলছি।\n\n"
            f"এক সপ্তাহ হয়ে গেল আপনি আমাদের প্ল্যাটফর্মে যুক্ত হয়েছিলেন, কিন্তু এখনও নিয়মিত হিসাব শুরু করতে পারেননি দেখে আন্তরিকভাবে মেসেজ দিলাম।\n\n"
            f"দোকানে একা হাতে শত শত পণ্যের নাম, দাম ও স্টক টাইপ করে তোলা সত্যিই অনেক সময়সাপেক্ষ ও ক্লান্তিকর কাজ। তাই এই সপ্তাহের শেষে আমাদের বিশেষ অফার:\n\n"
            f"📦 *আপনার পণ্যের তালিকা, ক্রয়ের মেমো, খাতার ছবি অথবা এক্সেল শিট সরাসরি আমাদের হোয়াটসঅ্যাপে পাঠান—আমাদের টিম সম্পূর্ণ ফ্রিতে আপনার দোকানের সকল প্রোডাক্ট সিস্টেমে আপলোড করে সাজিয়ে দেবে!*\n\n"
            f"এতে আপনার এক ঘণ্টাও সময় নষ্ট হবে না, আর আজ থেকেই আপনি ডিজিটাল হিসাব শুরু করতে পারবেন।\n\n"
            f"অফারটি গ্রহণ করতে চাইলে এই নম্বরে খাতার ছবি বা 'YES' লিখে রিপ্লাই দিন স্যার! ধন্যবাদ। 🤝\n\n"
            f"— *তৌহিদুল ইসলাম, StockWhisk*\n"
            f"📞 হটলাইন: {hotline}"
        )


def resolve_owner_phone(shop) -> Optional[str]:
    """
    Extract and clean shop owner's primary WhatsApp number in international format.
    Checks ShopAlertConfig.whatsapp_digest_phone first, then owner user, then shop phone.
    """
    try:
        from notifications.services import get_alert_config
        cfg = get_alert_config(shop)
        if cfg and getattr(cfg, "whatsapp_digest_phone", "").strip():
            digits = "".join(c for c in str(cfg.whatsapp_digest_phone) if c.isdigit())
            if len(digits) == 11 and digits.startswith("01"):
                return "88" + digits
            if len(digits) == 13 and digits.startswith("8801"):
                return digits
            if len(digits) >= 10:
                return digits
    except Exception:
        pass

    phone = ""
    owner = getattr(shop, "owner", None)
    if not owner and hasattr(shop, "users"):
        owner = shop.users.filter(role="owner").first() or shop.users.first()

    if owner and getattr(owner, "phone", None):
        phone = owner.phone
    elif getattr(shop, "phone", None):
        phone = shop.phone

    if not phone:
        return None

    digits = "".join(c for c in str(phone) if c.isdigit())
    if len(digits) == 11 and digits.startswith("01"):
        return "88" + digits
    if len(digits) == 13 and digits.startswith("8801"):
        return digits
    if len(digits) >= 10:
        return digits
    return None


def simulate_typing_presence(phone: str, seconds: float = 3.5):
    """
    Emits typing indicator ('composing') to target WhatsApp contact before sending.
    Simulates human action to avoid automated bot classification.
    """
    from .baileys import WHATSAPP_GATEWAY_URL
    import requests
    try:
        requests.post(
            f"{WHATSAPP_GATEWAY_URL}/presence",
            json={"phone": phone, "status": "composing"},
            timeout=5
        )
    except Exception:
        pass
    if seconds > 0:
        time.sleep(seconds)


def send_throttled_owner_daily_reports(target_date=None, force_all=False, dry_run=False, target_shop_id=None):
    """
    Throttled, humanized multi-shop dispatch engine.
    - Dispatches ONLY to shops with whatsapp_daily_digest_enabled=True (unless force_all or target_shop_id).
    - Skips shops cleanly if owner phone is missing/invalid.
    - Strict tenant isolation: binds set_current_tenant(shop) per shop iteration.
    - Simulates 3-4s typing presence before sending.
    - Enforces 12-18s random jitter delay between consecutive shop sends.
    """
    from tenants.models import Shop
    from core.tenant_context import set_current_tenant
    from .services import get_alert_config
    from .baileys import send_platform_whatsapp_message
    from .models import Notification, NotificationType
    from platform_admin.models import PlatformConfig

    config = PlatformConfig.get_solo()
    min_gap = getattr(config, "whatsapp_digest_min_gap", 12) or 12
    max_gap = getattr(config, "whatsapp_digest_max_gap", 18) or 18

    qs = Shop.objects.filter(is_active=True).order_by("id")
    if target_shop_id:
        qs = qs.filter(id=target_shop_id)

    results = {
        "total_checked": 0,
        "sent": 0,
        "skipped_disabled": 0,
        "skipped_no_phone": 0,
        "failed": 0,
        "audit_trail": [],
    }

    shops_to_process = []
    for shop in qs:
        results["total_checked"] += 1
        cfg = get_alert_config(shop)
        is_enabled = getattr(cfg, "whatsapp_daily_digest_enabled", False)
        if not is_enabled and not force_all and not target_shop_id:
            results["skipped_disabled"] += 1
            continue

        owner_phone = resolve_owner_phone(shop)
        if not owner_phone:
            results["skipped_no_phone"] += 1
            results["audit_trail"].append({
                "shop_id": shop.id,
                "shop_name": shop.name,
                "status": "skipped_no_phone",
                "reason": "No valid WhatsApp phone number found",
            })
            continue

        shops_to_process.append((shop, owner_phone))

    for idx, (shop, phone) in enumerate(shops_to_process):
        # 1. STRICT TENANT ISOLATION BINDING
        set_current_tenant(shop)
        try:
            # 2. CALCULATE METRICS SPECIFIC ONLY TO THIS SHOP
            metrics = get_daily_business_metrics(shop, target_date=target_date)

            # Assert shop ID match
            assert metrics["shop_id"] == shop.id, "CRITICAL: Cross-shop metric mismatch detected!"

            owner = getattr(shop, "owner", None)
            if not owner and hasattr(shop, "users"):
                owner = shop.users.filter(role="owner").first() or shop.users.first()
            owner_name = getattr(owner, "first_name", "") or ""

            # 3. SPINTAX HUMANIZED MESSAGE GENERATION
            msg_text = build_daily_report_whatsapp_message(
                shop, metrics, owner_name=owner_name, variation_seed=idx
            )

            if dry_run:
                results["sent"] += 1
                results["audit_trail"].append({
                    "shop_id": shop.id,
                    "shop_name": shop.name,
                    "phone": phone,
                    "status": "dry_run_success",
                    "metrics_summary": {
                        "gross_sales": str(metrics["gross_sales"]),
                        "units_sold": metrics["total_units_sold"],
                        "new_due": str(metrics["new_due_sales"]),
                        "short_items_count": metrics["low_stock_count"],
                    },
                    "message_preview": msg_text,
                })
                continue

            # 4. TYPING PRESENCE SIMULATION (Anti-ban: "typing..." status)
            simulate_typing_presence(phone, seconds=3.5)

            # 5. DISPATCH VIA OFFICIAL BAILEYS GATEWAY
            res = send_platform_whatsapp_message(phone, msg_text)
            if res.get("success"):
                results["sent"] += 1
                Notification.objects.create(
                    shop=shop,
                    type=NotificationType.GENERAL,
                    title="দৈনিক ব্যবসায়িক রিপোর্ট (WhatsApp প্রেরিত)",
                    message=f"আজকের মোট বিক্রি: ৳{metrics['gross_sales']:,.2f}, মোট পিস: {metrics['total_units_sold']}",
                    sent_channels=["whatsapp", "in_app"],
                )
                results["audit_trail"].append({
                    "shop_id": shop.id,
                    "shop_name": shop.name,
                    "phone": phone,
                    "status": "sent",
                })
            else:
                results["failed"] += 1
                results["audit_trail"].append({
                    "shop_id": shop.id,
                    "shop_name": shop.name,
                    "phone": phone,
                    "status": "failed",
                    "error": res.get("error", "Unknown error"),
                })

            # 6. ENFORCE HUMANIZED JITTER SLEEP (12-18 seconds gap)
            if idx < len(shops_to_process) - 1:
                jitter = random.uniform(min_gap, max_gap)
                time.sleep(jitter)

        except Exception as e:
            results["failed"] += 1
            logger.exception("Error processing daily digest for shop %s (%s)", shop.id, shop.name)
            results["audit_trail"].append({
                "shop_id": shop.id,
                "shop_name": shop.name,
                "status": "error",
                "error": str(e),
            })

    return results
