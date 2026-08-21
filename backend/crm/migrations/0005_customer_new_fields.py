# Generated manually
from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('crm', '0004_customerpayment'),
    ]

    operations = [
        migrations.AddField(
            model_name='customer',
            name='credit_limit',
            field=models.DecimalField(max_digits=14, decimal_places=2, default=0, null=True, blank=True),
        ),
        migrations.AddField(
            model_name='customer',
            name='date_of_birth',
            field=models.DateField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='customer',
            name='anniversary_date',
            field=models.DateField(null=True, blank=True),
        ),
    ]
