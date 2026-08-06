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
        
        # Product might have a comma-separated list of barcodes
        products = (
            Product.objects.filter(is_active=True)
            .filter(Q(barcode__contains=code) | Q(sku=code))
            .select_related("category", "brand", "unit")
        )
        
        product = None
        scanned_unit = None

        for p in products:
            if code == p.sku or code in [x.strip() for x in p.barcode.split(",")]:
                product = p
                break
                
        if product is None:
            # Check if it matches a ProductUnit
            unit = ProductUnit.all_objects.filter(barcode=code, status=ProductUnit.Status.IN_STOCK).select_related("product").first()
            if unit and unit.product.is_active and getattr(unit.product, "shop_id", None) == request.tenant.id:
                product = unit.product
                scanned_unit = unit

        if product is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        
        data = ProductSerializer(product).data
        if scanned_unit:
            data["scanned_unit"] = ProductUnitSerializer(scanned_unit).data
            
        return Response(data)


class CheckoutView(_POSBase):
    def post(self, request):
        ser = SaleCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        sale = create_sale(
            shop=request.user.shop,
            customer=data.get("customer"),
            discount=data.get("discount", 0),
            tax=data.get("tax", 0),
            note=data.get("note", ""),
            items=data["items"],
            payments=data.get("payments", []),
            created_by=request.user,
        )
        return Response(SaleSerializer(sale).data, status=status.HTTP_201_CREATED)
