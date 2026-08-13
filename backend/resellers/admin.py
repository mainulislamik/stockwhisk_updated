from django.contrib import admin
from django.utils import timezone

from .models import ResellerCommission, ResellerProfile


@admin.register(ResellerProfile)
class ResellerProfileAdmin(admin.ModelAdmin):
    list_display = ("reseller_code", "user_email", "company_name", "status",
                    "commission_rate", "shop_count", "referral_code", "created_at")
    list_filter = ("status",)
    search_fields = ("reseller_code", "referral_code", "user__email", "company_name")
    readonly_fields = ("reseller_code", "referral_code", "referral_link",
                       "approved_at", "approved_by", "created_at", "updated_at")
    fields = ("reseller_code", "referral_code", "referral_link", "user",
              "company_name", "phone", "address", "country",
              "commission_rate", "status", "approved_at", "approved_by", "notes")
    actions = ["approve", "reject", "suspend", "activate"]

    @admin.display(description="Email")
    def user_email(self, obj):
        return obj.user.email

    @admin.display(description="Shops")
    def shop_count(self, obj):
        return obj.shops.count()

    def _set_status(self, request, queryset, new_status):
        for p in queryset:
            p.status = new_status
            if new_status == ResellerProfile.Status.ACTIVE and not p.approved_at:
                p.approved_at = timezone.now()
                p.approved_by = request.user
            p.save()

    @admin.action(description="Approve → Active")
    def approve(self, request, queryset):
        self._set_status(request, queryset, ResellerProfile.Status.ACTIVE)

    @admin.action(description="Reject")
    def reject(self, request, queryset):
        self._set_status(request, queryset, ResellerProfile.Status.REJECTED)

    @admin.action(description="Suspend")
    def suspend(self, request, queryset):
        self._set_status(request, queryset, ResellerProfile.Status.SUSPENDED)

    @admin.action(description="Re-activate")
    def activate(self, request, queryset):
        self._set_status(request, queryset, ResellerProfile.Status.ACTIVE)


@admin.register(ResellerCommission)
class ResellerCommissionAdmin(admin.ModelAdmin):
    list_display = ("reseller", "shop_name", "period", "gross_profit",
                    "commission_rate", "commission_amount", "status")
    list_filter = ("status", "period_year", "period_month")
    search_fields = ("reseller__reseller_code", "shop_name", "payment_reference")
    readonly_fields = ("reseller", "shop", "shop_name", "period_year", "period_month",
                       "gross_profit", "commission_rate", "commission_amount",
                       "approved_at", "paid_at", "created_at", "updated_at")
    fields = readonly_fields + ("status", "payment_reference", "notes")
    actions = ["approve_commissions", "mark_paid", "cancel_commissions"]

    @admin.display(description="Period")
    def period(self, obj):
        return f"{obj.period_year}-{obj.period_month:02d}"

    # Financial records are never deleted — only cancelled.
    def has_delete_permission(self, request, obj=None):
        return False

    @admin.action(description="Approve")
    def approve_commissions(self, request, queryset):
        queryset.exclude(status=ResellerCommission.Status.PAID).update(
            status=ResellerCommission.Status.APPROVED, approved_at=timezone.now())

    @admin.action(description="Mark as Paid")
    def mark_paid(self, request, queryset):
        for c in queryset.exclude(status=ResellerCommission.Status.CANCELLED):
            c.mark_paid()

    @admin.action(description="Cancel")
    def cancel_commissions(self, request, queryset):
        queryset.exclude(status=ResellerCommission.Status.PAID).update(
            status=ResellerCommission.Status.CANCELLED)
