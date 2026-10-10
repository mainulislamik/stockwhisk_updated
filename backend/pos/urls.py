from django.urls import path

from .views import BarcodeLookupView, CheckoutView, CatalogCacheView, OfflineSyncView

urlpatterns = [
    path("lookup/", BarcodeLookupView.as_view(), name="pos-lookup"),
    path("checkout/", CheckoutView.as_view(), name="pos-checkout"),
    path("catalog-cache/", CatalogCacheView.as_view(), name="pos-catalog-cache"),
    path("offline-sync/", OfflineSyncView.as_view(), name="pos-offline-sync"),
]
