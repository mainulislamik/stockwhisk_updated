from rest_framework.routers import DefaultRouter

from .views import EMIScheduleViewSet, SaleViewSet

router = DefaultRouter()
router.register("sales", SaleViewSet, basename="sale")
router.register("emi", EMIScheduleViewSet, basename="emi")

urlpatterns = router.urls
