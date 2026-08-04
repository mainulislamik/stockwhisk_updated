"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
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

export default function DashboardPage() {
  const { can, isOwner } = useAuth();
  const canProfit = isOwner || can("view_profit");
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInst = useRef<any>(null);

  useEffect(() => {
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
  }, []);

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

  if (loading) return <Spinner label="Loading dashboard…" />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  return (
    <div>
      <h1 className="h4 fw-bold text-brand mb-3">Dashboard</h1>

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">Today revenue</div>
            <div className="fs-4 fw-bold">{money(data.today.revenue)}</div>
          </Card>
        </div>
        {canProfit && (
          <div className="col-6 col-lg-3">
            <Card>
              <div className="small text-secondary">Today net profit</div>
              <div className="fs-4 fw-bold text-success">{money(data.today.net_profit)}</div>
            </Card>
          </div>
        )}
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">Stock value</div>
            <div className="fs-4 fw-bold">{money(data.stock_value)}</div>
          </Card>
        </div>
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
