from rest_framework.routers import DefaultRouter

from .views import (
    BrandViewSet,
    CategoryViewSet,
    ProductVariationViewSet,
    ProductViewSet,
    UnitViewSet,
    ProductUnitViewSet,
    ProductImageViewSet,
)

router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="category")
router.register("brands", BrandViewSet, basename="brand")
router.register("units", UnitViewSet, basename="unit")
router.register("product-units", ProductUnitViewSet, basename="product-unit")
router.register("product-images", ProductImageViewSet, basename="product-image")
router.register("products", ProductViewSet, basename="product")
router.register("variations", ProductVariationViewSet, basename="variation")

urlpatterns = router.urls
