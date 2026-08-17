import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from service.models import ServiceTicket

ticket = ServiceTicket.objects.first()
if ticket:
    print(f"Ticket: {ticket.ticket_no}")
    print(f"Parts total: {ticket.parts_total}")
    print(f"Service charge: {ticket.service_charge}")
    print(f"Discount: {ticket.discount}")
    print(f"Paid: {ticket.paid}")
    print(f"Bill total: {ticket.bill_total}")
    print(f"Due: {ticket.due}")
else:
    print("No ticket found")
