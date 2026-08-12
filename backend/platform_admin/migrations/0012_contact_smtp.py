from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("platform_admin", "0011_platformconfig_contact_email"),
    ]

    operations = [
        migrations.AddField(
            model_name="platformconfig",
            name="contact_smtp_user",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="platformconfig",
            name="contact_smtp_password",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]
