from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0008_shop_barcode_prefix"),
    ]

    operations = [
        migrations.AddField(
            model_name="subscriptionplan",
            name="highlights",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
