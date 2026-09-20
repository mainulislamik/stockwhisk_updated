"""
StockWhisk Automated Business Health & Digest Reports.
Generates Daily, Weekly, and Monthly PDF and HTML digests for shop owners,
delivering via noreply@stockwhisk.com with ReportLab PDFs.
"""
import io
import logging
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.conf import settings
from django.db.models import Sum, F, Count, Q
from django.utils import timezone

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

logger = logging.getLogger(__name__)

# Register Bengali font if available, fallback to Helvetica
_FONT_REGISTERED = False
_PRIMARY_FONT = "Helvetica"
_BOLD_FONT = "Helvetica-Bold"

def _ensure_font():
    global _FONT_REGISTERED, _PRIMARY_FONT, _BOLD_FONT
    if _FONT_REGISTERED:
        return
    import os
    font_paths = [
        "/app/reports/fonts/NotoSansBengali-Regular.ttf",
        "/root/stockwhisk/stockwhisk_updated/backend/reports/fonts/NotoSansBengali-Regular.ttf",
        os.path.join(os.path.dirname(__file__), "fonts", "NotoSansBengali-Regular.ttf"),
    ]
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                pdfmetrics.registerFont(TTFont("NotoBengali", fp))
                _PRIMARY_FONT = "NotoBengali"
                _BOLD_FONT = "NotoBengali"
                _FONT_REGISTERED = True
                return
            except Exception as e:
                logger.warning("Could not register Bengali font %s: %s", fp, e)
    _FONT_REGISTERED = True

def _fmt_curr(val):
    if val is None:
        return "৳ 0.00"
    try:
        d = Decimal(str(val))
        return f"৳ {d:,.2f}"
    except Exception:
        return f"৳ {val}"

def _fmt_curr_plain(val):
    if val is None:
        return "0.00"
    try:
        d = Decimal(str(val))
        return f"{d:,.2f}"
    except Exception:
        return str(val)

