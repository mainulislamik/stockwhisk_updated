"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, ErrorState, Spinner, money } from "@/components/ui";
import { useLanguage } from "@/contexts/LanguageContext";

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
type Position = { cash_balance: string; bank_balance: string; receivables: string; payables: string };

export default function AccountingPage() {
  const { t } = useLanguage();
  const [profit, setProfit] = useState<Profit | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Running date by default
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  useEffect(() => {
    (async () => {
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
    })();
  }, [startDate, endDate]);

  if (error) return <ErrorState error={error} />;

  return (
    <div className="vstack gap-3">
      {/* Date Filter */}
      <div className="card shadow-sm mb-2">
        <div className="card-body py-3 d-flex flex-wrap align-items-center gap-3">
          <div className="fw-semibold me-auto">{t("acc_date_filter")}</div>
          <div className="d-flex align-items-center gap-2">
            <label className="text-secondary small fw-medium">{t("acc_start_date")}</label>
            <input 
              type="date" 
              className="form-control form-control-sm" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
            />
          </div>
          <div className="d-flex align-items-center gap-2">
            <label className="text-secondary small fw-medium">{t("acc_end_date")}</label>
            <input 
              type="date" 
              className="form-control form-control-sm" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)} 
            />
          </div>
        </div>
      </div>
      
      {loading && <Spinner label={t("acc_loading")} />}
      {!loading && profit && position && (
        <>
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

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card shadow-sm">
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
          <div className="card shadow-sm">
            <div className="card-body">
              <div className="fw-semibold mb-3">{t("acc_financial_pos")}</div>
              <table className="table table-sm mb-0">
                <tbody>
                  <tr>
                    <td className="text-secondary">{t("acc_cash_bal")}</td>
                    <td className="text-end">{money(position?.cash_balance)}</td>
                  </tr>
                  <tr>
                    <td className="text-secondary">{t("acc_bank_bal")}</td>
                    <td className="text-end">{money(position?.bank_balance)}</td>
                  </tr>
                  <tr>
                    <td className="text-secondary">{t("acc_receivables")}</td>
                    <td className="text-end">{money(position?.receivables)}</td>
                  </tr>
                  <tr>
                    <td className="text-secondary">{t("acc_payables")}</td>
                    <td className="text-end">{money(position?.payables)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="card shadow-sm mt-3">
            <div className="card-body">
              <div className="fw-semibold mb-3">{t("acc_payments_col")}</div>
              {profit?.payment_methods && Object.keys(profit.payment_methods).length > 0 ? (
                <table className="table table-sm mb-0">
                  <tbody>
                    {Object.entries(profit.payment_methods).map(([method, amount]) => (
                      <tr key={method}>
                        <td className="text-secondary text-capitalize">{method}</td>
                        <td className="text-end fw-medium">{money(amount as string)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-muted small">{t("acc_no_payments")}</div>
              )}
            </div>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
