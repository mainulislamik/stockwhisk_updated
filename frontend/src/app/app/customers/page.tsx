"use client";

import { useEffect, useState } from "react";
import { api, fetchAll } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { ErrorState, Pagination, Spinner, money, fmtDate, usePagination } from "@/components/ui";
import toast from "react-hot-toast";

type Customer = {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  segment: string;
  due_balance: string;
  total_purchased: string;
  last_purchase_at: string | null;
  is_active: boolean;
};

export default function CustomersPage() {
  const { can, isOwner } = useAuth();
  const canManage = isOwner || can("manage_customers");
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setRows(await fetchAll<Customer>("/crm/customers/"));
    } catch (e: any) {
      setError(e?.message || "Failed to load customers");
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
      await api("/crm/customers/", { method: "POST", body: form });
      setForm({ name: "", phone: "", email: "", address: "" });
      setShowAdd(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Could not save customer");
    } finally {
      setSaving(false);
    }
  }

  const shown = rows.filter((c) => {
    const q = filter.trim().toLowerCase();
    return !q || `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q);
  });
  const { paged, page, setPage, totalPages, total } = usePagination(shown, [filter]);

  if (loading) return <Spinner label="Loading customers…" />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="vstack gap-3">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <input placeholder="Filter name/phone…" className="form-control form-control-sm" style={{ maxWidth: "18rem" }} value={filter} onChange={(e) => setFilter(e.target.value)} />
        {canManage && (
          <button onClick={() => setShowAdd((s) => !s)} className="btn btn-brand btn-sm">
            + New customer
          </button>
        )}
      </div>

      {showAdd && (
        <div className="card shadow-sm">
          <div className="card-body">
            <form onSubmit={save} className="row g-3">
              <div className="col-md-3">
                <label className="small">Name</label>
                <input required className="form-control form-control-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label className="small">Phone</label>
                <input className="form-control form-control-sm" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label className="small">Email</label>
                <input type="email" className="form-control form-control-sm" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label className="small">Address</label>
                <input className="form-control form-control-sm" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="col-12">
                <button className="btn btn-brand btn-sm" disabled={saving}>
                  {saving ? "Saving…" : "Save customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-striped table-sm align-middle mb-0">
            <thead className="thead-2">
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th className="text-end">Total purchased</th>
                <th className="text-end">Due</th>
                <th>Last purchase</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr data-empty="">
                  <td colSpan={5} className="text-center text-secondary py-5">
                    <div style={{ fontSize: "2.5rem" }}>👥</div>
                    No customers yet.
                  </td>
                </tr>
              ) : (
                paged.map((c) => (
                  <tr key={c.id}>
                    <td className="fw-medium">{c.name}</td>
                    <td className="text-secondary">{c.phone || "—"}</td>
                    <td className="text-end">{money(c.total_purchased)}</td>
                    <td className={`text-end ${Number(c.due_balance) > 0 ? "text-danger fw-semibold" : ""}`}>{money(c.due_balance)}</td>
                    <td className="text-secondary">{fmtDate(c.last_purchase_at)}</td>
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