def get_shop_digest_data(shop, frequency="daily", target_date=None):
    """
    Aggregate all business health metrics for a shop over the specified frequency.
    """
    from sales.models import Sale, SaleItem, Payment
    from accounting.models import Expense
    # from catalog.models import Product
    from catalog.models import Product

    loc_now = timezone.localtime(target_date) if target_date else timezone.localtime()
    today = loc_now.date()

    if frequency == "daily":
        start_dt = timezone.make_aware(datetime.combine(today, time.min))
        end_dt = timezone.make_aware(datetime.combine(today, time.max))
        period_title = f"Daily Report ({today.strftime('%d %b %Y')})"
        period_label_bn = f"দৈনিক সমাপনী প্রতিবেদন — {today.strftime('%d %B %Y')}"
    elif frequency == "weekly":
        week_start = today - timedelta(days=7)
        start_dt = timezone.make_aware(datetime.combine(week_start, time.min))
        end_dt = timezone.make_aware(datetime.combine(today, time.max))
        period_title = f"Weekly Report ({week_start.strftime('%d %b')} - {today.strftime('%d %b %Y')})"
        period_label_bn = f"সাপ্তাহিক ব্যবসায়িক বিবরণী ({week_start.strftime('%d %b')} – {today.strftime('%d %b %Y')})"
    elif frequency == "monthly":
        month_start = today.replace(day=1)
        start_dt = timezone.make_aware(datetime.combine(month_start, time.min))
        end_dt = timezone.make_aware(datetime.combine(today, time.max))
        period_title = f"Monthly Statement ({month_start.strftime('%d %b')} - {today.strftime('%d %b %Y')})"
        period_label_bn = f"মাসিক পূর্ণাঙ্গ আর্থিক বিবরণী ({month_start.strftime('%B %Y')})"
    else:
        start_dt = timezone.make_aware(datetime.combine(today, time.min))
        end_dt = timezone.make_aware(datetime.combine(today, time.max))
        period_title = f"Report ({today.strftime('%d %b %Y')})"
        period_label_bn = f"ব্যবসায়িক বিবরণী ({today.strftime('%d %b %Y')})"

    # 1. Sales & Orders
    sales_qs = Sale.all_objects.filter(shop=shop, sale_date__range=(start_dt, end_dt)).exclude(status__in=[Sale.Status.CANCELLED, Sale.Status.QUOTATION])
    total_orders = sales_qs.count()
    sales_agg = sales_qs.aggregate(
        gross=Sum("total"),
        paid=Sum("paid"),
        discount=Sum("discount"),
    )
    gross_sales = Decimal(str(sales_agg["gross"] or 0))
    paid_sales = Decimal(str(sales_agg["paid"] or 0))
    discount_total = Decimal(str(sales_agg["discount"] or 0))
    new_dues = max(Decimal("0.00"), gross_sales - paid_sales)
    avg_order_val = (gross_sales / total_orders) if total_orders > 0 else Decimal("0.00")

    # 2. Cost of Goods Sold & Profit
    items_qs = SaleItem.objects.filter(sale__shop=shop, sale__sale_date__range=(start_dt, end_dt)).exclude(sale__status__in=[Sale.Status.CANCELLED, Sale.Status.QUOTATION])
    cogs = Decimal("0.00")
    for it in items_qs.iterator():
        qty = Decimal(str(it.quantity or 0))
        cost = Decimal(str(it.unit_cost or 0))
        cogs += qty * cost

    gross_profit = gross_sales - cogs
    gross_margin = (gross_profit / gross_sales * 100) if gross_sales > 0 else Decimal("0.00")

    # 3. Operational Expenses
    expense_qs = Expense.objects.filter(
        shop=shop,
        spent_on__range=(start_dt.date(), end_dt.date()),
    )
    total_expenses = Decimal(str(expense_qs.aggregate(total=Sum("amount"))["total"] or 0))
    net_profit = gross_profit - total_expenses

    # 4. Payment Breakdowns
    payments = Payment.objects.filter(
        sale__shop=shop,
        paid_at__range=(start_dt, end_dt),
    )
    pay_methods = {"cash": Decimal("0.00"), "bkash": Decimal("0.00"), "nagad": Decimal("0.00"), "bank": Decimal("0.00"), "card": Decimal("0.00"), "other": Decimal("0.00")}
    for p in payments.iterator():
        m = (p.method or "cash").lower()
        amt = Decimal(str(p.amount or 0))
        if "cash" in m:
            pay_methods["cash"] += amt
        elif "bkash" in m:
            pay_methods["bkash"] += amt
        elif "nagad" in m:
            pay_methods["nagad"] += amt
        elif "bank" in m:
            pay_methods["bank"] += amt
        elif "card" in m:
            pay_methods["card"] += amt
        else:
            pay_methods["other"] += amt

    # 5. Top Selling Products
    top_items_raw = (
        items_qs.values("product__id", "product__name", "product__sku")
        .annotate(
            total_qty=Sum("quantity"),
            total_rev=Sum("subtotal"),
        )
        .order_by("-total_rev")[:7]
    )
    top_products = []
    for t in top_items_raw:
        top_products.append({
            "name": t["product__name"] or "Item",
            "sku": t["product__sku"] or "—",
            "qty": Decimal(str(t["total_qty"] or 0)),
            "revenue": Decimal(str(t["total_rev"] or 0)),
        })

    # 6. Low Stock & Out of Stock Alerts
    low_stocks_raw = (
        Product.objects.filter(shop=shop, is_active=True)
        .filter(Q(current_stock__lte=F("reorder_level")) | Q(current_stock__lte=0))
        .order_by("current_stock")[:8]
    )
    low_stocks = []
    for p in low_stocks_raw:
        low_stocks.append({
            "name": p.name or "Item",
            "sku": p.sku or "—",
            "current": Decimal(str(p.current_stock or 0)),
            "reorder": Decimal(str(p.reorder_level or 0)),
            "status": "Out of Stock" if (p.current_stock or 0) <= 0 else "Low Stock",
        })

    # 7. Service / Printing Jobs (if shop has service module)
    try:
        from service.models import ServiceJob
        service_qs = ServiceJob.all_objects.filter(
            shop=shop,
            created_at__range=(start_dt, end_dt),
        )
        service_job_count = service_qs.count()
        service_revenue = Decimal(str(service_qs.aggregate(s=Sum("service_charge"))["s"] or 0))
    except Exception:
        service_job_count = 0
        service_revenue = Decimal("0.00")

    # Overall Health Verdict
    if gross_sales > 0 and net_profit > 0:
        health_status = "Profitable & Healthy"
        health_color = "#059669"
    elif gross_sales > 0:
        health_status = "Moderate Performance"
        health_color = "#d97706"
    else:
        health_status = "No Sales Activity Recorded"
        health_color = "#64748b"

    return {
        "shop_id": shop.id,
        "shop_name": shop.name,
        "shop_phone": shop.phone or "—",
        "shop_email": shop.email or "—",
        "shop_address": shop.address or "—",
        "frequency": frequency,
        "period_title": period_title,
        "period_label_bn": period_label_bn,
        "start_dt": start_dt,
        "end_dt": end_dt,
        "total_orders": total_orders,
        "gross_sales": gross_sales,
        "paid_sales": paid_sales,
        "discount_total": discount_total,
        "new_dues": new_dues,
        "avg_order_val": avg_order_val,
        "cogs": cogs,
        "gross_profit": gross_profit,
        "gross_margin": gross_margin,
        "total_expenses": total_expenses,
        "net_profit": net_profit,
        "pay_methods": pay_methods,
        "top_products": top_products,
        "low_stocks": low_stocks,
        "service_job_count": service_job_count,
        "service_revenue": service_revenue,
        "health_status": health_status,
        "health_color": health_color,
    }


