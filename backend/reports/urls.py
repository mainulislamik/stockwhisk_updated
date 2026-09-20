from django.urls import path

from .views import DownloadDigestPdfView, ReportCatalogView, ReportExportView, SellingDetailsView

urlpatterns = [
    path("", ReportCatalogView.as_view(), name="report-catalog"),
    path("export/", ReportExportView.as_view(), name="report-export"),
    path("selling-details/", SellingDetailsView.as_view(), name="selling-details"),
    path("download-digest-pdf/", DownloadDigestPdfView.as_view(), name="download-digest-pdf"),
]
