"use client";

import React, { useEffect, useState } from "react";
import { api, fetchAll } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { ErrorState, Pagination, Spinner, money, fmtDate, usePagination } from "@/components/ui";
import toast from "react-hot-toast";
import { useLanguage } from "@/contexts/LanguageContext";

type PO = {
  id: number;
  po_number: string;
  supplier_name: string;
  status: string;
  order_date: string;
  due_date?: string;
  total: string;
  paid: string;
  due: string;
};

const statusBadge: Record<string, string> = {
  RECEIVED: "text-bg-success",
  PARTIAL: "text-bg-warning",
  DRAFT: "text-bg-secondary",
  ORDERED: "text-bg-info",
};

export default function PurchasesPage() {
  const { t, lang } = useLanguage();
  const { can, isOwner } = useAuth();
  const canManage = isOwner || can("manage_purchasing");
  const [rows, setRows] = useState<PO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      setRows(await fetchAll<PO>("/purchasing/purchase-orders/"));
    } catch (e: any) {
      setError(e?.message || t("po_err_load"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function receive(po: PO) {
    const paid = prompt(t("po_prompt_receive", { po: po.po_number }), po.total);
    if (paid === null) return;
    try {
      await api(`/purchasing/purchase-orders/${po.id}/receive/`, { method: "POST", body: { paid: Number(paid) || 0 } });
      await load();
    } catch (e: any) {
      toast.error(e?.message || t("po_err_receive"));
    }
  }

  // Payment / Settlement State
  const [paying, setPaying] = useState<number | null>(null);
  const [payForm, setPayForm] = useState({ type: "payment", amount: "", method: "cash", note: "", due_date: "" });
  const [saving, setSaving] = useState(false);

  // Quick Promised Date Modal State
  const [dateModalPO, setDateModalPO] = useState<PO | null>(null);
  const [quickPromisedDate, setQuickPromisedDate] = useState("");
  const [savingDate, setSavingDate] = useState(false);

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

  function startPay(po: PO) {
    setPaying(po.id);
    setPayForm({
      type: "payment",
      amount: String(po.due),
      method: "cash",
      note: "",
      due_date: po.due_date || ""
    });
  }

  function openDateModal(po: PO) {
    setDateModalPO(po);
    setQuickPromisedDate(po.due_date || "");
  }

  async function handleSavePromisedDate(e: React.FormEvent) {
    e.preventDefault();
    if (!dateModalPO) return;
    setSavingDate(true);
    try {
      const updated = await api<PO>(`/purchasing/purchase-orders/${dateModalPO.id}/set-due-date/`, {
        method: "POST",
        body: { due_date: quickPromisedDate || null }
      });
      toast.success(lang === "bn" ? "পরিশোধের প্রতিশ্রুত তারিখ আপডেট হয়েছে!" : "Promised date updated successfully!");
      setRows(r => r.map(x => x.id === dateModalPO.id ? updated : x));
      setDateModalPO(null);
    } catch (err: any) {
      toast.error(err?.data?.detail || err?.message || "Failed to update promised date.");
    } finally {
      setSavingDate(false);
    }
  }

  async function processPayment(e: React.FormEvent, po: PO) {
    e.preventDefault();
    setSaving(true);
    try {
      const method = payForm.type === "settlement" ? "settlement" : payForm.method;
      await api<PO>(`/purchasing/purchase-orders/${po.id}/pay-due/`, {
        method: "POST",
        body: {
          amount: payForm.amount,
          method: method,
          note: payForm.note
        }
      });

      // Update due date if changed/provided
      if (payForm.due_date !== (po.due_date || "")) {
        await api(`/purchasing/purchase-orders/${po.id}/set-due-date/`, {
          method: "POST",
          body: { due_date: payForm.due_date || null }
        });
      }

      toast.success(payForm.type === "settlement" ? "Due settled / forgiven successfully" : "Payment recorded successfully");
      setPaying(null);
      await load();
    } catch (e: any) {
      toast.error(e?.data?.detail || e?.message || "Failed to process payment");
    } finally {
      setSaving(false);
    }
  }

  const { paged, page, setPage, totalPages, total } = usePagination(rows);

  if (loading) return <Spinner label={t("po_loading")} />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="vstack gap-3">
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-striped table-sm align-middle mb-0">
            <thead className="thead-4">
              <tr>
                <th>{t("po_col_po")}</th>
                <th>{t("po_col_supplier")}</th>
                <th>{t("po_col_date")}</th>
                <th className="text-end">{t("po_col_total")}</th>
                <th className="text-end">{t("po_col_paid")}</th>
                <th className="text-end">{t("po_col_due")}</th>
                <th>{t("po_col_status")}</th>
                <th className="text-end" style={{ minWidth: "160px" }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr data-empty="">
                  <td colSpan={8} className="text-center text-secondary py-5">
                    <div style={{ fontSize: "2.5rem" }}>📥</div>
                    {t("po_no_orders")}
                  </td>
                </tr>
              ) : (
                paged.map((po) => (
                  <React.Fragment key={po.id}>
                    <tr>
                      <td className="fw-medium">{po.po_number || `#${po.id}`}</td>
                      <td className="text-secondary">{po.supplier_name || "—"}</td>
                      <td className="text-secondary">{fmtDate(po.order_date)}</td>
                      <td className="text-end">{money(po.total)}</td>
                      <td className="text-end text-success">{money(po.paid)}</td>
                      <td className={`text-end ${Number(po.due) > 0 ? "text-danger fw-semibold" : ""}`}>
                        <div>{money(po.due)}</div>
                        {Number(po.due) > 0 && (
                          po.due_date ? (
                            <div className="d-flex align-items-center justify-content-end gap-1 mt-1">
                              <span className={`badge rounded-pill px-2 py-0 small ${isOverdue(po.due_date) ? 'bg-danger text-white' : 'bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25'}`} style={{ fontSize: "0.72rem" }}>
                                📅 {fmtDate(po.due_date)}
                                {isOverdue(po.due_date) && <span className="ms-1 fw-bold">(! Overdue)</span>}
                              </span>
                              {canManage && (
                                <button 
                                  className="btn btn-link btn-sm p-0 text-muted" 
                                  title="Edit promised date"
                                  onClick={() => openDateModal(po)}
                                >
                                  ✏️
                                </button>
                              )}
                            </div>
                          ) : (
                            canManage && (
                              <button 
                                className="btn btn-outline-secondary btn-sm py-0 px-1 mt-1 text-xs" 
                                style={{ fontSize: "0.68rem" }}
                                onClick={() => openDateModal(po)}
                              >
                                + Set Date
                              </button>
                            )
                          )
                        )}
                      </td>
                      <td>
                        <span className={`badge ${statusBadge[po.status] || "text-bg-light"}`}>{po.status}</span>
                      </td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-1">
                          {canManage && po.status !== "RECEIVED" && (
                            <button className="btn btn-sm btn-outline-brand py-0 px-2" onClick={() => receive(po)}>
                              {t("po_btn_receive")}
                            </button>
                          )}
                          {canManage && Number(po.due) > 0 && (
                            <button 
                              className="btn btn-sm btn-brand py-0 px-2" 
                              style={{ fontSize: "0.8rem" }}
                              onClick={() => startPay(po)}
                            >
                              {paying === po.id ? (lang === "bn" ? "বন্ধ" : "Close") : (lang === "bn" ? "বকেয়া পরিশোধ / সমন্বয়" : "Pay / Settle")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* INLINE PAY / SETTLE FORM */}
                    {paying === po.id && (
                      <tr className="border-bottom">
                        <td colSpan={8} className="bg-light p-3 border-start border-4 border-success">
                          <form onSubmit={(e) => processPayment(e, po)} className="row g-3 align-items-end">
                            <div className="col-12 mb-1 d-flex justify-content-between align-items-center">
                              <div>
                                <span className="fw-bold text-success me-2">{lang === "bn" ? "বকেয়া পরিশোধ / সমন্বয় PO " : "Clear Due for PO "} {po.po_number || `#${po.id}`}</span>
                                <span className="text-muted small">({po.supplier_name} · Outstanding: {money(po.due)})</span>
                              </div>
                            </div>
                            <div className="col-md-2">
                              <label className="small fw-medium">{lang === "bn" ? "পদ্ধতি" : "Action Type"}</label>
                              <select className="form-select form-select-sm" value={payForm.type} onChange={e => setPayForm({...payForm, type: e.target.value})}>
                                <option value="payment">{lang === "bn" ? "বকেয়া প্রদান (নগদ খরচ)" : "Pay Due (Cash Outflow)"}</option>
                                <option value="settlement">{lang === "bn" ? "সমন্বয় / মওকুফ (নগদ ছাড়া)" : "Settle / Forgive (No Cash)"}</option>
                              </select>
                            </div>
                            <div className="col-md-2">
                              <label className="small fw-medium">{lang === "bn" ? "পরিমাণ" : "Amount"}</label>
                              <input type="number" step="0.01" max={po.due} min="0.01" required className="form-control form-control-sm" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
                            </div>
                            {payForm.type === "payment" && (
                              <div className="col-md-2">
                                <label className="small fw-medium">{lang === "bn" ? "পেমেন্ট মাধ্যম" : "Payment Method"}</label>
                                <select className="form-select form-select-sm" value={payForm.method} onChange={e => setPayForm({...payForm, method: e.target.value})}>
                                  <option value="cash">{lang === "bn" ? "ক্যাশ" : "Cash"}</option>
                                  <option value="bkash">bKash</option>
                                  <option value="nagad">{lang === "bn" ? "নগদ (Nagad)" : "Nagad"}</option>
                                  <option value="bank">{lang === "bn" ? "ব্যাংক" : "Bank"}</option>
                                </select>
                              </div>
                            )}
                            
                            {/* Next Promised Due Date */}
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
                              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setPaying(null)}>Cancel</button>
                              <button type="submit" className="btn btn-success btn-sm px-4" disabled={saving}>
                                {saving ? "Processing…" : "Submit"}
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} setPage={setPage} total={total} />
      </div>

      {/* QUICK PROMISED DATE MODAL */}
      {dateModalPO && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 rounded-4">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">
                  📅 {lang === "bn" ? "পরিশোধের প্রতিশ্রুত তারিখ নির্ধারণ করুন" : "Set Promised Payment Date"}
                </h5>
                <button type="button" className="btn-close" onClick={() => setDateModalPO(null)}></button>
              </div>
              <form onSubmit={handleSavePromisedDate}>
                <div className="modal-body py-3">
                  <p className="text-secondary small mb-3">
                    Set or change the promised date to pay due for PO <strong>{dateModalPO.po_number || `#${dateModalPO.id}`}</strong> ({dateModalPO.supplier_name} · Due: <strong>{money(dateModalPO.due)}</strong>).
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
                  <button type="button" className="btn btn-light rounded-pill px-4" onClick={() => setDateModalPO(null)}>
                    {t("sup_btn_cancel") || "Cancel"}
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
