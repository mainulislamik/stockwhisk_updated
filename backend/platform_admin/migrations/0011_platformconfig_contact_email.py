from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("platform_admin", "0010_platformrevenue"),
    ]

    operations = [
        migrations.AddField(
            model_name="platformconfig",
            name="contact_email",
            field=models.EmailField(blank=True, default="contact@stockwhisk.com", max_length=255),
        ),
    ]
