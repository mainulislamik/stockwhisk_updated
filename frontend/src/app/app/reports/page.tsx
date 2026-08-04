"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { ErrorState, Spinner, money } from "@/components/ui";

type TopProduct = { product_id: number; product__name: string; qty: number; revenue: number; profit: number };
type CategorySale = { category__name: string | null; revenue: number };

export default function ReportsPage() {
  const [top, setTop] = useState<TopProduct[]>([]);
  const [catSales, setCatSales] = useState<CategorySale[]>([]);
  const [reports, setReports] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInst = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const [t, cs, cat] = await Promise.all([
          api<TopProduct[]>("/analytics/top-products/", { params: { limit: 10 } }).catch(() => []),
          api<CategorySale[]>("/analytics/sales-by-category/").catch(() => []),
          api<{ reports: string[] }>("/reports/").catch(() => ({ reports: [] })),
        ]);
        setTop(t as TopProduct[]);
        setCatSales(cs as CategorySale[]);
        setReports((cat as any).reports || []);
      } catch (e: any) {
        setError(e?.message || "Failed to load reports");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const Chart = (window as any).Chart;
    if (!Chart || !catSales.length || !chartRef.current) return;
    if (chartInst.current) chartInst.current.destroy();
    chartInst.current = new Chart(chartRef.current, {
      type: "bar",
      data: {
        labels: catSales.map((c) => c.category__name || "Uncategorized"),
        datasets: [
          {
            label: "Revenue",
            data: catSales.map((c) => Number(c.revenue)),
            backgroundColor: ["#003f5c", "#006770", "#008c54", "#7aa609", "#ffa600", "#456882"],
          },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    });
    return () => chartInst.current?.destroy();
  }, [catSales]);

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

  return (
    <div className="vstack gap-3">
      <div className="row g-3">
        <div className="col-lg-7">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="fw-semibold mb-3">Sales by category</div>
              <div style={{ height: 280 }}>
                <canvas ref={chartRef}></canvas>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="fw-semibold mb-3">Top products</div>
              <div className="table-responsive">
                <table className="table table-striped table-sm mb-0">
                  <thead className="thead-3">
                    <tr>
                      <th>Product</th>
                      <th className="text-end">Qty</th>
                      <th className="text-end">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-secondary">No sales data.</td>
                      </tr>
                    ) : (
                      top.map((p) => (
                        <tr key={p.product_id}>
                          <td>{p.product__name}</td>
                          <td className="text-end">{Number(p.qty)}</td>
                          <td className="text-end">{money(p.revenue)}</td>
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
          <div className="fw-semibold mb-3">Export reports</div>
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
