"use client";

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
  
  const [openingCash, setOpeningCash] = useState("0");
  const [actualCash, setActualCash] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const cur = await api<Settlement | null>("/api/auth/daily-settlements/current/");
      setCurrent(cur || null);
      
      const hist = await api<{results: Settlement[]}>("/api/auth/daily-settlements/");
      if (hist && hist.results) {
        setHistory(hist.results.filter(s => s.status === "closed"));
      }
    } catch (e: any) {
      setError(e.message || "Failed to load settlement data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    document.getElementById("page-heading")!.innerText = "Daily Settlement";
  }, []);

  const openShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api("/api/auth/daily-settlements/open/", {
        method: "POST",
        body: { opening_cash: openingCash }
      });
      await loadData();
    } catch (e: any) {
      setError(e.message || "Failed to open shift");
    } finally {
      setSubmitting(false);
    }
  };

  const closeShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm("Are you sure you want to close this shift? This action cannot be undone.")) return;
    setSubmitting(true);
    setError("");
    try {
      await api("/api/auth/daily-settlements/close/", {
        method: "POST",
        body: { actual_cash: actualCash || "0" }
      });
      setActualCash("");
      await loadData();
    } catch (e: any) {
      setError(e.message || "Failed to close shift");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="container-fluid max-w-5xl">
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row g-4 mb-4">
        <div className="col-lg-6">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body">
              <h5 className="card-title fw-bold mb-4">Current Shift</h5>
              
              {!current ? (
                <div className="text-center py-5">
                  <div className="display-1 text-muted mb-3">🏪</div>
                  <h4 className="fw-semibold">No active shift</h4>
                  <p className="text-muted">Open a shift to start tracking today's expected cash.</p>
                  <form onSubmit={openShift} className="mt-4 max-w-sm mx-auto">
                    <div className="input-group mb-3">
                      <span className="input-group-text bg-light border-0">Opening Cash</span>
                      <input 
                        type="number" 
                        step="0.01" 
                        min="0" 
                        className="form-control bg-light border-0" 
                        value={openingCash} 
                        onChange={(e) => setOpeningCash(e.target.value)} 
                        required 
                      />
                    </div>
                    <button type="submit" className="btn btn-primary w-100 rounded-pill" disabled={submitting}>
                      Open Shift
                    </button>
                  </form>
                </div>
              ) : (
                <div>
                  <div className="d-flex justify-content-between mb-3 text-muted small">
                    <span>Opened at: {new Date(current.opened_at).toLocaleString()}</span>
                  </div>
                  
                  <div className="row g-3 mb-4">
                    <div className="col-6">
                      <div className="bg-light rounded p-3 text-center h-100">
                        <div className="text-muted small text-uppercase fw-semibold mb-1">Opening Cash</div>
                        <div className="fs-4 fw-bold">{current.opening_cash}</div>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="bg-primary bg-opacity-10 rounded p-3 text-center h-100 border border-primary border-opacity-25">
                        <div className="text-primary small text-uppercase fw-semibold mb-1">Expected Cash</div>
                        <div className="fs-3 fw-bold text-primary">{current.expected_cash}</div>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={closeShift}>
                    <label className="form-label fw-semibold">Counted Cash in Drawer</label>
                    <div className="input-group input-group-lg mb-3">
                      <span className="input-group-text bg-white">৳</span>
                      <input 
                        type="number" 
                        step="0.01" 
                        className="form-control fw-bold fs-4" 
                        value={actualCash} 
                        onChange={(e) => setActualCash(e.target.value)} 
                        placeholder="0.00"
                        required 
                      />
                    </div>
                    
                    {actualCash && (
                      <div className={`alert mb-3 py-2 ${parseFloat(actualCash) - parseFloat(current.expected_cash) < 0 ? 'alert-danger' : 'alert-success'}`}>
                        <div className="d-flex justify-content-between align-items-center">
                          <span className="fw-semibold">Discrepancy:</span>
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
              <h5 className="card-title fw-bold mb-4">Shift History</h5>
              {history.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  No past shifts found.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle">
                    <thead>
                      <tr className="text-muted small text-uppercase">
                        <th>Date</th>
                        <th className="text-end">Expected</th>
                        <th className="text-end">Actual</th>
                        <th className="text-end">Diff</th>
                        <th>Closed By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(s => (
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
