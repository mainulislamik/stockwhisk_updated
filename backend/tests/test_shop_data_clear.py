import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from django.urls import reverse

from tenants.models import Shop
from accounts.models import User, Role
from platform_admin.models import ShopDataBackup, ShopDataOperation
from platform_admin.tasks import clear_shop_data_task, restore_shop_data_task, cleanup_expired_shop_backups
from catalog.models import Category, Product
from sales.models import Sale

@pytest.fixture
def superadmin():
    u = User.objects.create_user("super@test.com", "password", is_superuser=True, is_staff=True)
    return u

@pytest.fixture
def shop_a():
    shop = Shop.objects.create(name="Shop A")
    # Identity data
    owner = User.objects.create_user("owner_a@test.com", "password", shop=shop)
    role = Role.objects.create(shop=shop, name="Owner")
    
    # Operational data
    cat = Category.objects.create(shop=shop, name="Cat A")
    prod = Product.objects.create(shop=shop, name="Prod A", category=cat)
    sale = Sale.objects.create(shop=shop, total=100)
    
    return shop, owner, prod

@pytest.fixture
def shop_b():
    shop = Shop.objects.create(name="Shop B")
    owner = User.objects.create_user("owner_b@test.com", "password", shop=shop)
    cat = Category.objects.create(shop=shop, name="Cat B")
    prod = Product.objects.create(shop=shop, name="Prod B", category=cat)
    return shop, owner, prod

@pytest.mark.django_db
def test_shop_data_clear_task(shop_a, shop_b, superadmin):
    sa, owner_a, prod_a = shop_a
    sb, owner_b, prod_b = shop_b
    
    assert Product.objects.filter(shop=sa).count() == 1
    assert Sale.objects.filter(shop=sa).count() == 1
    assert Product.objects.filter(shop=sb).count() == 1
    
    # Run the clear task
    result = clear_shop_data_task(sa.id, superadmin.id)
    assert result is True
    
    # Verify Shop A operational data is gone
    assert Product.objects.filter(shop=sa).count() == 0
    assert Sale.objects.filter(shop=sa).count() == 0
    
    # Verify Shop A identity data remains
    assert User.objects.filter(shop=sa).count() == 1
    
    # Verify Shop B data remains intact (tenant isolation)
    assert Product.objects.filter(shop=sb).count() == 1
    
    # Verify backup is created
    backup = ShopDataBackup.objects.get(shop=sa)
    assert backup.status == ShopDataBackup.Status.VERIFIED
    assert backup.records_count > 0

@pytest.mark.django_db
def test_shop_data_restore_task(shop_a, superadmin):
    sa, owner_a, prod_a = shop_a
    
    # 1. Clear data
    clear_shop_data_task(sa.id, superadmin.id)
    assert Product.objects.filter(shop=sa).count() == 0
    
    # 2. Add some new data (should be wiped on restore)
    cat = Category.objects.create(shop=sa, name="New Cat")
    Product.objects.create(shop=sa, name="New Prod", category=cat)
    
    # 3. Restore data
    backup = ShopDataBackup.objects.get(shop=sa)
    result = restore_shop_data_task(backup.id, superadmin.id)
    assert result is True
    
    # 4. Verify original data is back and new data is gone
    assert Product.objects.filter(shop=sa).count() == 1
    assert Product.objects.filter(shop=sa).first().name == "Prod A"
    assert Sale.objects.filter(shop=sa).count() == 1

@pytest.mark.django_db
def test_cleanup_expired_backups(shop_a, superadmin):
    sa, owner_a, prod_a = shop_a
    clear_shop_data_task(sa.id, superadmin.id)
    
    backup = ShopDataBackup.objects.get(shop=sa)
    # Fast forward expiration
    backup.expires_at = timezone.now() - timezone.timedelta(days=1)
    backup.save()
    
    cleanup_expired_shop_backups()
    
    backup.refresh_from_db()
    assert backup.status == ShopDataBackup.Status.DELETED
    assert not backup.backup_file
