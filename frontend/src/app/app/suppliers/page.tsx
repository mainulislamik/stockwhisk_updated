"use client";

import { useEffect, useState } from "react";
import { api, fetchAll } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { ErrorState, Pagination, Spinner, money, usePagination } from "@/components/ui";
import toast from "react-hot-toast";

type Supplier = { id: number; name: string; phone: string; email: string; address: string; due_balance: string; is_active: boolean };
const BLANK = { name: "", phone: "", email: "", address: "" };

export default function SuppliersPage() {
  const { can, isOwner } = useAuth();
  const canManage = isOwner || can("manage_purchasing");
  const [rows, setRows] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ...BLANK });
  const [editing, setEditing] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try { setRows(await fetchAll<Supplier>("/purchasing/suppliers/")); }
    catch (e: any) { setError(e?.message || "Failed to load suppliers"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/purchasing/suppliers/", { method: "POST", body: form });
      setForm({ ...BLANK });
      setShowAdd(false);
      await load();
    } catch (e: any) { toast.error(e?.message || "Could not save supplier"); }
    finally { setSaving(false); }
  }

  async function saveEdit(e: React.FormEvent, id: number) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/purchasing/suppliers/${id}/`, { method: "PATCH", body: editForm });
      setEditing(null);
      await load();
    } catch (e: any) { toast.error(e?.message || "Could not update supplier"); }
    finally { setSaving(false); }
  }

  async function remove(s: Supplier) {
    if (!confirm(`Delete supplier "${s.name}"? This cannot be undone.`)) return;
    try {
      await api(`/purchasing/suppliers/${s.id}/`, { method: "DELETE" });
      setRows((r) => r.filter((x) => x.id !== s.id));
    } catch (e: any) { toast.error(e?.message || "Could not delete supplier"); }
  }

  function startEdit(s: Supplier) {
    setEditing(s.id);
    setEditForm({ name: s.name, phone: s.phone, email: s.email, address: s.address });
    setShowAdd(false);
  }

  const shown = rows.filter((s) => {
    const q = filter.trim().toLowerCase();
    return !q || `${s.name} ${s.phone} ${s.email}`.toLowerCase().includes(q);
  });
  const { paged, page, setPage, totalPages, total } = usePagination(shown, [filter]);

  if (loading) return <Spinner label="Loading suppliers…" />;
  if (error) return <ErrorState error={error} />;

  const SupplierForm = ({ values, onChange, onSubmit, label }: { values: typeof BLANK; onChange: (v: typeof BLANK) => void; onSubmit: (e: React.FormEvent) => void; label: string }) => (
    <form onSubmit={onSubmit} className="row g-3">
      <div className="col-md-3">
        <label className="small fw-medium">Name *</label>
        <input required className="form-control form-control-sm" value={values.name} onChange={(e) => onChange({ ...values, name: e.target.value })} />
      </div>
      <div className="col-md-2">
        <label className="small fw-medium">Phone</label>
        <input className="form-control form-control-sm" value={values.phone} onChange={(e) => onChange({ ...values, phone: e.target.value })} />
      </div>
      <div className="col-md-3">
        <label className="small fw-medium">Email</label>
        <input type="email" className="form-control form-control-sm" value={values.email} onChange={(e) => onChange({ ...values, email: e.target.value })} />
      </div>
      <div className="col-md-4">
        <label className="small fw-medium">Warehouse / Address</label>
        <input className="form-control form-control-sm" value={values.address} onChange={(e) => onChange({ ...values, address: e.target.value })} placeholder="Location or warehouse address…" />
      </div>
      <div className="col-12 d-flex gap-2">
        <button className="btn btn-brand btn-sm" disabled={saving}>{saving ? "Saving…" : label}</button>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => { setEditing(null); setShowAdd(false); }}>Cancel</button>
      </div>
    </form>
  );

  return (
    <div className="vstack gap-3">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <input placeholder="Filter name/phone/email…" className="form-control form-control-sm" style={{ maxWidth: "20rem" }} value={filter} onChange={(e) => setFilter(e.target.value)} />
        {canManage && (
          <button onClick={() => { setShowAdd((s) => !s); setEditing(null); }} className="btn btn-brand btn-sm">
            + New supplier
          </button>
        )}
      </div>

      {showAdd && canManage && (
        <div className="card shadow-sm">
          <div className="card-header fw-semibold small">Add new supplier</div>
          <div className="card-body">
            <SupplierForm values={form} onChange={setForm} onSubmit={save} label="Save supplier" />
          </div>
        </div>
      )}

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-striped table-sm align-middle mb-0">
            <thead className="thead-4">
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Warehouse / Address</th>
                <th className="text-end">Payable</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr data-empty="">
                  <td colSpan={canManage ? 6 : 5} className="text-center text-secondary py-5">
                    <div style={{ fontSize: "2.5rem" }}>🚚</div>
                    No suppliers yet.
                  </td>
                </tr>
              ) : paged.map((s) => (
                <>
                  <tr key={s.id}>
                    <td className="fw-medium">{s.name}</td>
                    <td className="text-secondary">{s.phone || "—"}</td>
                    <td className="text-secondary">{s.email || "—"}</td>
                    <td className="text-secondary">{s.address || "—"}</td>
                    <td className={`text-end ${Number(s.due_balance) > 0 ? "text-danger fw-semibold" : ""}`}>{money(s.due_balance)}</td>
                    {canManage && (
                      <td className="text-end text-nowrap">
                        <button className="btn btn-link btn-sm p-0 me-2" onClick={() => startEdit(s)}>Edit</button>
                        <button className="btn btn-link btn-sm text-danger p-0" onClick={() => remove(s)}>Delete</button>
                      </td>
                    )}
                  </tr>
                  {editing === s.id && (
                    <tr key={`edit-${s.id}`}>
                      <td colSpan={canManage ? 6 : 5} className="bg-light p-3">
                        <SupplierForm values={editForm} onChange={setEditForm} onSubmit={(e) => saveEdit(e, s.id)} label="Update supplier" />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} setPage={setPage} total={total} />
      </div>
    </div>
  );
}
