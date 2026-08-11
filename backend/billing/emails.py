"""HTML invoice email for subscription activation / renewal."""
from django.utils import timezone

SUPPORT_EMAIL = "admin@stockwhisk.com"
SUPPORT_PHONE = "+8801613511887"
BRAND = "#234C6A"
BRAND_DARK = "#152f45"


def _fmt_date(d):
    if d is None:
        return "—"
    return d.strftime("%d %b %Y")


def build_invoice_email(*, shop, invoice, plan, period_start, period_end, amount, owner_name=""):
    """Return (subject, text_body, html_body) for a paid subscription invoice."""
    currency = getattr(shop, "currency", "BDT") or "BDT"
    amount_str = f"{currency} {amount:,.2f}"
    number = invoice.number
    subject = f"Invoice {number} — {plan.name} plan activated"

    text_body = (
        f"StockWhisk — Payment Receipt\n"
        f"Invoice: {number}\n\n"
        f"Shop: {shop.name}\n"
        f"Plan: {plan.name}\n"
        f"Billing period: {_fmt_date(period_start)} to {_fmt_date(period_end)}\n"
        f"Amount paid: {amount_str}\n"
        f"Status: PAID\n\n"
        f"Your {plan.name} plan is active until {_fmt_date(period_end)}.\n\n"
        f"Questions? {SUPPORT_EMAIL} · {SUPPORT_PHONE}\n"
        f"Thank you for choosing StockWhisk."
    )

    issued = _fmt_date(timezone.localdate())
    greeting = f"Hi {owner_name}," if owner_name else "Hello,"

    html_body = f"""\
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,.06);">
        <!-- Header -->
        <tr><td style="background:{BRAND};background-image:linear-gradient(135deg,{BRAND},{BRAND_DARK});padding:28px 32px;">
          <table role="presentation" width="100%"><tr>
            <td style="color:#fff;font-size:22px;font-weight:700;letter-spacing:.3px;">StockWhisk</td>
            <td align="right" style="color:#cbd5e1;font-size:13px;">Payment Receipt</td>
          </tr></table>
        </td></tr>

        <!-- Title -->
        <tr><td style="padding:28px 32px 8px;">
          <div style="font-size:13px;color:#64748b;">{greeting}</div>
          <div style="font-size:20px;font-weight:700;margin-top:6px;">Your plan is now active 🎉</div>
          <div style="font-size:14px;color:#475569;margin-top:6px;">
            Thank you for your payment. Here is your receipt for the
            <b>{plan.name}</b> plan.
          </div>
        </td></tr>

        <!-- Invoice meta -->
        <tr><td style="padding:16px 32px 0;">
          <table role="presentation" width="100%" style="font-size:13px;color:#475569;">
            <tr>
              <td style="padding:4px 0;"><span style="color:#94a3b8;">Invoice</span><br><b style="color:#1e293b;font-family:monospace;">{number}</b></td>
              <td align="right" style="padding:4px 0;"><span style="color:#94a3b8;">Issued</span><br><b style="color:#1e293b;">{issued}</b></td>
            </tr>
            <tr>
              <td style="padding:4px 0;"><span style="color:#94a3b8;">Shop</span><br><b style="color:#1e293b;">{shop.name}</b></td>
              <td align="right" style="padding:4px 0;"><span style="color:#94a3b8;">Status</span><br>
                <span style="display:inline-block;background:#dcfce7;color:#16a34a;font-weight:700;font-size:12px;padding:3px 10px;border-radius:20px;">PAID</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Line items -->
        <tr><td style="padding:22px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;font-size:14px;">
            <tr style="background:#f8fafc;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.4px;">
              <td style="padding:11px 16px;">Description</td>
              <td align="right" style="padding:11px 16px;">Amount</td>
            </tr>
            <tr>
              <td style="padding:14px 16px;border-top:1px solid #e2e8f0;">
                <b>{plan.name} plan</b><br>
                <span style="color:#64748b;font-size:12px;">{_fmt_date(period_start)} — {_fmt_date(period_end)}</span>
              </td>
              <td align="right" style="padding:14px 16px;border-top:1px solid #e2e8f0;font-family:monospace;">{amount_str}</td>
            </tr>
            <tr style="background:#f8fafc;">
              <td style="padding:13px 16px;border-top:1px solid #e2e8f0;font-weight:700;">Total paid</td>
              <td align="right" style="padding:13px 16px;border-top:1px solid #e2e8f0;font-weight:700;font-family:monospace;color:{BRAND};">{amount_str}</td>
            </tr>
          </table>
        </td></tr>

        <!-- Active-until callout -->
        <tr><td style="padding:20px 32px 0;">
          <table role="presentation" width="100%" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;">
            <tr><td style="padding:14px 16px;font-size:14px;color:#1e40af;">
              <b>Active until {_fmt_date(period_end)}.</b><br>
              <span style="font-size:13px;color:#3b5b86;">We'll remind you before it expires so you never lose access.</span>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 32px 28px;">
          <div style="border-top:1px solid #e2e8f0;padding-top:16px;font-size:13px;color:#64748b;">
            Need help or want to renew? Reach us anytime:<br>
            <a href="mailto:{SUPPORT_EMAIL}" style="color:{BRAND};text-decoration:none;">{SUPPORT_EMAIL}</a>
            &nbsp;·&nbsp;
            <a href="https://wa.me/8801613511887" style="color:{BRAND};text-decoration:none;">{SUPPORT_PHONE}</a>
          </div>
          <div style="font-size:11px;color:#94a3b8;margin-top:14px;">
            This is an automated receipt from StockWhisk. Please keep it for your records.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""
    return subject, text_body, html_body
