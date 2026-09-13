# Owner switch for Mobile Repair module

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0023_shop_mobile_repair_enabled'),
    ]

    operations = [
        migrations.AddField(
            model_name='shop',
            name='mobile_repair_master_enabled',
            field=models.BooleanField(default=False, help_text='Superadmin-controlled master license for the Mobile Repair Shop module'),
        ),
        # Existing shops where superadmin had already enabled the module (shop 23):
        # copy current license state to master field so nothing regresses.
        migrations.RunSQL(
            sql="UPDATE tenants_shop SET mobile_repair_master_enabled = mobile_repair_enabled;",
            reverse_sql="UPDATE tenants_shop SET mobile_repair_master_enabled = false;",
        ),
    ]
