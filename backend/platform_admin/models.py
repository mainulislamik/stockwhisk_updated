import re
import uuid

from django.db import models
from django.utils import timezone

from core.models import TimeStampedModel

def _extract_youtube_id(url: str) -> str:
    if not url:
        return ""
    url = url.strip()
    patterns = [
        r"(?:v=|\/v\/|youtu\.be\/|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})",
        r"^([A-Za-z0-9_-]{11})$",
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return ""


class TutorialVideo(TimeStampedModel):
    """A help/tutorial video managed platform-wide by super admins and shown to
    every shop on their dashboard, ordered by ``sequence`` (serial number)."""

    class TargetAudience(models.TextChoices):
        ALL = "all", "All (Public, Shop & Reseller)"
        PUBLIC = "public", "Public Website Only"
        BOTH = "both", "Both (Shop & Reseller)"
        SHOP = "shop", "Shop Only"
        RESELLER = "reseller", "Reseller Only"

    title = models.CharField(max_length=200)
    youtube_url = models.URLField(help_text="Full YouTube link (watch, youtu.be, or embed).")
    sequence = models.PositiveIntegerField(
        default=1, db_index=True, help_text="Play order — lower numbers show first."
    )
    is_active = models.BooleanField(default=True)
    target_audience = models.CharField(
        max_length=15, 
        choices=TargetAudience.choices, 
        default=TargetAudience.ALL,
        help_text="Who should see this tutorial?"
    )

    class Meta:
        ordering = ["sequence", "id"]
        indexes = [models.Index(fields=["is_active", "sequence"])]

    def __str__(self):
        return f"{self.sequence}. {self.title}"

    @property
    def video_id(self):
        """Extract the 11-char YouTube id from any common URL shape."""
        return _extract_youtube_id(self.youtube_url or "")

    @property
    def embed_url(self):
        vid = self.video_id
        return f"https://www.youtube.com/embed/{vid}" if vid else ""

    @property
    def thumbnail_url(self):
        vid = self.video_id
        return f"https://img.youtube.com/vi/{vid}/hqdefault.jpg" if vid else ""


class ContactMessage(TimeStampedModel):
    """Public contact-form submission. Platform-level (no shop). Read + deleted
    only by platform staff from the Super Admin dashboard."""

    name = models.CharField(max_length=150)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True)
    subject = models.CharField(max_length=200, blank=True)
    message = models.TextField()
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["is_read", "created_at"])]

    def __str__(self):
        return f"{self.name} <{self.email}>"


class PlatformConfig(TimeStampedModel):
    """
    Singleton model for platform-wide configuration.
    Stores Google Drive service account credentials and backup folder ID.
    """
    drive_folder_id = models.CharField(max_length=255, blank=True, default="")
    drive_client_id = models.CharField(max_length=255, blank=True, default="")
    drive_client_secret = models.CharField(max_length=255, blank=True, default="")
    drive_refresh_token = models.TextField(blank=True, default="")
    
    # Automated Google Drive Backup Settings
    drive_backup_enabled = models.BooleanField(default=False)
    drive_backup_interval_minutes = models.PositiveIntegerField(default=1440)  # Default: 24 hours
    last_drive_backup_at = models.DateTimeField(null=True, blank=True)
    last_drive_backup_status = models.CharField(max_length=255, blank=True, default="")
    last_drive_backup_error = models.TextField(blank=True, default="")

    # SMTP Settings
    smtp_host = models.CharField(max_length=255, blank=True, default="")
    smtp_port = models.PositiveIntegerField(default=587)
    smtp_user = models.CharField(max_length=255, blank=True, default="")
    smtp_password = models.CharField(max_length=255, blank=True, default="")
    smtp_use_tls = models.BooleanField(default=True)
    smtp_default_from = models.CharField(max_length=255, blank=True, default="noreply@stockwhisk.com")

    # Destination inbox for public contact-form submissions. Managed from the
    # Platform Admin settings page; falls back to a sensible default when blank.
    contact_email = models.EmailField(max_length=255, blank=True, default="contact@stockwhisk.com")
    # Optional dedicated SMTP login so contact emails are sent FROM the contact
    # mailbox itself (reuses the SMTP host/port/TLS above). Blank → send via the
    # noreply SMTP instead.
    contact_smtp_user = models.CharField(max_length=255, blank=True, default="")
    contact_smtp_password = models.CharField(max_length=255, blank=True, default="")

    # Promotional offer shown as a popup on the public pricing page. Image or PDF.
    offer_file = models.FileField(upload_to="offers/", blank=True, null=True)
    offer_enabled = models.BooleanField(default=False)

    # Platform branding shown across the app + marketing site.
    logo = models.FileField(upload_to="branding/", blank=True, null=True)
    favicon = models.FileField(upload_to="branding/", blank=True, null=True)

    # Optional per-industry photos for the marketing "industries" section,
    # keyed by industry slug (retail/grocery/…). When a key is absent the
    # frontend falls back to its bundled default illustration.
    industry_images = models.JSONField(default=dict, blank=True)

    # Editable copy for the public pricing page (hero, CTA, badges, etc.).
    pricing_content = models.JSONField(default=dict, blank=True)

    # Subscription: default trial length (days) granted to every new signup.
    default_trial_days = models.PositiveIntegerField(default=45)

    class Meta:
        verbose_name_plural = "Platform Config"

    @classmethod
    def get_solo(cls):
        obj, created = cls.objects.get_or_create(id=1)
        return obj

    def __str__(self):
        return "Platform Configuration"

