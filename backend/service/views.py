from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from core.api import TenantScopedViewSet
from core.permissions import HasPermCode, IsTenantMember
from core.tenant_context import set_current_tenant

from .models import ServiceTicket, ServiceTicketStatusHistory, Warranty, WarrantyClaim
from .serializers import (
    ServiceTicketSerializer,
    TicketCreateSerializer,
    TicketPartInputSerializer,
    WarrantyClaimSerializer,
    WarrantySerializer,
)
from .services import (
    add_ticket_part,
    change_ticket_status,
    create_ticket,
    lookup_warranties,
)


class WarrantyViewSet(TenantScopedViewSet):
    serializer_class = WarrantySerializer
    # Viewing warranties/coverage only needs read access; editing/voiding needs
    # manage_service.
    required_perm = "view_service"
    required_write_perm = "manage_service"

    def get_queryset(self):
        from datetime import timedelta
        from django.db.models import Q
        from django.utils import timezone
        qs = Warranty.objects.select_related("product", "customer")
        # Coverage only counts once the item is SOLD — hide warranties for units
        # still in stock (their clock hasn't started).
        qs = qs.filter(Q(sale_item__isnull=False) | Q(product_unit__status="sold"))
        # By default also hide ended (expired) and voided coverage — it drops off
        # automatically once the expiry date passes. ?include_expired=1 = full history.
        if self.request.query_params.get("include_expired") not in {"1", "true"}:
            qs = qs.filter(expiry_date__gte=timezone.localdate()).exclude(
                status=Warranty.Status.VOID)
        if st := self.request.query_params.get("status"):
            if st == "expiring_soon":
                today = timezone.localdate()
                qs = qs.filter(
                    Q(status=Warranty.Status.EXPIRING_SOON) |
                    Q(expiry_date__gte=today, expiry_date__lte=today + timedelta(days=30))
                ).exclude(status__in=[Warranty.Status.CLAIMED, Warranty.Status.VOID, Warranty.Status.EXPIRED])
            else:
                qs = qs.filter(status=st)
        if search := self.request.query_params.get("search"):
            qs = qs.filter(
                Q(product__name__icontains=search) |
                Q(serial_no__icontains=search) |
                Q(customer__name__icontains=search)
            )
        return qs

    @action(detail=False, methods=["get"])
    def lookup(self, request):
        """Counter lookup by ?phone= or ?invoice_no= (staff only)."""
        qs = lookup_warranties(
            request.user.shop,
            phone=request.query_params.get("phone"),
            invoice_no=request.query_params.get("invoice_no"),
        )
        return Response(WarrantySerializer(qs, many=True).data)


class WarrantyClaimViewSet(TenantScopedViewSet):
    serializer_class = WarrantyClaimSerializer
    required_perm = "view_service"
    required_write_perm = "manage_service"

    def get_queryset(self):
        return WarrantyClaim.objects.select_related("warranty")

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError
        from django.utils import timezone
        from .models import Warranty
        warranty = serializer.validated_data.get("warranty")
        if warranty:
            if warranty.status == Warranty.Status.VOID:
                raise ValidationError({"detail": "Cannot create a claim on a voided warranty."})
            if warranty.expiry_date and warranty.expiry_date < timezone.localdate():
                raise ValidationError({"detail": "Cannot create a claim on an expired warranty."})
        serializer.save()

    def perform_update(self, serializer):
        instance = serializer.save()
        if instance.warranty:
            from .models import Warranty
            if instance.status == WarrantyClaim.Status.RESOLVED:
                instance.warranty.status = Warranty.Status.CLAIMED
            elif instance.status in {WarrantyClaim.Status.REJECTED, WarrantyClaim.Status.OPEN, WarrantyClaim.Status.IN_PROGRESS}:
                instance.warranty.status = instance.warranty.compute_status()
            instance.warranty.save(update_fields=["status"])


