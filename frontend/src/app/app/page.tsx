"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { getLandingPath } from "@/lib/landing";
import { Card, ErrorState, Spinner, money } from "@/components/ui";

type Summary = {
  period_days: number;
  today: { revenue: number; net_profit: number; sales_count: number };
  period: { revenue: number; net_profit: number; sales_count: number };
  position: { cash_balance: number; receivables: number; payables: number; bank_balance: number };
  stock_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
  top_products: { product_id: number; product__name: string; qty: number; revenue: number; profit: number }[];
  sales_trend: { day: string; revenue: number }[];
  mom_growth: { current: number; previous: number; growth_pct: number };
};

type SubStatus = {
  state: "trial" | "paid" | "expired" | "none" | "free";
  plan_name: string | null;
  plan: string | null;
  days_left: number;
  ends_at: string | null;
  billing_details?: { bkash?: string; nagad?: string; bank?: string };
};

function SubscriptionBanner({ sub }: { sub: SubStatus | null }) {
  const [showPay, setShowPay] = useState(false);
  if (!sub || sub.state === "none" || sub.state === "free") return null;
  // Only surface the banner near expiry (≤3 days) or once expired. While a plan
  // (trial or paid) is comfortably active, the sidebar "plan" label is enough.
  if (sub.state !== "expired" && sub.days_left > 3) return null;

  const d = sub.days_left;
  const urgent = sub.state === "expired" || d <= 5;
  const endStr = sub.ends_at
    ? new Date(sub.ends_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : "";

  const theme =
    sub.state === "expired" ? { bg: "danger", icon: "bi-x-octagon-fill" } :
    urgent ? { bg: "warning", icon: "bi-exclamation-triangle-fill" } :
    sub.state === "paid" ? { bg: "success", icon: "bi-patch-check-fill" } :
    { bg: "info", icon: "bi-hourglass-split" };

  const title =
    sub.state === "expired" ? "Your subscription has expired" :
    sub.state === "trial" ? `Free trial — ${d} day${d === 1 ? "" : "s"} left` :
    `${sub.plan_name || "Pro"} plan — ${d} day${d === 1 ? "" : "s"} left`;

  const subtitle =
    sub.state === "expired" ? "Access is suspended. Renew to restore your shop." :
    `${sub.state === "trial" ? "Trial" : "Plan"} ends on ${endStr}.${urgent ? " Renew soon to avoid interruption." : ""}`;

  const bd = sub.billing_details || {};

  return (
    <div className={`alert alert-${theme.bg} d-flex flex-column gap-2 rounded-4 border-0 shadow-sm mb-3`}>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div className="d-flex align-items-center gap-2">
          <i className={`bi ${theme.icon} fs-5`}></i>
          <div>
            <div className="fw-bold">{title}</div>
            <div className="small opacity-75">{subtitle}</div>
          </div>
        </div>
        {(urgent || sub.state === "trial") && (
          <button className={`btn btn-${sub.state === "expired" ? "light" : theme.bg === "warning" ? "dark" : "light"} btn-sm rounded-pill px-3 fw-semibold`}
            onClick={() => setShowPay((s) => !s)}>
            <i className="bi bi-arrow-repeat me-1"></i>{sub.state === "trial" ? "Upgrade / Renew" : "Renew now"}
          </button>
        )}
      </div>

      {showPay && (
        <div className="bg-white text-dark rounded-3 p-3 small">
          <div className="fw-semibold mb-1">To renew, pay to any of the below and inform the admin:</div>
          {(bd.bkash || bd.nagad || bd.bank) && (
            <ul className="mb-2">
              {bd.bkash && <li>bKash: <b>{bd.bkash}</b></li>}
              {bd.nagad && <li>Nagad: <b>{bd.nagad}</b></li>}
              {bd.bank && <li>Bank: <b>{bd.bank}</b></li>}
            </ul>
          )}
          <div className="d-flex flex-column gap-1 mb-2">
            <div>
              <i className="bi bi-whatsapp text-success me-1"></i>
              Phone / WhatsApp:{" "}
              <a href="https://wa.me/8801613511887" target="_blank" rel="noopener noreferrer" className="fw-semibold text-decoration-none">
                +8801613511887
              </a>
            </div>
            <div>
              <i className="bi bi-envelope-fill text-primary me-1"></i>
              Email:{" "}
              <a href="mailto:admin@stockwhisk.com" className="fw-semibold text-decoration-none">
                admin@stockwhisk.com
              </a>
            </div>
          </div>
          <div className="text-secondary">Once your payment is confirmed, your plan is activated and an invoice is emailed to you.</div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, can, isOwner } = useAuth();
  const canDashboard = isOwner || can("view_reports");
  const canProfit = isOwner || can("view_profit");
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<SubStatus | null>(null);
  const [topFilter, setTopFilter] = useState("today");
  const [topData, setTopData] = useState<any>(null);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInst = useRef<any>(null);

  // The dashboard is protected server-side by `view_reports`. If a user without
  // it lands here directly, send them to a page they can actually use instead of
  // showing a 403 (backend protection stays intact — this only steers the UI).
  useEffect(() => {
    if (!authLoading && user && !canDashboard) {
      router.replace(getLandingPath({ isOwner, can }));
    }
  }, [authLoading, user, canDashboard, isOwner, can, router]);

  useEffect(() => {
    if (!canDashboard) { setLoading(false); return; }  // skip the 403-ing call
    (async () => {
      try {
        const d = await api<Summary>("/analytics/dashboard/", { params: { days: 30 } });
        setData(d);
      } catch (e: any) {
        setError(e?.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, [canDashboard]);

  useEffect(() => {
    api<SubStatus>("/billing/status/").then(setSub).catch(() => {});
  }, []);

  useEffect(() => {
    if (!canDashboard) return;
    api(`/analytics/profit-overview/`, { params: { range: topFilter } })
      .then(setTopData)
      .catch(() => {});
  }, [canDashboard, topFilter]);

  useEffect(() => {
    const Chart = (window as any).Chart;
    if (!Chart || !data || !chartRef.current) return;
    if (chartInst.current) chartInst.current.destroy();
    chartInst.current = new Chart(chartRef.current, {
      type: "line",
      data: {
        labels: data.sales_trend.map((r) => r.day),
        datasets: [
          {
            label: "Revenue",
            data: data.sales_trend.map((r) => Number(r.revenue)),
            borderColor: "#234C6A",
            backgroundColor: "rgba(69,104,130,.15)",
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    });
    return () => chartInst.current?.destroy();
  }, [data]);

  // Users without dashboard access are being redirected (effect above); show a
  // spinner meanwhile rather than the dashboard shell or a 403.
  if (!canDashboard) return <Spinner label="Redirecting…" />;
  if (loading) return <Spinner label="Loading dashboard…" />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  const filterPrefix =
    topFilter === "today" ? "Today" :
    topFilter === "7d" ? "Weekly" :
    topFilter === "30d" ? "Monthly" :
    topFilter === "this_year" ? "Yearly" : "Lifetime";

  return (
    <div>
      <SubscriptionBanner sub={sub} />
      
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <h1 className="h4 fw-bold text-brand mb-0">Dashboard</h1>
        <select
          className="form-select form-select-sm w-auto fw-semibold rounded-pill bg-light"
          value={topFilter}
          onChange={(e) => setTopFilter(e.target.value)}
        >
          <option value="today">Daily</option>
          <option value="7d">Weekly</option>
          <option value="30d">Monthly</option>
          <option value="this_year">Yearly</option>
          <option value="all_time">Lifetime</option>
        </select>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">{filterPrefix} Sale Money</div>
            <div className="fs-4 fw-bold text-brand">
              {topData ? money(topData.summary.revenue) : "..."}
            </div>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">{filterPrefix} Total Order</div>
            <div className="fs-4 fw-bold text-primary">
              {topData ? topData.summary.completed_orders : "..."}
            </div>
          </Card>
        </div>
        {canProfit && (
          <div className="col-6 col-lg-3">
            <Card>
              <div className="small text-secondary">{filterPrefix} Gross Profit</div>
              <div className="fs-4 fw-bold text-success">
                {topData ? money(topData.summary.gross_profit) : "..."}
              </div>
            </Card>
          </div>
        )}
        {canProfit && (
          <div className="col-6 col-lg-3">
            <Card>
              <div className="small text-secondary">{filterPrefix} Profit Margin</div>
              <div className="fs-4 fw-bold text-info">
                {topData ? `${topData.summary.profit_margin.toFixed(2)}%` : "..."}
              </div>
            </Card>
          </div>
        )}
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">Out / Low stock</div>
            <div className="fs-4 fw-bold text-danger">
              {data.out_of_stock_count} / {data.low_stock_count}
            </div>
          </Card>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-lg-8">
          <div className="card shadow-sm">
            <div className="card-body">
              <div className="fw-semibold mb-3">Sales trend (last 30 days)</div>
              <div style={{ height: 260 }}>
                <canvas ref={chartRef}></canvas>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="fw-semibold mb-3">Top products</div>
              <div className="table-responsive">
                <table className="table table-striped table-sm mb-0">
                  <thead className="thead-6">
                    <tr>
                      <th>Product</th>
                      <th className="text-end">Sold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_products.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="text-secondary">No sales yet.</td>
                      </tr>
                    ) : (
                      data.top_products.map((p) => (
                        <tr key={p.product_id}>
                          <td>{p.product__name}</td>
                          <td className="text-end">{Number(p.qty)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card shadow-sm">
            <div className="card-body">
              <div className="fw-semibold mb-3">Financial position</div>
              <div className="table-responsive">
                <table className="table table-striped table-sm mb-0">
                  <thead className="thead-3">
                    <tr>
                      <th>Account</th>
                      <th className="text-end">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="text-secondary">Cash</td>
                      <td className="text-end">{money(data.position.cash_balance)}</td>
                    </tr>
                    <tr>
                      <td className="text-secondary">Receivables</td>
                      <td className="text-end">{money(data.position.receivables)}</td>
                    </tr>
                    <tr>
                      <td className="text-secondary">Payables</td>
                      <td className="text-end">{money(data.position.payables)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card shadow-sm">
            <div className="card-body">
              <div className="fw-semibold mb-3">Period ({data.period_days} days)</div>
              <div className="table-responsive">
                <table className="table table-striped table-sm mb-0">
                  <tbody>
                    <tr>
                      <td className="text-secondary">Revenue</td>
                      <td className="text-end">{money(data.period.revenue)}</td>
                    </tr>
                    {canProfit && (
                      <tr>
                        <td className="text-secondary">Net profit</td>
                        <td className="text-end text-success">{money(data.period.net_profit)}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="text-secondary">Invoices</td>
                      <td className="text-end">{data.period.sales_count}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
