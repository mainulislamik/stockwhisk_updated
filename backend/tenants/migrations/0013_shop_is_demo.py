from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0012_shop_whatsapp_invoice"),
    ]

    operations = [
        migrations.AddField(
            model_name="shop",
            name="is_demo",
            field=models.BooleanField(default=False),
        ),
    ]
