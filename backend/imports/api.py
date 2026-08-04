"""
JSON API for the super-admin bulk-import wizard, consumed by the Next.js
frontend. Thin wrappers over ``imports.services`` + ``imports.importers`` — all
business logic (staging, validation, commit, rollback) is reused unchanged.

Mounted at ``/api/platform/imports/``. Staff only (``IsPlatformStaff``).
"""
from django.core.paginator import Paginator
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.urls import path
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsPlatformStaff
from core.tenant_context import bypass_tenant_scope
from tenants.models import Shop

from .importers import get_importer
from .models import ImportJob, ImportMapping, ImportRow
from .services import (
    build_report_csv,
    commit_job,
    detect_and_store_columns,
    missing_required_mappings,
    rollback_job,
    stage_job,
)

app_name = "imports_api"

MAX_UPLOAD = 10 * 1024 * 1024  # 10 MB


def _job_data(job):
    return {
        "id": str(job.id),
        "shop": job.shop_id,
        "shop_name": job.shop.name,
        "import_type": job.import_type,
        "import_type_display": job.get_import_type_display(),
        "status": job.status,
        "status_display": job.get_status_display(),
        "original_filename": job.original_filename,
        "total_rows": job.total_rows,
        "valid_rows": job.valid_rows,
        "error_rows": job.error_rows,
        "created_count": job.created_count,
        "updated_count": job.updated_count,
        "is_committable": job.is_committable,
        "error_summary": job.error_summary,
        "created_at": job.created_at,
        "committed_at": job.committed_at,
    }


def _mapping_info(job):
    importer = get_importer(job.import_type)
    suggested = importer.suggest_mapping(job.detected_columns)
    suggested.update({k: v for k, v in (job.column_mapping or {}).items()})
    return {
        "fields": [
            {"name": f.name, "label": f.label, "required": f.required, "kind": f.kind}
            for f in importer.TARGET_FIELDS
        ],
        "columns": job.detected_columns,
        "mapping": suggested,
    }


class MetaView(APIView):
    permission_classes = [IsPlatformStaff]

    def get(self, request):
        with bypass_tenant_scope():
            shops = [{"id": s.id, "name": s.name} for s in Shop.objects.order_by("name")]
        return Response({
            "shops": shops,
            "types": [{"value": v, "label": l} for v, l in ImportJob.Type.choices],
        })


class JobsView(APIView):
    permission_classes = [IsPlatformStaff]

    def get(self, request):
        with bypass_tenant_scope():
            jobs = list(ImportJob.objects.select_related("shop").all()[:50])
        return Response({"jobs": [_job_data(j) for j in jobs]})


class UploadView(APIView):
    permission_classes = [IsPlatformStaff]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        shop_id = request.data.get("shop")
        import_type = request.data.get("import_type")
        f = request.FILES.get("file")
        if not (shop_id and import_type in dict(ImportJob.Type.choices) and f):
            return Response({"detail": "Pick a shop, an import type and a file."},
                            status=status.HTTP_400_BAD_REQUEST)
        if f.size > MAX_UPLOAD:
            return Response({"detail": "File is too large (max 10 MB)."},
                            status=status.HTTP_400_BAD_REQUEST)
        if not f.name.lower().endswith((".csv", ".xlsx")):
            return Response({"detail": "Upload a CSV or .xlsx file."},
                            status=status.HTTP_400_BAD_REQUEST)
        with bypass_tenant_scope():
            shop = get_object_or_404(Shop.objects, pk=shop_id)
        job = ImportJob.objects.create(
            shop=shop, import_type=import_type, source_file=f,
            original_filename=f.name, created_by=request.user,
        )
        detect_and_store_columns(job)
        job.refresh_from_db()
        return Response({**_job_data(job), **_mapping_info(job)},
                        status=status.HTTP_201_CREATED)


class JobDetailView(APIView):
    permission_classes = [IsPlatformStaff]

    def get(self, request, job_id):
        job = get_object_or_404(ImportJob.objects.select_related("shop"), pk=job_id)
        return Response({**_job_data(job), **_mapping_info(job)})


