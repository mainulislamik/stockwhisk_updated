"""Alter business_type on shop to include CAMICAL.

Generated from tenants model changes:
  ~ Alter field business_type on shop
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0019_shop_section_toggles"),
    ]

    operations = [
        migrations.AlterField(
            model_name="shop",
            name="business_type",
            field=models.CharField(
                choices=[
                    ("fashion", "Fashion & Apparel"),
                    ("beauty", "Beauty & Cosmetics"),
                    ("jewelry", "Jewelry & Accessories"),
                    ("home_decor", "Home Decor & Furniture"),
                    ("food", "Groceries & Organic Food"),
                    ("footwear", "Footwear & Shoes"),
                    ("handcrafts", "Handcrafts & Boutique"),
                    ("electronics", "Electronics & Gadgets"),
                    ("computer", "Computer & IT"),
                    ("mobile", "Mobile & Accessories"),
                    ("general", "General Retail"),
                    ("camical", "Chemical & Lab Supplies"),
                    ("other", "Other"),
                ],
                default="general",
                max_length=20,
            ),
        ),
    ]
