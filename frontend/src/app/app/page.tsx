"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Chart from "chart.js/auto";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLandingPath } from "@/lib/landing";
import { Card, ErrorState, Spinner, money } from "@/components/ui";

type Summary = {
  period_days: number;
  today: { revenue: number; net_profit: number; sales_count: number; returns?: number; returns_count?: number };
  period: { revenue: number; net_profit: number; sales_count: number; returns?: number; returns_count?: number };
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
  const { t } = useLanguage();
  const [showPay, setShowPay] = useState(false);
  if (!sub || sub.state === "none" || sub.state === "free") return null;
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
    sub.state === "expired" ? t("sub_expired") :
    sub.state === "trial" ? t("sub_trial_left", { d }) :
    t("sub_plan_left", { plan: sub.plan_name || "Pro", d });

  const subtitle =
    sub.state === "expired" ? t("sub_renew_needed") :
    t("sub_ends_on", { type: sub.state === "trial" ? t("sub_type_trial") : t("sub_type_plan"), endStr, urgent: urgent ? t("sub_urgent") : "" });

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
            <i className="bi bi-arrow-repeat me-1"></i>{sub.state === "trial" ? t("sub_upgrade_renew") : t("sub_renew_now")}
          </button>
        )}
      </div>

      {showPay && (
        <div className="bg-white text-dark rounded-3 p-3 small">
          <div className="fw-semibold mb-1">{t("sub_payment_instr")}</div>
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
              {t("sub_phone_whatsapp")}:{" "}
              <a href="https://wa.me/8801613511887" target="_blank" rel="noopener noreferrer" className="fw-semibold text-decoration-none">
                +8801613511887
              </a>
            </div>
            <div>
              <i className="bi bi-envelope-fill text-primary me-1"></i>
              {t("sub_email")}:{" "}
              <a href="mailto:admin@stockwhisk.com" className="fw-semibold text-decoration-none">
                admin@stockwhisk.com
              </a>
            </div>
          </div>
          <div className="text-secondary">{t("sub_activation_note")}</div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, can, isOwner } = useAuth();
  const { t } = useLanguage();
  const canDashboard = isOwner || can("view_reports");
  const canProfit = isOwner || can("view_profit");
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<SubStatus | null>(null);
  const [profitRange, setProfitRange] = useState("today");
  const [topData, setTopData] = useState<any>(null);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInst = useRef<any>(null);

  useEffect(() => {
    if (!authLoading && user && !canDashboard) {
      router.replace(getLandingPath({ isOwner, can }));
    }
  }, [authLoading, user, canDashboard, isOwner, can, router]);

  useEffect(() => {
    if (!canDashboard) { setLoading(false); return; }
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
    api(`/analytics/profit-overview/`, { params: { range: profitRange } })
      .then(setTopData)
      .catch(() => {});
  }, [canDashboard, profitRange]);

  useEffect(() => {
    let animId: number;
    if (!data || !chartRef.current) return;

    animId = requestAnimationFrame(() => {
      if (chartInst.current) chartInst.current.destroy();
      chartInst.current = new Chart(chartRef.current!, {
        type: "line",
        data: {
          labels: data.sales_trend.map((r) => r.day),
          datasets: [
            {
              label: t("dash_revenue"),
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
    });

    return () => {
      cancelAnimationFrame(animId);
      chartInst.current?.destroy();
    };
  }, [data, t]);

  if (!canDashboard) return <Spinner label={t("dash_redirecting")} />;
  if (loading) return <Spinner label={t("dash_loading")} />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  let filterPrefix = "";
  if (profitRange === "today") filterPrefix = t("dash_prefix_today");
  else if (profitRange === "7d") filterPrefix = t("dash_prefix_weekly");
  else if (profitRange === "30d") filterPrefix = t("dash_prefix_monthly");
  else if (profitRange === "this_year") filterPrefix = t("dash_prefix_yearly");
  else if (profitRange === "all_time") filterPrefix = t("dash_prefix_lifetime");

  return (
    <div>
      <SubscriptionBanner sub={sub} />
      
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="h3 mb-0 fw-bold">{t("nav_dashboard")}</h1>
        <select
          className="form-select form-select-sm w-auto"
          value={profitRange}
          onChange={(e) => setProfitRange(e.target.value)}
        >
          <option value="today">{t("dash_filter_daily")}</option>
          <option value="7d">{t("dash_filter_weekly")}</option>
          <option value="30d">{t("dash_filter_monthly")}</option>
          <option value="this_year">{t("dash_filter_yearly")}</option>
          <option value="all_time">{t("dash_filter_lifetime")}</option>
        </select>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">{t("dash_sale_money", { prefix: filterPrefix })}</div>
            <div className="fs-4 fw-bold text-brand">
              {topData ? money(topData.summary.revenue) : "..."}
            </div>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">{t("dash_total_order", { prefix: filterPrefix })}</div>
            <div className="fs-4 fw-bold text-primary">
              {topData ? topData.summary.completed_orders : "..."}
            </div>
          </Card>
        </div>
        {canProfit && (
          <div className="col-6 col-lg-3">
            <Card>
              <div className="small text-secondary">{t("dash_gross_profit", { prefix: filterPrefix })}</div>
              <div className="fs-4 fw-bold text-success">
                {topData ? money(topData.summary.gross_profit) : "..."}
              </div>
            </Card>
          </div>
        )}
        {canProfit && (
          <div className="col-6 col-lg-3">
            <Card>
              <div className="small text-secondary">{t("dash_profit_margin", { prefix: filterPrefix })}</div>
              <div className="fs-4 fw-bold text-info">
                {topData ? `${topData.summary.profit_margin.toFixed(2)}%` : "..."}
              </div>
            </Card>
          </div>
        )}
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">{t("dash_out_low_stock")}</div>
            <div className="fs-4 fw-bold text-danger">
              {data.out_of_stock_count} / {data.low_stock_count}
            </div>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">{t("dash_receivables")} (Total Due)</div>
            <div className="fs-4 fw-bold text-warning">
              {money(data.position.receivables)}
            </div>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">{t("dash_return_count", { prefix: filterPrefix })}</div>
            <div className="fs-4 fw-bold text-danger">
              {topData ? (topData.summary.return_count ?? 0) : (data?.today?.returns_count ?? 0)}
            </div>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">{t("dash_return_amount", { prefix: filterPrefix })}</div>
            <div className="fs-4 fw-bold text-danger">
              {topData ? money(topData.summary.return_amount ?? 0) : money(data?.today?.returns ?? 0)}
            </div>
          </Card>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-lg-8">
          <div className="card shadow-sm">
            <div className="card-body">
              <div className="fw-semibold mb-3">{t("dash_sales_trend")}</div>
              <div style={{ height: 260 }}>
                <canvas ref={chartRef}></canvas>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="fw-semibold mb-3">{t("dash_top_products")}</div>
              <div className="table-responsive">
                <table className="table table-striped table-sm mb-0">
                  <thead className="thead-6">
                    <tr>
                      <th>{t("dash_col_product")}</th>
                      <th className="text-end">{t("dash_col_sold")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_products.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="text-secondary">{t("dash_no_sales")}</td>
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
              <div className="fw-semibold mb-3">{t("dash_financial_position")}</div>
              <div className="table-responsive">
                <table className="table table-striped table-sm mb-0">
                  <thead className="thead-3">
                    <tr>
                      <th>{t("dash_col_account")}</th>
                      <th className="text-end">{t("dash_col_amount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="text-secondary">{t("dash_cash")}</td>
                      <td className="text-end">{money(data.position.cash_balance)}</td>
                    </tr>
                    <tr>
                      <td className="text-secondary">{t("dash_receivables")}</td>
                      <td className="text-end">{money(data.position.receivables)}</td>
                    </tr>
                    <tr>
                      <td className="text-secondary">{t("dash_payables")}</td>
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
              <div className="fw-semibold mb-3">{t("dash_period", { days: data.period_days })}</div>
              <div className="table-responsive">
                <table className="table table-striped table-sm mb-0">
                  <tbody>
                    <tr>
                      <td className="text-secondary">{t("dash_revenue")}</td>
                      <td className="text-end">{money(data.period.revenue)}</td>
                    </tr>
                    {canProfit && (
                      <tr>
                        <td className="text-secondary">{t("dash_net_profit")}</td>
                        <td className="text-end text-success">{money(data.period.net_profit)}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="text-secondary">{t("dash_invoices")}</td>
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
