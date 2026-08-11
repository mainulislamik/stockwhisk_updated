"""Daily notification digest email — product-level stock table + other alerts."""
from django.utils import timezone

SUPPORT_EMAIL = "admin@stockwhisk.com"
BRAND = "#234C6A"
MAX_PRODUCTS = 15  # cap the table so the email stays readable


def _badge(text, bg, color):
    return (f'<span style="display:inline-block;background:{bg};color:{color};font-size:11px;'
            f'font-weight:700;padding:2px 9px;border-radius:20px;white-space:nowrap;">{text}</span>')


def build_digest_email(*, shop, out, low, others):
    """
    out/low: lists of product dicts ({name, current_stock, reorder_level, ...}).
    others: list of non-stock, non-billing Notification objects (e.g. warranty).
    """
    day = timezone.localdate().strftime("%d %b %Y")
    total = len(out) + len(low)
    subject = f"StockWhisk daily summary — {shop.name} ({total} stock alert{'s' if total != 1 else ''})"

    # ---- plain text ----
    tl = [f"Daily summary for {shop.name} — {day}", ""]
    if out or low:
        tl.append(f"Stock alerts: {len(out)} out of stock, {len(low)} low.")
        for p in out[:MAX_PRODUCTS]:
            tl.append(f"  - {p['name']} — OUT OF STOCK")
        for p in low[:max(0, MAX_PRODUCTS - len(out))]:
            tl.append(f"  - {p['name']} — LOW ({p.get('current_stock')}/{p.get('reorder_level')})")
        if total > MAX_PRODUCTS:
            tl.append(f"  …and {total - MAX_PRODUCTS} more.")
    for n in others:
        tl.append(f"[{n.get_type_display()}] {n.title}")
    tl += ["", "Open your dashboard to review and reorder. — StockWhisk", SUPPORT_EMAIL]
    text = "\n".join(tl)

    # ---- HTML product table ----
    rows, shown = "", 0
    for p in out:
        if shown >= MAX_PRODUCTS:
            break
        rows += f"""<tr>
          <td style="padding:10px 16px;border-top:1px solid #e2e8f0;color:#1e293b;">{p['name']}</td>
          <td style="padding:10px 16px;border-top:1px solid #e2e8f0;text-align:right;">{_badge('Out of stock', '#fee2e2', '#dc2626')}</td>
        </tr>"""
        shown += 1
    for p in low:
        if shown >= MAX_PRODUCTS:
            break
        rows += f"""<tr>
          <td style="padding:10px 16px;border-top:1px solid #e2e8f0;color:#1e293b;">{p['name']}</td>
          <td style="padding:10px 16px;border-top:1px solid #e2e8f0;text-align:right;">{_badge(f"Low · {p.get('current_stock')}/{p.get('reorder_level')}", '#fef3c7', '#d97706')}</td>
        </tr>"""
        shown += 1
    more = total - shown
    if more > 0:
        rows += f"""<tr><td colspan="2" style="padding:10px 16px;border-top:1px solid #e2e8f0;color:#64748b;font-size:13px;text-align:center;">…and {more} more item(s). Open Inventory &amp; stock to review.</td></tr>"""

    stock_section = ""
    if total:
        stock_section = f"""
        <tr><td style="padding:6px 32px 4px;font-weight:700;color:#1e293b;font-size:15px;">
          Stock alerts <span style="color:#64748b;font-weight:400;font-size:13px;">({len(out)} out, {len(low)} low)</span>
        </td></tr>
        <tr><td style="padding:6px 24px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;font-size:14px;overflow:hidden;">
            <tr style="background:#f8fafc;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.4px;">
              <td style="padding:9px 16px;">Product</td>
              <td style="padding:9px 16px;text-align:right;">Status</td>
            </tr>
            {rows}
          </table>
        </td></tr>"""

    other_section = ""
    if others:
        items = "".join(
            f"""<tr>
              <td style="padding:10px 16px;border-top:1px solid #e2e8f0;">
                <div style="font-weight:600;color:#1e293b;">{n.title}</div>
                {f'<div style="color:#64748b;font-size:13px;margin-top:2px;">{(n.message or "").splitlines()[0][:140]}</div>' if n.message else ''}
              </td>
            </tr>""" for n in others
        )
        other_section = f"""
        <tr><td style="padding:6px 32px 4px;font-weight:700;color:#1e293b;font-size:15px;">Other alerts</td></tr>
        <tr><td style="padding:6px 24px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;font-size:14px;">
            {items}
          </table>
        </td></tr>"""

    html = f"""\
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,.06);">
        <tr><td style="background:{BRAND};padding:24px 32px;color:#fff;">
          <div style="font-size:20px;font-weight:700;">StockWhisk — Daily Summary</div>
          <div style="color:#cbd5e1;font-size:13px;margin-top:4px;">{shop.name} · {day}</div>
        </td></tr>
        <tr><td style="padding:20px 32px 4px;color:#475569;font-size:14px;">Here's what needs your attention today.</td></tr>
        {stock_section}
        {other_section}
        <tr><td style="padding:6px 32px 28px;">
          <div style="border-top:1px solid #e2e8f0;padding-top:14px;font-size:12px;color:#94a3b8;">
            One combined summary per day instead of individual alerts.
            Questions? <a href="mailto:{SUPPORT_EMAIL}" style="color:{BRAND};text-decoration:none;">{SUPPORT_EMAIL}</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""
    return subject, text, html
