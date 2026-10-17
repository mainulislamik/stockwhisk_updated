"""
Modular Feature Registry & Entitlement Engine.

Centralized definition of all 24 decoupled business modules for shops.
Each module can be independently enabled or disabled per shop or via subscription tiers.
"""

from typing import Any, Dict, List

# Business vertical categories
MODULE_CATEGORIES: List[Dict[str, Any]] = [
    {
        "id": "all",
        "name_en": "All Modules",
        "name_bn": "সকল মডিউল",
        "icon": "bi-grid-fill",
        "badge_color": "secondary",
        "description": "View all 28 modules across all business verticals.",
    },
    {
        "id": "fashion",
        "name_en": "Fashion & Apparel",
        "name_bn": "ফ্যাশন ও পোশাক শপ",
        "icon": "bi-bag-check-fill",
        "badge_color": "danger",
        "description": "Garment size-color variant matrix, tailor alterations & fitting tickets, measurement size guides, and apparel tags.",
    },
    {
        "id": "online_shop",
        "name_en": "Online Shop & E-Commerce",
        "name_bn": "অনলাইন শপ ও ই-কমার্স",
        "icon": "bi-globe2",
        "badge_color": "info",
        "description": "Courier delivery tracking (Steadfast, Pathao, RedX), website integrations (WooCommerce, Shopify), and public APIs.",
    },
    {
        "id": "electronics",
        "name_en": "Electronics & Gadget Shop",
        "name_bn": "ইলেকট্রনিক্স ও গ্যাজেট শপ",
        "icon": "bi-cpu-fill",
        "badge_color": "warning",
        "description": "Service & repair tickets, warranty claims, mobile device intake with IMEI & pattern locks, and installment EMI sales.",
    },
    {
        "id": "universal",
        "name_en": "Universal / Core Retail",
        "name_bn": "সার্বজনীন / কোর রিটেইল",
        "icon": "bi-shop",
        "badge_color": "primary",
        "description": "Foundational POS, inventory, purchasing, accounting, CRM, and day-to-day operations suitable for any retail business.",
    },
    {
        "id": "manufacturing",
        "name_en": "Manufacturing & Production",
        "name_bn": "উৎপাদন ও প্রক্রিয়াজাতকরণ",
        "icon": "bi-gear-wide-connected",
        "badge_color": "secondary",
        "description": "Bill of materials (BOM), raw material consumption tracking, and finished goods assembly production.",
    },
]

