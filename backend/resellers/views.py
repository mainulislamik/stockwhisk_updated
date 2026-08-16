from django.contrib.auth import authenticate, get_user_model
from django.db.models import Sum
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import ResellerCommission, ResellerProfile
from .permissions import IsReseller
from .serializers import (
    ResellerCommissionSerializer,
    ResellerProfileSerializer,
    ResellerRegisterSerializer,
    ResellerShopSummarySerializer,
)
from .services import resolve_active_reseller

User = get_user_model()


class InitiateResellerRegistrationView(APIView):
    """Public: receive reseller registration details, generate OTP, send email."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        ser = ResellerRegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        email = d["email"]

        import random
        from django.utils import timezone
        from datetime import timedelta
        otp = str(random.randint(100000, 999999))

        from django.contrib.auth.hashers import make_password
        hashed_password = make_password(d["password"])

        from .models import PendingResellerRegistration
        PendingResellerRegistration.objects.update_or_create(
            email=email,
            defaults={
                "password_hash": hashed_password,
                "full_name": d["full_name"],
                "company_name": d.get("company_name", ""),
                "phone": d.get("phone", ""),
                "address": d.get("address", ""),
                "country": d.get("country", ""),
                "otp": otp,
                "expires_at": timezone.now() + timedelta(minutes=3)
            }
        )

        from django.core.mail import get_connection, send_mail
        from django.conf import settings
        from platform_admin.models import PlatformConfig

        config = PlatformConfig.get_solo()
        connection = None
        from_email = settings.DEFAULT_FROM_EMAIL

        if config.smtp_host and config.smtp_user:
            connection = get_connection(
                backend='platform_admin.email_backend.UnverifiedSTARTTLSBackend',
                host=config.smtp_host,
                port=config.smtp_port,
                username=config.smtp_user,
                password=config.smtp_password,
                use_tls=config.smtp_use_tls,
            )
            from_email = config.smtp_default_from or settings.DEFAULT_FROM_EMAIL

        try:
            send_mail(
                subject="Your Reseller Verification Code",
                message=f"Welcome to the Reseller Program!\n\nYour verification code is: {otp}\n\nThis code expires in 3 minutes.",
                from_email=from_email,
                recipient_list=[email],
                fail_silently=False,
                connection=connection,
            )
        except Exception as e:
            import traceback
            return Response({
                "detail": "Failed to send email. Check SMTP configuration.",
                "error": str(e),
                "trace": traceback.format_exc()
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"detail": "OTP sent to email."}, status=status.HTTP_200_OK)


class VerifyResellerOTPRegistrationView(APIView):
    """Public: verify OTP and finalize PENDING reseller profile creation."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        from .serializers import VerifyResellerOTPRegistrationSerializer
        ser = VerifyResellerOTPRegistrationSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        email = ser.validated_data["email"]
        otp = ser.validated_data["otp"]

        from .models import PendingResellerRegistration
        from django.utils import timezone
        try:
            pending = PendingResellerRegistration.objects.get(email=email)
        except PendingResellerRegistration.DoesNotExist:
            return Response({"detail": "No pending registration found for this email."}, status=status.HTTP_404_NOT_FOUND)

        if pending.otp != otp:
            return Response({"detail": "Invalid OTP code."}, status=status.HTTP_400_BAD_REQUEST)

        if pending.expires_at < timezone.now():
            return Response({"detail": "OTP code has expired."}, status=status.HTTP_400_BAD_REQUEST)

        first, _, last = pending.full_name.partition(" ")
        user = User.objects.create_user(
            email=pending.email, password="will-be-overwritten",
            first_name=first, last_name=last, shop=None,
        )
        user.password = pending.password_hash
        user.save(update_fields=["password"])

        profile = ResellerProfile.objects.create(
            user=user, company_name=pending.company_name, phone=pending.phone,
            address=pending.address, country=pending.country,
            status=ResellerProfile.Status.PENDING,
        )

        pending.delete()

        return Response(
            {"detail": "Registration received — your reseller account is pending admin approval.",
             "reseller_code": profile.reseller_code},
            status=status.HTTP_201_CREATED,
        )


class ResellerValidateCodeView(APIView):
    """Public: validate a referral code during Shop Owner registration."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        reseller = resolve_active_reseller(request.query_params.get("code"))
        if reseller is None:
            return Response({"valid": False})
        return Response({"valid": True, "reseller": reseller.company_name or reseller.reseller_code})


class ResellerLoginView(APIView):
    """Public: reseller portal login. Blocks pending/suspended/rejected accounts."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password") or ""
        user = authenticate(request, username=email, password=password)
        if user is None:
            return Response({"detail": "Invalid email or password."}, status=status.HTTP_401_UNAUTHORIZED)
        profile = getattr(user, "reseller_profile", None)
        if profile is None:
            return Response({"detail": "This account is not a reseller account."}, status=status.HTTP_403_FORBIDDEN)
        if profile.status != ResellerProfile.Status.ACTIVE:
            msg = {
                ResellerProfile.Status.PENDING: "Your reseller account is pending admin approval.",
                ResellerProfile.Status.SUSPENDED: "Your reseller account has been suspended.",
                ResellerProfile.Status.REJECTED: "Your reseller application was rejected.",
            }.get(profile.status, "Account not active.")
            return Response({"detail": msg}, status=status.HTTP_403_FORBIDDEN)
        refresh = RefreshToken.for_user(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "profile": ResellerProfileSerializer(profile).data,
        })


