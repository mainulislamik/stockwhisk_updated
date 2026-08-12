from django.db import migrations, models


def backfill_prefixes(apps, schema_editor):
    from tenants.models import derive_barcode_prefix

    Shop = apps.get_model("tenants", "Shop")
    for shop in Shop.objects.filter(barcode_prefix=""):
        shop.barcode_prefix = derive_barcode_prefix(shop.name)
        shop.save(update_fields=["barcode_prefix"])


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0007_shop_delivery_enabled"),
    ]

    operations = [
        migrations.AddField(
            model_name="shop",
            name="barcode_prefix",
            field=models.CharField(blank=True, max_length=5),
        ),
        migrations.RunPython(backfill_prefixes, migrations.RunPython.noop),
    ]
