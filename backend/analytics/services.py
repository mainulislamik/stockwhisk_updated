"""
Analytics service layer — reusable aggregations powering the dashboard, the
reports export app (8.6), and future AI insights. Expensive aggregations are
cached per shop with a short TTL.

Field note: Phase 1 named the per-product threshold ``reorder_level`` and the
cost ``cost_price``; the spec calls these ``minimum_stock`` / ``purchase_price``.
Same fields, treated as synonyms here.
"""
from datetime import timedelta
from decimal import Decimal

from dateutil.relativedelta import relativedelta
from django.core.cache import cache
from django.db.models import (
    Count,
    DecimalField,
    ExpressionWrapper,
    F,
    Min,
    Q,
    Sum,
)
from django.db.models.functions import Coalesce, TruncDate, TruncHour, TruncMonth, TruncWeek
from django.utils import timezone

from catalog.models import Product
from inventory.models import MovementType, StockMovement
from sales.models import Sale, SaleItem
from service.models import ServiceTicket

ZERO = Decimal("0")
_DEC = DecimalField(max_digits=18, decimal_places=2)


def _sum(qs, expr):
    return qs.aggregate(v=Coalesce(Sum(expr, output_field=_DEC), ZERO, output_field=_DEC))["v"]


def _sale_items(shop, start=None, end=None):
    qs = SaleItem.all_objects.filter(shop_id=shop.id).exclude(sale__status=Sale.Status.CANCELLED)
    if start is not None:
        qs = qs.filter(sale__sale_date__gte=start)
    if end is not None:
        qs = qs.filter(sale__sale_date__lte=end)
    return qs


def _sale_discount_total(shop, start=None, end=None):
    """Σ of invoice-level discounts over the same non-cancelled sales. Item
    subtotals only carry line discounts, so top-line revenue must subtract this."""
    qs = Sale.all_objects.filter(shop_id=shop.id).exclude(status=Sale.Status.CANCELLED)
    if start is not None:
        qs = qs.filter(sale_date__gte=start)
    if end is not None:
        qs = qs.filter(sale_date__lte=end)
    return _sum(qs, "discount")


# --- period helpers ----------------------------------------------------------

