"""
Super-admin (platform) API — operated by platform staff, not tenants.

All reads use ``bypass_tenant_scope`` because platform staff legitimately see
across every tenant. "Login as shop" mints a fresh JWT for that shop's owner so
the fully tenant-scoped shop frontend just works; the frontend keeps the admin
token aside and can switch back. Every sensitive action is audited.
"""
from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, DecimalField, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import RoleType, User
from audit.models import AuditLog
from audit.services import record
from core.permissions import IsPlatformStaff
from core.tenant_context import bypass_tenant_scope
from tenants.models import Shop, SubscriptionPlan
from tenants.services import register_shop

from .models import ContactMessage, TutorialVideo

_DEC = DecimalField(max_digits=18, decimal_places=2)

# A shop must sit suspended this long before it can be permanently deleted.
SHOP_DELETE_COOLOFF = timedelta(days=15)

# Feature flags exposed on the single subscription plan.
FEATURE_KEYS = [
    "pos", "basic_analytics", "advanced_analytics", "reports_export",
    "multi_branch", "api_access",
]


# --- Shops -------------------------------------------------------------------

class ShopAdminSerializer(serializers.ModelSerializer):
    plan_tier = serializers.CharField(source="plan.tier", read_only=True, default=None)
    user_count = serializers.IntegerField(read_only=True, required=False)
    owner_email = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()
    days_suspended = serializers.SerializerMethodField()

    # Write-only fields used only when provisioning a new shop.
    owner_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    owner_password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    # We redefine owner_name as a SerializerMethodField for reading, but it's used as write-only in create().
    # To support both, we keep owner_name for writing, and add a read-only field for the UI.
    owner_full_name = serializers.SerializerMethodField()
    subscription_info = serializers.SerializerMethodField()

    shop_code = serializers.CharField(read_only=True, default=None)

    class Meta:
        model = Shop
        fields = [
            "id", "shop_code", "name", "slug", "business_type", "phone", "email", "address",
            "plan", "plan_tier", "is_active", "is_test", "is_free", "trial_ends_at", "suspended_at",
            "user_count", "owner_email", "owner_full_name", "can_delete", "days_suspended",
            "created_at", "owner_name", "owner_password", "subscription_info"
        ]
        read_only_fields = ["id", "slug", "created_at", "suspended_at", "is_free"]

    def get_owner_email(self, obj):
        owner = User.objects.filter(shop_id=obj.id, role=RoleType.OWNER).first()
        return owner.email if owner else None

    def get_owner_full_name(self, obj):
        owner = User.objects.filter(shop_id=obj.id, role=RoleType.OWNER).first()
        if owner:
            return f"{owner.first_name} {owner.last_name}".strip()
        return None

    def get_subscription_info(self, obj):
        return shop_subscription_info(obj)

    def _days_suspended(self, obj):
        if obj.is_active or not obj.suspended_at:
            return 0
        return (timezone.now() - obj.suspended_at).days

    def get_days_suspended(self, obj):
        return self._days_suspended(obj)

    def get_can_delete(self, obj):
        return (not obj.is_active) and self._days_suspended(obj) >= SHOP_DELETE_COOLOFF.days


