"use client";

import { useEffect, useState } from "react";
import { fetchAll } from "@/lib/api";
import { ErrorState, Pagination, Spinner, fmtDate, usePagination } from "@/components/ui";

type Warranty = {
  id: number;
  product_name: string;
  customer_name: string | null;
  serial_no: string;
  period_months: number;
  start_date: string;
  expiry_date: string;
  status: string;
};

const statusBadge: Record<string, string> = {
  active: "text-bg-success",
  expiring_soon: "text-bg-warning",
  expired: "text-bg-secondary",
  claimed: "text-bg-info",
  void: "text-bg-dark",
};

export default function WarrantiesPage() {
  const [rows, setRows] = useState<Warranty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setRows(await fetchAll<Warranty>("/service/warranties/"));
      } catch (e: any) {
        setError(e?.message || "Failed to load warranties");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const shown = rows.filter((w) => {
    const q = filter.trim().toLowerCase();
    return !q || `${w.product_name} ${w.serial_no} ${w.customer_name || ""}`.toLowerCase().includes(q);
  });
  const { paged, page, setPage, totalPages, total } = usePagination(shown, [filter]);

  if (loading) return <Spinner label="Loading warranties…" />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="vstack gap-3">
      <input placeholder="Filter product/serial/customer…" className="form-control form-control-sm" style={{ maxWidth: "20rem" }} value={filter} onChange={(e) => setFilter(e.target.value)} />
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-striped table-sm align-middle mb-0">
            <thead className="thead-3">
              <tr>
                <th>Product</th>
                <th>Serial</th>
                <th>Customer</th>
                <th>Start</th>
                <th>Expiry</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr data-empty="">
                  <td colSpan={6} className="text-center text-secondary py-5">
                    <div style={{ fontSize: "2.5rem" }}>🛡️</div>
                    No warranties recorded.
                  </td>
                </tr>
              ) : (
                paged.map((w) => (
                  <tr key={w.id}>
                    <td className="fw-medium">{w.product_name}</td>
                    <td className="text-secondary">{w.serial_no || "—"}</td>
                    <td className="text-secondary">{w.customer_name || "—"}</td>
                    <td className="text-secondary">{fmtDate(w.start_date)}</td>
                    <td className="text-secondary">{fmtDate(w.expiry_date)}</td>
                    <td>
                      <span className={`badge ${statusBadge[w.status] || "text-bg-light"}`}>{w.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} setPage={setPage} total={total} />
      </div>
    </div>
  );
}
