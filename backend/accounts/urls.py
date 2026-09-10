from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .rbac_api import MyPermissionsView, PermissionCatalogView, RoleViewSet, ShopUserViewSet
from .views import (
    MeView, InitiateRegistrationView, VerifyOTPRegistrationView, ShopSettingsView, TutorialsView,
    PublicTutorialsView, RequestPasswordResetOTPView, VerifyPasswordResetOTPView, DownloadBackupView
)

app_name = "accounts"


from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework.exceptions import AuthenticationFailed

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    default_error_messages = {
        'no_active_account': 'ব্যবহারকারীর নাম বা পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে আবার চেষ্টা করুন।'
    }

    def validate(self, attrs):
        try:
            return super().validate(attrs)
        except AuthenticationFailed:
            raise AuthenticationFailed(
                'ব্যবহারকারীর নাম বা পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে আবার চেষ্টা করুন।',
                code='no_active_account'
            )

class ThrottledTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


class ThrottledTokenRefreshView(TokenRefreshView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


router = DefaultRouter()
router.register("roles", RoleViewSet, basename="role")
router.register("users", ShopUserViewSet, basename="user")

urlpatterns = [
    path("auth/register/", InitiateRegistrationView.as_view(), name="register"),
    path("auth/verify-otp/", VerifyOTPRegistrationView.as_view(), name="verify-otp"),
    path("auth/password-reset/request-otp/", RequestPasswordResetOTPView.as_view(), name="password-reset-request-otp"),
    path("auth/password-reset/verify-otp/", VerifyPasswordResetOTPView.as_view(), name="password-reset-verify-otp"),
    path("auth/token/", ThrottledTokenObtainPairView.as_view(), name="token_obtain"),
    path("auth/token/refresh/", ThrottledTokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("auth/shop-settings/", ShopSettingsView.as_view(), name="shop-settings"),
    path("auth/my-permissions/", MyPermissionsView.as_view(), name="my-permissions"),
    path("rbac/permissions/", PermissionCatalogView.as_view(), name="permission-catalog"),
    path("tutorials/", TutorialsView.as_view(), name="tutorials"),
    path("public/tutorials/", PublicTutorialsView.as_view(), name="public-tutorials"),
    path("backup/download/", DownloadBackupView.as_view(), name="backup-download"),
] + router.urls
