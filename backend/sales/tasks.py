from datetime import timedelta
from django.utils import timezone
from django.core.mail import send_mail
from celery import shared_task
import logging

logger = logging.getLogger(__name__)


def _get_smtp_connection():
    """Return (connection, from_email) using PlatformConfig SMTP settings."""
    from django.core.mail import get_connection
    from django.conf import settings
    from platform_admin.models import PlatformConfig

    config = PlatformConfig.get_solo()
    connection = None
    from_email = settings.DEFAULT_FROM_EMAIL

    if config.smtp_host and config.smtp_user:
        connection = get_connection(
            backend='platform_admin.email_backend.UnverifiedSTARTTLSBackend',
            host=config.smtp_host,
            port=config.smtp_port,
            username=config.smtp_user,
            password=config.smtp_password,
            use_tls=config.smtp_use_tls,
        )
        from_email = config.smtp_default_from or settings.DEFAULT_FROM_EMAIL

    return connection, from_email


def _emi_welcome_html(customer_name, shop_name, invoice_no, principal,
                      down_payment, interest_percent, total_emi_amount,
                      total_months, monthly_installment, installments):
    """Build a clean, modern HTML email for the EMI welcome message."""
    rows = ""
    for inst in installments:
        rows += f"""
        <tr>
          <td style="padding:8px 12px;text-align:center;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;">{inst.installment_number}</td>
          <td style="padding:8px 12px;text-align:center;border-bottom:1px solid #f1f5f9;font-size:13px;color:#475569;">{inst.due_date.strftime('%d %b %Y')}</td>
          <td style="padding:8px 12px;text-align:right;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:600;color:#1e293b;">৳ {inst.amount:,.2f}</td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Your EMI Plan - {shop_name}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:600px;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1B3C53 0%,#2563eb 100%);padding:36px 40px;text-align:center;">
            <div style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:.5px;">{shop_name}</div>
            <div style="font-size:13px;color:#bfdbfe;margin-top:4px;">Business Management System</div>
          </td>
        </tr>

        <!-- Hero -->
        <tr>
          <td style="padding:36px 40px 24px;text-align:center;">
            <div style="width:56px;height:56px;background:#eff6ff;border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:28px;">📋</div>
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1e293b;">Your EMI Plan is Active!</h1>
            <p style="margin:0;font-size:15px;color:#64748b;line-height:1.6;">
              Dear <strong style="color:#1e293b;">{customer_name}</strong>, thank you for your purchase.<br>
              Invoice <strong style="color:#2563eb;">#{invoice_no}</strong> has been processed with an EMI plan.
            </p>
          </td>
        </tr>

        <!-- Summary Cards -->
        <tr>
          <td style="padding:0 40px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="48%" style="background:#f8fafc;border-radius:8px;padding:16px 20px;border:1px solid #e2e8f0;">
                  <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:4px;">Principal</div>
                  <div style="font-size:20px;font-weight:700;color:#1e293b;">৳ {principal:,.2f}</div>
                </td>
                <td width="4%"></td>
                <td width="48%" style="background:#f8fafc;border-radius:8px;padding:16px 20px;border:1px solid #e2e8f0;">
                  <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:4px;">Down Payment</div>
                  <div style="font-size:20px;font-weight:700;color:#16a34a;">৳ {down_payment:,.2f}</div>
                </td>
              </tr>
              <tr><td colspan="3" style="padding-top:12px;"></td></tr>
              <tr>
                <td width="48%" style="background:#eff6ff;border-radius:8px;padding:16px 20px;border:1px solid #bfdbfe;">
                  <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#60a5fa;margin-bottom:4px;">Total EMI</div>
                  <div style="font-size:20px;font-weight:700;color:#2563eb;">৳ {total_emi_amount:,.2f}</div>
                  <div style="font-size:11px;color:#93c5fd;margin-top:2px;">Interest: {interest_percent}%</div>
                </td>
                <td width="4%"></td>
                <td width="48%" style="background:#f0fdf4;border-radius:8px;padding:16px 20px;border:1px solid #bbf7d0;">
                  <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#4ade80;margin-bottom:4px;">Monthly Installment</div>
                  <div style="font-size:20px;font-weight:700;color:#16a34a;">৳ {monthly_installment:,.2f}</div>
                  <div style="font-size:11px;color:#86efac;margin-top:2px;">{total_months} months</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Installment Table -->
        <tr>
          <td style="padding:0 40px 32px;">
            <div style="font-size:14px;font-weight:600;color:#1e293b;margin-bottom:12px;">📅 Installment Schedule</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
              <thead>
                <tr style="background:#1e293b;">
                  <th style="padding:10px 12px;text-align:center;font-size:12px;font-weight:600;color:#94a3b8;letter-spacing:.05em;">#</th>
                  <th style="padding:10px 12px;text-align:center;font-size:12px;font-weight:600;color:#94a3b8;letter-spacing:.05em;">Due Date</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;font-weight:600;color:#94a3b8;letter-spacing:.05em;">Amount</th>
                </tr>
              </thead>
              <tbody>{rows}
              </tbody>
            </table>
          </td>
        </tr>

        <!-- Note -->
        <tr>
          <td style="padding:0 40px 32px;">
            <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;font-size:13px;color:#92400e;line-height:1.6;">
              ⏰ <strong>Reminder:</strong> You will receive an email reminder 3 days before each installment is due. Please ensure timely payment to avoid any penalties.
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#1e293b;">{shop_name}</p>
            <p style="margin:0;font-size:12px;color:#94a3b8;">This is an automated email. Please do not reply to this message.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _emi_reminder_html(customer_name, shop_name, invoice_no, installment_number,
                       due_date, amount_due, total_months):
    """Build a clean HTML reminder email."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>EMI Reminder - {shop_name}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:600px;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1B3C53 0%,#2563eb 100%);padding:36px 40px;text-align:center;">
            <div style="font-size:28px;font-weight:800;color:#ffffff;">{shop_name}</div>
            <div style="font-size:13px;color:#bfdbfe;margin-top:4px;">EMI Payment Reminder</div>
          </td>
        </tr>

        <!-- Hero -->
        <tr>
          <td style="padding:36px 40px 28px;text-align:center;">
            <div style="font-size:40px;margin-bottom:12px;">⏰</div>
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1e293b;">Installment Due in 3 Days</h1>
            <p style="margin:0;font-size:15px;color:#64748b;line-height:1.6;">
              Dear <strong style="color:#1e293b;">{customer_name}</strong>,<br>
              Your EMI installment for Invoice <strong style="color:#2563eb;">#{invoice_no}</strong> is due soon.
            </p>
          </td>
        </tr>

        <!-- Due Card -->
        <tr>
          <td style="padding:0 40px 28px;">
            <div style="background:linear-gradient(135deg,#fee2e2,#fecaca);border:1px solid #fca5a5;border-radius:12px;padding:24px 32px;text-align:center;">
              <div style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#b91c1c;margin-bottom:8px;">Amount Due</div>
              <div style="font-size:36px;font-weight:800;color:#991b1b;">৳ {amount_due:,.2f}</div>
              <div style="font-size:14px;color:#b91c1c;margin-top:8px;">
                Installment <strong>{installment_number}</strong> of <strong>{total_months}</strong> &nbsp;|&nbsp; Due on <strong>{due_date.strftime('%d %b %Y')}</strong>
              </div>
            </div>
          </td>
        </tr>

        <!-- Warning -->
        <tr>
          <td style="padding:0 40px 32px;">
            <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;font-size:13px;color:#92400e;line-height:1.6;">
              ⚠️ <strong>Please ensure payment is made by the due date</strong> to avoid any late fees or penalties on your account.
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#1e293b;">{shop_name}</p>
            <p style="margin:0;font-size:12px;color:#94a3b8;">This is an automated email. Please do not reply to this message.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


