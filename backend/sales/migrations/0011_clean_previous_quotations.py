from django.db import migrations
from django.db.models import Q

def clean_previous_quotations(apps, schema_editor):
    Sale = apps.get_model('sales', 'Sale')
    ProductUnit = apps.get_model('catalog', 'ProductUnit')
    Warranty = apps.get_model('service', 'Warranty')

    quotation_sales = Sale.objects.filter(
        Q(status="quotation") |
        Q(status="QUOTATION") |
        Q(note__icontains="quotation") |
        Q(note__icontains="কোটেশন")
    )

    quotation_ids = list(quotation_sales.values_list('id', flat=True))
    if quotation_ids:
        quotation_sales.update(status="quotation")

        ProductUnit.objects.filter(sale_id__in=quotation_ids).update(
            status="in_stock",
            sale=None,
            sold_at=None
        )

        Warranty.objects.filter(sale_item__sale_id__in=quotation_ids).delete()

def reverse_clean(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('sales', '0010_sale_correction_fields'),
        ('catalog', '0016_reorder_level_default_5'),
        ('service', '0009_link_service_customers'),
    ]

    operations = [
        migrations.RunPython(clean_previous_quotations, reverse_clean),
    ]