def build_digest_pdf(shop, data):
    """
    Generate an executive PDF business health digest using ReportLab.
    """
    _ensure_font()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=28,
        rightMargin=28,
        topMargin=26,
        bottomMargin=26,
        title=f"StockWhisk {data['period_title']} - {shop.name}",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "HeaderTitle",
        parent=styles["Normal"],
        fontName=_BOLD_FONT,
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0f172a"),
    )
    subtitle_style = ParagraphStyle(
        "HeaderSubtitle",
        parent=styles["Normal"],
        fontName=_PRIMARY_FONT,
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#475569"),
    )
    section_title = ParagraphStyle(
        "SectionTitle",
        parent=styles["Normal"],
        fontName=_BOLD_FONT,
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#1e293b"),
    )
    cell_bold = ParagraphStyle(
        "CellBold",
        parent=styles["Normal"],
        fontName=_BOLD_FONT,
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#0f172a"),
    )
    cell_normal = ParagraphStyle(
        "CellNormal",
        parent=styles["Normal"],
        fontName=_PRIMARY_FONT,
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#334155"),
    )
    kpi_num_style = ParagraphStyle(
        "KpiNum",
        parent=styles["Normal"],
        fontName=_BOLD_FONT,
        fontSize=14,
        leading=18,
        alignment=1, # Center
        textColor=colors.HexColor("#0f172a"),
    )
    kpi_lbl_style = ParagraphStyle(
        "KpiLbl",
        parent=styles["Normal"],
        fontName=_PRIMARY_FONT,
        fontSize=8,
        leading=10,
        alignment=1, # Center
        textColor=colors.HexColor("#64748b"),
    )

    story = []

    # 1. Header Block with Brand Navy Accent
    header_data = [
        [
            Paragraph(f"<b>STOCKWHISK CLOUD ERP</b><br/><font size=14 color='#0f172a'><b>{shop.name}</b></font>", title_style),
            Paragraph(
                f"<b>{data['period_title']}</b><br/>"
                f"<font size=8 color='#64748b'>Generated: {timezone.localtime().strftime('%d %b %Y, %I:%M %p')}<br/>"
                f"Status: <font color='{data['health_color']}'><b>{data['health_status']}</b></font></font>",
                subtitle_style
            )
        ]
    ]
    t_header = Table(header_data, colWidths=[340, 200])
    t_header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(t_header)
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#2563eb"), spaceAfter=10))

    # 2. Executive KPI Cards (Row 1: Gross Sales, Net Profit, Cash In Hand, New Due)
    kpi_card_data = [
        [
            Paragraph(f"<font color='#2563eb'><b>{_fmt_curr(data['gross_sales'])}</b></font>", kpi_num_style),
            Paragraph(f"<font color='#059669'><b>{_fmt_curr(data['net_profit'])}</b></font>", kpi_num_style),
            Paragraph(f"<font color='#0284c7'><b>{_fmt_curr(data['pay_methods']['cash'])}</b></font>", kpi_num_style),
            Paragraph(f"<font color='#dc2626'><b>{_fmt_curr(data['new_dues'])}</b></font>", kpi_num_style),
        ],
        [
            Paragraph("TOTAL SALES (মোট বিক্রি)", kpi_lbl_style),
            Paragraph(f"NET PROFIT (নিট লাভ {data['gross_margin']:.1f}%)", kpi_lbl_style),
            Paragraph("CASH COLLECTED (ক্যাশ আদায়)", kpi_lbl_style),
            Paragraph("NEW DUES (নতুন বকেয়া)", kpi_lbl_style),
        ]
    ]
    t_kpis = Table(kpi_card_data, colWidths=[135, 135, 135, 135])
    t_kpis.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, 0), 8),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 8),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    story.append(t_kpis)
    story.append(Spacer(1, 14))

    # 3. Detailed Financial & Accounting Breakdown
    story.append(Paragraph("<b>1. আর্থিক ও বিক্রয় বিবরণী (Financial Performance)</b>", section_title))
    story.append(Spacer(1, 4))
    fin_table_data = [
        [Paragraph("মেট্রিক বিবরণ (Metric Description)", cell_bold), Paragraph("পরিমাণ / হিসাব (Amount / Stat)", cell_bold)],
        [Paragraph("মোট চালান / অর্ডার সংখ্যা (Total Invoices)", cell_normal), Paragraph(str(data["total_orders"]), cell_normal)],
        [Paragraph("মোট বিক্রয় মূল্য (Gross Invoiced Sales)", cell_normal), Paragraph(_fmt_curr(data["gross_sales"]), cell_normal)],
        [Paragraph("বিক্রয় ছাড় / ডিসকাউন্ট (Special Discounts Given)", cell_normal), Paragraph(_fmt_curr(data["discount_total"]), cell_normal)],
        [Paragraph("বিক্রিত পণ্যের ক্রয়মূল্য (Cost of Goods Sold - COGS)", cell_normal), Paragraph(_fmt_curr(data["cogs"]), cell_normal)],
        [Paragraph("মোট প্রফিট / গ্রস লাভ (Gross Profit)", cell_bold), Paragraph(f"<b>{_fmt_curr(data['gross_profit'])}</b> ({data['gross_margin']:.1f}%)", cell_bold)],
        [Paragraph("দোকানের মোট খরচ (Operating Expenses)", cell_normal), Paragraph(_fmt_curr(data["total_expenses"]), cell_normal)],
        [Paragraph("প্রকৃত নিট মুনাফা (Net Business Profit)", cell_bold), Paragraph(f"<font color='#059669'><b>{_fmt_curr(data['net_profit'])}</b></font>", cell_bold)],
    ]
    t_fin = Table(fin_table_data, colWidths=[360, 180])
    t_fin.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(t_fin)
    story.append(Spacer(1, 14))

    # 4. Top Selling Products Table
    story.append(Paragraph("<b>2. শীর্ষ বিক্রিত পণ্যসমূহ (Top Performing Products)</b>", section_title))
    story.append(Spacer(1, 4))
    if data["top_products"]:
        prod_table_data = [
            [
                Paragraph("#", cell_bold),
                Paragraph("পণ্যের নাম (Product)", cell_bold),
                Paragraph("বারকোড / SKU", cell_bold),
                Paragraph("বিক্রয় (Qty)", cell_bold),
                Paragraph("মোট সেলস (Revenue)", cell_bold),
            ]
        ]
        for idx, p in enumerate(data["top_products"], 1):
            prod_table_data.append([
                Paragraph(str(idx), cell_normal),
                Paragraph(p["name"][:45], cell_normal),
                Paragraph(p["sku"], cell_normal),
                Paragraph(f"{p['qty']:,.2f}", cell_normal),
                Paragraph(_fmt_curr(p["revenue"]), cell_normal),
            ])
        t_prod = Table(prod_table_data, colWidths=[25, 275, 90, 70, 80])
        t_prod.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(t_prod)
    else:
        story.append(Paragraph("<i>এই সময়সীমায় কোনো পণ্য বিক্রির রেকর্ড পাওয়া যায়নি।</i>", cell_normal))
    story.append(Spacer(1, 14))

    # 5. Inventory Watchlist & Low Stock Alerts
    story.append(Paragraph("<b>3. ইনভেন্টরি সতর্কতা ও কম স্টক পণ্য (Critical Stock Watchlist)</b>", section_title))
    story.append(Spacer(1, 4))
    if data["low_stocks"]:
        stock_table_data = [
            [
                Paragraph("পণ্যের নাম (Product Name)", cell_bold),
                Paragraph("SKU", cell_bold),
                Paragraph("বর্তমান স্টক (Current)", cell_bold),
                Paragraph("রিঅর্ডার পয়েন্ট (Alert)", cell_bold),
                Paragraph("স্ট্যাটাস (Status)", cell_bold),
            ]
        ]
        for itm in data["low_stocks"]:
            is_out = itm["status"] == "Out of Stock"
            status_html = f"<font color='{'#dc2626' if is_out else '#d97706'}'><b>{itm['status']}</b></font>"
            stock_table_data.append([
                Paragraph(itm["name"][:45], cell_normal),
                Paragraph(itm["sku"], cell_normal),
                Paragraph(f"<b>{itm['current']:,.2f}</b>", cell_normal),
                Paragraph(f"{itm['reorder']:,.2f}", cell_normal),
                Paragraph(status_html, cell_normal),
            ])
        t_stock = Table(stock_table_data, colWidths=[240, 90, 70, 70, 70])
        t_stock.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#334155")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fff7ed")]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#fed7aa")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(t_stock)
    else:
        story.append(Paragraph("<i>সব পণ্যের স্টক পর্যাপ্ত রয়েছে। কোনো সংকট পাওয়া যায়নি।</i>", cell_normal))
    story.append(Spacer(1, 14))

    # 6. Service / Online Digital Jobs (if applicable)
    if data["service_job_count"] > 0:
        story.append(Paragraph("<b>4. ডিজিটাল ও প্রিন্টিং সেবা সারাংশ (Media & Service Jobs)</b>", section_title))
        story.append(Spacer(1, 4))
        srv_data = [
            [Paragraph("মোট সার্ভিস অর্ডার", cell_normal), Paragraph(str(data["service_job_count"]), cell_normal)],
            [Paragraph("সার্ভিস বাবদ মোট আয়", cell_bold), Paragraph(_fmt_curr(data["service_revenue"]), cell_bold)],
        ]
        t_srv = Table(srv_data, colWidths=[360, 180])
        t_srv.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(t_srv)
        story.append(Spacer(1, 12))

    # 7. Professional Footer Notice
    story.append(KeepTogether([
        HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#94a3b8"), spaceAfter=6),
        Paragraph(
            "<font size=7.5 color='#64748b'>এই স্বয়ংক্রিয় ব্যবসায়িক প্রতিবেদনটি স্টকহুইস্ক ক্লাউড ইআরপি (StockWhisk Cloud ERP) "
            "দ্বারা সংরক্ষিত হিসাব থেকে প্রস্তুত করা হয়েছে। লাইভ ইনভেন্টরি বা রিপোর্ট যাচাই করতে ভিজিট করুন: "
            "<b>https://stockwhisk.com</b> | হেল্পলাইন: 01613-511887 | ইমেইল: support@stockwhisk.com</font>",
            subtitle_style,
        )
    ]))

    doc.build(story)
    buf.seek(0)
    return buf.getvalue()


