from django.urls import path

from .views import ReportCatalogView, ReportExportView, SellingDetailsView

urlpatterns = [
    path("", ReportCatalogView.as_view(), name="report-catalog"),
    path("export/", ReportExportView.as_view(), name="report-export"),
    path("selling-details/", SellingDetailsView.as_view(), name="selling-details"),
]
