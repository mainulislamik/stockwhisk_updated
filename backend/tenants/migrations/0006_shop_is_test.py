from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0005_subscription_reminded_days"),
    ]

    operations = [
        migrations.AddField(
            model_name="shop",
            name="is_test",
            field=models.BooleanField(default=False),
        ),
    ]
