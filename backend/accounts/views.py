from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.core import serializers as django_serializers
from django.apps import apps
from django.http import HttpResponse

from core.permissions import IsTenantMember
from platform_admin.tasks import OPERATIONAL_MODELS_ORDER
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

    authentication_classes = []  # public endpoint — no session auth, so no CSRF check
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
                "phone": data.get("phone", ""),
                "business_type": data.get("business_type", "general"),
                "address": data.get("address", ""),
                "referral_code": (data.get("referral_code", "") or "").strip().upper(),
                "otp": otp,
                "failed_attempts": 0,
                "expires_at": timezone.now() + timedelta(minutes=10)
            }
        )
        
        # Send OTP email using robust fallback helper
        from .otp_email import send_otp_email
        try:
            send_otp_email(
                email=email,
                otp=otp,
                subject="Your StockWhisk Verification Code",
                intro="Welcome to StockWhisk!",
                expires_mins=10
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).exception("Failed to send registration OTP email to %s", email)
            return Response({
                "detail": "Failed to send verification email. Please check your email address or try again later.",
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"detail": "OTP sent to email."}, status=status.HTTP_200_OK)


class VerifyOTPRegistrationView(APIView):
    """Public endpoint: verify OTP and finalize shop+user creation."""
    
    authentication_classes = []  # public endpoint — no session auth, so no CSRF check
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
            pending.failed_attempts = (getattr(pending, "failed_attempts", 0) or 0) + 1
            if pending.failed_attempts >= 5:
                pending.delete()
                return Response({
                    "detail": "Too many failed attempts. This verification code has been invalidated. Please register again."
                }, status=status.HTTP_400_BAD_REQUEST)
            pending.save(update_fields=["failed_attempts"])
            remaining = 5 - pending.failed_attempts
            return Response({
                "detail": f"Invalid OTP code. {remaining} attempt(s) remaining."
            }, status=status.HTTP_400_BAD_REQUEST)
            
        if pending.expires_at < timezone.now():
            return Response({"detail": "OTP code has expired."}, status=status.HTTP_400_BAD_REQUEST)
            
        # Resolve referral attribution (only ACTIVE resellers; invalid/inactive
        # codes are silently ignored so registration never fails on them).
        reseller = None
        if pending.referral_code:
            from resellers.services import resolve_active_reseller
            reseller = resolve_active_reseller(pending.referral_code)

        # All good! Create the actual shop and owner
        shop, owner = register_shop(
            name=pending.shop_name,
            owner_email=pending.email,
            owner_password="will-be-overwritten-immediately",
            owner_name=pending.owner_name,
            business_type=pending.business_type,
            phone=pending.phone,
            address=pending.address,
            reseller=reseller,
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

    authentication_classes = []  # public endpoint — no session auth, so no CSRF check
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
        from .otp_email import send_otp_email
        try:
            send_otp_email(
                email=email,
                otp=otp,
                subject="StockWhisk Password Reset Code",
                intro="Here is your password reset verification code.",
                expires_mins=3
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Password reset email failure: {e}", exc_info=True)
            return Response({
                "detail": "Failed to send email. Please verify SMTP server settings or try again later.",
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"detail": "OTP sent to email."}, status=status.HTTP_200_OK)


class VerifyPasswordResetOTPView(APIView):
    """Public endpoint: verify OTP and reset password."""
    
    authentication_classes = []  # public endpoint — no session auth, so no CSRF check
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
            
        if pending.expires_at < timezone.now():
            pending.delete()
            return Response({"detail": "OTP code has expired. Please request a new one."}, status=status.HTTP_400_BAD_REQUEST)

        if pending.otp != otp:
            pending.failed_attempts = getattr(pending, "failed_attempts", 0) + 1
            if pending.failed_attempts >= 5:
                pending.delete()
                return Response({"detail": "Too many invalid attempts. This OTP has been invalidated."}, status=status.HTTP_400_BAD_REQUEST)
            pending.save(update_fields=["failed_attempts"])
            return Response({"detail": f"Invalid OTP code. {5 - pending.failed_attempts} attempts remaining."}, status=status.HTTP_400_BAD_REQUEST)
            
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
        shop = getattr(request.user, "shop", None)
        if not shop:
            return Response({"detail": "No shop associated."}, status=400)
        if request.user.role != "owner":
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only the shop owner can edit shop settings.")

        from .serializers import ShopSettingsSerializer
        ser = ShopSettingsSerializer(shop, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        try:
            ser.save()
        except Exception as exc:
            # Surface the real cause instead of an opaque 500 HTML page, and log
            # the full traceback so we can see exactly what failed on the server.
            import logging
            logging.getLogger("django").exception("Shop settings save failed")
            return Response(
                {"detail": f"Could not save settings: {exc.__class__.__name__}: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(ser.data)


class TutorialsView(APIView):
    """Return active tutorial videos to tenant dashboards."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from platform_admin.models import TutorialVideo
        # Determine if the user is a reseller
        profile = getattr(request.user, "reseller_profile", None)
        is_reseller = bool(profile and profile.status == "active")
        
        # Filter based on role
        if is_reseller:
            allowed_audiences = ["all", "both", "reseller"]
        else:
            allowed_audiences = ["all", "both", "shop"]

        videos = TutorialVideo.objects.filter(
            is_active=True,
            target_audience__in=allowed_audiences
        ).order_by("sequence", "id")
        
        data = []
        for v in videos:
            data.append({
                "id": v.id,
                "title": v.title,
                "youtube_url": v.youtube_url,
                "sequence": v.sequence,
                "target_audience": v.target_audience,
                "video_id": v.video_id,
                "thumbnail_url": v.thumbnail_url,
                "embed_url": v.embed_url,
            })
        return Response(data)


class PublicTutorialsView(APIView):
    """Return active tutorial videos for the public /tutorials page."""
    permission_classes = [AllowAny]

    def get(self, request):
        from platform_admin.models import TutorialVideo
        allowed_audiences = ["all", "public", "both", "shop"]

        videos = TutorialVideo.objects.filter(
            is_active=True,
            target_audience__in=allowed_audiences
        ).order_by("sequence", "id")
        
        data = []
        for v in videos:
            data.append({
                "id": v.id,
                "title": v.title,
                "youtube_url": v.youtube_url,
                "sequence": v.sequence,
                "target_audience": v.target_audience,
                "video_id": v.video_id,
                "thumbnail_url": v.thumbnail_url,
                "embed_url": v.embed_url,
            })
        return Response(data)
class DownloadBackupView(APIView):
    """
    Export all operational data for the current shop as a JSON file.
    """
    permission_classes = [IsTenantMember]

    def get(self, request):
        shop_id = request.user.shop_id
        objects = []
        for model_name in OPERATIONAL_MODELS_ORDER:
            try:
                model = apps.get_model(model_name)
                if hasattr(model, 'all_objects'):
                    objects.extend(model.all_objects.filter(shop_id=shop_id))
                else:
                    objects.extend(model.objects.filter(shop_id=shop_id))
            except LookupError:
                continue

        json_data = django_serializers.serialize("json", objects)
        
        response = HttpResponse(json_data, content_type='application/json')
        response['Content-Disposition'] = f'attachment; filename="shop_{shop_id}_backup_{timezone.now().strftime("%Y%m%d")}.json"'
        return response


class PublicDemoShopsView(APIView):
    """
    Public endpoint listing all active demo shops grouped strictly by category.
    Only categories with AT LEAST ONE available demo shop are returned.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    CATEGORY_META = {
        "general": {
            "name_en": "General Retail",
            "name_bn": "জেনারেল রিটেইল ও ডিপার্টমেন্টাল",
            "icon": "🛒",
            "desc_en": "Super-fast POS, barcode scanning, stock ledger & customer dues for general stores.",
            "desc_bn": "সুপার-ফাস্ট পিওএস বিলিং, বারকোড স্ক্যানিং, স্টক খাতা এবং কাস্টমার বাকি ব্যবস্থাপনা।"
        },
        "supershop": {
            "name_en": "Super Shop & Grocery",
            "name_bn": "সুপারশপ ও গ্রোসারি",
            "icon": "🏬",
            "desc_en": "Barcode weight scales, expiry dates, batch management, F8 hold cart & instant thermal billing.",
            "desc_bn": "ওয়েট স্কেল বারকোড, মেয়াদ ট্র্যাকিং, ব্যাচ ম্যানেজমেন্ট, হোল্ড কার্ট ও দ্রুত ক্যাশ বিলিং।"
        },
        "fashion": {
            "name_en": "Fashion & Apparel",
            "name_bn": "ফ্যাশন ও ক্লোথিং স্টোর",
            "icon": "👗",
            "desc_en": "Variant matrices (Size/Color/Fabric), barcode hangtags, exchange & seasonal discount control.",
            "desc_bn": "সাইজ/রং/ভ্যারিয়েন্ট ম্যাট্রিক্স, বারকোড ট্যাগ জেনারেশন ও দ্রুত রিটার্ন-এক্সচেঞ্জ।"
        },
        "mobile": {
            "name_en": "Mobile & Repair Service",
            "name_bn": "মোবাইল ও সার্ভিস রিপেয়ার",
            "icon": "📱",
            "desc_en": "IMEI warranty tracking, technician assignment, repair tickets with live QR customer tracking.",
            "desc_bn": "আইএমইআই ট্র্যাকিং, সার্ভিস রিপেয়ার টিকিট ও কিউআর কোড লাইভ কাস্টমার ট্র্যাকিং।"
        },
        "electronics": {
            "name_en": "Electronics & Home Appliances",
            "name_bn": "ইলেকট্রনিক্স ও গ্যাজেট",
            "icon": "⚡",
            "desc_en": "Serial number tracking, manufacturer warranties, installment (EMI) & service billing.",
            "desc_bn": "সিরিয়াল নম্বর ট্র্যাকিং, ওয়ারেন্টি ম্যানেজমেন্ট এবং কিস্তি (ইএমআই) হিসাব।"
        },
        "cosmetics": {
            "name_en": "Cosmetics & Beauty Care",
            "name_bn": "কসমেটিক্স ও পারফিউম",
            "icon": "💄",
            "desc_en": "Brand directories, shade variants, batch expiry tracking & customer loyalty reward points.",
            "desc_bn": "ব্র্যান্ড ডিরেক্টরি, শেড ভ্যারিয়েন্ট, মেয়াদোত্তীর্ণ ট্র্যাকিং ও লয়্যালটি পয়েন্ট।"
        },
        "camical": {
            "name_en": "Chemical & Lab Supplies",
            "name_bn": "কেমিক্যাল ও ল্যাব সাপ্লাই",
            "icon": "🧪",
            "desc_en": "Raw material recipes, multi-stage batch production & chemical inventory management.",
            "desc_bn": "কাঁচামাল ফরমুলা, ব্যাচ প্রোডাকশন ম্যানুফ্যাকচারিং ও কেমিক্যাল স্টক হিসাব।"
        },
        "computer": {
            "name_en": "Computer & IT Accessories",
            "name_bn": "কম্পিউটার ও আইটি শপ",
            "icon": "💻",
            "desc_en": "Serial barcode warranties, custom PC component assembly, service RMA & ticket tracking.",
            "desc_bn": "সিরিয়াল বারকোড ওয়ারেন্টি, পার্টস অ্যাসেম্বলি এবং রিপেয়ার ট্র্যাকিং।"
        },
        "jewelry": {
            "name_en": "Jewelry & Gold Shop",
            "name_bn": "জুয়েলারি ও জুয়েলার্স",
            "icon": "💍",
            "desc_en": "Gold/silver weight, karat purity grading, making charge calculation & custom orders.",
            "desc_bn": "স্বর্ণ/রুপার ওজন, ক্যারেট গ্রেডিং, মজুরি হিসাব ও স্পেশাল অর্ডার ম্যানেজমেন্ট।"
        },
        "food": {
            "name_en": "Organic Food & Bakery",
            "name_bn": "ফুড ও বেকারি",
            "icon": "🥖",
            "desc_en": "Perishable ingredients, production recipes, expiry tracking & fast-checkout POS.",
            "desc_bn": "দ্রুত পচনশীল কাঁচামাল, উৎপাদন রেসিপি ও সুপারফাস্ট পিওএস সেলস।"
        },
        "handcrafts": {
            "name_en": "Handcrafts & Boutique",
            "name_bn": "হস্তশিল্প ও বুটিক",
            "icon": "🎨",
            "desc_en": "Artisan inventory, handmade item tags, boutique orders & instant POS invoicing.",
            "desc_bn": "কারুশিল্প ও বুটিক পণ্য, কাস্টম বারকোড এবং সহজ ইনভয়েসিং।"
        },
        "other": {
            "name_en": "Other Retail & Services",
            "name_bn": "অন্যান্য রিটেইল ও সার্ভিস",
            "icon": "🏢",
            "desc_en": "Complete all-in-one POS, barcode inventory, accounts & multi-channel billing.",
            "desc_bn": "অল-ইন-ওয়ান পিওএস, বারকোড ইনভেন্টরি ও নির্ভুল অ্যাকাউন্টিং।"
        }
    }

    def get(self, request):
        from tenants.models import Shop
        from accounts.models import User
        
        # Query only active demo shops
        demo_shops = Shop.objects.filter(is_demo=True, is_active=True).order_by("business_type", "name")
        
        # Group shops strictly by category
        grouped = {}
        for s in demo_shops:
            cat_key = s.business_type or "general"
            if cat_key not in grouped:
                meta = self.CATEGORY_META.get(cat_key, self.CATEGORY_META["other"])
                grouped[cat_key] = {
                    "key": cat_key,
                    "name_en": meta["name_en"],
                    "name_bn": meta["name_bn"],
                    "icon": meta["icon"],
                    "desc_en": meta["desc_en"],
                    "desc_bn": meta["desc_bn"],
                    "shops": []
                }
            
            # Key feature list
            features = ["POS Thermal Billing", "Barcode Scanning", "Real-Time Stock", "Daily Cash Register", "Customer Dues"]
            if s.business_type in ["mobile", "computer"] or s.service_enabled:
                features.append("Service & Repair Tickets (with QR Live Tracking)")
                features.append("Serial Warranty Management")
            if s.business_type == "supershop":
                features.append("Barcode Scale Integration (EAN-13)")
                features.append("Hold & Recall Cart (F8/F9)")
                features.append("You Saved Discount Receipts")
            if s.business_type == "fashion":
                features.append("Size/Color Variant Matrix")
                features.append("Barcode Hangtag Printing")
            if s.manufacturing_enabled or s.business_type == "camical":
                features.append("Batch Manufacturing & Production")

            grouped[cat_key]["shops"].append({
                "id": s.id,
                "name": s.name,
                "slug": s.slug,
                "business_type": s.business_type,
                "address": s.address or "StockWhisk Demo Centre, Dhaka",
                "features": features,
            })
            
        # Return only categories that actually have at least 1 demo shop
        categories_list = list(grouped.values())
        return Response({
            "total_demo_shops": demo_shops.count(),
            "total_categories": len(categories_list),
            "categories": categories_list
        })


class PublicDemoLoginView(APIView):
    """
    1-Click Instant Login into a specific demo shop.
    Issues a valid JWT for the demo owner without requiring manual password entry.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        from tenants.models import Shop
        from accounts.models import User
        from rest_framework_simplejwt.tokens import RefreshToken
        from django.contrib.auth.hashers import make_password

        shop_id = request.data.get("shop_id")
        
        # If shop_id not provided, pick the first active demo shop
        if shop_id:
            shop = Shop.objects.filter(id=shop_id, is_demo=True, is_active=True).first()
        else:
            shop = Shop.objects.filter(is_demo=True, is_active=True).first()

        if not shop:
            return Response({"error": "Selected demo store is currently not available."}, status=status.HTTP_404_NOT_FOUND)

        # Get or create demo owner user
        user = User.objects.filter(shop=shop, role="owner").first()
        if not user:
            user = User.objects.create(
                email=f"demo_owner_{shop.id}@demo.stockwhisk.com",
                first_name="Demo",
                last_name="Manager",
                shop=shop,
                role="owner",
                is_active=True,
                password=make_password("admin")
            )

        refresh = RefreshToken.for_user(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "shop_name": shop.name,
            "business_type": shop.business_type,
            "shop_id": shop.id,
            "owner_email": user.email
        })
