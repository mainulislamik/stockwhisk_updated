"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { ErrorState, Spinner, money, fmtDate } from "@/components/ui";

type SaleItem = { id: number; product_name: string; quantity: string; unit_price: string; discount: string; subtotal: string };
type Payment = { id: number; amount: string; method: string; paid_at: string; note: string };
type Sale = {
  id: number;
  invoice_no: string;
  customer_name: string | null;
  sale_date: string;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  paid: string;
  due: string;
  status: string;
  note: string;
  items: SaleItem[];
  payments: Payment[];
};

export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setSale(await api<Sale>(`/sales/sales/${id}/`));
      } catch (e: any) {
        setError(e?.message || "Failed to load invoice");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <Spinner label="Loading invoice…" />;
  if (error) return <ErrorState error={error} />;
  if (!sale) return null;

  return (
    <div className="vstack gap-3">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div>
          <h1 className="h4 fw-bold text-brand mb-0">Invoice {sale.invoice_no || `#${sale.id}`}</h1>
          <div className="text-secondary small">
            {sale.customer_name || "Walk-in"} · {fmtDate(sale.sale_date)}
          </div>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-brand btn-sm" onClick={() => window.open(`/invoice/${sale.id}`, "_blank")}>
            🖨️ Print
          </button>
          <Link href="/app/sales" className="btn btn-light btn-sm">
            Back
          </Link>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-striped table-sm mb-0">
            <thead className="thead-1">
              <tr>
                <th>Product</th>
                <th className="text-end">Qty</th>
                <th className="text-end">Price</th>
                <th className="text-end">Discount</th>
                <th className="text-end">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((it) => (
                <tr key={it.id}>
                  <td>{it.product_name}</td>
                  <td className="text-end">{it.quantity}</td>
                  <td className="text-end">{money(it.unit_price)}</td>
                  <td className="text-end">{money(it.discount)}</td>
                  <td className="text-end">{money(it.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card shadow-sm">
            <div className="card-body">
              <div className="fw-semibold mb-2">Payments</div>
              {sale.payments.length === 0 ? (
                <div className="text-secondary small">No payments recorded.</div>
              ) : (
                <table className="table table-sm mb-0">
                  <tbody>
                    {sale.payments.map((p) => (
                      <tr key={p.id}>
                        <td>{fmtDate(p.paid_at)}</td>
                        <td>{p.method}</td>
                        <td className="text-end">{money(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card shadow-sm">
            <div className="card-body">
              <table className="table table-sm mb-0">
                <tbody>
                  <tr>
                    <td className="text-secondary">Subtotal</td>
                    <td className="text-end">{money(sale.subtotal)}</td>
                  </tr>
                  <tr>
                    <td className="text-secondary">Discount</td>
                    <td className="text-end">{money(sale.discount)}</td>
                  </tr>
                  <tr>
                    <td className="text-secondary">Tax</td>
                    <td className="text-end">{money(sale.tax)}</td>
                  </tr>
                  <tr className="fw-bold">
                    <td>Total</td>
                    <td className="text-end">{money(sale.total)}</td>
                  </tr>
                  <tr>
                    <td className="text-secondary">Paid</td>
                    <td className="text-end">{money(sale.paid)}</td>
                  </tr>
                  <tr>
                    <td className="text-secondary">Due</td>
                    <td className={`text-end ${Number(sale.due) > 0 ? "text-danger fw-semibold" : ""}`}>{money(sale.due)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
