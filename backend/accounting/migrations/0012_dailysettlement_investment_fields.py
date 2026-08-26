# Generated migration for DailySettlement investment fields
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounting', '0011_investment'),
    ]

    operations = [
        migrations.AddField(
            model_name='dailysettlement',
            name='expected_investment',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14),
        ),
        migrations.AddField(
            model_name='dailysettlement',
            name='actual_investment',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14),
        ),
        migrations.AddField(
            model_name='dailysettlement',
            name='investment_discrepancy',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14),
        ),
        migrations.AddField(
            model_name='dailysettlement',
            name='total_purchases',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14),
        ),
        migrations.AddField(
            model_name='dailysettlement',
            name='total_capital_investment',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14),
        ),
    ]
