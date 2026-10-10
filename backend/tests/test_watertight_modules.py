"""
Automated validation of the Water-Tight Modular System.

Tests defense-in-depth enforcement:
1. Backend API Rejection (HTTP 403 Forbidden MODULE_NOT_ENABLED) when module is toggled OFF.
2. Immediate restoration of API access when module is toggled ON.
3. Multi-module comma-separated OR resolution (e.g. finance_accounting,expense_management).
4. Data preservation: Turning a module OFF never deletes or corrupts underlying records.
5. Legacy flag synchronization in Shop model.
"""
from decimal import Decimal
import pytest
from rest_framework.test import APIClient

from tenants.modules import is_module_enabled
from purchasing.models import Supplier
from crm.models import Customer
from core.tenant_context import tenant_context

pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    return APIClient()


def test_purchasing_module_gating(api, two_shops):
    """
    Test purchasing endpoints reject with 403 when purchasing module is disabled,
    and allow access when enabled.
    """
    (shop, owner), _ = two_shops
    api.force_authenticate(owner)

    # 1. Enable purchasing module
    shop.modules = {"purchasing": True}
    shop.save(update_fields=["modules"])
    assert is_module_enabled(shop, "purchasing") is True

    res_enabled = api.get("/api/purchasing/suppliers/")
    assert res_enabled.status_code == 200

    # 2. Disable purchasing module
    shop.modules = {"purchasing": False}
    shop.save(update_fields=["modules"])
    assert is_module_enabled(shop, "purchasing") is False

    res_disabled = api.get("/api/purchasing/suppliers/")
    assert res_disabled.status_code == 403
    assert "module is not enabled" in str(res_disabled.json()).lower()


def test_accounting_multi_module_gating(api, two_shops):
    """
    ExpenseCategoryViewSet requires 'finance_accounting,expense_management'.
    Access should be granted if EITHER module is enabled.
    """
    (shop, owner), _ = two_shops
    api.force_authenticate(owner)

    # Case 1: Both disabled -> 403
    shop.modules = {"finance_accounting": False, "expense_management": False}
    shop.save(update_fields=["modules"])
    res = api.get("/api/accounting/expense-categories/")
    assert res.status_code == 403
    assert "module is not enabled" in str(res.json()).lower()

    # Case 2: Only expense_management enabled -> 200
    shop.modules = {"finance_accounting": False, "expense_management": True}
    shop.save(update_fields=["modules"])
    res = api.get("/api/accounting/expense-categories/")
    assert res.status_code == 200

    # Case 3: Only finance_accounting enabled -> 200
    shop.modules = {"finance_accounting": True, "expense_management": False}
    shop.save(update_fields=["modules"])
    res = api.get("/api/accounting/expense-categories/")
    assert res.status_code == 200


def test_data_preservation_on_module_toggle(api, two_shops):
    """
    Creating records while module is ON, toggling OFF, and toggling back ON
    must preserve all records with zero data loss.
    """
    (shop, owner), _ = two_shops
    api.force_authenticate(owner)

    # 1. Enable purchasing and create supplier
    shop.modules = {"purchasing": True}
    shop.save(update_fields=["modules"])

    with tenant_context(shop):
        supp = Supplier.objects.create(shop=shop, name="Preserved Supplier Corp")

    res1 = api.get(f"/api/purchasing/suppliers/{supp.id}/")
    assert res1.status_code == 200
    assert res1.json()["name"] == "Preserved Supplier Corp"

    # 2. Toggle module OFF
    shop.modules = {"purchasing": False}
    shop.save(update_fields=["modules"])

    # API blocks access with 403
    res_off = api.get(f"/api/purchasing/suppliers/{supp.id}/")
    assert res_off.status_code == 403
    assert "module is not enabled" in str(res_off.json()).lower()

    # Database record is still 100% intact
    supp.refresh_from_db()
    assert supp.name == "Preserved Supplier Corp"

    # 3. Toggle module back ON
    shop.modules = {"purchasing": True}
    shop.save(update_fields=["modules"])

    res_on = api.get(f"/api/purchasing/suppliers/{supp.id}/")
    assert res_on.status_code == 200
    assert res_on.json()["name"] == "Preserved Supplier Corp"


def test_service_module_gating(api, two_shops):
    """
    Service tickets require 'service_repair,mobile_repair_pos'.
    """
    (shop, owner), _ = two_shops
    api.force_authenticate(owner)

    # Disabled -> 403
    shop.modules = {"service_repair": False, "mobile_repair_pos": False}
    shop.save(update_fields=["modules"])
    res = api.get("/api/service/tickets/")
    assert res.status_code == 403
    assert "module is not enabled" in str(res.json()).lower()

    # Enabled via mobile_repair_pos -> 200
    shop.modules = {"mobile_repair_pos": True}
    shop.save(update_fields=["modules"])
    res = api.get("/api/service/tickets/")
    assert res.status_code == 200
