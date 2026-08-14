import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    # Depends only on the migration that created these models — the change is a
    # Python-level related_name ('+' → '%(class)ss'), no schema/cross-app change.
    dependencies = [
        ("sales", "0008_emischedule_emiinstallment"),
    ]

    operations = [
        migrations.AlterField(
            model_name="emiinstallment",
            name="shop",
            field=models.ForeignKey(
                db_index=True, editable=False,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="emiinstallments", to="tenants.shop",
            ),
        ),
        migrations.AlterField(
            model_name="emischedule",
            name="shop",
            field=models.ForeignKey(
                db_index=True, editable=False,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="emischedules", to="tenants.shop",
            ),
        ),
    ]
