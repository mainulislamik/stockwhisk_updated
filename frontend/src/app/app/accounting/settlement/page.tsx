"use client";

import { confirmAction, showError, showSuccess, showInfo } from "@/lib/dialogs";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Settlement = {
  id: number;
  opened_at: string;
  closed_at: string | null;
  opening_cash: string;
  expected_cash: string;
  actual_cash: string;
  discrepancy: string;
  total_sales: string;
  total_expenses: string;
  total_refunds: string;
  status: "open" | "closed";
  closed_by_name: string | null;
};

export default function DailySettlementPage() {
  const [current, setCurrent] = useState<Settlement | null>(null);
  const [history, setHistory] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [actualCash, setActualCash] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [filterDate, setFilterDate] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const cur = await api<Settlement | null>("/api/accounting/daily-settlements/current/");
      setCurrent(cur || null);
      
      const hist = await api<{results: Settlement[]}>("/api/accounting/daily-settlements/");
      if (hist && hist.results) {
        setHistory(hist.results.filter(s => s.status === "closed"));
      }
    } catch (e: any) {
      setError(e.data?.error || e.data?.detail || e.message || t("stl_err_load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    document.getElementById("page-heading")!.innerText = t("stl_title");
  }, []);

  const openShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api("/api/accounting/daily-settlements/open/", {
        method: "POST",
        body: { opening_cash: 0 }
      });
      await loadData();
    } catch (e: any) {
      setError(e.data?.error || e.data?.detail || e.message || t("stl_err_open"));
    } finally {
      setSubmitting(false);
    }
  };

  const closeShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(await confirmAction(t("stl_confirm_close")))) return;
    setSubmitting(true);
    setError("");
    try {
      await api("/api/accounting/daily-settlements/close/", {
        method: "POST",
        body: { actual_cash: actualCash || "0" }
      });
      setActualCash("");
      await loadData();
    } catch (e: any) {
      setError(e.data?.error || e.data?.detail || e.message || t("stl_err_close"));
    } finally {
      setSubmitting(false);
    }
  };

  const reopenShift = async () => {
    if (!(await confirmAction(t("stl_confirm_reopen")))) return;
    setSubmitting(true);
    setError("");
    try {
      await api("/api/accounting/daily-settlements/reopen/", {
        method: "POST"
      });
      await loadData();
    } catch (e: any) {
      setError(e.data?.error || e.data?.detail || e.message || t("stl_err_reopen"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>{t("stl_loading")}</div>;

  const filteredHistory = filterDate 
    ? history.filter(s => new Date(s.opened_at).toLocaleDateString("en-CA") === filterDate)
    : history;

  return (
    <div className="container-fluid max-w-5xl">
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row g-4 mb-4">
        <div className="col-lg-6">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body">
              <h5 className="card-title fw-bold mb-4">{t("stl_current_shift")}</h5>
              
              {!current ? (
                <div className="text-center py-5">
                  <div className="display-1 text-muted mb-3">🏪</div>
                  <h4 className="fw-semibold">{t("stl_no_active")}</h4>
                  <p className="text-muted">{t("stl_no_active_desc")}</p>
                  <form onSubmit={openShift} className="mt-4 max-w-sm mx-auto">
                    <button type="submit" className="btn btn-primary w-100 rounded-pill" disabled={submitting}>
                      Start New Day
                    </button>
                  </form>
                </div>
              ) : current.status === "closed" ? (
                <div>
                  <div className="alert alert-success mb-4">
                    <h5 className="alert-heading fw-bold">{t("stl_closed_title")}</h5>
                    <p className="mb-0">{t("stl_closed_desc", { time: new Date(current.closed_at!).toLocaleTimeString() })}</p>
                  </div>
                  
                  <div className="row g-3 mb-4">
                    <div className="col-12 col-md-4">
                      <div className="bg-light rounded p-3 text-center border" style={{ backgroundColor: "var(--bs-tertiary-bg)" }}>
                        <div className="small text-uppercase fw-semibold mb-1 text-muted">{t("stl_expected")}</div>
                        <div className="fs-4 fw-bold">{current.expected_cash}</div>
                      </div>
                    </div>
                    <div className="col-12 col-md-4">
                      <div className="bg-light rounded p-3 text-center border" style={{ backgroundColor: "var(--bs-tertiary-bg)" }}>
                        <div className="small text-uppercase fw-semibold mb-1 text-muted">{t("stl_actual_counted")}</div>
                        <div className="fs-4 fw-bold">{current.actual_cash}</div>
                      </div>
                    </div>
                    <div className="col-12 col-md-4">
                      <div className={`rounded p-3 text-center border ${parseFloat(current.discrepancy) < 0 ? 'bg-danger bg-opacity-10 border-danger' : 'bg-success bg-opacity-10 border-success'}`}>
                        <div className="small text-uppercase fw-semibold mb-1">{t("stl_discrepancy")}</div>
                        <div className="fs-4 fw-bold">{parseFloat(current.discrepancy) > 0 ? '+' : ''}{current.discrepancy}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="d-flex justify-content-end mt-2">
                    <button onClick={reopenShift} className="btn btn-outline-danger px-4 rounded-pill d-flex align-items-center gap-2" disabled={submitting}>
                      <i className="bi bi-arrow-counterclockwise"></i> Undo Closure & Reopen Shift
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="d-flex justify-content-between mb-3 text-muted small">
                    <span>{t("stl_opened_at")} {new Date(current.opened_at).toLocaleString()}</span>
                  </div>
                  
                  <div className="row g-3 mb-4">
                    <div className="col-12">
                      <div className="bg-primary bg-opacity-10 rounded p-3 text-center h-100 border border-primary border-opacity-25">
                        <div className="text-primary small text-uppercase fw-semibold mb-1">{t("stl_expected_cash")}</div>
                        <div className="fs-3 fw-bold text-primary">{current.expected_cash}</div>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={closeShift}>
                    <label className="form-label fw-semibold">{t("stl_counted_cash")}</label>
                    <div className="input-group input-group-lg mb-3">
                      <span className="input-group-text" style={{ backgroundColor: "var(--bs-tertiary-bg)" }}>৳</span>
                      <input 
                        type="number" 
                        step="0.01" 
                        className="form-control fw-bold fs-4" 
                        value={actualCash} 
                        onChange={(e) => setActualCash(e.target.value)} 
                        placeholder="0.00"
                        required 
                        style={{ backgroundColor: "var(--bs-body-bg)", color: "var(--bs-body-color)" }}
                      />
                    </div>
                    
                    {actualCash && (
                      <div className={`alert mb-3 py-2 ${parseFloat(actualCash) - parseFloat(current.expected_cash) < 0 ? 'alert-danger' : 'alert-success'}`}>
                        <div className="d-flex justify-content-between align-items-center">
                          <span className="fw-semibold">{t("stl_discrepancy")}:</span>
                          <span className="fw-bold fs-5">
                            {(parseFloat(actualCash) - parseFloat(current.expected_cash)).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    <button type="submit" className="btn btn-primary btn-lg w-100 rounded-pill" disabled={submitting}>
                      Close Shift
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h5 className="card-title fw-bold mb-0">{t("stl_history_title")}</h5>
                <input 
                  type="date" 
                  className="form-control form-control-sm w-auto"
                  style={{ backgroundColor: "var(--bs-body-bg)", color: "var(--bs-body-color)" }}
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                />
              </div>
              
              {filteredHistory.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  {filterDate ? t("stl_no_shifts_date", { date: filterDate }) : t("stl_no_past")}
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle">
                    <thead>
                      <tr className="text-muted small text-uppercase">
                        <th>{t("stl_col_date")}</th>
                        <th className="text-end">{t("stl_expected")}</th>
                        <th className="text-end">{t("stl_col_actual")}</th>
                        <th className="text-end">{t("stl_col_diff")}</th>
                        <th>{t("stl_col_closed_by")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistory.map(s => (
                        <tr key={s.id}>
                          <td>
                            <div className="fw-medium">{new Date(s.opened_at).toLocaleDateString()}</div>
                            <div className="small text-muted">{new Date(s.closed_at!).toLocaleTimeString()}</div>
                          </td>
                          <td className="text-end">{s.expected_cash}</td>
                          <td className="text-end fw-semibold">{s.actual_cash}</td>
                          <td className={`text-end fw-bold ${parseFloat(s.discrepancy) < 0 ? 'text-danger' : 'text-success'}`}>
                            {parseFloat(s.discrepancy) > 0 ? '+' : ''}{s.discrepancy}
                          </td>
                          <td className="small text-muted">{s.closed_by_name || 'Admin'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
