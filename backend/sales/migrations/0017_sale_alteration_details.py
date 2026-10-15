from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '0016_sale_custom_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='sale',
            name='alteration_due_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='sale',
            name='tailor_name',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='sale',
            name='alteration_charge',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
    ]
