# Generated manually

from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('purchasing', '0008_alter_supplierpayment_method'),
    ]

    operations = [
        migrations.AddField(
            model_name='purchaseorder',
            name='due_date',
            field=models.DateField(blank=True, help_text='Promised payment date for PO due', null=True),
        ),
    ]
