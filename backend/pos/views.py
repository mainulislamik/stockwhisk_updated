"""
POS endpoints — kept deliberately thin and fast. Barcode lookup + a checkout
that wraps the sales service. Speed target: <30s per transaction, so minimal
round-trips (one lookup per scan, one checkout call).
"""
from django.db.models import Q
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.models import Product, ProductUnit
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

        tenant_id = getattr(request.tenant, "id", None)

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
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(SaleSerializer(sale, context={"request": request}).data, status=status.HTTP_201_CREATED)