def build_digest_email(shop, data):
    """
    Generate email subject, plain text body, and responsive modern HTML body.
    """
    freq_title = data["frequency"].title()
    subject = f"📊 [StockWhisk] {shop.name} - {data['period_label_bn']}"

    # Plain text summary
    text_body = f"""
{shop.name} - {data['period_title']}
--------------------------------------------------
মোট বিক্রি (Total Sales): {_fmt_curr(data['gross_sales'])}
প্রকৃত লাভ (Net Profit): {_fmt_curr(data['net_profit'])}
ক্যাশ আদায় (Cash Collected): {_fmt_curr(data['pay_methods']['cash'])}
নতুন বাকি (New Dues): {_fmt_curr(data['new_dues'])}
মোট অর্ডার: {data['total_orders']}

শীর্ষ বিক্রিত পণ্য:
"""
    for idx, p in enumerate(data["top_products"][:3], 1):
        text_body += f"{idx}. {p['name']} ({p['qty']} qty) - {_fmt_curr(p['revenue'])}\n"

    text_body += f"""
বিস্তারিত দেখতে সাথে সংযুক্ত অফিসিয়াল পিডিএফ রিপোর্টটি (PDF) ডাউনলোড করুন।
StockWhisk Cloud ERP - https://stockwhisk.com
"""

    # Modern responsive HTML body
    top_prods_html = ""
    for idx, p in enumerate(data["top_products"][:4], 1):
        top_prods_html += f"""
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 12px; font-size: 13px; color: #1e293b;"><b>{idx}. {p['name']}</b><br/><span style="font-size: 11px; color: #64748b;">SKU: {p['sku']}</span></td>
            <td style="padding: 8px 12px; font-size: 13px; color: #1e293b; text-align: center;">{p['qty']:,.1f}</td>
            <td style="padding: 8px 12px; font-size: 13px; color: #0f172a; text-align: right; font-weight: bold;">{_fmt_curr(p['revenue'])}</td>
        </tr>
        """
    if not top_prods_html:
        top_prods_html = "<tr><td colspan='3' style='padding: 12px; text-align: center; color: #64748b; font-size: 12px;'>কোনো পণ্য বিক্রির তথ্য নেই</td></tr>"

    low_stock_banner = ""
    if data["low_stocks"]:
        low_stock_banner = f"""
        <div style="background: #fff7ed; border-left: 4px solid #f97316; padding: 12px 16px; margin: 20px 0; border-radius: 6px;">
            <p style="margin: 0; color: #9a3412; font-size: 13px; font-weight: bold;">⚠️ জরুরি স্টক সতর্কতা ({len(data['low_stocks'])}টি পণ্য)</p>
            <p style="margin: 4px 0 0 0; color: #c2410c; font-size: 12px;">দোকানের কিছু পণ্যের স্টক শেষ বা রিঅর্ডারের সীমার নিচে নেমে গেছে। বিস্তারিত সংযুক্ত পিডিএফে দেখুন।</p>
        </div>
        """

    html_body = f"""
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{subject}</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#0f172a;">
  <div style="max-width:620px; margin:20px auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.06); border:1px solid #e2e8f0;">
    
    <!-- Top Brand Header -->
    <div style="background:#0f172a; padding:24px 28px; text-align:left;">
      <div style="font-size:11px; font-weight:bold; letter-spacing:1.5px; color:#38bdf8; text-transform:uppercase;">StockWhisk Cloud ERP</div>
      <h1 style="margin:6px 0 2px 0; font-size:20px; color:#ffffff; font-weight:700;">{shop.name}</h1>
      <p style="margin:0; font-size:13px; color:#94a3b8;">{data['period_label_bn']}</p>
    </div>

    <div style="padding:24px 28px;">
      
      <!-- Greeting -->
      <p style="margin:0 0 16px 0; font-size:14px; line-height:1.5; color:#334155;">
        শ্রদ্ধেয় দোকান মালিক স্যার, আপনার দোকানের আজকের সার্বিক বিক্রয় ও ব্যবসায়িক পারফরম্যান্সের এক্সিকিউটিভ সারাংশ নিচে তুলে ধরা হলো:
      </p>

      <!-- KPI 4-Card Grid -->
      <table width="100%" cellpadding="0" cellspacing="8" style="margin-bottom:20px;">
        <tr>
          <td width="50%" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px; text-align:center;">
            <div style="font-size:11px; color:#64748b; font-weight:600; text-transform:uppercase;">মোট বিক্রি (Gross Sales)</div>
            <div style="font-size:18px; color:#2563eb; font-weight:bold; margin-top:4px;">{_fmt_curr(data['gross_sales'])}</div>
            <div style="font-size:11px; color:#94a3b8; margin-top:2px;">মোট অর্ডার: {data['total_orders']} টি</div>
          </td>
          <td width="50%" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px; text-align:center;">
            <div style="font-size:11px; color:#64748b; font-weight:600; text-transform:uppercase;">প্রকৃত লাভ (Net Profit)</div>
            <div style="font-size:18px; color:#059669; font-weight:bold; margin-top:4px;">{_fmt_curr(data['net_profit'])}</div>
            <div style="font-size:11px; color:#059669; margin-top:2px;">মার্জিন: {data['gross_margin']:.1f}%</div>
          </td>
        </tr>
        <tr>
          <td width="50%" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px; text-align:center;">
            <div style="font-size:11px; color:#64748b; font-weight:600; text-transform:uppercase;">ক্যাশ আদায় (Cash In Hand)</div>
            <div style="font-size:18px; color:#0f172a; font-weight:bold; margin-top:4px;">{_fmt_curr(data['pay_methods']['cash'])}</div>
            <div style="font-size:11px; color:#94a3b8; margin-top:2px;">নগদ ক্যাশ ড্রয়ার</div>
          </td>
          <td width="50%" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px; text-align:center;">
            <div style="font-size:11px; color:#64748b; font-weight:600; text-transform:uppercase;">নতুন বাকি (New Dues)</div>
            <div style="font-size:18px; color:#dc2626; font-weight:bold; margin-top:4px;">{_fmt_curr(data['new_dues'])}</div>
            <div style="font-size:11px; color:#dc2626; margin-top:2px;">বকেয়া খাতা</div>
          </td>
        </tr>
      </table>

      <!-- Low Stock Warning Box if any -->
      {low_stock_banner}

      <!-- Top Selling Products Highlight -->
      <h3 style="font-size:14px; color:#0f172a; margin:20px 0 10px 0; border-bottom:1px solid #e2e8f0; padding-bottom:6px;">
        🔥 শীর্ষ বিক্রিত পণ্যসমূহ (Top Performing Items)
      </h3>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; margin-bottom:20px;">
        <thead>
          <tr style="background:#f8fafc; border-bottom:1px solid #e2e8f0;">
            <th style="padding:8px 12px; font-size:11px; color:#64748b; text-align:left;">পণ্যের নাম</th>
            <th style="padding:8px 12px; font-size:11px; color:#64748b; text-align:center;">বিক্রয়</th>
            <th style="padding:8px 12px; font-size:11px; color:#64748b; text-align:right;">মোট মূল্য</th>
          </tr>
        </thead>
        <tbody>
          {top_prods_html}
        </tbody>
      </table>

      <!-- PDF Attachment Callout Banner -->
      <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:16px; text-align:center; margin-top:24px;">
        <div style="font-size:22px;">📎</div>
        <div style="font-size:14px; font-weight:bold; color:#1e40af; margin-top:4px;">পূর্ণাঙ্গ পিডিএফ রিপোর্ট সংযুক্ত রয়েছে</div>
        <p style="margin:4px 0 0 0; font-size:12px; color:#3b82f6;">
          দোকানের লাভ-ক্ষতি, লেজার হিসাব ও বিস্তারিত ইনভেন্টরি দেখতে সংযুক্ত <b>PDF</b> ফাইলটি ডাউনলোড করুন।
        </p>
      </div>

      <!-- Action Button to Login -->
      <div style="text-align:center; margin-top:24px;">
        <a href="https://stockwhisk.com/app/reports" style="background:#2563eb; color:#ffffff; text-decoration:none; padding:12px 28px; border-radius:6px; font-size:13px; font-weight:bold; display:inline-block;">
          লাইভ ড্যাশবোর্ডে লগইন করুন ➔
        </a>
      </div>

    </div>

    <!-- Footer -->
    <div style="background:#f8fafc; border-top:1px solid #e2e8f0; padding:16px 28px; text-align:center; font-size:11px; color:#94a3b8;">
      প্রেরক: <b>noreply@stockwhisk.com</b> | StockWhisk Cloud ERP Platform<br/>
      সাহায্যের জন্য কল করুন: 01613-511887 | হেল্প সেন্টার: support@stockwhisk.com
    </div>

  </div>
</body>
</html>
    """
    return subject, text_body, html_body


