from django.urls import path
from .views import ShopModulesView, ShopInvoiceSettingsView

urlpatterns = [
    path("modules/", ShopModulesView.as_view(), name="shop-modules"),
    path("invoice-settings/", ShopInvoiceSettingsView.as_view(), name="shop-invoice-settings"),
]
