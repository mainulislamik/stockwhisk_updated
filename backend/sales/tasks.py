from datetime import timedelta
from django.utils import timezone
from django.core.mail import send_mail
from celery import shared_task
import logging

logger = logging.getLogger(__name__)

@shared_task
def send_emi_welcome_email(schedule_id):
    """
    Send an email to the customer summarizing their new EMI plan.
    """
    from .models import EMISchedule
    try:
        schedule = EMISchedule.all_objects.select_related('sale', 'customer', 'shop').get(id=schedule_id)
    except EMISchedule.DoesNotExist:
        logger.error(f"EMISchedule {schedule_id} not found for welcome email.")
        return

    customer = schedule.customer
    if not customer.email:
        logger.warning(f"Customer {customer.id} has no email, skipping EMI welcome.")
        return

    subject = f"Your EMI Plan Details - {schedule.shop.name}"
    
    message = f"""Dear {customer.name},

Thank you for your purchase (Invoice: {schedule.sale.invoice_no}). Here are the details of your new EMI plan:

Principal Amount: BDT {schedule.principal}
Down Payment: BDT {schedule.down_payment}
Interest Rate: {schedule.interest_percent}%
Total EMI Amount: BDT {schedule.total_emi_amount}
Number of Installments: {schedule.total_months} Months
Monthly Installment: BDT {schedule.monthly_installment}

Your installments are due monthly starting from next month. We will send you reminders before each due date.

Thank you for choosing {schedule.shop.name}!

Best Regards,
{schedule.shop.name}
    """

    try:
        from django.core.mail import get_connection, EmailMessage
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

        email = EmailMessage(
            subject=subject,
            body=message.strip(),
            from_email=from_email,
            to=[customer.email],
            connection=connection,
        )
        email.send(fail_silently=False)
        logger.info(f"Sent EMI welcome email to {customer.email}")
    except Exception as e:
        logger.error(f"Failed to send EMI welcome email: {e}")


@shared_task
def send_emi_reminders():
    """
    Daily task to send reminders for pending installments due in exactly 3 days.
    """
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
        subject = f"EMI Installment Reminder - {shop.name}"
        amount_due = inst.amount - inst.paid_amount
        
        message = f"""Dear {customer.name},

This is a friendly reminder that your EMI installment (Month {inst.installment_number}) for Invoice #{inst.schedule.sale.invoice_no} is due on {inst.due_date}.

Amount Due: BDT {amount_due}

Please ensure payment is made by the due date to avoid any late fees.

Thank you,
{shop.name}
        """
        
        try:
            from django.core.mail import get_connection, EmailMessage as DjangoEmailMessage
            from django.conf import settings as django_settings
            from platform_admin.models import PlatformConfig

            config = PlatformConfig.get_solo()
            connection = None
            from_email = django_settings.DEFAULT_FROM_EMAIL

            if config.smtp_host and config.smtp_user:
                connection = get_connection(
                    backend='platform_admin.email_backend.UnverifiedSTARTTLSBackend',
                    host=config.smtp_host,
                    port=config.smtp_port,
                    username=config.smtp_user,
                    password=config.smtp_password,
                    use_tls=config.smtp_use_tls,
                )
                from_email = config.smtp_default_from or django_settings.DEFAULT_FROM_EMAIL

            email_msg = DjangoEmailMessage(
                subject=subject,
                body=message.strip(),
                from_email=from_email,
                to=[customer.email],
                connection=connection,
            )
            email_msg.send(fail_silently=True)
            count += 1
        except Exception as e:
            logger.error(f"Failed to send reminder for installment {inst.id}: {e}")
            
    logger.info(f"Sent {count} EMI installment reminders.")
    return count
