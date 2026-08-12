from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0011_plan_yearly_discount"),
    ]

    operations = [
        migrations.AddField(
            model_name="shop",
            name="whatsapp_invoice_enabled",
            field=models.BooleanField(default=True),
        ),
    ]
