from rest_framework import serializers

from .models import Brand, Category, Product, ProductVariation, Unit, ProductUnit

# Permissions that grant sight of internal cost/margin figures. A pure POS
# reader (view_products only, e.g. a Cashier) sees none of these.
COST_VIEW_PERMS = ("manage_products", "view_profit", "manage_purchasing")


def _can_view_cost(context) -> bool:
    request = context.get("request") if context else None
    user = getattr(request, "user", None)
    # Only interactive RBAC users (Cashier, Manager, …) get cost-filtered. API-key
    # / anonymous / service principals have no `has_perm_code` and keep the legacy
    # behaviour (cost visible) — so the public API and internal callers are unchanged.
    if user is None or not hasattr(user, "has_perm_code"):
        return True
    if not getattr(user, "is_authenticated", False):
        return True
    return any(user.has_perm_code(c) for c in COST_VIEW_PERMS)


class HideCostMixin:
    """Strips internal cost fields from the output for users who lack a
    cost-viewing permission. Only affects reads — write validation is untouched."""

    COST_FIELDS = ("cost_price", "effective_cost_price")

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not _can_view_cost(self.context):
            for field in self.COST_FIELDS:
                data.pop(field, None)
        return data


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "parent", "is_active"]

    def validate_name(self, value):
        name = (value or "").strip()
        if not name:
            raise serializers.ValidationError("Category name cannot be empty.")
        request = self.context.get("request")
        shop = getattr(request, "tenant", None) if request else None
        instance_id = self.instance.id if self.instance else None
        qs = Category.all_objects.filter(name__iexact=name)
        if shop:
            qs = qs.filter(shop=shop)
        elif self.instance and self.instance.shop:
            qs = qs.filter(shop=self.instance.shop)
        if instance_id:
            qs = qs.exclude(id=instance_id)
        if qs.exists():
            raise serializers.ValidationError(f"Category '{name}' already exists (case-insensitive duplicate not allowed).")
        return name


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ["id", "name", "is_active"]

    def validate_name(self, value):
        name = (value or "").strip()
        if not name:
            raise serializers.ValidationError("Brand name cannot be empty.")
        instance_id = self.instance.id if self.instance else None
        qs = Brand.all_objects.filter(name__iexact=name)
        if instance_id:
            qs = qs.exclude(id=instance_id)
        if qs.exists():
            raise serializers.ValidationError(f"Brand '{name}' already exists (case-insensitive duplicate not allowed).")
        return name


class UnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
        fields = ["id", "name", "short_code", "measure_type", "allow_decimal"]

    def create(self, validated_data):
        name = validated_data.get("name", "").strip()
        short_code = validated_data.get("short_code", "").strip()
        measure_type = validated_data.get("measure_type")
        lower = f"{name} {short_code}".lower()

        if not validated_data.get("short_code"):
            if any(w in lower for w in ["kg", "kilogram", "কেজি"]):
                validated_data["short_code"] = "কেজি"
            elif any(w in lower for w in ["gm", "gram", "গ্রাম"]):
                validated_data["short_code"] = "গ্রাম"
            elif any(w in lower for w in ["liter", "litre", "লিটার"]):
                validated_data["short_code"] = "লিটার"
            elif "ml" in lower or "মিলি" in lower:
                validated_data["short_code"] = "মিলি"
            elif any(w in lower for w in ["goj", "yard", "গজ"]):
                validated_data["short_code"] = "গজ"
            elif any(w in lower for w in ["meter", "metre", "মিটার"]):
                validated_data["short_code"] = "মি"
            elif any(w in lower for w in ["pcs", "piece", "পিস"]):
                validated_data["short_code"] = "পিস"

        if measure_type == Unit.MeasureType.COUNT or not measure_type:
            if any(w in lower for w in ["kg", "kilogram", "gm", "gram", "কেজি", "গ্রাম"]):
                validated_data["measure_type"] = Unit.MeasureType.WEIGHT
                validated_data["allow_decimal"] = True
            elif any(w in lower for w in ["liter", "litre", "লিটার", "ml", "মিলি"]):
                validated_data["measure_type"] = Unit.MeasureType.VOLUME
                validated_data["allow_decimal"] = True
            elif any(w in lower for w in ["goj", "yard", "meter", "metre", "গজ", "মিটার", "feet", "ফুট"]):
                validated_data["measure_type"] = Unit.MeasureType.LENGTH
                validated_data["allow_decimal"] = True

        return super().create(validated_data)


