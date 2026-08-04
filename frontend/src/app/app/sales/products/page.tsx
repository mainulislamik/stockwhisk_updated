"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ErrorState, Spinner, money } from "@/components/ui";

type Top = { product_id: number; product__name: string; qty: number; revenue: number; profit: number };

export default function SoldProductsPage() {
  const [rows, setRows] = useState<Top[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setRows((await api<Top[]>("/analytics/top-products/", { params: { limit: 200 } })) || []);
      } catch (e: any) {
        setError(e?.message || "Failed to load sold products");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const shown = rows.filter((r) => !filter.trim() || r.product__name.toLowerCase().includes(filter.toLowerCase()));

  if (loading) return <Spinner label="Loading sold products…" />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="vstack gap-3">
      <input placeholder="Filter product…" className="form-control form-control-sm" style={{ maxWidth: "18rem" }} value={filter} onChange={(e) => setFilter(e.target.value)} />
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-striped table-sm align-middle mb-0">
            <thead className="thead-3">
              <tr>
                <th>Product</th>
                <th className="text-end">Qty sold</th>
                <th className="text-end">Revenue</th>
                <th className="text-end">Profit</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr data-empty="">
                  <td colSpan={4} className="text-center text-secondary py-5">No sales yet.</td>
                </tr>
              ) : (
                shown.map((r) => (
                  <tr key={r.product_id}>
                    <td className="fw-medium">{r.product__name}</td>
                    <td className="text-end">{Number(r.qty)}</td>
                    <td className="text-end">{money(r.revenue)}</td>
                    <td className="text-end text-success">{money(r.profit)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
