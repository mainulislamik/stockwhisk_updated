"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { ErrorState, Spinner, money, fmtDate } from "@/components/ui";

/* ── Types ─────────────────────────────────────────────────────────── */
type SaleItem = { id: number; product_name: string; quantity: string; unit_price: string; discount: string; subtotal: string };
type Sale = { id: number; invoice_no: string; customer_name: string | null; sale_date: string; items: SaleItem[] };
type SalesPage = { count: number; next: string | null; previous: string | null; results: Sale[] };

type TicketPart = { id: number; product_name?: string; quantity: string; unit_price: string };
type Ticket = {
  id: number; ticket_no: string; customer_name: string | null; updated_at: string;
  status: string; service_charge: string; discount: string; bill_total: string;
  parts: TicketPart[];
};
type TicketPage = { count: number; next: string | null; previous: string | null; results: Ticket[] };

type FlatRow = {
  key: string; refId: number; type: "sale" | "ticket";
  invoice: string; customer: string; date: string;
  productName: string; qty: string; price: string; subtotal: string;
};

const PAGE_SIZE = 25;

/* ── Helpers ────────────────────────────────────────────────────────── */
function saleRows(sales: Sale[]): FlatRow[] {
  const out: FlatRow[] = [];
  sales.forEach((s) => {
    (s.items || []).forEach((it, i) => {
      out.push({
        key: `sale-${s.id}-${it.id}-${i}`,
        refId: s.id, type: "sale",
        invoice: s.invoice_no || `#${s.id}`,
        customer: s.customer_name || "Walk-in",
        date: s.sale_date,
        productName: it.product_name,
        qty: it.quantity,
        price: it.unit_price,
        subtotal: it.subtotal,
      });
    });
  });
  return out;
}

function ticketRows(tickets: Ticket[]): FlatRow[] {
  const out: FlatRow[] = [];
  tickets.forEach((t) => {
    // Parts used on the ticket
    (t.parts || []).forEach((p, i) => {
      const sub = (parseFloat(p.quantity || "0") * parseFloat(p.unit_price || "0")).toFixed(2);
      out.push({
        key: `ticket-part-${t.id}-${p.id}-${i}`,
        refId: t.id, type: "ticket",
        invoice: t.ticket_no || `#${t.id}`,
        customer: t.customer_name || "Walk-in",
        date: t.updated_at?.slice(0, 10) || "",
        productName: p.product_name || "Part",
        qty: p.quantity,
        price: p.unit_price,
        subtotal: sub,
      });
    });
    // Service charge row
    const svc = parseFloat(t.service_charge || "0");
    const disc = parseFloat(t.discount || "0");
    if (svc > 0) {
      const sub = Math.max(0, svc - disc).toFixed(2);
      out.push({
        key: `ticket-svc-${t.id}`,
        refId: t.id, type: "ticket",
        invoice: t.ticket_no || `#${t.id}`,
        customer: t.customer_name || "Walk-in",
        date: t.updated_at?.slice(0, 10) || "",
        productName: "Service Charge",
        qty: "1",
        price: t.service_charge,
        subtotal: sub,
      });
    }
  });
  return out;
}

/* ── Page ───────────────────────────────────────────────────────────── */
export default function SellingDetailsPage() {
  const [salesData, setSalesData] = useState<SalesPage | null>(null);
  const [ticketData, setTicketData] = useState<TicketPage | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(filter.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [filter]);

  // Fetch both APIs in parallel
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
    if (search) qs.set("search", search);

    const salesQs = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
    if (search) salesQs.set("search", search);

    const ticketQs = new URLSearchParams({ status: "delivered", page_size: "100" });
    if (search) ticketQs.set("search", search);

    Promise.all([
      api<SalesPage>(`/sales/sales/?${salesQs.toString()}`),
      api<TicketPage>(`/service/tickets/?${ticketQs.toString()}`).catch(() => null),
    ])
      .then(([sales, tickets]) => {
        if (!alive) return;
        setSalesData(sales);
        setTicketData(tickets);
        setError("");
      })
      .catch((e: any) => { if (alive) setError(e?.message || "Failed to load selling details"); })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [page, search]);

  // Merge both into flat rows, sorted by date descending
  const rows = useMemo<FlatRow[]>(() => {
    const all: FlatRow[] = [
      ...saleRows(salesData?.results || []),
      ...ticketRows((ticketData?.results || []).filter((t) => t.status === "delivered")),
    ];
    all.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
    return all;
  }, [salesData, ticketData]);

  const count = (salesData?.count ?? 0) + (ticketData?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil((salesData?.count ?? 0) / PAGE_SIZE));

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
                  <th>Product / Service</th>
                  <th className="text-end">Qty</th>
                  <th className="text-end">Price</th>
                  <th className="text-end">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !loading ? (
                  <tr data-empty="">
                    <td colSpan={7} className="text-center text-secondary py-5">
                      {search ? "No matching records." : "No records yet."}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.key}>
                      <td>
                        <Link
                          href={r.type === "ticket" ? `/app/service/tickets/${r.refId}` : `/app/sales/${r.refId}`}
                          className="text-decoration-none"
                        >
                          {r.invoice}
                        </Link>
                        {r.type === "ticket" && (
                          <span className="badge bg-info ms-1" style={{ fontSize: "0.65rem" }}>Repair</span>
                        )}
                      </td>
                      <td className="text-secondary">{fmtDate(r.date)}</td>
                      <td className="text-secondary">{r.customer}</td>
                      <td>{r.productName}</td>
                      <td className="text-end">{r.qty}</td>
                      <td className="text-end">{money(r.price)}</td>
                      <td className="text-end">{money(r.subtotal)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 p-2 border-top">
            <span className="small text-secondary">
              {count.toLocaleString()} total records · Page {page} of {totalPages}
            </span>
            <div className="btn-group btn-group-sm">
              <button className="btn btn-outline-secondary" disabled={loading || !salesData?.previous} onClick={() => setPage(1)} title="First">«</button>
              <button className="btn btn-outline-secondary" disabled={loading || !salesData?.previous} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
              <button className="btn btn-outline-secondary" disabled={loading || !salesData?.next} onClick={() => setPage((p) => p + 1)}>Next ›</button>
              <button className="btn btn-outline-secondary" disabled={loading || !salesData?.next} onClick={() => setPage(totalPages)} title="Last">»</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
