"""Render a sale as a simple, clean invoice PDF (reportlab)."""
from io import BytesIO

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

BRAND = HexColor("#1B3C53")
BLACK = HexColor("#000000")
WHITE = HexColor("#ffffff")
GREY = HexColor("#555555")
LIGHTGREY = HexColor("#888888")


def _money(v):
    try:
        return f"Tk {float(v):,.2f}"
    except (TypeError, ValueError):
        return f"Tk {v}"


def build_invoice_pdf(sale) -> bytes:
    """Return the invoice PDF for ``sale`` as bytes."""
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    left = 20 * mm
    right = w - 20 * mm
    y = h - 24 * mm

    shop = sale.shop
    

    # ── Header ──
    c.setFillColor(BRAND)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(left, y, shop.name or "Invoice")
    c.setFillColor(BLACK)
    c.setFont("Helvetica-Bold", 22)
    c.drawRightString(right, y, "INVOICE")
    y -= 7 * mm
    c.setFont("Helvetica", 9)
    c.setFillColor(GREY)
    contact = " · ".join([x for x in [getattr(shop, "phone", ""), getattr(shop, "email", "")] if x])
    if contact:
        c.drawString(left, y, contact)
    if getattr(shop, "address", ""):
        y -= 5 * mm
        c.drawString(left, y, str(shop.address)[:80])

    # Invoice meta (right side)
    c.setFillColor(BLACK)
    c.setFont("Helvetica", 10)
    meta_y = h - 34 * mm
    c.drawRightString(right, meta_y, f"Invoice #: {sale.invoice_no}")
    c.drawRightString(right, meta_y - 5 * mm, f"Date: {sale.sale_date.strftime('%d %b %Y, %I:%M %p')}")
    c.drawRightString(right, meta_y - 10 * mm, f"Status: {sale.get_status_display()}")
    from .models import Payment
    methods = list({p.method for p in Payment.all_objects.filter(sale_id=sale.id)})
    if methods:
        c.drawRightString(right, meta_y - 15 * mm, "Method: " + ", ".join(m.title() for m in methods))

    # ── Bill to ──
    y -= 12 * mm
    c.setFillColor(BRAND)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(left, y, "BILL TO")
    c.setFillColor(BLACK)
    c.setFont("Helvetica", 10)
    y -= 5 * mm
    c.drawString(left, y, sale.bill_name or "Walk-in customer")
    phone = sale.bill_phone
    if phone:
        y -= 5 * mm
        c.drawString(left, y, str(phone))

    # ── Items table header ──
    y -= 12 * mm
    c.setFillColor(BRAND)
    c.rect(left, y - 2 * mm, right - left, 8 * mm, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 9)
    col_qty = right - 70 * mm
    col_price = right - 45 * mm
    col_total = right
    c.drawString(left + 2 * mm, y, "ITEM")
    c.drawRightString(col_qty, y, "QTY")
    c.drawRightString(col_price, y, "PRICE")
    c.drawRightString(col_total, y, "TOTAL")

    # ── Items ──
    # NB: use the UNSCOPED managers. This runs in a public (no-tenant) request,
    # so the tenant-scoped default managers would return nothing.
    from catalog.models import ProductUnit
    from .models import SaleItem

    # Map product_id -> [barcodes] for this sale (for the per-item serial line).
    barcodes_by_product = {}
    for u in ProductUnit.all_objects.filter(sale_id=sale.id):
        barcodes_by_product.setdefault(u.product_id, []).append(u.barcode)

    c.setFillColor(BLACK)
    c.setFont("Helvetica", 9)
    y -= 8 * mm
    for it in SaleItem.all_objects.filter(sale_id=sale.id).select_related("product"):
        product = it.product
        name = (getattr(product, "name", None) or "Item")[:52]
        qty = it.quantity
        c.setFillColor(BLACK)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(left + 2 * mm, y, name)
        c.setFont("Helvetica", 9)
        c.drawRightString(col_qty, y, str(int(qty) if qty == int(qty) else qty))
        c.drawRightString(col_price, y, _money(it.unit_price))
        c.drawRightString(col_total, y, _money(it.subtotal))
        # Sub-line: barcode(s) + warranty
        extras = []
        bcs = barcodes_by_product.get(it.product_id) or ([product.barcode] if getattr(product, "barcode", "") else [])
        if bcs:
            extras.append("Barcode: " + ", ".join([b for b in bcs if b][:3]))
        wm = getattr(product, "warranty_months", 0) or 0
        if wm:
            extras.append(f"Warranty: {wm} months")
        if extras:
            y -= 4.2 * mm
            c.setFillColor(GREY)
            c.setFont("Helvetica", 7.5)
            c.drawString(left + 2 * mm, y, " · ".join(extras)[:90])
        y -= 6 * mm
        if y < 55 * mm:
            c.showPage(); y = h - 30 * mm

    # ── Totals ──
    c.line(col_price - 20 * mm, y, right, y)
    y -= 7 * mm

    def total_row(label, value, bold=False):
        nonlocal y
        c.setFont("Helvetica-Bold" if bold else "Helvetica", 11 if bold else 9)
        c.drawRightString(col_price, y, label)
        c.drawRightString(col_total, y, value)
        y -= 6 * mm

    total_row("Subtotal", _money(sale.subtotal))
    if sale.discount:
        total_row("Discount", f"- {_money(sale.discount)}")
    if sale.delivery_charge:
        total_row("Delivery", _money(sale.delivery_charge))
    if sale.tax:
        total_row("Tax", _money(sale.tax))
    total_row("TOTAL", _money(sale.total), bold=True)
    total_row("Paid", _money(sale.paid))
    due = (sale.total or 0) - (sale.paid or 0)
    if due > 0:
        total_row("Due", _money(due), bold=True)

    # ── Footer ──
    c.setFillColor(LIGHTGREY)
    c.setFont("Helvetica-Oblique", 9)
    c.drawCentredString(w / 2, 20 * mm, "Thank you for your business!")
    c.setFont("Helvetica", 7)
    c.drawCentredString(w / 2, 14 * mm, "Generated by StockWhisk")

    c.showPage()
    c.save()
    return buf.getvalue()
