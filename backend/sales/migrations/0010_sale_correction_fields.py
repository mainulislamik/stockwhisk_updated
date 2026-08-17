# Generated manually

from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('sales', '0009_alter_emiinstallment_shop_alter_emischedule_shop'),
    ]

    operations = [
        migrations.AddField(
            model_name='sale',
            name='is_corrected',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='sale',
            name='correction_reason',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='sale',
            name='original_total',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True),
        ),
    ]
