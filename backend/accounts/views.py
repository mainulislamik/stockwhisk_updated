from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from tenants.services import register_shop

from .serializers import ShopRegistrationSerializer, UserSerializer


import random
from django.utils import timezone
from datetime import timedelta
from django.core.mail import send_mail
from django.conf import settings
from .models import PendingRegistration

class InitiateRegistrationView(APIView):
    """Public endpoint: receive registration details, generate OTP, send email."""

    permission_classes = [AllowAny]

    def post(self, request):
        ser = ShopRegistrationSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        
        email = data["owner_email"]
        
        # Generate 6 digit OTP
        otp = str(random.randint(100000, 999999))
        
        # Hash the password for temporary storage
        from django.contrib.auth.hashers import make_password
        hashed_password = make_password(data["owner_password"])
        
        # Save or update pending registration
        PendingRegistration.objects.update_or_create(
            email=email,
            defaults={
                "password_hash": hashed_password,
                "shop_name": data["shop_name"],
                "owner_name": data.get("owner_name", ""),
                "otp": otp,
                "expires_at": timezone.now() + timedelta(minutes=15)
            }
        )
        
        # Try to get dynamic SMTP settings from PlatformConfig
        from django.core.mail import get_connection
        from platform_admin.models import PlatformConfig
        
        config = PlatformConfig.get_solo()
        
        connection = None
        from_email = settings.DEFAULT_FROM_EMAIL
        
        if config.smtp_host and config.smtp_user:
            connection = get_connection(
                backend='django.core.mail.backends.smtp.EmailBackend',
                host=config.smtp_host,
                port=config.smtp_port,
                username=config.smtp_user,
                password=config.smtp_password,
                use_tls=config.smtp_use_tls,
            )
            from_email = config.smtp_default_from or settings.DEFAULT_FROM_EMAIL

        # Send OTP email
        try:
            send_mail(
                subject="Your StockWhisk Verification Code",
                message=f"Welcome to StockWhisk!\n\nYour verification code is: {otp}\n\nThis code expires in 15 minutes.",
                from_email=from_email,
                recipient_list=[email],
                fail_silently=False,
                connection=connection,
            )
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            return Response({
                "detail": "Failed to send email. Check SMTP configuration.", 
                "error": str(e),
                "trace": error_trace
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"detail": "OTP sent to email."}, status=status.HTTP_200_OK)


class VerifyOTPRegistrationView(APIView):
    """Public endpoint: verify OTP and finalize shop+user creation."""
    
    permission_classes = [AllowAny]
    
    def post(self, request):
        from .serializers import VerifyOTPRegistrationSerializer
        ser = VerifyOTPRegistrationSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        
        email = ser.validated_data["email"]
        otp = ser.validated_data["otp"]
        
        try:
            pending = PendingRegistration.objects.get(email=email)
        except PendingRegistration.DoesNotExist:
            return Response({"detail": "No pending registration found for this email."}, status=status.HTTP_404_NOT_FOUND)
            
        if pending.otp != otp:
            return Response({"detail": "Invalid OTP code."}, status=status.HTTP_400_BAD_REQUEST)
            
        if pending.expires_at < timezone.now():
            return Response({"detail": "OTP code has expired."}, status=status.HTTP_400_BAD_REQUEST)
            
        # All good! Create the actual shop and owner
        shop, owner = register_shop(
            name=pending.shop_name,
            owner_email=pending.email,
            owner_password="will-be-overwritten-immediately",
            owner_name=pending.owner_name,
            business_type="general", # Default for now, can expand later
            phone="",
        )
        
        # Overwrite password with the hashed one from pending (to avoid storing plain text in pending)
        # Actually register_shop expects raw password, but we hashed it. 
        # We can just set owner.password directly.
        owner.password = pending.password_hash
        owner.save(update_fields=["password"])
        
        # Cleanup
        pending.delete()
        
        # Return login tokens
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


class RequestPasswordResetOTPView(APIView):
    """Public endpoint: request an OTP for password reset."""

    permission_classes = [AllowAny]

    def post(self, request):
        from .serializers import RequestPasswordResetSerializer
        ser = RequestPasswordResetSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        
        email = ser.validated_data["email"]
        
        # Generate 6 digit OTP
        otp = str(random.randint(100000, 999999))
        
        from .models import PasswordResetOTP
        PasswordResetOTP.objects.update_or_create(
            email=email,
            defaults={
                "otp": otp,
                "expires_at": timezone.now() + timedelta(minutes=3)
            }
        )
        
        from django.core.mail import get_connection
        from platform_admin.models import PlatformConfig
        config = PlatformConfig.get_solo()
        
        connection = None
        from_email = settings.DEFAULT_FROM_EMAIL
        
        if config.smtp_host and config.smtp_user:
            connection = get_connection(
                backend='django.core.mail.backends.smtp.EmailBackend',
                host=config.smtp_host,
                port=config.smtp_port,
                username=config.smtp_user,
                password=config.smtp_password,
                use_tls=config.smtp_use_tls,
            )
            from_email = config.smtp_default_from or settings.DEFAULT_FROM_EMAIL

        try:
            send_mail(
                subject="StockWhisk Password Reset Code",
                message=f"Your password reset verification code is: {otp}\n\nThis code expires in 3 minutes.\nIf you did not request a password reset, please ignore this email.",
                from_email=from_email,
                recipient_list=[email],
                fail_silently=False,
                connection=connection,
            )
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            return Response({
                "detail": "Failed to send email. Check SMTP configuration.", 
                "error": str(e),
                "trace": error_trace
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"detail": "OTP sent to email."}, status=status.HTTP_200_OK)


class VerifyPasswordResetOTPView(APIView):
    """Public endpoint: verify OTP and reset password."""
    
    permission_classes = [AllowAny]
    
    def post(self, request):
        from .serializers import VerifyPasswordResetSerializer
        ser = VerifyPasswordResetSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        
        email = ser.validated_data["email"]
        otp = ser.validated_data["otp"]
        new_password = ser.validated_data["new_password"]
        
        from .models import PasswordResetOTP, User
        try:
            pending = PasswordResetOTP.objects.get(email=email)
        except PasswordResetOTP.DoesNotExist:
            return Response({"detail": "No pending password reset found for this email."}, status=status.HTTP_404_NOT_FOUND)
            
        if pending.otp != otp:
            return Response({"detail": "Invalid OTP code."}, status=status.HTTP_400_BAD_REQUEST)
            
        if pending.expires_at < timezone.now():
            return Response({"detail": "OTP code has expired."}, status=status.HTTP_400_BAD_REQUEST)
            
        # Update user password
        try:
            user = User.objects.get(email=email)
            user.set_password(new_password)
            user.save(update_fields=["password"])
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        
        # Cleanup
        pending.delete()
        
        return Response({"detail": "Password has been successfully reset."}, status=status.HTTP_200_OK)


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
