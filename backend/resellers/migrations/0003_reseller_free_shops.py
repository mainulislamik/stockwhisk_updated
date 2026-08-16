from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("resellers", "0002_pendingresellerregistration"),
    ]

    operations = [
        migrations.AddField(
            model_name="resellerprofile",
            name="can_grant_free_shops",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="resellerprofile",
            name="free_shop_quota",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
