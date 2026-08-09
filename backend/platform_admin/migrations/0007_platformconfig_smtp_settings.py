# Generated manually
from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('platform_admin', '0006_blogpost'),
    ]

    operations = [
        migrations.AddField(
            model_name='platformconfig',
            name='smtp_default_from',
            field=models.CharField(blank=True, default='noreply@stockwhisk.com', max_length=255),
        ),
        migrations.AddField(
            model_name='platformconfig',
            name='smtp_host',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='platformconfig',
            name='smtp_password',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='platformconfig',
            name='smtp_port',
            field=models.PositiveIntegerField(default=587),
        ),
        migrations.AddField(
            model_name='platformconfig',
            name='smtp_use_tls',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='platformconfig',
            name='smtp_user',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
    ]
