"use client";

import { useEffect, useState, useMemo } from "react";
import { api, fetchAll } from "@/lib/api";
import { Card, ErrorState, Spinner, money, usePagination, Pagination } from "@/components/ui";
import { useLanguage } from "@/contexts/LanguageContext";
import toast from "react-hot-toast";

type Profit = {
  revenue: string;
  returns: string;
  cogs: string;
  gross_profit: string;
  expenses: string;
  net_profit: string;
  sales_count: number;
  payment_methods?: Record<string, string>;
};

type Position = {
  cash_balance: string | number;
  bkash_balance?: string | number;
  nagad_balance?: string | number;
  bank_balance: string | number;
  card_balance?: string | number;
  total_liquid_cash?: string | number;
  receivables: string | number;
  payables: string | number;
  total_investment?: string | number;
  capital_investment?: string | number;
  owner_drawings?: string | number;
  net_capital?: string | number;
  purchase_investment?: string | number;
  investors_count?: number;
};

type Investment = {
  id: number;
  investor_name: string;
  type: "capital" | "drawing" | "loan" | "equity" | "other";
  type_display?: string;
  amount: string;
  invested_on: string;
  payment_method: string;
  reference: string;
  note: string;
  created_by_name?: string;
  created_at?: string;
};

type AccountTransfer = {
  id: number;
  from_account: string;
  from_account_display?: string;
  to_account: string;
  to_account_display?: string;
  amount: string;
  transferred_on: string;
  reference: string;
  note: string;
  created_by_name?: string;
  created_at?: string;
};

type InvestmentSummary = {
  capital_investment: string | number;
  owner_drawings?: string | number;
  net_capital?: string | number;
  purchase_investment: string | number;
  total_investment: string | number;
  investors_count: number;
  by_type?: Record<string, string | number>;
  purchases_count?: number;
};

type PurchaseOrder = {
  id: number;
  po_number: string;
  supplier_name?: string;
  total_amount: string;
  status: string;
  payment_status: string;
  created_at: string;
};

