"""Customer profiles + due tracking + segmentation."""
from django.db import models
from django.utils import timezone

from core.models import TenantScopedModel


class Customer(TenantScopedModel):
    class Segment(models.TextChoices):
        NEW = "new", "New"
        REGULAR = "regular", "Regular"
        VIP = "vip", "VIP"
        INACTIVE = "inactive", "Inactive"

    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=30, blank=True, db_index=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    segment = models.CharField(max_length=20, choices=Segment.choices, default=Segment.NEW)
    # Default discount applied at POS for this customer (percent of line total).
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    # Cached running due (receivable). Positive => customer owes the shop.
    due_balance = models.DecimalField(max_digits=14, decimal_places=2, default=0, editable=False)
    total_purchased = models.DecimalField(max_digits=14, decimal_places=2, default=0, editable=False)
    last_purchase_at = models.DateTimeField(null=True, blank=True)

    is_active = models.BooleanField(default=True)

    # WhatsApp opt-in (9.5). Never message a customer without consent.
    whatsapp_consent = models.BooleanField(default=False)
    whatsapp_opt_in_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["shop", "phone"])]

    def __str__(self):
        return self.name

    @property
    def days_since_last_purchase(self):
        if not self.last_purchase_at:
            return None
        return (timezone.now() - self.last_purchase_at).days

class CustomerPayment(TenantScopedModel):
    """A payment made by a customer against their outstanding due. Reduces
    the customer's cached ``due_balance`` and records a cash inflow."""

    class Method(models.TextChoices):
        CASH = "cash", "Cash"
        BKASH = "bkash", "bKash"
        NAGAD = "nagad", "Nagad"
        BANK = "bank", "Bank transfer"
        SETTLEMENT = "settlement", "Settlement / Adjustment"

    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="payments")
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    method = models.CharField(max_length=20, choices=Method.choices, default=Method.CASH)
    reference = models.CharField(max_length=100, blank=True)
    note = models.CharField(max_length=255, blank=True)
    paid_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="customer_payments",
    )

    class Meta:
        ordering = ["-paid_at"]
        constraints = [
            models.CheckConstraint(condition=models.Q(amount__gt=0), name="customer_payment_amount_positive"),
        ]

    def __str__(self):
        return f"{self.amount} from customer#{self.customer_id}"

