from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("platform_admin", "0012_contact_smtp"),
    ]

    operations = [
        migrations.AddField(
            model_name="platformconfig",
            name="offer_file",
            field=models.FileField(blank=True, null=True, upload_to="offers/"),
        ),
        migrations.AddField(
            model_name="platformconfig",
            name="offer_enabled",
            field=models.BooleanField(default=False),
        ),
    ]
