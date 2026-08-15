"""Make Product.reorder_level an integer.

A reorder threshold is a whole number of units — a fractional value (e.g. the
stray 0.07 seen in the form) is meaningless. Switch the field from Decimal to
PositiveIntegerField; existing decimals are cast to whole numbers by the DB.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0013_share_barcodes_across_products"),
    ]

    operations = [
        migrations.AlterField(
            model_name="product",
            name="reorder_level",
            field=models.PositiveIntegerField(default=5),
        ),
    ]
