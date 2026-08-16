# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('platform_admin', '0017_blogpost_modern_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='tutorialvideo',
            name='target_audience',
            field=models.CharField(choices=[('both', 'Both'), ('shop', 'Shop Only'), ('reseller', 'Reseller Only')], default='both', help_text='Who should see this tutorial?', max_length=15),
        ),
    ]
