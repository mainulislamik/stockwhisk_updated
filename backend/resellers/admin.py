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

        if new_status == ResellerProfile.Status.ACTIVE:
            subject = "Your StockWhisk Reseller Account is Approved! 🎉"
            html_content = f"""
            <html>
              <body style="font-family: Arial, sans-serif; background-color: #f4f7f6; margin: 0; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                  <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #2563eb; margin: 0;">StockWhisk</h1>
                  </div>
                  <h2 style="color: #1e293b; font-size: 24px; margin-bottom: 10px;">Welcome to the Team, {first_name}!</h2>
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
                  <p style="color: #475569; font-size: 16px; line-height: 1.6;">Hi {first_name},</p>
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

    def _set_status(self, request, queryset, new_status):
        for p in queryset:
            old_status = p.status
            p.status = new_status
            if new_status == ResellerProfile.Status.ACTIVE and not p.approved_at:
                p.approved_at = timezone.now()
                p.approved_by = request.user
            p.save()
            if old_status != new_status and new_status in [ResellerProfile.Status.ACTIVE, ResellerProfile.Status.REJECTED]:
                self._send_status_email(p, new_status)

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
