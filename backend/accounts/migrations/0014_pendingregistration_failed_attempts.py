from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0013_passwordresetotp_failed_attempts'),
    ]

    operations = [
        migrations.AddField(
            model_name='pendingregistration',
            name='failed_attempts',
            field=models.PositiveSmallIntegerField(default=0),
        ),
    ]
