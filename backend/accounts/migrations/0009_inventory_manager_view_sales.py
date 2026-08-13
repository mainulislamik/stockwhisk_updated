"""Grant the (already-existing) `view_sales` read permission to existing
Inventory Manager roles.

Sales viewing is now gated by `view_sales` (read) instead of `create_sale`.
Manager / Cashier / Accountant were already seeded with `view_sales`; only the
Inventory Manager default gained it, so backfill that role on existing shops.
"""
from django.db import migrations

CODE = "view_sales"
ROLE_TYPE = "inventory_manager"


def add_view_sales(apps, schema_editor):
    Permission = apps.get_model("accounts", "Permission")
    Role = apps.get_model("accounts", "Role")
    perm = Permission.objects.filter(code=CODE).first()
    if perm is None:
        perm = Permission.objects.create(code=CODE, name="View sales", category="sales")
    for role in Role.objects.filter(role_type=ROLE_TYPE):
        role.permissions.add(perm)


def remove_view_sales(apps, schema_editor):
    Permission = apps.get_model("accounts", "Permission")
    Role = apps.get_model("accounts", "Role")
    perm = Permission.objects.filter(code=CODE).first()
    if perm:
        for role in Role.objects.filter(role_type=ROLE_TYPE):
            role.permissions.remove(perm)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0008_view_products_permission"),
    ]

    operations = [
        migrations.RunPython(add_view_sales, remove_view_sales),
    ]