class MapView(APIView):
    permission_classes = [IsPlatformStaff]

    def post(self, request, job_id):
        job = get_object_or_404(ImportJob, pk=job_id)
        importer = get_importer(job.import_type)
        raw = request.data.get("mapping") or {}
        chosen = {}
        for f in importer.TARGET_FIELDS:
            val = raw.get(f.name, "")
            if val not in ("", None):
                try:
                    chosen[f.name] = int(val)
                except (TypeError, ValueError):
                    return Response({"detail": f"Bad column for {f.label}."},
                                    status=status.HTTP_400_BAD_REQUEST)
        job.column_mapping = chosen
        job.status = ImportJob.Status.MAPPING
        job.save(update_fields=["column_mapping", "status"])

        missing = missing_required_mappings(job)
        if missing:
            return Response({"detail": "Map all required fields: " + ", ".join(missing)},
                            status=status.HTTP_400_BAD_REQUEST)

        stage_job(job)

        if request.data.get("save_template") and request.data.get("template_name"):
            ImportMapping.objects.create(
                shop=job.shop, import_type=job.import_type,
                name=request.data["template_name"], mapping=chosen,
                created_by=request.user,
            )
        job.refresh_from_db()
        return Response(_job_data(job))


class RowsView(APIView):
    permission_classes = [IsPlatformStaff]

    def get(self, request, job_id):
        job = get_object_or_404(ImportJob, pk=job_id)
        only = request.query_params.get("only")
        rows = job.rows.all()
        if only == "errors":
            rows = rows.filter(status=ImportRow.Status.ERROR)
        elif only == "warnings":
            rows = rows.exclude(status=ImportRow.Status.ERROR).exclude(errors=[])
        page = Paginator(rows, 50).get_page(request.query_params.get("page"))
        data = [{
            "row_number": r.row_number,
            "status": r.status,
            "errors": r.errors or [],
            "cleaned": {k: v for k, v in (r.cleaned_data or {}).items() if k != "_previous"},
            "raw": r.raw_data,
            "match_key": r.match_key,
        } for r in page]
        return Response({
            "rows": data, "page": page.number, "num_pages": page.paginator.num_pages,
            "count": page.paginator.count, "only": only,
            **_mapping_info(job),
        })


class CommitView(APIView):
    permission_classes = [IsPlatformStaff]

    def post(self, request, job_id):
        job = get_object_or_404(ImportJob, pk=job_id)
        if not job.is_committable:
            return Response({"detail": "This job is not ready to commit."},
                            status=status.HTTP_400_BAD_REQUEST)
        skip_errors = bool(request.data.get("skip_errors"))
        if job.error_rows > 0 and not skip_errors:
            return Response(
                {"detail": "There are error rows. Fix them or set skip_errors."},
                status=status.HTTP_400_BAD_REQUEST)
        try:
            commit_job(job, skip_errors=skip_errors, actor=request.user)
        except Exception as exc:  # noqa: BLE001
            return Response({"detail": f"Import failed and was rolled back: {exc}"},
                            status=status.HTTP_400_BAD_REQUEST)
        job.refresh_from_db()
        return Response(_job_data(job))


class ReportView(APIView):
    permission_classes = [IsPlatformStaff]

    def get(self, request, job_id):
        job = get_object_or_404(ImportJob, pk=job_id)
        resp = HttpResponse(build_report_csv(job), content_type="text/csv")
        resp["Content-Disposition"] = f'attachment; filename="import_{job.id}_report.csv"'
        return resp


class RollbackView(APIView):
    permission_classes = [IsPlatformStaff]

    def post(self, request, job_id):
        job = get_object_or_404(ImportJob, pk=job_id)
        try:
            reverted, skipped = rollback_job(job, actor=request.user)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        job.refresh_from_db()
        return Response({**_job_data(job), "reverted": reverted, "skipped": skipped})


urlpatterns = [
    path("meta/", MetaView.as_view(), name="meta"),
    path("jobs/", JobsView.as_view(), name="jobs"),
    path("upload/", UploadView.as_view(), name="upload"),
    path("jobs/<uuid:job_id>/", JobDetailView.as_view(), name="detail"),
    path("jobs/<uuid:job_id>/map/", MapView.as_view(), name="map"),
    path("jobs/<uuid:job_id>/rows/", RowsView.as_view(), name="rows"),
    path("jobs/<uuid:job_id>/commit/", CommitView.as_view(), name="commit"),
    path("jobs/<uuid:job_id>/report/", ReportView.as_view(), name="report"),
    path("jobs/<uuid:job_id>/rollback/", RollbackView.as_view(), name="rollback"),
]
