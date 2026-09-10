from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '0014_sale_alteration_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='payment',
            name='alteration_notes',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='payment',
            name='alteration_status',
            field=models.CharField(blank=True, default='', max_length=30),
        ),
    ]
