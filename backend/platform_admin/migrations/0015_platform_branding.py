from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("platform_admin", "0014_pricing_content"),
    ]

    operations = [
        migrations.AddField(
            model_name="platformconfig",
            name="logo",
            field=models.FileField(blank=True, null=True, upload_to="branding/"),
        ),
        migrations.AddField(
            model_name="platformconfig",
            name="favicon",
            field=models.FileField(blank=True, null=True, upload_to="branding/"),
        ),
    ]
