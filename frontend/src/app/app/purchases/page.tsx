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
  const { t } = useLanguage();
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
  const [payForm, setPayForm] = useState({ type: "payment", amount: "", method: "cash", note: "" });
  const [saving, setSaving] = useState(false);

  function startPay(po: PO) {
    setPaying(po.id);
    setPayForm({
      type: "payment",
      amount: String(po.due),
      method: "cash",
      note: ""
    });
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
                      <td className="text-end">{money(po.paid)}</td>
                      <td className={`text-end ${Number(po.due) > 0 ? "text-danger fw-semibold" : ""}`}>{money(po.due)}</td>
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
                              {paying === po.id ? "Close" : "Pay / Settle"}
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
                                <span className="fw-bold text-success me-2">Clear Due for PO {po.po_number || `#${po.id}`}</span>
                                <span className="text-muted small">({po.supplier_name} · Outstanding: {money(po.due)})</span>
                              </div>
                            </div>
                            <div className="col-md-3">
                              <label className="small fw-medium">Action Type</label>
                              <select className="form-select form-select-sm" value={payForm.type} onChange={e => setPayForm({...payForm, type: e.target.value})}>
                                <option value="payment">Pay Due (Cash Outflow)</option>
                                <option value="settlement">Settle / Forgive (No Cash Impact)</option>
                              </select>
                            </div>
                            <div className="col-md-2">
                              <label className="small fw-medium">Amount</label>
                              <input type="number" step="0.01" max={po.due} min="0.01" required className="form-control form-control-sm" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
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
                              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setPaying(null)}>Cancel</button>
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
    </div>
  );
}