# Catalog of all 28 system modules
MODULE_CATALOG: List[Dict[str, Any]] = [
    # --- Universal / Core Retail Operations ---
    {
        "key": "core_pos",
        "name_en": "Core POS & Billing",
        "name_bn": "মূল পিওএস ও কুইক বিলিং",
        "category": "universal",
        "icon": "bi-receipt-cutoff",
        "description": "Fast cashier checkout, receipt generation, and cash drawer management.",
        "default_enabled": True,
    },
    {
        "key": "pos_hardware",
        "name_en": "Scale & Hardware Integration",
        "name_bn": "ডিজিটাল ওয়েট স্কেল ও হার্ডওয়্যার",
        "category": "universal",
        "icon": "bi-hdd-network",
        "description": "Electronic scale barcode decoding (EAN-13 weights) and thermal printer integration.",
        "default_enabled": False,
    },
    {
        "key": "scanner_bridge",
        "name_en": "Wireless Scanner Bridge",
        "name_bn": "ওয়্যারলেস ফোন স্ক্যানার",
        "category": "universal",
        "icon": "bi-qr-code-scan",
        "description": "Use any smartphone camera as a wireless continuous barcode scanner for POS.",
        "default_enabled": True,
    },
    # --- Electronics & Gadget Shop ---
    {
        "key": "emi_installments",
        "name_en": "Installment & EMI Sales",
        "name_bn": "কিস্তি ও ইএমআই বিক্রয়",
        "category": "electronics",
        "icon": "bi-calendar2-week",
        "description": "Flexible monthly installments, down-payment ledger, guarantor records, and overdue alerts for gadgets and electronics.",
        "default_enabled": False,
    },
    # --- Universal / Core Inventory & Purchasing ---
    {
        "key": "inventory_basic",
        "name_en": "Basic Inventory Management",
        "name_bn": "মৌলিক ইনভেন্টরি ট্র্যাকিং",
        "category": "universal",
        "icon": "bi-box-seam",
        "description": "Stock levels, low-stock warnings, SKUs, and single-location product catalog.",
        "default_enabled": True,
    },
    {
        "key": "inventory_advanced",
        "name_en": "Advanced Batches & Expiry",
        "name_bn": "অ্যাডভান্সড ইনভেন্টরি ও ব্যাচ-মেয়াদ",
        "category": "universal",
        "icon": "bi-boxes",
        "description": "Lot numbers, expiry date alerts, and multiple unit of measure conversions.",
        "default_enabled": False,
    },
    {
        "key": "product_pictures",
        "name_en": "Product Pictures & Visual POS",
        "name_bn": "পণ্য ছবি ও ভিজ্যুয়াল ক্যাটালগ",
        "category": "universal",
        "icon": "bi-image",
        "description": "Multi-image product gallery with zoom and photo grid on POS register.",
        "default_enabled": True,
    },
    # --- Fashion & Apparel Shop ---
    {
        "key": "apparel_catalog",
        "name_en": "Fashion & Apparel Matrix",
        "name_bn": "পোশাক ক্যাটালগ ও ভ্যারিয়েন্ট ম্যাট্রিক্স",
        "category": "fashion",
        "icon": "bi-tag",
        "description": "Size x Color variant matrix, garment hang-tags, barcode label sheets, and measurement size charts.",
        "default_enabled": False,
    },
    {
        "key": "apparel_alterations",
        "name_en": "Garment Alterations & Fitting",
        "name_bn": "পোশাক অলটারেশন ও ফিটিং টিকেট",
        "category": "fashion",
        "icon": "bi-scissors",
        "description": "Customer tailoring Kanban workflow, fitting docket slips, measurement notes, and tailor assignment.",
        "default_enabled": False,
    },
    # --- Universal / Core Operations ---
    {
        "key": "purchasing",
        "name_en": "Purchasing & Supplier Orders",
        "name_bn": "ক্রয় ও সরবরাহকারী অর্ডার",
        "category": "universal",
        "icon": "bi-cart-check",
        "description": "Purchase orders, goods received notes (GRN), and supplier debt ledgers.",
        "default_enabled": True,
    },
    {
        "key": "multi_branch",
        "name_en": "Multi-Branch & Warehouses",
        "name_bn": "একাধিক ব্রাঞ্চ ও সেন্ট্রাল ওয়্যারহাউজ",
        "category": "universal",
        "icon": "bi-buildings",
        "description": "Inter-branch stock transfers, separate warehouse registers, and centralized reports.",
        "default_enabled": False,
    },
    # --- Universal / CRM & Customer Retention ---
    {
        "key": "sales_crm",
        "name_en": "Customer CRM & Due Ledger",
        "name_bn": "গ্রাহক সম্পর্ক ও বাকি খতিয়ান",
        "category": "universal",
        "icon": "bi-people",
        "description": "Customer purchase profiles, credit/due limits, and payment receipt history.",
        "default_enabled": True,
    },
    {
        "key": "whatsapp_crm",
        "name_en": "WhatsApp Automated Invoicing",
        "name_bn": "হোয়াটসঅ্যাপ অটোমেটেড ইনভয়েস",
        "category": "universal",
        "icon": "bi-whatsapp",
        "description": "Send PDF receipts, payment reminders, and order confirmations via WhatsApp.",
        "default_enabled": True,
    },
    {
        "key": "sms_email_alerts",
        "name_en": "SMS & Email Notifications",
        "name_bn": "এসএমএস ও ইমেইল অ্যালার্ট",
        "category": "universal",
        "icon": "bi-chat-dots",
        "description": "Branded SMS gateway integration for OTPs, due collection reminders, and marketing.",
        "default_enabled": False,
    },
    {
        "key": "discounts_loyalty",
        "name_en": "Loyalty Points & Coupons",
        "name_bn": "লয়ালটি পয়েন্ট ও প্রোমো কোড",
        "category": "universal",
        "icon": "bi-award",
        "description": "Customer reward points cashback, tiered VIP customer groups, and coupon discounts.",
        "default_enabled": False,
    },
    # --- Online Shop & E-Commerce ---
    {
        "key": "delivery_tracking",
        "name_en": "Courier Delivery & Tracking",
        "name_bn": "কুরিয়ার ডেলিভারি ও পার্সেল ট্র্যাকিং",
        "category": "online_shop",
        "icon": "bi-truck",
        "description": "Parcel dispatch, courier API integration (Steadfast, Pathao, RedX), and cash-on-delivery reconciliation.",
        "default_enabled": True,
    },
    {
        "key": "integrations",
        "name_en": "E-Commerce & Website Integrations",
        "name_bn": "ই-কমার্স ও ওয়েবসাইট ইন্টিগ্রেশন",
        "category": "online_shop",
        "icon": "bi-diagram-3",
        "description": "WooCommerce, Shopify, Steadfast, RedX, Pathao syncing, webhooks, and automated order routing.",
        "default_enabled": False,
    },
    {
        "key": "public_api",
        "name_en": "Developer API Access",
        "name_bn": "ডেভেলপার এপিআই ও হেডলেস শপ",
        "category": "online_shop",
        "icon": "bi-code-slash",
        "description": "Secure REST API bearer keys for custom websites, headless storefronts, and mobile apps.",
        "default_enabled": False,
    },
    # --- Universal / Finance, Expenses & Accounting ---
    {
        "key": "finance_accounting",
        "name_en": "Double-Entry Accounting & Ledger",
        "name_bn": "ডাবল-এন্ট্রি একাউন্টিং ও লেজার",
        "category": "universal",
        "icon": "bi-journal-bookmark",
        "description": "General ledger, chart of accounts, balance sheets, and profit & loss statements.",
        "default_enabled": False,
    },
    {
        "key": "expense_management",
        "name_en": "Expense & Petty Cash",
        "name_bn": "দৈনিক খরচ ও ক্যাশ রেজিস্টার",
        "category": "universal",
        "icon": "bi-wallet2",
        "description": "Track rent, electricity, tea, staff snacks, and calculate net daily profit.",
        "default_enabled": True,
    },
    {
        "key": "advanced_analytics",
        "name_en": "Executive BI & Analytics",
        "name_bn": "এক্সিকিউটিভ বিআই ও অ্যানালিটিক্স",
        "category": "universal",
        "icon": "bi-graph-up-arrow",
        "description": "Sales heatmaps, top-moving items, profit margin trends, and AI forecasting.",
        "default_enabled": False,
    },
    {
        "key": "reports_export",
        "name_en": "Excel & PDF Financial Reports",
        "name_bn": "রিপোর্ট ও ডাটা এক্সপোর্ট",
        "category": "universal",
        "icon": "bi-file-earmark-spreadsheet",
        "description": "One-click export of sales, tax (VAT), inventory valuation, and customer ledgers.",
        "default_enabled": True,
    },
    # --- Electronics & Gadget Shop Repairs ---
    {
        "key": "service_repair",
        "name_en": "Device Repair & Warranty",
        "name_bn": "সার্ভিসিং ও ওয়ারেন্টি টিকিট",
        "category": "electronics",
        "icon": "bi-tools",
        "description": "Customer device intake, repair status job sheets, technician assignment, and warranty tracking.",
        "default_enabled": False,
    },
    {
        "key": "mobile_repair_pos",
        "name_en": "Mobile & Gadget Repair Lab",
        "name_bn": "মোবাইল ও গ্যাজেট ল্যাব (IMEI)",
        "category": "electronics",
        "icon": "bi-phone",
        "description": "IMEI lookup, pattern lock screen diagrams, fault diagnostic intake, and device scratches condition.",
        "default_enabled": False,
    },
    # --- Manufacturing & Production ---
    {
        "key": "manufacturing",
        "name_en": "Manufacturing & Production",
        "name_bn": "ম্যানুফ্যাকচারিং ও ব্যাচ প্রোডাকশন",
        "category": "manufacturing",
        "icon": "bi-gear-wide-connected",
        "description": "Bill of Materials (BOM), raw material tracking, and production work orders.",
        "default_enabled": False,
    },
    # --- Universal / Enterprise & Administration ---
    {
        "key": "human_resources",
        "name_en": "HR, Staff & Payroll",
        "name_bn": "এইচআর, স্টাফ ও পে-রোল",
        "category": "universal",
        "icon": "bi-person-badge",
        "description": "Employee directory, daily attendance, advance salary tracking, and payroll pay-slips.",
        "default_enabled": False,
    },
    {
        "key": "reseller_hub",
        "name_en": "Reseller & Referral Hub",
        "name_bn": "রিসেলার ও রেফারেল হাব",
        "category": "universal",
        "icon": "bi-diagram-2",
        "description": "Manage affiliate resellers, sales referral codes, and revenue commission splits.",
        "default_enabled": False,
    },
    {
        "key": "backup_drive",
        "name_en": "Automated Cloud Backups",
        "name_bn": "স্বয়ংক্রিয় ক্লাউড ব্যাকআপ",
        "category": "universal",
        "icon": "bi-cloud-arrow-up",
        "description": "Nightly encrypted database and media snapshots backed up to Google Drive or AWS S3.",
        "default_enabled": False,
    },
]

