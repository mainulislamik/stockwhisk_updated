from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("platform_admin", "0015_platform_branding"),
    ]

    operations = [
        migrations.AddField(
            model_name="platformconfig",
            name="industry_images",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
