from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import EMIScheduleViewSet, SaleViewSet, PublicInvoicePDFView

router = DefaultRouter()
router.register("sales", SaleViewSet, basename="sale")
router.register("emi", EMIScheduleViewSet, basename="emi")

urlpatterns = [
    path("public-invoice/<str:token>/", PublicInvoicePDFView.as_view(), name="public-invoice"),
    *router.urls,
]
