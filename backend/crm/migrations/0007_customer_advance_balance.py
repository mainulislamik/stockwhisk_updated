# Generated manually for advance_balance on Customer
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('crm', '0006_customer_loyalty_points'),
    ]

    operations = [
        migrations.AddField(
            model_name='customer',
            name='advance_balance',
            field=models.DecimalField(decimal_places=2, default=0, help_text='Advance deposit balance', max_digits=14),
        ),
    ]