# Mapping dictionary for O(1) lookup
MODULE_DICT: Dict[str, Dict[str, Any]] = {m["key"]: m for m in MODULE_CATALOG}
ALL_MODULE_KEYS: List[str] = [m["key"] for m in MODULE_CATALOG]

# Preset Packages for quick assignment
PRESET_PACKAGES: Dict[str, Dict[str, Any]] = {
    "starter": {
        "name": "Starter Retailer (প্রারম্ভিক খুচরা)",
        "description": "Essential POS, basic inventory, sales and WhatsApp CRM for small retail shops.",
        "modules": [
            "core_pos", "scanner_bridge", "inventory_basic", "product_pictures", "sales_crm",
            "whatsapp_crm", "expense_management", "reports_export", "delivery_tracking"
        ],
    },
    "retailer": {
        "name": "Standard Store (স্ট্যান্ডার্ড শপ)",
        "description": "Complete retail management with purchasing, basic accounting, and discounts.",
        "modules": [
            "core_pos", "scanner_bridge", "inventory_basic", "inventory_advanced", "product_pictures",
            "purchasing", "sales_crm", "whatsapp_crm", "sms_email_alerts",
            "expense_management", "discounts_loyalty", "delivery_tracking", "reports_export"
        ],
    },
    "supershop": {
        "name": "Super Shop & Grocery (সুপার শপ)",
        "description": "Scale hardware barcode decoding, multi-branch, and advanced inventory tracking.",
        "modules": [
            "core_pos", "pos_hardware", "scanner_bridge", "inventory_basic",
            "inventory_advanced", "product_pictures", "purchasing", "sales_crm", "whatsapp_crm",
            "sms_email_alerts", "expense_management", "discounts_loyalty",
            "delivery_tracking", "multi_branch", "finance_accounting",
            "advanced_analytics", "reports_export"
        ],
    },
    "repair_specialty": {
        "name": "Electronics & Repair Lab (ইলেকট্রনিক্স ও গ্যাজেট শপ)",
        "description": "Retail billing with device service tickets, mobile repair diagnostics, IMEI tracking, and EMI installments.",
        "modules": [
            "core_pos", "scanner_bridge", "inventory_basic", "purchasing",
            "sales_crm", "emi_installments", "service_repair", "mobile_repair_pos",
            "whatsapp_crm", "expense_management", "reports_export"
        ],
    },
    "apparel_fashion": {
        "name": "Fashion & Apparel Boutique (পোশাক ও ফ্যাশন)",
        "description": "Tailored for clothing stores, boutiques, footwear, and fashion accessories with size-color matrix, tailoring alterations, and hang-tags.",
        "modules": [
            "core_pos", "scanner_bridge", "inventory_basic", "product_pictures",
            "apparel_catalog", "apparel_alterations", "purchasing", "sales_crm", "whatsapp_crm",
            "discounts_loyalty", "reports_export", "delivery_tracking"
        ],
    },
    "online_store": {
        "name": "Online Shop & Courier (অনলাইন শপ ও কুরিয়ার)",
        "description": "Courier parcel delivery tracking, WooCommerce/Shopify sync, product catalog, and WhatsApp receipts.",
        "modules": [
            "core_pos", "scanner_bridge", "inventory_basic", "product_pictures",
            "purchasing", "sales_crm", "delivery_tracking", "integrations",
            "public_api", "whatsapp_crm", "sms_email_alerts", "reports_export"
        ],
    },
    "manufacturing_preset": {
        "name": "Manufacturing & Production (উৎপাদন ও প্রক্রিয়া)",
        "description": "Bill of Materials (BOM), raw material tracking, production batches, and finished goods assembly.",
        "modules": [
            "core_pos", "inventory_basic", "inventory_advanced", "purchasing",
            "sales_crm", "manufacturing", "expense_management", "finance_accounting", "reports_export"
        ],
    },
    "enterprise": {
        "name": "Full Enterprise Suite (সকল ২৮টি মডিউল)",
        "description": "Every single feature, including manufacturing, HR payroll, integrations, and cloud backup.",
        "modules": ALL_MODULE_KEYS,
    },
    "all": {
        "name": "All 28 Modules (সকল ২৮টি মডিউল সক্রিয়)",
        "description": "Unlock every single capability across retail, manufacturing, repair, accounts, and integrations.",
        "modules": ALL_MODULE_KEYS,
    },
    "minimal": {
        "name": "Core POS Minimal (কেবল পিওএস)",
        "description": "Bare-bones retail counter POS only. No purchasing, accounting, manufacturing, or addons.",
        "modules": ["core_pos", "inventory_basic", "sales_crm"],
    },
}


