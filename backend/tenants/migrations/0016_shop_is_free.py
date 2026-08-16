from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0015_alter_shop_business_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="shop",
            name="is_free",
            field=models.BooleanField(default=False),
        ),
    ]
