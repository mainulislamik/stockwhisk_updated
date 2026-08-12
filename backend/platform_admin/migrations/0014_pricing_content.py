from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("platform_admin", "0013_promo_offer"),
    ]

    operations = [
        migrations.AddField(
            model_name="platformconfig",
            name="pricing_content",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
