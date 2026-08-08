# Generated manually

from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('platform_admin', '0002_tutorialvideo'),
    ]

    operations = [
        migrations.CreateModel(
            name='PlatformConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('drive_credentials_json', models.TextField(blank=True, default='')),
                ('drive_folder_id', models.CharField(blank=True, default='', max_length=255)),
            ],
            options={
                'verbose_name_plural': 'Platform Config',
            },
        ),
    ]
