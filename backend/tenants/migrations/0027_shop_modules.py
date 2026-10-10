from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0026_alter_shop_mobile_repair_enabled'),
    ]

    operations = [
        migrations.AddField(
            model_name='shop',
            name='modules',
            field=models.JSONField(blank=True, default=dict, help_text='Dynamic 24-module entitlement dictionary {module_key: boolean}'),
        ),
    ]
