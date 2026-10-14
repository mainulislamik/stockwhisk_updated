"""
POS endpoints — kept deliberately thin and fast. Barcode lookup + a checkout
that wraps the sales service. Speed target: <30s per transaction, so minimal
round-trips (one lookup per scan, one checkout call).
"""
from django.db.models import Q
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.models import Product, ProductUnit, ProductVariation
from catalog.serializers import ProductSerializer, ProductUnitSerializer
from core.permissions import HasPermCode, IsTenantMember
from core.tenant_context import set_current_tenant
from sales.serializers import SaleCreateSerializer, SaleSerializer
from sales.services import create_sale


class _POSBase(APIView):
    permission_classes = [IsTenantMember, HasPermCode]
    required_perm = "create_sale"

    def initial(self, request, *args, **kwargs):
        set_current_tenant(getattr(request.user, "shop", None))
        request.tenant = getattr(request.user, "shop", None)
        super().initial(request, *args, **kwargs)


class BarcodeLookupView(_POSBase):
    def get(self, request):
        code = request.query_params.get("barcode") or request.query_params.get("q")
        if not code:
            return Response({"detail": "Provide ?barcode="}, status=status.HTTP_400_BAD_REQUEST)
        
        # Product might have a comma-separated list of barcodes. A barcode can be
        # shared by several products, so collect ALL exact matches.
        products = (
            Product.objects.filter(is_active=True)
            .filter(Q(barcode__contains=code) | Q(sku=code))
            .select_related("category", "brand", "unit")
        )

        matches = [
            p for p in products
            if code == p.sku or code in [x.strip() for x in (p.barcode or "").split(",")]
        ]

        # More than one product carries this barcode → let the client pick.
        if len(matches) > 1:
            return Response({
                "multiple": True,
                "products": ProductSerializer(matches, many=True, context={"request": request}).data,
            })

        product = matches[0] if matches else None
        scanned_unit = None
        scanned_scale_weight = None

        tenant_id = getattr(request.tenant, "id", None)

        # ── Weigh Scale Barcode Parsing (EAN-13 / 12-digit Scale Barcodes e.g. 20XXXXXWWWWWC) ──
        if product is None and len(code) in (12, 13) and code[:2] in ("02", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29") and code.isdigit():
            prefix = code[:2]
            plu_5 = code[2:7]
            try:
                raw_weight = int(code[7:12])
                if raw_weight > 0:
                    scale_prod = (
                        Product.objects.filter(is_active=True)
                        .filter(
                            Q(barcode__startswith=f"{prefix}{plu_5}") |
                            Q(barcode__startswith=f"20{plu_5}") |
                            Q(sku=plu_5) |
                            Q(sku=f"PLU-{plu_5}")
                        )
                        .select_related("category", "brand", "unit")
                        .first()
                    )
                    if scale_prod:
                        product = scale_prod
                        if prefix == "21":  # Price-embedded scale
                            unit_price = float(scale_prod.selling_price) if float(scale_prod.selling_price) > 0 else 1.0
                            scanned_scale_weight = round((raw_weight / 100.0) / unit_price, 3)
                        else:  # Standard weight-embedded scale (grams -> kg)
                            scanned_scale_weight = round(raw_weight / 1000.0, 3)
            except Exception:
                pass

        scanned_variation = None
        if product is None:
            variation = (
                ProductVariation.objects.filter(is_active=True)
                .filter(Q(barcode=code) | Q(sku=code))
                .select_related("product", "product__category", "product__brand", "product__unit")
                .first()
            )
            if variation:
                product = variation.product
                scanned_variation = variation

        if product is None:
            # Check if it matches an in-stock ProductUnit (per-unit serial). Scope
            # to the current shop so a barcode reused across shops can't leak or
            # pick the wrong record.
            unit = (
                ProductUnit.all_objects.filter(
                    barcode=code, status=ProductUnit.Status.IN_STOCK, shop_id=tenant_id
                )
                .select_related("product")
                .first()
            )
            if unit and unit.product.is_active:
                product = unit.product
                scanned_unit = unit

        if product is None:
            # Distinguish a genuinely sold/returned unit from an unknown barcode,
            # so the POS can show a precise message instead of the assign flow.
            sold = (
                ProductUnit.all_objects.filter(barcode=code, shop_id=tenant_id)
                .exclude(status=ProductUnit.Status.IN_STOCK)
                .select_related("product")
                .first()
            )
            if sold:
                return Response(
                    {
                        "detail": f'Unit "{code}" is already sold or not in stock.',
                        "sold_unit": True,
                        "unit_status": sold.status,
                        "product_name": sold.product.name,
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        data = ProductSerializer(product, context={"request": request}).data
        if scanned_unit:
            data["scanned_unit"] = ProductUnitSerializer(scanned_unit, context={"request": request}).data
        if scanned_scale_weight is not None:
            data["scanned_scale_weight"] = scanned_scale_weight
            data["is_scale_barcode"] = True
        if scanned_variation:
            data["scanned_variation"] = {
                "id": scanned_variation.id,
                "name": scanned_variation.name,
                "sku": scanned_variation.sku,
                "barcode": scanned_variation.barcode,
                "attributes": scanned_variation.attributes,
                "selling_price": str(scanned_variation.effective_price),
                "cost_price": str(scanned_variation.effective_cost),
            }
            data["name"] = f"{product.name} ({scanned_variation.name})"
            data["selling_price"] = str(scanned_variation.effective_price)

        return Response(data)


class CheckoutView(_POSBase):
    def post(self, request):
        ser = SaleCreateSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        customer = data.get("customer")
        
        if not customer:
            cust_name = str(request.data.get("customer_name", "")).strip()
            cust_phone = str(request.data.get("customer_phone", "")).strip()
            if cust_name and cust_phone:
                from crm.models import Customer
                customer = Customer.objects.filter(shop=request.user.shop, phone=cust_phone).first()
                if not customer:
                    customer = Customer.objects.create(
                        shop=request.user.shop,
                        name=cust_name[:150],
                        phone=cust_phone[:30],
                        email=str(request.data.get("customer_email", "")).strip()[:254],
                        address=str(request.data.get("customer_address", "")).strip()
                    )
        
        if customer:
            cust_email = str(request.data.get("customer_email", "")).strip()
            if cust_email and customer.email != cust_email:
                customer.email = cust_email[:254]
                customer.save(update_fields=["email"])

        try:
            sale = create_sale(
                shop=request.user.shop,
                customer=customer,
                sale_date=data.get("sale_date"),
                due_date=data.get("due_date"),
                discount=data.get("discount", 0),
                tax=data.get("tax", 0),
                note=data.get("note", ""),
                items=data["items"],
                payments=data.get("payments", []),
                created_by=request.user,
                is_emi=data.get("is_emi", False),
                emi_months=data.get("emi_months", 0),
                down_payment=data.get("down_payment", 0),
                emi_interest_percent=data.get("emi_interest_percent", 0),
                is_quotation=data.get("is_quotation", False),
                idempotency_key=str(data.get("idempotency_key") or request.data.get("idempotency_key") or "").strip()[:64],
                alteration_notes=str(request.data.get("alteration_notes", "")).strip()[:255],
                alteration_status=str(request.data.get("alteration_status", "")).strip()[:30],
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(SaleSerializer(sale, context={"request": request}).data, status=status.HTTP_201_CREATED)


class CatalogCacheView(_POSBase):
    """
    Returns full in-stock catalog optimized for client-side offline IndexedDB caching.
    Includes products, variations, serialized in-stock units, and pricing.
    """
    def get(self, request):
        from catalog.models import Product, ProductUnit, ProductVariation
        from django.utils import timezone
        
        shop = request.user.shop
        # Fetch active products
        products = (
            Product.objects.filter(is_active=True)
            .select_related("category", "brand", "unit", "purchase_unit")
            .prefetch_related("variations", "units")
        )
        
        results = []
        for p in products:
            units = [
                {
                    "id": u.id,
                    "barcode": u.barcode,
                    "cost_price": str(u.cost_price or p.cost_price or "0.00"),
                    "selling_price": str(u.selling_price or p.selling_price or "0.00"),
                    "warranty_months": u.warranty_months if u.warranty_months is not None else p.warranty_months,
                    "replacement_guarantee_days": u.replacement_guarantee_days if u.replacement_guarantee_days is not None else p.replacement_guarantee_days,
                }
                for u in p.units.all()
                if u.status == ProductUnit.Status.IN_STOCK
            ]
            
            variations = [
                {
                    "id": v.id,
                    "name": v.name,
                    "sku": v.sku,
                    "barcode": v.barcode,
                    "selling_price": str(v.selling_price or p.selling_price or "0.00"),
                    "cost_price": str(v.cost_price or p.cost_price or "0.00"),
                    "current_stock": str(v.current_stock or "0"),
                    "attributes": v.attributes or {},
                    "size": (v.attributes or {}).get("size") or "",
                    "color": (v.attributes or {}).get("color") or "",
                }
                for v in p.variations.all()
                if getattr(v, "is_active", True)
            ]
            
            results.append({
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "barcode": p.barcode or "",
                "selling_price": str(p.selling_price or "0.00"),
                "cost_price": str(p.cost_price or "0.00"),
                "current_stock": str(p.current_stock or "0"),
                "track_inventory": bool(p.track_inventory),
                "size_variants": p.size_variants or [],
                "category_id": p.category_id,
                "category_name": p.category.name if p.category else "",
                "brand_id": p.brand_id,
                "brand_name": p.brand.name if p.brand else "",
                "unit_name": p.unit.name if p.unit else "pcs",
                "unit_code": getattr(p.unit, "short_code", "pcs") if p.unit else "pcs",
                "image_url": p.image.url if p.image else None,
                "warranty_months": p.warranty_months,
                "replacement_guarantee_days": p.replacement_guarantee_days,
                "units": units,
                "variations": variations,
                "in_stock_units_count": len(units),
            })
            
        return Response({
            "shop_id": shop.id,
            "shop_name": shop.name,
            "synced_at": timezone.now().isoformat(),
            "count": len(results),
            "products": results,
        })


class OfflineSyncView(_POSBase):
    """
    Receives an array of offline sales completed during network/power outage,
    applies atomic transactions per sale, prevents duplication via idempotency keys,
    deducts inventory, records payments, and returns sync statuses.
    """
    def post(self, request):
        from django.db import transaction
        from sales.models import Sale
        from crm.models import Customer
        from dateutil import parser as date_parser
        from django.utils import timezone

        sales_data = request.data.get("sales", [])
        if not isinstance(sales_data, list):
            return Response({"detail": "'sales' must be an array."}, status=status.HTTP_400_BAD_REQUEST)

        synced = []
        failed = []

        for item in sales_data:
            client_offline_id = str(item.get("client_offline_id") or item.get("idempotency_key") or "").strip()
            if not client_offline_id:
                failed.append({
                    "client_offline_id": "UNKNOWN",
                    "error": "Missing client_offline_id / idempotency_key"
                })
                continue

            # Check if this offline sale was already synced
            existing = Sale.all_objects.filter(shop_id=request.user.shop.id, idempotency_key=client_offline_id).first()
            if existing:
                synced.append({
                    "client_offline_id": client_offline_id,
                    "id": existing.id,
                    "invoice_no": existing.invoice_no,
                    "status": "already_synced",
                    "total": str(existing.total),
                    "paid": str(existing.paid),
                })
                continue

            # Process individual offline sale inside its own atomic savepoint
            try:
                with transaction.atomic():
                    ser = SaleCreateSerializer(data=item, context={"request": request})
                    ser.is_valid(raise_exception=True)
                    v_data = ser.validated_data

                    customer = v_data.get("customer")
                    if not customer:
                        cust_name = str(item.get("customer_name", "")).strip()
                        cust_phone = str(item.get("customer_phone", "")).strip()
                        if cust_name and cust_phone:
                            customer = Customer.objects.filter(shop=request.user.shop, phone=cust_phone).first()
                            if not customer:
                                customer = Customer.objects.create(
                                    shop=request.user.shop,
                                    name=cust_name[:150],
                                    phone=cust_phone[:30],
                                    email=str(item.get("customer_email", "")).strip()[:254],
                                    address=str(item.get("customer_address", "")).strip(),
                                )

                    sale_date_raw = item.get("sale_date")
                    parsed_sale_date = None
                    if sale_date_raw:
                        try:
                            parsed_sale_date = date_parser.parse(str(sale_date_raw))
                        except Exception:
                            parsed_sale_date = timezone.now()
                    else:
                        parsed_sale_date = timezone.now()

                    sale = create_sale(
                        shop=request.user.shop,
                        customer=customer,
                        sale_date=parsed_sale_date,
                        due_date=v_data.get("due_date"),
                        discount=v_data.get("discount", 0),
                        tax=v_data.get("tax", 0),
                        note=str(v_data.get("note", "") or "অফলাইন বিক্রয় (Offline Synced)").strip()[:255],
                        items=v_data["items"],
                        payments=v_data.get("payments", []),
                        created_by=request.user,
                        is_emi=v_data.get("is_emi", False),
                        emi_months=v_data.get("emi_months", 0),
                        down_payment=v_data.get("down_payment", 0),
                        emi_interest_percent=v_data.get("emi_interest_percent", 0),
                        is_quotation=v_data.get("is_quotation", False),
                        idempotency_key=client_offline_id[:64],
                    )

                    synced.append({
                        "client_offline_id": client_offline_id,
                        "id": sale.id,
                        "invoice_no": sale.invoice_no,
                        "status": "synced",
                        "total": str(sale.total),
                        "paid": str(sale.paid),
                    })

            except Exception as e:
                failed.append({
                    "client_offline_id": client_offline_id,
                    "error": str(e),
                })

        return Response({
            "total_received": len(sales_data),
            "total_synced": len(synced),
            "total_failed": len(failed),
            "synced": synced,
            "failed": failed,
        }, status=status.HTTP_200_OK if not failed else status.HTTP_207_MULTI_STATUS)
