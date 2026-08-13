from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0010_accountant_read_permissions"),
    ]

    operations = [
        migrations.AddField(
            model_name="pendingregistration",
            name="referral_code",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
    ]