class ProductVariationSerializer(HideCostMixin, serializers.ModelSerializer):
    class Meta:
        model = ProductVariation
        fields = [
            "id", "product", "name", "attributes", "sku", "barcode",
            "cost_price", "selling_price", "current_stock", "is_active",
        ]
        read_only_fields = ["current_stock"]


class ProductSerializer(HideCostMixin, serializers.ModelSerializer):
    variations = serializers.SerializerMethodField()
    is_low_stock = serializers.BooleanField(read_only=True)
    unit_detail = serializers.SerializerMethodField()
    purchase_unit_detail = serializers.SerializerMethodField()
    units = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "name", "sku", "barcode", "category", "brand", "unit",
            "purchase_unit", "purchase_multiplier",
            "full_pack_cost", "full_pack_sell",
            "description", "cost_price", "selling_price", "tax_percent",
            "track_inventory", "reorder_level", "current_stock",
            "is_low_stock", "is_active", "variations", "warranty_months",
            "replacement_guarantee_days",
            "expiry_date", "lot_number", "mfg_date", "size_variants", "fabric_material", "gender_target", "season", "style_type", "fit_type", "collection_name", "care_instructions",
            "units", "unit_detail", "purchase_unit_detail", "display_name",
        ]
        read_only_fields = ["current_stock", "is_low_stock"]


    def get_display_name(self, obj):
        return obj.display_name
    def get_variations(self, obj):
        tenant_id = getattr(obj, "shop_id", None)
        if tenant_id:
            qs = ProductVariation.all_objects.filter(product_id=obj.id, shop_id=tenant_id, is_active=True)
        else:
            qs = obj.variations.filter(is_active=True)
        return ProductVariationSerializer(qs, many=True, context=self.context).data

    def get_unit_detail(self, obj):
        if obj.unit_id is None:
            return None
        return {
            "id": obj.unit_id,
            "name": obj.unit.name if obj.unit_id else None,
            "short_code": getattr(obj.unit, "short_code", ""),
            "measure_type": getattr(obj.unit, "measure_type", "count"),
            "allow_decimal": getattr(obj.unit, "allow_decimal", False),
        }

    def get_purchase_unit_detail(self, obj):
        if obj.purchase_unit_id is None:
            return None
        return {
            "id": obj.purchase_unit_id,
            "name": obj.purchase_unit.name if obj.purchase_unit_id else None,
            "short_code": getattr(obj.purchase_unit, "short_code", ""),
            "measure_type": getattr(obj.purchase_unit, "measure_type", "count"),
            "allow_decimal": getattr(obj.purchase_unit, "allow_decimal", False),
        }

    def get_units(self, obj):
        if not getattr(obj, "track_inventory", True):
            return []

        # Light mode (list/table views): skip units entirely for a small payload.
        request = self.context.get("request")
        qp = getattr(request, "query_params", getattr(request, "GET", {}))
        if qp.get("light") in {"1", "true"}:
            return []

        # Use prefetched IN_STOCK units if available to prevent N+1 queries
        if hasattr(obj, "prefetched_in_stock_units"):
            units = obj.prefetched_in_stock_units
        else:
            units = obj.units.filter(status=ProductUnit.Status.IN_STOCK)
            
        # Pass context so the nested serializer can apply the same cost-hiding.
        return ProductUnitSerializer(units, many=True, context=self.context).data

    def _sync_size_variations(self, product, size_variants):
        if not size_variants or not isinstance(size_variants, list):
            return
        shop = getattr(product, "shop", None)
        if not shop:
            return
        for sv in size_variants:
            if not isinstance(sv, dict):
                continue
            size = str(sv.get("size", "")).strip()
            color = str(sv.get("color", "")).strip()
            if not size and not color:
                continue
            name = f"{size} / {color}" if (size and color) else (size or color)
            sku = str(sv.get("sku", "")).strip()
            barcode = str(sv.get("barcode", "")).strip()
            stock = float(sv.get("stock") or 0)
            price = sv.get("price")
            try:
                price_val = float(price) if price else None
            except (ValueError, TypeError):
                price_val = None

            var = ProductVariation.all_objects.filter(
                product=product, shop=shop,
                attributes__size=size, attributes__color=color
            ).first()

            if not var and sku:
                var = ProductVariation.all_objects.filter(product=product, shop=shop, sku=sku).first()

            if var:
                var.name = name
                if sku:
                    var.sku = sku
                if barcode:
                    var.barcode = barcode
                if price_val is not None:
                    var.selling_price = price_val
                var.current_stock = stock
                var.is_active = True
                var.save(update_fields=["name", "sku", "barcode", "selling_price", "current_stock", "is_active"])
            else:
                ProductVariation.objects.create(
                    product=product,
                    shop=shop,
                    name=name,
                    attributes={"size": size, "color": color},
                    sku=sku,
                    barcode=barcode,
                    selling_price=price_val if price_val is not None else product.selling_price,
                    cost_price=product.cost_price,
                    current_stock=stock,
                    is_active=True,
                )
        total_var_stock = sum(float(sv.get("stock") or 0) for sv in size_variants if isinstance(sv, dict))
        if total_var_stock > 0 and (product.current_stock == 0 or product.current_stock is None):
            product.current_stock = total_var_stock
            product.save(update_fields=["current_stock"])

    def create(self, validated_data):
        instance = super().create(validated_data)
        if "size_variants" in validated_data:
            self._sync_size_variations(instance, validated_data["size_variants"])
        return instance

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        if "size_variants" in validated_data:
            self._sync_size_variations(instance, validated_data["size_variants"])
        return instance


