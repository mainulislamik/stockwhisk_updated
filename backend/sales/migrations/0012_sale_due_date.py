# Generated manually

from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('sales', '0011_clean_previous_quotations'),
    ]

    operations = [
        migrations.AddField(
            model_name='sale',
            name='due_date',
            field=models.DateField(blank=True, help_text='Promised payment date for due balance', null=True),
        ),
    ]
