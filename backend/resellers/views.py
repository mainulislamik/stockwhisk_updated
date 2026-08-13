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


# ── Public ──────────────────────────────────────────────────────────────────
class ResellerRegisterView(APIView):
    """Public: create a PENDING reseller (User with shop=None + profile). No login."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        ser = ResellerRegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        first, _, last = d["full_name"].partition(" ")
        user = User.objects.create_user(
            email=d["email"], password=d["password"],
            first_name=first, last_name=last, shop=None,
        )
        profile = ResellerProfile.objects.create(
            user=user, company_name=d.get("company_name", ""), phone=d.get("phone", ""),
            address=d.get("address", ""), country=d.get("country", ""),
            status=ResellerProfile.Status.PENDING,
        )
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
