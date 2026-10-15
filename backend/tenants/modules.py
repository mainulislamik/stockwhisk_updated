"""
Modular Feature Registry & Entitlement Engine.

Centralized definition of all 24 decoupled business modules for shops.
Each module can be independently enabled or disabled per shop or via subscription tiers.
"""

from typing import Any, Dict, List

# Catalog of all 24 system modules
MODULE_CATALOG: List[Dict[str, Any]] = [
    # --- POS & Retail Operations ---
    {
        "key": "core_pos",
        "name_en": "Core POS & Billing",
        "name_bn": "মূল পিওএস ও কুইক বিলিং",
        "category": "pos",
        "icon": "bi-receipt-cutoff",
        "description": "Fast cashier checkout, receipt generation, and cash drawer management.",
        "default_enabled": True,
    },
    {
        "key": "pos_hardware",
        "name_en": "Scale & Hardware Integration",
        "name_bn": "ডিজিটাল ওয়েট স্কেল ও হার্ডওয়্যার",
        "category": "pos",
        "icon": "bi-cpu",
        "description": "Digital barcode weighing scale (PLU decoding), pole display, and thermal printers.",
        "default_enabled": False,
    },
    {
        "key": "scanner_bridge",
        "name_en": "Wireless Phone Scanner",
        "name_bn": "ওয়্যারলেস ফোন স্ক্যানার",
        "category": "pos",
        "icon": "bi-upc-scan",
        "description": "Use smartphone camera as a real-time barcode reader for POS terminals.",
        "default_enabled": True,
    },
    {
        "key": "emi_installments",
        "name_en": "EMI & Installment Sales",
        "name_bn": "কিস্তি ও ইএমআই কালেকশন",
        "category": "pos",
        "icon": "bi-calendar-check",
        "description": "Sell products on monthly installments, calculate down payments, and track dues.",
        "default_enabled": False,
    },

    # --- Inventory & Supply Chain ---
    {
        "key": "inventory_basic",
        "name_en": "Basic Inventory & Catalog",
        "name_bn": "বেসিক ইনভেন্টরি ও প্রোডাক্ট ক্যাটালগ",
        "category": "inventory",
        "icon": "bi-boxes",
        "description": "Products, categories, brands, units, stock alerts, and barcode label printing.",
        "default_enabled": True,
    },
    {
        "key": "inventory_advanced",
        "name_en": "Advanced Batches & Expiry",
        "name_bn": "লট নম্বর, এক্সপায়ারি ও ব্যাচ ট্র্যাকিং",
        "category": "inventory",
        "icon": "bi-calendar-x",
        "description": "Lot numbers, expiry date warnings, product variants (color/size), and multi-UOM.",
        "default_enabled": False,
    },
    {
        "key": "product_pictures",
        "name_en": "Product Pictures & Visual POS",
        "name_bn": "প্রোডাক্ট ছবি ও ভিজ্যুয়াল পিওএস",
        "category": "inventory",
        "icon": "bi-image",
        "description": "Upload high-res product photos with auto WebP compression (<80KB) and visual POS card grid.",
        "default_enabled": True,
    },
    {
        "key": "apparel_catalog",
        "name_en": "Apparel & Clothing Product Suite",
        "name_bn": "পোশাক ও ক্লদিং প্রোডাক্ট স্যুট",
        "category": "inventory",
        "icon": "bi-tags",
        "description": "2D Size × Color variant matrix, garment taxonomy (fabric, fit, season, gender), and clothing hang-tag barcode printing.",
        "default_enabled": False,
    },
    {
        "key": "purchasing",
        "name_en": "Purchasing & Suppliers",
        "name_bn": "সাপ্লায়ার ও পারচেজ অর্ডার",
        "category": "inventory",
        "icon": "bi-truck",
        "description": "Supplier directory, purchase orders, goods receiving, and supplier payment ledger.",
        "default_enabled": True,
    },
    {
        "key": "multi_branch",
        "name_en": "Multi-Branch Management",
        "name_bn": "একাধিক শাখা ও স্টক ট্রান্সফার",
        "category": "inventory",
        "icon": "bi-diagram-3",
        "description": "Manage multiple retail outlets, central warehouse, and inter-branch transfers.",
        "default_enabled": False,
    },

    # --- Sales & Customer Relationship ---
    {
        "key": "sales_crm",
        "name_en": "Sales & Customer CRM",
        "name_bn": "সেলস ও কাস্টমার সিআরএম",
        "category": "crm",
        "icon": "bi-people",
        "description": "Customer profiles, credit ledger, customer dues tracking, and quotations.",
        "default_enabled": True,
    },
    {
        "key": "whatsapp_crm",
        "name_en": "WhatsApp CRM & 1-Tap Invoices",
        "name_bn": "হোয়াটসঅ্যাপ সিআরএম ও ইনভয়েস",
        "category": "crm",
        "icon": "bi-whatsapp",
        "description": "Multi-tenant Baileys QR code pairing and 1-tap direct WhatsApp invoice sending.",
        "default_enabled": True,
    },
    {
        "key": "sms_email_alerts",
        "name_en": "SMS & Email Notifications",
        "name_bn": "এসএমএস ও ইমেইল অ্যালার্ট",
        "category": "crm",
        "icon": "bi-chat-left-dots",
        "description": "Automated purchase SMS to customers and system email dispatch.",
        "default_enabled": False,
    },
    {
        "key": "discounts_loyalty",
        "name_en": "Discounts & Loyalty Points",
        "name_bn": "ডিসকাউন্ট ও লয়ালটি পয়েন্ট",
        "category": "crm",
        "icon": "bi-gift",
        "description": "Promotional coupon codes, loyalty points accumulation, and VIP tier benefits.",
        "default_enabled": False,
    },
    {
        "key": "delivery_tracking",
        "name_en": "Courier & Delivery Tracking",
        "name_bn": "কুরিয়ার ও হোম ডেলিভারি",
        "category": "crm",
        "icon": "bi-geo-alt",
        "description": "Home delivery orders, delivery rider assignment, and courier status tracking.",
        "default_enabled": True,
    },

    # --- Accounting & Finance ---
    {
        "key": "finance_accounting",
        "name_en": "Double-Entry Accounting",
        "name_bn": "ডাবল-এন্ট্রি একাউন্টিং ও লেজার",
        "category": "finance",
        "icon": "bi-journal-bookmark",
        "description": "General ledger, chart of accounts, journal vouchers, and automated trial balance.",
        "default_enabled": False,
    },
    {
        "key": "expense_management",
        "name_en": "Expense & Cash Register",
        "name_bn": "দৈনিক খরচ ও ক্যাশ রেজিস্টার",
        "category": "finance",
        "icon": "bi-wallet2",
        "description": "Shop operating expenses, overhead costs, and daily cash-in-hand monitoring.",
        "default_enabled": True,
    },
    {
        "key": "advanced_analytics",
        "name_en": "Executive Analytics & AI",
        "name_bn": "এক্সিকিউটিভ অ্যানালিটিক্স",
        "category": "finance",
        "icon": "bi-graph-up-arrow",
        "description": "Profit & loss charts, sales forecasts, top selling items, and dead stock analysis.",
        "default_enabled": False,
    },
    {
        "key": "reports_export",
        "name_en": "Reports & Data Export",
        "name_bn": "রিপোর্ট ও ডাটা এক্সপোর্ট",
        "category": "finance",
        "icon": "bi-file-earmark-spreadsheet",
        "description": "Export reports in PDF and Excel formats with financial audits.",
        "default_enabled": True,
    },

    # --- Specialized Industry Addons ---
    {
        "key": "service_repair",
        "name_en": "Service & Warranty Tickets",
        "name_bn": "সার্ভিসিং ও ওয়ারেন্টি টিকিট",
        "category": "addons",
        "icon": "bi-tools",
        "description": "Customer product intake, service job sheets, warranty status, and repairs.",
        "default_enabled": False,
    },
    {
        "key": "mobile_repair_pos",
        "name_en": "Mobile Repair Specialty Suite",
        "name_bn": "মোবাইল রিপেয়ার স্পেশাল স্যুট",
        "category": "addons",
        "icon": "bi-phone",
        "description": "IMEI lookup, device security lock pattern diagram, and brand/model catalogs.",
        "default_enabled": False,
    },
    {
        "key": "apparel_alterations",
        "name_en": "Garment Alteration, Fitting & Laser",
        "name_bn": "পোশাক অল্টারেশন, ফিটিং ও লেজার",
        "category": "addons",
        "icon": "bi-scissors",
        "description": "Garment fitting tickets, tailor job assignments, alteration notes, and SMS/WhatsApp completion alerts.",
        "default_enabled": False,
    },
    {
        "key": "manufacturing",
        "name_en": "Manufacturing & Production",
        "name_bn": "ম্যানুফ্যাকচারিং ও ব্যাচ প্রোডাকশন",
        "category": "addons",
        "icon": "bi-gear-wide-connected",
        "description": "Bill of Materials (BOM), raw material tracking, and production work orders.",
        "default_enabled": False,
    },
    {
        "key": "human_resources",
        "name_en": "HR, Staff & Payroll",
        "name_bn": "এইচআর, স্টাফ ও পে-রোল",
        "category": "addons",
        "icon": "bi-person-badge",
        "description": "Employee profiles, attendance tracking, shift scheduling, and salary calculation.",
        "default_enabled": False,
    },

    # --- Enterprise, Integration & Platform ---
    {
        "key": "public_api",
        "name_en": "Developer API Access",
        "name_bn": "ডেভেলপার এপিআই ও ইন্টিগ্রেশন",
        "category": "enterprise",
        "icon": "bi-code-slash",
        "description": "REST API keys for third-party e-commerce, Shopify, and custom integrations.",
        "default_enabled": False,
    },
    {
        "key": "reseller_hub",
        "name_en": "Reseller & Referral Hub",
        "name_bn": "রিসেলার ও রেফারেল হাব",
        "category": "enterprise",
        "icon": "bi-diagram-2",
        "description": "Manage affiliate resellers, commissions, and revenue share tracking.",
        "default_enabled": False,
    },
    {
        "key": "backup_drive",
        "name_en": "Automated Cloud Backups",
        "name_bn": "স্বয়ংক্রিয় ক্লাউড ব্যাকআপ",
        "category": "enterprise",
        "icon": "bi-cloud-arrow-up",
        "description": "Nightly PostgreSQL and media snapshots to Google Drive or custom S3.",
        "default_enabled": False,
    },
    {
        "key": "integrations",
        "name_en": "E-Commerce & Courier Integrations",
        "name_bn": "ই-কমার্স ও কুরিয়ার ইন্টিগ্রেশন",
        "category": "enterprise",
        "icon": "bi-diagram-3",
        "description": "WooCommerce, Shopify, Steadfast, RedX, Pathao syncing, webhooks, and automated order routing.",
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
        "name": "Electronics & Repair (সার্ভিস ও রিপেয়ার)",
        "description": "Retail billing with device service tickets and mobile repair diagnostics.",
        "modules": [
            "core_pos", "scanner_bridge", "inventory_basic", "purchasing",
            "sales_crm", "whatsapp_crm", "expense_management", "service_repair",
            "mobile_repair_pos", "reports_export", "delivery_tracking"
        ],
    },
    "apparel_fashion": {
        "name": "Apparel & Fashion Boutique (পোশাক ও ফ্যাশন)",
        "description": "Tailored for clothing stores, boutiques, footwear, and fashion accessories with size-color matrix and hang-tags.",
        "modules": [
            "core_pos", "scanner_bridge", "inventory_basic", "product_pictures",
            "apparel_catalog", "apparel_alterations", "purchasing", "sales_crm", "whatsapp_crm",
            "discounts_loyalty", "reports_export", "delivery_tracking"
        ],
    },
    "enterprise": {
        "name": "Full Enterprise Suite (সম্পূর্ণ এন্টারপ্রাইজ)",
        "description": "Every single feature, including manufacturing, HR payroll, integrations, and cloud backup.",
        "modules": ALL_MODULE_KEYS,
    },
    "all": {
        "name": "All 26 Modules (সকল ২৬টি মডিউল)",
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

    # Auto-enable apparel_catalog & apparel_alterations for fashion/clothing/apparel/footwear/handcrafts/jewelry categories
    shop_type = getattr(shop, "business_type", "") or ""
    if shop_type in ["fashion", "apparel", "footwear", "handcrafts", "jewelry"]:
        resolved["apparel_catalog"] = True
        resolved["apparel_alterations"] = True
        resolved["alterations"] = True

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
