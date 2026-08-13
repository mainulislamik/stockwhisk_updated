"""Backfill the new `view_products` read permission onto existing shops.

New permission separates product READ/BROWSE (POS grid, lists) from product
management. Newly-created shops get it via `seed_default_roles`; this migration
grants it to already-provisioned Cashier / Manager / Inventory Manager roles so
they keep (Cashier: gain) product-read access after the split.
"""
from django.db import migrations

CODE = "view_products"
ROLE_TYPES = ("cashier", "manager", "inventory_manager")


def add_view_products(apps, schema_editor):
    Permission = apps.get_model("accounts", "Permission")
    Role = apps.get_model("accounts", "Role")
    perm, _ = Permission.objects.get_or_create(
        code=CODE,
        defaults={"name": "View/browse products (POS & lists)", "category": "catalog"},
    )
    for role in Role.objects.filter(role_type__in=ROLE_TYPES):
        role.permissions.add(perm)


def remove_view_products(apps, schema_editor):
    Permission = apps.get_model("accounts", "Permission")
    Role = apps.get_model("accounts", "Role")
    perm = Permission.objects.filter(code=CODE).first()
    if perm:
        for role in Role.objects.filter(role_type__in=ROLE_TYPES):
            role.permissions.remove(perm)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0007_passwordresetotp_and_pending_registration"),
    ]

    operations = [
        migrations.RunPython(add_view_products, remove_view_products),
    ]
