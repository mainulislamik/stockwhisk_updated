"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { confirmAction, showError, showSuccess } from "@/lib/dialogs";
import { useLanguage } from "@/contexts/LanguageContext";
import { money, fmtDate, Spinner } from "@/components/ui";

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
  cash_in?: number;
  cash_out?: number;
  sales_total?: number;
  expenses_total?: number;
  refunds_total?: number;
  status: "open" | "closed";
  closed_by_name: string | null;
};

export default function DailySettlementPage() {
  const { t } = useLanguage();
  const [current, setCurrent] = useState<Settlement | null>(null);
  const [history, setHistory] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  const [actualCash, setActualCash] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [filterDate, setFilterDate] = useState("");

  // Cash Denomination Calculator State
  const [showCalculator, setShowCalculator] = useState(false);
  const [notes, setNotes] = useState({
    n1000: "",
    n500: "",
    n200: "",
    n100: "",
    n50: "",
    n20: "",
    n10: "",
    coins: "",
  });

  // Adjust Modal State
  const [adjustingShift, setAdjustingShift] = useState<Settlement | null>(null);
  const [adjustCash, setAdjustCash] = useState("");
  const [savingAdjust, setSavingAdjust] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const cur = await api<Settlement | null>("/api/accounting/daily-settlements/current/");
      setCurrent(cur || null);

      const hist = await api<any>("/api/accounting/daily-settlements/?page_size=300");
      const list = Array.isArray(hist) ? hist : hist?.results || [];
      setHistory(list.filter((s: Settlement) => s.status === "closed"));
    } catch (e: any) {
      setError(e.data?.error || e.data?.detail || e.message || t("stl_err_load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Calculate total from denominations
  const calcDenominationTotal = () => {
    const total =
      (Number(notes.n1000) || 0) * 1000 +
      (Number(notes.n500) || 0) * 500 +
      (Number(notes.n200) || 0) * 200 +
      (Number(notes.n100) || 0) * 100 +
      (Number(notes.n50) || 0) * 50 +
      (Number(notes.n20) || 0) * 20 +
      (Number(notes.n10) || 0) * 10 +
      (Number(notes.coins) || 0);
    return total;
  };

  const applyCalculatedCash = () => {
    const total = calcDenominationTotal();
    setActualCash(total.toFixed(2));
    setShowCalculator(false);
  };

  const openShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api("/api/accounting/daily-settlements/open/", {
        method: "POST",
        body: { opening_cash: 0 },
      });
      await loadData();
      showSuccess(t("stl_start_new"));
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
        body: { actual_cash: actualCash || "0" },
      });
      setActualCash("");
      await loadData();
      showSuccess(t("stl_closed_title"));
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
        method: "POST",
      });
      await loadData();
      showSuccess(t("stl_undo_reopen"));
    } catch (e: any) {
      setError(e.data?.error || e.data?.detail || e.message || t("stl_err_reopen"));
    } finally {
      setSubmitting(false);
    }
  };

  const saveAdjustment = async () => {
    if (!adjustingShift) return;
    setSavingAdjust(true);
    try {
      await api(`/api/accounting/daily-settlements/${adjustingShift.id}/adjust/`, {
        method: "POST",
        body: { actual_cash: Number(adjustCash) || 0 },
      });
      setAdjustingShift(null);
      setAdjustCash("");
      await loadData();
      showSuccess(t("stl_save_adjust"));
    } catch (e: any) {
      showError(e?.message || "Adjustment failed");
    } finally {
      setSavingAdjust(false);
    }
  };

  if (loading) return <Spinner label={t("stl_loading")} />;

  // Helper to extract true date of the shift
  const getShiftTime = (s: Settlement) => {
    const dt = s.closed_at || s.opened_at;
    return new Date(dt).getTime();
  };

  const filteredHistory = filterDate
    ? history.filter((s) => {
        const dt = s.closed_at || s.opened_at;
        return new Date(dt).toLocaleDateString("en-CA") === filterDate;
      })
    : history;

  // STRICT NEWEST ON TOP SORTING (Descending by timestamp)
  const sortedHistory = [...filteredHistory].sort(
    (a, b) => getShiftTime(b) - getShiftTime(a)
  );

  const currentExpected = current ? Number(current.expected_cash) || 0 : 0;
  const currentActual = actualCash !== "" ? Number(actualCash) : 0;
  const currentDiscrepancy = actualCash !== "" ? currentActual - currentExpected : 0;

  return (
    <div className="vstack gap-4">
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row g-4">
        {/* Left Column: Current Active Shift */}
        <div className="col-lg-6">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body p-4">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 className="card-title fw-bold mb-0">{t("stl_current_shift")}</h5>
                {current && current.status === "open" && (
                  <span className="badge text-bg-success py-1 px-2">● Active Shift</span>
                )}
              </div>

              {!current ? (
                <div className="text-center py-5">
                  <div className="display-1 text-muted mb-3">🏪</div>
                  <h4 className="fw-semibold">{t("stl_no_active")}</h4>
                  <p className="text-muted">{t("stl_no_active_desc")}</p>
                  <form onSubmit={openShift} className="mt-4" style={{ maxWidth: "300px", margin: "0 auto" }}>
                    <button type="submit" className="btn btn-brand w-100" disabled={submitting}>
                      {t("stl_start_new")}
                    </button>
                  </form>
                </div>
              ) : current.status === "closed" ? (
                <div>
                  <div className="alert alert-success mb-4">
                    <h5 className="alert-heading fw-bold mb-1">{t("stl_closed_title")}</h5>
                    <p className="mb-0 small">
                      {t("stl_closed_desc", { time: new Date(current.closed_at!).toLocaleTimeString() })}
                    </p>
                  </div>

                  <div className="row g-3 mb-4">
                    <div className="col-4">
                      <div className="bg-light rounded p-3 text-center border">
                        <div className="small text-uppercase fw-semibold mb-1 text-muted">{t("stl_expected")}</div>
                        <div className="fs-5 fw-bold text-dark">{money(current.expected_cash)}</div>
                      </div>
                    </div>
                    <div className="col-4">
                      <div className="bg-light rounded p-3 text-center border">
                        <div className="small text-uppercase fw-semibold mb-1 text-muted">{t("stl_actual_counted")}</div>
                        <div className="fs-5 fw-bold text-dark">{money(current.actual_cash)}</div>
                      </div>
                    </div>
                    <div className="col-4">
                      <div
                        className={`rounded p-3 text-center border ${
                          parseFloat(current.discrepancy) < 0
                            ? "bg-danger bg-opacity-10 border-danger"
                            : "bg-success bg-opacity-10 border-success"
                        }`}
                      >
                        <div className="small text-uppercase fw-semibold mb-1">{t("stl_discrepancy")}</div>
                        <div className="fs-5 fw-bold">
                          {parseFloat(current.discrepancy) > 0 ? "+" : ""}
                          {money(current.discrepancy)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="d-flex justify-content-end mt-2">
                    <button
                      onClick={reopenShift}
                      className="btn btn-outline-danger btn-sm d-flex align-items-center gap-2"
                      disabled={submitting}
                    >
                      <i className="bi bi-arrow-counterclockwise"></i> {t("stl_undo_reopen")}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-secondary small mb-3">
                    📅 {t("stl_opened_at")} {new Date(current.opened_at).toLocaleDateString()} {new Date(current.opened_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>

                  {/* Expected Cash Box */}
                  <div className="bg-primary bg-opacity-10 rounded-3 p-4 text-center border border-primary border-opacity-25 mb-3">
                    <div className="text-primary small text-uppercase fw-bold mb-1">{t("stl_expected_cash")}</div>
                    <div className="display-6 fw-bold text-primary mb-1">{money(current.expected_cash)}</div>
                    <div className="text-muted small">আজকের ক্যাশ আগমন ও খরচের নিট হিসাব</div>
                  </div>

                  {/* Cash Flow Breakdown Box */}
                  <div className="bg-light rounded-3 p-3 border mb-4">
                    <div className="fw-semibold small text-uppercase text-secondary mb-2">{t("stl_cash_breakdown")}</div>
                    <div className="d-flex justify-content-between py-1 border-bottom small">
                      <span className="text-success fw-medium">{t("stl_cash_in")}</span>
                      <span className="text-success fw-bold">+{money(current.cash_in || 0)}</span>
                    </div>
                    <div className="d-flex justify-content-between py-1 border-bottom small">
                      <span className="text-danger fw-medium">{t("stl_cash_out")}</span>
                      <span className="text-danger fw-bold">-{money(current.cash_out || 0)}</span>
                    </div>
                    <div className="d-flex justify-content-between pt-2 small fw-bold">
                      <span>নিট ক্যাশ ব্যালেন্স (Net Expected):</span>
                      <span className="text-brand">{money(Math.max(0, currentExpected))}</span>
                    </div>
                  </div>

                  {/* Denomination Calculator Toggle */}
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <label className="form-label fw-bold mb-0">{t("stl_counted_cash")}</label>
                    <button
                      type="button"
                      className="btn btn-outline-brand btn-sm py-1"
                      onClick={() => setShowCalculator(!showCalculator)}
                    >
                      {t("stl_cash_calc_title")} {showCalculator ? "▲" : "▼"}
                    </button>
                  </div>

                  {/* Denomination Calculator Accordion */}
                  {showCalculator && (
                    <div className="card card-body bg-light border p-3 mb-3">
                      <div className="row g-2">
                        <div className="col-6">
                          <label className="small text-secondary mb-1">{t("stl_note_1000")}</label>
                          <input
                            type="number"
                            min="0"
                            className="form-control form-control-sm"
                            placeholder="Qty"
                            value={notes.n1000}
                            onChange={(e) => setNotes({ ...notes, n1000: e.target.value })}
                          />
                        </div>
                        <div className="col-6">
                          <label className="small text-secondary mb-1">{t("stl_note_500")}</label>
                          <input
                            type="number"
                            min="0"
                            className="form-control form-control-sm"
                            placeholder="Qty"
                            value={notes.n500}
                            onChange={(e) => setNotes({ ...notes, n500: e.target.value })}
                          />
                        </div>
                        <div className="col-6">
                          <label className="small text-secondary mb-1">{t("stl_note_200")}</label>
                          <input
                            type="number"
                            min="0"
                            className="form-control form-control-sm"
                            placeholder="Qty"
                            value={notes.n200}
                            onChange={(e) => setNotes({ ...notes, n200: e.target.value })}
                          />
                        </div>
                        <div className="col-6">
                          <label className="small text-secondary mb-1">{t("stl_note_100")}</label>
                          <input
                            type="number"
                            min="0"
                            className="form-control form-control-sm"
                            placeholder="Qty"
                            value={notes.n100}
                            onChange={(e) => setNotes({ ...notes, n100: e.target.value })}
                          />
                        </div>
                        <div className="col-6">
                          <label className="small text-secondary mb-1">{t("stl_note_50")}</label>
                          <input
                            type="number"
                            min="0"
                            className="form-control form-control-sm"
                            placeholder="Qty"
                            value={notes.n50}
                            onChange={(e) => setNotes({ ...notes, n50: e.target.value })}
                          />
                        </div>
                        <div className="col-6">
                          <label className="small text-secondary mb-1">{t("stl_note_20")}</label>
                          <input
                            type="number"
                            min="0"
                            className="form-control form-control-sm"
                            placeholder="Qty"
                            value={notes.n20}
                            onChange={(e) => setNotes({ ...notes, n20: e.target.value })}
                          />
                        </div>
                        <div className="col-6">
                          <label className="small text-secondary mb-1">{t("stl_note_10")}</label>
                          <input
                            type="number"
                            min="0"
                            className="form-control form-control-sm"
                            placeholder="Qty"
                            value={notes.n10}
                            onChange={(e) => setNotes({ ...notes, n10: e.target.value })}
                          />
                        </div>
                        <div className="col-6">
                          <label className="small text-secondary mb-1">{t("stl_coins")}</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-control form-control-sm"
                            placeholder="৳ Amount"
                            value={notes.coins}
                            onChange={(e) => setNotes({ ...notes, coins: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                        <span className="fw-bold">মোট: {money(calcDenominationTotal())}</span>
                        <button type="button" className="btn btn-brand btn-sm" onClick={applyCalculatedCash}>
                          {t("stl_apply_count")}
                        </button>
                      </div>
                    </div>
                  )}

                  <form onSubmit={closeShift}>
                    <div className="input-group input-group-lg mb-3">
                      <span className="input-group-text">৳</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-control fw-bold fs-4"
                        value={actualCash}
                        onChange={(e) => setActualCash(e.target.value)}
                        placeholder="0.00"
                        required
                      />
                    </div>

                    {actualCash !== "" && (
                      <div
                        className={`alert mb-3 py-2 ${
                          currentDiscrepancy < 0 ? "alert-danger" : "alert-success"
                        }`}
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <span className="fw-semibold">{t("stl_discrepancy")}:</span>
                          <span className="fw-bold fs-5">
                            {currentDiscrepancy > 0 ? "+" : ""}
                            {money(currentDiscrepancy)}
                          </span>
                        </div>
                      </div>
                    )}

                    <button type="submit" className="btn btn-brand btn-lg w-100" disabled={submitting}>
                      {t("stl_close_shift")}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Shift History */}
        <div className="col-lg-6">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body p-4">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <h5 className="card-title fw-bold mb-0">{t("stl_history_title")}</h5>
                <div className="d-flex align-items-center gap-2">
                  <span className="small text-secondary">{t("stl_col_date")}:</span>
                  <input
                    type="date"
                    className="form-control form-control-sm w-auto"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                  />
                </div>
              </div>

              {sortedHistory.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  {filterDate ? t("stl_no_shifts_date", { date: filterDate }) : t("stl_no_past")}
                </div>
              ) : (
                <div className="table-responsive" style={{ maxHeight: "560px", overflowY: "auto" }}>
                  <table className="table table-hover align-middle mb-0">
                    <thead className="sticky-top bg-white">
                      <tr className="text-secondary small text-uppercase">
                        <th>{t("stl_col_date")}</th>
                        <th className="text-end">{t("stl_expected")}</th>
                        <th className="text-end">{t("stl_col_actual")}</th>
                        <th className="text-end">{t("stl_col_diff")}</th>
                        <th>{t("stl_col_closed_by")}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedHistory.map((s) => {
                        const shiftDate = s.closed_at || s.opened_at;
                        return (
                          <tr key={s.id}>
                            <td>
                              <div className="fw-medium">{fmtDate(shiftDate)}</div>
                              <div className="small text-secondary">
                                {s.closed_at
                                  ? new Date(s.closed_at).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : ""}
                              </div>
                            </td>
                            <td className="text-end">{money(s.expected_cash)}</td>
                            <td className="text-end fw-semibold">{money(s.actual_cash)}</td>
                            <td
                              className={`text-end fw-bold ${
                                parseFloat(s.discrepancy) < 0 ? "text-danger" : "text-success"
                              }`}
                            >
                              {parseFloat(s.discrepancy) > 0 ? "+" : ""}
                              {money(s.discrepancy)}
                            </td>
                            <td className="small text-secondary">{s.closed_by_name || "Admin"}</td>
                            <td className="text-end">
                              <button
                                className="btn btn-outline-secondary btn-sm py-0 px-2"
                                style={{ fontSize: "0.75rem" }}
                                onClick={() => {
                                  setAdjustingShift(s);
                                  setAdjustCash(s.actual_cash);
                                }}
                              >
                                {t("stl_adjust_shift")}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Adjust Modal */}
      {adjustingShift && (
        <>
          <div className="modal-backdrop fade show"></div>
          <div className="modal d-block" tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">{t("stl_adjust_title")}</h5>
                  <button type="button" className="btn-close" onClick={() => setAdjustingShift(null)}></button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <span className="small text-secondary">তারিখ: </span>
                    <strong>{fmtDate(adjustingShift.closed_at || adjustingShift.opened_at)}</strong>
                  </div>
                  <div className="d-flex justify-content-between p-2 bg-light rounded border mb-3 small">
                    <span>{t("stl_expected_cash")}:</span>
                    <span className="fw-bold">{money(adjustingShift.expected_cash)}</span>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">{t("stl_actual_counted")}</label>
                    <div className="input-group">
                      <span className="input-group-text">৳</span>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control fw-bold"
                        value={adjustCash}
                        onChange={(e) => setAdjustCash(e.target.value)}
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>
                  {adjustCash !== "" && (
                    <div
                      className={`alert py-2 mb-0 ${
                        Number(adjustCash) - Number(adjustingShift.expected_cash) < 0
                          ? "alert-danger"
                          : "alert-success"
                      }`}
                    >
                      <div className="d-flex justify-content-between small">
                        <span>{t("stl_discrepancy")}:</span>
                        <span className="fw-bold">
                          {Number(adjustCash) - Number(adjustingShift.expected_cash) > 0 ? "+" : ""}
                          {money(Number(adjustCash) - Number(adjustingShift.expected_cash))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-light border"
                    onClick={() => setAdjustingShift(null)}
                    disabled={savingAdjust}
                  >
                    বাতিল
                  </button>
                  <button
                    type="button"
                    className="btn btn-brand"
                    onClick={saveAdjustment}
                    disabled={savingAdjust}
                  >
                    {savingAdjust ? "সংরক্ষণ হচ্ছে..." : t("stl_save_adjust")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
