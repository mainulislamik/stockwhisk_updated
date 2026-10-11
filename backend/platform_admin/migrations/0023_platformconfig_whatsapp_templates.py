from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('platform_admin', '0022_alter_tutorialvideo_target_audience'),
    ]

    operations = [
        migrations.AddField(
            model_name='platformconfig',
            name='whatsapp_templates',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
