import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0013_shop_is_demo"),
        ("resellers", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="shop",
            name="reseller",
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name="shops", to="resellers.resellerprofile",
            ),
        ),
        migrations.AddField(
            model_name="shop",
            name="reseller_attributed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
