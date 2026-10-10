from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0004_shopalertconfig_daily_report_enabled_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='shopwhatsappconfig',
            name='session_id',
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name='shopwhatsappconfig',
            name='is_connected',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='shopwhatsappconfig',
            name='connected_phone',
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AddField(
            model_name='shopwhatsappconfig',
            name='connected_name',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='shopwhatsappconfig',
            name='default_mode',
            field=models.CharField(choices=[('direct', '1-Tap Direct Send'), ('browser', 'WhatsApp Web Browser')], default='direct', max_length=20),
        ),
        migrations.AddField(
            model_name='shopwhatsappconfig',
            name='auto_send_pos',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='shopwhatsappconfig',
            name='last_connected_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
