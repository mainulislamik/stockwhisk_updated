"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, fetchAll } from "@/lib/api";
import { ErrorState, Pagination, Spinner, money, fmtDate, usePagination } from "@/components/ui";
import { useLanguage } from "@/contexts/LanguageContext";
import ConvertQuotationModal from "@/components/ConvertQuotationModal";

type InvoiceRow = {
  id: number;
  type: "sale" | "service" | "quotation";
  invoice_no: string;
  customer_id?: number | null;
  customer_name: string | null;
  date: string;
  total: string;
  paid: string;
  due: string;
  due_date?: string;
  status: string;
  href: string;
};

const statusBadge: Record<string, string> = {
  PAID: "text-bg-success",
  PARTIAL: "text-bg-warning",
  DUE: "text-bg-danger",
  CANCELLED: "text-bg-secondary",
  QUOTATION: "text-bg-info text-white",
  paid: "text-bg-success",
  partial: "text-bg-warning",
  due: "text-bg-danger",
  cancelled: "text-bg-secondary",
  quotation: "text-bg-info text-white",
  received: "text-bg-primary",
  diagnosing: "text-bg-info",
  awaiting_parts: "text-bg-warning",
  in_repair: "text-bg-warning",
  ready_for_pickup: "text-bg-info",
  delivered: "text-bg-success",
};

export default function SalesPage() {
  const { t, lang } = useLanguage();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "sale" | "service" | "quotation">("all");
  const [busyAction, setBusyAction] = useState(false);
  const [convertModalSale, setConvertModalSale] = useState<any | null>(null);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [salesData, serviceData] = await Promise.all([
        fetchAll<any>("/sales/sales/").catch(() => []),
        fetchAll<any>("/service/tickets/").catch(() => []),
      ]);

      const salesList = (salesData || []).map((s: any) => {
        const isQ = s.status === "quotation" || s.status === "QUOTATION" || (s.note && String(s.note).toLowerCase().includes("quotation"));
        return {
          id: s.id,
          type: isQ ? "quotation" : "sale",
          invoice_no: s.invoice_no,
          customer_id: s.customer,
          customer_name: s.customer_name || s.bill_name || (lang === "bn" ? "খুচরা ক্রেতা" : "Walk-in"),
          date: s.sale_date,
          total: s.total,
          paid: s.paid,
          due: s.due,
          due_date: s.due_date,
          status: s.status,
          href: `/app/sales/${s.id}`,
        } as InvoiceRow;
      });

      const ticketsList = (serviceData || []).map((tk: any) => ({
        id: tk.id,
        type: "service" as const,
        invoice_no: tk.ticket_number || tk.ticket_no || `#SVC-${tk.id}`,
        customer_id: tk.customer,
        customer_name: tk.customer_name,
        date: tk.received_at,
        total: tk.total_charge || tk.bill_total || "0",
        paid: tk.paid_amount || tk.paid || "0",
        due: tk.due_amount || tk.due || "0",
        status: tk.status,
        href: `/app/service/tickets/${tk.id}`,
      }));

      const combined = [...salesList, ...ticketsList].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setRows(combined);
    } catch (e: any) {
      setError(e?.message || t("sales_err_load"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleConvertToSale(id: number) {
    setBusyAction(true);
    try {
      const saleData = await api<any>(`/sales/sales/${id}/`);
      setConvertModalSale(saleData);
    } catch (e: any) {
      alert(e?.message || "Failed to load quotation details");
    } finally {
      setBusyAction(false);
    }
  }

  async function handleDeleteQuotation(id: number) {
    if (!confirm(lang === "bn" ? "আপনি কি নিশ্চিত যে এই কোটেশনটি মুছে ফেলবেন?" : "Delete this quotation?")) return;
    setBusyAction(true);
    try {
      const { api } = await import("@/lib/api");
      await api(`/sales/sales/${id}/`, { method: "DELETE" });
      await loadData();
    } catch (e: any) {
      alert(e?.message || "Failed to delete quotation");
    } finally {
      setBusyAction(false);
    }
  }

  const countSales = rows.filter((r) => r.type === "sale").length;
  const countServices = rows.filter((r) => r.type === "service").length;
  const countQuotations = rows.filter((r) => r.type === "quotation").length;

  const shown = rows.filter((s) => {
    if (activeTab !== "all" && s.type !== activeTab) return false;
    const q = filter.trim().toLowerCase();
    return !q || `${s.invoice_no} ${s.customer_name || ""}`.toLowerCase().includes(q);
  });

  const { paged, page, setPage, totalPages, total } = usePagination(shown, [filter, activeTab]);

  function getStatusLabel(status: string) {
    const key = status.toLowerCase();
    if (key === "quotation") return lang === "bn" ? "কোটেশন" : "Quotation";
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
        <button
          className={`btn btn-sm ${activeTab === "quotation" ? "btn-brand fw-semibold" : "btn-light border"}`}
          onClick={() => setActiveTab("quotation")}
        >
          📑 {lang === "bn" ? "কোটেশন" : "Quotations"} ({countQuotations})
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
                <th className="text-end pe-3">Actions</th>
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
                      ) : s.type === "quotation" ? (
                        <span className="badge text-white" style={{ background: "#0ea5e9" }}>
                          📑 {lang === "bn" ? "কোটেশন" : "Quotation"}
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
                      <div>{money(s.due)}</div>
                      {Number(s.due) > 0 && s.due_date && (
                        <div style={{ fontSize: "0.7rem" }} className="text-danger opacity-75 fw-normal">
                          📅 {fmtDate(s.due_date)}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${statusBadge[s.status] || "text-bg-light"}`}>
                        {getStatusLabel(s.status)}
                      </span>
                    </td>
                    <td className="text-end pe-3">
                      <div className="d-inline-flex gap-1">
                        {s.type === "quotation" ? (
                          <>
                            <button
                              className="btn btn-sm btn-success py-0 px-2 fw-semibold"
                              style={{ fontSize: "0.78rem" }}
                              disabled={busyAction}
                              onClick={() => handleConvertToSale(s.id)}
                            >
                              ✓ {lang === "bn" ? "বিক্রয় করুন" : "Convert to Sale"}
                            </button>
                            <Link href={s.href} className="btn btn-outline-secondary btn-sm py-0 px-2" style={{ fontSize: "0.78rem" }}>
                              {t("sales_list_view")}
                            </Link>
                            <button
                              className="btn btn-sm btn-outline-danger py-0 px-2"
                              style={{ fontSize: "0.78rem" }}
                              disabled={busyAction}
                              onClick={() => handleDeleteQuotation(s.id)}
                              title={lang === "bn" ? "কোটেশন মুছুন" : "Delete Quotation"}
                            >
                              🗑️
                            </button>
                          </>
                        ) : (
                          <Link href={s.href} className="btn btn-outline-secondary btn-sm py-0 px-2" style={{ fontSize: "0.8rem" }}>
                            {t("sales_list_view")}
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} setPage={setPage} total={total} />
      </div>

      <ConvertQuotationModal
        isOpen={!!convertModalSale}
        onClose={() => setConvertModalSale(null)}
        sale={convertModalSale}
        onSuccess={() => {
          setConvertModalSale(null);
          loadData();
        }}
      />
    </div>
  );
}
