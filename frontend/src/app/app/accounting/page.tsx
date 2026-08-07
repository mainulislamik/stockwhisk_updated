"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, ErrorState, Spinner, money } from "@/components/ui";

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
        setError(e?.message || "Failed to load accounting");
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
          <div className="fw-semibold me-auto">Date Filter</div>
          <div className="d-flex align-items-center gap-2">
            <label className="text-secondary small fw-medium">Start Date</label>
            <input 
              type="date" 
              className="form-control form-control-sm" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
            />
          </div>
          <div className="d-flex align-items-center gap-2">
            <label className="text-secondary small fw-medium">End Date</label>
            <input 
              type="date" 
              className="form-control form-control-sm" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)} 
            />
          </div>
        </div>
      </div>
      
      {loading && <Spinner label="Loading accounting…" />}
      {!loading && profit && position && (
        <>
          <div className="row g-3">
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">Revenue</div>
            <div className="fs-4 fw-bold">{money(profit?.revenue)}</div>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">Gross profit</div>
            <div className="fs-4 fw-bold text-success">{money(profit?.gross_profit)}</div>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">Expenses</div>
            <div className="fs-4 fw-bold text-danger">{money(profit?.expenses)}</div>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">Net profit</div>
            <div className="fs-4 fw-bold text-success">{money(profit?.net_profit)}</div>
          </Card>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card shadow-sm">
            <div className="card-body">
              <div className="fw-semibold mb-3">Profit &amp; loss</div>
              <table className="table table-sm mb-0">
                <tbody>
                  <tr>
                    <td className="text-secondary">Revenue</td>
                    <td className="text-end">{money(profit?.revenue)}</td>
                  </tr>
                  <tr>
                    <td className="text-secondary">Returns</td>
                    <td className="text-end">{money(profit?.returns)}</td>
                  </tr>
                  <tr>
                    <td className="text-secondary">COGS</td>
                    <td className="text-end">{money(profit?.cogs)}</td>
                  </tr>
                  <tr className="fw-semibold">
                    <td>Gross profit</td>
                    <td className="text-end">{money(profit?.gross_profit)}</td>
                  </tr>
                  <tr>
                    <td className="text-secondary">Expenses</td>
                    <td className="text-end">{money(profit?.expenses)}</td>
                  </tr>
                  <tr className="fw-bold">
                    <td>Net profit</td>
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
              <div className="fw-semibold mb-3">Financial position</div>
              <table className="table table-sm mb-0">
                <tbody>
                  <tr>
                    <td className="text-secondary">Cash balance</td>
                    <td className="text-end">{money(position?.cash_balance)}</td>
                  </tr>
                  <tr>
                    <td className="text-secondary">Bank balance</td>
                    <td className="text-end">{money(position?.bank_balance)}</td>
                  </tr>
                  <tr>
                    <td className="text-secondary">Receivables</td>
                    <td className="text-end">{money(position?.receivables)}</td>
                  </tr>
                  <tr>
                    <td className="text-secondary">Payables</td>
                    <td className="text-end">{money(position?.payables)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="card shadow-sm mt-3">
            <div className="card-body">
              <div className="fw-semibold mb-3">Payments collected (by method)</div>
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
                <div className="text-muted small">No payments recorded.</div>
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
