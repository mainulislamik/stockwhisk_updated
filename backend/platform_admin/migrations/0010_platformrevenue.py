import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("platform_admin", "0009_platformconfig_default_trial_days"),
        ("tenants", "0006_shop_is_test"),
    ]

    operations = [
        migrations.CreateModel(
            name="PlatformRevenue",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("shop_name", models.CharField(blank=True, max_length=150)),
                ("shop_code", models.CharField(blank=True, max_length=20)),
                ("plan_tier", models.CharField(blank=True, max_length=30)),
                ("invoice_number", models.CharField(blank=True, max_length=40)),
                ("amount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("cycle", models.CharField(default="monthly", max_length=10)),
                ("period_start", models.DateField(blank=True, null=True)),
                ("period_end", models.DateField(blank=True, null=True)),
                ("is_test", models.BooleanField(default=False)),
                ("occurred_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("shop", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="tenants.shop")),
            ],
            options={
                "ordering": ["-occurred_at"],
                "indexes": [
                    models.Index(fields=["occurred_at"], name="platform_ad_occurre_idx"),
                    models.Index(fields=["is_test"], name="platform_ad_is_test_idx"),
                ],
            },
        ),
    ]