# ── Authenticated reseller portal (read-only, own data only) ─────────────────
class ResellerDashboardView(APIView):
    permission_classes = [IsReseller]

    def get(self, request):
        profile = request.user.reseller_profile
        shops = list(profile.shops.all())
        trial = sum(1 for s in shops if getattr(s, "on_trial", False))
        suspended = sum(1 for s in shops if not getattr(s, "is_active", True))
        active = sum(1 for s in shops if getattr(s, "is_active", True) and not getattr(s, "on_trial", False))

        comm = ResellerCommission.objects.filter(reseller=profile)
        S = ResellerCommission.Status

        def _sum(qs):
            return qs.aggregate(t=Sum("commission_amount"))["t"] or 0

        return Response({
            "reseller_code": profile.reseller_code,
            "referral_code": profile.referral_code,
            "referral_link": profile.referral_link,
            "commission_rate": profile.commission_rate,
            "total_shops": len(shops),
            "active_shops": active,
            "trial_shops": trial,
            "suspended_shops": suspended,
            "total_commission": _sum(comm),
            "pending_commission": _sum(comm.filter(status__in=[S.PENDING, S.APPROVED])),
            "paid_commission": _sum(comm.filter(status=S.PAID)),
        })


class ResellerShopsView(APIView):
    permission_classes = [IsReseller]

    def get(self, request):
        shops = request.user.reseller_profile.shops.select_related("plan").all()
        return Response(ResellerShopSummarySerializer(shops, many=True).data)


class ResellerShopDetailView(APIView):
    permission_classes = [IsReseller]

    def get(self, request, pk):
        # IDOR-safe: only shops attributed to THIS reseller are visible.
        shop = request.user.reseller_profile.shops.filter(pk=pk).select_related("plan").first()
        if shop is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ResellerShopSummarySerializer(shop).data)


class ResellerCommissionsView(APIView):
    permission_classes = [IsReseller]

    def get(self, request):
        qs = ResellerCommission.objects.filter(reseller=request.user.reseller_profile)
        return Response(ResellerCommissionSerializer(qs, many=True).data)


class ResellerProfileView(APIView):
    permission_classes = [IsReseller]

    def get(self, request):
        return Response(ResellerProfileSerializer(request.user.reseller_profile).data)

    def patch(self, request):
        # read_only_fields on the serializer protect code/rate/status.
        ser = ResellerProfileSerializer(request.user.reseller_profile, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class ResellerFreeShopView(APIView):
    """Reseller signs up lifetime-free shops — only when a super admin has
    enabled it (can_grant_free_shops) and within the granted quota."""
    permission_classes = [IsReseller]

    def _list(self, profile):
        from tenants.models import Shop
        shops = Shop.objects.filter(reseller=profile, is_free=True).order_by("-created_at")
        owners = {
            u.shop_id: u.email
            for u in get_user_model().objects.filter(shop_id__in=[s.id for s in shops], role="owner")
        }
        used = len(shops)
        return {
            "enabled": profile.can_grant_free_shops,
            "quota": profile.free_shop_quota,
            "used": used,
            "remaining": max(0, profile.free_shop_quota - used),
            "shops": [{
                "id": s.id, "name": s.name, "code": s.shop_code,
                "owner_email": owners.get(s.id, ""),
                "is_active": s.is_active,
                "created_at": s.created_at,
            } for s in shops],
        }

    def get(self, request):
        return Response(self._list(request.user.reseller_profile))

    def post(self, request):
        profile = request.user.reseller_profile
        if not profile.can_grant_free_shops:
            return Response({"detail": "Free-shop grants are not enabled for your account."},
                            status=status.HTTP_403_FORBIDDEN)

        from tenants.models import Shop
        used = Shop.objects.filter(reseller=profile, is_free=True).count()
        if used >= profile.free_shop_quota:
            return Response({"detail": f"You have used all {profile.free_shop_quota} free-shop grant(s)."},
                            status=status.HTTP_400_BAD_REQUEST)

        d = request.data
        name = (d.get("shop_name") or "").strip()
        owner_email = (d.get("owner_email") or "").strip().lower()
        owner_password = d.get("owner_password") or ""
        owner_name = (d.get("owner_name") or "").strip()
        phone = (d.get("phone") or "").strip()

        if not name or not owner_email or not owner_password:
            return Response({"detail": "Shop name, owner email and password are required."},
                            status=status.HTTP_400_BAD_REQUEST)
        if len(owner_password) < 8:
            return Response({"detail": "Password must be at least 8 characters."},
                            status=status.HTTP_400_BAD_REQUEST)
        if get_user_model().objects.filter(email=owner_email).exists():
            return Response({"detail": "A user with this email already exists."},
                            status=status.HTTP_400_BAD_REQUEST)

        from tenants.services import register_shop
        try:
            shop, _owner = register_shop(
                name=name, owner_email=owner_email, owner_password=owner_password,
                owner_name=owner_name, phone=phone, reseller=profile,
            )
        except Exception as exc:
            return Response({"detail": f"Could not create shop: {exc}"},
                            status=status.HTTP_400_BAD_REQUEST)

        shop.is_free = True
        shop.save(update_fields=["is_free"])
        return Response(self._list(profile), status=status.HTTP_201_CREATED)
