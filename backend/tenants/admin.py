from django.contrib import admin

from .models import Branch, Shop, Subscription, SubscriptionPlan


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ("name", "tier", "price_monthly", "price_yearly", "is_active")
    list_filter = ("tier", "is_active")


class BranchInline(admin.TabularInline):
    model = Branch
    extra = 0


@admin.register(Shop)
class ShopAdmin(admin.ModelAdmin):
    list_display = ("name", "business_type", "plan", "is_active", "trial_ends_at", "created_at")
    list_filter = ("business_type", "is_active", "plan")
    search_fields = ("name", "slug", "email", "phone")
    prepopulated_fields = {"slug": ("name",)}
    fieldsets = (
        ("Basic Information", {
            "fields": ("name", "slug", "business_type", "email", "phone", "address", "is_active", "plan", "trial_ends_at", "suspended_at")
        }),
        ("Modular Entitlements & Overrides", {
            "fields": ("modules",),
            "description": "JSON map of specific module keys enabled/disabled for this shop."
        }),
        ("Legacy Feature Flags", {
            "fields": (
                "manufacturing_enabled",
                "service_enabled",
                "finance_enabled",
                "reports_enabled",
                "mobile_repair_master_enabled",
                "mobile_repair_enabled",
                "emi_enabled",
                "delivery_enabled",
                "whatsapp_invoice_enabled",
            ),
            "classes": ("collapse",),
        }),
    )
    inlines = [BranchInline]


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ("name", "shop", "is_main", "is_active")
    list_filter = ("is_main", "is_active")
    search_fields = ("name", "shop__name")


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ("shop", "plan", "status", "cycle", "current_period_end", "is_current")
    list_filter = ("status", "cycle", "is_current")
    search_fields = ("shop__name",)
