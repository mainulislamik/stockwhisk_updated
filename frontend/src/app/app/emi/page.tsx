"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { money } from "@/components/ui";
import { useLanguage } from "@/contexts/LanguageContext";

type Installment = {
  id: number;
  month_number: number;
  due_date: string;
  amount: string;
  paid_amount: string;
  status: "PENDING" | "PARTIAL" | "PAID";
  paid_at: string | null;
};

type EMISchedule = {
  id: number;
  sale: number;
  sale_invoice_no: string;
  customer: number;
  customer_name: string;
  total_principal: string;
  total_due: string;
  months: number;
  status: "ACTIVE" | "COMPLETED" | "DEFAULTED";
  created_at: string;
  installments: Installment[];
};

export default function EMIPage() {
  const { t } = useLanguage();
  const [schedules, setSchedules] = useState<EMISchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSchedule, setSelectedSchedule] = useState<EMISchedule | null>(null);
  
  // Payment Modal State
  const [payInstallment, setPayInstallment] = useState<Installment | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const res = await api<{ results: EMISchedule[] }>("/sales/emi/");
      setSchedules(res.results || []);
    } catch (err: any) {
      setError(t("emi_err_load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  const handlePay = async () => {
    if (!payInstallment || !selectedSchedule) return;
    setPaying(true);
    setPayError("");
    try {
      const res = await api<EMISchedule>(`/sales/emi/${selectedSchedule.id}/pay-installment/${payInstallment.id}/`, {
        method: "POST",
        body: { amount: Number(payAmount), method: payMethod }
      });
      
      // Update local state
      setSchedules(schedules.map(s => s.id === res.id ? res : s));
      setSelectedSchedule(res);
      setPayInstallment(null);
      setPayAmount("");
    } catch (err: any) {
      setPayError(err?.data?.detail || err?.message || t("emi_err_pay"));
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h1 className="h3 mb-1 fw-bold text-dark">{t("emi_title")}</h1>
          <p className="text-secondary mb-0">{t("emi_subtitle")}</p>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card shadow-sm border-0 rounded-4 mb-4">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th className="ps-4">{t("emi_col_inv")}</th>
                <th>{t("emi_col_cust")}</th>
                <th>{t("emi_col_tot_prin")}</th>
                <th>{t("emi_col_tot_due")}</th>
                <th>{t("emi_col_dur")}</th>
                <th>{t("emi_col_status")}</th>
                <th className="text-end pe-4">{t("emi_col_actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-5">
                    <div className="spinner-border text-primary" />
                  </td>
                </tr>
              ) : schedules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-5 text-secondary">
                    {t("emi_no_schedules")}
                  </td>
                </tr>
              ) : (
                schedules.map((schedule) => (
                  <tr key={schedule.id}>
                    <td className="ps-4 fw-medium text-primary">#{schedule.sale_invoice_no}</td>
                    <td className="fw-semibold">{schedule.customer_name}</td>
                    <td>{money(schedule.total_principal)}</td>
                    <td className="text-danger fw-bold">{money(schedule.total_due)}</td>
                    <td>{t("emi_months", { num: schedule.months })}</td>
                    <td>
                      {schedule.status.toLowerCase() === 'completed' ? (
                        <span className="badge rounded-pill bg-success bg-opacity-10 text-success border border-success fw-semibold px-3 py-2">
                          <i className="bi bi-check-circle-fill me-1"></i> Completed
                        </span>
                      ) : schedule.status.toLowerCase() === 'active' ? (
                        <span className="badge rounded-pill bg-primary bg-opacity-10 text-primary border border-primary fw-semibold px-3 py-2">
                          <i className="bi bi-play-circle-fill me-1"></i> Active
                        </span>
                      ) : (
                        <span className="badge rounded-pill bg-danger bg-opacity-10 text-danger border border-danger fw-semibold px-3 py-2">
                          <i className="bi bi-exclamation-triangle-fill me-1"></i> {schedule.status.toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td className="text-end pe-4">
                      <button 
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => setSelectedSchedule(schedule)}
                        data-bs-toggle="modal"
                        data-bs-target="#installmentsModal"
                      >
                        View Installments
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Installments Modal */}
      <div className="modal fade" id="installmentsModal" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content border-0 shadow">
            <div className="modal-header border-bottom-0 bg-light">
              <h5 className="modal-title fw-bold">
                {t("emi_inst_title", { invoice: selectedSchedule?.sale_invoice_no || "" })}
              </h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body p-0">
              <table className="table table-sm mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="ps-3">{t("emi_col_month")}</th>
                    <th>{t("emi_col_due_date")}</th>
                    <th>{t("emi_col_amt")}</th>
                    <th>{t("emi_col_paid")}</th>
                    <th>{t("emi_col_status")}</th>
                    <th className="text-end pe-3">{t("emi_col_action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSchedule?.installments.map((inst) => {
                    const dueAmt = Number(inst.amount) - Number(inst.paid_amount);
                    return (
                      <tr key={inst.id}>
                        <td className="ps-3">{t("emi_lbl_month_num", { num: inst.month_number })}</td>
                        <td>{new Date(inst.due_date).toLocaleDateString()}</td>
                        <td>{money(inst.amount)}</td>
                        <td className="text-success">{money(inst.paid_amount)}</td>
                        <td>
                          {inst.status.toLowerCase() === 'paid' ? (
                            <span className="badge rounded-pill bg-success bg-opacity-10 text-success border border-success fw-semibold px-2 py-1">
                              <i className="bi bi-check-circle-fill me-1"></i> Paid
                            </span>
                          ) : inst.status.toLowerCase() === 'partial' ? (
                            <span className="badge rounded-pill bg-warning bg-opacity-10 text-warning border border-warning fw-semibold px-2 py-1">
                              <i className="bi bi-circle-half me-1"></i> Partial
                            </span>
                          ) : (
                            <span className="badge rounded-pill bg-secondary bg-opacity-10 text-secondary border border-secondary fw-semibold px-2 py-1">
                              <i className="bi bi-clock-history me-1"></i> Pending
                            </span>
                          )}
                        </td>
                        <td className="text-end pe-3">
                          {inst.status !== 'PAID' && (
                            <button 
                              className="btn btn-sm btn-primary py-0"
                              onClick={() => {
                                setPayInstallment(inst);
                                setPayAmount(String(dueAmt));
                                setPayError("");
                              }}
                            >
                              Pay Now
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Payment Form inside Modal */}
              {payInstallment && (
                <div className="p-3 m-3 bg-light rounded border border-primary border-opacity-25">
                  <h6 className="fw-bold mb-3 text-primary">
                    {t("emi_pay_inst_title", { num: payInstallment.month_number })}
                  </h6>
                  
                  {payError && <div className="alert alert-danger py-2 small">{payError}</div>}
                  
                  <div className="row g-2 align-items-end">
                    <div className="col-md-4">
                      <label className="form-label small">{t("emi_lbl_amt_taka")}</label>
                      <input 
                        type="number" 
                        className="form-control"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        max={Number(payInstallment.amount) - Number(payInstallment.paid_amount)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small">{t("emi_lbl_method")}</label>
                      <select className="form-select" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                        <option value="cash">{t("emi_opt_cash")}</option>
                        <option value="card">{t("emi_opt_card")}</option>
                        <option value="bkash">{t("emi_opt_bkash")}</option>
                        <option value="nagad">{t("emi_opt_nagad")}</option>
                        <option value="bank">{t("emi_opt_bank")}</option>
                      </select>
                    </div>
                    <div className="col-md-4 d-flex gap-2">
                      <button className="btn btn-outline-secondary w-50" onClick={() => setPayInstallment(null)} disabled={paying}>
                        Cancel
                      </button>
                      <button className="btn btn-primary w-50" onClick={handlePay} disabled={paying || !payAmount}>
                        {paying ? "..." : t("emi_btn_confirm")}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer border-top-0">
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">{t("emi_btn_close")}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
