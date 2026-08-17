from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0016_shop_is_free'),
    ]

    operations = [
        migrations.AddField(
            model_name='shop',
            name='offline_sale_mode',
            field=models.BooleanField(default=False),
        ),
    ]
