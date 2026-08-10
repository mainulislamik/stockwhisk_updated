# Generated manually to resolve missing migrations

from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_alter_pendingregistration_created_at'),
    ]

    operations = [
        migrations.CreateModel(
            name='PasswordResetOTP',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('email', models.EmailField(max_length=254, unique=True)),
                ('otp', models.CharField(max_length=6)),
                ('expires_at', models.DateTimeField()),
            ],
            options={
                'abstract': False,
            },
        ),
        migrations.AddField(
            model_name='pendingregistration',
            name='address',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='pendingregistration',
            name='business_type',
            field=models.CharField(default='general', max_length=20),
        ),
        migrations.AddField(
            model_name='pendingregistration',
            name='phone',
            field=models.CharField(blank=True, max_length=30),
        ),
    ]