def get_default_modules() -> Dict[str, bool]:
    """Return default dictionary with initial active modules."""
    return {m["key"]: m["default_enabled"] for m in MODULE_CATALOG}


def get_shop_modules(shop) -> Dict[str, bool]:
    """
    Calculate the resolved 24-module map for a given shop.
    Merges:
    1. Base defaults
    2. Plan features (if assigned)
    3. Direct shop-level overrides stored in `shop.modules` (JSONField)
    4. Backward-compatible mapping for legacy boolean columns
    """
    if not shop:
        return get_default_modules()

    # Start with base defaults
    resolved: Dict[str, bool] = get_default_modules()

    # Apply Plan features if available
    plan = getattr(shop, "plan", None)
    if plan and getattr(plan, "features", None):
        plan_features = plan.features or {}
        # Legacy plan feature keys mapping
        if "pos" in plan_features:
            resolved["core_pos"] = bool(plan_features.get("pos"))
        if "basic_analytics" in plan_features or "advanced_analytics" in plan_features:
            resolved["advanced_analytics"] = bool(plan_features.get("advanced_analytics", plan_features.get("basic_analytics")))
        if "reports_export" in plan_features:
            resolved["reports_export"] = bool(plan_features.get("reports_export"))
        if "multi_branch" in plan_features:
            resolved["multi_branch"] = bool(plan_features.get("multi_branch"))
        if "api_access" in plan_features:
            resolved["public_api"] = bool(plan_features.get("api_access"))

    # Apply backward-compatible legacy boolean attributes on Shop
    if hasattr(shop, "manufacturing_enabled"):
        resolved["manufacturing"] = bool(shop.manufacturing_enabled)
    if hasattr(shop, "mobile_repair_master_enabled"):
        resolved["mobile_repair_pos"] = bool(shop.mobile_repair_master_enabled)
    if hasattr(shop, "service_enabled"):
        resolved["service_repair"] = bool(shop.service_enabled)
    if hasattr(shop, "finance_enabled"):
        resolved["finance_accounting"] = bool(shop.finance_enabled)
    if hasattr(shop, "reports_enabled"):
        resolved["reports_export"] = bool(shop.reports_enabled)
    if hasattr(shop, "emi_enabled"):
        resolved["emi_installments"] = bool(shop.emi_enabled)
    if hasattr(shop, "delivery_enabled"):
        resolved["delivery_tracking"] = bool(shop.delivery_enabled)
    if hasattr(shop, "whatsapp_invoice_enabled"):
        resolved["whatsapp_crm"] = bool(shop.whatsapp_invoice_enabled)

    # Auto-enable category-specific modules by business_type
    shop_type = (getattr(shop, "business_type", "") or "").lower()
    if shop_type in ["fashion", "apparel", "footwear", "clothing", "handcrafts", "jewelry"]:
        resolved["apparel_catalog"] = True
        resolved["apparel_alterations"] = True
        resolved["alterations"] = True
    elif shop_type in ["electronics", "computer", "mobile", "gadget"]:
        resolved["service_repair"] = True
        resolved["mobile_repair_pos"] = True
        resolved["emi_installments"] = True
    elif shop_type in ["online", "ecommerce", "storefront", "online_shop"]:
        resolved["delivery_tracking"] = True
        resolved["integrations"] = True
        resolved["public_api"] = True

    # Apply specific shop-level overrides stored in shop.modules JSON
    stored_overrides = getattr(shop, "modules", None)
    if isinstance(stored_overrides, dict):
        for k, v in stored_overrides.items():
            if k in resolved:
                resolved[k] = bool(v)

    return resolved


def is_module_enabled(shop, module_key: str) -> bool:
    """Return True if the specified module is enabled for the shop."""
    if not shop:
        return False
    if not getattr(shop, "is_active", True):
        return False
    modules = get_shop_modules(shop)
    return bool(modules.get(module_key, False))
