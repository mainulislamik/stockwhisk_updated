from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0021_product_care_instructions_product_collection_name_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="unit",
            name="measure_type",
            field=models.CharField(
                choices=[
                    ("count", "Piece / Count"),
                    ("weight", "Weight (kg, g)"),
                    ("volume", "Volume (L, ml)"),
                    ("length", "Length (Goj, Meter)"),
                ],
                default="count",
                max_length=10,
            ),
        ),
    ]
