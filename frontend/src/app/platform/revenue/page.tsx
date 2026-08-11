"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { ErrorState, PageHeader, Spinner, money } from "@/components/ui";

type Entry = {
  id: number;
  shop_name: string;
  shop_code: string;
  plan_tier: string;
  invoice_number: string;
  amount: string | number;
  cycle: string;
  period_start: string | null;
  period_end: string | null;
  is_test: boolean;
  occurred_at: string;
  shop_deleted: boolean;
};

type RevenueData = {
  month: string;
  months: string[];
  month_total: string | number;
  all_time_total: string | number;
  count: number;
  entries: Entry[];
  include_test: boolean;
};

function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function RevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [error, setError] = useState("");
  const [month, setMonth] = useState<string>("");
  const [includeTest, setIncludeTest] = useState(false);

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (month) params.month = month;
      if (includeTest) params.include_test = "1";
      const d = await api<RevenueData>("/platform/revenue/", { params });
      setData(d);
      if (!month) setMonth(d.month);
    } catch (e: any) {
      setError(e?.message || "Failed to load revenue.");
    }
  }, [month, includeTest]);

  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorState error={error} />;
  if (!data) return <Spinner label="Loading revenue…" />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <PageHeader title="Subscription Revenue" />
        <Link href="/platform" className="small text-decoration-none text-secondary">← Back to overview</Link>
      </div>

      {/* Totals */}
      <div className="row g-3 mb-3">
        <div className="col-6 col-lg-3">
          <div className="card border-0 shadow-sm rounded-4" style={{ background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.25)" }}>
            <div className="card-body">
              <div className="text-secondary small">{monthLabel(data.month)}</div>
              <div className="fs-3 fw-bold text-success">{money(data.month_total)}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="card border-0 shadow-sm rounded-4" style={{ background: "rgba(30,41,59,.5)" }}>
            <div className="card-body">
              <div className="text-secondary small">All-time revenue</div>
              <div className="fs-3 fw-bold">{money(data.all_time_total)}</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-6 d-flex align-items-end justify-content-lg-end gap-2 flex-wrap">
          <select className="form-select w-auto" value={month} onChange={(e) => setMonth(e.target.value)}>
            {data.months.length === 0 && <option value={data.month}>{monthLabel(data.month)}</option>}
            {data.months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <div className="form-check form-switch">
            <input className="form-check-input" type="checkbox" id="incTest" checked={includeTest}
              onChange={(e) => setIncludeTest(e.target.checked)} />
            <label className="form-check-label small" htmlFor="incTest">Include test shops</label>
          </div>
        </div>
      </div>

      {/* Invoices table */}
      <div className="card border-0 shadow-sm rounded-4" style={{ background: "rgba(30,41,59,.5)" }}>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-dark">
              <tr>
                <th className="ps-4">Invoice</th>
                <th>Shop</th>
                <th>Plan</th>
                <th>Period</th>
                <th>Date</th>
                <th className="text-end pe-4">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-5 text-secondary">
                  <i className="bi bi-receipt fs-3 d-block mb-2"></i>No revenue recorded for {monthLabel(data.month)}.
                </td></tr>
              ) : data.entries.map((e) => (
                <tr key={e.id}>
                  <td className="ps-4 font-monospace small">{e.invoice_number || "—"}</td>
                  <td>
                    <span className="fw-medium">{e.shop_name}</span>
                    {e.shop_code && <span className="text-secondary small ms-1">({e.shop_code})</span>}
                    {e.is_test && <span className="badge bg-secondary ms-2">test</span>}
                    {e.shop_deleted && <span className="badge bg-danger bg-opacity-25 text-danger ms-2">deleted</span>}
                  </td>
                  <td><span className="badge bg-primary bg-opacity-25 text-primary text-uppercase">{e.plan_tier}</span></td>
                  <td className="small text-secondary">
                    {e.period_start || "—"} → {e.period_end || "—"}
                  </td>
                  <td className="small">{new Date(e.occurred_at).toLocaleDateString()}</td>
                  <td className="text-end pe-4 fw-semibold font-monospace">{money(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
