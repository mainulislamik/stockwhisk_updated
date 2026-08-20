"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchAll } from "@/lib/api";
import { ErrorState, Pagination, Spinner, money, fmtDate, usePagination } from "@/components/ui";
import { useLanguage } from "@/contexts/LanguageContext";

type InvoiceRow = {
  id: number;
  type: "sale" | "service";
  invoice_no: string;
  customer_id?: number | null;
  customer_name: string | null;
  date: string;
  total: string;
  paid: string;
  due: string;
  status: string;
  href: string;
};

const statusBadge: Record<string, string> = {
  PAID: "text-bg-success",
  PARTIAL: "text-bg-warning",
  DUE: "text-bg-danger",
  CANCELLED: "text-bg-secondary",
  paid: "text-bg-success",
  partial: "text-bg-warning",
  due: "text-bg-danger",
  cancelled: "text-bg-secondary",
  received: "text-bg-primary",
  diagnosing: "text-bg-info",
  awaiting_parts: "text-bg-warning",
  in_repair: "text-bg-warning",
  ready_for_pickup: "text-bg-info",
  delivered: "text-bg-success",
};

export default function SalesPage() {
  const { t } = useLanguage();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "sale" | "service">("all");

  useEffect(() => {
    (async () => {
      try {
        const [salesData, serviceData] = await Promise.all([
          fetchAll<any>("/sales/sales/").catch(() => []),
          fetchAll<any>("/service/tickets/").catch(() => []),
        ]);

        const saleRows: InvoiceRow[] = (salesData || []).map((s: any) => ({
          id: s.id,
          type: "sale",
          invoice_no: s.invoice_no || `#INV-${s.id}`,
          customer_id: s.customer,
          customer_name: s.customer_name,
          date: s.sale_date || s.created_at,
          total: s.total || "0",
          paid: s.paid || "0",
          due: s.due || "0",
          status: s.status || "paid",
          href: `/app/sales/${s.id}`,
        }));

        const serviceRows: InvoiceRow[] = (serviceData || []).map((tk: any) => ({
          id: tk.id,
          type: "service",
          invoice_no: tk.ticket_no || `#SVC-${tk.id}`,
          customer_id: tk.customer,
          customer_name: tk.customer_name,
          date: tk.received_at || tk.created_at,
          total: tk.bill_total || "0",
          paid: tk.paid || "0",
          due: tk.due || "0",
          status: tk.status || "received",
          href: `/app/service/tickets/${tk.id}`,
        }));

        const combined = [...saleRows, ...serviceRows].sort((a, b) => {
          const da = new Date(a.date).getTime() || 0;
          const db = new Date(b.date).getTime() || 0;
          return db - da;
        });

        setRows(combined);
      } catch (e: any) {
        setError(e?.message || t("sales_err_load"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const countSales = rows.filter((r) => r.type === "sale").length;
  const countServices = rows.filter((r) => r.type === "service").length;

  const shown = rows.filter((s) => {
    if (activeTab !== "all" && s.type !== activeTab) return false;
    const q = filter.trim().toLowerCase();
    return !q || `${s.invoice_no} ${s.customer_name || ""}`.toLowerCase().includes(q);
  });

  const { paged, page, setPage, totalPages, total } = usePagination(shown, [filter, activeTab]);

  function getStatusLabel(status: string) {
    const key = status.toLowerCase();
    return (
      t(`sales_status_${key}`) ||
      t(`tktd_status_${key}`) ||
      status.replace(/_/g, " ").toUpperCase()
    );
  }

  if (loading) return <Spinner label={t("sales_list_loading")} />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="vstack gap-3">
      {/* Top Filter and Actions */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <input
            placeholder={t("sales_list_filter")}
            className="form-control form-control-sm"
            style={{ maxWidth: "18rem" }}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="d-flex gap-2">
          <Link href="/app/service/tickets" className="btn btn-outline-brand btn-sm">
            🔧 {t("nav_repair_tickets")}
          </Link>
          <Link href="/app/pos" className="btn btn-brand btn-sm">
            {t("sales_list_new")}
          </Link>
        </div>
      </div>

      {/* Type Filter Tabs */}
      <div className="d-flex gap-2 border-bottom pb-2">
        <button
          className={`btn btn-sm ${activeTab === "all" ? "btn-brand fw-semibold" : "btn-light border"}`}
          onClick={() => setActiveTab("all")}
        >
          {t("sales_tab_all")} ({rows.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === "sale" ? "btn-brand fw-semibold" : "btn-light border"}`}
          onClick={() => setActiveTab("sale")}
        >
          🛒 {t("sales_tab_sales")} ({countSales})
        </button>
        <button
          className={`btn btn-sm ${activeTab === "service" ? "btn-brand fw-semibold" : "btn-light border"}`}
          onClick={() => setActiveTab("service")}
        >
          🔧 {t("sales_tab_services")} ({countServices})
        </button>
      </div>

      {/* Invoices Table Card */}
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-striped table-sm align-middle mb-0">
            <thead className="thead-3">
              <tr>
                <th>{t("sales_list_col_invoice")}</th>
                <th>{t("sales_list_col_type")}</th>
                <th>{t("sales_list_col_customer")}</th>
                <th>{t("sales_list_col_date")}</th>
                <th className="text-end">{t("sales_list_col_total")}</th>
                <th className="text-end">{t("sales_list_col_paid")}</th>
                <th className="text-end">{t("sales_list_col_due")}</th>
                <th>{t("sales_list_col_status")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr data-empty="">
                  <td colSpan={9} className="text-center text-secondary py-5">
                    <div style={{ fontSize: "2.5rem" }}>🧾</div>
                    {t("sales_list_no_invoices")}
                  </td>
                </tr>
              ) : (
                paged.map((s) => (
                  <tr key={`${s.type}-${s.id}`}>
                    <td>
                      <Link href={s.href} className="text-decoration-none fw-medium text-brand">
                        {s.invoice_no}
                      </Link>
                    </td>
                    <td>
                      {s.type === "service" ? (
                        <span className="badge text-white" style={{ background: "#8b5cf6" }}>
                          🔧 {t("sales_badge_service")}
                        </span>
                      ) : (
                        <span className="badge" style={{ background: "#2563eb", color: "#fff" }}>
                          🛒 {t("sales_badge_sale")}
                        </span>
                      )}
                    </td>
                    <td>
                      {s.customer_id ? (
                        <Link href={`/app/customers/${s.customer_id}`} className="text-decoration-none text-brand fw-medium">
                          {s.customer_name || t("sales_list_walkin")}
                        </Link>
                      ) : (
                        <span className="text-secondary">{s.customer_name || t("sales_list_walkin")}</span>
                      )}
                    </td>
                    <td className="text-secondary">{fmtDate(s.date)}</td>
                    <td className="text-end fw-semibold">{money(s.total)}</td>
                    <td className="text-end text-success">{money(s.paid)}</td>
                    <td className={`text-end ${Number(s.due) > 0 ? "text-danger fw-bold" : "text-secondary"}`}>
                      {money(s.due)}
                    </td>
                    <td>
                      <span className={`badge ${statusBadge[s.status] || "text-bg-light"}`}>
                        {getStatusLabel(s.status)}
                      </span>
                    </td>
                    <td className="text-end">
                      <Link href={s.href} className="btn btn-outline-secondary btn-sm py-0 px-2" style={{ fontSize: "0.8rem" }}>
                        {t("sales_list_view")}
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} setPage={setPage} total={total} />
      </div>
    </div>
  );
}