class ProductUnitSerializer(HideCostMixin, serializers.ModelSerializer):
    effective_cost_price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    effective_selling_price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    effective_warranty_months = serializers.IntegerField(read_only=True)
    effective_replacement_guarantee_days = serializers.IntegerField(read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    sale_id = serializers.IntegerField(read_only=True, default=None)
    sale_invoice_no = serializers.SerializerMethodField()
    sold_at = serializers.DateTimeField(read_only=True)
    warranty_status = serializers.SerializerMethodField()
    repair_status = serializers.SerializerMethodField()

    class Meta:
        model = ProductUnit
        fields = [
            'id', 'product', 'barcode', 'status', 'cost_price', 'selling_price',
            'warranty_months', 'replacement_guarantee_days', 'effective_cost_price', 'effective_selling_price',
            'effective_warranty_months', 'effective_replacement_guarantee_days', 'product_name', 'created_at',
            'sale_id', 'sale_invoice_no', 'sold_at', 'warranty_status', 'repair_status',
        ]
        read_only_fields = ['id', 'effective_cost_price', 'effective_selling_price', 'effective_warranty_months', 'effective_replacement_guarantee_days', 'created_at']

    def get_sale_invoice_no(self, obj):
        return obj.sale.invoice_no if obj.sale_id and obj.sale else None

    def get_warranty_status(self, obj):
        from service.models import Warranty
        w = Warranty.all_objects.filter(product_unit_id=obj.id).order_by("-created_at").first()
        if not w:
            return None
        try:
            return str(w.compute_status())
        except Exception:
            return w.status

    def get_repair_status(self, obj):
        from service.models import ServiceTicket
        t = (ServiceTicket.all_objects.filter(warranty__product_unit_id=obj.id)
             .order_by("-created_at").first())
        return t.status if t else None