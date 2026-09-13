from django.db import migrations, models
import secrets

def gen_tokens(apps, schema_editor):
    ServiceTicket = apps.get_model('service', 'ServiceTicket')
    for t in ServiceTicket.objects.all():
        if not t.track_token:
            t.track_token = secrets.token_urlsafe(20)
            t.save(update_fields=['track_token'])

class Migration(migrations.Migration):
    dependencies = [
        ('service', '0009_link_service_customers'),
    ]

    operations = [
        migrations.AddField(
            model_name='serviceticket',
            name='track_token',
            field=models.CharField(blank=True, db_index=True, max_length=64, null=True, unique=True),
        ),
        migrations.RunPython(gen_tokens, reverse_code=migrations.RunPython.noop),
    ]
