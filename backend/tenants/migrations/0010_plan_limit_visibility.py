from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0009_subscriptionplan_highlights"),
    ]

    operations = [
        migrations.AddField(
            model_name="subscriptionplan",
            name="show_users",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="subscriptionplan",
            name="show_branches",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="subscriptionplan",
            name="show_products",
            field=models.BooleanField(default=True),
        ),
    ]
