from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('crm', '0005_customer_new_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='customer',
            name='loyalty_points',
            field=models.PositiveIntegerField(default=0, help_text='Loyalty club reward points'),
        ),
        migrations.AddField(
            model_name='customer',
            name='membership_id',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
    ]