class PlatformRevenue(TimeStampedModel):
    """
    Immutable platform revenue ledger for subscription payments. Written when a
    plan is activated/renewed. NOT tenant-scoped and uses SET_NULL on the shop
    FK plus snapshot fields, so records survive even if the shop is deleted.
    """
    shop = models.ForeignKey(
        "tenants.Shop", on_delete=models.SET_NULL, null=True, blank=True, related_name="+",
    )
    shop_name = models.CharField(max_length=150, blank=True)
    shop_code = models.CharField(max_length=20, blank=True)
    plan_tier = models.CharField(max_length=30, blank=True)
    invoice_number = models.CharField(max_length=40, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    cycle = models.CharField(max_length=10, default="monthly")
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    # Snapshot of the shop's test flag at recording time, so toggling it later
    # can't rewrite history. Test revenue is excluded from platform totals.
    is_test = models.BooleanField(default=False)
    occurred_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-occurred_at"]
        indexes = [
            models.Index(fields=["occurred_at"], name="platform_ad_occurre_idx"),
            models.Index(fields=["is_test"], name="platform_ad_is_test_idx"),
        ]

    def __str__(self):
        return f"{self.shop_name} · {self.amount} · {self.occurred_at:%Y-%m-%d}"


class BlogPost(TimeStampedModel):
    """
    Public blog posts for the marketing site.
    Managed exclusively by super admins.
    """
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, db_index=True)
    content = models.TextField(help_text="Markdown or HTML content")
    excerpt = models.TextField(blank=True, help_text="Short summary for the blog listing")
    is_published = models.BooleanField(default=False, db_index=True)
    published_at = models.DateTimeField(null=True, blank=True)
    cover_image_url = models.URLField(blank=True, help_text="Optional absolute URL for a cover image")
    
    # New fields for modern blog UI
    category = models.CharField(max_length=100, blank=True, help_text="e.g., 'inv', 'pos', 'retail', 'smallbiz', 'stockwhisk'")
    author_name = models.CharField(max_length=100, blank=True, default="StockWhisk Team")
    author_role = models.CharField(max_length=100, blank=True, default="Editorial Team")
    author_avatar_url = models.URLField(blank=True, help_text="Optional URL for author avatar")
    read_time_minutes = models.PositiveIntegerField(default=5)
    is_featured = models.BooleanField(default=False, db_index=True)

    class Meta:
        ordering = ["-published_at", "-created_at"]
        indexes = [models.Index(fields=["is_published", "published_at"])]

    def __str__(self):
        return self.title

class SoftwareRelease(TimeStampedModel):
    """
    Downloadable software releases (Android, Windows, Mac).
    Managed by super admins.
    """
    PLATFORM_CHOICES = [
        ('android', 'Android'),
        ('windows', 'Windows'),
        ('mac', 'macOS'),
    ]

    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    version = models.CharField(max_length=50, help_text="e.g., v1.2.0")
    release_notes = models.TextField(blank=True)
    file = models.FileField(upload_to="software/", help_text="Upload the executable or APK")
    is_active = models.BooleanField(default=True, help_text="If false, this version won't be visible to users")

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["platform", "is_active", "-created_at"], name="platform_ad_platfor_ab1234_idx")]

    def __str__(self):
        return f"{self.get_platform_display()} - {self.version}"

class ShopDataBackup(TimeStampedModel):
    """
    Stores a serialized 15-day recovery backup for a shop's operational data.
    Created by superadmins before a data clear operation.
    """
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        VERIFIED = "verified", "Verified"
        FAILED = "failed", "Failed"
        RESTORED = "restored", "Restored"
        DELETED = "deleted", "Deleted"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shop = models.ForeignKey("tenants.Shop", on_delete=models.CASCADE, related_name="data_backups")
    created_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, related_name="+")
    expires_at = models.DateTimeField(db_index=True)
    backup_file = models.FileField(upload_to="shop_backups/", blank=True, null=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    records_count = models.PositiveIntegerField(default=0)
    deleted_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Backup {self.id} for Shop {self.shop_id} ({self.get_status_display()})"

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at


class ShopDataOperation(TimeStampedModel):
    """
    Audit log for shop data management operations (Clear, Restore, Auto-Delete).
    """
    class OperationType(models.TextChoices):
        CLEAR = "clear", "Clear"
        RESTORE = "restore", "Restore"
        AUTO_DELETE = "auto_delete", "Auto-Delete"

    class Status(models.TextChoices):
        STARTED = "started", "Started"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    shop = models.ForeignKey("tenants.Shop", on_delete=models.CASCADE, related_name="data_operations")
    initiated_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, related_name="+")
    operation_type = models.CharField(max_length=20, choices=OperationType.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.STARTED)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.get_operation_type_display()} on Shop {self.shop_id} ({self.get_status_display()})"
