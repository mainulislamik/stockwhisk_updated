"use client";

import Link from "next/link";
import { useState } from "react";
import { api, useApi, useApiAll, Paginated } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { ErrorState, Pagination, Spinner, money, fmtDate } from "@/components/ui";
import toast from "react-hot-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { ModuleRouteGuard } from "@/components/ModuleRouteGuard";

type Ticket = {
  id: number;
  ticket_no: string;
  customer: number | null;
  customer_name?: string;
  customer_phone?: string;
  device_description: string;
  imei_serial?: string;
  complaint: string;
  status: string;
  service_charge: string;
  bill_total?: string;
  paid?: string;
  due?: string;
  discount?: string;
  is_overdue: boolean;
  received_at: string;
};
type Customer = { id: number; name: string };

const statusLabels: Record<string, { label: string; badge: string; icon: string }> = {
  received: { label: "গৃহীত (Received)", badge: "bg-secondary text-white", icon: "📥" },
  diagnosing: { label: "ডায়াগনসিস চলছে", badge: "bg-info text-dark", icon: "🔍" },
  awaiting_parts: { label: "পার্টসের অপেক্ষায়", badge: "bg-warning text-dark", icon: "⏳" },
  in_repair: { label: "মেরামতের কাজ চলছে", badge: "bg-warning text-dark border border-dark-subtle", icon: "🛠️" },
  ready_for_pickup: { label: "ডেলিভারির জন্য প্রস্তুত", badge: "bg-primary text-white", icon: "✅" },
  delivered: { label: "ডেলিভার্ড", badge: "bg-success text-white", icon: "🎉" },
  cancelled: { label: "বাতিল", badge: "bg-dark text-white", icon: "❌" },
};

