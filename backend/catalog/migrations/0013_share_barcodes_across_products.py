from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0012_product_replacement_guarantee_days_and_more"),
    ]

    operations = [
        # Product barcodes may now be shared across products.
        migrations.RemoveConstraint(
            model_name="product",
            name="uniq_barcode_per_shop_when_set",
        ),
        # ProductUnit barcode uniqueness becomes per-product instead of per-shop.
        migrations.RemoveConstraint(
            model_name="productunit",
            name="uniq_unit_barcode_per_shop",
        ),
        migrations.AddConstraint(
            model_name="productunit",
            constraint=models.UniqueConstraint(
                fields=["shop", "product", "barcode"],
                name="uniq_unit_barcode_per_product",
            ),
        ),
    ]