def send_shop_digest_email(shop, frequency="daily", target_email=None):
    """
    Generate PDF and send automated digest email from noreply@stockwhisk.com.
    """
    from accounts.models import User, RoleType
    from notifications.channels import send_email_with_attachment
    from notifications.models import ShopAlertConfig

    data = get_shop_digest_data(shop, frequency=frequency)
    pdf_bytes = build_digest_pdf(shop, data)
    subject, text_body, html_body = build_digest_email(shop, data)

    # Determine recipient emails
    recipients = set()
    if target_email:
        recipients.add(target_email)
    else:
        # Shop Owners
        owners = User.objects.filter(shop=shop, role=RoleType.OWNER, is_active=True)
        for o in owners:
            if o.email:
                recipients.add(o.email)
        # Extra configured email from ShopAlertConfig
        cfg = ShopAlertConfig.objects.filter(shop=shop).first()
        if cfg and cfg.report_recipient_email:
            for em in cfg.report_recipient_email.split(","):
                em = em.strip()
                if em:
                    recipients.add(em)

    if not recipients:
        logger.warning("No recipient emails found for shop %s (%s)", shop.id, shop.name)
        return {"success": False, "reason": "No recipients"}

    today_str = timezone.localtime().strftime("%Y-%m-%d")
    attachment_name = f"StockWhisk_{frequency.capitalize()}_Report_{today_str}.pdf"

    results = []
    for to_email in recipients:
        ok = send_email_with_attachment(
            to=to_email,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
            attachment_name=attachment_name,
            attachment_bytes=pdf_bytes,
            attachment_type="application/pdf",
        )
        results.append({"email": to_email, "sent": ok})

    return {
        "success": any(r["sent"] for r in results),
        "frequency": frequency,
        "results": results,
        "pdf_size": len(pdf_bytes),
    }
