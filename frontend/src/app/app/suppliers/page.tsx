"use client";

import { confirmAction, showError, showSuccess, showInfo } from "@/lib/dialogs";
import { useLanguage } from "@/contexts/LanguageContext";

import React, { useEffect, useState } from "react";
import { api, fetchAll } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { ErrorState, Pagination, Spinner, money, usePagination } from "@/components/ui";
import toast from "react-hot-toast";

type Supplier = { id: number; name: string; phone: string; email: string; address: string; due_balance: string; is_active: boolean };
const BLANK = { name: "", phone: "", email: "", address: "" };

export default function SuppliersPage() {
  const { t } = useLanguage();
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
  
  // Payment State
  const [paying, setPaying] = useState<number | null>(null);
  const [payForm, setPayForm] = useState({ type: "payment", amount: "", method: "cash", note: "" });
  
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try { setRows(await fetchAll<Supplier>("/purchasing/suppliers/")); }
    catch (e: any) { setError(e?.message || t("sup_err_load")); }
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
    } catch (e: any) { toast.error(e?.message || t("sup_err_save")); }
    finally { setSaving(false); }
  }

  async function saveEdit(e: React.FormEvent, id: number) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/purchasing/suppliers/${id}/`, { method: "PATCH", body: editForm });
      setEditing(null);
      await load();
    } catch (e: any) { toast.error(e?.message || t("sup_err_update")); }
    finally { setSaving(false); }
  }

  async function processPayment(e: React.FormEvent, s: Supplier) {
    e.preventDefault();
    setSaving(true);
    try {
      // If type is settlement, we override the method to "settlement"
      const method = payForm.type === "settlement" ? "settlement" : payForm.method;
      
      const updatedSupplier = await api<Supplier>(`/purchasing/suppliers/${s.id}/pay-due/`, {
        method: "POST",
        body: {
          amount: payForm.amount,
          method: method,
          note: payForm.note
        }
      });
      
      toast.success(payForm.type === "settlement" ? t("sup_succ_settlement") : t("sup_succ_payment"));
      setPaying(null);
      
      // Update row in state
      setRows(r => r.map(x => x.id === s.id ? updatedSupplier : x));
    } catch (e: any) { 
      toast.error(e?.message || t("sup_err_pay")); 
    } finally { 
      setSaving(false); 
    }
  }

  async function remove(s: Supplier) {
    if (!(await confirmAction(t("sup_msg_delete", { name: s.name })))) return;
    try {
      await api(`/purchasing/suppliers/${s.id}/`, { method: "DELETE" });
      setRows((r) => r.filter((x) => x.id !== s.id));
    } catch (e: any) { toast.error(e?.message || t("sup_err_delete")); }
  }

  function startEdit(s: Supplier) {
    setEditing(s.id);
    setPaying(null);
    setEditForm({ name: s.name, phone: s.phone, email: s.email, address: s.address });
    setShowAdd(false);
  }

  function startPay(s: Supplier) {
    setPaying(s.id);
    setEditing(null);
    setPayForm({ type: "payment", amount: s.due_balance, method: "cash", note: "" });
    setShowAdd(false);
  }

  const shown = rows.filter((s) => {
    const q = filter.trim().toLowerCase();
    return !q || `${s.name} ${s.phone} ${s.email}`.toLowerCase().includes(q);
  });
  const { paged, page, setPage, totalPages, total } = usePagination(shown, [filter]);

  if (loading) return <Spinner label={t("sup_loading")} />;
  if (error) return <ErrorState error={error} />;

  const SupplierForm = ({ values, onChange, onSubmit, label }: { values: typeof BLANK; onChange: (v: typeof BLANK) => void; onSubmit: (e: React.FormEvent) => void; label: string }) => (
    <form onSubmit={onSubmit} className="row g-3">
      <div className="col-md-3">
        <label className="small fw-medium">{t("sup_lbl_name")}</label>
        <input required className="form-control form-control-sm" value={values.name} onChange={(e) => onChange({ ...values, name: e.target.value })} />
      </div>
      <div className="col-md-2">
        <label className="small fw-medium">{t("sup_lbl_phone")}</label>
        <input className="form-control form-control-sm" value={values.phone} onChange={(e) => onChange({ ...values, phone: e.target.value })} />
      </div>
      <div className="col-md-3">
        <label className="small fw-medium">{t("sup_lbl_email")}</label>
        <input type="email" className="form-control form-control-sm" value={values.email} onChange={(e) => onChange({ ...values, email: e.target.value })} />
      </div>
      <div className="col-md-4">
        <label className="small fw-medium">{t("sup_lbl_address")}</label>
        <input className="form-control form-control-sm" value={values.address} onChange={(e) => onChange({ ...values, address: e.target.value })} placeholder={t("sup_ph_address")} />
      </div>
      <div className="col-12 d-flex gap-2">
        <button className="btn btn-brand btn-sm" disabled={saving}>{saving ? t("sup_btn_saving") : label}</button>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => { setEditing(null); setShowAdd(false); }}>{t("sup_btn_cancel")}</button>
      </div>
    </form>
  );

  return (
    <div className="vstack gap-3">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <input placeholder={t("sup_ph_filter")} className="form-control form-control-sm" style={{ maxWidth: "20rem" }} value={filter} onChange={(e) => setFilter(e.target.value)} />
        {canManage && (
          <button onClick={() => { setShowAdd((s) => !s); setEditing(null); setPaying(null); }} className="btn btn-brand btn-sm">
            + New supplier
          </button>
        )}
      </div>

      {showAdd && canManage && (
        <div className="card shadow-sm">
          <div className="card-header fw-semibold small">{t("sup_title_add")}</div>
          <div className="card-body">
            <SupplierForm values={form} onChange={setForm} onSubmit={save} label={t("sup_btn_save")} />
          </div>
        </div>
      )}

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-striped table-sm align-middle mb-0">
            <thead className="thead-4">
              <tr>
                <th>{t("sup_col_name")}</th>
                <th>{t("sup_col_phone")}</th>
                <th>{t("sup_col_email")}</th>
                <th>{t("sup_col_address")}</th>
                <th className="text-end">{t("sup_col_payable")}</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr data-empty="">
                  <td colSpan={canManage ? 6 : 5} className="text-center text-secondary py-5">
                    <div style={{ fontSize: "2.5rem" }}>🚚</div>
                    {t("sup_no_sup")}
                  </td>
                </tr>
              ) : paged.map((s) => (
                <React.Fragment key={s.id}>
                  <tr>
                    <td className="fw-medium">{s.name}</td>
                    <td className="text-secondary">{s.phone || "—"}</td>
                    <td className="text-secondary">{s.email || "—"}</td>
                    <td className="text-secondary">{s.address || "—"}</td>
                    <td className={`text-end ${Number(s.due_balance) > 0 ? "text-danger fw-semibold" : ""}`}>{money(s.due_balance)}</td>
                    {canManage && (
                      <td className="text-end text-nowrap">
                        {Number(s.due_balance) > 0 && (
                          <button className="btn btn-brand btn-sm py-0 px-2 me-2" style={{ fontSize: "0.8rem" }} onClick={() => startPay(s)}>{t("sup_btn_pay")}</button>
                        )}
                        <button className="btn btn-link btn-sm p-0 me-2" onClick={() => startEdit(s)}>Edit</button>
                        <button className="btn btn-link btn-sm text-danger p-0" onClick={() => remove(s)}>Delete</button>
                      </td>
                    )}
                  </tr>
                  
                  {/* EDIT FORM */}
                  {editing === s.id && (
                    <tr className="border-bottom">
                      <td colSpan={canManage ? 6 : 5} className="bg-light p-3 border-start border-4 border-primary">
                        <SupplierForm values={editForm} onChange={setEditForm} onSubmit={(e) => saveEdit(e, s.id)} label="Update supplier" />
                      </td>
                    </tr>
                  )}
                  
                  {/* PAY FORM */}
                  {paying === s.id && (
                    <tr className="border-bottom">
                      <td colSpan={canManage ? 6 : 5} className="bg-light p-3 border-start border-4 border-success">
                        <form onSubmit={(e) => processPayment(e, s)} className="row g-3 align-items-end">
                          <div className="col-12 mb-1">
                            <span className="fw-bold text-success me-2">Clear Dues for {s.name}</span>
                            <span className="text-muted small">(Outstanding: {money(s.due_balance)})</span>
                          </div>
                          <div className="col-md-3">
                            <label className="small fw-medium">Action Type</label>
                            <select className="form-select form-select-sm" value={payForm.type} onChange={e => setPayForm({...payForm, type: e.target.value})}>
                              <option value="payment">Pay Dues (Cash Outflow)</option>
                              <option value="settlement">Settle / Adjust (No Cash Impact)</option>
                            </select>
                          </div>
                          <div className="col-md-2">
                            <label className="small fw-medium">Amount</label>
                            <input type="number" step="0.01" max={s.due_balance} required className="form-control form-control-sm" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
                          </div>
                          {payForm.type === "payment" && (
                            <div className="col-md-2">
                              <label className="small fw-medium">Payment Method</label>
                              <select className="form-select form-select-sm" value={payForm.method} onChange={e => setPayForm({...payForm, method: e.target.value})}>
                                <option value="cash">Cash</option>
                                <option value="bkash">bKash</option>
                                <option value="nagad">Nagad</option>
                                <option value="bank">Bank</option>
                              </select>
                            </div>
                          )}
                          <div className={payForm.type === "payment" ? "col-md-3" : "col-md-5"}>
                            <label className="small fw-medium">Note / Reference</label>
                            <input className="form-control form-control-sm" value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} placeholder="Optional reference..." />
                          </div>
                          <div className="col-md-2 d-flex gap-2">
                            <button type="submit" className="btn btn-success btn-sm w-100" disabled={saving}>
                              {saving ? "Processing…" : "Submit"}
                            </button>
                            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setPaying(null)}>{t("sup_btn_cancel")}</button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} setPage={setPage} total={total} />
      </div>
    </div>
  );
}