export default function TicketsPage() {
  const { t } = useLanguage();
  const { can, isOwner } = useAuth();
  const canManage = isOwner || can("manage_service");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ 
    customer: "", 
    customer_name: "", 
    customer_phone: "", 
    device_description: "", 
    device_imei: "",
    repair_warranty_days: "30",
    complaint: "", 
    service_charge: "", 
    advance_paid: "",
    estimated_delivery: "" 
  });
  const [saving, setSaving] = useState(false);

  const PAGE_SIZE = 20;
  // Only the current page of tickets is fetched (constant-size request).
  const { data, loading, error, mutate } = useApi<Paginated<Ticket>>("/service/tickets/", { page, page_size: PAGE_SIZE });
  const rawRows = data?.results || [];
  const rows = rawRows.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNo = t.ticket_no?.toLowerCase().includes(q) || String(t.id).includes(q);
      const matchCust = t.customer_name?.toLowerCase().includes(q) || t.customer_phone?.includes(q);
      const matchDevice = t.device_description?.toLowerCase().includes(q) || t.imei_serial?.toLowerCase().includes(q);
      if (!matchNo && !matchCust && !matchDevice) return false;
    }
    return true;
  });
  const total = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Customer dropdown only loads when the add form is opened.
  const { data: customers } = useApiAll<Customer>(showAdd ? "/crm/customers/" : null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/service/tickets/", {
        method: "POST",
        body: {
          customer: form.customer ? Number(form.customer) : null,
          // Walk-in identity is only sent when no existing customer is chosen.
          customer_name: form.customer ? "" : form.customer_name.trim(),
          customer_phone: form.customer ? "" : form.customer_phone.trim(),
          device_description: form.device_imei ? (form.device_description.trim() + " (IMEI: " + form.device_imei.trim() + ")") : form.device_description.trim(),
          complaint: (form.repair_warranty_days && form.repair_warranty_days !== "0") ? (form.complaint.trim() + "\n[Warranty: " + form.repair_warranty_days + " Days]") : form.complaint.trim(),
          service_charge: form.service_charge || 0,
          advance_paid: form.advance_paid || 0,
          estimated_delivery: form.estimated_delivery || null,
        },
      });
      setForm({ customer: "", customer_name: "", customer_phone: "", device_description: "", device_imei: "", repair_warranty_days: "30", complaint: "", service_charge: "", advance_paid: "", estimated_delivery: "" });
      setShowAdd(false);
      setPage(1);
      mutate();
    } catch (e: any) {
      toast.error(e?.message || t("tkt_err_create"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner label={t("tkt_loading")} />;
  if (error) return <ErrorState error={error} />;

  return (
    <ModuleRouteGuard module="service_repair" name={t("nav_service")}>
      <div className="vstack gap-3">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          {/* Quick Search & Status Filter */}
          <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1" style={{ maxWidth: 640 }}>
            <div className="input-group input-group-sm shadow-sm" style={{ maxWidth: 360 }}>
              <span className="input-group-text bg-white text-secondary border-end-0">🔍</span>
              <input
                type="text"
                className="form-control border-start-0"
                placeholder="টিকেট নং, কাস্টমার, ফোন, ডিভাইস বা IMEI..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="btn btn-outline-secondary" type="button" onClick={() => setSearch("")}>
                  ✕
                </button>
              )}
            </div>

            <select
              className="form-select form-select-sm shadow-sm w-auto"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">সব স্ট্যাটাস (All)</option>
              <option value="received">📥 গৃহীত (Received)</option>
              <option value="diagnosing">🔍 ডায়াগনসিস চলছে</option>
              <option value="awaiting_parts">⏳ পার্টসের অপেক্ষায়</option>
              <option value="in_repair">🛠️ মেরামতের কাজ চলছে</option>
              <option value="ready_for_pickup">✅ পিকআপের জন্য প্রস্তুত</option>
              <option value="delivered">🎉 ডেলিভার্ড</option>
              <option value="cancelled">❌ বাতিল</option>
            </select>
          </div>

          {canManage && (
            <button className="btn btn-brand btn-sm shadow-sm px-3" onClick={() => setShowAdd((s) => !s)}>
              {showAdd ? "✕ ফর্ম বন্ধ করুন" : `+ ${t("tkt_btn_new")}`}
            </button>
          )}
        </div>

      {showAdd && (
        <div className="card shadow-sm">
          <div className="card-body">
            <form onSubmit={save} className="row g-3">
              {/* Row 1: Customer Contact */}
              <div className="col-md-4">
                <label className="small fw-medium">{t("tkt_lbl_cust")}</label>
                <select className="form-select form-select-sm shadow-sm" value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })}>
                  <option value="">{t("tkt_walkin")}</option>
                  {(customers || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {!form.customer && (
                <>
                  <div className="col-md-4">
                    <label className="small fw-medium">{t("tkt_lbl_walkin_name")}</label>
                    <input className="form-control form-control-sm shadow-sm" placeholder={t("tkt_ph_cust_name")}
                      value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
                  </div>
                  <div className="col-md-4">
                    <label className="small fw-medium">{t("tkt_lbl_walkin_phone")}</label>
                    <input className="form-control form-control-sm shadow-sm" placeholder={t("tkt_ph_phone")}
                      value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
                  </div>
                </>
              )}

              {/* Row 2: Device, IMEI & Warranty (Identical to POS Repair Section) */}
              <div className="col-md-4">
                <label className="small fw-semibold text-dark">📱 {t("pos_checkout_device_model")}</label>
                <input required className="form-control form-control-sm shadow-sm" placeholder="যেমন: Samsung Galaxy A12" value={form.device_description} onChange={(e) => setForm({ ...form, device_description: e.target.value })} />
              </div>

              <div className="col-md-4">
                <label className="small fw-semibold text-dark">🔢 {t("pos_checkout_device_imei")}</label>
                <input className="form-control form-control-sm shadow-sm font-monospace" placeholder="35894109..." value={form.device_imei} onChange={(e) => setForm({ ...form, device_imei: e.target.value })} />
              </div>

              <div className="col-md-4">
                <label className="small fw-semibold text-dark">🛡️ {t("pos_checkout_warranty_period")}</label>
                <select className="form-select form-select-sm shadow-sm" value={form.repair_warranty_days} onChange={(e) => setForm({ ...form, repair_warranty_days: e.target.value })}>
                  <option value="0">ওয়ারেন্টি ছাড়া (No Warranty)</option>
                  <option value="7">৭ দিন টেস্টিং ওয়ারেন্টি (7 Days)</option>
                  <option value="15">১৫ দিন ওয়ারেন্টি (15 Days)</option>
                  <option value="30">৩০ দিন / ১ মাস ওয়ারেন্টি (30 Days)</option>
                  <option value="90">৩ মাস ওয়ারেন্টি (90 Days)</option>
                  <option value="180">৬ মাস ওয়ারেন্টি (6 Months)</option>
                </select>
              </div>

              {/* Row 3: Financials & Delivery Date */}
              <div className="col-md-4">
                <label className="small fw-semibold text-warning-emphasis">🛠️ {t("pos_checkout_service_fee")}</label>
                <input type="number" step="0.01" min="0" className="form-control form-control-sm shadow-sm border-warning fw-bold text-warning-emphasis" placeholder="0" value={form.service_charge} onChange={(e) => setForm({ ...form, service_charge: e.target.value })} />
              </div>
              <div className="col-md-4">
                <label className="small fw-medium">💵 {t("tkt_lbl_advance")} (৳)</label>
                <input type="number" step="0.01" min="0" className="form-control form-control-sm shadow-sm" placeholder="0" value={form.advance_paid} onChange={(e) => setForm({ ...form, advance_paid: e.target.value })} />
              </div>
              <div className="col-md-4">
                <label className="small fw-medium">📅 {t("tkt_lbl_est_del")}</label>
                <input type="date" className="form-control form-control-sm shadow-sm" value={form.estimated_delivery} onChange={(e) => setForm({ ...form, estimated_delivery: e.target.value })} />
              </div>

              {/* Row 4: Problem & Fault Description */}
              <div className="col-12">
                <label className="small fw-semibold text-dark">📝 {t("pos_checkout_problem_desc")}</label>
                <textarea required className="form-control form-control-sm shadow-sm" placeholder="যেমন: ডিসপ্লে ভাঙা, চার্জিং পোর্ট সমস্যা, টাচ কাজ করে না..." rows={2} value={form.complaint} onChange={(e) => setForm({ ...form, complaint: e.target.value })} />
              </div>

              <div className="col-12 d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowAdd(false)}>
                  বাতিল (Cancel)
                </button>
                <button type="submit" className="btn btn-brand btn-sm px-4 fw-semibold" disabled={saving}>
                  {saving ? t("tkt_btn_saving") : t("tkt_btn_create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-striped table-sm align-middle mb-0">
            <thead className="thead-6">
              <tr>
                <th>{t("tkt_col_ticket")}</th>
                <th>👤 কাস্টমার</th>
                <th>📱 {t("tkt_col_device")}</th>
                <th>📅 {t("tkt_col_received")}</th>
                <th className="text-end">💵 বিল ও পেমেন্ট</th>
                <th>🏷️ {t("tkt_col_status")}</th>
                <th className="text-end">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr data-empty="">
                  <td colSpan={7} className="text-center text-secondary py-5">
                    <div style={{ fontSize: "2.5rem" }}>🔧</div>
                    {t("tkt_no_tickets")}
                  </td>
                </tr>
              ) : (
                rows.map((t) => (
                  <tr key={t.id} className={t.is_overdue ? "table-danger" : ""}>
                    <td className="fw-semibold">
                      <Link href={`/app/service/tickets/${t.id}`} className="text-decoration-none">
                        {t.ticket_no || `#${t.id}`}
                      </Link>
                    </td>
                    <td>
                      <div className="fw-medium text-dark">{t.customer_name || "—"}</div>
                      {t.customer_phone && (
                        <a href={`tel:${t.customer_phone}`} className="small text-secondary text-decoration-none d-flex align-items-center gap-1">
                          📞 {t.customer_phone}
                        </a>
                      )}
                    </td>
                    <td>
                      <div className="fw-medium text-dark">{t.device_description}</div>
                      {t.imei_serial && (
                        <div className="font-monospace text-secondary" style={{ fontSize: "0.75rem" }}>
                          IMEI: {t.imei_serial}
                        </div>
                      )}
                    </td>
                    <td className="text-secondary small">{fmtDate(t.received_at)}</td>
                    <td className="text-end">
                      <div className="fw-semibold text-dark">{money(t.bill_total || t.service_charge)}</div>
                      {t.due && Number(t.due) > 0 ? (
                        <span className="badge bg-danger-subtle text-danger border border-danger-subtle" style={{ fontSize: "0.7rem" }}>
                          বকেয়া: {money(t.due)}
                        </span>
                      ) : (
                        <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: "0.7rem" }}>
                          পরিশোধিত
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${statusLabels[t.status]?.badge || "bg-light text-dark"} px-2 py-1`}>
                        {statusLabels[t.status]?.icon} {statusLabels[t.status]?.label || t.status}
                      </span>
                    </td>
                    <td className="text-end">
                      <Link href={`/app/service/tickets/${t.id}`} className="btn btn-outline-brand btn-xs">
                        বিস্তারিত
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
    </ModuleRouteGuard>
  );
}
