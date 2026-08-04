from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0007_productunit_warranty_months'),
    ]

    operations = [
        migrations.AlterField(
            model_name='product',
            name='barcode',
            field=models.CharField(blank=True, db_index=True, max_length=120),
        ),
        migrations.AlterField(
            model_name='product',
            name='sku',
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AlterField(
            model_name='productunit',
            name='barcode',
            field=models.CharField(db_index=True, max_length=120),
        ),
        migrations.AlterField(
            model_name='productvariation',
            name='barcode',
            field=models.CharField(blank=True, db_index=True, max_length=120),
        ),
        migrations.AlterField(
            model_name='productvariation',
            name='sku',
            field=models.CharField(blank=True, max_length=120),
        ),
    ]
