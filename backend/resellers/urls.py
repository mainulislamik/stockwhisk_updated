from django.urls import path

from .views import (
    ResellerCommissionsView,
    ResellerDashboardView,
    ResellerLoginView,
    ResellerProfileView,
    ResellerRegisterView,
    ResellerShopDetailView,
    ResellerShopsView,
    ResellerValidateCodeView,
)

urlpatterns = [
    # Public
    path("register/", ResellerRegisterView.as_view(), name="reseller-register"),
    path("login/", ResellerLoginView.as_view(), name="reseller-login"),
    path("validate-code/", ResellerValidateCodeView.as_view(), name="reseller-validate-code"),
    # Authenticated reseller portal (read-only)
    path("dashboard/", ResellerDashboardView.as_view(), name="reseller-dashboard"),
    path("shops/", ResellerShopsView.as_view(), name="reseller-shops"),
    path("shops/<int:pk>/", ResellerShopDetailView.as_view(), name="reseller-shop-detail"),
    path("commissions/", ResellerCommissionsView.as_view(), name="reseller-commissions"),
    path("profile/", ResellerProfileView.as_view(), name="reseller-profile"),
]
