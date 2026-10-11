from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0005_shopwhatsappconfig_baileys_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='shopalertconfig',
            name='whatsapp_daily_digest_enabled',
            field=models.BooleanField(default=False, help_text='Modular toggle: Superadmin enabled WhatsApp daily executive briefing.'),
        ),
        migrations.AddField(
            model_name='shopalertconfig',
            name='whatsapp_digest_phone',
            field=models.CharField(blank=True, help_text='Custom WhatsApp recipient phone for daily reports. If empty, falls back to shop owner phone.', max_length=32),
        ),
    ]
