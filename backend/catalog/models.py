"""Product catalog: categories, brands, units, products, variations."""
from django.core.validators import MinValueValidator
from django.db import models

from core.models import TenantScopedModel


class Category(TenantScopedModel):
    """Self-referential so one model covers category + subcategory."""

    name = models.CharField(max_length=120)
    parent = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, related_name="children"
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "categories"
        constraints = [
            models.UniqueConstraint(
                fields=["shop", "parent", "name"], name="uniq_category_name_per_parent"
            ),
        ]

    def __str__(self):
        return self.name


class Brand(TenantScopedModel):
    name = models.CharField(max_length=120)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["shop", "name"], name="uniq_brand_name_per_shop"),
        ]

    def __str__(self):
        return self.name


class Unit(TenantScopedModel):
    """Unit of measure, e.g. Piece, Box, Kg, Liter."""

    class MeasureType(models.TextChoices):
        COUNT = "count", "Piece / Count"
        WEIGHT = "weight", "Weight (kg, g)"
        VOLUME = "volume", "Volume (L, ml)"

    name = models.CharField(max_length=40)
    short_code = models.CharField(max_length=10, blank=True)
    measure_type = models.CharField(
        max_length=10, choices=MeasureType.choices, default=MeasureType.COUNT
    )
    allow_decimal = models.BooleanField(
        default=False,
        help_text="Allow decimal quantities in POS, e.g. 2.5 kg",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["shop", "name"], name="uniq_unit_name_per_shop"),
        ]

    def __str__(self):
        return self.name


class Product(TenantScopedModel):
    """
    A sellable item. ``current_stock`` is a CACHED convenience value derived
    from the append-only StockMovement ledger — never the source of truth.
    Recomputed by ``inventory.services.recalc_stock``.
    """

    name = models.CharField(max_length=200)
    sku = models.CharField(max_length=120, blank=True)
    barcode = models.CharField(max_length=120, blank=True, db_index=True)

    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL, null=True, blank=True, related_name="products"
    )
    brand = models.ForeignKey(
        Brand, on_delete=models.SET_NULL, null=True, blank=True, related_name="products"
    )
    unit = models.ForeignKey(
        Unit, on_delete=models.SET_NULL, null=True, blank=True, related_name="products"
    )
    
    # Modern UOM handling for bulk purchases (e.g. Drums / Boxes)
    purchase_unit = models.ForeignKey(
        Unit, on_delete=models.SET_NULL, null=True, blank=True, related_name="purchase_products"
    )
    purchase_multiplier = models.DecimalField(max_digits=10, decimal_places=3, default=1.0)
    full_pack_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    full_pack_sell = models.DecimalField(max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    # Default supplier this product is bought from (item 18: product↔supplier link).
    supplier = models.ForeignKey(
        "purchasing.Supplier", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="products",
    )
    # Default warranty period offered on this product, in months (0 = none).
    warranty_months = models.PositiveSmallIntegerField(default=0)
    # Default replacement guarantee in days (e.g. 7, 30) (0 = none).
    replacement_guarantee_days = models.PositiveSmallIntegerField(default=0)

    description = models.TextField(blank=True)
    cost_price = models.DecimalField(
        max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(0)]
    )
    selling_price = models.DecimalField(
        max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(0)]
    )
    tax_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    track_inventory = models.BooleanField(default=True)
    reorder_level = models.PositiveIntegerField(default=5)
    current_stock = models.DecimalField(max_digits=14, decimal_places=2, default=0, editable=False)

    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["shop", "name"]),
            models.Index(fields=["shop", "sku"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["shop", "sku"], condition=~models.Q(sku=""),
                name="uniq_sku_per_shop_when_set",
            ),
            # NB: product barcodes are intentionally NOT unique. Different
            # products can legitimately share a barcode (common in retail); POS
            # resolves such a scan with a product picker.
        ]

    def __str__(self):
        return self.name

    @property
    def is_low_stock(self) -> bool:
        return self.track_inventory and (self.current_stock <= self.reorder_level or self.current_stock <= 5)

    def save(self, *args, **kwargs):
        if not self.sku:
            import random
            import string
            prefix = (self.shop.barcode_prefix if self.shop_id and getattr(self.shop, "barcode_prefix", None) else "SKU").upper()
            rand_suffix = "".join(random.choices(string.digits, k=6))
            self.sku = f"{prefix}-{rand_suffix}"
        super().save(*args, **kwargs)


