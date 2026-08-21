from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0012_pendingregistration_free_grant_reseller'),
    ]

    operations = [
        migrations.AddField(
            model_name='passwordresetotp',
            name='failed_attempts',
            field=models.PositiveSmallIntegerField(default=0),
        ),
    ]
