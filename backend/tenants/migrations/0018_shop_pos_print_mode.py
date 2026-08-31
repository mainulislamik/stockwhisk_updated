from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0017_shop_offline_sale_mode'),
    ]

    operations = [
        migrations.AddField(
            model_name='shop',
            name='pos_print_mode',
            field=models.CharField(default='ask', max_length=20),
        ),
        migrations.AddField(
            model_name='shop',
            name='pos_receipt_enabled',
            field=models.BooleanField(default=True),
        ),
    ]
