from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('platform_admin', '0023_platformconfig_whatsapp_templates'),
    ]

    operations = [
        migrations.AddField(
            model_name='platformconfig',
            name='whatsapp_digest_time',
            field=models.CharField(default='22:00', help_text='Configurable daily WhatsApp dispatch time in HH:MM format (Asia/Dhaka).', max_length=10),
        ),
        migrations.AddField(
            model_name='platformconfig',
            name='whatsapp_digest_min_gap',
            field=models.PositiveIntegerField(default=12, help_text='Minimum humanized delay gap between shop messages (seconds).'),
        ),
        migrations.AddField(
            model_name='platformconfig',
            name='whatsapp_digest_max_gap',
            field=models.PositiveIntegerField(default=18, help_text='Maximum humanized delay gap between shop messages (seconds).'),
        ),
    ]
