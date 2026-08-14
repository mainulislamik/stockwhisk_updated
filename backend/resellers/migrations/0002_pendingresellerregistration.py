# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('resellers', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='PendingResellerRegistration',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('email', models.EmailField(max_length=254, unique=True)),
                ('password_hash', models.CharField(max_length=255)),
                ('full_name', models.CharField(max_length=150)),
                ('company_name', models.CharField(blank=True, max_length=180)),
                ('phone', models.CharField(blank=True, max_length=30)),
                ('address', models.TextField(blank=True)),
                ('country', models.CharField(blank=True, max_length=80)),
                ('otp', models.CharField(max_length=6)),
                ('expires_at', models.DateTimeField()),
            ],
            options={
                'abstract': False,
            },
        ),
    ]
