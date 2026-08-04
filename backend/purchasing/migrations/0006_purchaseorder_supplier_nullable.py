from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("purchasing", "0005_supplierpayment_supplier_payment_amount_positive"),
    ]

    operations = [
        migrations.AlterField(
            model_name="purchaseorder",
            name="supplier",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="purchase_orders",
                to="purchasing.supplier",
            ),
        ),
    ]
