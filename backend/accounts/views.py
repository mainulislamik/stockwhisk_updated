from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from tenants.services import register_shop

from .serializers import ShopRegistrationSerializer, UserSerializer


class RegisterShopView(APIView):
    """Public endpoint: create a shop + owner and return JWT tokens."""

    permission_classes = [AllowAny]

    def post(self, request):
        ser = ShopRegistrationSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        shop, owner = register_shop(
            name=data["shop_name"],
            owner_email=data["owner_email"],
            owner_password=data["owner_password"],
            owner_name=data.get("owner_name", ""),
            business_type=data["business_type"],
            phone=data.get("phone", ""),
        )
        refresh = RefreshToken.for_user(owner)
        return Response(
            {
                "shop": {"id": shop.id, "name": shop.name, "slug": shop.slug},
                "user": UserSerializer(owner).data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )


class MeView(APIView):
    """Return and update the authenticated user's profile."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        ser = UserSerializer(request.user, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class ShopSettingsView(APIView):
    """Return and update the current user's shop settings (owner only for updates)."""

    permission_classes = [IsAuthenticated]
    from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        if not request.user.shop:
            return Response({"detail": "No shop associated."}, status=400)
        from .serializers import ShopSettingsSerializer
        return Response(ShopSettingsSerializer(request.user.shop).data)

    def patch(self, request):
        if not request.user.shop:
            return Response({"detail": "No shop associated."}, status=400)
        if request.user.role != "owner":
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only the shop owner can edit shop settings.")
            
        from .serializers import ShopSettingsSerializer
        ser = ShopSettingsSerializer(request.user.shop, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class TutorialsView(APIView):
    """Return active tutorial videos to tenant dashboards."""
    
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from platform_admin.models import TutorialVideo
        # We use a simple dict response to avoid creating a new serializer just for this
        videos = TutorialVideo.objects.filter(is_active=True).order_by("sequence", "id")
        data = []
        for v in videos:
            data.append({
                "id": v.id,
                "title": v.title,
                "youtube_url": v.youtube_url,
                "sequence": v.sequence,
                "video_id": v.video_id,
                "thumbnail_url": v.thumbnail_url,
                "embed_url": v.embed_url,
            })
        return Response(data)
