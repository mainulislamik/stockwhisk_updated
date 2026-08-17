"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { ErrorState, Spinner, money, fmtDate } from "@/components/ui";

type Item = { id: string; product_name: string; quantity: string; unit_price: string; discount: string; subtotal: string };
type FlatRow = { saleId: number; type: string; invoice: string; customer: string; date: string; item: Item };
type Page = { count: number; next: string | null; previous: string | null; results: FlatRow[] };

const PAGE_SIZE = 25;

export default function SellingDetailsPage() {
  const [data, setData] = useState<Page | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");

  // Debounce the filter box into the server `search` param; reset to page 1.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(filter.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [filter]);

  // Fetch ONLY the current page (constant-size request, independent of total rows).
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
    if (search) qs.set("search", search);
    api<Page>(`/reports/selling-details/?${qs.toString()}`)
      .then((d) => { if (alive) { setData(d); setError(""); } })
      .catch((e: any) => { if (alive) setError(e?.message || "Failed to load selling details"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [page, search]);

  // The backend now returns the flattened rows directly.
  const rows = useMemo(() => {
    return data?.results || [];
  }, [data]);

  const count = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="vstack gap-3">
      <input
        placeholder="Filter invoice/customer/product…"
        className="form-control form-control-sm" style={{ maxWidth: "20rem" }}
        value={filter} onChange={(e) => setFilter(e.target.value)}
      />

      {error ? (
        <ErrorState error={error} />
      ) : (
        <div className="card shadow-sm">
          <div className="table-responsive position-relative">
            {loading && (
              <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ background: "rgba(255,255,255,.5)", zIndex: 2 }}>
                <Spinner label="Loading…" />
              </div>
            )}
            <table className="table table-striped table-sm align-middle mb-0">
              <thead className="thead-2">
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th className="text-end">Qty</th>
                  <th className="text-end">Price</th>
                  <th className="text-end">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !loading ? (
                  <tr data-empty="">
                    <td colSpan={7} className="text-center text-secondary py-5">
                      {search ? "No matching sales." : "No sales yet."}
                    </td>
                  </tr>
                ) : (
                  rows.map((r, i) => (
                    <tr key={r.item.id}>
                      <td>
                        <Link href={r.type === 'ticket' ? `/app/service/tickets/${r.saleId}` : `/app/sales/${r.saleId}`} className="text-decoration-none">{r.invoice}</Link>
                      </td>
                      <td className="text-secondary">{fmtDate(r.date)}</td>
                      <td className="text-secondary">{r.customer}</td>
                      <td>{r.item.product_name}</td>
                      <td className="text-end">{r.item.quantity}</td>
                      <td className="text-end">{money(r.item.unit_price)}</td>
                      <td className="text-end">{money(r.item.subtotal)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 p-2 border-top">
            <span className="small text-secondary">
              {count.toLocaleString()} invoice{count === 1 ? "" : "s"} · Page {page} of {totalPages}
            </span>
            <div className="btn-group btn-group-sm">
              <button className="btn btn-outline-secondary" disabled={loading || !data?.previous} onClick={() => setPage(1)} title="First">«</button>
              <button className="btn btn-outline-secondary" disabled={loading || !data?.previous} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
              <button className="btn btn-outline-secondary" disabled={loading || !data?.next} onClick={() => setPage((p) => p + 1)}>Next ›</button>
              <button className="btn btn-outline-secondary" disabled={loading || !data?.next} onClick={() => setPage(totalPages)} title="Last">»</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
