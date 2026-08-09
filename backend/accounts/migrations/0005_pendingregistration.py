# Generated manually
from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_user_last_seen'),
    ]

    operations = [
        migrations.CreateModel(
            name='PendingRegistration',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('email', models.EmailField(max_length=254, unique=True)),
                ('password_hash', models.CharField(max_length=255)),
                ('shop_name', models.CharField(max_length=150)),
                ('owner_name', models.CharField(max_length=150)),
                ('otp', models.CharField(max_length=6)),
                ('expires_at', models.DateTimeField()),
            ],
            options={
                'abstract': False,
            },
        ),
    ]
