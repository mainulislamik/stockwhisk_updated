from django.db import migrations, models


class Migration(migrations.Migration):
    # Choices-only change (no schema change). Single-app dependency.
    dependencies = [
        ("tenants", "0014_shop_reseller"),
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
                    ("other", "Other"),
                ],
                default="general",
                max_length=20,
            ),
        ),
    ]
