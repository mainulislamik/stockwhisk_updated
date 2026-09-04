"use client";

import { confirmAction, showError, showSuccess, showInfo } from "@/lib/dialogs";
import { useLanguage } from "@/contexts/LanguageContext";
import React, { useEffect, useState } from "react";
import { api, fetchAll } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { ErrorState, Pagination, Spinner, money, fmtDate, usePagination } from "@/components/ui";
import toast from "react-hot-toast";

type Supplier = { 
  id: number; 
  name: string; 
  phone: string; 
  email: string; 
  address: string; 
  due_balance: string; 
  due_date?: string | null; 
  is_active: boolean 
};

const BLANK = { name: "", phone: "", email: "", address: "", due_date: "" };

export default function SuppliersPage() {
  const { t, lang } = useLanguage();
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
  const [payForm, setPayForm] = useState({ type: "payment", amount: "", method: "cash", note: "", due_date: "" });
  
  // Quick Promised Date Modal State
  const [dateModalSupplier, setDateModalSupplier] = useState<Supplier | null>(null);
  const [quickPromisedDate, setQuickPromisedDate] = useState("");
  const [savingDate, setSavingDate] = useState(false);

  const [saving, setSaving] = useState(false);

  // Helper date functions
  function addDays(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  }

  function getNextMonthFirstDay() {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 1);
    return d.toISOString().split("T")[0];
  }

  function isOverdue(dueDateStr?: string | null) {
    if (!dueDateStr) return false;
    const today = new Date().toISOString().split("T")[0];
    return dueDateStr < today;
  }

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
      await api("/purchasing/suppliers/" + id + "/", { method: "PATCH", body: editForm });
      setEditing(null);
      await load();
    } catch (e: any) { toast.error(e?.message || t("sup_err_update")); }
    finally { setSaving(false); }
  }

  async function processPayment(e: React.FormEvent, s: Supplier) {
    e.preventDefault();
    setSaving(true);
    try {
      const method = payForm.type === "settlement" ? "settlement" : payForm.method;
      
      const updatedSupplier = await api<Supplier>("/purchasing/suppliers/" + s.id + "/pay-due/", {
        method: "POST",
        body: {
          amount: payForm.amount,
          method: method,
          note: payForm.note,
          due_date: payForm.due_date || null
        }
      });
      
      toast.success(payForm.type === "settlement" ? t("sup_succ_settlement") : t("sup_succ_payment"));
      setPaying(null);
      setRows(r => r.map(x => x.id === s.id ? updatedSupplier : x));
    } catch (e: any) { 
      toast.error(e?.message || t("sup_err_pay")); 
    } finally { 
      setSaving(false); 
    }
  }

  async function handleSavePromisedDate(e: React.FormEvent) {
    e.preventDefault();
    if (!dateModalSupplier) return;
    setSavingDate(true);
    try {
      const updated = await api<Supplier>("/purchasing/suppliers/" + dateModalSupplier.id + "/set-due-date/", {
        method: "POST",
        body: { due_date: quickPromisedDate || null }
      });
      toast.success(t("sup_succ_date_updated") || "Promised date updated successfully!");
      setRows(r => r.map(x => x.id === dateModalSupplier.id ? updated : x));
      setDateModalSupplier(null);
    } catch (err: any) {
      toast.error(err?.data?.detail || err?.message || "Failed to update promised date.");
    } finally {
      setSavingDate(false);
    }
  }

  async function remove(s: Supplier) {
    if (!(await confirmAction(t("sup_msg_delete", { name: s.name })))) return;
    try {
      await api("/purchasing/suppliers/" + s.id + "/", { method: "DELETE" });
      setRows((r) => r.filter((x) => x.id !== s.id));
    } catch (e: any) { toast.error(e?.message || t("sup_err_delete")); }
  }

  function startEdit(s: Supplier) {
    setEditing(s.id);
    setPaying(null);
    setEditForm({ name: s.name, phone: s.phone, email: s.email, address: s.address, due_date: s.due_date || "" });
    setShowAdd(false);
  }

  function startPay(s: Supplier) {
    setPaying(s.id);
    setEditing(null);
    setPayForm({ type: "payment", amount: s.due_balance, method: "cash", note: "", due_date: s.due_date || "" });
    setShowAdd(false);
  }

  function openDateModal(s: Supplier) {
    setDateModalSupplier(s);
    setQuickPromisedDate(s.due_date || "");
  }

  const shown = rows.filter((s) => {
    const q = filter.trim().toLowerCase();
    return !q || (s.name + " " + s.phone + " " + s.email).toLowerCase().includes(q);
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
            {lang === "bn" ? "+ নতুন সাপ্লায়ার" : "+ New supplier"}
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
                <th>{t("sup_col_due_date")}</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr data-empty="">
                  <td colSpan={canManage ? 7 : 6} className="text-center text-secondary py-5">
                    <div style={{ fontSize: "2.5rem" }}>🚚</div>
                    {t("sup_no_sup")}
                  </td>
                </tr>
              ) : paged.map((s) => {
                const hasDue = Number(s.due_balance) > 0;
                const overdue = hasDue && isOverdue(s.due_date);
                return (
                  <React.Fragment key={s.id}>
                    <tr>
                      <td className="fw-medium">{s.name}</td>
                      <td className="text-secondary">{s.phone || "—"}</td>
                      <td className="text-secondary">{s.email || "—"}</td>
                      <td className="text-secondary">{s.address || "—"}</td>
                      <td className={"text-end " + (hasDue ? "text-danger fw-semibold" : "")}>
                        {money(s.due_balance)}
                      </td>
                      <td>
                        {hasDue ? (
                          s.due_date ? (
                            <div className="d-flex align-items-center gap-1">
                              <span className={"badge rounded-pill px-2 py-1 small " + (overdue ? "bg-danger text-white" : "bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25")}>
                                📅 {fmtDate(s.due_date)}
                                {overdue && <span className="ms-1 fw-bold">(! Overdue)</span>}
                              </span>
                              {canManage && (
                                <button 
                                  className="btn btn-link btn-sm p-0 text-muted ms-1" 
                                  title="Edit promised date"
                                  onClick={() => openDateModal(s)}
                                >
                                  ✏️
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="d-flex align-items-center gap-1">
                              <span className="text-muted small">{lang === "bn" ? "নির্ধারিত নয়" : "Not set"}</span>
                              {canManage && (
                                <button 
                                  className="btn btn-outline-secondary btn-sm py-0 px-1 ms-1 text-xs" 
                                  style={{ fontSize: "0.72rem" }}
                                  onClick={() => openDateModal(s)}
                                >
                                  + Set Date
                                </button>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="text-secondary small">—</span>
                        )}
                      </td>
                      {canManage && (
                        <td className="text-end text-nowrap">
                          {hasDue && (
                            <button className="btn btn-brand btn-sm py-0 px-2 me-2" style={{ fontSize: "0.8rem" }} onClick={() => startPay(s)}>
                              {t("sup_btn_pay")}
                            </button>
                          )}
                          <button className="btn btn-link btn-sm p-0 me-2" onClick={() => startEdit(s)}>Edit</button>
                          <button className="btn btn-link btn-sm text-danger p-0" onClick={() => remove(s)}>Delete</button>
                        </td>
                      )}
                    </tr>
                    
                    {/* EDIT FORM */}
                    {editing === s.id && (
                      <tr className="border-bottom">
                        <td colSpan={canManage ? 7 : 6} className="bg-light p-3 border-start border-4 border-primary">
                          <SupplierForm values={editForm} onChange={setEditForm} onSubmit={(e) => saveEdit(e, s.id)} label="Update supplier" />
                        </td>
                      </tr>
                    )}
                    
                    {/* PAY FORM */}
                    {paying === s.id && (
                      <tr className="border-bottom">
                        <td colSpan={canManage ? 7 : 6} className="bg-light p-3 border-start border-4 border-success">
                          <form onSubmit={(e) => processPayment(e, s)} className="row g-3 align-items-end">
                            <div className="col-12 mb-1">
                              <span className="fw-bold text-success me-2">Clear Dues for {s.name}</span>
                              <span className="text-muted small">(Outstanding: {money(s.due_balance)})</span>
                            </div>
                            <div className="col-md-2">
                              <label className="small fw-medium">{lang === "bn" ? "পদ্ধতি" : "Action Type"}</label>
                              <select className="form-select form-select-sm" value={payForm.type} onChange={e => setPayForm({...payForm, type: e.target.value})}>
                                <option value="payment">{lang === "bn" ? "বকেয়া প্রদান (নগদ খরচ)" : "Pay Dues (Cash Outflow)"}</option>
                                <option value="settlement">{lang === "bn" ? "সমন্বয় / অ্যাডজাস্ট (নগদ ছাড়া)" : "Settle / Adjust (No Cash)"}</option>
                              </select>
                            </div>
                            <div className="col-md-2">
                              <label className="small fw-medium">Amount</label>
                              <input type="number" step="0.01" max={s.due_balance} required className="form-control form-control-sm" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
                            </div>
                            {payForm.type === "payment" && (
                              <div className="col-md-2">
                                <label className="small fw-medium">{lang === "bn" ? "পেমেন্ট মাধ্যম" : "Payment Method"}</label>
                                <select className="form-select form-select-sm" value={payForm.method} onChange={e => setPayForm({...payForm, method: e.target.value})}>
                                  <option value="cash">Cash</option>
                                  <option value="bkash">bKash</option>
                                  <option value="nagad">Nagad</option>
                                  <option value="bank">Bank</option>
                                </select>
                              </div>
                            )}
                            
                            {/* Promised Due Date on Pay Form */}
                            <div className="col-md-3">
                              <label className="small fw-medium">{t("sup_lbl_due_date")} (Next Due)</label>
                              <input 
                                type="date" 
                                className="form-control form-control-sm font-monospace" 
                                value={payForm.due_date} 
                                onChange={e => setPayForm({ ...payForm, due_date: e.target.value })} 
                              />
                              <div className="d-flex flex-wrap gap-1 mt-1">
                                <button type="button" className="btn btn-outline-secondary btn-xs py-0 px-1" style={{ fontSize: "0.68rem" }} onClick={() => setPayForm({ ...payForm, due_date: addDays(7) })}>+7d</button>
                                <button type="button" className="btn btn-outline-secondary btn-xs py-0 px-1" style={{ fontSize: "0.68rem" }} onClick={() => setPayForm({ ...payForm, due_date: addDays(15) })}>+15d</button>
                                <button type="button" className="btn btn-outline-secondary btn-xs py-0 px-1" style={{ fontSize: "0.68rem" }} onClick={() => setPayForm({ ...payForm, due_date: addDays(30) })}>+30d</button>
                                <button type="button" className="btn btn-outline-secondary btn-xs py-0 px-1" style={{ fontSize: "0.68rem" }} onClick={() => setPayForm({ ...payForm, due_date: getNextMonthFirstDay() })}>1st Next Mth</button>
                              </div>
                            </div>

                            <div className={payForm.type === "payment" ? "col-md-3" : "col-md-3"}>
                              <label className="small fw-medium">Note / Reference</label>
                              <input className="form-control form-control-sm" value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} placeholder="Optional reference..." />
                            </div>
                            <div className="col-12 d-flex justify-content-end gap-2 pt-2 border-top">
                              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setPaying(null)}>{t("sup_btn_cancel")}</button>
                              <button type="submit" className="btn btn-success btn-sm px-4" disabled={saving}>
                                {saving ? "Processing…" : "Submit Payment"}
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} setPage={setPage} total={total} />
      </div>

      {/* QUICK PROMISED DATE MODAL */}
      {dateModalSupplier && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 rounded-4">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">
                  📅 {t("sup_lbl_due_date") || "Set Promised Payment Date"}
                </h5>
                <button type="button" className="btn-close" onClick={() => setDateModalSupplier(null)}></button>
              </div>
              <form onSubmit={handleSavePromisedDate}>
                <div className="modal-body py-3">
                  <p className="text-secondary small mb-3">
                    Set or change the promised date to pay outstanding due for supplier <strong>{dateModalSupplier.name}</strong> (Due: <strong>{money(dateModalSupplier.due_balance)}</strong>).
                  </p>
                  
                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-dark">
                      {lang === "bn" ? "প্রতিশ্রুত পরিশোধের তারিখ" : "Promised Due Date"}
                    </label>
                    <input 
                      type="date" 
                      className="form-control form-control-lg font-monospace" 
                      value={quickPromisedDate} 
                      onChange={e => setQuickPromisedDate(e.target.value)} 
                    />
                  </div>

                  {/* Quick helper chips */}
                  <div className="mb-2">
                    <span className="text-secondary small d-block mb-1">
                      {lang === "bn" ? "দ্রুত তারিখ বাছাই করুন:" : "Quick select shortcuts:"}
                    </span>
                    <div className="d-flex flex-wrap gap-2">
                      <button type="button" className="btn btn-sm btn-outline-primary rounded-pill px-2 py-1 text-xs" onClick={() => setQuickPromisedDate(addDays(7))}>
                        +7 {lang === "bn" ? "দিন" : "Days"}
                      </button>
                      <button type="button" className="btn btn-sm btn-outline-primary rounded-pill px-2 py-1 text-xs" onClick={() => setQuickPromisedDate(addDays(15))}>
                        +15 {lang === "bn" ? "দিন" : "Days"}
                      </button>
                      <button type="button" className="btn btn-sm btn-outline-primary rounded-pill px-2 py-1 text-xs" onClick={() => setQuickPromisedDate(addDays(30))}>
                        +30 {lang === "bn" ? "দিন" : "Days"}
                      </button>
                      <button type="button" className="btn btn-sm btn-outline-primary rounded-pill px-2 py-1 text-xs" onClick={() => setQuickPromisedDate(getNextMonthFirstDay())}>
                        {lang === "bn" ? "পরের মাসের ১ তারিখ" : "1st Next Month"}
                      </button>
                      {quickPromisedDate && (
                        <button type="button" className="btn btn-sm btn-outline-danger rounded-pill px-2 py-1 text-xs" onClick={() => setQuickPromisedDate("")}>
                          {lang === "bn" ? "তারিখ মুছুন" : "Clear Date"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button type="button" className="btn btn-light rounded-pill px-4" onClick={() => setDateModalSupplier(null)}>
                    {t("sup_btn_cancel")}
                  </button>
                  <button type="submit" className="btn btn-brand rounded-pill px-4" disabled={savingDate}>
                    {savingDate ? (lang === "bn" ? "সংরক্ষণ হচ্ছে..." : "Saving...") : (lang === "bn" ? "তারিখ আপডেট করুন" : "Save Promised Date")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
