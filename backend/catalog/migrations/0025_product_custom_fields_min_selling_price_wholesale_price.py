# Generated manually for custom_fields, wholesale_price, min_selling_price on Product
import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0024_productimage_updated_at_alter_productimage_shop'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='wholesale_price',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Wholesale bulk rate',
                max_digits=12,
                null=True,
                validators=[django.core.validators.MinValueValidator(0)]
            ),
        ),
        migrations.AddField(
            model_name='product',
            name='min_selling_price',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Minimum floor price cashiers cannot discount below',
                max_digits=12,
                null=True,
                validators=[django.core.validators.MinValueValidator(0)]
            ),
        ),
        migrations.AddField(
            model_name='product',
            name='custom_fields',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='Dynamic metadata e.g. color, size, imei, warranty, location'
            ),
        ),
    ]
