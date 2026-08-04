from decimal import Decimal
from django.db import migrations, models


def set_reorder_level(apps, schema_editor):
    """Set reorder_level to 5 for every product that still has the old default of 0."""
    Product = apps.get_model("catalog", "Product")
    Product._default_manager.using(schema_editor.connection.alias).filter(reorder_level=0).update(reorder_level=Decimal("5"))


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0008_increase_barcode_sku_length"),
    ]

    operations = [
        migrations.AlterField(
            model_name="product",
            name="reorder_level",
            field=models.DecimalField(decimal_places=2, default=5, max_digits=12),
        ),
        migrations.RunPython(set_reorder_level, migrations.RunPython.noop),
    ]
