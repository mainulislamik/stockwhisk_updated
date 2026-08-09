"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { ErrorState, Spinner, money } from "@/components/ui";
import toast from "react-hot-toast";

type DayTrend = { day: string; revenue: string; discount: string; tax: string };
type PaymentMethod = { method: string; total: string };
type TopCustomer = { customer__id: number; customer__name: string; total_spent: string; order_count: number };
type TopReturn = { sale_item__product__name: string; qty: string; refund_amount: string };
type Metrics = { revenue: string; cogs: string; gross_profit: string; expenses: string; net_profit: string; sales_count: number };
type Acquisition = { labels: string[]; new: number[]; returning: number[] };
type TopProduct = { product_id: number; product__name: string; qty: string; revenue: string; profit: string };
type CategorySale = { product__category__name: string | null; revenue: string };
type RecentTransaction = { id: number; invoice_number: string; created_at: string; total: number; payment_method: string; customer_name: string };
type LowStock = { id: number; name: string; sku: string; current_stock: number; reorder_level: number };

type DashboardData = {
  trend: DayTrend[];
  payment_methods: PaymentMethod[];
  top_customers: TopCustomer[];
  top_returns: TopReturn[];
  metrics: Metrics;
  customer_acquisition: Acquisition;
  top_products: TopProduct[];
  sales_by_category: CategorySale[];
  recent_transactions: RecentTransaction[];
  low_stock: LowStock[];
  out_of_stock: LowStock[];
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

  const acqChartRef = useRef<HTMLCanvasElement>(null);
  const acqChartInst = useRef<any>(null);

  const catChartRef = useRef<HTMLCanvasElement>(null);
  const catChartInst = useRef<any>(null);

  const topProdChartRef = useRef<HTMLCanvasElement>(null);
  const topProdChartInst = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const [dash, rep] = await Promise.all([
          api<DashboardData>("/analytics/dashboard-comprehensive/", { params: { days: 30 } }),
          api<{ reports: string[] }>("/reports/").catch(() => ({ reports: [] })),
        ]);
        if ((dash as any).error) {
          throw new Error((dash as any).error);
        }
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

    // 1. Revenue & Discount Trend Line Chart
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
            },
            {
              label: "Discounts Given",
              data: data.trend.map(t => Number(t.discount)),
              borderColor: "#ffa600",
              backgroundColor: "rgba(255, 166, 0, 0.1)",
              fill: true,
              tension: 0.3
            }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }

    // 2. Payment Methods Doughnut Chart
    if (paymentChartRef.current) {
      if (paymentChartInst.current) paymentChartInst.current.destroy();
      paymentChartInst.current = new Chart(paymentChartRef.current, {
        type: "doughnut",
        data: {
          labels: data.payment_methods.map(p => p.method.toUpperCase()),
          datasets: [
            {
              data: data.payment_methods.map(p => Number(p.total)),
              backgroundColor: ["#003f5c", "#2f4b7c", "#665191", "#a05195", "#d45087", "#f95d6a", "#ff7c43", "#ffa600"]
            }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }

    // 3. New vs Returning Customers Stacked Bar Chart
    if (acqChartRef.current && data.customer_acquisition) {
      if (acqChartInst.current) acqChartInst.current.destroy();
      acqChartInst.current = new Chart(acqChartRef.current, {
        type: "bar",
        data: {
          labels: data.customer_acquisition.labels,
          datasets: [
            {
              label: "New Customers",
              data: data.customer_acquisition.new,
              backgroundColor: "#008c54",
            },
            {
              label: "Returning Customers",
              data: data.customer_acquisition.returning,
              backgroundColor: "#2f4b7c",
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { stacked: true },
            y: { stacked: true }
          }
        }
      });
    }

    // 4. Sales by Category Doughnut Chart
    if (catChartRef.current && data.sales_by_category) {
      if (catChartInst.current) catChartInst.current.destroy();
      catChartInst.current = new Chart(catChartRef.current, {
        type: "doughnut",
        data: {
          labels: data.sales_by_category.map(c => c.product__category__name || "Uncategorized"),
          datasets: [
            {
              data: data.sales_by_category.map(c => Number(c.revenue)),
              backgroundColor: ["#003f5c", "#2f4b7c", "#665191", "#a05195", "#d45087", "#f95d6a", "#ff7c43", "#ffa600"]
            }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }

    // 5. Top Products Horizontal Bar Chart
    if (topProdChartRef.current && data.top_products) {
      if (topProdChartInst.current) topProdChartInst.current.destroy();
      topProdChartInst.current = new Chart(topProdChartRef.current, {
        type: "bar",
        data: {
          labels: data.top_products.map(p => p.product__name.substring(0, 20) + (p.product__name.length > 20 ? "..." : "")),
          datasets: [
            {
              label: "Revenue",
              data: data.top_products.map(p => Number(p.revenue)),
              backgroundColor: "#008c54",
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: "y", // horizontal bar
        }
      });
    }

    return () => {
      trendChartInst.current?.destroy();
      paymentChartInst.current?.destroy();
      acqChartInst.current?.destroy();
      catChartInst.current?.destroy();
      topProdChartInst.current?.destroy();
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
      toast.error(e?.message || "Could not export");
    }
  }

  if (loading) return <Spinner label="Loading reports…" />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  return (
    <div className="vstack gap-4">
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

      {/* Row 1: Trends & Payments */}
      <div className="row g-3">
        <div className="col-lg-8">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="fw-semibold mb-3">Revenue & Discount Trend (Last 30 Days)</div>
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

      {/* Row 2: Customer Acquisition & Top Products */}
      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="fw-semibold mb-3">Customer Acquisition (New vs. Returning)</div>
              <div style={{ height: 300 }}>
                <canvas ref={acqChartRef}></canvas>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="fw-semibold mb-3">Top Selling Products</div>
              <div style={{ height: 300 }}>
                <canvas ref={topProdChartRef}></canvas>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Sales by Category & Recent Transactions */}
      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="fw-semibold mb-3">Sales by Category</div>
              <div style={{ height: 300 }}>
                <canvas ref={catChartRef}></canvas>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-8">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="fw-semibold mb-3">Recent Transactions</div>
              <div className="table-responsive">
                <table className="table table-striped table-sm mb-0">
                  <thead className="thead-3">
                    <tr>
                      <th>Date</th>
                      <th>Invoice</th>
                      <th>Customer</th>
                      <th>Method</th>
                      <th className="text-end">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_transactions.length === 0 ? (
                      <tr><td colSpan={5} className="text-secondary">No transactions.</td></tr>
                    ) : (
                      data.recent_transactions.map((t) => (
                        <tr key={t.id}>
                          <td>{new Date(t.created_at).toLocaleString()}</td>
                          <td>{t.invoice_number}</td>
                          <td>{t.customer_name}</td>
                          <td className="text-capitalize">{t.payment_method}</td>
                          <td className="text-end fw-medium">{money(t.total.toString())}</td>
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

      {/* Row 4: Top Customers & High Return Products */}
      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="fw-semibold mb-3">Top Customers (Lifetime Value)</div>
              <div className="table-responsive" style={{ maxHeight: 300 }}>
                <table className="table table-striped table-sm mb-0">
                  <thead className="thead-3 sticky-top">
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
              <div className="table-responsive" style={{ maxHeight: 300 }}>
                <table className="table table-striped table-sm mb-0">
                  <thead className="thead-3 sticky-top">
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

      {/* Row 5: Low Stock Alerts */}
      <div className="card shadow-sm">
        <div className="card-body">
          <div className="fw-semibold mb-3 text-danger"><i className="bi bi-exclamation-triangle-fill me-2"></i>Inventory Status (Low & Out of Stock)</div>
          <div className="table-responsive">
            <table className="table table-striped table-sm mb-0">
              <thead className="thead-3">
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th className="text-end">Current Stock</th>
                  <th className="text-end">Reorder Level</th>
                  <th className="text-end">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.out_of_stock.map(item => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.sku}</td>
                    <td className="text-end fw-bold text-danger">{item.current_stock}</td>
                    <td className="text-end">{item.reorder_level}</td>
                    <td className="text-end"><span className="badge bg-danger">Out of Stock</span></td>
                  </tr>
                ))}
                {data.low_stock.map(item => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.sku}</td>
                    <td className="text-end fw-bold text-warning">{item.current_stock}</td>
                    <td className="text-end">{item.reorder_level}</td>
                    <td className="text-end"><span className="badge bg-warning text-dark">Low Stock</span></td>
                  </tr>
                ))}
                {data.out_of_stock.length === 0 && data.low_stock.length === 0 && (
                  <tr><td colSpan={5} className="text-secondary text-center">All inventory levels are healthy.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Legacy Reports Export */}
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