class PlatformRevenueView(APIView):
    """Monthly subscription revenue + invoice list (test shops excluded by default)."""
    permission_classes = [IsPlatformStaff]

    def get(self, request):
        from datetime import date
        from .models import PlatformRevenue

        include_test = request.query_params.get("include_test") == "1"
        qs = PlatformRevenue.objects.all()
        if not include_test:
            qs = qs.filter(is_test=False)

        # Available months (YYYY-MM), newest first.
        months = sorted({r.occurred_at.strftime("%Y-%m") for r in qs.only("occurred_at")}, reverse=True)

        month = request.query_params.get("month")
        if not month or month not in months:
            month = months[0] if months else timezone.localdate().strftime("%Y-%m")

        y, m = int(month[:4]), int(month[5:7])
        start = date(y, m, 1)
        end = date(y + (m // 12), (m % 12) + 1, 1)
        month_qs = qs.filter(occurred_at__date__gte=start, occurred_at__date__lt=end).order_by("-occurred_at")

        entries = [{
            "id": r.id,
            "shop_id": r.shop_id,
            "shop_name": r.shop_name,
            "shop_code": r.shop_code,
            "plan_tier": r.plan_tier,
            "invoice_number": r.invoice_number,
            "amount": r.amount,
            "cycle": r.cycle,
            "period_start": r.period_start,
            "period_end": r.period_end,
            "is_test": r.is_test,
            "occurred_at": r.occurred_at,
            "shop_deleted": r.shop_id is None,
        } for r in month_qs]

        month_total = month_qs.aggregate(
            v=Coalesce(Sum("amount", output_field=_DEC), Decimal("0"), output_field=_DEC))["v"]
        all_time = qs.aggregate(
            v=Coalesce(Sum("amount", output_field=_DEC), Decimal("0"), output_field=_DEC))["v"]

        return Response({
            "month": month,
            "months": months,
            "month_total": month_total,
            "all_time_total": all_time,
            "count": len(entries),
            "entries": entries,
            "include_test": include_test,
        })


def shop_subscription_info(shop):
    """Current subscription snapshot for the shop-detail panel."""
    from tenants.models import Subscription
    now = timezone.now()
    sub = Subscription.objects.filter(shop_id=shop.id, is_current=True).select_related("plan").first()
    if shop.on_trial:
        return {
            "state": "trial",
            "plan_tier": shop.plan.tier if shop.plan else None,
            "ends_at": shop.trial_ends_at,
            "days_left": max(0, (shop.trial_ends_at - now).days),
            "status": "trial",
        }
    if sub and sub.current_period_end:
        expired = sub.current_period_end <= now
        return {
            "state": "expired" if expired else "paid",
            "plan_tier": (sub.plan.tier if sub.plan else (shop.plan.tier if shop.plan else None)),
            "ends_at": sub.current_period_end,
            "days_left": max(0, (sub.current_period_end - now).days),
            "status": sub.status,
        }
    return {"state": "none", "plan_tier": shop.plan.tier if shop.plan else None,
            "ends_at": None, "days_left": 0, "status": sub.status if sub else None}


class TenantDashboardView(APIView):
    permission_classes = [IsPlatformStaff]

    def get(self, request, shop_id):
        # A view combining stats about a specific shop...
        # Currently just a stub, real implementation depends on what platform staff need.
        return Response({"status": "stub"})


class ServerMetricsView(APIView):
    """
    Returns real-time server metrics (CPU, RAM, Disk, Network) using psutil,
    plus the count of active platform visitors.
    """
    permission_classes = [IsPlatformStaff]

    def get(self, request):
        try:
            import psutil
        except ImportError:
            return Response({"error": "psutil not installed"}, status=500)

        # CPU
        cpu_percent = psutil.cpu_percent(interval=None)

        # Memory
        mem = psutil.virtual_memory()

        # Disk
        disk = psutil.disk_usage('/')

        # Network
        net = psutil.net_io_counters()

        # Active visitors
        # We consider a user active if last_seen is within the ONLINE_WINDOW_SECONDS (300s).
        from django.utils import timezone
        active_window = timezone.now() - timedelta(seconds=User.ONLINE_WINDOW_SECONDS)
        active_visitors = User.objects.filter(last_seen__gte=active_window).count()

        return Response({
            "cpu_percent": cpu_percent,
            "memory": {
                "total": mem.total,
                "used": mem.used,
                "percent": mem.percent,
            },
            "disk": {
                "total": disk.total,
                "used": disk.used,
                "percent": disk.percent,
            },
            "network": {
                "bytes_sent": net.bytes_sent,
                "bytes_recv": net.bytes_recv,
            },
            "active_visitors": active_visitors,
        })


class PlatformDashboardView(APIView):
    permission_classes = [IsPlatformStaff]

    def get(self, request):
        from billing.models import ManualPayment

        now = timezone.now()
        with bypass_tenant_scope():
            shops = Shop.objects.all()
            total = shops.count()
            active = shops.filter(is_active=True).count()
            on_trial = shops.filter(trial_ends_at__gt=now).count()
            by_type = list(
                shops.values("business_type").annotate(n=Count("id")).order_by("-n")
            )
            pending_payments = ManualPayment.objects.filter(
                status=ManualPayment.Status.PENDING
            ).count()
            from .models import PlatformRevenue
            approved_revenue = PlatformRevenue.objects.filter(is_test=False).aggregate(
                v=Coalesce(Sum("amount", output_field=_DEC), Decimal("0"), output_field=_DEC)
            )["v"]
            recent = list(shops.select_related("plan").order_by("-created_at")[:8])
            recent_shops = ShopAdminSerializer(recent, many=True).data

        type_labels = dict(Shop.BusinessType.choices)
        for row in by_type:
            row["label"] = type_labels.get(row["business_type"], row["business_type"])

        unread_messages = ContactMessage.objects.filter(is_read=False).count()
        return Response({
            "total_shops": total,
            "active_shops": active,
            "trial_shops": on_trial,
            "suspended_shops": total - active,
            "by_business_type": by_type,
            "pending_payments": pending_payments,
            "approved_revenue": approved_revenue,
            "unread_messages": unread_messages,
            "recent_shops": recent_shops,
        })


class ShopAdminViewSet(viewsets.ModelViewSet):
    """CRUD + suspend/activate + login-as over all shops (staff only)."""

    permission_classes = [IsPlatformStaff]
    serializer_class = ShopAdminSerializer

    def get_queryset(self):
        with bypass_tenant_scope():
            qs = Shop.objects.select_related("plan").annotate(
                user_count=Count("users")
            ).order_by("-created_at")
            if q := self.request.query_params.get("q"):
                q_clean = q.strip().upper()
                from django.db.models import Q
                q_filter = Q(name__icontains=q) | Q(slug__icontains=q) | Q(phone__icontains=q) | Q(email__icontains=q)
                
                # Check for numeric ID or SW-1001 shop code formats
                if q_clean.startswith("SW-"):
                    try:
                        raw_id = int(q_clean.replace("SW-", "")) - 1000
                        q_filter |= Q(id=raw_id)
                    except ValueError:
                        pass
                elif q_clean.isdigit():
                    num = int(q_clean)
                    q_filter |= Q(id=num)
                    if num > 1000:
                        q_filter |= Q(id=num - 1000)
                        
                qs = qs.filter(q_filter)
            return qs

    def create(self, request, *args, **kwargs):
        data = request.data
        email = (data.get("owner_email") or "").strip().lower()
        if not email:
            return Response({"detail": "Owner email is required."},
                            status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(email__iexact=email).exists():
            return Response({"detail": "A user with that email already exists."},
                            status=status.HTTP_400_BAD_REQUEST)
        password = data.get("owner_password") or ""
        if len(password) < 8:
            return Response({"detail": "Owner password must be at least 8 characters."},
                            status=status.HTTP_400_BAD_REQUEST)
        name = (data.get("name") or "").strip()
        if not name:
            return Response({"detail": "Shop name is required."},
                            status=status.HTTP_400_BAD_REQUEST)
        plan = SubscriptionPlan.objects.filter(pk=data.get("plan")).first() if data.get("plan") else None
        shop, owner = register_shop(
            name=name,
            owner_email=email,
            owner_password=password,
            owner_name=data.get("owner_name", ""),
            business_type=data.get("business_type", Shop.BusinessType.GENERAL),
            phone=data.get("phone", ""),
            plan=plan,
        )
        record(action=AuditLog.Action.CREATE, actor=request.user, shop=shop, target=shop,
               description=f"Shop '{shop.name}' created by platform admin")
        out = self.get_serializer(shop).data
        return Response(out, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        shop = self.get_object()
        response.data["subscription"] = shop_subscription_info(shop)
        response.data["plans"] = [
            {"id": p.id, "name": p.name, "tier": p.tier,
             "price_monthly": str(p.price_monthly)}
            for p in SubscriptionPlan.objects.filter(is_active=True).order_by("price_monthly")
        ]
        return response

    @action(detail=True, methods=["post"], url_path="grant-plan")
    def grant_plan(self, request, pk=None):
        """Directly activate/renew a paid plan for this shop (stacks on renew)."""
        from datetime import datetime, time as dt_time
        from django.utils.dateparse import parse_date
        from billing.services import grant_or_extend_plan

        shop = self.get_object()
        if shop.is_free:
            return Response(
                {"detail": "This is a lifetime-free shop. Turn off free access first before assigning a paid plan."},
                status=400,
            )
        plan = SubscriptionPlan.objects.filter(pk=request.data.get("plan")).first() or shop.plan
        if plan is None:
            return Response({"detail": "Select a plan to activate."}, status=400)

        cycle = request.data.get("cycle") or "monthly"
        amount = request.data.get("amount") or 0
        days = request.data.get("days")
        end_date = None
        if request.data.get("end_date"):
            d = parse_date(request.data["end_date"])
            if d:
                end_date = timezone.make_aware(datetime.combine(d, dt_time(23, 59, 59)))
        if not end_date and not days:
            days = 365 if cycle == "yearly" else 30

        # stack=True (default): keep remaining trial/paid days on top; False:
        # start the paid period fresh from today (discard remaining trial).
        stack = request.data.get("add_remaining", request.data.get("stack", True))
        sub, invoice = grant_or_extend_plan(
            shop=shop, plan=plan, days=days, end_date=end_date,
            amount=amount, cycle=cycle, reviewer=request.user, stack=bool(stack),
        )
        record(action=AuditLog.Action.UPDATE, actor=request.user, shop=shop, target=shop,
               description=f"Activated {plan.name} plan until {sub.current_period_end:%Y-%m-%d} "
                           f"(invoice {invoice.number})")
        data = self.get_serializer(shop).data
        data["subscription"] = shop_subscription_info(shop)
        data["invoice_number"] = invoice.number
        return Response(data)

    @action(detail=True, methods=["post"], url_path="toggle-test")
    def toggle_test(self, request, pk=None):
        """Mark/unmark a shop as a test shop (excluded from revenue totals)."""
        shop = self.get_object()
        shop.is_test = not shop.is_test
        shop.save(update_fields=["is_test"])
        # Keep this shop's existing revenue rows in sync so past revenue is
        # excluded/included immediately (deleted shops keep their snapshot).
        from .models import PlatformRevenue
        PlatformRevenue.objects.filter(shop=shop).update(is_test=shop.is_test)
        record(action=AuditLog.Action.UPDATE, actor=request.user, shop=shop, target=shop,
               description=f"Shop marked as {'test' if shop.is_test else 'live'} by platform admin")
        return Response({"status": "ok", "is_test": shop.is_test})

    @action(detail=True, methods=["post"], url_path="toggle-free")
    def toggle_free(self, request, pk=None):
        """Turn lifetime-free access on/off for a shop. Turning it off makes the
        shop start paying (subscription/trial applies again); the shop is never
        deleted. Turning it on skips billing while its reseller stays active."""
        shop = self.get_object()
        shop.is_free = not shop.is_free
        shop.save(update_fields=["is_free"])
        record(action=AuditLog.Action.UPDATE, actor=request.user, shop=shop, target=shop,
               description=f"Shop {'granted lifetime-free' if shop.is_free else 'free access removed'} by platform admin")
        data = self.get_serializer(shop).data
        data["subscription"] = shop_subscription_info(shop)
        return Response(data)

    @action(detail=True, methods=["post"])
    def suspend(self, request, pk=None):
        shop = self.get_object()
        shop.is_active = False
        shop.suspended_at = timezone.now()
        shop.save(update_fields=["is_active", "suspended_at"])
        record(action=AuditLog.Action.SUSPEND, actor=request.user, shop=shop,
               target=shop, description="Shop suspended by platform admin")
        return Response(self.get_serializer(shop).data)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        shop = self.get_object()
        shop.is_active = True
        shop.suspended_at = None
        shop.save(update_fields=["is_active", "suspended_at"])
        record(action=AuditLog.Action.ACTIVATE, actor=request.user, shop=shop,
               target=shop, description="Shop activated by platform admin")
        return Response(self.get_serializer(shop).data)

    @action(detail=True, methods=["post"], url_path="owner-password")
    def owner_password(self, request, pk=None):
        shop = self.get_object()
        owner = User.objects.filter(shop_id=shop.id, role=RoleType.OWNER).first()
        if owner is None:
            return Response({"detail": "This shop has no owner account."},
                            status=status.HTTP_400_BAD_REQUEST)
        new_pw = request.data.get("new_password", "")
        if len(new_pw) < 6:
            return Response({"detail": "Password must be at least 6 characters."},
                            status=status.HTTP_400_BAD_REQUEST)
        owner.set_password(new_pw)
        owner.save(update_fields=["password"])
        record(action=AuditLog.Action.UPDATE, actor=request.user, shop=shop, target=owner,
               description=f"Owner password reset by platform admin ({owner.email})")
        return Response({"status": "reset", "owner_email": owner.email})

    @action(detail=True, methods=["post"])
    def impersonate(self, request, pk=None):
        """Session-based impersonation (server-rendered admin / API parity)."""
        from core.middleware import IMPERSONATE_SESSION_KEY
        shop = self.get_object()
        request.session[IMPERSONATE_SESSION_KEY] = shop.id
        record(action=AuditLog.Action.IMPERSONATE_START, actor=request.user, shop=shop,
               target=shop, description=f"Platform admin started impersonating '{shop.name}'",
               metadata={"impersonator_id": request.user.id})
        return Response({"status": "impersonating", "shop_id": shop.id})

    @action(detail=True, methods=["post"], url_path="login-as")
    def login_as(self, request, pk=None):
        """Mint owner JWTs so the admin can enter the shop with no password."""
        shop = self.get_object()
        owner = User.objects.filter(
            shop_id=shop.id, role=RoleType.OWNER, is_active=True
        ).first()
        if owner is None:
            return Response({"detail": "This shop has no active owner to log in as."},
                            status=status.HTTP_400_BAD_REQUEST)
        record(action=AuditLog.Action.IMPERSONATE_START, actor=request.user, shop=shop,
               target=shop, description=f"Platform admin logging in as '{shop.name}'",
               metadata={"impersonator_id": request.user.id, "owner_id": owner.id})
        refresh = RefreshToken.for_user(owner)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "shop_name": shop.name,
            "owner_email": owner.email,
        })

    def destroy(self, request, *args, **kwargs):
        shop = self.get_object()
        typed = (request.data.get("confirm_name") or "").strip()
        if typed != shop.name:
            return Response({"detail": "Confirmation name did not match — shop not deleted."},
                            status=status.HTTP_400_BAD_REQUEST)
        if shop.is_active:
            return Response(
                {"detail": "Suspend the shop first — it must be suspended for 15 days before deletion."},
                status=status.HTTP_400_BAD_REQUEST)
        elapsed = (timezone.now() - shop.suspended_at) if shop.suspended_at else timedelta(0)
        if elapsed < SHOP_DELETE_COOLOFF:
            left = SHOP_DELETE_COOLOFF.days - elapsed.days
            return Response(
                {"detail": f"Shop must be suspended for 15 days before deletion — {left} day(s) left."},
                status=status.HTTP_400_BAD_REQUEST)
        name, sid = shop.name, shop.pk
        record(action=AuditLog.Action.DELETE, actor=request.user, shop=None,
               target_model="Shop", target_id=sid,
               description=f"Permanently deleted shop '{name}' (#{sid}) and all its data")
        shop.delete()
        return Response({"status": "deleted", "name": name})


# --- Active users ------------------------------------------------------------

class ActiveUsersView(APIView):
    """Cross-shop user table with a live 'online now' indicator."""

    permission_classes = [IsPlatformStaff]

    def get(self, request):
        show_all = request.query_params.get("all") == "1"
        q = request.query_params.get("q", "")
        cutoff = timezone.now() - timedelta(seconds=User.ONLINE_WINDOW_SECONDS)
        with bypass_tenant_scope():
            qs = User.objects.select_related("shop").order_by("-last_seen")
            if q:
                qs = qs.filter(email__icontains=q)
            online_count = User.objects.filter(last_seen__gte=cutoff).count()
            if not show_all:
                qs = qs.filter(last_seen__gte=cutoff)
            rows = [{
                "id": u.id,
                "name": (f"{u.first_name} {u.last_name}".strip() or None),
                "email": u.email,
                "shop_name": u.shop.name if u.shop else None,
                "is_staff": u.is_staff,
                "role": u.role,
                "online": bool(u.last_seen and u.last_seen >= cutoff),
                "last_seen": u.last_seen,
            } for u in qs[:500]]
        return Response({"users": rows, "online_count": online_count, "show_all": show_all})


# --- Subscription plan -------------------------------------------------------

class PlanView(APIView):
    """Manage the single subscription plan + its feature flags."""

    permission_classes = [IsPlatformStaff]

    def _plan(self):
        return SubscriptionPlan.objects.order_by("-is_active", "price_monthly").first()

    def _serialize(self, plan):
        if plan is None:
            return None
        return {
            "id": plan.id,
            "name": plan.name,
            "tier": plan.tier,
            "price_monthly": plan.price_monthly,
            "price_yearly": plan.price_yearly,
            "max_users": plan.max_users,
            "max_branches": plan.max_branches,
            "max_products": plan.max_products,
            "features": {k: bool((plan.features or {}).get(k)) for k in FEATURE_KEYS},
            "is_active": plan.is_active,
        }

    def get(self, request):
        return Response({"plan": self._serialize(self._plan()), "feature_keys": FEATURE_KEYS})

    def put(self, request):
        plan = self._plan()
        if plan is None:
            return Response({"detail": "No subscription plan exists."},
                            status=status.HTTP_404_NOT_FOUND)
        d = request.data
        plan.name = d.get("name", plan.name)
        plan.price_monthly = d.get("price_monthly") or 0
        plan.price_yearly = d.get("price_yearly") or 0
        plan.max_users = d.get("max_users") or plan.max_users
        plan.max_branches = d.get("max_branches") or plan.max_branches
        plan.max_products = d.get("max_products") or plan.max_products
        enabled = set(d.get("features") or [])
        plan.features = {k: (k in enabled) for k in FEATURE_KEYS}
        plan.is_active = True
        plan.save()
        record(action=AuditLog.Action.UPDATE, actor=request.user, target=plan,
               description=f"Subscription plan '{plan.name}' updated by platform admin")
        return Response({"plan": self._serialize(plan), "feature_keys": FEATURE_KEYS})


class PlanAdminSerializer(serializers.ModelSerializer):
    """Full CRUD for subscription plans/packages. ``features`` accepts either a
    list of enabled keys or a {key: bool} map and is normalized to a full map."""
    features = serializers.JSONField(required=False)
    highlights = serializers.JSONField(required=False)

    class Meta:
        model = SubscriptionPlan
        fields = ["id", "name", "tier", "price_monthly", "price_yearly",
                  "max_users", "max_branches", "max_products",
                  "show_users", "show_branches", "show_products",
                  "yearly_discount_percent", "features", "highlights", "is_active"]

    def validate_highlights(self, value):
        if isinstance(value, list):
            return [str(x).strip() for x in value if str(x).strip()]
        return []

    def validate_features(self, value):
        if isinstance(value, list):
            return {k: (k in value) for k in FEATURE_KEYS}
        if isinstance(value, dict):
            return {k: bool(value.get(k)) for k in FEATURE_KEYS}
        return {k: False for k in FEATURE_KEYS}


class PlanAdminViewSet(viewsets.ModelViewSet):
    """Manage multiple packages: create/edit/delete and toggle each plan's
    ``is_active`` (whether it shows on the public pricing page)."""
    permission_classes = [IsPlatformStaff]
    serializer_class = PlanAdminSerializer
    queryset = SubscriptionPlan.objects.all().order_by("price_monthly")

    def list(self, request, *args, **kwargs):
        data = self.get_serializer(self.get_queryset(), many=True).data
        return Response({"plans": data, "feature_keys": FEATURE_KEYS,
                         "tiers": [t[0] for t in SubscriptionPlan.Tier.choices]})

    def destroy(self, request, *args, **kwargs):
        plan = self.get_object()
        if plan.shops.exists():
            return Response(
                {"detail": "This package is assigned to one or more shops and cannot be deleted. Deactivate it instead."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class PromoOfferView(APIView):
    """Upload / toggle / remove the promotional offer popup shown on the public
    pricing page. Accepts an image or PDF (multipart)."""
    permission_classes = [IsPlatformStaff]

    @staticmethod
    def _state(config, request):
        url = None
        if config.offer_file:
            url = config.offer_file.url
            if request is not None:
                url = request.build_absolute_uri(url)
        is_pdf = bool(config.offer_file and str(config.offer_file.name).lower().endswith(".pdf"))
        return {"enabled": config.offer_enabled, "url": url, "is_pdf": is_pdf}

    def get(self, request):
        return Response(self._state(PlatformConfig.get_solo(), request))

    def post(self, request):
        config = PlatformConfig.get_solo()
        if "offer_file" in request.FILES:
            config.offer_file = request.FILES["offer_file"]
        if "offer_enabled" in request.data:
            val = request.data.get("offer_enabled")
            config.offer_enabled = str(val).lower() == "true" or val is True
        config.save()
        return Response(self._state(config, request))

    def delete(self, request):
        config = PlatformConfig.get_solo()
        if config.offer_file:
            config.offer_file.delete(save=False)
        config.offer_file = None
        config.offer_enabled = False
        config.save()
        return Response(self._state(config, request))


class BrandingView(APIView):
    """Upload / remove the platform logo and favicon (multipart). Shown across
    the app + marketing site."""
    permission_classes = [IsPlatformStaff]

    @staticmethod
    def _state(config, request):
        def _url(f):
            if not f:
                return None
            return request.build_absolute_uri(f.url) if request is not None else f.url
        return {"logo": _url(config.logo), "favicon": _url(config.favicon)}

    def get(self, request):
        return Response(self._state(PlatformConfig.get_solo(), request))

    def post(self, request):
        config = PlatformConfig.get_solo()
        for field in ("logo", "favicon"):
            if field in request.FILES:
                old = getattr(config, field)
                if old:
                    old.delete(save=False)
                setattr(config, field, request.FILES[field])
        config.save()
        return Response(self._state(config, request))

    def delete(self, request):
        config = PlatformConfig.get_solo()
        which = request.query_params.get("field") or request.data.get("field")
        fields = [which] if which in ("logo", "favicon") else ["logo", "favicon"]
        for field in fields:
            f = getattr(config, field)
            if f:
                f.delete(save=False)
            setattr(config, field, None)
        config.save()
        return Response(self._state(config, request))


class IndustryImagesView(APIView):
    """Upload / remove per-industry photos for the marketing site. Keyed by a
    fixed set of industry slugs; a missing key means the frontend shows its
    bundled default illustration."""
    permission_classes = [IsPlatformStaff]
    KEYS = {"retail", "grocery", "fashion", "electronics", "sme", "automobile"}

    def _state(self, config, request):
        imgs = config.industry_images or {}
        return {k: (request.build_absolute_uri(v) if request is not None and v else v) for k, v in imgs.items()}

    def get(self, request):
        return Response(self._state(PlatformConfig.get_solo(), request))

    def post(self, request):
        from django.core.files.storage import default_storage
        config = PlatformConfig.get_solo()
        key = request.data.get("key")
        if key not in self.KEYS:
            return Response({"detail": "Invalid industry key."}, status=status.HTTP_400_BAD_REQUEST)
        f = request.FILES.get("image")
        if not f:
            return Response({"detail": "No image file provided."}, status=status.HTTP_400_BAD_REQUEST)
        imgs = dict(config.industry_images or {})
        ext = (f.name.rsplit(".", 1)[-1] if "." in f.name else "png").lower()[:5]
        path = f"industries/{key}.{ext}"
        if default_storage.exists(path):
            default_storage.delete(path)
        saved = default_storage.save(path, f)
        imgs[key] = default_storage.url(saved)
        config.industry_images = imgs
        config.save(update_fields=["industry_images"])
        return Response(self._state(config, request))

    def delete(self, request):
        config = PlatformConfig.get_solo()
        key = request.query_params.get("key") or request.data.get("key")
        imgs = dict(config.industry_images or {})
        if key in imgs:
            imgs.pop(key)
            config.industry_images = imgs
            config.save(update_fields=["industry_images"])
        return Response(self._state(config, request))


# --- Contact messages --------------------------------------------------------

class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ["id", "name", "email", "phone", "subject", "message",
                  "is_read", "created_at"]
        read_only_fields = fields


class ContactMessageViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsPlatformStaff]
    serializer_class = ContactMessageSerializer
    queryset = ContactMessage.objects.all()

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        data = self.get_serializer(qs, many=True).data
        return Response({
            "messages": data,
            "unread_count": qs.filter(is_read=False).count(),
        })

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        msg = self.get_object()
        msg.is_read = True
        msg.save(update_fields=["is_read"])
        return Response({"status": "read"})

    def destroy(self, request, *args, **kwargs):
        self.get_object().delete()
        return Response({"status": "deleted"})


class PublicContactCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ["name", "email", "phone", "subject", "message"]


class PublicContactView(APIView):
    """Public contact-form endpoint. Anyone can POST a message; it is stored for
    the Super Admin inbox and emailed to the contact address. No auth (and no
    session auth, so no CSRF) — it is an unauthenticated public form."""

    permission_classes = []
    authentication_classes = []

    DEFAULT_CONTACT_TO = "contact@stockwhisk.com"

    def post(self, request):
        ser = PublicContactCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        msg = ser.save()

        # Destination inbox is managed from Platform Admin → Settings.
        contact_to = (PlatformConfig.get_solo().contact_email or "").strip() or self.DEFAULT_CONTACT_TO

        # Best-effort email notification. The message is already stored (Super
        # Admin → Messages), so email is a convenience — never fail the request.
        import logging
        from django.core.mail import EmailMultiAlternatives
        from notifications.channels import _contact_email
        log = logging.getLogger(__name__)
        try:
            connection, from_email = _contact_email()
            subject = f"New contact message from {msg.name}"
            if msg.subject:
                subject += f" — {msg.subject}"
            text = (
                f"Name: {msg.name}\n"
                f"Email: {msg.email}\n"
                f"Phone: {msg.phone or '—'}\n"
                f"Subject: {msg.subject or '—'}\n\n"
                f"{msg.message}\n"
            )
            html = f"""
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
              <h2 style="color:#1B3C53">📨 New Contact Message</h2>
              <table style="width:100%;border-collapse:collapse;font-size:14px">
                <tr><td style="padding:6px 0;color:#666">Name</td><td style="padding:6px 0"><b>{msg.name}</b></td></tr>
                <tr><td style="padding:6px 0;color:#666">Email</td><td style="padding:6px 0"><a href="mailto:{msg.email}">{msg.email}</a></td></tr>
                <tr><td style="padding:6px 0;color:#666">Phone</td><td style="padding:6px 0">{msg.phone or '—'}</td></tr>
                <tr><td style="padding:6px 0;color:#666">Subject</td><td style="padding:6px 0">{msg.subject or '—'}</td></tr>
              </table>
              <p style="margin-top:16px;padding:14px;background:#f6f8fa;border-radius:8px;white-space:pre-wrap">{msg.message}</p>
              <p style="color:#999;font-size:12px">Sent from the StockWhisk contact page.</p>
            </div>
            """
            email = EmailMultiAlternatives(
                subject, text, from_email, [contact_to],
                connection=connection, reply_to=[msg.email],
            )
            email.attach_alternative(html, "text/html")
            # fail_silently=False so a real SMTP error is logged below (not hidden).
            sent = email.send(fail_silently=False)
            log.warning("Contact email to %s sent=%s (from=%s)", contact_to, sent, from_email)
        except Exception:
            log.exception("Contact email delivery failed (message #%s stored)", msg.id)

        # Auto-acknowledgement to the sender (best-effort, independent of above).
        try:
            connection, from_email = _contact_email()
            ack_subject = "We've Received Your Message – StockWhisk"
            ack_text = (
                f"Dear {msg.name or 'Customer'},\n\n"
                "Thank you for contacting StockWhisk.\n\n"
                "We have successfully received your message and our team will review it "
                "shortly. We will get back to you as soon as possible.\n\n"
                "We appreciate your interest in StockWhisk and look forward to assisting you.\n\n"
                "Best regards,\n"
                "StockWhisk Team\n"
                "Your trusted shopping partner"
            )
            ack_html = f"""
            <div style="margin:0;padding:24px;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif">
              <div style="max-width:560px;margin:auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
                <div style="background:linear-gradient(135deg,#1d4ed8,#2563eb);padding:28px 32px;color:#ffffff">
                  <div style="font-size:20px;font-weight:800;letter-spacing:-.3px">📦 StockWhisk</div>
                  <div style="font-size:15px;opacity:.9;margin-top:4px">We've received your message</div>
                </div>
                <div style="padding:32px;color:#0f172a;font-size:15px;line-height:1.7">
                  <p style="margin:0 0 16px">Dear {msg.name or 'Customer'},</p>
                  <p style="margin:0 0 16px">Thank you for contacting <strong>StockWhisk</strong>.</p>
                  <p style="margin:0 0 16px">We have <strong>successfully received your message</strong> and our team
                     will review it shortly. We will get back to you as soon as possible.</p>
                  <p style="margin:0 0 16px">We appreciate your interest in StockWhisk and look forward to assisting you.</p>
                  <div style="margin:24px 0;padding:14px 18px;background:#eff6ff;border-left:4px solid #2563eb;border-radius:8px;color:#1e3a8a;font-size:14px">
                    Need something urgent? Call or WhatsApp us at <strong>01613511887</strong>.
                  </div>
                  <p style="margin:24px 0 0">Best regards,<br><strong>StockWhisk Team</strong><br>
                     <span style="color:#64748b">Your trusted shopping partner</span></p>
                </div>
                <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;text-align:center">
                  This is an automated confirmation — please do not reply to this email.
                </div>
              </div>
            </div>
            """
            ack = EmailMultiAlternatives(
                ack_subject, ack_text, from_email, [msg.email], connection=connection,
            )
            ack.attach_alternative(ack_html, "text/html")
            ack_sent = ack.send(fail_silently=False)
            log.warning("Contact auto-reply to %s sent=%s", msg.email, ack_sent)
        except Exception:
            log.exception("Contact auto-reply failed (message #%s)", msg.id)

        return Response({"status": "ok"}, status=status.HTTP_201_CREATED)

# --- Reseller Management ----------------------------------------------------

class PlatformResellerListView(APIView):
    """List all resellers for the Super Admin panel."""
    permission_classes = [IsPlatformStaff]

    def get(self, request):
        from resellers.models import ResellerProfile
        qs = ResellerProfile.objects.select_related("user").order_by("-created_at")
        
        data = [{
            "id": r.id,
            "reseller_code": r.reseller_code,
            "company_name": r.company_name,
            "user_name": f"{r.user.first_name} {r.user.last_name}".strip(),
            "user_email": r.user.email,
            "phone": r.phone,
            "status": r.status,
            "commission_rate": r.commission_rate,
            "created_at": r.created_at,
        } for r in qs]
        
        return Response({"resellers": data})


class PlatformResellerActionView(APIView):
    """Approve, Reject, or Suspend a reseller."""
    permission_classes = [IsPlatformStaff]

    def _send_status_email(self, profile, new_status):
        from django.core.mail import get_connection, EmailMultiAlternatives
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

        subject = ""
        html_content = ""
        first_name = profile.user.first_name or "Partner"

        from resellers.models import ResellerProfile
        if new_status == ResellerProfile.Status.ACTIVE:
            subject = "Your StockWhisk Reseller Account is Approved! 🎉"
            html_content = f"""
            <html>
              <body style="font-family: Arial, sans-serif; background-color: #f4f7f6; margin: 0; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                  <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #2563eb; margin: 0;">StockWhisk</h1>
                  </div>
                  <h2 style="color: #1e293b; font-size: 24px; margin-bottom: 10px;">Welcome to the Team, {{first_name}}!</h2>
                  <p style="color: #475569; font-size: 16px; line-height: 1.6;">Your reseller application has been <strong>approved</strong>. We are thrilled to have you partner with us.</p>
                  <p style="color: #475569; font-size: 16px; line-height: 1.6;">You can now log in to your Reseller Dashboard to get your unique referral link and start earning commissions.</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="https://stockwhisk.com/reseller/login" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Go to Dashboard</a>
                  </div>
                  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                  <p style="color: #94a3b8; font-size: 14px; text-align: center; margin: 0;">© 2026 StockWhisk. All rights reserved.</p>
                </div>
              </body>
            </html>
            """
        elif new_status == ResellerProfile.Status.REJECTED:
            subject = "Update on your StockWhisk Reseller Application"
            html_content = f"""
            <html>
              <body style="font-family: Arial, sans-serif; background-color: #f4f7f6; margin: 0; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                  <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #2563eb; margin: 0;">StockWhisk</h1>
                  </div>
                  <h2 style="color: #1e293b; font-size: 20px; margin-bottom: 10px;">Application Update</h2>
                  <p style="color: #475569; font-size: 16px; line-height: 1.6;">Hi {{first_name}},</p>
                  <p style="color: #475569; font-size: 16px; line-height: 1.6;">Thank you for your interest in joining the StockWhisk Reseller Program. After careful review, we regret to inform you that we cannot approve your application at this time.</p>
                  <p style="color: #475569; font-size: 16px; line-height: 1.6;">If you have any questions, please contact our support team.</p>
                  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                  <p style="color: #94a3b8; font-size: 14px; text-align: center; margin: 0;">© 2026 StockWhisk. All rights reserved.</p>
                </div>
              </body>
            </html>
            """
        else:
            return

        try:
            msg = EmailMultiAlternatives(
                subject=subject,
                body="Please view this email in a client that supports HTML.",
                from_email=from_email,
                to=[profile.user.email],
                connection=connection,
            )
            msg.attach_alternative(html_content, "text/html")
            msg.send(fail_silently=True)
        except Exception:
            pass

    def post(self, request, pk):
        from resellers.models import ResellerProfile
        try:
            profile = ResellerProfile.objects.get(pk=pk)
        except ResellerProfile.DoesNotExist:
            return Response({"detail": "Reseller not found."}, status=status.HTTP_404_NOT_FOUND)
            
        action = request.data.get("action")
        old_status = profile.status

        if action == "approve":
            profile.status = ResellerProfile.Status.ACTIVE
            if not profile.approved_at:
                profile.approved_at = timezone.now()
                profile.approved_by = request.user
        elif action == "reject":
            profile.status = ResellerProfile.Status.REJECTED
        elif action == "suspend":
            profile.status = ResellerProfile.Status.SUSPENDED
        else:
            return Response({"detail": "Invalid action."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            profile.save()
        except Exception as exc:
            import logging
            logging.getLogger("django").exception("Reseller %s action '%s' failed", pk, action)
            return Response({"detail": f"Could not {action} reseller: {exc}"}, status=status.HTTP_400_BAD_REQUEST)

        # Notifying the reseller by email must never break the approval itself —
        # an SMTP/config hiccup should not 500 the action.
        if old_status != profile.status and profile.status in [ResellerProfile.Status.ACTIVE, ResellerProfile.Status.REJECTED]:
            try:
                self._send_status_email(profile, profile.status)
            except Exception:
                import logging
                logging.getLogger("django").exception("Reseller status email failed for %s", profile.pk)

        return Response({"status": profile.status})


class PlatformResellerDetailView(APIView):
    """Full control for one reseller: profile + referred shops + commissions,
    editable commission rate and admin notes."""
    permission_classes = [IsPlatformStaff]

    def _profile(self, pk):
        from resellers.models import ResellerProfile
        return ResellerProfile.objects.select_related("user").filter(pk=pk).first()

    def get(self, request, pk):
        from resellers.models import ResellerCommission
        from resellers.serializers import ResellerCommissionSerializer

        profile = self._profile(pk)
        if not profile:
            return Response({"detail": "Reseller not found."}, status=status.HTTP_404_NOT_FOUND)

        shops = profile.shops.select_related("plan").all()
        shops_data = [{
            "id": s.id,
            "name": s.name,
            "code": s.slug,
            "plan": getattr(getattr(s, "plan", None), "name", "") or "",
            "is_active": s.is_active,
            "attributed_at": s.reseller_attributed_at,
        } for s in shops]

        comms = list(ResellerCommission.objects.filter(reseller=profile)
                     .order_by("-period_year", "-period_month", "-id"))
        commissions = ResellerCommissionSerializer(comms, many=True).data

        def _sum(rows):
            return sum((c.commission_amount or Decimal("0")) for c in rows)

        totals = {
            "shops": len(shops_data),
            "total_earned": _sum(c for c in comms if c.status != "cancelled"),
            "paid": _sum(c for c in comms if c.status == "paid"),
            "unpaid": _sum(c for c in comms if c.status in ("pending", "approved")),
        }

        return Response({
            "id": profile.id,
            "reseller_code": profile.reseller_code,
            "referral_code": profile.referral_code,
            "user_name": f"{profile.user.first_name} {profile.user.last_name}".strip() or profile.user.email,
            "user_email": profile.user.email,
            "phone": profile.phone,
            "company_name": profile.company_name,
            "address": profile.address,
            "country": profile.country,
            "commission_rate": profile.commission_rate,
            "status": profile.status,
            "notes": profile.notes,
            "can_grant_free_shops": profile.can_grant_free_shops,
            "free_shop_quota": profile.free_shop_quota,
            "shops": shops_data,
            "commissions": commissions,
            "totals": totals,
        })

    def patch(self, request, pk):
        from decimal import InvalidOperation

        profile = self._profile(pk)
        if not profile:
            return Response({"detail": "Reseller not found."}, status=status.HTTP_404_NOT_FOUND)

        fields = []
        if "commission_rate" in request.data:
            try:
                rate = Decimal(str(request.data.get("commission_rate")))
            except (InvalidOperation, TypeError):
                return Response({"detail": "Invalid commission rate."}, status=status.HTTP_400_BAD_REQUEST)
            if rate < 0 or rate > 100:
                return Response({"detail": "Commission rate must be between 0 and 100."}, status=status.HTTP_400_BAD_REQUEST)
            profile.commission_rate = rate
            fields.append("commission_rate")
        if "notes" in request.data:
            profile.notes = request.data.get("notes") or ""
            fields.append("notes")
        if "can_grant_free_shops" in request.data:
            profile.can_grant_free_shops = bool(request.data.get("can_grant_free_shops"))
            fields.append("can_grant_free_shops")
        if "free_shop_quota" in request.data:
            try:
                quota = int(request.data.get("free_shop_quota") or 0)
            except (TypeError, ValueError):
                return Response({"detail": "Invalid free-shop quota."}, status=status.HTTP_400_BAD_REQUEST)
            profile.free_shop_quota = max(0, quota)
            fields.append("free_shop_quota")

        if fields:
            profile.save(update_fields=fields + ["updated_at"])
        return Response({
            "commission_rate": profile.commission_rate, "notes": profile.notes,
            "can_grant_free_shops": profile.can_grant_free_shops,
            "free_shop_quota": profile.free_shop_quota,
        })


class PlatformCommissionActionView(APIView):
    """Approve, mark paid, or cancel a single reseller commission (payouts)."""
    permission_classes = [IsPlatformStaff]

    def post(self, request, pk):
        from resellers.models import ResellerCommission

        c = ResellerCommission.objects.filter(pk=pk).first()
        if not c:
            return Response({"detail": "Commission not found."}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get("action")
        if action == "approve":
            c.status = ResellerCommission.Status.APPROVED
            c.approved_at = timezone.now()
            c.save(update_fields=["status", "approved_at", "updated_at"])
        elif action == "paid":
            c.mark_paid(reference=request.data.get("payment_reference", ""), note=request.data.get("note", ""))
        elif action == "cancel":
            c.status = ResellerCommission.Status.CANCELLED
            c.save(update_fields=["status", "updated_at"])
        else:
            return Response({"detail": "Invalid action."}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"status": c.status})


# --- Tutorial videos ---------------------------------------------------------

class TutorialVideoSerializer(serializers.ModelSerializer):
    video_id = serializers.CharField(read_only=True)
    thumbnail_url = serializers.CharField(read_only=True)
    embed_url = serializers.CharField(read_only=True)

    class Meta:
        model = TutorialVideo
        fields = ["id", "title", "youtube_url", "sequence", "is_active",
                  "target_audience", "video_id", "thumbnail_url", "embed_url"]
        read_only_fields = ["id", "video_id", "thumbnail_url", "embed_url"]

    def validate(self, attrs):
        # Validate the resulting URL parses to a real YouTube id.
        url = attrs.get("youtube_url", getattr(self.instance, "youtube_url", ""))
        if not TutorialVideo(youtube_url=url).video_id:
            raise serializers.ValidationError(
                {"youtube_url": "That doesn't look like a valid YouTube link."})
        return attrs


class TutorialVideoViewSet(viewsets.ModelViewSet):
    permission_classes = [IsPlatformStaff]
    serializer_class = TutorialVideoSerializer
    queryset = TutorialVideo.objects.all()

    def perform_create(self, serializer):
        from django.db.models import Max
        if not serializer.validated_data.get("sequence"):
            nxt = (TutorialVideo.objects.aggregate(m=Max("sequence"))["m"] or 0) + 1
            serializer.save(sequence=max(1, nxt))
        else:
            serializer.save()


# --- Manual billing review ---------------------------------------------------

class ManualPaymentAdminSerializer(serializers.ModelSerializer):
    shop_name = serializers.CharField(source="shop.name", read_only=True)

    class Meta:
        from billing.models import ManualPayment
        model = ManualPayment
        fields = [
            "id", "shop", "shop_name", "amount", "method", "payer_reference",
            "proof", "status", "submitted_at", "reviewed_at", "rejection_reason",
        ]


class ManualPaymentAdminViewSet(viewsets.ReadOnlyModelViewSet):
    """Super Admin queue for reviewing offline payments across all shops."""

    permission_classes = [IsPlatformStaff]
    serializer_class = ManualPaymentAdminSerializer

    def get_queryset(self):
        from billing.models import ManualPayment
        with bypass_tenant_scope():
            qs = ManualPayment.objects.select_related("shop").order_by("-submitted_at")
            if s := self.request.query_params.get("status"):
                qs = qs.filter(status=s)
            return qs

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        from billing.services import approve_payment
        payment = self.get_object()
        try:
            approve_payment(payment=payment, reviewer=request.user)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        record(action=AuditLog.Action.UPDATE, actor=request.user, shop=payment.shop,
               target=payment, description="Manual payment approved")
        return Response({"status": "approved"})

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        from billing.services import reject_payment
        payment = self.get_object()
        reason = request.data.get("reason", "")
        try:
            reject_payment(payment=payment, reviewer=request.user, reason=reason)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        record(action=AuditLog.Action.UPDATE, actor=request.user, shop=payment.shop,
               target=payment, description=f"Manual payment rejected: {reason}")
        return Response({"status": "rejected"})


# --- Public API keys ---------------------------------------------------------

class APIKeyAdminViewSet(viewsets.ModelViewSet):
    """Super Admin issues / revokes public-API keys per shop (9.7)."""

    permission_classes = [IsPlatformStaff]
    http_method_names = ["get", "post", "delete"]

    def get_serializer_class(self):
        from public_api.models import APIKey

        class APIKeySerializer(serializers.ModelSerializer):
            shop_name = serializers.CharField(source="shop.name", read_only=True)

            class Meta:
                model = APIKey
                fields = ["id", "shop", "shop_name", "name", "prefix", "can_read",
                          "can_write", "resources", "rate_tier", "is_active",
                          "last_used_at", "created_at"]
                read_only_fields = ["prefix", "last_used_at"]
        return APIKeySerializer

    def get_queryset(self):
        from public_api.models import APIKey
        with bypass_tenant_scope():
            return APIKey.objects.select_related("shop").order_by("-created_at")

    def create(self, request, *args, **kwargs):
        from public_api.models import APIKey
        with bypass_tenant_scope():
            shop = Shop.objects.filter(pk=request.data.get("shop")).first()
        if shop is None:
            return Response({"detail": "Invalid shop."}, status=status.HTTP_400_BAD_REQUEST)
        instance, raw = APIKey.generate(
            shop=shop, name=request.data.get("name", "API key"),
            can_read=request.data.get("can_read", True),
            can_write=request.data.get("can_write", False),
            resources=request.data.get("resources", ["products", "inventory"]),
            rate_tier=request.data.get("rate_tier", APIKey.RateTier.STANDARD),
        )
        record(action=AuditLog.Action.CREATE, actor=request.user, shop=shop,
               target=instance, description="Issued public API key")
        data = self.get_serializer(instance).data
        data["raw_key"] = raw  # shown ONCE
        return Response(data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        record(action=AuditLog.Action.UPDATE, actor=request.user, shop=instance.shop,
               target=instance, description="Revoked public API key")
        return Response({"status": "revoked"})

    @action(detail=True, methods=["post"])
    def regenerate(self, request, pk=None):
        key = self.get_object()
        raw = key.rotate()
        record(action=AuditLog.Action.UPDATE, actor=request.user, shop=key.shop,
               target=key, description="Regenerated public API key")
        data = self.get_serializer(key).data
        data["raw_key"] = raw
        return Response(data)


class RevenueByMethodView(APIView):
    """Approved manual-payment revenue grouped by method (offline reporting)."""

    permission_classes = [IsPlatformStaff]

    def get(self, request):
        from billing.models import ManualPayment
        with bypass_tenant_scope():
            rows = list(
                ManualPayment.objects.filter(status=ManualPayment.Status.APPROVED)
                .values("method")
                .annotate(total=Coalesce(Sum("amount", output_field=_DEC),
                                         Decimal("0"), output_field=_DEC))
                .order_by("-total")
            )
        return Response({"by_method": rows})


class StopImpersonationView(APIView):
    """Legacy session-based stop (kept for the server-rendered admin)."""

    permission_classes = [IsPlatformStaff]

    def post(self, request):
        from core.middleware import IMPERSONATE_SESSION_KEY
        shop_id = request.session.pop(IMPERSONATE_SESSION_KEY, None)
        if shop_id is None:
            return Response({"status": "not_impersonating"},
                            status=status.HTTP_400_BAD_REQUEST)
        record(action=AuditLog.Action.IMPERSONATE_END, actor=request.user,
               description="Platform admin stopped impersonation",
               metadata={"shop_id": shop_id})
        return Response({"status": "stopped"})


# --- System backups (DB dump / restore) --------------------------------------

def _db_env():
    import os
    env = os.environ.copy()
    env["PGPASSWORD"] = os.environ.get("DB_PASSWORD", "stockwhisk_password")
    return env, {
        "host": os.environ.get("DB_HOST", "db"),
        "port": os.environ.get("DB_PORT", "5432"),
        "name": os.environ.get("DB_NAME", "stockwhisk"),
        "user": os.environ.get("DB_USER", "stockwhisk"),
    }



class SmtpSettingsView(APIView):
    """Get or update SMTP settings for the platform."""
    permission_classes = [IsPlatformStaff]

    def get(self, request):
        config = PlatformConfig.get_solo()
        return Response({
            "smtp_host": config.smtp_host,
            "smtp_port": config.smtp_port,
            "smtp_user": config.smtp_user,
            "smtp_password": config.smtp_password,
            "smtp_use_tls": config.smtp_use_tls,
            "smtp_default_from": config.smtp_default_from,
            "contact_email": config.contact_email,
            "contact_smtp_user": config.contact_smtp_user,
            "contact_smtp_password": config.contact_smtp_password,
            "default_trial_days": config.default_trial_days,
        })

    def put(self, request):
        config = PlatformConfig.get_solo()

        # Partial update: only touch fields actually present in the payload, so
        # saving one section (e.g. just the contact email) never wipes another.
        if "smtp_host" in request.data:
            config.smtp_host = (request.data.get("smtp_host") or "").strip()
        if "smtp_port" in request.data:
            try:
                config.smtp_port = int(request.data.get("smtp_port", 587))
            except (ValueError, TypeError):
                pass
        if "smtp_user" in request.data:
            config.smtp_user = (request.data.get("smtp_user") or "").strip()
        if "smtp_password" in request.data:
            config.smtp_password = (request.data.get("smtp_password") or "").strip()
        if "smtp_default_from" in request.data:
            config.smtp_default_from = (request.data.get("smtp_default_from") or "").strip()

        if "contact_email" in request.data:
            config.contact_email = (request.data.get("contact_email") or "").strip()
        if "contact_smtp_user" in request.data:
            config.contact_smtp_user = (request.data.get("contact_smtp_user") or "").strip()
        if "contact_smtp_password" in request.data:
            config.contact_smtp_password = (request.data.get("contact_smtp_password") or "").strip()

        trial_days = request.data.get("default_trial_days")
        if trial_days is not None:
            try:
                config.default_trial_days = max(0, int(trial_days))
            except (ValueError, TypeError):
                pass

        # Boolean handling
        tls_val = request.data.get("smtp_use_tls")
        if tls_val is not None:
            config.smtp_use_tls = str(tls_val).lower() == "true" or tls_val is True
            
        config.save()
        return Response({"status": "updated"})

class TestSmtpConnectionView(APIView):
    """Test SMTP connection using saved settings."""
    permission_classes = [IsPlatformStaff]

    def post(self, request):
        config = PlatformConfig.get_solo()
        if not config.smtp_host or not config.smtp_user:
            return Response({"detail": "SMTP host and user are not configured."}, status=400)
            
        from django.core.mail import get_connection, EmailMessage
        import traceback
        
        try:
            connection = get_connection(
                backend='platform_admin.email_backend.UnverifiedSTARTTLSBackend',
                host=config.smtp_host,
                port=config.smtp_port,
                username=config.smtp_user,
                password=config.smtp_password,
                use_tls=config.smtp_use_tls,
                fail_silently=False
            )
            msg = EmailMessage(
                subject='Test Email from StockWhisk',
                body='This is a test email to verify SMTP configuration.',
                from_email=config.smtp_default_from or config.smtp_user,
                to=[config.smtp_user],
                connection=connection
            )
            msg.send(fail_silently=False)
            return Response({"status": "success", "detail": "Test email sent successfully!"})
        except Exception as e:
            error_trace = traceback.format_exc()
            return Response({
                "status": "error",
                "detail": str(e),
                "trace": error_trace
            }, status=500)


class TestContactSmtpView(APIView):
    """Send a test email using the CONTACT mailbox SMTP login, so the admin can
    confirm contact emails will actually send from contact@."""
    permission_classes = [IsPlatformStaff]

    def post(self, request):
        config = PlatformConfig.get_solo()
        from_addr = (config.contact_email or "").strip()
        if not from_addr:
            return Response({"detail": "Set the contact email address first."}, status=400)
        if not config.contact_smtp_user:
            return Response({
                "detail": "No contact SMTP login is set, so contact emails send from the "
                          "noreply address. Add the contact SMTP username & password to send "
                          "from the contact mailbox."
            }, status=400)
        if not config.smtp_host:
            return Response({"detail": "Set the SMTP host in the section above first."}, status=400)

        from django.core.mail import get_connection, EmailMessage
        import traceback
        try:
            connection = get_connection(
                backend='platform_admin.email_backend.UnverifiedSTARTTLSBackend',
                host=config.smtp_host,
                port=config.smtp_port,
                username=config.contact_smtp_user,
                password=config.contact_smtp_password,
                use_tls=config.smtp_use_tls,
                fail_silently=False,
            )
            EmailMessage(
                subject='StockWhisk contact SMTP test',
                body='If you received this, contact emails send from this mailbox correctly.',
                from_email=from_addr,
                to=[from_addr],
                connection=connection,
            ).send(fail_silently=False)
            return Response({"status": "success", "detail": f"Test email sent from {from_addr}!"})
        except Exception as e:
            return Response({"status": "error", "detail": str(e), "trace": traceback.format_exc()}, status=500)


from .models import PlatformConfig

class PlatformConfigView(APIView):
    """Get or update platform-wide settings."""
    permission_classes = [IsPlatformStaff]

    def get(self, request):
        config = PlatformConfig.get_solo()
        return Response({
            "drive_folder_id": config.drive_folder_id,
            "drive_client_id": config.drive_client_id,
            "drive_client_secret": config.drive_client_secret,
            "has_refresh_token": bool(config.drive_refresh_token),
            "drive_backup_enabled": config.drive_backup_enabled,
            "drive_backup_interval_minutes": config.drive_backup_interval_minutes,
        })

    def put(self, request):
        config = PlatformConfig.get_solo()
        config.drive_client_id = request.data.get("drive_client_id", config.drive_client_id)
        config.drive_client_secret = request.data.get("drive_client_secret", config.drive_client_secret)
        config.drive_folder_id = request.data.get("drive_folder_id", config.drive_folder_id)
        
        if "drive_backup_enabled" in request.data:
            config.drive_backup_enabled = str(request.data.get("drive_backup_enabled")).lower() == "true"
        if "drive_backup_interval_minutes" in request.data:
            try:
                config.drive_backup_interval_minutes = int(request.data.get("drive_backup_interval_minutes"))
            except ValueError:
                pass
        config.save()
        
        # Update Celery Beat Schedule
        from django_celery_beat.models import PeriodicTask, IntervalSchedule
        task_name = "automated-drive-backup-dynamic"
        task_path = "platform_admin.tasks.perform_drive_backup"
        
        if not config.drive_backup_enabled:
            PeriodicTask.objects.filter(name=task_name).update(enabled=False)
        else:
            schedule, _ = IntervalSchedule.objects.get_or_create(
                every=config.drive_backup_interval_minutes,
                period=IntervalSchedule.MINUTES
            )
            task, created = PeriodicTask.objects.get_or_create(
                name=task_name,
                defaults={'task': task_path, 'interval': schedule, 'enabled': True}
            )
            if not created:
                task.interval = schedule
                task.enabled = True
                task.save()

        return Response({"status": "updated"})


from google_auth_oauthlib.flow import Flow

class DriveAuthStartView(APIView):
    permission_classes = [IsPlatformStaff]

    def post(self, request):
        config = PlatformConfig.get_solo()
        if not config.drive_client_id or not config.drive_client_secret:
            return Response({"detail": "Client ID and Secret are required."}, status=400)
            
        redirect_uri = request.data.get("redirect_uri")
        if not redirect_uri:
            return Response({"detail": "redirect_uri is required."}, status=400)

        client_config = {
            "web": {
                "client_id": config.drive_client_id,
                "client_secret": config.drive_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [redirect_uri],
            }
        }
        flow = Flow.from_client_config(
            client_config,
            scopes=['https://www.googleapis.com/auth/drive.file']
        )
        flow.redirect_uri = redirect_uri
        auth_url, _ = flow.authorization_url(prompt='consent', access_type='offline')
        return Response({"auth_url": auth_url})

class DriveAuthCallbackView(APIView):
    permission_classes = [IsPlatformStaff]

    def post(self, request):
        code = request.data.get("code")
        redirect_uri = request.data.get("redirect_uri")
        if not code or not redirect_uri:
            return Response({"detail": "code and redirect_uri are required."}, status=400)

        config = PlatformConfig.get_solo()
        client_config = {
            "web": {
                "client_id": config.drive_client_id,
                "client_secret": config.drive_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [redirect_uri],
            }
        }
        
        try:
            flow = Flow.from_client_config(
                client_config,
                scopes=['https://www.googleapis.com/auth/drive.file']
            )
            flow.redirect_uri = redirect_uri
            flow.fetch_token(code=code)
            creds = flow.credentials
            
            if not creds.refresh_token:
                return Response({"detail": "No refresh token returned. Revoke access in your Google account and try again."}, status=400)
                
            config.drive_refresh_token = creds.refresh_token
            config.save()
            return Response({"status": "success"})
        except Exception as e:
            return Response({"detail": f"Failed to authenticate: {str(e)}"}, status=400)


class TriggerDriveBackupView(APIView):
    """Manually trigger a Google Drive backup task immediately."""
    permission_classes = [IsPlatformStaff]

    def post(self, request):
        from .tasks import perform_drive_backup
        
        # Run it synchronously to give immediate feedback for manual triggers
        success, msg = perform_drive_backup()
        
        if success:
            return Response({"status": "success", "detail": msg})
        else:
            return Response({"detail": msg}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BackupDownloadView(APIView):
    """Stream a full pg_dump SQL backup to the caller (staff only)."""

    permission_classes = [IsPlatformStaff]

    def get(self, request):
        import logging
        import subprocess
        import time

        from django.http import StreamingHttpResponse

        env, db = _db_env()
        filename = f"stockwhisk_backup_{time.strftime('%Y%m%d-%H%M%S')}.sql"
        try:
            proc = subprocess.Popen(
                ["pg_dump", "-h", db["host"], "-p", db["port"], "-U", db["user"],
                 "-d", db["name"], "--clean", "--if-exists", "--no-owner",
                 "--no-privileges"],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env,
            )
        except FileNotFoundError:
            return Response(
                {"detail": "Backup failed: postgresql-client is not installed on the server."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        def stream():
            for chunk in iter(lambda: proc.stdout.read(8192), b""):
                yield chunk
            proc.wait()
            if proc.returncode != 0:
                logging.getLogger("django").error(
                    "pg_dump failed: %s", proc.stderr.read().decode(errors="replace"))

        resp = StreamingHttpResponse(stream(), content_type="application/sql")
        resp["Content-Disposition"] = f'attachment; filename="{filename}"'
        return resp


class BackupRestoreView(APIView):
    """Restore the database from an uploaded .sql dump (staff only)."""

    permission_classes = [IsPlatformStaff]

    def post(self, request):
        import os
        import subprocess
        import tempfile

        sql_file = request.FILES.get("backup_file")
        if not sql_file:
            return Response({"detail": "No file uploaded."},
                            status=status.HTTP_400_BAD_REQUEST)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".sql") as tmp:
            for chunk in sql_file.chunks():
                tmp.write(chunk)
            tmp_path = tmp.name

        env, db = _db_env()
        base = ["-h", db["host"], "-p", db["port"], "-U", db["user"], "-d", db["name"]]
        try:
            kill = ("SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                    "WHERE datname = current_database() AND pid <> pg_backend_pid();")
            subprocess.run(["psql", *base, "-c", kill], env=env, check=False,
                           capture_output=True)
            result = subprocess.run(["psql", *base, "-f", tmp_path], env=env,
                                    capture_output=True, text=True)
        except FileNotFoundError:
            os.remove(tmp_path)
            return Response(
                {"detail": "Restore failed: postgresql-client is not installed on the server."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

        if result.returncode == 0:
            return Response({"status": "restored",
                             "detail": "Database restored. You may need to log in again."})
        return Response({"detail": f"Restore completed with errors: {result.stderr[:300]}"},
                        status=status.HTTP_400_BAD_REQUEST)

class MediaBackupDownloadView(APIView):
    """Create a zip of the media folder and serve it as a download."""
    permission_classes = [IsPlatformStaff]

    def get(self, request):
        import shutil
        import tempfile
        import os
        import time
        from django.conf import settings
        from django.http import FileResponse

        filename = f"stockwhisk_media_{time.strftime('%Y%m%d-%H%M%S')}.zip"
        
        # Create a temporary directory
        tmp_dir = tempfile.mkdtemp()
        tmp_path = os.path.join(tmp_dir, "media")
        
        if not os.path.exists(settings.MEDIA_ROOT):
            os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
        
        # This will create tmp_path + ".zip"
        shutil.make_archive(tmp_path, 'zip', settings.MEDIA_ROOT)
        zip_file_path = tmp_path + ".zip"

        try:
            # We open the file and pass it to FileResponse. 
            # FileResponse will close it automatically.
            f = open(zip_file_path, 'rb')
            response = FileResponse(f, content_type="application/zip")
            response["Content-Disposition"] = f'attachment; filename="{filename}"'
            return response
        except Exception as e:
            return Response({"detail": f"Failed to generate zip: {str(e)}"}, status=500)
        finally:
            # We cannot delete the zip file immediately because FileResponse needs to stream it.
            # Usually we'd want a cleanup task or rely on OS temp file cleanup, but we can delete the tmp_dir.
            shutil.rmtree(tmp_dir, ignore_errors=True)


class MediaBackupRestoreView(APIView):
    """Restore media files from an uploaded .zip backup."""
    permission_classes = [IsPlatformStaff]

    def post(self, request):
        import zipfile
        import os
        from django.conf import settings

        zip_file = request.FILES.get("backup_file")
        if not zip_file:
            return Response({"detail": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with zipfile.ZipFile(zip_file, 'r') as zip_ref:
                # Ensure the media root exists
                os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
                # Extract all files into the media directory
                zip_ref.extractall(settings.MEDIA_ROOT)
            return Response({"status": "restored", "detail": "Media files restored successfully."})
        except zipfile.BadZipFile:
            return Response({"detail": "Invalid ZIP file uploaded."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": f"Failed to restore media: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# --- Blog Posts --------------------------------------------------------------

from .models import BlogPost, SoftwareRelease

class BlogPostSerializer(serializers.ModelSerializer):
    class Meta:
        model = BlogPost
        fields = '__all__'

class BlogPostAdminViewSet(viewsets.ModelViewSet):
    """CRUD for super admins to manage marketing blogs."""
    permission_classes = [IsPlatformStaff]
    serializer_class = BlogPostSerializer
    queryset = BlogPost.objects.all()
    lookup_field = 'slug'

class PublicBlogViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only view for the public marketing site."""
    permission_classes = [] # AllowAny
    serializer_class = BlogPostSerializer
    lookup_field = 'slug'

    def get_queryset(self):
        return BlogPost.objects.filter(is_published=True).order_by('-published_at')

class PublicPricingPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = [
            "id", "name", "tier", "price_monthly", "price_yearly",
            "features", "max_users", "max_branches", "max_products", "highlights",
            "show_users", "show_branches", "show_products", "yearly_discount_percent"
        ]

class PublicPricingPlanViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only view for public pricing page."""
    permission_classes = [] # AllowAny
    serializer_class = PublicPricingPlanSerializer
    queryset = SubscriptionPlan.objects.filter(is_active=True).order_by('price_monthly')


class PublicSiteConfigView(APIView):
    """Public marketing config (no auth) — currently the free-trial length, so
    the homepage / pricing page reflect the Platform Settings value."""
    permission_classes = []
    authentication_classes = []

    def get(self, request):
        config = PlatformConfig.get_solo()
        offer = None
        if config.offer_enabled and config.offer_file:
            url = request.build_absolute_uri(config.offer_file.url)
            offer = {"url": url, "is_pdf": str(config.offer_file.name).lower().endswith(".pdf")}
        return Response({
            "trial_days": config.default_trial_days,
            "offer": offer,
            "logo": request.build_absolute_uri(config.logo.url) if config.logo else None,
            "favicon": request.build_absolute_uri(config.favicon.url) if config.favicon else None,
            "industry_images": {k: request.build_absolute_uri(v) for k, v in (config.industry_images or {}).items() if v},
            "pricing_content": {**DEFAULT_PRICING_CONTENT, **(config.pricing_content or {})},
        })


DEFAULT_PRICING_CONTENT = {
    "hero_title": "Simple, transparent pricing",
    "hero_subtitle": "Choose the perfect plan for your retail business. No hidden fees.",
    "trial_badge": "🎉 Start with a {days}-day free trial — no card required",
    "yearly_save_label": "Save 20%",
    "features_heading": "Features Included",
    "cta_label": "Get Started",
    "popular_badge": "Most Popular",
}


class PricingContentView(APIView):
    """Staff-editable copy for the public pricing page."""
    permission_classes = [IsPlatformStaff]

    def get(self, request):
        config = PlatformConfig.get_solo()
        return Response({
            "pricing_content": {**DEFAULT_PRICING_CONTENT, **(config.pricing_content or {})},
            "defaults": DEFAULT_PRICING_CONTENT,
        })

    def put(self, request):
        config = PlatformConfig.get_solo()
        incoming = request.data.get("pricing_content") or {}
        # Keep only known keys, coerce to trimmed strings.
        cleaned = {k: str(incoming[k]).strip() for k in DEFAULT_PRICING_CONTENT if k in incoming}
        config.pricing_content = cleaned
        config.save(update_fields=["pricing_content"])
        return Response({"pricing_content": {**DEFAULT_PRICING_CONTENT, **cleaned}})

from .mail_service import MailServerConfigService

class MailAccountView(APIView):
    permission_classes = [IsPlatformStaff]
    
    def get(self, request):
        service = MailServerConfigService()
        return Response(service.list_accounts())

    def post(self, request):
        service = MailServerConfigService()
        email = request.data.get('email')
        password = request.data.get('password')
        quota = request.data.get('quota')
        if not email or not password:
            return Response({'detail': 'Email and password required'}, status=400)
        try:
            service.add_account(email, password, quota)
            return Response({'status': 'success'})
        except PermissionError:
            return Response(
                {'detail': "Can't write the mail config file — the backend has no write "
                           "permission on the mounted mailserver-config directory."},
                status=500)
        except Exception as e:
            return Response({'detail': str(e)}, status=400)

    def patch(self, request):
        service = MailServerConfigService()
        email = request.data.get('email')
        password = request.data.get('password')
        quota = request.data.get('quota')
        if not email:
            return Response({'detail': 'Email required'}, status=400)

        if password:
            service.update_password(email, password)
        if quota is not None:
            service.update_quota(email, quota)
        return Response({'status': 'success'})

    def delete(self, request):
        service = MailServerConfigService()
        email = request.data.get('email')
        if not email:
            return Response({'detail': 'Email required'}, status=400)
        service.delete_account(email)
        return Response({'status': 'success'})

class MailSSOView(APIView):
    permission_classes = [IsPlatformStaff]

    def post(self, request):
        import hmac, hashlib, time
        from django.conf import settings
        email = request.data.get('email')
        if not email:
            return Response({'error': 'Email required'}, status=400)
        # Generate a short-lived signed token (60s TTL)
        ts = str(int(time.time()))
        sig = hmac.new(
            settings.SECRET_KEY.encode(),
            f"{email}:{ts}".encode(),
            hashlib.sha256
        ).hexdigest()
        token = f"{email}:{ts}:{sig}"
        import urllib.parse
        return Response({'sso_url': f"/sso?token={urllib.parse.quote(token)}"})


from django.views import View
from django.http import HttpResponse, HttpResponseForbidden
from django.utils.html import escape

class MailSSORedirectView(View):
    """
    Hosted at mail.stockwhisk.com/sso (Caddy routes this to Django).

    Strategy (Client-side iframe auto-login):
      1. Serve an HTML page on mail.stockwhisk.com/sso (same origin as Roundcube).
      2. The page embeds a hidden iframe pointing to /?_task=login.
      3. The browser naturally creates the Roundcube session and stores the cookie.
      4. The parent page accesses the iframe's DOM, fills in master credentials, and submits the form.
      5. The iframe logs in, and the parent page redirects to /?_task=mail.

    Requires: auth_master_user_separator = * in dovecot.cf
    Requires: master_admin:{PLAIN}... in dovecot-master-users
    """

    def get(self, request):
        import hmac, hashlib, time
        from django.conf import settings

        token = request.GET.get('token', '')

        # Validate signed token (5-min TTL)
        try:
            parts = token.split(':', 2)
            if len(parts) != 3:
                raise ValueError("bad format")
            email, ts, sig = parts
            if int(time.time()) - int(ts) > 300:
                return HttpResponseForbidden("SSO token expired. Click 'Login As' again.")
            expected = hmac.new(
                settings.SECRET_KEY.encode(),
                f"{email}:{ts}".encode(),
                hashlib.sha256
            ).hexdigest()
            if not hmac.compare_digest(sig, expected):
                raise ValueError("bad sig")
        except Exception as exc:
            return HttpResponseForbidden(f"Invalid SSO token: {exc}")

        master_user = f"{email}*master_admin"
        master_pass = "stockwhisk_master_2026"

        # --- Server-side login into Roundcube, then forward the session cookie ---
        # Django talks to Roundcube over the internal Docker network, logs in as the
        # Dovecot master user, and hands the resulting session cookies to the browser.
        # This works only because ip_check / ua_check are disabled in Roundcube's
        # custom.inc.php (the browser's IP/UA differ from Django's).
        import os
        import re
        import requests
        from django.http import HttpResponseRedirect

        internal = os.environ.get("ROUNDCUBE_INTERNAL_URL", "http://roundcube").rstrip("/")
        public = os.environ.get("ROUNDCUBE_PUBLIC_URL", "https://mail.stockwhisk.com").rstrip("/")

        def _fail(detail):
            body = (
                "<!DOCTYPE html><meta charset='utf-8'>"
                "<div style='font-family:sans-serif;max-width:640px;margin:80px auto;"
                "color:#e2e8f0;background:#0f172a;padding:32px;border-radius:12px'>"
                "<h2 style='color:#f87171;margin-top:0'>Webmail login failed</h2>"
                f"<p>{escape(detail)}</p>"
                "<p style='color:#94a3b8;font-size:14px'>Go back and click "
                "&ldquo;Login As&rdquo; again. If this keeps happening, verify master-user "
                "auth on the server:<br><code>docker exec mailserver doveadm auth test "
                f"'{escape(master_user)}' '&lt;master-pass&gt;'</code></p></div>"
            )
            return HttpResponse(body, status=502, content_type="text/html")

        try:
            rc = requests.Session()
            # 1) Fetch the login page to obtain a session + request token.
            r1 = rc.get(f"{internal}/?_task=login", timeout=10)
            # Match the _token hidden input regardless of attribute order.
            m = (re.search(r'name="_token"\s+value="([^"]+)"', r1.text)
                 or re.search(r'value="([^"]+)"\s+name="_token"', r1.text))
            if not m:
                return _fail("Could not obtain a security token from Roundcube.")
            rc_token = m.group(1)

            # 2) Submit the master-user credentials.
            r2 = rc.post(
                f"{internal}/?_task=login&_action=login",
                data={
                    "_token": rc_token,
                    "_task": "login",
                    "_action": "login",
                    "_timezone": "UTC",
                    "_url": "",
                    "_user": master_user,
                    "_pass": master_pass,
                },
                timeout=10,
                allow_redirects=True,
            )

            # 3) Success is signalled by a real (non-deleted) auth cookie.
            sessauth = rc.cookies.get("roundcube_sessauth")
            if not sessauth or sessauth == "-del-":
                return _fail(
                    "Roundcube rejected the master login. This almost always means the "
                    "Dovecot master account is not authenticating — run the doveadm auth "
                    "test shown below."
                )

            # 4) Forward Roundcube's session cookies to the browser (on the public host).
            response = HttpResponseRedirect(f"{public}/?_task=mail")
            for name, value in rc.cookies.get_dict().items():
                response.set_cookie(
                    name, value,
                    path="/",
                    secure=True,
                    httponly=True,
                    samesite="Lax",
                )
            return response
        except requests.RequestException as exc:
            return _fail(f"Could not reach Roundcube internally ({internal}): {exc}")

# --- Software Releases -------------------------------------------------------

class SoftwareReleaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = SoftwareRelease
        fields = '__all__'

class SoftwareReleaseAdminViewSet(viewsets.ModelViewSet):
    """CRUD for super admins to manage software downloads."""
    permission_classes = [IsPlatformStaff]
    serializer_class = SoftwareReleaseSerializer
    queryset = SoftwareRelease.objects.all()

class PublicSoftwareReleaseViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only view for the public marketing site."""
    permission_classes = [] # AllowAny
    serializer_class = SoftwareReleaseSerializer

    def get_queryset(self):
        return SoftwareRelease.objects.filter(is_active=True).order_by('-created_at')

# --- Shop Data Management -------------------------------------------------------

from platform_admin.models import ShopDataBackup, ShopDataOperation
from platform_admin.tasks import clear_shop_data_task, restore_shop_data_task
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status

class ShopDataBackupSerializer(serializers.ModelSerializer):
    shop_name = serializers.CharField(source="shop.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)

    class Meta:
        model = ShopDataBackup
        fields = "__all__"

class ShopDataOperationSerializer(serializers.ModelSerializer):
    shop_name = serializers.CharField(source="shop.name", read_only=True)
    initiated_by_name = serializers.CharField(source="initiated_by.get_full_name", read_only=True)

    class Meta:
        model = ShopDataOperation
        fields = "__all__"

class ShopDataManagementViewSet(viewsets.ViewSet):
    """
    Superadmin API for clearing and restoring a shop's operational data.
    """
    permission_classes = [IsPlatformStaff]

    def list(self, request):
        backups = ShopDataBackup.objects.exclude(status=ShopDataBackup.Status.DELETED).order_by("-created_at")[:50]
        operations = ShopDataOperation.objects.order_by("-started_at")[:50]
        return Response({
            "backups": ShopDataBackupSerializer(backups, many=True).data,
            "operations": ShopDataOperationSerializer(operations, many=True).data,
        })

    @action(detail=False, methods=["post"])
    def clear(self, request):
        shop_id = request.data.get("shop_id")
        password = request.data.get("password")
        confirmation_text = request.data.get("confirmation_text")

        if not shop_id:
            return Response({"error": "Shop ID is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        if confirmation_text != "CLEAR SHOP DATA":
            return Response({"error": "Invalid confirmation text."}, status=status.HTTP_400_BAD_REQUEST)
        
        if not request.user.check_password(password):
            return Response({"error": "Invalid superadmin password."}, status=status.HTTP_403_FORBIDDEN)

        try:
            # Check for active operations on this shop
            active_ops = ShopDataOperation.objects.filter(
                shop_id=shop_id, 
                status=ShopDataOperation.Status.STARTED
            ).exists()
            
            if active_ops:
                return Response({"error": "An operation is already running for this shop. Please wait."}, status=status.HTTP_409_CONFLICT)

            # Dispatch Celery task
            clear_shop_data_task.delay(shop_id, request.user.id)
            
            return Response({"message": "Data clear operation has been queued."})
        except Exception as e:
            return Response({"error": f"Internal Server Error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=["post"])
    def restore(self, request):
        backup_id = request.data.get("backup_id")
        password = request.data.get("password")

        if not backup_id:
            return Response({"error": "Backup ID is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        if not request.user.check_password(password):
            return Response({"error": "Invalid superadmin password."}, status=status.HTTP_403_FORBIDDEN)

        try:
            backup = ShopDataBackup.objects.get(id=backup_id)
        except ShopDataBackup.DoesNotExist:
            return Response({"error": "Backup not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": f"Internal Server Error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            if backup.is_expired or backup.status == ShopDataBackup.Status.DELETED:
                return Response({"error": "This backup has expired or been deleted."}, status=status.HTTP_400_BAD_REQUEST)

            # Check for active operations on this shop
            active_ops = ShopDataOperation.objects.filter(
                shop_id=backup.shop_id, 
                status=ShopDataOperation.Status.STARTED
            ).exists()
            
            if active_ops:
                return Response({"error": "An operation is already running for this shop. Please wait."}, status=status.HTTP_409_CONFLICT)

            # Dispatch Celery task
            restore_shop_data_task.delay(backup.id, request.user.id)
            
            return Response({"message": "Data restore operation has been queued."})
        except Exception as e:
            return Response({"error": f"Internal Server Error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

