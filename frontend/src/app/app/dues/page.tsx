"use client";

import { useEffect, useState } from "react";
import { fetchAll } from "@/lib/api";
import { ErrorState, Pagination, Spinner, money, fmtDate, usePagination } from "@/components/ui";

type Customer = {
  id: number;
  name: string;
  phone: string;
  due_balance: string;
  last_purchase_at: string | null;
};

export default function DuesPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setRows(await fetchAll<Customer>("/crm/customers/", { with_due: 1 }));
      } catch (e: any) {
        setError(e?.message || "Failed to load dues");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const { paged, page, setPage, totalPages, total: rowCount } = usePagination(rows);

  if (loading) return <Spinner label="Loading dues…" />;
  if (error) return <ErrorState error={error} />;

  const total = rows.reduce((s, c) => s + Number(c.due_balance || 0), 0);

  return (
    <div className="vstack gap-3">
      <div className="card shadow-sm">
        <div className="card-body d-flex justify-content-between align-items-center">
          <span className="fw-semibold">Total receivables</span>
          <span className="fs-4 fw-bold text-danger">{money(total)}</span>
        </div>
      </div>
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-striped table-sm align-middle mb-0">
            <thead className="thead-5">
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Last purchase</th>
                <th className="text-end">Due</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr data-empty="">
                  <td colSpan={4} className="text-center text-secondary py-5">
                    <div style={{ fontSize: "2.5rem" }}>💰</div>
                    No outstanding dues.
                  </td>
                </tr>
              ) : (
                paged.map((c) => (
                  <tr key={c.id}>
                    <td className="fw-medium">{c.name}</td>
                    <td className="text-secondary">{c.phone || "—"}</td>
                    <td className="text-secondary">{fmtDate(c.last_purchase_at)}</td>
                    <td className="text-end text-danger fw-semibold">{money(c.due_balance)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} setPage={setPage} total={rowCount} />
      </div>
    </div>
  );
}
