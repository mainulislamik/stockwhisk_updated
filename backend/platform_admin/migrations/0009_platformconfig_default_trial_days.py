from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("platform_admin", "0008_rename_platform_ad_is_publ_5cece9_idx_platform_ad_is_publ_0ff934_idx"),
    ]

    operations = [
        migrations.AddField(
            model_name="platformconfig",
            name="default_trial_days",
            field=models.PositiveIntegerField(default=45),
        ),
    ]
