from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('purchasing', '0010_alter_purchasepayment_method'),
    ]

    operations = [
        migrations.AddField(
            model_name='supplier',
            name='due_date',
            field=models.DateField(blank=True, help_text='Promised payment date for supplier due', null=True),
        ),
    ]
