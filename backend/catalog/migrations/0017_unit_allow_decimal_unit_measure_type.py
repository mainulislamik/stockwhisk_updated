"""Add measure_type and allow_decimal to unit.

Generated from catalog model changes:
  + Add field allow_decimal to unit
  + Add field measure_type to unit
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0016_reorder_level_default_5"),
    ]

    operations = [
        migrations.AddField(
            model_name="unit",
            name="allow_decimal",
            field=models.BooleanField(
                default=False,
                help_text="Allow decimal quantities in POS, e.g. 2.5 kg",
            ),
        ),
        migrations.AddField(
            model_name="unit",
            name="measure_type",
            field=models.CharField(
                choices=[
                    ("count", "Piece / Count"),
                    ("weight", "Weight (kg, g)"),
                    ("volume", "Volume (L, ml)"),
                ],
                default="count",
                max_length=10,
            ),
        ),
    ]
