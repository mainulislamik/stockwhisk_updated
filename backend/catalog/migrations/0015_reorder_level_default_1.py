"""Default reorder level is 1 (was 5).

Default-only change (no DB schema/data change); keeps the migration state in
sync with the model so makemigrations stays clean.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0014_reorder_level_integer"),
    ]

    operations = [
        migrations.AlterField(
            model_name="product",
            name="reorder_level",
            field=models.PositiveIntegerField(default=1),
        ),
    ]
