from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0018_shop_pos_print_mode'),
    ]

    operations = [
        migrations.AddField(
            model_name='shop',
            name='service_enabled',
            field=models.BooleanField(default=True, help_text='Enable/disable Service section (Tickets, Warranties)'),
        ),
        migrations.AddField(
            model_name='shop',
            name='reports_enabled',
            field=models.BooleanField(default=True, help_text='Enable/disable Reports section'),
        ),
        migrations.AddField(
            model_name='shop',
            name='finance_enabled',
            field=models.BooleanField(default=True, help_text='Enable/disable Finance section (Expenses, Accounting)'),
        ),
    ]