@shared_task
def send_emi_welcome_email(schedule_id):
    """Send a beautiful HTML email to the customer summarizing their new EMI plan."""
    from .models import EMISchedule, EMIInstallment
    try:
        schedule = EMISchedule.all_objects.select_related('sale', 'customer', 'shop').get(id=schedule_id)
    except EMISchedule.DoesNotExist:
        logger.error(f"EMISchedule {schedule_id} not found for welcome email.")
        return

    customer = schedule.customer
    if not customer.email:
        logger.warning(f"Customer {customer.id} has no email, skipping EMI welcome.")
        return

    installments = EMIInstallment.all_objects.filter(
        schedule_id=schedule_id
    ).order_by('installment_number')

    subject = f"Your EMI Plan Details - {schedule.shop.name}"
    plain_text = (
        f"Dear {customer.name},\n\n"
        f"Your EMI plan for Invoice {schedule.sale.invoice_no} is now active.\n"
        f"Monthly Installment: BDT {schedule.monthly_installment} x {schedule.total_months} months\n\n"
        f"Thank you for choosing {schedule.shop.name}!"
    )
    html_content = _emi_welcome_html(
        customer_name=customer.name,
        shop_name=schedule.shop.name,
        invoice_no=schedule.sale.invoice_no,
        principal=float(schedule.principal),
        down_payment=float(schedule.down_payment),
        interest_percent=schedule.interest_percent,
        total_emi_amount=float(schedule.total_emi_amount),
        total_months=schedule.total_months,
        monthly_installment=float(schedule.monthly_installment),
        installments=installments,
    )

    try:
        from django.core.mail import get_connection, EmailMultiAlternatives
        connection, from_email = _get_smtp_connection()

        msg = EmailMultiAlternatives(
            subject=subject,
            body=plain_text,
            from_email=from_email,
            to=[customer.email],
            connection=connection,
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send(fail_silently=False)
        logger.info(f"Sent EMI welcome email to {customer.email}")
    except Exception as e:
        logger.error(f"Failed to send EMI welcome email: {e}")


@shared_task
def send_emi_reminders():
    """Daily task — sends HTML reminder emails for installments due in 3 days."""
    from .models import EMIInstallment

    target_date = timezone.localdate() + timedelta(days=3)
    installments = EMIInstallment.all_objects.filter(
        status=EMIInstallment.Status.PENDING,
        due_date=target_date
    ).select_related('schedule', 'schedule__customer', 'schedule__shop', 'schedule__sale')

    count = 0
    for inst in installments:
        customer = inst.schedule.customer
        if not customer.email:
            continue

        shop = inst.schedule.shop
        amount_due = inst.amount - inst.paid_amount

        subject = f"⏰ EMI Payment Reminder - {shop.name}"
        plain_text = (
            f"Dear {customer.name},\n\n"
            f"Your EMI installment #{inst.installment_number} for Invoice {inst.schedule.sale.invoice_no} "
            f"is due on {inst.due_date}. Amount: BDT {amount_due}\n\n"
            f"Thank you, {shop.name}"
        )
        html_content = _emi_reminder_html(
            customer_name=customer.name,
            shop_name=shop.name,
            invoice_no=inst.schedule.sale.invoice_no,
            installment_number=inst.installment_number,
            due_date=inst.due_date,
            amount_due=float(amount_due),
            total_months=inst.schedule.total_months,
        )

        try:
            from django.core.mail import get_connection, EmailMultiAlternatives
            connection, from_email = _get_smtp_connection()

            msg = EmailMultiAlternatives(
                subject=subject,
                body=plain_text,
                from_email=from_email,
                to=[customer.email],
                connection=connection,
            )
            msg.attach_alternative(html_content, "text/html")
            msg.send(fail_silently=True)
            count += 1
        except Exception as e:
            logger.error(f"Failed to send reminder for installment {inst.id}: {e}")

    logger.info(f"Sent {count} EMI installment reminders.")
    return count


def _format_intl_phone(phone_raw: str) -> str:
    if not phone_raw:
        return ""
    digits = "".join(ch for ch in str(phone_raw) if ch.isdigit())
    if not digits:
        return ""
    if digits.startswith("880"):
        return digits
    if digits.startswith("0"):
        return "880" + digits[1:]
    if len(digits) == 10:
        return "880" + digits
    return digits


@shared_task
def send_due_date_reminders():
    """Daily task — sends WhatsApp and in-app notifications to shop owners and customers
    on the promised due date."""
    from django.db.models import F
    from .models import Sale
    from notifications.models import Notification, NotificationType
    from notifications import whatsapp

    today = timezone.localdate()
    due_sales = Sale.all_objects.filter(
        due_date=today,
        total__gt=F("paid")
    ).exclude(
        status__in=[Sale.Status.CANCELLED, Sale.Status.QUOTATION, Sale.Status.PAID]
    ).select_related('customer', 'shop', 'created_by')

    sent_count = 0
    for sale in due_sales:
        due_amt = sale.total - sale.paid
        if due_amt <= 0:
            continue

        shop = sale.shop
        shop_name = shop.name if shop else "Shop"
        currency = getattr(shop, "currency", "BDT") or "BDT"
        invoice_no = sale.invoice_no or f"INV-{sale.id}"
        date_str = sale.due_date.strftime('%d %b %Y')
        public_url = getattr(sale, "public_invoice_url", "") or f"/invoice/{sale.id}"

        cust_name = sale.bill_name or sale.customer_name or (sale.customer.name if sale.customer else "") or "Customer"
        cust_phone_raw = sale.bill_phone or sale.customer_phone or (sale.customer.phone if sale.customer else "") or ""
        cust_phone = _format_intl_phone(cust_phone_raw)

        # 1. Send WhatsApp Notification to Customer
        if cust_phone:
            cust_msg = (
                f"সম্মানিত {cust_name},\n"
                f"{shop_name} থেকে বিনীত অনুস্মারক: আপনার চালান #{invoice_no}-এর বকেয়া {currency} {due_amt:,.2f} "
                f"পরিশোধের প্রতিশ্রুত তারিখ আজ ({date_str})।\n"
                f"বিস্তারিত ইনভয়েস দেখুন: {public_url}\n"
                f"ধন্যবাদ!"
            )
            # Try template then direct text
            whatsapp.send_template(
                shop=shop, to_phone=cust_phone,
                template_key="due_payment_reminder",
                params=[cust_name, invoice_no, f"{currency} {due_amt:,.2f}", date_str, shop_name]
            )
            whatsapp.send_direct_message(shop=shop, to_phone=cust_phone, text=cust_msg)

        # 2. In-App Notification for Shop Owner & Staff
        notif_exists = Notification.all_objects.filter(
            shop_id=sale.shop_id,
            type=NotificationType.PAYMENT_DUE,
            created_at__date=today,
            metadata__sale_id=sale.id
        ).exists()

        if not notif_exists:
            Notification.all_objects.create(
                shop_id=sale.shop_id,
                type=NotificationType.PAYMENT_DUE,
                title=f"Due Payment Promised Today: #{invoice_no}",
                message=f"Customer {cust_name} ({cust_phone_raw or 'No phone'}) has a promised due payment of {currency} {due_amt:,.2f} for Invoice #{invoice_no} today.",
                metadata={
                    "sale_id": sale.id,
                    "invoice_no": invoice_no,
                    "due": str(due_amt),
                    "customer": cust_name,
                    "phone": cust_phone_raw
                }
            )

        # 3. WhatsApp Notification to Shop Owner / Phone
        owner_phone_raw = getattr(shop, "phone", "") or (sale.created_by.phone if sale.created_by else "")
        owner_phone = _format_intl_phone(owner_phone_raw)
        if owner_phone:
            owner_msg = (
                f"🔔 [StockWhisk] আজকের বকেয়া পেমেন্ট অনুস্মারক:\n"
                f"কাস্টমার {cust_name} ({cust_phone_raw or 'N/A'})-এর চালান #{invoice_no}-এর বকেয়া "
                f"{currency} {due_amt:,.2f} পরিশোধের প্রতিশ্রুত তারিখ আজ ({date_str})।"
            )
            whatsapp.send_direct_message(shop=shop, to_phone=owner_phone, text=owner_msg)

        sent_count += 1

    logger.info("Processed %d due date reminders for %s", sent_count, today)
    return sent_count
