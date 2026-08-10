"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { money } from "@/components/ui";

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
      setError("Failed to load EMI schedules.");
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
      setPayError(err?.data?.detail || err?.message || "Payment failed.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h1 className="h3 mb-1 fw-bold text-dark">EMI Management</h1>
          <p className="text-secondary mb-0">Track and manage customer installments</p>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card shadow-sm border-0 rounded-4 mb-4">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th className="ps-4">Sale Invoice</th>
                <th>Customer</th>
                <th>Total Principal</th>
                <th>Total Due</th>
                <th>Duration</th>
                <th>Status</th>
                <th className="text-end pe-4">Actions</th>
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
                    No EMI schedules found.
                  </td>
                </tr>
              ) : (
                schedules.map((schedule) => (
                  <tr key={schedule.id}>
                    <td className="ps-4 fw-medium text-primary">#{schedule.sale_invoice_no}</td>
                    <td className="fw-semibold">{schedule.customer_name}</td>
                    <td>{money(schedule.total_principal)}</td>
                    <td className="text-danger fw-bold">{money(schedule.total_due)}</td>
                    <td>{schedule.months} Months</td>
                    <td>
                      <span className={`badge bg-${schedule.status === 'COMPLETED' ? 'success' : schedule.status === 'ACTIVE' ? 'primary' : 'danger'}`}>
                        {schedule.status}
                      </span>
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
                Installments for Invoice #{selectedSchedule?.sale_invoice_no}
              </h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body p-0">
              <table className="table table-sm mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="ps-3">Month</th>
                    <th>Due Date</th>
                    <th>Amount</th>
                    <th>Paid</th>
                    <th>Status</th>
                    <th className="text-end pe-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSchedule?.installments.map((inst) => {
                    const dueAmt = Number(inst.amount) - Number(inst.paid_amount);
                    return (
                      <tr key={inst.id}>
                        <td className="ps-3">Month {inst.month_number}</td>
                        <td>{new Date(inst.due_date).toLocaleDateString()}</td>
                        <td>{money(inst.amount)}</td>
                        <td className="text-success">{money(inst.paid_amount)}</td>
                        <td>
                          <span className={`badge bg-${inst.status === 'PAID' ? 'success' : inst.status === 'PARTIAL' ? 'warning' : 'secondary'}`}>
                            {inst.status}
                          </span>
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
                    Pay Month {payInstallment.month_number} Installment
                  </h6>
                  
                  {payError && <div className="alert alert-danger py-2 small">{payError}</div>}
                  
                  <div className="row g-2 align-items-end">
                    <div className="col-md-4">
                      <label className="form-label small">Amount (৳)</label>
                      <input 
                        type="number" 
                        className="form-control"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        max={Number(payInstallment.amount) - Number(payInstallment.paid_amount)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small">Method</label>
                      <select className="form-select" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                        <option value="cash">💵 Cash</option>
                        <option value="card">💳 Card</option>
                        <option value="bkash">📱 bKash</option>
                        <option value="nagad">📱 Nagad</option>
                        <option value="bank">🏦 Bank</option>
                      </select>
                    </div>
                    <div className="col-md-4 d-flex gap-2">
                      <button className="btn btn-outline-secondary w-50" onClick={() => setPayInstallment(null)} disabled={paying}>
                        Cancel
                      </button>
                      <button className="btn btn-primary w-50" onClick={handlePay} disabled={paying || !payAmount}>
                        {paying ? "..." : "Confirm"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer border-top-0">
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
