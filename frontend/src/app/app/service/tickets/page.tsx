"use client";

import Link from "next/link";
import { useState } from "react";
import { api, useApi, useApiAll, Paginated } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { ErrorState, Pagination, Spinner, money, fmtDate } from "@/components/ui";
import toast from "react-hot-toast";

type Ticket = {
  id: number;
  ticket_no: string;
  customer: number | null;
  device_description: string;
  complaint: string;
  status: string;
  service_charge: string;
  discount?: string;
  is_overdue: boolean;
  received_at: string;
};
type Customer = { id: number; name: string };

const statusBadge: Record<string, string> = {
  received: "text-bg-secondary",
  diagnosing: "text-bg-info",
  awaiting_parts: "text-bg-warning",
  in_repair: "text-bg-warning",
  ready_for_pickup: "text-bg-primary",
  delivered: "text-bg-success",
  cancelled: "text-bg-dark",
};

export default function TicketsPage() {
  const { can, isOwner } = useAuth();
  const canManage = isOwner || can("manage_service");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ 
    customer: "", 
    customer_name: "", 
    customer_phone: "", 
    device_description: "", 
    complaint: "", 
    service_charge: "", 
    advance_paid: "",
    estimated_delivery: "" 
  });
  const [saving, setSaving] = useState(false);

  const PAGE_SIZE = 20;
  // Only the current page of tickets is fetched (constant-size request).
  const { data, loading, error, mutate } = useApi<Paginated<Ticket>>("/service/tickets/", { page, page_size: PAGE_SIZE });
  const rows = data?.results || [];
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
          device_description: form.device_description,
          complaint: form.complaint,
          service_charge: form.service_charge || 0,
          advance_paid: form.advance_paid || 0,
          estimated_delivery: form.estimated_delivery || null,
        },
      });
      setForm({ customer: "", customer_name: "", customer_phone: "", device_description: "", complaint: "", service_charge: "", advance_paid: "", estimated_delivery: "" });
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
    <div className="vstack gap-3">
      <div className="d-flex justify-content-end">
        {canManage && (
          <button className="btn btn-outline-brand btn-sm" onClick={() => setShowAdd((s) => !s)}>
            {t("tkt_btn_new")}
          </button>
        )}
      </div>

      {showAdd && (
        <div className="card shadow-sm">
          <div className="card-body">
            <form onSubmit={save} className="row g-3">
              <div className="col-md-4">
                <label className="small">{t("tkt_lbl_cust")}</label>
                <select className="form-select form-select-sm" value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })}>
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
                    <label className="small">{t("tkt_lbl_walkin_name")}</label>
                    <input className="form-control form-control-sm" placeholder={t("tkt_ph_cust_name")}
                      value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
                  </div>
                  <div className="col-md-4">
                    <label className="small">{t("tkt_lbl_walkin_phone")}</label>
                    <input className="form-control form-control-sm" placeholder={t("tkt_ph_phone")}
                      value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
                  </div>
                </>
              )}
              <div className="col-md-4">
                <label className="small">{t("tkt_lbl_device")}</label>
                <input required className="form-control form-control-sm" value={form.device_description} onChange={(e) => setForm({ ...form, device_description: e.target.value })} />
              </div>
              <div className="col-md-2">
                <label className="small">{t("tkt_lbl_charge")}</label>
                <input type="number" step="0.01" className="form-control form-control-sm" value={form.service_charge} onChange={(e) => setForm({ ...form, service_charge: e.target.value })} />
              </div>
              <div className="col-md-2">
                <label className="small">{t("tkt_lbl_advance")}</label>
                <input type="number" step="0.01" className="form-control form-control-sm" value={form.advance_paid} onChange={(e) => setForm({ ...form, advance_paid: e.target.value })} />
              </div>
              <div className="col-md-2">
                <label className="small">{t("tkt_lbl_est_del")}</label>
                <input type="date" className="form-control form-control-sm" value={form.estimated_delivery} onChange={(e) => setForm({ ...form, estimated_delivery: e.target.value })} />
              </div>
              <div className="col-12">
                <label className="small">{t("tkt_lbl_complaint")}</label>
                <textarea required className="form-control form-control-sm" rows={2} value={form.complaint} onChange={(e) => setForm({ ...form, complaint: e.target.value })} />
              </div>
              <div className="col-12">
                <button className="btn btn-brand btn-sm" disabled={saving}>
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
                <th>{t("tkt_col_device")}</th>
                <th>{t("tkt_col_received")}</th>
                <th className="text-end">{t("tkt_col_charge")}</th>
                <th>{t("tkt_col_status")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr data-empty="">
                  <td colSpan={6} className="text-center text-secondary py-5">
                    <div style={{ fontSize: "2.5rem" }}>🔧</div>
                    {t("tkt_no_tickets")}
                  </td>
                </tr>
              ) : (
                rows.map((t) => (
                  <tr key={t.id} className={t.is_overdue ? "table-danger" : ""}>
                    <td className="fw-medium">{t.ticket_no || `#${t.id}`}</td>
                    <td>{t.device_description}</td>
                    <td className="text-secondary">{fmtDate(t.received_at)}</td>
                    <td className="text-end">{money(t.service_charge)}</td>
                    <td>
                      <span className={`badge ${statusBadge[t.status] || "text-bg-light"}`}>{t.status}</span>
                    </td>
                    <td className="text-end">
                      <Link href={`/app/service/tickets/${t.id}`} className="small text-decoration-none">
                        View
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
