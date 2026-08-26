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
  expected_investment?: string;
  actual_investment?: string;
  investment_discrepancy?: string;
  total_purchases?: string;
  total_capital_investment?: string;
  cash_in?: number;
  cash_out?: number;
  sales_total?: number;
  expenses_total?: number;
  refunds_total?: number;
  purchases_total?: number;
  capital_investments_total?: number;
  status: "open" | "closed";
  closed_by_name: string | null;
};

export default function DailySettlementPage() {
  const { t, lang } = useLanguage();
  const [current, setCurrent] = useState<Settlement | null>(null);
  const [history, setHistory] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  // Closing Shift States (Dual Settle)
  const [actualCash, setActualCash] = useState("");
  const [actualInvestment, setActualInvestment] = useState("");
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
  const [adjustInvestment, setAdjustInvestment] = useState("");
  const [savingAdjust, setSavingAdjust] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const cur = await api<Settlement | null>("/api/accounting/daily-settlements/current/");
      setCurrent(cur || null);
      if (cur && cur.status === "open") {
        if (cur.expected_investment !== undefined) {
          setActualInvestment(String(Number(cur.expected_investment) || 0));
        }
      }

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
        body: {
          actual_cash: actualCash || "0",
          actual_investment: actualInvestment !== "" ? actualInvestment : (current?.expected_investment || "0"),
        },
      });
      setActualCash("");
      setActualInvestment("");
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
        body: {
          actual_cash: Number(adjustCash) || 0,
          actual_investment: Number(adjustInvestment) || 0,
        },
      });
      setAdjustingShift(null);
      setAdjustCash("");
      setAdjustInvestment("");
      await loadData();
      showSuccess(t("stl_save_adjust"));
    } catch (e: any) {
      showError(e?.message || "Adjustment failed");
    } finally {
      setSavingAdjust(false);
    }
  };

  if (loading) return <Spinner label={t("stl_loading")} />;

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

  const sortedHistory = [...filteredHistory].sort(
    (a, b) => getShiftTime(b) - getShiftTime(a)
  );

  const currentExpectedCash = current ? Number(current.expected_cash) || 0 : 0;
  const currentActualCash = actualCash !== "" ? Number(actualCash) : 0;
  const currentCashDiscrepancy = actualCash !== "" ? currentActualCash - currentExpectedCash : 0;

  const currentExpectedInv = current ? Number(current.expected_investment) || 0 : 0;
  const currentActualInv = actualInvestment !== "" ? Number(actualInvestment) : currentExpectedInv;
  const currentInvDiscrepancy = actualInvestment !== "" ? currentActualInv - currentExpectedInv : 0;

  return (
    <div className="vstack gap-4">
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row g-4">
        {/* Left Column: Current Active Shift with Dual Settlement */}
        <div className="col-lg-6">
          <div className="card shadow-sm border-0 h-100 rounded-3">
            <div className="card-body p-4">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div>
                  <h5 className="card-title fw-bold mb-0">{t("stl_current_shift")}</h5>
                  <div className="text-secondary small mt-0.5">{t("stl_dual_settle_desc")}</div>
                </div>
                {current && current.status === "open" && (
                  <span className="badge bg-success bg-opacity-15 text-success border border-success border-opacity-25 py-1.5 px-2.5 rounded-pill fw-bold">
                    ● {lang === "bn" ? "চলমান শিফট" : "Active Shift"}
                  </span>
                )}
              </div>

              {!current ? (
                <div className="text-center py-5">
                  <div className="display-1 text-muted mb-3">🏪</div>
                  <h4 className="fw-semibold">{t("stl_no_active")}</h4>
                  <p className="text-muted">{t("stl_no_active_desc")}</p>
                  <form onSubmit={openShift} className="mt-4" style={{ maxWidth: "300px", margin: "0 auto" }}>
                    <button type="submit" className="btn btn-brand w-100 fw-bold" disabled={submitting}>
                      {t("stl_start_new")}
                    </button>
                  </form>
                </div>
              ) : current.status === "closed" ? (
                <div>
                  <div className="alert alert-success mb-4 rounded-3 border-0 bg-success bg-opacity-10 text-success">
                    <h5 className="alert-heading fw-bold mb-1">{t("stl_closed_title")}</h5>
                    <p className="mb-0 small">
                      {t("stl_closed_desc", { time: new Date(current.closed_at!).toLocaleTimeString() })}
                    </p>
                  </div>

                  {/* Closed Cash in Drawer Summary */}
                  <div className="card border rounded-3 p-3 mb-3 bg-light">
                    <div className="fw-bold small text-secondary text-uppercase mb-2">
                      💵 {t("stl_drawer_cash")}
                    </div>
                    <div className="row g-2 text-center">
                      <div className="col-4">
                        <div className="bg-white rounded p-2 border">
                          <div className="small text-muted">{t("stl_expected")}</div>
                          <div className="fw-bold text-dark fs-6">{money(current.expected_cash)}</div>
                        </div>
                      </div>
                      <div className="col-4">
                        <div className="bg-white rounded p-2 border">
                          <div className="small text-muted">{t("stl_actual_counted")}</div>
                          <div className="fw-bold text-dark fs-6">{money(current.actual_cash)}</div>
                        </div>
                      </div>
                      <div className="col-4">
                        <div className={`rounded p-2 border ${parseFloat(current.discrepancy) < 0 ? "bg-danger bg-opacity-10 border-danger text-danger" : "bg-success bg-opacity-10 border-success text-success"}`}>
                          <div className="small fw-semibold">{t("stl_discrepancy")}</div>
                          <div className="fw-bold fs-6">
                            {parseFloat(current.discrepancy) > 0 ? "+" : ""}
                            {money(current.discrepancy)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Closed Daily Investment Summary */}
                  <div className="card border rounded-3 p-3 mb-4 bg-light">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <div className="fw-bold small text-secondary text-uppercase">
                        💼 {t("stl_daily_investment")}
                      </div>
                      <div className="small text-muted">
                        📦 {t("stl_purchases_sub")}: {money(current.total_purchases || 0)} · 🤝 {t("stl_capital_sub")}: {money(current.total_capital_investment || 0)}
                      </div>
                    </div>
                    <div className="row g-2 text-center">
                      <div className="col-4">
                        <div className="bg-white rounded p-2 border">
                          <div className="small text-muted">{t("stl_expected")}</div>
                          <div className="fw-bold text-primary fs-6">{money(current.expected_investment || 0)}</div>
                        </div>
                      </div>
                      <div className="col-4">
                        <div className="bg-white rounded p-2 border">
                          <div className="small text-muted">{t("stl_actual_counted")}</div>
                          <div className="fw-bold text-primary fs-6">{money(current.actual_investment || 0)}</div>
                        </div>
                      </div>
                      <div className="col-4">
                        <div className={`rounded p-2 border ${parseFloat(current.investment_discrepancy || "0") < 0 ? "bg-danger bg-opacity-10 border-danger text-danger" : "bg-success bg-opacity-10 border-success text-success"}`}>
                          <div className="small fw-semibold">{t("stl_inv_discrepancy")}</div>
                          <div className="fw-bold fs-6">
                            {parseFloat(current.investment_discrepancy || "0") > 0 ? "+" : ""}
                            {money(current.investment_discrepancy || 0)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="d-flex justify-content-end">
                    <button
                      onClick={reopenShift}
                      className="btn btn-outline-danger btn-sm d-flex align-items-center gap-2 fw-semibold"
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

                  <form onSubmit={closeShift}>
                    {/* 1. SETTLE AMOUNT 1: CASH IN DRAWER */}
                    <div className="card border rounded-3 p-3 mb-3 bg-light">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="fw-bold text-dark small text-uppercase">
                          1️⃣ 💵 {t("stl_drawer_cash")}
                        </span>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm py-0.5 px-2"
                          style={{ fontSize: "0.75rem" }}
                          onClick={() => setShowCalculator(!showCalculator)}
                        >
                          {t("stl_cash_calc_title")} {showCalculator ? "▲" : "▼"}
                        </button>
                      </div>

                      {/* Cash Breakdown */}
                      <div className="bg-white rounded p-2.5 border mb-3">
                        <div className="d-flex justify-content-between small py-1 border-bottom">
                          <span className="text-muted">প্রত্যাশিত ক্যাশ ড্রয়ার (Expected Drawer Cash):</span>
                          <span className="fw-bold text-primary">{money(current.expected_cash)}</span>
                        </div>
                        <div className="d-flex justify-content-between small py-1 text-muted">
                          <span>ক্যাশ আগমন: <span className="text-success fw-bold">+{money(current.cash_in || 0)}</span></span>
                          <span>ক্যাশ খরচ: <span className="text-danger fw-bold">-{money(current.cash_out || 0)}</span></span>
                        </div>
                      </div>

                      {/* Denomination Calculator Drawer */}
                      {showCalculator && (
                        <div className="card card-body bg-white border p-3 mb-3">
                          <div className="row g-2">
                            <div className="col-6 col-sm-3">
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
                            <div className="col-6 col-sm-3">
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
                            <div className="col-6 col-sm-3">
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
                            <div className="col-6 col-sm-3">
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
                            <div className="col-6 col-sm-3">
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
                            <div className="col-6 col-sm-3">
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
                            <div className="col-6 col-sm-3">
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
                            <div className="col-6 col-sm-3">
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
                            <span className="fw-bold small">মোট: {money(calcDenominationTotal())}</span>
                            <button type="button" className="btn btn-primary btn-sm py-1" onClick={applyCalculatedCash}>
                              {t("stl_apply_count")}
                            </button>
                          </div>
                        </div>
                      )}

                      <label className="form-label small fw-bold text-dark mb-1">
                        {t("stl_counted_cash")} (৳) <span className="text-danger">*</span>
                      </label>
                      <div className="input-group mb-2">
                        <span className="input-group-text bg-white fw-bold">৳</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="form-control form-control-lg fw-bold"
                          value={actualCash}
                          onChange={(e) => setActualCash(e.target.value)}
                          placeholder="0.00"
                          required
                        />
                      </div>

                      {actualCash !== "" && (
                        <div
                          className={`alert py-1.5 px-3 mb-0 small rounded ${
                            currentCashDiscrepancy < 0 ? "alert-danger" : "alert-success"
                          }`}
                        >
                          <div className="d-flex justify-content-between align-items-center">
                            <span className="fw-semibold">{t("stl_discrepancy")}:</span>
                            <span className="fw-bold">
                              {currentCashDiscrepancy > 0 ? "+" : ""}
                              {money(currentCashDiscrepancy)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 2. SETTLE AMOUNT 2: DAILY INVESTMENT */}
                    <div className="card border rounded-3 p-3 mb-4 bg-light">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="fw-bold text-dark small text-uppercase">
                          2️⃣ 💼 {t("stl_daily_investment")}
                        </span>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm py-0.5 px-2"
                          style={{ fontSize: "0.75rem" }}
                          onClick={() => setActualInvestment(String(currentExpectedInv))}
                        >
                          {t("stl_btn_match_expected")}
                        </button>
                      </div>

                      <div className="bg-white rounded p-2.5 border mb-3">
                        <div className="d-flex justify-content-between small py-1 border-bottom">
                          <span className="text-muted">{t("stl_expected_inv")}:</span>
                          <span className="fw-bold text-primary">{money(current.expected_investment || 0)}</span>
                        </div>
                        <div className="d-flex justify-content-between small py-1 text-muted">
                          <span>📦 {t("stl_purchases_sub")}: <span className="text-dark fw-semibold">{money(current.purchases_total || 0)}</span></span>
                          <span>🤝 {t("stl_capital_sub")}: <span className="text-dark fw-semibold">{money(current.capital_investments_total || 0)}</span></span>
                        </div>
                      </div>

                      <label className="form-label small fw-bold text-dark mb-1">
                        {t("stl_counted_inv")} (৳) <span className="text-danger">*</span>
                      </label>
                      <div className="input-group mb-2">
                        <span className="input-group-text bg-white fw-bold">৳</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="form-control form-control-lg fw-bold text-primary"
                          value={actualInvestment}
                          onChange={(e) => setActualInvestment(e.target.value)}
                          placeholder="0.00"
                          required
                        />
                      </div>

                      {actualInvestment !== "" && (
                        <div
                          className={`alert py-1.5 px-3 mb-0 small rounded ${
                            currentInvDiscrepancy < 0 ? "alert-danger" : "alert-success"
                          }`}
                        >
                          <div className="d-flex justify-content-between align-items-center">
                            <span className="fw-semibold">{t("stl_inv_discrepancy")}:</span>
                            <span className="fw-bold">
                              {currentInvDiscrepancy > 0 ? "+" : ""}
                              {money(currentInvDiscrepancy)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <button type="submit" className="btn btn-brand btn-lg w-100 fw-bold shadow-sm" disabled={submitting}>
                      {submitting ? "Closing Shift..." : `🔒 ${t("stl_close_shift")}`}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Shift History Table */}
        <div className="col-lg-6">
          <div className="card shadow-sm border-0 h-100 rounded-3">
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
                <div className="table-responsive" style={{ maxHeight: "600px", overflowY: "auto" }}>
                  <table className="table table-hover align-middle mb-0">
                    <thead className="sticky-top bg-white border-bottom">
                      <tr className="text-secondary small text-uppercase" style={{ fontSize: "0.75rem" }}>
                        <th>{t("stl_col_date")}</th>
                        <th className="text-end">💵 {t("stl_drawer_cash")}</th>
                        <th className="text-end">💼 {t("stl_daily_investment")}</th>
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
                              <div className="fw-semibold text-dark">{fmtDate(shiftDate)}</div>
                              <div className="small text-secondary" style={{ fontSize: "0.72rem" }}>
                                {s.closed_at
                                  ? new Date(s.closed_at).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : ""}
                              </div>
                            </td>
                            <td className="text-end">
                              <div className="fw-bold text-dark">{money(s.actual_cash)}</div>
                              <div
                                className="small fw-semibold"
                                style={{
                                  fontSize: "0.72rem",
                                  color: parseFloat(s.discrepancy) < 0 ? "#dc3545" : "#198754",
                                }}
                              >
                                {parseFloat(s.discrepancy) > 0 ? "+" : ""}
                                {money(s.discrepancy)}
                              </div>
                            </td>
                            <td className="text-end">
                              <div className="fw-bold text-primary">{money(s.actual_investment || 0)}</div>
                              <div
                                className="small"
                                style={{
                                  fontSize: "0.72rem",
                                  color: parseFloat(s.investment_discrepancy || "0") < 0 ? "#dc3545" : "#6c757d",
                                }}
                              >
                                {parseFloat(s.investment_discrepancy || "0") > 0 ? "+" : ""}
                                {money(s.investment_discrepancy || 0)}
                              </div>
                            </td>
                            <td className="small text-secondary">{s.closed_by_name || "Admin"}</td>
                            <td className="text-end">
                              <button
                                className="btn btn-outline-secondary btn-sm py-0.5 px-2"
                                style={{ fontSize: "0.75rem" }}
                                onClick={() => {
                                  setAdjustingShift(s);
                                  setAdjustCash(s.actual_cash);
                                  setAdjustInvestment(s.actual_investment || "0");
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

      {/* Adjust Modal (Dual Adjustment) */}
      {adjustingShift && (
        <>
          <div className="modal-backdrop fade show"></div>
          <div className="modal d-block" tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                <div className="modal-header bg-light py-3 px-4">
                  <h5 className="modal-title fw-bold mb-0">{t("stl_adjust_title")}</h5>
                  <button type="button" className="btn-close" onClick={() => setAdjustingShift(null)}></button>
                </div>
                <div className="modal-body p-4 vstack gap-3">
                  <div>
                    <span className="small text-secondary">তারিখ: </span>
                    <strong className="text-dark">{fmtDate(adjustingShift.closed_at || adjustingShift.opened_at)}</strong>
                  </div>

                  {/* Cash in Drawer Adjustment */}
                  <div className="card p-3 border rounded-3 bg-light">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="fw-bold small text-dark">💵 {t("stl_drawer_cash")}</span>
                      <span className="small text-muted">{t("stl_expected")}: {money(adjustingShift.expected_cash)}</span>
                    </div>
                    <div className="input-group">
                      <span className="input-group-text bg-white">৳</span>
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
                    {adjustCash !== "" && (
                      <div className="small mt-1 text-end fw-semibold" style={{ color: Number(adjustCash) - Number(adjustingShift.expected_cash) < 0 ? "#dc3545" : "#198754" }}>
                        Diff: {Number(adjustCash) - Number(adjustingShift.expected_cash) > 0 ? "+" : ""}{money(Number(adjustCash) - Number(adjustingShift.expected_cash))}
                      </div>
                    )}
                  </div>

                  {/* Daily Investment Adjustment */}
                  <div className="card p-3 border rounded-3 bg-light">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="fw-bold small text-dark">💼 {t("stl_daily_investment")}</span>
                      <span className="small text-muted">{t("stl_expected")}: {money(adjustingShift.expected_investment || 0)}</span>
                    </div>
                    <div className="input-group">
                      <span className="input-group-text bg-white">৳</span>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control fw-bold text-primary"
                        value={adjustInvestment}
                        onChange={(e) => setAdjustInvestment(e.target.value)}
                        placeholder="0.00"
                        required
                      />
                    </div>
                    {adjustInvestment !== "" && (
                      <div className="small mt-1 text-end fw-semibold" style={{ color: Number(adjustInvestment) - Number(adjustingShift.expected_investment || 0) < 0 ? "#dc3545" : "#198754" }}>
                        Diff: {Number(adjustInvestment) - Number(adjustingShift.expected_investment || 0) > 0 ? "+" : ""}{money(Number(adjustInvestment) - Number(adjustingShift.expected_investment || 0))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="modal-footer bg-light py-2.5 px-4">
                  <button
                    type="button"
                    className="btn btn-light border fw-semibold"
                    onClick={() => setAdjustingShift(null)}
                    disabled={savingAdjust}
                  >
                    বাতিল
                  </button>
                  <button
                    type="button"
                    className="btn btn-brand fw-bold px-4"
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

