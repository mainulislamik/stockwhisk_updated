from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0027_product_reserved_stock_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='size_chart',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='Garment measurements guide: {"unit":"inch","measurements":[{"size":"M","chest":40,"length":29}]}'
            ),
        ),
    ]
