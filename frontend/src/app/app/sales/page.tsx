"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchAll } from "@/lib/api";
import { ErrorState, Pagination, Spinner, money, fmtDate, usePagination } from "@/components/ui";

type Sale = {
  id: number;
  invoice_no: string;
  customer_name: string | null;
  sale_date: string;
  total: string;
  paid: string;
  due: string;
  status: string;
};

const statusBadge: Record<string, string> = {
  PAID: "text-bg-success",
  PARTIAL: "text-bg-warning",
  DUE: "text-bg-danger",
  CANCELLED: "text-bg-secondary",
};

export default function SalesPage() {
  const [rows, setRows] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setRows(await fetchAll<Sale>("/sales/sales/"));
      } catch (e: any) {
        setError(e?.message || "Failed to load sales");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const shown = rows.filter((s) => {
    const q = filter.trim().toLowerCase();
    return !q || `${s.invoice_no} ${s.customer_name || ""}`.toLowerCase().includes(q);
  });
  const { paged, page, setPage, totalPages, total } = usePagination(shown, [filter]);

  if (loading) return <Spinner label="Loading invoices…" />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="vstack gap-3">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <input placeholder="Filter invoice/customer…" className="form-control form-control-sm" style={{ maxWidth: "18rem" }} value={filter} onChange={(e) => setFilter(e.target.value)} />
        <Link href="/app/pos" className="btn btn-brand btn-sm">
          🛒 New sale (POS)
        </Link>
      </div>
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-striped table-sm align-middle mb-0">
            <thead className="thead-3">
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Date</th>
                <th className="text-end">Total</th>
                <th className="text-end">Paid</th>
                <th className="text-end">Due</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr data-empty="">
                  <td colSpan={8} className="text-center text-secondary py-5">
                    <div style={{ fontSize: "2.5rem" }}>🧾</div>
                    No invoices yet.
                  </td>
                </tr>
              ) : (
                paged.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/app/sales/${s.id}`} className="text-decoration-none fw-medium">
                        {s.invoice_no || `#${s.id}`}
                      </Link>
                    </td>
                    <td className="text-secondary">{s.customer_name || "Walk-in"}</td>
                    <td className="text-secondary">{fmtDate(s.sale_date)}</td>
                    <td className="text-end">{money(s.total)}</td>
                    <td className="text-end">{money(s.paid)}</td>
                    <td className={`text-end ${Number(s.due) > 0 ? "text-danger fw-semibold" : ""}`}>{money(s.due)}</td>
                    <td>
                      <span className={`badge ${statusBadge[s.status] || "text-bg-light"}`}>{s.status}</span>
                    </td>
                    <td className="text-end">
                      <Link href={`/app/sales/${s.id}`} className="small text-decoration-none">
                        View
                      </Link>
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
