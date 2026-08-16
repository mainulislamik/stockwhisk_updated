"use client";

import React, { useEffect, useState } from "react";
import { api, useApi, Paginated } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { ErrorState, Pagination, Spinner, money, fmtDate } from "@/components/ui";
import toast from "react-hot-toast";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { t } = useLanguage();
  const canManage = isOwner || can("manage_customers");
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "" });

  // Payment State
  const [paying, setPaying] = useState<number | null>(null);
  const [payForm, setPayForm] = useState({ type: "payment", amount: "", method: "cash", note: "" });

  const [saving, setSaving] = useState(false);

  // Debounce the filter into the server `search` param and reset to page 1.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(filter.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [filter]);

  const PAGE_SIZE = 20;
  // Server-side: only the current page is fetched (constant-size request).
  const { data, loading, error, mutate } = useApi<Paginated<Customer>>("/crm/customers/", { page, page_size: PAGE_SIZE, search });
  const rows = data?.results || [];
  const total = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/crm/customers/", { method: "POST", body: form });
      setForm({ name: "", phone: "", email: "", address: "" });
      setShowAdd(false);
      mutate();
    } catch (e: any) {
      toast.error(e?.message || t("cust_err_save"));
    } finally {
      setSaving(false);
    }
  }

  async function processPayment(e: React.FormEvent, c: Customer) {
    e.preventDefault();
    setSaving(true);
    try {
      const method = payForm.type === "settlement" ? "settlement" : payForm.method;
      await api<Customer>(`/crm/customers/${c.id}/pay-due/`, {
        method: "POST",
        body: { amount: payForm.amount, method, note: payForm.note },
      });
      toast.success(payForm.type === "settlement" ? t("cust_set_ok") : t("cust_pay_ok"));
      setPaying(null);
      mutate();
    } catch (e: any) {
      toast.error(e?.message || t("cust_err_pay"));
    } finally {
      setSaving(false);
    }
  }

  function startPay(c: Customer) {
    setPaying(c.id);
    setPayForm({ type: "payment", amount: c.due_balance, method: "cash", note: "" });
    setShowAdd(false);
  }

  if (loading) return <Spinner label={t("cust_loading")} />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="vstack gap-3">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <input placeholder={t("cust_filter")} className="form-control form-control-sm" style={{ maxWidth: "18rem" }} value={filter} onChange={(e) => setFilter(e.target.value)} />
        {canManage && (
          <button onClick={() => { setShowAdd((s) => !s); setPaying(null); }} className="btn btn-brand btn-sm">
            {t("cust_new")}
          </button>
        )}
      </div>

      {showAdd && (
        <div className="card shadow-sm">
          <div className="card-body">
            <form onSubmit={save} className="row g-3">
              <div className="col-md-3">
                <label className="small">{t("cust_name")}</label>
                <input required className="form-control form-control-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label className="small">{t("cust_phone")}</label>
                <input className="form-control form-control-sm" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label className="small">{t("cust_email")}</label>
                <input type="email" className="form-control form-control-sm" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label className="small">{t("cust_address")}</label>
                <input className="form-control form-control-sm" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="col-12">
                <button className="btn btn-brand btn-sm" disabled={saving}>
                  {saving ? t("cust_saving") : t("cust_save")}
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
                <th>{t("cust_col_name")}</th>
                <th>{t("cust_col_phone")}</th>
                <th className="text-end">{t("cust_col_total")}</th>
                <th className="text-end">{t("cust_col_due")}</th>
                <th>{t("cust_col_last")}</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr data-empty="">
                  <td colSpan={canManage ? 6 : 5} className="text-center text-secondary py-5">
                    <div style={{ fontSize: "2.5rem" }}>👥</div>
                    {t("cust_no_cust")}
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <React.Fragment key={c.id}>
                    <tr>
                      <td className="fw-medium">{c.name}</td>
                      <td className="text-secondary">{c.phone || "—"}</td>
                      <td className="text-end">{money(c.total_purchased)}</td>
                      <td className={`text-end ${Number(c.due_balance) > 0 ? "text-danger fw-semibold" : ""}`}>{money(c.due_balance)}</td>
                      <td className="text-secondary">{fmtDate(c.last_purchase_at)}</td>
                      {canManage && (
                        <td className="text-end text-nowrap">
                          {Number(c.due_balance) > 0 && (
                            <button className="btn btn-brand btn-sm py-0 px-2" style={{ fontSize: "0.8rem" }} onClick={() => startPay(c)}>
                              {t("cust_btn_pay")}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                    
                    {/* PAY FORM */}
                    {paying === c.id && (
                      <tr className="border-bottom">
                        <td colSpan={canManage ? 6 : 5} className="bg-light p-3 border-start border-4 border-success">
                          <form onSubmit={(e) => processPayment(e, c)} className="row g-3 align-items-end">
                            <div className="col-12 mb-1">
                              <span className="fw-bold text-success me-2">{t("cust_clear_dues", { name: c.name })}</span>
                              <span className="text-muted small">{t("cust_out", { amount: money(c.due_balance) })}</span>
                            </div>
                            <div className="col-md-3">
                              <label className="small fw-medium">{t("cust_act_type")}</label>
                              <select className="form-select form-select-sm" value={payForm.type} onChange={e => setPayForm({...payForm, type: e.target.value})}>
                                <option value="payment">{t("cust_act_pay")}</option>
                                <option value="settlement">{t("cust_act_set")}</option>
                              </select>
                            </div>
                            <div className="col-md-2">
                              <label className="small fw-medium">{t("cust_amt")}</label>
                              <input type="number" step="0.01" max={c.due_balance} required className="form-control form-control-sm" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
                            </div>
                            {payForm.type === "payment" && (
                              <div className="col-md-2">
                                <label className="small fw-medium">{t("cust_meth")}</label>
                                <select className="form-select form-select-sm" value={payForm.method} onChange={e => setPayForm({...payForm, method: e.target.value})}>
                                  <option value="cash">{t("cust_meth_cash")}</option>
                                  <option value="bkash">{t("cust_meth_bkash")}</option>
                                  <option value="nagad">{t("cust_meth_nagad")}</option>
                                  <option value="bank">{t("cust_meth_bank")}</option>
                                </select>
                              </div>
                            )}
                            <div className={payForm.type === "payment" ? "col-md-3" : "col-md-5"}>
                              <label className="small fw-medium">{t("cust_note")}</label>
                              <input className="form-control form-control-sm" value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} placeholder={t("cust_note_ph")} />
                            </div>
                            <div className="col-md-2 d-flex gap-2">
                              <button type="submit" className="btn btn-success btn-sm w-100" disabled={saving}>
                                {saving ? t("cust_proc") : t("cust_submit")}
                              </button>
                              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setPaying(null)}>{t("cust_cancel")}</button>
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
