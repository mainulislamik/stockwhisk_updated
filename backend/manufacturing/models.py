from django.db import models
from django.utils import timezone
from core.models import TenantScopedModel


class BatchStatus(models.TextChoices):
    IN_PROGRESS = "in_progress", "In Progress (Processing)"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"


class ProductionBatch(TenantScopedModel):
    """
    A 2-step dynamic yield production batch.
    Step 1: Raw materials are committed and deducted from stock.
    Step 2: Output product and final yield quantity are recorded,
            calculating the exact per-unit cost.
    """

    batch_number = models.CharField(max_length=64, blank=True, db_index=True)
    status = models.CharField(
        max_length=20, choices=BatchStatus.choices, default=BatchStatus.IN_PROGRESS, db_index=True
    )
    started_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Cost tracking
    total_material_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    additional_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    additional_cost_note = models.CharField(max_length=255, blank=True)

    # Output details (filled on completion)
    output_product = models.ForeignKey(
        "catalog.Product",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="production_outputs",
    )
    output_variation = models.ForeignKey(
        "catalog.ProductVariation",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="production_outputs",
    )
    output_quantity = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    calculated_unit_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    update_product_cost = models.BooleanField(
        default=True, help_text="Update output product cost_price in catalog"
    )

    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_production_batches",
    )
    completed_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="completed_production_batches",
    )

    class Meta:
        ordering = ["-started_at", "-id"]
        indexes = [
            models.Index(fields=["shop", "status"]),
            models.Index(fields=["shop", "batch_number"]),
        ]

    def __str__(self):
        return f"{self.batch_number or 'Batch'} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.batch_number:
            now_str = timezone.now().strftime("%y%m")
            import random
            rand_suffix = f"{random.randint(1000, 9999)}"
            self.batch_number = f"PB-{now_str}-{rand_suffix}"
        super().save(*args, **kwargs)

    @property
    def total_cost(self):
        return (self.total_material_cost or 0) + (self.additional_cost or 0)


class ProductionMaterial(TenantScopedModel):
    """
    A raw material item used in a production batch.
    """

    batch = models.ForeignKey(
        ProductionBatch, on_delete=models.CASCADE, related_name="materials"
    )
    product = models.ForeignKey(
        "catalog.Product", on_delete=models.CASCADE, related_name="used_in_productions"
    )
    variation = models.ForeignKey(
        "catalog.ProductVariation", on_delete=models.SET_NULL, null=True, blank=True
    )
    quantity = models.DecimalField(max_digits=14, decimal_places=2)
    unit = models.ForeignKey(
        "catalog.Unit", on_delete=models.SET_NULL, null=True, blank=True
    )
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.quantity} of {self.product.name} (Batch #{self.batch_id})"
