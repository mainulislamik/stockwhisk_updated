# Generated manually for custom_fields on Sale
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '0015_payment_alteration_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='sale',
            name='custom_fields',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='Dynamic sale metadata e.g. delivery_method, vehicle_no, custom_notes'
            ),
        ),
    ]