class ProductUnit(TenantScopedModel):
    """
    A single physical unit of a product, identified by its own scanned barcode
    (the per-unit serial captured in bulk barcode entry). Lets the shop see which
    scanned items are still unsold and resolve a scanned unit barcode to a product
    across POS / universal search (features #6, #7).
    """

    class Status(models.TextChoices):
        IN_STOCK = "in_stock", "In stock"
        SOLD = "sold", "Sold"
        RETURNED = "returned", "Returned"
        DEFECTIVE = "defective", "Defective"
        RETURNED_SUPPLIER = "returned_supplier", "Returned to supplier"
        TESTING_PENDING = "testing_pending", "Testing Pending"

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="units")
    barcode = models.CharField(max_length=120, db_index=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.IN_STOCK)
    # Per-unit price snapshot taken at purchase time. A product has ONE
    # ``selling_price`` field that the latest purchase overwrites, so without this
    # a scanned unit from an earlier batch would sell at the newest price. When
    # set, POS uses these; otherwise it falls back to the product's prices.
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    selling_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    # Warranty duration snapshotted per barcode at purchase, so this row alone is
    # the single source of truth a POS scan reads (price + cost + warranty).
    warranty_months = models.PositiveIntegerField(null=True, blank=True)
    replacement_guarantee_days = models.PositiveIntegerField(null=True, blank=True)
    sale = models.ForeignKey(
        "sales.Sale", on_delete=models.SET_NULL, null=True, blank=True, related_name="units"
    )
    sold_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["shop", "barcode"]), models.Index(fields=["shop", "status"])]
        constraints = [
            # Unique per product (not per shop): the same barcode may appear on
            # units of different products, but never twice within one product.
            models.UniqueConstraint(fields=["shop", "product", "barcode"], name="uniq_unit_barcode_per_product"),
        ]

    def __str__(self):
        return f"{self.barcode} ({self.status})"

    @property
    def effective_selling_price(self):
        return self.selling_price if self.selling_price is not None else self.product.selling_price

    @property
    def effective_cost_price(self):
        return self.cost_price if self.cost_price is not None else self.product.cost_price

    @property
    def effective_warranty_months(self):
        return self.warranty_months if self.warranty_months is not None else (self.product.warranty_months or 0)

    @property
    def effective_replacement_guarantee_days(self):
        return self.replacement_guarantee_days if self.replacement_guarantee_days is not None else (self.product.replacement_guarantee_days or 0)

    @property
    def effective_profit(self):
        return (self.effective_selling_price or 0) - (self.effective_cost_price or 0)


class ProductVariation(TenantScopedModel):
    """
    Optional variant of a product (e.g. RAM size, color). Carries its own
    stock cache and price overrides. Stock movements may reference a variation.
    """

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variations")
    name = models.CharField(max_length=120)
    attributes = models.JSONField(default=dict, blank=True)  # {"ram": "8GB"}
    sku = models.CharField(max_length=120, blank=True)
    barcode = models.CharField(max_length=120, blank=True, db_index=True)
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    selling_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    current_stock = models.DecimalField(max_digits=14, decimal_places=2, default=0, editable=False)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.product.name} — {self.name}"

    @property
    def effective_cost(self):
        return self.cost_price if self.cost_price is not None else self.product.cost_price

    @property
    def effective_price(self):
        return self.selling_price if self.selling_price is not None else self.product.selling_price
