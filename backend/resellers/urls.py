from django.urls import path

from .views import (
    ResellerCommissionsView,
    ResellerDashboardView,
    ResellerFreeShopView,
    ResellerFreeShopInitiateView,
    ResellerFreeShopVerifyView,
    ResellerLoginView,
    ResellerProfileView,
    InitiateResellerRegistrationView,
    VerifyResellerOTPRegistrationView,
    ResellerShopDetailView,
    ResellerShopsView,
    ResellerValidateCodeView,
)

urlpatterns = [
    # Public
    path("register/", InitiateResellerRegistrationView.as_view(), name="reseller-register"),
    path("verify-otp/", VerifyResellerOTPRegistrationView.as_view(), name="reseller-verify-otp"),
    path("login/", ResellerLoginView.as_view(), name="reseller-login"),
    path("validate-code/", ResellerValidateCodeView.as_view(), name="reseller-validate-code"),
    # Authenticated reseller portal (read-only)
    path("dashboard/", ResellerDashboardView.as_view(), name="reseller-dashboard"),
    path("shops/", ResellerShopsView.as_view(), name="reseller-shops"),
    path("shops/<int:pk>/", ResellerShopDetailView.as_view(), name="reseller-shop-detail"),
    path("commissions/", ResellerCommissionsView.as_view(), name="reseller-commissions"),
    path("profile/", ResellerProfileView.as_view(), name="reseller-profile"),
    path("free-shops/", ResellerFreeShopView.as_view(), name="reseller-free-shops"),
    path("free-shops/initiate/", ResellerFreeShopInitiateView.as_view(), name="reseller-free-shops-initiate"),
    path("free-shops/verify/", ResellerFreeShopVerifyView.as_view(), name="reseller-free-shops-verify"),
]
