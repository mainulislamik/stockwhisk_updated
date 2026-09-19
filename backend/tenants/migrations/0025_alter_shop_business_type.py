from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0024_shop_mobile_repair_master'),
    ]

    operations = [
        migrations.AlterField(
            model_name='shop',
            name='business_type',
            field=models.CharField(
                choices=[
                    ('fashion', 'Fashion & Apparel'),
                    ('beauty', 'Beauty & Cosmetics'),
                    ('jewelry', 'Jewelry & Accessories'),
                    ('home_decor', 'Home Decor & Furniture'),
                    ('food', 'Groceries & Organic Food'),
                    ('footwear', 'Footwear & Shoes'),
                    ('handcrafts', 'Handcrafts & Boutique'),
                    ('electronics', 'Electronics & Gadgets'),
                    ('computer', 'Computer & IT'),
                    ('mobile', 'Mobile & Accessories'),
                    ('general', 'General Retail'),
                    ('camical', 'Camical'),
                    ('supershop', 'Supershop'),
                    ('cosmetics', 'Chemical & Lab Supplies'),
                    ('printing', 'Printing, Media & Online Services'),
                    ('other', 'Other'),
                ],
                default='general',
                max_length=20,
            ),
        ),
    ]
