"""Revert the reorder-level default back to 5.

Default-only change (no DB schema/data change).
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0015_reorder_level_default_1"),
    ]

    operations = [
        migrations.AlterField(
            model_name="product",
            name="reorder_level",
            field=models.PositiveIntegerField(default=5),
        ),
    ]
