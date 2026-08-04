"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchAll } from "@/lib/api";
import { ErrorState, Spinner, money, fmtDate } from "@/components/ui";

type Item = { id: number; product_name: string; quantity: string; unit_price: string; discount: string; subtotal: string };
type Sale = { id: number; invoice_no: string; customer_name: string | null; sale_date: string; items: Item[] };
type Row = { saleId: number; invoice: string; customer: string; date: string; item: Item };

export default function SellingDetailsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const sales = await fetchAll<Sale>("/sales/sales/");
        const flat: Row[] = [];
        sales.forEach((s) => {
          (s.items || []).forEach((it) => {
            flat.push({ saleId: s.id, invoice: s.invoice_no || `#${s.id}`, customer: s.customer_name || "Walk-in", date: s.sale_date, item: it });
          });
        });
        setRows(flat);
      } catch (e: any) {
        setError(e?.message || "Failed to load selling details");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const shown = rows.filter((r) => {
    const q = filter.trim().toLowerCase();
    return !q || `${r.invoice} ${r.customer} ${r.item.product_name}`.toLowerCase().includes(q);
  });

  if (loading) return <Spinner label="Loading selling details…" />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="vstack gap-3">
      <input placeholder="Filter invoice/customer/product…" className="form-control form-control-sm" style={{ maxWidth: "20rem" }} value={filter} onChange={(e) => setFilter(e.target.value)} />
      <div className="card shadow-sm">
        <div className="table-responsive">
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
              {shown.length === 0 ? (
                <tr data-empty="">
                  <td colSpan={7} className="text-center text-secondary py-5">No sales yet.</td>
                </tr>
              ) : (
                shown.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <Link href={`/app/sales/${r.saleId}`} className="text-decoration-none">
                        {r.invoice}
                      </Link>
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
      </div>
    </div>
  );
}
