from decimal import Decimal
from django.db import migrations


def link_customers(apps, schema_editor):
    ServiceTicket = apps.get_model('service', 'ServiceTicket')
    Customer = apps.get_model('crm', 'Customer')
    ServiceTicketPart = apps.get_model('service', 'ServiceTicketPart')

    for ticket in ServiceTicket.objects.all():
        customer = None
        c_name = str(ticket.customer_name or "").strip()
        c_phone = str(ticket.customer_phone or "").strip()

        if not ticket.customer_id:
            if not c_name and not c_phone:
                continue

            if c_phone:
                customer = Customer.objects.filter(shop_id=ticket.shop_id, phone=c_phone).first()
            if not customer:
                customer = Customer.objects.create(
                    shop_id=ticket.shop_id,
                    name=c_name or c_phone,
                    phone=c_phone,
                )

            ticket.customer_id = customer.id
            ticket.save(update_fields=['customer'])
        else:
            customer = Customer.objects.filter(id=ticket.customer_id).first()

        # If delivered, update customer's total_purchased and due_balance if not already tracked
        if customer and ticket.status == 'delivered':
            parts_total = sum(
                Decimal(str(p.unit_price or 0)) * Decimal(str(p.quantity or 1))
                for p in ServiceTicketPart.objects.filter(ticket_id=ticket.id)
            )
            bill_total = max(
                Decimal('0'),
                Decimal(str(ticket.service_charge or 0)) + parts_total - Decimal(str(ticket.discount or 0))
            )
            due = max(Decimal('0'), bill_total - Decimal(str(ticket.paid or 0)))

            if due > 0 or bill_total > 0:
                customer.due_balance = (customer.due_balance or Decimal('0')) + due
                customer.total_purchased = (customer.total_purchased or Decimal('0')) + bill_total
                customer.save(update_fields=['due_balance', 'total_purchased'])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('service', '0008_serviceticket_discount'),
        ('crm', '0004_customerpayment'),
    ]

    operations = [
        migrations.RunPython(link_customers, reverse_code=noop),
    ]