def period_bounds(kind, now=None):
    from datetime import datetime, time
    loc_now = timezone.localtime(now) if now else timezone.localtime()
    today = loc_now.date()
    start_day = timezone.make_aware(datetime.combine(today, time.min))
    if kind == "today":
        return start_day, timezone.now()
    if kind == "week":
        week_start = today - timedelta(days=loc_now.weekday())
        return timezone.make_aware(datetime.combine(week_start, time.min)), timezone.now()
    if kind == "month":
        month_start = today.replace(day=1)
        return timezone.make_aware(datetime.combine(month_start, time.min)), timezone.now()
    if kind == "quarter":
        q_month = ((today.month - 1) // 3) * 3 + 1
        q_start = today.replace(month=q_month, day=1)
        return timezone.make_aware(datetime.combine(q_start, time.min)), timezone.now()
    if kind == "year":
        y_start = today.replace(month=1, day=1)
        return timezone.make_aware(datetime.combine(y_start, time.min)), timezone.now()
    raise ValueError(kind)


# ---------------------------------------------------------------------------
# Inventory analytics
# ---------------------------------------------------------------------------

def stock_value(shop):
    """Total capital tied in stock: sum(current_stock * cost_price)."""
    return _sum(
        Product.all_objects.filter(shop_id=shop.id, is_active=True),
        ExpressionWrapper(F("current_stock") * F("cost_price"), output_field=_DEC),
    )


def stock_by_category(shop):
    return list(
        Product.all_objects.filter(shop_id=shop.id, is_active=True)
        .values("category__name")
        .annotate(
            units=Coalesce(Sum("current_stock", output_field=_DEC), ZERO, output_field=_DEC),
            value=Coalesce(
                Sum(ExpressionWrapper(F("current_stock") * F("cost_price"), output_field=_DEC)),
                ZERO, output_field=_DEC,
            ),
        )
        .order_by("-value")
    )


def stock_by_brand(shop):
    return list(
        Product.all_objects.filter(shop_id=shop.id, is_active=True)
        .values("brand__name")
        .annotate(
            units=Coalesce(Sum("current_stock", output_field=_DEC), ZERO, output_field=_DEC),
            value=Coalesce(
                Sum(ExpressionWrapper(F("current_stock") * F("cost_price"), output_field=_DEC)),
                ZERO, output_field=_DEC,
            ),
        )
        .order_by("-value")
    )


def low_stock_list(shop):
    from django.db.models import Q
    return list(
        Product.all_objects.filter(
            Q(current_stock__lte=F("reorder_level")) | Q(current_stock__lte=5),
            shop_id=shop.id, track_inventory=True, is_active=True,
            current_stock__gt=0,
        ).values("id", "name", "sku", "current_stock", "reorder_level")
    )


def out_of_stock_list(shop):
    return list(
        Product.all_objects.filter(
            shop_id=shop.id, track_inventory=True, is_active=True, current_stock__lte=0,
        ).values("id", "name", "sku", "current_stock", "reorder_level")
    )


def dead_stock(shop, days=90):
    """
    Products with stock on hand but ZERO sale-out movements in the window.
    Returns the list plus total tied-up capital.
    """
    cutoff = timezone.now() - timedelta(days=days)
    sold_ids = (
        SaleItem.all_objects.filter(
            shop_id=shop.id, sale__sale_date__gte=cutoff,
        ).exclude(sale__status=Sale.Status.CANCELLED)
        .values_list("product_id", flat=True).distinct()
    )
    qs = Product.all_objects.filter(
        shop_id=shop.id, is_active=True, current_stock__gt=0
    ).exclude(id__in=list(sold_ids))

    products = list(
        qs.annotate(
            tied_capital=ExpressionWrapper(F("current_stock") * F("cost_price"), output_field=_DEC)
        ).values("id", "name", "current_stock", "cost_price", "tied_capital")
    )
    total = sum((p["tied_capital"] for p in products), ZERO)
    return {"window_days": days, "count": len(products),
            "tied_capital": total, "products": products}


# ---------------------------------------------------------------------------
# Sales analytics
# ---------------------------------------------------------------------------

def sales_rollups(shop):
    from accounting.services import profit_summary
    out = {}
    for kind in ("today", "week", "month", "quarter", "year"):
        start, end = period_bounds(kind)
        ps = profit_summary(shop, start=start, end=end)
        out[kind] = {
            "revenue": ps["revenue"],
            "cogs": ps["cogs"],
            "profit": ps["gross_profit"],
        }
    return out


def sales_overview(shop):
    """The 8 headline sales KPIs for the report page (total / this-month /
    today / last-month × sales-amount & order-count)."""
    from datetime import datetime, time
    from accounting.services import profit_summary

    now = timezone.now()
    today = timezone.localdate()
    today_start = timezone.make_aware(datetime.combine(today, time.min))
    month_start = timezone.make_aware(datetime.combine(today.replace(day=1), time.min))
    last_month_day = today.replace(day=1) - relativedelta(months=1)
    last_month_start = timezone.make_aware(datetime.combine(last_month_day, time.min))
    last_month_end = month_start - timedelta(seconds=1)  # inclusive end of prev month

    def _orders(start, end):
        return _completed_orders(shop, start, end)

    def _sales(start, end):
        return profit_summary(shop, start=start, end=end)["revenue"]

    return {
        "total_sales": _sales(None, None),
        "total_orders": _orders(None, None),
        "this_month_sales": _sales(month_start, now),
        "this_month_orders": _orders(month_start, now),
        "today_sales": _sales(today_start, now),
        "today_orders": _orders(today_start, now),
        "last_month_sales": _sales(last_month_start, last_month_end),
        "last_month_orders": _orders(last_month_start, last_month_end),
    }


def _completed_orders(shop, start=None, end=None):
    qs = Sale.all_objects.filter(shop_id=shop.id).exclude(status=Sale.Status.CANCELLED)
    t_qs = ServiceTicket.all_objects.filter(shop_id=shop.id).exclude(status=ServiceTicket.Status.CANCELLED)
    if start is not None:
        qs = qs.filter(sale_date__gte=start)
        t_qs = t_qs.filter(received_at__gte=start)
    if end is not None:
        qs = qs.filter(sale_date__lte=end)
        t_qs = t_qs.filter(received_at__lte=end)
    return qs.count() + t_qs.count()


def _pct_change(cur, prev):
    """% change vs previous; None when there's no comparable previous value."""
    cur, prev = float(cur or 0), float(prev or 0)
    if prev == 0:
        return None
    return round((cur - prev) / prev * 100, 2)


def _resolve_profit_range(key, custom_start, custom_end, now):
    """Return (start, end, prev_start, prev_end, bucket) for a range key.
    Calendar ranges compare against the same elapsed slice of the previous
    calendar period; rolling ranges compare against the immediately preceding
    equal-length window. Bucket is monthly for long spans, else daily."""
    from datetime import datetime, time
    loc_now = timezone.localtime(now) if now else timezone.localtime()
    today = loc_now.date()
    day_start = timezone.make_aware(datetime.combine(today, time.min))
    us = timedelta(microseconds=1)

    if key == "today":
        start, end = day_start, now
        y_date = today - timedelta(days=1)
        prev_start = timezone.make_aware(datetime.combine(y_date, time.min))
        prev_end = day_start - us
    elif key == "yesterday":
        y_date = today - timedelta(days=1)
        start = timezone.make_aware(datetime.combine(y_date, time.min))
        end = day_start - us
        prev_date = y_date - timedelta(days=1)
        prev_start = timezone.make_aware(datetime.combine(prev_date, time.min))
        prev_end = start - us
    elif key == "7d":
        start, end = now - timedelta(days=7), now
        prev_start, prev_end = now - timedelta(days=14), now - timedelta(days=7)
    elif key in ("30d", ""):
        start, end = now - timedelta(days=30), now
        prev_start, prev_end = now - timedelta(days=60), now - timedelta(days=30)
    elif key == "this_month":
        start = timezone.make_aware(datetime.combine(today.replace(day=1), time.min))
        end = now
        pm_day = today.replace(day=1) - relativedelta(months=1)
        prev_start = timezone.make_aware(datetime.combine(pm_day, time.min))
        prev_end = prev_start + (now - start)
    elif key == "last_month":
        m_start = timezone.make_aware(datetime.combine(today.replace(day=1), time.min))
        lm_day = today.replace(day=1) - relativedelta(months=1)
        start = timezone.make_aware(datetime.combine(lm_day, time.min))
        end = m_start - us
        plm_day = lm_day - relativedelta(months=1)
        prev_start = timezone.make_aware(datetime.combine(plm_day, time.min))
        prev_end = start - us
    elif key == "this_quarter":
        qm = ((today.month - 1) // 3) * 3 + 1
        q_start = timezone.make_aware(datetime.combine(today.replace(month=qm, day=1), time.min))
        start, end = q_start, now
        pq_day = today.replace(month=qm, day=1) - relativedelta(months=3)
        prev_start = timezone.make_aware(datetime.combine(pq_day, time.min))
        prev_end = prev_start + (now - start)
    elif key == "this_year":
        y_start = timezone.make_aware(datetime.combine(today.replace(month=1, day=1), time.min))
        start, end = y_start, now
        py_day = today.replace(month=1, day=1) - relativedelta(years=1)
        prev_start = timezone.make_aware(datetime.combine(py_day, time.min))
        prev_end = prev_start + (now - start)
    elif key == "all_time":
        first_sale = Sale.all_objects.filter(shop_id=shop.id).order_by("sale_date").first()
        first_ticket = ServiceTicket.all_objects.filter(shop_id=shop.id).order_by("received_at").first()
        earliest_dates = []
        if first_sale and first_sale.sale_date:
            earliest_dates.append(first_sale.sale_date)
        if first_ticket and first_ticket.received_at:
            earliest_dates.append(first_ticket.received_at)
        start = min(earliest_dates) if earliest_dates else (day - timedelta(days=30))
        end = now
        prev_start, prev_end = start, end
    elif key == "custom":
        from datetime import datetime as _dt, time as _time
        from django.utils.dateparse import parse_date, parse_datetime

        def _to_dt(s, end_of_day=False):
            if not s:
                return None
            dt = parse_datetime(s)
            if dt is None:
                d = parse_date(s)
                if d is None:
                    return None
                dt = _dt.combine(d, _time.max if end_of_day else _time.min)
            return dt if timezone.is_aware(dt) else timezone.make_aware(dt)

        start = _to_dt(custom_start) or (now - timedelta(days=30))
        end = _to_dt(custom_end, end_of_day=True) or now
        if start:
            dur = end - start
            prev_start, prev_end = start - dur, start - us
        else:
            prev_start, prev_end = None, None
    else:
        start, end = now - timedelta(days=30), now
        prev_start, prev_end = now - timedelta(days=60), now - timedelta(days=30)

    if start is None:
        bucket = "month"
    else:
        bucket = "month" if (end - start).days > 92 else "day"
    return start, end, prev_start, prev_end, bucket


def _profit_trend(shop, start, end, bucket):
    """Per-bucket revenue / cost / gross-profit / orders (gross of returns —
    the summary KPIs carry the return-adjusted figures)."""
    from service.models import ServiceTicket, ServiceTicketPart

    trunc = TruncMonth if bucket == "month" else TruncDate
    item_rows = (
        _sale_items(shop, start, end)
        .annotate(b=trunc("sale__sale_date")).values("b")
        .annotate(
            subtotal=Coalesce(Sum("subtotal", output_field=_DEC), ZERO, output_field=_DEC),
            cost=Coalesce(Sum(ExpressionWrapper(F("quantity") * F("unit_cost"), output_field=_DEC), output_field=_DEC), ZERO, output_field=_DEC),
        )
    )
    sale_rows = (
        Sale.all_objects.filter(shop_id=shop.id).exclude(status=Sale.Status.CANCELLED)
        .filter(sale_date__gte=start, sale_date__lte=end)
        .annotate(b=trunc("sale_date")).values("b")
        .annotate(discount=Coalesce(Sum("discount", output_field=_DEC), ZERO, output_field=_DEC), orders=Count("id"))
    )

    ticket_base = (
        ServiceTicket.all_objects.filter(shop_id=shop.id).exclude(status=ServiceTicket.Status.CANCELLED)
        .filter(received_at__gte=start, received_at__lte=end)
    )
    ticket_rows = (
        ticket_base
        .annotate(b=trunc("received_at")).values("b")
        .annotate(
            service_charge=Coalesce(Sum("service_charge", output_field=_DEC), ZERO, output_field=_DEC),
            discount=Coalesce(Sum("discount", output_field=_DEC), ZERO, output_field=_DEC),
            orders=Count("id"),
        )
    )
    ticket_part_rows = (
        ServiceTicketPart.all_objects.filter(ticket__in=ticket_base)
        .annotate(b=trunc("ticket__received_at")).values("b")
        .annotate(
            parts_revenue=Coalesce(Sum(ExpressionWrapper(F("quantity") * F("unit_price"), output_field=_DEC), output_field=_DEC), ZERO, output_field=_DEC),
            parts_cost=Coalesce(Sum(ExpressionWrapper(F("quantity") * F("unit_cost"), output_field=_DEC), output_field=_DEC), ZERO, output_field=_DEC),
        )
    )

    buckets = {}
    for r in item_rows:
        buckets.setdefault(r["b"], {}).update(subtotal=r["subtotal"], cost=r["cost"])
    for r in sale_rows:
        buckets.setdefault(r["b"], {}).update(discount=r["discount"], orders=r["orders"])

    for r in ticket_rows:
        b = buckets.setdefault(r["b"], {})
        b["service_charge"] = b.get("service_charge", ZERO) + r["service_charge"]
        b["ticket_discount"] = b.get("ticket_discount", ZERO) + r["discount"]
        b["orders"] = b.get("orders", 0) + r["orders"]

    for r in ticket_part_rows:
        b = buckets.setdefault(r["b"], {})
        b["parts_revenue"] = b.get("parts_revenue", ZERO) + r["parts_revenue"]
        b["parts_cost"] = b.get("parts_cost", ZERO) + r["parts_cost"]

    out = []
    for k in sorted(b for b in buckets if b is not None):
        v = buckets[k]
        sale_rev = v.get("subtotal", ZERO) - v.get("discount", ZERO)
        svc_rev = v.get("service_charge", ZERO) + v.get("parts_revenue", ZERO) - v.get("ticket_discount", ZERO)
        revenue = float(max(ZERO, sale_rev) + max(ZERO, svc_rev))
        cost = float(v.get("cost", ZERO) + v.get("parts_cost", ZERO))
        orders = int(v.get("orders", 0))
        profit = revenue - cost
        out.append({
            "date": k.isoformat(),
            "revenue": round(revenue, 2), "cost": round(cost, 2), "profit": round(profit, 2),
            "orders": orders,
            "margin": round((profit / revenue * 100) if revenue else 0.0, 2),
            "avg_profit": round((profit / orders) if orders else 0.0, 2),
        })
    return out


def profit_overview(shop, range_key="30d", custom_start=None, custom_end=None):
    """Profit analytics for the report page: 4 KPIs (with previous-period
    comparison) + per-bucket trend feeding the profit charts. Money figures
    reuse ``accounting.profit_summary`` (net of returns, snapshotted item cost),
    so cards stay consistent with the dashboard. Shop-scoped."""
    from accounting.services import profit_summary

    now = timezone.now()
    start, end, pstart, pend, bucket = _resolve_profit_range(range_key, custom_start, custom_end, now)

    cur = profit_summary(shop, start=start, end=end)
    prev = profit_summary(shop, start=pstart, end=pend)
    cur_orders = _completed_orders(shop, start, end)
    prev_orders = _completed_orders(shop, pstart, pend)

    revenue = float(cur["revenue"] or 0)
    gp = float(cur["gross_profit"] or 0)
    cost = float(cur["cogs"] or 0)
    margin = (gp / revenue * 100) if revenue else 0.0
    avg = (gp / cur_orders) if cur_orders else 0.0

    p_revenue = float(prev["revenue"] or 0)
    p_gp = float(prev["gross_profit"] or 0)
    p_cost = float(prev["cogs"] or 0)
    p_margin = (p_gp / p_revenue * 100) if p_revenue else 0.0
    p_avg = (p_gp / prev_orders) if prev_orders else 0.0

    return {
        "summary": {
            "gross_profit": round(gp, 2), "total_cost": round(cost, 2),
            "profit_margin": round(margin, 2), "average_profit_per_order": round(avg, 2),
            "revenue": round(revenue, 2), "completed_orders": cur_orders,
        },
        "comparison": {
            "gross_profit_change": _pct_change(gp, p_gp),
            "total_cost_change": _pct_change(cost, p_cost),
            # margin compares in percentage POINTS, not % of %.
            "profit_margin_change": round(margin - p_margin, 2) if (revenue or p_revenue) else None,
            "average_profit_per_order_change": _pct_change(avg, p_avg),
            "has_previous": bool(p_revenue or p_gp or prev_orders),
        },
        "trend": _profit_trend(shop, start, end, bucket),
        "range": {"key": range_key, "start": start.isoformat(), "end": end.isoformat(), "bucket": bucket},
    }


def profitability_performance(shop, range_key="30d", custom_start=None, custom_end=None):
    """Per-product profitability for the report page: top-5 profitable, top-5
    loss, and lowest-5 margin products over a date range.

    Product profit uses the SNAPSHOTTED item cost (``SaleItem.unit_cost``) so
    historical margins stay honest. Returns are netted the same way as
    ``accounting.profit_summary``: every refund reduces the product's revenue,
    and restocked returns credit their cost back (non-restocked keep the cost as
    a loss). Cancelled sales are excluded. All queries are shop-scoped.
    """
    from sales.models import SaleReturnItem

    now = timezone.now()
    start, end, _ps, _pe, _bucket = _resolve_profit_range(range_key, custom_start, custom_end, now)

    # One aggregated row per product from the sale items (not per transaction).
    sales_rows = (
        _sale_items(shop, start, end)
        .values("product_id", "product__name", "product__sku")
        .annotate(
            gross_revenue=Coalesce(Sum("subtotal", output_field=_DEC), ZERO, output_field=_DEC),
            gross_cost=Coalesce(Sum(ExpressionWrapper(F("quantity") * F("unit_cost"), output_field=_DEC), output_field=_DEC), ZERO, output_field=_DEC),
            gross_qty=Coalesce(Sum("quantity", output_field=_DEC), ZERO, output_field=_DEC),
        )
    )

    ret_base = SaleReturnItem.all_objects.filter(shop_id=shop.id)
    if start is not None:
        ret_base = ret_base.filter(sale_return__created_at__gte=start)
    if end is not None:
        ret_base = ret_base.filter(sale_return__created_at__lte=end)

    ret_rev = ret_base.values("sale_item__product_id").annotate(
        r_revenue=Coalesce(Sum("refund_amount", output_field=_DEC), ZERO, output_field=_DEC),
        r_qty=Coalesce(Sum("quantity", output_field=_DEC), ZERO, output_field=_DEC),
    )
    ret_cost = ret_base.filter(sale_return__restocked=True).values("sale_item__product_id").annotate(
        r_cost=Coalesce(Sum(ExpressionWrapper(F("quantity") * F("sale_item__unit_cost"), output_field=_DEC), output_field=_DEC), ZERO, output_field=_DEC),
    )
    ret_rev_map = {r["sale_item__product_id"]: r for r in ret_rev}
    ret_cost_map = {r["sale_item__product_id"]: float(r["r_cost"]) for r in ret_cost}

    products = []
    for s in sales_rows:
        pid = s["product_id"]
        rr = ret_rev_map.get(pid, {})
        revenue = float(s["gross_revenue"]) - float(rr.get("r_revenue", 0) or 0)
        cost = float(s["gross_cost"]) - ret_cost_map.get(pid, 0.0)
        qty = float(s["gross_qty"]) - float(rr.get("r_qty", 0) or 0)
        profit = revenue - cost
        products.append({
            "product_id": pid,
            "product_name": s["product__name"],
            "sku": s["product__sku"] or "",
            "revenue": round(revenue, 2),
            "cost": round(cost, 2),
            "profit": round(profit, 2),
            "units_sold": round(qty, 2),
            "margin": round((profit / revenue * 100) if revenue else 0.0, 2),
        })

    top_profitable = sorted((p for p in products if p["profit"] > 0), key=lambda p: p["profit"], reverse=True)[:5]
    losses = sorted((p for p in products if p["profit"] < 0), key=lambda p: p["profit"])[:5]
    top_loss = [{**p, "loss": round(-p["profit"], 2)} for p in losses]
    lowest_margin = sorted((p for p in products if p["revenue"] > 0), key=lambda p: p["margin"])[:5]

    return {
        "range": {"key": range_key, "start": start.isoformat(), "end": end.isoformat()},
        "top_profitable_products": top_profitable,
        "top_loss_products": top_loss,
        "lowest_margin_products": lowest_margin,
    }


def product_performance_overview(shop, range_key="30d", custom_start=None, custom_end=None):
    """Product Performance for the report page: most-sold (date-sensitive,
    returns-adjusted), low-stock and out-of-stock (current inventory state).

    Most-sold units net out returned quantity. Low/out-of-stock reuse the
    project's existing thresholds (Product.reorder_level, the same condition as
    low_stock_list/out_of_stock_list) and reflect *current* stock — never
    reconstructed from the date range. Out-of-stock is ordered by the highest
    recent (in-range) sales so a hot seller that's empty surfaces first.
    """
    from django.db.models import Q
    from sales.models import SaleReturnItem

    now = timezone.now()
    start, end, _ps, _pe, _bucket = _resolve_profit_range(range_key, custom_start, custom_end, now)

    # --- Most sold (date range, minus returned quantity) ---
    sales_rows = (
        _sale_items(shop, start, end)
        .values("product_id", "product__name", "product__sku", "product__current_stock")
        .annotate(
            gross_qty=Coalesce(Sum("quantity", output_field=_DEC), ZERO, output_field=_DEC),
            revenue=Coalesce(Sum("subtotal", output_field=_DEC), ZERO, output_field=_DEC),
            orders=Count("sale_id", distinct=True),
        )
    )
    ret_base = SaleReturnItem.all_objects.filter(shop_id=shop.id)
    if start is not None:
        ret_base = ret_base.filter(sale_return__created_at__gte=start)
    if end is not None:
        ret_base = ret_base.filter(sale_return__created_at__lte=end)
    ret_qty = {
        r["sale_item__product_id"]: float(r["q"])
        for r in ret_base.values("sale_item__product_id").annotate(q=Coalesce(Sum("quantity", output_field=_DEC), ZERO, output_field=_DEC))
    }

    most_sold_all = []
    for s in sales_rows:
        units = float(s["gross_qty"]) - ret_qty.get(s["product_id"], 0.0)
        if units <= 0:
            continue
        most_sold_all.append({
            "product_id": s["product_id"], "product_name": s["product__name"], "sku": s["product__sku"] or "",
            "units_sold": round(units, 2), "revenue": round(float(s["revenue"]), 2),
            "orders": s["orders"], "current_stock": float(s["product__current_stock"] or 0),
        })
    most_sold = sorted(most_sold_all, key=lambda p: p["units_sold"], reverse=True)[:5]

    # --- Low stock (CURRENT state; same threshold as low_stock_list) ---
    low_rows = (
        Product.all_objects.filter(
            Q(current_stock__lte=F("reorder_level")) | Q(current_stock__lte=5),
            shop_id=shop.id, track_inventory=True, is_active=True, current_stock__gt=0,
        ).values("id", "name", "sku", "current_stock", "reorder_level", "category__name")
        .order_by("current_stock")[:5]
    )
    low_stock = [{
        "product_id": p["id"], "product_name": p["name"], "sku": p["sku"] or "",
        "current_stock": float(p["current_stock"] or 0), "minimum_stock": float(p["reorder_level"] or 0),
        "deficit": round(max(0.0, float(p["reorder_level"] or 0) - float(p["current_stock"] or 0)), 2),
        "category": p["category__name"] or "",
    } for p in low_rows]

    # --- Out of stock (CURRENT state; ranked by recent in-range sales) ---
    oos_rows = list(Product.all_objects.filter(
        shop_id=shop.id, track_inventory=True, is_active=True, current_stock__lte=0,
    ).values("id", "name", "sku", "current_stock"))
    oos_ids = [p["id"] for p in oos_rows]
    recent = {}
    if oos_ids:
        for r in (_sale_items(shop, start, end).filter(product_id__in=oos_ids)
                  .values("product_id")
                  .annotate(q=Coalesce(Sum("quantity", output_field=_DEC), ZERO, output_field=_DEC),
                            rev=Coalesce(Sum("subtotal", output_field=_DEC), ZERO, output_field=_DEC))):
            recent[r["product_id"]] = (float(r["q"]), float(r["rev"]))
    out_of_stock_all = [{
        "product_id": p["id"], "product_name": p["name"], "sku": p["sku"] or "",
        "current_stock": float(p["current_stock"] or 0),
        "recent_units_sold": round(recent.get(p["id"], (0.0, 0.0))[0], 2),
        "recent_revenue": round(recent.get(p["id"], (0.0, 0.0))[1], 2),
    } for p in oos_rows]
    out_of_stock = sorted(out_of_stock_all, key=lambda p: (p["recent_units_sold"], p["recent_revenue"]), reverse=True)[:5]

    return {
        "range": {"key": range_key, "start": start.isoformat(), "end": end.isoformat()},
        "most_sold_products": most_sold,
        "low_stock_products": low_stock,
        "out_of_stock_products": out_of_stock,
    }


def _trend_key(b, bucket):
    if bucket == "hour":
        return timezone.localtime(b).strftime("%Y-%m-%dT%H:00")
    if bucket == "month":
        return b.strftime("%Y-%m-01")
    return b.strftime("%Y-%m-%d")


def _bucket_sequence(start, end, bucket):
    """Continuous list of bucket keys from start..end (local time) so the trend
    chart has no gaps — quiet periods show as zero, not missing points."""
    keys = []
    if bucket == "hour":
        cur = timezone.localtime(start).replace(minute=0, second=0, microsecond=0)
        endl = timezone.localtime(end)
        while cur <= endl:
            keys.append(cur.strftime("%Y-%m-%dT%H:00"))
            cur += timedelta(hours=1)
    elif bucket == "month":
        cur = timezone.localtime(start).date().replace(day=1)
        endd = timezone.localtime(end).date()
        while cur <= endd:
            keys.append(cur.strftime("%Y-%m-01"))
            cur = cur + relativedelta(months=1)
    else:  # day
        cur = timezone.localtime(start).date()
        endd = timezone.localtime(end).date()
        while cur <= endd:
            keys.append(cur.strftime("%Y-%m-%d"))
            cur += timedelta(days=1)
    return keys


def _sales_trend_buckets(shop, start, end, bucket):
    """Per-bucket sales (revenue = Σ item subtotals − invoice discounts, the same
    definition as the dashboard) + order count, gap-filled to a continuous line."""
    trunc = {"hour": TruncHour, "day": TruncDate, "month": TruncMonth}[bucket]
    items = (
        _sale_items(shop, start, end).annotate(b=trunc("sale__sale_date")).values("b")
        .annotate(subtotal=Coalesce(Sum("subtotal", output_field=_DEC), ZERO, output_field=_DEC))
    )
    sales = (
        Sale.all_objects.filter(shop_id=shop.id).exclude(status=Sale.Status.CANCELLED)
        .filter(sale_date__gte=start, sale_date__lte=end)
        .annotate(b=trunc("sale_date")).values("b")
        .annotate(discount=Coalesce(Sum("discount", output_field=_DEC), ZERO, output_field=_DEC), orders=Count("id"))
    )
    data = {}
    for r in items:
        if r["b"] is None:
            continue
        data.setdefault(_trend_key(r["b"], bucket), {})["subtotal"] = r["subtotal"]
    for r in sales:
        if r["b"] is None:
            continue
        d = data.setdefault(_trend_key(r["b"], bucket), {})
        d["discount"] = r["discount"]; d["orders"] = r["orders"]

    out = []
    for k in _bucket_sequence(start, end, bucket):
        v = data.get(k, {})
        revenue = float(v.get("subtotal", ZERO) - v.get("discount", ZERO))
        out.append({"date": k, "sales": round(revenue, 2), "orders": int(v.get("orders", 0))})
    return out


def profitability_analytics(shop, range_key="30d", custom_start=None, custom_end=None):
    """Payment-completion / cancellation ratios + sales trend for a date range.

    Denominators (documented):
      * Fulfill & Pending ratios → NON-CANCELLED sales in the period. A sale is
        "fulfilled" when paid >= total (amount-based, so partial payments count
        as pending); the two sum to 100% of non-cancelled sales.
      * Cancellation ratio → ALL sales in the period (cancelled / total).
    Sales trend reuses the dashboard revenue definition and is gap-filled.
    Shop-scoped throughout.
    """
    now = timezone.now()
    start, end, _ps, _pe, bucket = _resolve_profit_range(range_key, custom_start, custom_end, now)
    if range_key in ("today", "yesterday"):
        bucket = "hour"

    base = Sale.all_objects.filter(shop_id=shop.id)
    if start is not None:
        base = base.filter(sale_date__gte=start)
    if end is not None:
        base = base.filter(sale_date__lte=end)

    total_all = base.count()
    cancelled = base.filter(status=Sale.Status.CANCELLED).count()
    non_cancelled = base.exclude(status=Sale.Status.CANCELLED)
    eligible = non_cancelled.count()
    fulfilled = non_cancelled.filter(paid__gte=F("total")).count()
    pending = eligible - fulfilled

    def ratio(n, d):
        return round(n / d * 100, 1) if d else 0.0

    return {
        "range": {"key": range_key, "start": start.isoformat(), "end": end.isoformat(), "bucket": bucket},
        "payment_metrics": {
            "fulfill_payment_ratio": {"percentage": ratio(fulfilled, eligible), "fulfilled_count": fulfilled, "total_count": eligible},
            "pending_payment_ratio": {"percentage": ratio(pending, eligible), "pending_count": pending, "total_count": eligible},
            "cancellation_ratio": {"percentage": ratio(cancelled, total_all), "cancelled_count": cancelled, "total_count": total_all},
        },
        "sales_trend": _sales_trend_buckets(shop, start, end, bucket),
    }


def weekly_sales_trend(shop, weeks=12):
    start = timezone.now() - timedelta(weeks=weeks)
    return list(
        Sale.all_objects.filter(shop_id=shop.id, sale_date__gte=start)
        .exclude(status=Sale.Status.CANCELLED)
        .annotate(week=TruncWeek("sale_date"))
        .values("week")
        .annotate(revenue=Coalesce(Sum("total", output_field=_DEC), ZERO, output_field=_DEC))
        .order_by("week")
    )


def _growth(current, previous):
    if previous and previous != 0:
        return round(float((current - previous) / previous * 100), 2)
    return None if not current else 100.0


def mom_growth(shop):
    """Month-over-month revenue growth %."""
    m_start, now = period_bounds("month")
    prev_end = m_start - timedelta(seconds=1)
    prev_start = prev_end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    this_rev = _sum(_sale_items(shop, m_start, now), "subtotal") - _sale_discount_total(shop, m_start, now)
    prev_rev = _sum(_sale_items(shop, prev_start, prev_end), "subtotal") - _sale_discount_total(shop, prev_start, prev_end)
    return {"current": this_rev, "previous": prev_rev, "growth_pct": _growth(this_rev, prev_rev)}


def _grouped_sales(shop, field, start, end):
    return {
        row[field]: row
        for row in _sale_items(shop, start, end)
        .values(field)
        .annotate(
            revenue=Coalesce(Sum("subtotal", output_field=_DEC), ZERO, output_field=_DEC),
            profit=Coalesce(
                Sum(ExpressionWrapper(F("subtotal") - F("quantity") * F("unit_cost"), output_field=_DEC)),
                ZERO, output_field=_DEC,
            ),
        )
    }


def category_sales(shop, period="month"):
    return _sales_by_dimension(shop, "product__category__name", period)


def brand_sales(shop, period="month"):
    return _sales_by_dimension(shop, "product__brand__name", period)


def _sales_by_dimension(shop, field, period):
    start, now = period_bounds(period)
    prev_end = start - timedelta(seconds=1)
    span = now - start
    prev_start = prev_end - span
    current = _grouped_sales(shop, field, start, now)
    previous = _grouped_sales(shop, field, prev_start, prev_end)
    rows = []
    for key, cur in current.items():
        prev_rev = previous.get(key, {}).get("revenue", ZERO)
        rows.append({
            "name": key or "Uncategorized",
            "revenue": cur["revenue"], "profit": cur["profit"],
            "growth_pct": _growth(cur["revenue"], prev_rev),
        })
    rows.sort(key=lambda r: r["revenue"], reverse=True)
    return rows


def top_products(shop, start=None, end=None, limit=10):
    return list(
        _sale_items(shop, start, end)
        .values("product_id", "product__name", "product__current_stock")
        .annotate(
            qty=Coalesce(Sum("quantity", output_field=_DEC), ZERO, output_field=_DEC),
            revenue=Coalesce(Sum("subtotal", output_field=_DEC), ZERO, output_field=_DEC),
            profit=Coalesce(
                Sum(ExpressionWrapper(F("subtotal") - F("quantity") * F("unit_cost"), output_field=_DEC)),
                ZERO, output_field=_DEC,
            ),
        )
        .order_by("-revenue")[:limit]
    )


def sales_by_category(shop, start=None, end=None):
    return list(
        _sale_items(shop, start, end)
        .values("product__category__name")
        .annotate(revenue=Coalesce(Sum("subtotal", output_field=_DEC), ZERO, output_field=_DEC))
        .order_by("-revenue")
    )


def product_performance(shop, product_id, period="month"):
    """Per-product units/revenue/profit + growth vs previous equal period."""
    start, now = period_bounds(period)
    span = now - start
    prev_end = start - timedelta(seconds=1)
    prev_start = prev_end - span

    def agg(s, e):
        items = _sale_items(shop, s, e).filter(product_id=product_id)
        rev = _sum(items, "subtotal")
        cogs = _sum(items, ExpressionWrapper(F("quantity") * F("unit_cost"), output_field=_DEC))
        return {
            "units": _sum(items, "quantity"),
            "revenue": rev, "profit": rev - cogs,
        }

    cur = agg(start, now)
    prev = agg(prev_start, prev_end)
    cur["revenue_growth_pct"] = _growth(cur["revenue"], prev["revenue"])
    cur["previous"] = prev
    return cur


def sales_trend(shop, days=30):
    from service.models import ServiceTicket, ServiceTicketPart

    start = timezone.now() - timedelta(days=days)
    sale_days = (
        Sale.all_objects.filter(shop_id=shop.id, sale_date__gte=start)
        .exclude(status=Sale.Status.CANCELLED)
        .annotate(day=TruncDate("sale_date"))
        .values("day")
        .annotate(revenue=Coalesce(Sum("total", output_field=_DEC), ZERO, output_field=_DEC))
    )
    ticket_base = (
        ServiceTicket.all_objects.filter(shop_id=shop.id, received_at__gte=start)
        .exclude(status=ServiceTicket.Status.CANCELLED)
    )
    ticket_days = (
        ticket_base
        .annotate(day=TruncDate("received_at"))
        .values("day")
        .annotate(
            charge=Coalesce(Sum("service_charge", output_field=_DEC), ZERO, output_field=_DEC),
            discount=Coalesce(Sum("discount", output_field=_DEC), ZERO, output_field=_DEC),
        )
    )
    ticket_part_days = (
        ServiceTicketPart.all_objects.filter(ticket__in=ticket_base)
        .annotate(day=TruncDate("ticket__received_at"))
        .values("day")
        .annotate(
            parts_total=Coalesce(Sum(ExpressionWrapper(F("quantity") * F("unit_price"), output_field=_DEC), output_field=_DEC), ZERO, output_field=_DEC)
        )
    )

    day_rev = {}
    for r in sale_days:
        day_rev[r["day"]] = day_rev.get(r["day"], ZERO) + r["revenue"]
    for r in ticket_days:
        day_rev[r["day"]] = day_rev.get(r["day"], ZERO) + max(ZERO, r["charge"] - r["discount"])
    for r in ticket_part_days:
        day_rev[r["day"]] = day_rev.get(r["day"], ZERO) + r["parts_total"]

    return [
        {"day": k, "revenue": day_rev[k]}
        for k in sorted(day_rev.keys())
    ]


# ---------------------------------------------------------------------------
# Dashboard (cached)
# ---------------------------------------------------------------------------

def dashboard_summary(shop, days=30, use_cache=True):
    from django.conf import settings

    key = f"dashboard:{shop.id}:{days}"
    if use_cache:
        cached = cache.get(key)
        if cached is not None:
            return cached

    from datetime import datetime, time
    from accounting.services import financial_position, profit_summary

    now = timezone.now()
    start = now - timedelta(days=days)
    today = timezone.localdate()
    today_start = timezone.make_aware(datetime.combine(today, time.min))

    data = {
        "period_days": days,
        "today": profit_summary(shop, start=today_start, end=now),
        "period": profit_summary(shop, start=start, end=now),
        "position": financial_position(shop),
        "stock_value": stock_value(shop),
        "low_stock_count": len(low_stock_list(shop)),
        "out_of_stock_count": len(out_of_stock_list(shop)),
        "top_products": top_products(shop, start=start, end=now, limit=5),
        "sales_trend": sales_trend(shop, days=min(days, 30)),
        "mom_growth": mom_growth(shop),
    }
    if use_cache:
        cache.set(key, data, getattr(settings, "ANALYTICS_CACHE_TTL", 60))
    return data


def invalidate_dashboard_cache(shop_id):
    """Call after sales/stock changes to keep dashboards fresh."""
    for days in (7, 30, 90, 365):
        cache.delete(f"dashboard:{shop_id}:{days}")
    cache.delete(f"reports_charts:{shop_id}")


# ---------------------------------------------------------------------------
# Reports charts (repair-shop analytics)
#
# All functions return plain JSON-serializable primitives (str/int/float/list)
# so the reports view can hand them straight to Chart.js via json_script.
# ---------------------------------------------------------------------------

def _months_back(months):
    """First-of-month datetime for the window start, N months back inclusive."""
    from datetime import datetime, time
    today = timezone.localdate()
    first = timezone.make_aware(datetime.combine(today.replace(day=1), time.min))
    return first - relativedelta(months=months - 1)


def _open_tickets(shop):
    """All non-cancelled tickets for the shop (unscoped manager, tenant-filtered)."""
    return ServiceTicket.all_objects.filter(shop_id=shop.id).exclude(
        status=ServiceTicket.Status.CANCELLED
    )


def revenue_parts_vs_labor(shop, months=6):
    """Monthly revenue split: parts (sale items) vs labor (service charges).

    Feeds the stacked area/line 'Revenue Trends Over Time' chart.
    """
    start = _months_back(months)
    parts_rows = (
        _sale_items(shop, start, timezone.now())
        .annotate(mo=TruncMonth("sale__sale_date"))
        .values("mo")
        .annotate(v=Coalesce(Sum("subtotal", output_field=_DEC), ZERO, output_field=_DEC))
    )
    parts = {(r["mo"].year, r["mo"].month): r["v"] for r in parts_rows}
    labor_rows = (
        _open_tickets(shop)
        .filter(received_at__gte=start)
        .annotate(mo=TruncMonth("received_at"))
        .values("mo")
        .annotate(v=Coalesce(Sum("service_charge", output_field=_DEC), ZERO, output_field=_DEC))
    )
    labor = {(r["mo"].year, r["mo"].month): r["v"] for r in labor_rows}

    labels, parts_series, labor_series = [], [], []
    for i in range(months):
        mo = start + relativedelta(months=i)
        key = (mo.year, mo.month)
        labels.append(mo.strftime("%b %Y"))
        parts_series.append(float(parts.get(key, ZERO)))
        labor_series.append(float(labor.get(key, ZERO)))
    return {"labels": labels, "parts": parts_series, "labor": labor_series}


def sales_mix(shop, period="month"):
    """Revenue proportion: hardware parts vs software/services vs repairs.

    Software/services are sale items whose category name mentions
    'software' or 'service'; everything else sold is treated as parts.
    Repairs are the period's service charges. Feeds the donut chart.
    """
    start, now = period_bounds(period)
    items = _sale_items(shop, start, now)
    soft_rev = _sum(
        items.filter(
            Q(product__category__name__icontains="software")
            | Q(product__category__name__icontains="service")
        ),
        "subtotal",
    )
    parts_rev = _sum(items, "subtotal") - soft_rev
    repairs = _sum(_open_tickets(shop).filter(received_at__gte=start, received_at__lte=now), "service_charge")
    return {
        "labels": ["Hardware parts", "Software/Services", "Repairs/Labor"],
        "values": [float(parts_rev), float(soft_rev), float(repairs)],
    }


# Bucket edges (upper bound inclusive) for turnaround-time histogram.
_TAT_BUCKETS = [(1, "0–1d"), (3, "2–3d"), (7, "4–7d"), (14, "8–14d"), (10**9, "15d+")]


def _percentile(sorted_vals, q):
    if not sorted_vals:
        return 0
    idx = min(int(round((len(sorted_vals) - 1) * q)), len(sorted_vals) - 1)
    return sorted_vals[idx]


def turnaround_time(shop):
    """Distribution of repair turnaround (received -> delivered) in days.

    Returns histogram buckets plus box-plot stats (min/q1/median/q3/max/avg).
    """
    rows = (
        ServiceTicket.all_objects.filter(shop_id=shop.id, actual_delivery__isnull=False)
        .values_list("received_at", "actual_delivery")
    )
    days = sorted(max((a - r).days, 0) for r, a in rows)
    counts = [0] * len(_TAT_BUCKETS)
    for d in days:
        for i, (upper, _label) in enumerate(_TAT_BUCKETS):
            if d <= upper:
                counts[i] += 1
                break
    stats = {
        "count": len(days),
        "min": days[0] if days else 0,
        "q1": _percentile(days, 0.25),
        "median": _percentile(days, 0.5),
        "q3": _percentile(days, 0.75),
        "max": days[-1] if days else 0,
        "avg": round(sum(days) / len(days), 1) if days else 0,
    }
    return {"labels": [label for _u, label in _TAT_BUCKETS], "values": counts, "stats": stats}


def repair_volume_by_device(shop, weeks=8):
    """Tickets received per week, stacked by device type. Feeds stacked bar."""
    start = timezone.now() - timedelta(weeks=weeks)
    rows = (
        _open_tickets(shop)
        .filter(received_at__gte=start)
        .annotate(wk=TruncWeek("received_at"))
        .values("wk", "device_type")
        .annotate(n=Count("id"))
        .order_by("wk")
    )
    weeks_seen = sorted({r["wk"].date() for r in rows})
    labels = [w.strftime("%b %d") for w in weeks_seen]
    week_index = {w: i for i, w in enumerate(weeks_seen)}
    device_labels = dict(ServiceTicket.DeviceType.choices)
    datasets = {code: [0] * len(weeks_seen) for code in device_labels}
    for r in rows:
        # Ignore any legacy/unknown device_type not in the current choices,
        # otherwise a stray value KeyErrors the whole dashboard.
        if r["device_type"] in datasets:
            datasets[r["device_type"]][week_index[r["wk"].date()]] = r["n"]
    # Drop device types with no tickets in the window to keep the legend clean.
    series = [
        {"label": device_labels[code], "data": data}
        for code, data in datasets.items()
        if any(data)
    ]
    return {"labels": labels, "datasets": series}


def issue_pareto(shop):
    """Issue-type frequency, descending, with cumulative %. Feeds Pareto chart."""
    rows = (
        _open_tickets(shop)
        .values("issue_type")
        .annotate(n=Count("id"))
        .order_by("-n")
    )
    issue_labels = dict(ServiceTicket.IssueType.choices)
    labels = [issue_labels.get(r["issue_type"], r["issue_type"]) for r in rows]
    counts = [r["n"] for r in rows]
    total = sum(counts) or 1
    cumulative, running = [], 0
    for n in counts:
        running += n
        cumulative.append(round(running / total * 100, 1))
    return {"labels": labels, "counts": counts, "cumulative": cumulative}


def stock_turnover(shop):
    """Scatter points: x=days in inventory, y=profit margin %, per product.

    Highlights dead stock (old + low margin) vs winners (fresh + high margin).
    Days in inventory = age of the earliest purchase-in movement.
    """
    now = timezone.now()
    first_in = dict(
        StockMovement.all_objects.filter(
            shop_id=shop.id,
            movement_type__in=[MovementType.PURCHASE_IN, MovementType.OPENING],
        )
        .values("product_id")
        .annotate(first=Min("created_at"))
        .values_list("product_id", "first")
    )
    points = []
    for p in Product.all_objects.filter(shop_id=shop.id, is_active=True, current_stock__gt=0):
        first = first_in.get(p.id)
        if first is None:
            continue
        selling = Decimal(p.selling_price or 0)
        if selling <= 0:
            continue
        margin = float((selling - Decimal(p.cost_price or 0)) / selling * 100)
        points.append({
            "x": (now - first).days,
            "y": round(margin, 1),
            "label": p.name,
        })
    return {"points": points}


def reorder_status(shop, limit=12):
    """Current stock vs reorder threshold for the most-at-risk tracked items.

    Feeds the bullet/gauge chart. Ordered by how far below threshold (most
    urgent first).
    """
    rows = [
        {
            "name": p.name,
            "current": float(p.current_stock or 0),
            "threshold": float(p.reorder_level or 0),
        }
        for p in Product.all_objects.filter(
            shop_id=shop.id, track_inventory=True, is_active=True, reorder_level__gt=0
        )
    ]
    rows.sort(key=lambda r: r["current"] - r["threshold"])
    return rows[:limit]


def customer_acquisition(shop, months=6):
    """Monthly first-time vs returning customers. Feeds stacked column chart."""
    start = _months_back(months)
    base = Sale.all_objects.filter(shop_id=shop.id, customer__isnull=False).exclude(
        status=Sale.Status.CANCELLED
    )
    first_purchase = {
        r["customer_id"]: r["f"]
        for r in base.values("customer_id").annotate(f=Min("sale_date"))
    }
    # Distinct (customer, month) pairs active within the window.
    active = (
        base.filter(sale_date__gte=start)
        .annotate(mo=TruncMonth("sale_date"))
        .values("customer_id", "mo")
        .distinct()
    )
    labels, new_series, ret_series = [], [], []
    buckets = {}
    for i in range(months):
        mo = start + relativedelta(months=i)
        buckets[(mo.year, mo.month)] = [0, 0]  # [new, returning]
        labels.append(mo.strftime("%b %Y"))
    for row in active:
        key = (row["mo"].year, row["mo"].month)
        if key not in buckets:
            continue
        first = first_purchase.get(row["customer_id"])
        is_new = first and (first.year, first.month) == key
        buckets[key][0 if is_new else 1] += 1
    for i in range(months):
        mo = start + relativedelta(months=i)
        n, r = buckets[(mo.year, mo.month)]
        new_series.append(n)
        ret_series.append(r)
    return {"labels": labels, "new": new_series, "returning": ret_series}


def reports_charts(shop, use_cache=True):
    """Bundle every reports-page chart dataset into one JSON-ready dict.

    ~10 independent aggregations (≈13-20 queries). Cached on the same short TTL
    as the dashboard summary — the reports page and every dashboard load hit
    this, so caching cuts their query count substantially on warm loads."""
    from django.conf import settings

    key = f"reports_charts:{shop.id}"
    if use_cache:
        cached = cache.get(key)
        if cached is not None:
            return cached

    now = timezone.now()
    start = now - timedelta(days=90)
    tops = top_products(shop, start=start, end=now, limit=10)
    data = {
        "revenue_trend": revenue_parts_vs_labor(shop, months=6),
        "sales_mix": sales_mix(shop, period="month"),
        "top_parts": {
            "labels": [r["product__name"] for r in tops],
            "values": [float(r["revenue"]) for r in tops],
        },
        "tat": turnaround_time(shop),
        "device_volume": repair_volume_by_device(shop, weeks=8),
        "issue_pareto": issue_pareto(shop),
        "stock_turnover": stock_turnover(shop),
        "reorder": reorder_status(shop),
        "acquisition": customer_acquisition(shop, months=6),
    }
    if use_cache:
        cache.set(key, data, getattr(settings, "ANALYTICS_CACHE_TTL", 60))
    return data


def dashboard_comprehensive(shop, days=30):
    """
    Comprehensive analytics covering Revenue Trends, Payment Methods, CLV, and Returns.
    """
    import traceback
    try:
        now = timezone.now()
        start = now - timedelta(days=days)
        
        # 1. Revenue trend
        trend = list(
            Sale.all_objects.filter(shop_id=shop.id, sale_date__gte=start)
            .exclude(status=Sale.Status.CANCELLED)
            .annotate(day=TruncDate("sale_date"))
            .values("day")
            .annotate(
                revenue=Coalesce(Sum("total", output_field=_DEC), ZERO, output_field=_DEC),
                discount=Coalesce(Sum("discount", output_field=_DEC), ZERO, output_field=_DEC),
                tax=Coalesce(Sum("tax", output_field=_DEC), ZERO, output_field=_DEC)
            )
            .order_by("day")
        )
        
        # 2. Payment methods chart
        from sales.models import Payment, SaleReturnItem
        payments = Payment.all_objects.filter(shop_id=shop.id, paid_at__gte=start)
        payment_methods = list(
            payments.values("method").annotate(total=Coalesce(Sum("amount", output_field=_DEC), ZERO, output_field=_DEC))
        )
        
        # 3. Top customers CLV
        top_customers = list(
            Sale.all_objects.filter(shop_id=shop.id, customer__isnull=False)
            .exclude(status=Sale.Status.CANCELLED)
            .values("customer__id", "customer__name")
            .annotate(
                total_spent=Coalesce(Sum("total", output_field=_DEC), ZERO, output_field=_DEC),
                order_count=Count("id")
            )
            .order_by("-total_spent")[:10]
        )
        
        # 4. High return rate products
        returns = list(
            SaleReturnItem.all_objects.filter(sale_return__shop_id=shop.id, sale_return__created_at__gte=start)
            .values("sale_item__product__name")
            .annotate(
                qty=Coalesce(Sum("quantity", output_field=_DEC), ZERO, output_field=_DEC),
                refund_amount=Coalesce(Sum(ExpressionWrapper(F("quantity") * F("sale_item__unit_price"), output_field=_DEC)), ZERO, output_field=_DEC)
            )
            .order_by("-qty")[:10]
        )
        
        # 5. Financial metrics over period
        from accounting.services import profit_summary
        metrics = profit_summary(shop, start=start, end=now)
        
        # 6. Customer Acquisition (New vs Returning)
        acquisition = customer_acquisition(shop, months=6)
        
        # 7. Top Selling Products
        top_prods = top_products(shop, start=start, end=now, limit=10)
        
        # 8. Sales by Category
        category_sales_data = sales_by_category(shop, start=start, end=now)
        
        # 9. Recent Transactions
        from django.db.models import Prefetch
        recent_sales = list(
            Sale.all_objects.filter(shop_id=shop.id)
            .exclude(status=Sale.Status.CANCELLED)
            .prefetch_related(Prefetch('payments', queryset=Payment.all_objects.all(), to_attr='cached_payments'))
            .order_by("-created_at")[:10]
        )
        
        recent_transactions = []
        for sale in recent_sales:
            method = "Mixed"
            if sale.cached_payments:
                if len(sale.cached_payments) == 1:
                    method = sale.cached_payments[0].method
            else:
                method = "Unpaid"
                
            recent_transactions.append({
                "id": sale.id,
                "invoice_number": sale.invoice_no,
                "created_at": sale.sale_date.isoformat() if getattr(sale, 'sale_date', None) else None,
                "total": float(sale.total or 0),
                "payment_method": method,
                "customer_name": sale.bill_name
            })
            
        # 10. Low Stock Alerts
        low_stock = low_stock_list(shop)
        out_of_stock = out_of_stock_list(shop)
        
        return {
            "trend": trend,
            "payment_methods": payment_methods,
            "top_customers": top_customers,
            "top_returns": returns,
            "metrics": metrics,
            "customer_acquisition": acquisition,
            "top_products": top_prods,
            "sales_by_category": category_sales_data,
            "recent_transactions": recent_transactions,
            "low_stock": low_stock,
            "out_of_stock": out_of_stock,
        }
    except Exception as e:
        # In case of any error, return it so the frontend will throw a descriptive error instead of 500 HTML
        return {"error": f"Backend Crash: {str(e)}\n{traceback.format_exc()}"}

