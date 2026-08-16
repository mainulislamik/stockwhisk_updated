from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0011_pendingregistration_referral_code"),
    ]

    operations = [
        migrations.AddField(
            model_name="pendingregistration",
            name="free_grant_reseller",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
