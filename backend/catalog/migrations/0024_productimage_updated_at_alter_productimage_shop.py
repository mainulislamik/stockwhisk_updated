import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0001_initial"),
        ("catalog", "0023_product_image_and_productimage"),
    ]

    operations = [
        migrations.AddField(
            model_name="productimage",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AlterField(
            model_name="productimage",
            name="shop",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="%(app_label)s_%(class)s_set",
                to="tenants.shop",
            ),
        ),
    ]
