"""Add the modern-blog fields to BlogPost.

These fields exist on the model (added for the redesigned blog UI) but had no
migration, so the DB lacked the columns — any BlogPost query would fail.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("platform_admin", "0016_industry_images"),
    ]

    operations = [
        migrations.AddField(
            model_name="blogpost",
            name="category",
            field=models.CharField(blank=True, help_text="e.g., 'inv', 'pos', 'retail', 'smallbiz', 'stockwhisk'", max_length=100),
        ),
        migrations.AddField(
            model_name="blogpost",
            name="author_name",
            field=models.CharField(blank=True, default="StockWhisk Team", max_length=100),
        ),
        migrations.AddField(
            model_name="blogpost",
            name="author_role",
            field=models.CharField(blank=True, default="Editorial Team", max_length=100),
        ),
        migrations.AddField(
            model_name="blogpost",
            name="author_avatar_url",
            field=models.URLField(blank=True, help_text="Optional URL for author avatar"),
        ),
        migrations.AddField(
            model_name="blogpost",
            name="read_time_minutes",
            field=models.PositiveIntegerField(default=5),
        ),
        migrations.AddField(
            model_name="blogpost",
            name="is_featured",
            field=models.BooleanField(db_index=True, default=False),
        ),
    ]
