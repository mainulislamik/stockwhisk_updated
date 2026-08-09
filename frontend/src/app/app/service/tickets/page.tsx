"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, fetchAll } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { ErrorState, Pagination, Spinner, money, fmtDate, usePagination } from "@/components/ui";
import toast from "react-hot-toast";

type Ticket = {
  id: number;
  ticket_no: string;
  customer: number | null;
  device_description: string;
  complaint: string;
  status: string;
  service_charge: string;
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
  const [rows, setRows] = useState<Ticket[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ customer: "", device_description: "", complaint: "", service_charge: "", estimated_delivery: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [t, c] = await Promise.all([fetchAll<Ticket>("/service/tickets/"), fetchAll<Customer>("/crm/customers/").catch(() => [])]);
      setRows(t);
      setCustomers(c);
    } catch (e: any) {
      setError(e?.message || "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/service/tickets/", {
        method: "POST",
        body: {
          customer: form.customer ? Number(form.customer) : null,
          device_description: form.device_description,
          complaint: form.complaint,
          service_charge: form.service_charge || 0,
          estimated_delivery: form.estimated_delivery || null,
        },
      });
      setForm({ customer: "", device_description: "", complaint: "", service_charge: "", estimated_delivery: "" });
      setShowAdd(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Could not create ticket");
    } finally {
      setSaving(false);
    }
  }

  const { paged, page, setPage, totalPages, total } = usePagination(rows);

  if (loading) return <Spinner label="Loading tickets…" />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="vstack gap-3">
      <div className="d-flex justify-content-end">
        {canManage && (
          <button className="btn btn-outline-brand btn-sm" onClick={() => setShowAdd((s) => !s)}>
            + New ticket
          </button>
        )}
      </div>

      {showAdd && (
        <div className="card shadow-sm">
          <div className="card-body">
            <form onSubmit={save} className="row g-3">
              <div className="col-md-4">
                <label className="small">Customer</label>
                <select className="form-select form-select-sm" value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })}>
                  <option value="">Walk-in</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="small">Device</label>
                <input required className="form-control form-control-sm" value={form.device_description} onChange={(e) => setForm({ ...form, device_description: e.target.value })} />
              </div>
              <div className="col-md-2">
                <label className="small">Service charge</label>
                <input type="number" step="0.01" className="form-control form-control-sm" value={form.service_charge} onChange={(e) => setForm({ ...form, service_charge: e.target.value })} />
              </div>
              <div className="col-md-2">
                <label className="small">Est. delivery</label>
                <input type="date" className="form-control form-control-sm" value={form.estimated_delivery} onChange={(e) => setForm({ ...form, estimated_delivery: e.target.value })} />
              </div>
              <div className="col-12">
                <label className="small">Complaint</label>
                <textarea required className="form-control form-control-sm" rows={2} value={form.complaint} onChange={(e) => setForm({ ...form, complaint: e.target.value })} />
              </div>
              <div className="col-12">
                <button className="btn btn-brand btn-sm" disabled={saving}>
                  {saving ? "Saving…" : "Create ticket"}
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
                <th>Ticket #</th>
                <th>Device</th>
                <th>Received</th>
                <th className="text-end">Charge</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr data-empty="">
                  <td colSpan={6} className="text-center text-secondary py-5">
                    <div style={{ fontSize: "2.5rem" }}>🔧</div>
                    No repair tickets yet.
                  </td>
                </tr>
              ) : (
                paged.map((t) => (
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
