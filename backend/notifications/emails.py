"""Daily notification digest email."""
from django.utils import timezone

SUPPORT_EMAIL = "admin@stockwhisk.com"
BRAND = "#234C6A"

TYPE_LABEL = {
    "low_stock": "Low stock",
    "out_of_stock": "Out of stock",
    "payment_due": "Payment due",
    "subscription": "Subscription",
    "general": "Update",
}


def build_digest_email(*, shop, items, total):
    """items: latest Notification per type. Returns (subject, text, html)."""
    day = timezone.localdate().strftime("%d %b %Y")
    subject = f"StockWhisk daily summary — {shop.name} ({len(items)} update{'s' if len(items) != 1 else ''})"

    def line(n):
        label = TYPE_LABEL.get(n.type, "Update")
        msg = (n.message or "").strip().split("\n")[0][:140]
        return label, n.title, msg

    text_lines = [f"Daily summary for {shop.name} — {day}", ""]
    for n in items:
        label, title, msg = line(n)
        text_lines.append(f"[{label}] {title}")
        if msg:
            text_lines.append(f"    {msg}")
    text_lines += ["", "Open your dashboard to review. — StockWhisk", SUPPORT_EMAIL]
    text = "\n".join(text_lines)

    rows = ""
    for n in items:
        label, title, msg = line(n)
        rows += f"""
        <tr>
          <td style="padding:12px 16px;border-top:1px solid #e2e8f0;vertical-align:top;">
            <span style="display:inline-block;background:#eef2ff;color:{BRAND};font-size:11px;font-weight:700;
                  padding:2px 8px;border-radius:20px;text-transform:uppercase;">{label}</span>
          </td>
          <td style="padding:12px 16px;border-top:1px solid #e2e8f0;">
            <div style="font-weight:600;color:#1e293b;">{title}</div>
            {f'<div style="color:#64748b;font-size:13px;margin-top:2px;">{msg}</div>' if msg else ''}
          </td>
        </tr>"""

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
        <tr><td style="padding:20px 32px 8px;color:#475569;font-size:14px;">
          Here's what needs your attention today.
        </td></tr>
        <tr><td style="padding:8px 24px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;font-size:14px;">
            {rows}
          </table>
        </td></tr>
        <tr><td style="padding:0 32px 28px;">
          <div style="border-top:1px solid #e2e8f0;padding-top:14px;font-size:12px;color:#94a3b8;">
            You're getting one combined summary per day instead of individual alerts.
            Questions? <a href="mailto:{SUPPORT_EMAIL}" style="color:{BRAND};text-decoration:none;">{SUPPORT_EMAIL}</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""
    return subject, text, html
