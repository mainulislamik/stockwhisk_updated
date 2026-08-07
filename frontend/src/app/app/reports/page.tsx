"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { ErrorState, Spinner, money } from "@/components/ui";

type DayTrend = { day: string; revenue: string; discount: string; tax: string };
type PaymentMethod = { method: string; total: string };
type TopCustomer = { customer__id: number; customer__name: string; total_spent: string; order_count: number };
type TopReturn = { sale_item__product__name: string; qty: string; refund_amount: string };
type Metrics = { revenue: string; cogs: string; gross_profit: string; expenses: string; net_profit: string; sales_count: number };

type DashboardData = {
  trend: DayTrend[];
  payment_methods: PaymentMethod[];
  top_customers: TopCustomer[];
  top_returns: TopReturn[];
  metrics: Metrics;
};

export default function ReportsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [reports, setReports] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const trendChartRef = useRef<HTMLCanvasElement>(null);
  const trendChartInst = useRef<any>(null);
  
  const paymentChartRef = useRef<HTMLCanvasElement>(null);
  const paymentChartInst = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const [dash, rep] = await Promise.all([
          api<DashboardData>("/analytics/dashboard-comprehensive/", { params: { days: 30 } }),
          api<{ reports: string[] }>("/reports/").catch(() => ({ reports: [] })),
        ]);
        setData(dash);
        setReports((rep as any).reports || []);
      } catch (e: any) {
        setError(e?.message || "Failed to load reports");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const Chart = (window as any).Chart;
    if (!Chart || !data) return;

    // Revenue Trend Line Chart
    if (trendChartRef.current) {
      if (trendChartInst.current) trendChartInst.current.destroy();
      trendChartInst.current = new Chart(trendChartRef.current, {
        type: "line",
        data: {
          labels: data.trend.map(t => new Date(t.day).toLocaleDateString()),
          datasets: [
            {
              label: "Revenue",
              data: data.trend.map(t => Number(t.revenue)),
              borderColor: "#008c54",
              backgroundColor: "rgba(0, 140, 84, 0.1)",
              fill: true,
              tension: 0.3
            }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }

    // Payment Methods Doughnut Chart
    if (paymentChartRef.current) {
      if (paymentChartInst.current) paymentChartInst.current.destroy();
      paymentChartInst.current = new Chart(paymentChartRef.current, {
        type: "doughnut",
        data: {
          labels: data.payment_methods.map(p => p.method.toUpperCase()),
          datasets: [
            {
              data: data.payment_methods.map(p => Number(p.total)),
              backgroundColor: ["#003f5c", "#006770", "#008c54", "#7aa609", "#ffa600"]
            }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }

    return () => {
      trendChartInst.current?.destroy();
      paymentChartInst.current?.destroy();
    };
  }, [data]);

  async function download(type: string, fmt: string) {
    try {
      const res: Response = await api(`/reports/export/`, { params: { type, export_format: fmt }, raw: true });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}.${fmt === "excel" ? "xlsx" : fmt}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.message || "Could not export");
    }
  }

  if (loading) return <Spinner label="Loading reports…" />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  return (
    <div className="vstack gap-3">
      {/* Financial Metrics Summary */}
      <div className="row g-3">
        <div className="col-12 col-md-3">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="small text-secondary">Gross Revenue (30d)</div>
              <div className="fs-4 fw-bold text-dark">{money(data.metrics.revenue)}</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-3">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="small text-secondary">Net Profit (30d)</div>
              <div className="fs-4 fw-bold text-success">{money(data.metrics.net_profit)}</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-3">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="small text-secondary">Total Orders (30d)</div>
              <div className="fs-4 fw-bold text-primary">{data.metrics.sales_count}</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-3">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="small text-secondary">Discounts Given (30d)</div>
              <div className="fs-4 fw-bold text-warning">
                {money(data.trend.reduce((acc, t) => acc + Number(t.discount), 0).toString())}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-8">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="fw-semibold mb-3">Revenue Trend (Last 30 Days)</div>
              <div style={{ height: 300 }}>
                <canvas ref={trendChartRef}></canvas>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="fw-semibold mb-3">Revenue by Payment Method</div>
              <div style={{ height: 300 }}>
                <canvas ref={paymentChartRef}></canvas>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="fw-semibold mb-3">Top Customers (Lifetime Value)</div>
              <div className="table-responsive">
                <table className="table table-striped table-sm mb-0">
                  <thead className="thead-3">
                    <tr>
                      <th>Customer</th>
                      <th className="text-end">Orders</th>
                      <th className="text-end">Total Spent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_customers.length === 0 ? (
                      <tr><td colSpan={3} className="text-secondary">No customer data.</td></tr>
                    ) : (
                      data.top_customers.map((c) => (
                        <tr key={c.customer__id}>
                          <td>{c.customer__name}</td>
                          <td className="text-end">{c.order_count}</td>
                          <td className="text-end">{money(c.total_spent)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="fw-semibold mb-3">High Return Rate Products</div>
              <div className="table-responsive">
                <table className="table table-striped table-sm mb-0">
                  <thead className="thead-3">
                    <tr>
                      <th>Product</th>
                      <th className="text-end">Qty Returned</th>
                      <th className="text-end">Refund Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_returns.length === 0 ? (
                      <tr><td colSpan={3} className="text-secondary">No return data.</td></tr>
                    ) : (
                      data.top_returns.map((r, i) => (
                        <tr key={i}>
                          <td>{r.sale_item__product__name}</td>
                          <td className="text-end text-danger">{Number(r.qty)}</td>
                          <td className="text-end text-danger">{money(r.refund_amount)}</td>
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

      <div className="card shadow-sm">
        <div className="card-body">
          <div className="fw-semibold mb-3">Export Reports</div>
          {reports.length === 0 ? (
            <div className="text-secondary small">No report types available.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead className="thead-6">
                  <tr>
                    <th>Report</th>
                    <th className="text-end">Download</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r}>
                      <td className="text-capitalize">{r.replace(/_/g, " ")}</td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-brand" onClick={() => download(r, "csv")}>
                            CSV
                          </button>
                          <button className="btn btn-outline-brand" onClick={() => download(r, "excel")}>
                            Excel
                          </button>
                          <button className="btn btn-outline-brand" onClick={() => download(r, "pdf")}>
                            PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
