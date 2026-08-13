from decimal import Decimal

import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tenants", "0013_shop_is_demo"),
    ]

    operations = [
        migrations.CreateModel(
            name="ResellerProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("reseller_code", models.CharField(blank=True, editable=False, max_length=20, unique=True)),
                ("referral_code", models.CharField(db_index=True, editable=False, max_length=20, unique=True)),
                ("company_name", models.CharField(blank=True, max_length=180)),
                ("phone", models.CharField(blank=True, max_length=30)),
                ("address", models.TextField(blank=True)),
                ("country", models.CharField(blank=True, max_length=80)),
                ("commission_rate", models.DecimalField(decimal_places=2, default=Decimal("10.00"), max_digits=5, validators=[django.core.validators.MinValueValidator(Decimal("0")), django.core.validators.MaxValueValidator(Decimal("100.00"))])),
                ("status", models.CharField(choices=[("pending", "Pending"), ("active", "Active"), ("suspended", "Suspended"), ("rejected", "Rejected")], default="pending", max_length=15)),
                ("approved_at", models.DateTimeField(blank=True, null=True)),
                ("notes", models.TextField(blank=True)),
                ("approved_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL)),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="reseller_profile", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddIndex(
            model_name="resellerprofile",
            index=models.Index(fields=["status"], name="resellers_r_status_idx"),
        ),
        migrations.CreateModel(
            name="ResellerCommission",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("shop_name", models.CharField(blank=True, max_length=150)),
                ("period_year", models.PositiveIntegerField()),
                ("period_month", models.PositiveSmallIntegerField()),
                ("gross_profit", models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ("commission_rate", models.DecimalField(decimal_places=2, max_digits=5)),
                ("commission_amount", models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("approved", "Approved"), ("paid", "Paid"), ("cancelled", "Cancelled")], default="pending", max_length=15)),
                ("approved_at", models.DateTimeField(blank=True, null=True)),
                ("paid_at", models.DateTimeField(blank=True, null=True)),
                ("payment_reference", models.CharField(blank=True, max_length=120)),
                ("notes", models.TextField(blank=True)),
                ("reseller", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="commissions", to="resellers.resellerprofile")),
                ("shop", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="reseller_commissions", to="tenants.shop")),
            ],
            options={"ordering": ["-period_year", "-period_month", "-id"]},
        ),
        migrations.AddIndex(
            model_name="resellercommission",
            index=models.Index(fields=["reseller", "status"], name="resellers_r_res_status_idx"),
        ),
        migrations.AddIndex(
            model_name="resellercommission",
            index=models.Index(fields=["period_year", "period_month"], name="resellers_r_period_idx"),
        ),
        migrations.AddConstraint(
            model_name="resellercommission",
            constraint=models.UniqueConstraint(fields=["reseller", "shop", "period_year", "period_month"], name="uniq_reseller_commission_period"),
        ),
    ]
