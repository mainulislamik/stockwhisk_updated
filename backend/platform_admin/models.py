import re

from django.db import models
from django.utils import timezone

from core.models import TimeStampedModel

_YT_ID = re.compile(
    r"(?:youtu\.be/|youtube\.com/(?:watch\?v=|embed/|shorts/|v/))([A-Za-z0-9_-]{11})"
)


class TutorialVideo(TimeStampedModel):
    """A help/tutorial video managed platform-wide by super admins and shown to
    every shop on their dashboard, ordered by ``sequence`` (serial number)."""

    title = models.CharField(max_length=200)
    youtube_url = models.URLField(help_text="Full YouTube link (watch, youtu.be, or embed).")
    sequence = models.PositiveIntegerField(
        default=1, db_index=True, help_text="Play order — lower numbers show first."
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sequence", "id"]
        indexes = [models.Index(fields=["is_active", "sequence"])]

    def __str__(self):
        return f"{self.sequence}. {self.title}"

    @property
    def video_id(self):
        """Extract the 11-char YouTube id from any common URL shape."""
        m = _YT_ID.search(self.youtube_url or "")
        return m.group(1) if m else ""

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
        indexes = [models.Index(fields=["occurred_at"]), models.Index(fields=["is_test"])]

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

    class Meta:
        ordering = ["-published_at", "-created_at"]
        indexes = [models.Index(fields=["is_published", "published_at"])]

    def __str__(self):
        return self.title