export default function AccountingPage() {
  const { t, lang } = useLanguage();
  const [activeTab, setActiveTab] = useState<"overview" | "investment" | "transfers">("overview");

  // Overview states
  const [profit, setProfit] = useState<Profit | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Running date by default
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  // Investment states
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [invSummary, setInvSummary] = useState<InvestmentSummary | null>(null);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [invSearch, setInvSearch] = useState("");
  const [invTypeFilter, setInvTypeFilter] = useState("all");
  const [invLoading, setInvLoading] = useState(false);

  // Transfers states
  const [transfers, setTransfers] = useState<AccountTransfer[]>([]);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferForm, setTransferForm] = useState({
    from_account: "cash",
    to_account: "bkash",
    amount: "",
    transferred_on: today,
    reference: "",
    note: "",
  });

  // Investment Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingInv, setEditingInv] = useState<Investment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    investor_name: "",
    type: "capital" as "capital" | "drawing" | "loan" | "equity" | "other",
    amount: "",
    invested_on: today,
    payment_method: "cash",
    reference: "",
    note: "",
  });

  // Load Overview Data
  async function loadOverview() {
    setLoading(true);
    try {
      const startStr = startDate ? startDate + "T00:00:00Z" : "";
      const endStr = endDate ? endDate + "T23:59:59Z" : "";
      const [p, pos] = await Promise.all([
        api<Profit>("/accounting/reports/profit/", { params: { start: startStr, end: endStr } }),
        api<Position>("/accounting/reports/position/"),
      ]);
      setProfit(p);
      setPosition(pos);
    } catch (e: any) {
      setError(e?.message || t("acc_err_load"));
    } finally {
      setLoading(false);
    }
  }

  // Load Investment Data
  async function loadInvestments() {
    setInvLoading(true);
    try {
      const [invList, summaryData, poList] = await Promise.all([
        fetchAll<Investment>("/accounting/investments/"),
        api<InvestmentSummary>("/accounting/investments/summary/"),
        fetchAll<PurchaseOrder>("/purchasing/orders/").catch(() => []),
      ]);
      setInvestments(invList || []);
      setInvSummary(summaryData);
      setPurchases((poList || []).filter((po) => po.status !== "cancelled"));
    } catch (e: any) {
      toast.error(e?.message || "Failed to load investments");
    } finally {
      setInvLoading(false);
    }
  }

  // Load Transfers Data
  async function loadTransfers() {
    try {
      const tList = await fetchAll<AccountTransfer>("/accounting/transfers/");
      setTransfers(tList || []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load transfers");
    }
  }

  useEffect(() => {
    loadOverview();
  }, [startDate, endDate]);

  useEffect(() => {
    loadInvestments();
    loadTransfers();
  }, []);

  // Filter Investments
  const filteredInvestments = useMemo(() => {
    return investments.filter((inv) => {
      const matchSearch =
        !invSearch.trim() ||
        inv.investor_name.toLowerCase().includes(invSearch.toLowerCase()) ||
        inv.reference?.toLowerCase().includes(invSearch.toLowerCase()) ||
        inv.note?.toLowerCase().includes(invSearch.toLowerCase());
      const matchType = invTypeFilter === "all" || inv.type === invTypeFilter;
      return matchSearch && matchType;
    });
  }, [investments, invSearch, invTypeFilter]);

  const { paged, page, setPage, totalPages, total } = usePagination(filteredInvestments, [
    invSearch,
    invTypeFilter,
    investments,
  ]);

  // Open Modal to Add Investment
  function openAddModal() {
    setEditingInv(null);
    setForm({
      investor_name: "",
      type: "capital",
      amount: "",
      invested_on: today,
      payment_method: "cash",
      reference: "",
      note: "",
    });
    setModalOpen(true);
  }

  // Open Modal to Edit Investment
  function openEditModal(inv: Investment) {
    setEditingInv(inv);
    setForm({
      investor_name: inv.investor_name,
      type: inv.type,
      amount: inv.amount,
      invested_on: inv.invested_on || today,
      payment_method: inv.payment_method || "cash",
      reference: inv.reference || "",
      note: inv.note || "",
    });
    setModalOpen(true);
  }

  // Save Investment
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.investor_name.trim()) {
      toast.error(lang === "bn" ? "বিনিয়োগকারীর নাম লিখুন" : "Please enter investor name");
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error(lang === "bn" ? "সঠিক পরিমাণ লিখুন" : "Please enter valid amount");
      return;
    }

    setSubmitting(true);
    try {
      if (editingInv) {
        await api(`/accounting/investments/${editingInv.id}/`, {
          method: "PUT",
          body: form,
        });
        toast.success(lang === "bn" ? "বিনিয়োগ সফলভাবে আপডেট হয়েছে" : "Investment updated successfully");
      } else {
        await api("/accounting/investments/", {
          method: "POST",
          body: form,
        });
        toast.success(lang === "bn" ? "নতুন এন্ট্রি সফলভাবে যুক্ত হয়েছে" : "Recorded successfully");
      }
      setModalOpen(false);
      loadInvestments();
      loadOverview();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save investment");
    } finally {
      setSubmitting(false);
    }
  }

  // Delete Investment
  async function handleDelete(id: number) {
    if (!confirm(lang === "bn" ? "আপনি কি নিশ্চিত এই রেকর্ডটি মুছে ফেলতে চান?" : "Are you sure you want to delete this record?")) {
      return;
    }
    try {
      await api(`/accounting/investments/${id}/`, { method: "DELETE" });
      toast.success(lang === "bn" ? "রেকর্ড মুছে ফেলা হয়েছে" : "Record deleted");
      loadInvestments();
      loadOverview();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete");
    }
  }

  // Save Transfer
  async function handleTransferSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!transferForm.amount || Number(transferForm.amount) <= 0) {
      toast.error(lang === "bn" ? "সঠিক পরিমাণ লিখুন" : "Please enter valid amount");
      return;
    }
    if (transferForm.from_account === transferForm.to_account) {
      toast.error(lang === "bn" ? "উৎস ও গন্তব্য অ্যাকাউন্ট ভিন্ন হতে হবে" : "From and To accounts must be different");
      return;
    }

    setTransferSubmitting(true);
    try {
      await api("/accounting/transfers/", {
        method: "POST",
        body: transferForm,
      });
      toast.success(lang === "bn" ? "অ্যাকাউন্ট ট্রান্সফার সফল হয়েছে" : "Transfer recorded successfully");
      setTransferModalOpen(false);
      setTransferForm({
        from_account: "cash",
        to_account: "bkash",
        amount: "",
        transferred_on: today,
        reference: "",
        note: "",
      });
      loadTransfers();
      loadOverview();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save transfer");
    } finally {
      setTransferSubmitting(false);
    }
  }

  // Delete Transfer
  async function handleTransferDelete(id: number) {
    if (!confirm(lang === "bn" ? "আপনি কি নিশ্চিত এই ট্রান্সফার রেকর্ডটি মুছে ফেলতে চান?" : "Are you sure you want to delete this transfer?")) {
      return;
    }
    try {
      await api(`/accounting/transfers/${id}/`, { method: "DELETE" });
      toast.success(lang === "bn" ? "ট্রান্সফার রেকর্ড মুছে ফেলা হয়েছে" : "Transfer deleted");
      loadTransfers();
      loadOverview();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete transfer");
    }
  }

  return (
    <div className="vstack gap-3 pb-5">
      {/* Header with Title & Tab Switcher */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div>
          <h4 className="fw-bold mb-1 text-dark">
            {activeTab === "overview" ? `📊 ${t("nav_accounting")}` : activeTab === "investment" ? `💼 ${t("invest_title") || "Investment & Drawings"}` : `🔄 ${lang === "bn" ? "অ্যাকাউন্ট ট্রান্সফার" : "Account Transfers"}`}
          </h4>
          <div className="text-secondary small">
            {activeTab === "overview"
              ? (t("acc_desc") || "Profit & loss, actual liquid account balances, and capital overview")
              : activeTab === "investment"
              ? (t("invest_desc") || "Track capital additions, partner equity, and owner drawings.")
              : (lang === "bn" ? "ক্যাশ ড্রয়ার, বিকাশ, ব্যাংক ও নগদ অ্যাকাউন্টের মধ্যকার অভ্যন্তরীণ ফান্ড ট্রান্সফার।" : "Transfer liquid funds between cash drawer, bKash, bank, and Nagad.")}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="btn-group shadow-sm bg-white p-1 rounded-3 border" role="group">
          <button
            type="button"
            className={`btn btn-sm rounded-2 ${activeTab === "overview" ? "btn-brand fw-bold shadow-sm" : "btn-light text-secondary"}`}
            onClick={() => setActiveTab("overview")}
          >
            📊 {t("invest_tab_overview") || "P&L & Position"}
          </button>
          <button
            type="button"
            className={`btn btn-sm rounded-2 ${activeTab === "investment" ? "btn-brand fw-bold shadow-sm" : "btn-light text-secondary"}`}
            onClick={() => setActiveTab("investment")}
          >
            💼 {t("invest_tab_investment") || "Capital & Drawings"}
          </button>
          <button
            type="button"
            className={`btn btn-sm rounded-2 ${activeTab === "transfers" ? "btn-brand fw-bold shadow-sm" : "btn-light text-secondary"}`}
            onClick={() => setActiveTab("transfers")}
          >
            🔄 {lang === "bn" ? "অ্যাকাউন্ট ট্রান্সফার" : "Fund Transfers"}
          </button>
        </div>
      </div>

      {/* ── TAB 1: P&L AND FINANCIAL POSITION ── */}
      {activeTab === "overview" && (
        <div className="vstack gap-3">
          {/* Date Filter Card */}
          <div className="card shadow-sm border-0 bg-white rounded-3">
            <div className="card-body py-3 d-flex flex-wrap align-items-center gap-3">
              <div className="fw-semibold me-auto">{t("acc_date_filter")}</div>
              <div className="d-flex align-items-center gap-2">
                <label className="text-secondary small fw-medium">{t("acc_start_date")}</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="d-flex align-items-center gap-2">
                <label className="text-secondary small fw-medium">{t("acc_end_date")}</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {loading && <Spinner label={t("acc_loading")} />}
          {error && <ErrorState error={error} />}

          {!loading && profit && position && (
            <>
              {/* Overview Stat Cards */}
              <div className="row g-3">
                <div className="col-6 col-lg-3">
                  <Card>
                    <div className="small text-secondary">{t("acc_revenue")}</div>
                    <div className="fs-4 fw-bold">{money(profit?.revenue)}</div>
                  </Card>
                </div>
                <div className="col-6 col-lg-3">
                  <Card>
                    <div className="small text-secondary">{t("acc_gross_profit")}</div>
                    <div className="fs-4 fw-bold text-success">{money(profit?.gross_profit)}</div>
                  </Card>
                </div>
                <div className="col-6 col-lg-3">
                  <Card>
                    <div className="small text-secondary">{t("acc_expenses")}</div>
                    <div className="fs-4 fw-bold text-danger">{money(profit?.expenses)}</div>
                  </Card>
                </div>
                <div className="col-6 col-lg-3">
                  <Card>
                    <div className="small text-secondary">{t("acc_net_profit")}</div>
                    <div className="fs-4 fw-bold text-success">{money(profit?.net_profit)}</div>
                  </Card>
                </div>
              </div>

              {/* Liquid Cash & Capital Highlight Cards */}
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="card shadow-sm border-0 rounded-3 bg-success bg-opacity-10 border-success-subtle p-3 h-100">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="fw-bold text-success-emphasis">💵 {lang === "bn" ? "মোট তরল ক্যাশ ও ফান্ড" : "Total Liquid Money"}</span>
                      <span className="fs-4 fw-bold text-success">{money(position?.total_liquid_cash ?? (Number(position?.cash_balance || 0) + Number(position?.bank_balance || 0)))}</span>
                    </div>
                    <div className="small text-secondary d-flex flex-wrap gap-2 pt-1 border-top border-success-subtle">
                      <span>{lang === "bn" ? "ক্যাশ" : "Cash"}: <strong>{money(position?.cash_balance || 0)}</strong></span>
                      {position?.bkash_balance !== undefined && <span>· bKash: <strong>{money(position?.bkash_balance || 0)}</strong></span>}
                      {position?.nagad_balance !== undefined && <span>· Nagad: <strong>{money(position?.nagad_balance || 0)}</strong></span>}
                      <span>· {lang === "bn" ? "ব্যাংক" : "Bank"}: <strong>{money(position?.bank_balance || 0)}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="card shadow-sm border-0 rounded-3 bg-primary bg-opacity-10 border-primary-subtle p-3 h-100">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="fw-bold text-primary-emphasis">💼 {lang === "bn" ? "নেট মূলধন (ইকুইটি)" : "Net Capital (Equity)"}</span>
                      <span className="fs-4 fw-bold text-primary">{money(position?.net_capital ?? position?.capital_investment ?? 0)}</span>
                    </div>
                    <div className="small text-secondary d-flex flex-wrap gap-2 pt-1 border-top border-primary-subtle">
                      <span>{lang === "bn" ? "বিনিয়োগ" : "Additions"}: <strong>{money(position?.capital_investment || 0)}</strong></span>
                      {position?.owner_drawings !== undefined && Number(position.owner_drawings) > 0 && (
                        <span>· {lang === "bn" ? "উত্তোলন" : "Drawings"}: <strong className="text-danger">-{money(position?.owner_drawings || 0)}</strong></span>
                      )}
                      <span>· {position?.investors_count || 0} {t("invest_investors") || "Investors"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* P&L and Position Tables */}
              <div className="row g-3">
                <div className="col-lg-6">
                  <div className="card shadow-sm border-0 rounded-3 bg-white h-100">
                    <div className="card-body">
                      <div className="fw-semibold mb-3">{t("acc_pl")}</div>
                      <table className="table table-sm mb-0">
                        <tbody>
                          <tr>
                            <td className="text-secondary">{t("acc_revenue")}</td>
                            <td className="text-end">{money(profit?.revenue)}</td>
                          </tr>
                          <tr>
                            <td className="text-secondary">{t("acc_returns")}</td>
                            <td className="text-end">{money(profit?.returns)}</td>
                          </tr>
                          <tr>
                            <td className="text-secondary">{t("acc_cogs")}</td>
                            <td className="text-end">{money(profit?.cogs)}</td>
                          </tr>
                          <tr className="fw-semibold">
                            <td>{t("acc_gross_profit")}</td>
                            <td className="text-end">{money(profit?.gross_profit)}</td>
                          </tr>
                          <tr>
                            <td className="text-secondary">{t("acc_expenses")}</td>
                            <td className="text-end">{money(profit?.expenses)}</td>
                          </tr>
                          <tr className="fw-bold">
                            <td>{t("acc_net_profit")}</td>
                            <td className="text-end text-success">{money(profit?.net_profit)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="col-lg-6">
                  <div className="card shadow-sm border-0 rounded-3 bg-white">
                    <div className="card-body">
                      <div className="fw-semibold mb-3">{t("acc_financial_pos")}</div>
                      <table className="table table-sm mb-0">
                        <tbody>
                          <tr>
                            <td className="text-secondary">💵 {t("acc_cash_bal")}</td>
                            <td className="text-end fw-semibold">{money(position?.cash_balance)}</td>
                          </tr>
                          {position?.bkash_balance !== undefined && Number(position.bkash_balance) !== 0 && (
                            <tr>
                              <td className="text-secondary">📱 bKash Balance</td>
                              <td className="text-end fw-semibold">{money(position?.bkash_balance)}</td>
                            </tr>
                          )}
                          {position?.nagad_balance !== undefined && Number(position.nagad_balance) !== 0 && (
                            <tr>
                              <td className="text-secondary">📱 Nagad Balance</td>
                              <td className="text-end fw-semibold">{money(position?.nagad_balance)}</td>
                            </tr>
                          )}
                          <tr>
                            <td className="text-secondary">🏦 {t("acc_bank_bal")}</td>
                            <td className="text-end fw-semibold">{money(position?.bank_balance)}</td>
                          </tr>
                          <tr className="table-success bg-opacity-25 fw-bold">
                            <td>💰 {lang === "bn" ? "মোট তরল টাকা" : "Total Liquid Cash"}</td>
                            <td className="text-end text-success">{money(position?.total_liquid_cash ?? (Number(position?.cash_balance || 0) + Number(position?.bank_balance || 0)))}</td>
                          </tr>
                          <tr>
                            <td className="text-secondary">📥 {t("acc_receivables")} {lang === "bn" ? "(বাকি পাওনা)" : ""}</td>
                            <td className="text-end">{money(position?.receivables)}</td>
                          </tr>
                          <tr>
                            <td className="text-secondary">📤 {t("acc_payables")} {lang === "bn" ? "(সাপ্লায়ার দেনা)" : ""}</td>
                            <td className="text-end text-danger">{money(position?.payables)}</td>
                          </tr>

                          <tr className="border-top fw-semibold">
                            <td className="text-primary">💼 {lang === "bn" ? "নেট মূলধন (ইকুইটি)" : "Net Capital Equity"}</td>
                            <td className="text-end text-primary fw-bold">{money(position?.net_capital ?? position?.capital_investment ?? 0)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="card shadow-sm border-0 rounded-3 bg-white mt-3">
                    <div className="card-body">
                      <div className="fw-semibold mb-3">{t("acc_payments_col")}</div>
                      {profit?.payment_methods && Object.keys(profit.payment_methods).length > 0 ? (
                        <table className="table table-sm mb-0">
                          <tbody>
                            {Object.entries(profit.payment_methods).map(([method, amount]) => (
                              <tr key={method}>
                                <td className="text-secondary text-capitalize">{method}</td>
                                <td className="text-end">{money(amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="text-secondary small">{t("acc_no_payments")}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB 2: CAPITAL & INVESTMENTS ── */}
      {activeTab === "investment" && (
        <div className="vstack gap-3">
          {/* Summary Stat Cards */}
          <div className="row g-3">
            <div className="col-6 col-lg-3">
              <div className="card shadow-sm border-0 rounded-3 bg-white p-3 h-100 border-start border-4 border-primary">
                <div className="small text-secondary fw-semibold">💼 {t("invest_total") || "Total Business Investment"}</div>
                <div className="fs-4 fw-bold text-primary mt-1">
                  {money(invSummary?.total_investment ?? position?.total_investment ?? 0)}
                </div>
                <div className="small text-muted mt-1" style={{ fontSize: "0.75rem" }}>
                  {lang === "bn" ? "পণ্য ক্রয় + মূলধন" : "Purchases + Net Capital"}
                </div>
              </div>
            </div>

            <div className="col-6 col-lg-3">
              <div className="card shadow-sm border-0 rounded-3 bg-white p-3 h-100 border-start border-4 border-info">
                <div className="small text-secondary fw-semibold">📦 {t("invest_purchases") || "Purchasing Investment"}</div>
                <div className="fs-4 fw-bold text-info mt-1">
                  {money(invSummary?.purchase_investment ?? position?.purchase_investment ?? 0)}
                </div>
                <div className="small text-muted mt-1" style={{ fontSize: "0.75rem" }}>
                  {invSummary?.purchases_count ?? purchases.length} {lang === "bn" ? "টি ক্রয় অর্ডার" : "purchase orders"}
                </div>
              </div>
            </div>

            <div className="col-6 col-lg-3">
              <div className="card shadow-sm border-0 rounded-3 bg-white p-3 h-100 border-start border-4 border-success">
                <div className="small text-secondary fw-semibold">🤝 {t("invest_capital") || "Net Capital"}</div>
                <div className="fs-4 fw-bold text-success mt-1">
                  {money(invSummary?.net_capital ?? position?.net_capital ?? invSummary?.capital_investment ?? position?.capital_investment ?? 0)}
                </div>
                <div className="small text-muted mt-1" style={{ fontSize: "0.75rem" }}>
                  {investments.length} {lang === "bn" ? "টি এন্ট্রি" : "entries"}
                </div>
              </div>
            </div>

            <div className="col-6 col-lg-3">
              <div className="card shadow-sm border-0 rounded-3 bg-white p-3 h-100 border-start border-4 border-warning">
                <div className="small text-secondary fw-semibold">👥 {t("invest_investors") || "Active Investors"}</div>
                <div className="fs-4 fw-bold text-warning mt-1">
                  {invSummary?.investors_count ?? position?.investors_count ?? 0}
                </div>
                <div className="small text-muted mt-1" style={{ fontSize: "0.75rem" }}>
                  {lang === "bn" ? "স্বতন্ত্র পার্টনার/বিনিয়োগকারী" : "Distinct Partners / Investors"}
                </div>
              </div>
            </div>
          </div>

          {/* Action Toolbar Card */}
          <div className="card shadow-sm border-0 rounded-3 bg-white">
            <div className="card-body p-3">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                {/* Search Bar */}
                <div className="flex-grow-1" style={{ minWidth: "240px", maxWidth: "360px" }}>
                  <div className="input-group input-group-sm">
                    <span className="input-group-text bg-light border-end-0">🔍</span>
                    <input
                      type="search"
                      className="form-control border-start-0 ps-0"
                      placeholder={lang === "bn" ? "বিনিয়োগকারী বা রেফারেন্স খুঁজুন..." : "Search investor, reference..."}
                      value={invSearch}
                      onChange={(e) => setInvSearch(e.target.value)}
                    />
                  </div>
                </div>

                {/* Type Filter & Add Button */}
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <select
                    className="form-select form-select-sm"
                    style={{ width: "180px" }}
                    value={invTypeFilter}
                    onChange={(e) => setInvTypeFilter(e.target.value)}
                  >
                    <option value="all">{lang === "bn" ? "সকল ধরন (All Types)" : "All Types"}</option>
                    <option value="capital">{t("invest_type_capital") || "Capital Addition"}</option>
                    <option value="drawing">{lang === "bn" ? "উত্তোলন (Drawings)" : "Owner Withdrawal"}</option>
                    <option value="loan">{t("invest_type_loan") || "Loan"}</option>
                    <option value="equity">{t("invest_type_equity") || "Equity"}</option>
                    <option value="other">{t("invest_type_other") || "Other"}</option>
                  </select>

                  <button
                    type="button"
                    className="btn btn-brand btn-sm fw-bold px-3 shadow-sm d-flex align-items-center gap-1"
                    onClick={openAddModal}
                  >
                    ➕ {t("invest_btn_add") || "Record Capital / Drawing"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Capital Investments Table Card */}
          <div className="card shadow-sm border-0 rounded-3 bg-white overflow-hidden">
            <div className="card-header bg-light py-2.5 px-3 border-0 d-flex justify-content-between align-items-center">
              <span className="fw-bold text-dark small">
                🤝 {lang === "bn" ? "মূলধন ও উত্তোলন এন্ট্রি তালিকা" : "Capital & Drawings Ledger"} ({filteredInvestments.length})
              </span>
            </div>

            {invLoading ? (
              <div className="p-4 text-center">
                <Spinner label={lang === "bn" ? "লোড হচ্ছে..." : "Loading records..."} />
              </div>
            ) : filteredInvestments.length === 0 ? (
              <div className="p-5 text-center text-secondary">
                <div style={{ fontSize: "2.5rem" }}>💼</div>
                <h6 className="mt-2 fw-bold">{lang === "bn" ? "কোনো মূলধন এন্ট্রি পাওয়া যায়নি" : "No capital investment records found"}</h6>
                <p className="small mb-3 text-muted">
                  {lang === "bn" ? "নতুন পার্টনার মূলধন বা উত্তোলন যুক্ত করতে উপরের বাটনে ক্লিক করুন।" : "Click 'Record Capital / Drawing' to log equity contributions or withdrawals."}
                </p>
                <button type="button" className="btn btn-sm btn-brand fw-semibold" onClick={openAddModal}>
                  ➕ {t("invest_btn_add") || "Record Entry"}
                </button>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr className="small text-secondary">
                      <th>#</th>
                      <th>{t("invest_tbl_date") || "Date"}</th>
                      <th>{t("invest_tbl_investor") || "Investor / Partner"}</th>
                      <th>{t("invest_tbl_type") || "Type"}</th>
                      <th className="text-end">{t("invest_tbl_amount") || "Amount"}</th>
                      <th>{t("invest_tbl_method") || "Account"}</th>
                      <th>{t("invest_tbl_ref") || "Ref / Voucher"}</th>
                      <th>{t("invest_tbl_note") || "Note"}</th>
                      <th className="text-end pe-3">{t("invest_tbl_actions") || "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((inv, idx) => (
                      <tr key={inv.id}>
                        <td className="small text-muted">{idx + 1 + (page - 1) * 20}</td>
                        <td className="small text-nowrap">{inv.invested_on}</td>
                        <td>
                          <div className="fw-bold text-dark">{inv.investor_name}</div>
                          {inv.created_by_name && (
                            <div className="text-muted" style={{ fontSize: "0.75rem" }}>by {inv.created_by_name}</div>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${
                            inv.type === "capital" ? "bg-success-subtle text-success border border-success-subtle" :
                            inv.type === "drawing" ? "bg-danger-subtle text-danger border border-danger-subtle" :
                            inv.type === "loan" ? "bg-warning-subtle text-warning border border-warning-subtle" :
                            inv.type === "equity" ? "bg-info-subtle text-info border border-info-subtle" :
                            "bg-secondary-subtle text-secondary"
                          } rounded-pill`}>
                            {inv.type === "drawing" ? (lang === "bn" ? "উত্তোলন (Drawing)" : "Drawing") : (inv.type_display || inv.type)}
                          </span>
                        </td>
                        <td className={`text-end fw-bold ${inv.type === "drawing" ? "text-danger" : "text-dark"}`}>
                          {inv.type === "drawing" ? `-${money(inv.amount)}` : money(inv.amount)}
                        </td>
                        <td>
                          <span className="badge bg-light text-secondary border text-uppercase">
                            {inv.payment_method || "CASH"}
                          </span>
                        </td>
                        <td className="small text-muted">{inv.reference || "—"}</td>
                        <td className="small text-secondary text-truncate" style={{ maxWidth: "200px" }}>{inv.note || "—"}</td>
                        <td className="text-end pe-3">
                          <div className="btn-group btn-group-sm">
                            <button
                              type="button"
                              className="btn btn-light btn-sm text-primary py-0 px-2"
                              title="Edit"
                              onClick={() => openEditModal(inv)}
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              className="btn btn-light btn-sm text-danger py-0 px-2"
                              title="Delete"
                              onClick={() => handleDelete(inv.id)}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={page} totalPages={totalPages} setPage={setPage} total={total} />
          </div>

          {/* Product Purchases in Investment Table Card */}
          <div className="card shadow-sm border-0 rounded-3 bg-white overflow-hidden">
            <div className="card-header bg-light py-2.5 px-3 border-0 d-flex justify-content-between align-items-center">
              <div>
                <span className="fw-bold text-dark small">
                  📦 {t("invest_purchases_title") || "Product Purchases Included in Investment"} ({purchases.length})
                </span>
                <div className="text-muted small" style={{ fontSize: "0.75rem" }}>
                  {t("invest_purchases_desc") || "All inventory purchases are automatically linked to your investment phase"}
                </div>
              </div>
              <span className="badge bg-info-subtle text-info border border-info-subtle fw-bold">
                Total: {money(invSummary?.purchase_investment ?? position?.purchase_investment ?? 0)}
              </span>
            </div>

            <div className="table-responsive" style={{ maxHeight: "320px" }}>
              <table className="table table-sm table-striped align-middle mb-0">
                <thead className="table-light">
                  <tr className="small text-secondary">
                    <th>#</th>
                    <th>{lang === "bn" ? "PO নম্বর" : "PO Number"}</th>
                    <th>{lang === "bn" ? "সাপ্লায়ার" : "Supplier"}</th>
                    <th>{lang === "bn" ? "তারিখ" : "Date"}</th>
                    <th>{lang === "bn" ? "স্ট্যাটাস" : "Status"}</th>
                    <th>{lang === "bn" ? "পেমেন্ট" : "Payment"}</th>
                    <th className="text-end">{lang === "bn" ? "ক্রয় মূল্য (বিনিয়োগ)" : "Purchase Amount (Inv)"}</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.slice(0, 30).map((po, i) => (
                    <tr key={po.id}>
                      <td className="small text-muted">{i + 1}</td>
                      <td className="font-monospace fw-bold text-dark">{po.po_number}</td>
                      <td className="small">{po.supplier_name || "—"}</td>
                      <td className="small">{po.created_at ? new Date(po.created_at).toLocaleDateString() : "—"}</td>
                      <td>
                        <span className="badge bg-light text-secondary border">{po.status}</span>
                      </td>
                      <td>
                        <span className={`badge ${po.payment_status === "paid" ? "bg-success-subtle text-success" : "bg-warning-subtle text-warning"} border rounded-pill`}>
                          {po.payment_status}
                        </span>
                      </td>
                      <td className="text-end fw-bold text-dark">{money(po.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: ACCOUNT TRANSFERS ── */}
      {activeTab === "transfers" && (
        <div className="vstack gap-3">
          <div className="card shadow-sm border-0 rounded-3 bg-white p-3">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div>
                <h6 className="fw-bold mb-1 text-dark">🔄 {lang === "bn" ? "অভ্যন্তরীণ অ্যাকাউন্ট ট্রান্সফার" : "Internal Liquid Fund Transfers"}</h6>
                <div className="small text-muted">
                  {lang === "bn"
                    ? "ক্যাশ ড্রয়ার থেকে বিকাশ/ব্যাংক বা বিকাশ থেকে ব্যাংকে টাকা স্থানান্তর করুন। এটি লাভ-ক্ষতি বা বিক্রয় প্রভাবিত করে না।"
                    : "Transfer money between your cash drawer, bKash, Nagad, and bank accounts without affecting profit or sales."}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-brand btn-sm fw-bold px-3 shadow-sm d-flex align-items-center gap-1"
                onClick={() => setTransferModalOpen(true)}
              >
                ➕ {lang === "bn" ? "নতুন ট্রান্সফার করুন" : "Record Fund Transfer"}
              </button>
            </div>
          </div>

          <div className="card shadow-sm border-0 rounded-3 bg-white overflow-hidden">
            <div className="card-header bg-light py-2.5 px-3 border-0 d-flex justify-content-between align-items-center">
              <span className="fw-bold text-dark small">
                📋 {lang === "bn" ? "ট্রান্সফার হিস্টোরি" : "Transfer History"} ({transfers.length})
              </span>
            </div>

            {transfers.length === 0 ? (
              <div className="p-5 text-center text-secondary">
                <div style={{ fontSize: "2.5rem" }}>🔄</div>
                <h6 className="mt-2 fw-bold">{lang === "bn" ? "কোনো ট্রান্সফার রেকর্ড নেই" : "No transfer records found"}</h6>
                <p className="small mb-3 text-muted">
                  {lang === "bn" ? "ক্যাশ বা মোবাইল ব্যাংকিং অ্যাকাউন্টে টাকা সরাতে উপরের বাটনে ক্লিক করুন।" : "Record internal funds transfers between liquid accounts."}
                </p>
                <button type="button" className="btn btn-sm btn-brand fw-semibold" onClick={() => setTransferModalOpen(true)}>
                  ➕ {lang === "bn" ? "ট্রান্সফার করুন" : "Record Transfer"}
                </button>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr className="small text-secondary">
                      <th>#</th>
                      <th>{lang === "bn" ? "তারিখ" : "Date"}</th>
                      <th>{lang === "bn" ? "উৎস অ্যাকাউন্ট (From)" : "From Account"}</th>
                      <th>{lang === "bn" ? "গন্তব্য (To)" : "To Account"}</th>
                      <th className="text-end">{lang === "bn" ? "পরিমাণ" : "Amount"}</th>
                      <th>{lang === "bn" ? "রেফারেন্স" : "Reference"}</th>
                      <th>{lang === "bn" ? "নোট" : "Note"}</th>
                      <th className="text-end pe-3">{lang === "bn" ? "একশন" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.map((tr, idx) => (
                      <tr key={tr.id}>
                        <td className="small text-muted">{idx + 1}</td>
                        <td className="small text-nowrap">{tr.transferred_on}</td>
                        <td>
                          <span className="badge bg-danger-subtle text-danger border border-danger-subtle text-uppercase">
                            {tr.from_account_display || tr.from_account}
                          </span>
                        </td>
                        <td>
                          <span className="badge bg-success-subtle text-success border border-success-subtle text-uppercase">
                            {tr.to_account_display || tr.to_account}
                          </span>
                        </td>
                        <td className="text-end fw-bold text-dark">{money(tr.amount)}</td>
                        <td className="small text-muted">{tr.reference || "—"}</td>
                        <td className="small text-secondary text-truncate" style={{ maxWidth: "220px" }}>{tr.note || "—"}</td>
                        <td className="text-end pe-3">
                          <button
                            type="button"
                            className="btn btn-light btn-sm text-danger py-0 px-2"
                            title="Delete"
                            onClick={() => handleTransferDelete(tr.id)}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ADD / EDIT INVESTMENT MODAL ── */}
      {modalOpen && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1060 }}
          tabIndex={-1}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden">
              <div className="modal-header bg-light py-3 px-4">
                <h5 className="modal-title fw-bold text-dark mb-0">
                  💼 {editingInv ? (t("invest_modal_edit_title") || "Edit Record") : (t("invest_modal_add_title") || "Record Capital / Drawing")}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setModalOpen(false)}
                ></button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="modal-body p-4 vstack gap-3">
                  <div>
                    <label className="form-label small fw-bold text-dark mb-1">
                      {t("invest_tbl_investor") || "Investor / Owner / Partner Name"} <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Md. Rafiqul Islam, Owner Capital"
                      value={form.investor_name}
                      onChange={(e) => setForm({ ...form, investor_name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="row g-2">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-dark mb-1">
                        {t("invest_tbl_type") || "Transaction Type"}
                      </label>
                      <select
                        className="form-select"
                        value={form.type}
                        onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                      >
                        <option value="capital">{t("invest_type_capital") || "Owner / Partner Capital (+Inflow)"}</option>
                        <option value="drawing">{lang === "bn" ? "মালিকের ব্যক্তিগত উত্তোলন (-Outflow)" : "Owner Withdrawal / Drawings (-Outflow)"}</option>
                        <option value="loan">{t("invest_type_loan") || "Loan / Borrowing (+Inflow)"}</option>
                        <option value="equity">{t("invest_type_equity") || "Equity / Share (+Inflow)"}</option>
                        <option value="other">{t("invest_type_other") || "Other Investment"}</option>
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-dark mb-1">
                        {t("invest_tbl_amount") || "Amount (৳)"} <span className="text-danger">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        className="form-control fw-bold text-primary"
                        placeholder="0.00"
                        value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="row g-2">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-dark mb-1">
                        {t("invest_tbl_date") || "Date"}
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        value={form.invested_on}
                        onChange={(e) => setForm({ ...form, invested_on: e.target.value })}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-dark mb-1">
                        {t("invest_tbl_method") || "Payment Account"}
                      </label>
                      <select
                        className="form-select"
                        value={form.payment_method}
                        onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                      >
                        <option value="cash">Cash (ক্যাশ)</option>
                        <option value="bank">Bank Transfer (ব্যাংক)</option>
                        <option value="bkash">bKash (বিকাশ)</option>
                        <option value="nagad">Nagad (নগদ)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="form-label small fw-bold text-dark mb-1">
                      {t("invest_tbl_ref") || "Reference / Voucher Number"}
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. VOUCH-1002"
                      value={form.reference}
                      onChange={(e) => setForm({ ...form, reference: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="form-label small fw-bold text-dark mb-1">
                      {t("invest_tbl_note") || "Note / Description"}
                    </label>
                    <textarea
                      rows={2}
                      className="form-control"
                      placeholder={lang === "bn" ? "অতিরিক্ত বিবরণ..." : "Optional description or purpose..."}
                      value={form.note}
                      onChange={(e) => setForm({ ...form, note: e.target.value })}
                    />
                  </div>
                </div>

                <div className="modal-footer bg-light p-3 d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-outline-secondary px-4"
                    onClick={() => setModalOpen(false)}
                    disabled={submitting}
                  >
                    {lang === "bn" ? "বাতিল" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-brand px-4 fw-bold"
                    disabled={submitting}
                  >
                    {submitting ? "Saving..." : (editingInv ? (t("invest_btn_edit") || "Save Changes") : (t("invest_btn_add") || "Record Entry"))}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── RECORD ACCOUNT TRANSFER MODAL ── */}
      {transferModalOpen && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1060 }}
          tabIndex={-1}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden">
              <div className="modal-header bg-light py-3 px-4">
                <h5 className="modal-title fw-bold text-dark mb-0">
                  🔄 {lang === "bn" ? "অভ্যন্তরীণ অ্যাকাউন্ট ট্রান্সফার" : "Record Internal Account Transfer"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setTransferModalOpen(false)}
                ></button>
              </div>

              <form onSubmit={handleTransferSubmit}>
                <div className="modal-body p-4 vstack gap-3">
                  <div className="row g-2">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-dark mb-1">
                        {lang === "bn" ? "উৎস অ্যাকাউন্ট (From)" : "From Account"} <span className="text-danger">*</span>
                      </label>
                      <select
                        className="form-select"
                        value={transferForm.from_account}
                        onChange={(e) => setTransferForm({ ...transferForm, from_account: e.target.value })}
                      >
                        <option value="cash">Cash (ক্যাশ ড্রয়ার)</option>
                        <option value="bkash">bKash (বিকাশ)</option>
                        <option value="nagad">Nagad (নগদ)</option>
                        <option value="bank">Bank (ব্যাংক)</option>
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-dark mb-1">
                        {lang === "bn" ? "গন্তব্য অ্যাকাউন্ট (To)" : "To Account"} <span className="text-danger">*</span>
                      </label>
                      <select
                        className="form-select"
                        value={transferForm.to_account}
                        onChange={(e) => setTransferForm({ ...transferForm, to_account: e.target.value })}
                      >
                        <option value="bkash">bKash (বিকাশ)</option>
                        <option value="nagad">Nagad (নগদ)</option>
                        <option value="bank">Bank (ব্যাংক)</option>
                        <option value="cash">Cash (ক্যাশ ড্রয়ার)</option>
                      </select>
                    </div>
                  </div>

                  <div className="row g-2">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-dark mb-1">
                        {lang === "bn" ? "পরিমাণ (৳)" : "Amount (৳)"} <span className="text-danger">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        className="form-control fw-bold text-primary"
                        placeholder="0.00"
                        value={transferForm.amount}
                        onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-dark mb-1">
                        {lang === "bn" ? "ট্রান্সফারের তারিখ" : "Transfer Date"}
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        value={transferForm.transferred_on}
                        onChange={(e) => setTransferForm({ ...transferForm, transferred_on: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label small fw-bold text-dark mb-1">
                      {lang === "bn" ? "রেফারেন্স / ট্রানজেকশন আইডি" : "Reference / Transaction ID"}
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. TrxID-982341, Deposit Slip #44"
                      value={transferForm.reference}
                      onChange={(e) => setTransferForm({ ...transferForm, reference: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="form-label small fw-bold text-dark mb-1">
                      {lang === "bn" ? "নোট / বিবরণ" : "Note / Description"}
                    </label>
                    <textarea
                      rows={2}
                      className="form-control"
                      placeholder={lang === "bn" ? "ট্রান্সফারের উদ্দেশ্য বা বিবরণ..." : "Optional transfer note..."}
                      value={transferForm.note}
                      onChange={(e) => setTransferForm({ ...transferForm, note: e.target.value })}
                    />
                  </div>
                </div>

                <div className="modal-footer bg-light p-3 d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-outline-secondary px-4"
                    onClick={() => setTransferModalOpen(false)}
                    disabled={transferSubmitting}
                  >
                    {lang === "bn" ? "বাতিল" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-brand px-4 fw-bold"
                    disabled={transferSubmitting}
                  >
                    {transferSubmitting ? "Processing..." : (lang === "bn" ? "ট্রান্সফার সম্পন্ন করুন" : "Complete Transfer")}
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
