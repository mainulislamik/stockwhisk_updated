"""Grant read-only permissions the Accountant role needs for accounting work.

- new `view_customers` (customers & dues read; management stays manage_customers)
- `view_products` (product/item lookup; already existed for other roles)

Backfills existing Accountant roles so they can view customers/dues and product
information without gaining create/manage privileges.
"""
from django.db import migrations

ACCOUNTANT_READ_CODES = {
    "view_customers": ("View customers & dues", "crm"),
    "view_products": ("View/browse products (POS & lists)", "catalog"),
}


def add_accountant_reads(apps, schema_editor):
    Permission = apps.get_model("accounts", "Permission")
    Role = apps.get_model("accounts", "Role")
    perms = []
    for code, (name, category) in ACCOUNTANT_READ_CODES.items():
        perm, _ = Permission.objects.get_or_create(
            code=code, defaults={"name": name, "category": category})
        perms.append(perm)
    for role in Role.objects.filter(role_type="accountant"):
        role.permissions.add(*perms)


def remove_accountant_reads(apps, schema_editor):
    Permission = apps.get_model("accounts", "Permission")
    Role = apps.get_model("accounts", "Role")
    # Only remove view_customers (introduced here); view_products may be legit
    # for the role independently, so leave it on reverse.
    perm = Permission.objects.filter(code="view_customers").first()
    if perm:
        for role in Role.objects.filter(role_type="accountant"):
            role.permissions.remove(perm)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0009_inventory_manager_view_sales"),
    ]

    operations = [
        migrations.RunPython(add_accountant_reads, remove_accountant_reads),
    ]