class ServiceTicketViewSet(TenantScopedViewSet):
    # Viewing repair tickets/status is read; create/edit/change-status needs
    # manage_service.
    required_perm = "view_service"
    required_write_perm = "manage_service"

    def get_queryset(self):
        qs = ServiceTicket.objects.select_related("customer", "technician").prefetch_related(
            "parts", "history"
        )
        params = self.request.query_params
        if cust := params.get("customer"):
            qs = qs.filter(customer_id=cust)
        if st := params.get("status"):
            qs = qs.filter(status=st)
        if search := params.get("search"):
            from django.db.models import Q
            qs = qs.filter(
                Q(ticket_no__icontains=search)
                | Q(customer_name__icontains=search)
                | Q(customer_phone__icontains=search)
                | Q(device_description__icontains=search)
                | Q(customer__name__icontains=search)
                | Q(customer__phone__icontains=search)
            )
        return qs

    def get_serializer_class(self):
        return TicketCreateSerializer if self.action == "create" else ServiceTicketSerializer

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        ticket = create_ticket(
            shop=request.user.shop, customer=d.get("customer"),
            customer_name=d.get("customer_name", ""), customer_phone=d.get("customer_phone", ""),
            device_description=d["device_description"], imei_serial=d.get("imei_serial", ""), complaint=d["complaint"],
            service_charge=d.get("service_charge", 0),
            estimated_delivery=d.get("estimated_delivery"), created_by=request.user,
        )
        advance = d.get("advance_paid", 0)
        if advance > 0:
            from .services import add_ticket_payment
            advance_method = d.get("advance_method") or request.data.get("payment_method") or "cash"
            add_ticket_payment(ticket=ticket, amount=advance, method=advance_method, created_by=request.user)
        return Response(ServiceTicketSerializer(ticket).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def change_status(self, request, pk=None):
        ticket = self.get_object()
        new_status = request.data.get("status")
        if new_status not in ServiceTicket.Status.values:
            return Response({"detail": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)
        change_ticket_status(
            ticket=ticket, new_status=new_status,
            note=request.data.get("note", ""), changed_by=request.user,
        )
        # Re-fetch so freshly created history/parts aren't hidden by the
        # prefetch cache captured in get_object().
        fresh = self.get_queryset().get(pk=ticket.pk)
        return Response(ServiceTicketSerializer(fresh).data)

    @action(detail=True, methods=["post"])
    def add_part(self, request, pk=None):
        ticket = self.get_object()
        ser = TicketPartInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        add_ticket_part(
            ticket=ticket, product=d["product"], quantity=d["quantity"],
            unit_cost=d.get("unit_cost"), unit_price=d.get("unit_price"),
            from_stock=d["from_stock"], created_by=request.user,
        )
        fresh = self.get_queryset().get(pk=ticket.pk)
        return Response(ServiceTicketSerializer(fresh).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def add_payment(self, request, pk=None):
        ticket = self.get_object()
        amount = request.data.get("amount")
        method = request.data.get("method", "cash")
        if not amount:
            return Response({"detail": "Amount is required."}, status=status.HTTP_400_BAD_REQUEST)
        from .services import add_ticket_payment
        from decimal import Decimal
        try:
            add_ticket_payment(ticket=ticket, amount=Decimal(amount), method=method, created_by=request.user)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        fresh = self.get_queryset().get(pk=ticket.pk)
        return Response(ServiceTicketSerializer(fresh).data)

    @action(detail=True, methods=["post", "put", "patch"])
    def edit(self, request, pk=None):
        ticket = self.get_object()
        d = request.data
        reason = d.get("correction_reason", "").strip()
        if not reason:
            return Response({"detail": "Correction reason is required."}, status=status.HTTP_400_BAD_REQUEST)
        from .services import edit_service_ticket
        try:
            updated = edit_service_ticket(
                ticket=ticket,
                parts=d.get("parts"),
                service_charge=d.get("service_charge"),
                discount=d.get("discount"),
                customer_id=d.get("customer_id"),
                customer_name=d.get("customer_name"),
                customer_phone=d.get("customer_phone"),
                device_description=d.get("device_description"),
                complaint=d.get("complaint"),
                estimated_delivery=d.get("estimated_delivery"),
                correction_reason=reason,
                created_by=request.user,
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        fresh = self.get_queryset().get(pk=ticket.pk)
        return Response(ServiceTicketSerializer(fresh).data)


class ServiceDashboardView(APIView):
    permission_classes = [IsTenantMember, HasPermCode]
    required_perm = "view_service"

    def initial(self, request, *args, **kwargs):
        set_current_tenant(getattr(request.user, "shop", None))
        request.tenant = getattr(request.user, "shop", None)
        super().initial(request, *args, **kwargs)

    def get(self, request, *args, **kwargs):
        from datetime import timedelta
        from django.db.models import Count, Q
        from django.utils import timezone

        shop = request.tenant or getattr(request.user, "shop", None)
        open_ticket_qs = ServiceTicket.objects.exclude(
            status__in=[ServiceTicket.Status.DELIVERED, ServiceTicket.Status.CANCELLED]
        )
        by_status = list(open_ticket_qs.values("status").annotate(n=Count("id")))
        today = timezone.localdate()
        overdue = open_ticket_qs.filter(
            estimated_delivery__lt=today
        ).count()
        workload = list(
            open_ticket_qs.exclude(technician__isnull=True)
            .values("technician__email").annotate(n=Count("id"))
        )
        expiring = Warranty.objects.filter(
            Q(sale_item__isnull=False) | Q(product_unit__status="sold")
        ).filter(
            Q(status=Warranty.Status.EXPIRING_SOON) |
            Q(expiry_date__gte=today, expiry_date__lte=today + timedelta(days=30))
        ).exclude(status__in=[Warranty.Status.CLAIMED, Warranty.Status.VOID, Warranty.Status.EXPIRED]).count()
        return Response({
            "open_by_status": by_status,
            "overdue_tickets": overdue,
            "technician_workload": workload,
            "warranties_expiring_soon": expiring,
        })


from rest_framework.permissions import AllowAny

class PublicServiceTicketTrackView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, token=None, track_token=None):
        token = token or track_token
        ticket = ServiceTicket.all_objects.select_related("shop", "branch", "customer").filter(track_token=token).first()
        if not ticket:
            return Response({"error": "Service ticket not found with this tracking link."}, status=status.HTTP_404_NOT_FOUND)

        raw_phone = ticket.customer_phone or (ticket.customer.phone if ticket.customer else "")
        masked_phone = ""
        if raw_phone:
            if len(raw_phone) > 6:
                masked_phone = raw_phone[:5] + "***" + raw_phone[-3:]
            else:
                masked_phone = raw_phone[:2] + "***"

        shop = ticket.shop
        logo_url = ""
        if getattr(shop, "logo", None) and shop.logo:
            try:
                logo_url = shop.logo.url
            except Exception:
                logo_url = ""

        history_data = []
        for h in ServiceTicketStatusHistory.all_objects.filter(ticket=ticket).order_by("created_at"):
            history_data.append({
                "id": h.id,
                "from_status": h.from_status,
                "to_status": h.to_status,
                "note": h.note,
                "created_at": h.created_at,
            })

        return Response({
            "ticket_no": ticket.ticket_no,
            "status": ticket.status,
            "status_display": ticket.get_status_display(),
            "device_description": ticket.device_description,
            "device_type": ticket.device_type,
            "complaint": ticket.complaint,
            "received_at": ticket.received_at,
            "estimated_delivery": ticket.estimated_delivery,
            "actual_delivery": ticket.actual_delivery,
            "service_charge": float(ticket.service_charge),
            "discount": float(ticket.discount),
            "paid": float(ticket.paid),
            "bill_total": float(ticket.bill_total),
            "due": float(ticket.due),
            "customer_name": ticket.customer_name or (ticket.customer.name if ticket.customer else "Customer"),
            "customer_phone_masked": masked_phone,
            "shop": {
                "id": shop.id,
                "name": shop.name,
                "phone": shop.phone,
                "email": shop.email,
                "address": shop.address,
                "logo": logo_url,
            },
            "history": history_data,
        })



# ── Service Job Views (Printing, Media & Online Services) ─────────────────────

from django.db.models import Count, Q, Sum
from .models import (
    ServiceJob,
    ServiceJobMaterial,
    ServiceJobStatusHistory,
)
from .serializers import (
    ServiceJobSerializer,
    ServiceJobCreateSerializer,
    ServiceJobStatusUpdateSerializer,
    ServiceJobPaymentSerializer,
    ServiceJobMaterialInputSerializer,
    ServiceJobMaterialSerializer,
)
from .services import (
    create_service_job,
    update_service_job_status,
    add_service_job_payment,
    add_service_job_material,
)


class ServiceJobViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ServiceJobSerializer

    def initial(self, request, *args, **kwargs):
        set_current_tenant(getattr(request.user, "shop", None))
        request.tenant = getattr(request.user, "shop", None)
        super().initial(request, *args, **kwargs)

    def get_queryset(self):
        qs = ServiceJob.all_objects.select_related("customer", "branch", "created_by").prefetch_related(
            "materials__product", "history__changed_by"
        ).filter(shop=self.request.user.shop)

        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        service_type = self.request.query_params.get("service_type")
        if service_type:
            qs = qs.filter(service_type__icontains=service_type)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(job_number__icontains=search) |
                Q(customer_name__icontains=search) |
                Q(customer_phone__icontains=search) |
                Q(reference_no__icontains=search)
            )
        return qs

    def create(self, request, *args, **kwargs):
        ser = ServiceJobCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        job = create_service_job(
            shop=request.user.shop,
            validated_data=ser.validated_data,
            created_by=request.user,
        )
        return Response(ServiceJobSerializer(job).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def update_status(self, request, pk=None):
        job = self.get_object()
        ser = ServiceJobStatusUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        job = update_service_job_status(
            job=job,
            to_status=ser.validated_data["status"],
            note=ser.validated_data.get("note", ""),
            changed_by=request.user,
        )
        return Response(ServiceJobSerializer(job).data)

    @action(detail=True, methods=["post"])
    def add_payment(self, request, pk=None):
        job = self.get_object()
        ser = ServiceJobPaymentSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        job = add_service_job_payment(
            job=job,
            amount=ser.validated_data["amount"],
            payment_method=ser.validated_data.get("payment_method", "cash"),
            note=ser.validated_data.get("note", ""),
            created_by=request.user,
        )
        return Response(ServiceJobSerializer(job).data)

    @action(detail=True, methods=["post"])
    def add_material(self, request, pk=None):
        job = self.get_object()
        ser = ServiceJobMaterialInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        material = add_service_job_material(
            job=job,
            product=ser.validated_data["product"],
            quantity=ser.validated_data.get("quantity", 1),
            unit_cost=ser.validated_data.get("unit_cost"),
            from_stock=ser.validated_data.get("from_stock", True),
            created_by=request.user,
        )
        return Response(ServiceJobMaterialSerializer(material).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="send-ready-notice")
    def send_ready_notice(self, request, pk=None):
        job = self.get_object()
        phone = job.customer_phone or ""
        clean_phone = "".join(filter(str.isdigit, phone))
        if clean_phone.startswith("0"):
            clean_phone = "88" + clean_phone
        elif clean_phone and not clean_phone.startswith("88"):
            clean_phone = "88" + clean_phone

        shop_name = job.shop.name or "StockWhisk Services"
        lines_arr = [
            f"শ্রদ্ধেয় {job.customer_name} স্যার/ম্যাম,",
            f"আপনার অর্ডারকৃত কাজ ({job.service_type}) সম্পন্ন ও প্রস্তুত রয়েছে।",
            f"অর্ডার নং: #{job.job_number}",
            f"মোট বিল: ৳{job.total_bill:.2f}",
            f"বকেয়া: ৳{job.due_amount:.2f}",
            f"লাইভ ট্র্যাকিং লিংক: https://stockwhisk.com/track-job/{job.track_token}",
            f"ধন্যবাদ, {shop_name}",
        ]
        text_msg = "\n".join(lines_arr)
        import urllib.parse
        encoded = urllib.parse.quote(text_msg)
        wa_link = f"https://api.whatsapp.com/send?phone={clean_phone}&text={encoded}"

        return Response({
            "success": True,
            "customer_phone": phone,
            "message_text": text_msg,
            "whatsapp_link": wa_link,
        })

    @action(detail=False, methods=["get"])
    def summary(self, request):
        shop = request.user.shop
        jobs = ServiceJob.objects.filter(shop=shop)

        total_jobs = jobs.count()
        pending_count = jobs.filter(status=ServiceJob.Status.PENDING).count()
        processing_count = jobs.filter(status=ServiceJob.Status.PROCESSING).count()
        ready_count = jobs.filter(status=ServiceJob.Status.READY).count()
        delivered_count = jobs.filter(status=ServiceJob.Status.DELIVERED).count()

        sums = jobs.aggregate(
            total_govt_fee=Sum("govt_fee"),
            total_service_charge=Sum("service_charge"),
            total_material_cost=Sum("material_cost"),
            total_other_charge=Sum("other_charge"),
            total_bill=Sum("total_bill"),
            total_advance_paid=Sum("advance_paid"),
            total_due_amount=Sum("due_amount"),
        )

        return Response({
            "total_jobs": total_jobs,
            "pending_count": pending_count,
            "processing_count": processing_count,
            "ready_count": ready_count,
            "delivered_count": delivered_count,
            "total_govt_fee": float(sums["total_govt_fee"] or 0),
            "total_service_charge": float(sums["total_service_charge"] or 0),
            "total_material_cost": float(sums["total_material_cost"] or 0),
            "total_other_charge": float(sums["total_other_charge"] or 0),
            "total_bill": float(sums["total_bill"] or 0),
            "total_advance_paid": float(sums["total_advance_paid"] or 0),
            "total_due_amount": float(sums["total_due_amount"] or 0),
            "net_service_profit": float(
                (sums["total_service_charge"] or 0) + (sums["total_other_charge"] or 0) - (sums["total_material_cost"] or 0)
            ),
        })


class PublicServiceJobTrackView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        try:
            job = ServiceJob.all_objects.select_related("shop").get(track_token=token)
        except ServiceJob.DoesNotExist:
            return Response({"error": "Service job not found or invalid token"}, status=status.HTTP_404_NOT_FOUND)

        shop = job.shop
        masked_phone = job.customer_phone
        if masked_phone and len(masked_phone) >= 7:
            masked_phone = masked_phone[:3] + "****" + masked_phone[-4:]

        history_data = []
        for h in ServiceJobStatusHistory.all_objects.filter(job=job).order_by("created_at"):
            history_data.append({
                "id": h.id,
                "from_status": h.from_status,
                "to_status": h.to_status,
                "note": h.note,
                "created_at": h.created_at,
            })

        return Response({
            "job_number": job.job_number,
            "status": job.status,
            "status_display": job.get_status_display(),
            "service_type": job.service_type,
            "reference_no": job.reference_no,
            "specifications": job.specifications,
            "artwork_url": job.artwork_url,
            "design_approved": job.design_approved,
            "design_approved_at": job.design_approved_at,
            "finishing_charge": float(job.finishing_charge),
            "meter_start": job.meter_start,
            "meter_end": job.meter_end,
            "delivery_date": job.delivery_date,
            "actual_delivery_date": job.actual_delivery_date,
            "govt_fee": float(job.govt_fee),
            "service_charge": float(job.service_charge),
            "other_charge": float(job.other_charge),
            "discount": float(job.discount),
            "total_bill": float(job.total_bill),
            "advance_paid": float(job.advance_paid),
            "due_amount": float(job.due_amount),
            "customer_name": job.customer_name,
            "customer_phone_masked": masked_phone,
            "shop": {
                "id": shop.id,
                "name": shop.name,
                "phone": shop.phone,
                "email": shop.email,
                "address": shop.address,
            },
            "history": history_data,
        })

    def post(self, request, token):
        try:
            job = ServiceJob.all_objects.select_related("shop").get(track_token=token)
        except ServiceJob.DoesNotExist:
            return Response({"error": "Service job not found or invalid token"}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get("action")
        if action == "approve_design":
            from .services import approve_service_job_design
            note = request.data.get("note") or "কাস্টমার ট্র্যাকিং পোর্টাল থেকে ডিজাইন অনুমোদন করেছেন।"
            job = approve_service_job_design(job, note=note)
            return Response({
                "success": True,
                "message": "ডিজাইন সফলভাবে অনুমোদিত হয়েছে।",
                "design_approved": job.design_approved,
                "design_approved_at": job.design_approved_at,
            })

        return Response({"error": "Unknown action"}, status=status.HTTP_400_BAD_REQUEST)
