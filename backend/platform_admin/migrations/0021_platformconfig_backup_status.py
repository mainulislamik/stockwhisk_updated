from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('platform_admin', '0020_shopdatabackup_shopdataoperation'),
    ]

    operations = [
        migrations.AddField(
            model_name='platformconfig',
            name='last_drive_backup_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='platformconfig',
            name='last_drive_backup_error',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='platformconfig',
            name='last_drive_backup_status',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
    ]
