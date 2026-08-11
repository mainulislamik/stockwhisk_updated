from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0006_shop_is_test"),
    ]

    operations = [
        migrations.AddField(
            model_name="shop",
            name="delivery_enabled",
            field=models.BooleanField(default=True),
        ),
    ]
