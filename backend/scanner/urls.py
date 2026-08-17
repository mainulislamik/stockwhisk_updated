from django.urls import path
from .views import ScannerAPIView

urlpatterns = [
    path('scan/', ScannerAPIView.as_view(), name='scanner-scan'),
]
