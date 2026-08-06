"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Spinner } from "@/components/ui";

// Standalone route — outside /app/ layout, so no AppShell, no sidebar, no banner.

type SaleItem = {
  id: number;
  product_name: string;
  product_sku: string;
  quantity: string;
  unit_price: string;
  discount: string;
  subtotal: string;
};
type Payment = { id: number; amount: string; method: string };
type Sale = {
  id: number;
  invoice_no: string;
  bill_name: string;
  bill_phone: string;
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

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash", card: "Card", bkash: "bKash", nagad: "Nagad", bank: "Bank Transfer",
};

const STATUS_COLOR: Record<string, string> = {
  paid: "#22c55e", partial: "#f59e0b", due: "#ef4444",
  cancelled: "#6b7280", returned: "#6b7280", partially_returned: "#f59e0b",
};

function fmt(n: string | number) {
  return "৳" + Number(n).toLocaleString("en-BD", { minimumFractionDigits: 2 });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const printed = useRef(false);

  useEffect(() => {
    if (!id) return;
    api<Sale>(`/sales/sales/${id}/`)
      .then((s) => {
        setSale(s);
        if (!printed.current) {
          printed.current = true;
          setTimeout(() => window.print(), 700);
        }
      })
      .catch((e) => setError(e?.message || "Could not load invoice"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Spinner label="Loading invoice…" />
    </div>
  );
  if (error || !sale) return (
    <div className="text-center py-5">
      <div className="text-danger mb-3">{error || "Invoice not found."}</div>
      <button className="btn btn-outline-secondary" onClick={() => router.push("/app/pos")}>← Back to POS</button>
    </div>
  );

  const shopName = user?.shop_name || "StockWhisk Shop";
  const shopPhone = user?.shop_phone || "";
  const statusLabel = sale.status.replace("_", " ").toUpperCase();
  const statusColor = STATUS_COLOR[sale.status] || "#6b7280";
  const totalDiscount = sale.items.reduce((s, i) => s + Number(i.discount), 0) + Number(sale.discount);
  const paymentMethods = sale.payments.map(p => METHOD_LABEL[p.method] || p.method).join(", ");

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "24px 16px" }}>
    <>
      {/* ── Screen controls (hidden on print) ── */}
      <div className="no-print d-flex gap-2 mb-3">
        <button className="btn btn-brand" onClick={() => window.print()}>🖨️ Print / Save PDF</button>
        <button className="btn btn-outline-secondary" onClick={() => router.push("/app/pos")}>← New sale</button>
        <button className="btn btn-outline-secondary" onClick={() => router.push("/app/sales")}>All sales</button>
      </div>

      {/* ── A4 Invoice Sheet ── */}
      <div className="inv-page">

        {/* ── HEADER ── */}
        <div className="inv-header">
          {/* Left: shop info */}
          <div className="inv-shop-block">
            <div className="d-flex align-items-center gap-2 mb-1">
              <div className="inv-shop-icon">🏪</div>
              <div>
                <div className="inv-shop-name">{shopName}</div>
                <div className="inv-shop-sub">Business Management System</div>
              </div>
            </div>
            {shopPhone && <div className="inv-contact-row">📞 {shopPhone}</div>}
            {user?.email && <div className="inv-contact-row">✉ {user.email}</div>}
          </div>

          {/* Right: status + meta */}
          <div className="inv-meta-block">
            <div className="d-flex align-items-center justify-content-end gap-3 mb-2">
              <div className="inv-status-badge" style={{ background: statusColor + "1a", color: statusColor, borderColor: statusColor }}>
                ● {statusLabel}
              </div>
              <div className="inv-title-text">INVOICE</div>
            </div>
            <table className="inv-meta-table">
              <tbody>
                <tr><td className="inv-meta-label">INVOICE #</td><td className="inv-meta-val">{sale.invoice_no}</td></tr>
                <tr><td className="inv-meta-label">DATE</td><td className="inv-meta-val">{fmtDate(sale.sale_date)}</td></tr>
                {paymentMethods && <tr><td className="inv-meta-label">METHOD</td><td className="inv-meta-val">{paymentMethods}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="inv-divider" />

        {/* ── BILL TO ── */}
        <div className="inv-bill-to">
          <div className="inv-section-label">BILL TO</div>
          <div className="inv-customer-name">{sale.bill_name || "Walk-in customer"}</div>
          {sale.bill_phone && <div className="inv-customer-detail">📞 {sale.bill_phone}</div>}
        </div>

        {/* ── ITEMS TABLE ── */}
        <table className="inv-table">
          <thead>
            <tr>
              <th className="inv-th-center" style={{ width: "5%" }}>#</th>
              <th style={{ width: "65%" }}>Product Description</th>
              <th className="inv-th-center" style={{ width: "10%" }}>Qty</th>
              <th className="inv-th-right" style={{ width: "20%" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item, i) => (
              <tr key={item.id} className={i % 2 === 0 ? "inv-row-even" : "inv-row-odd"}>
                <td className="inv-td-center inv-row-no">{String(i + 1).padStart(2, "0")}</td>
                <td className="inv-product-name">{item.product_name}</td>
                <td className="inv-td-center">{item.quantity}</td>
                <td className="inv-td-right inv-line-total">{fmt(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── FOOTER SECTION (avoid page break inside) ── */}
        <div className="inv-footer-row">
          {/* Notes (left) */}
          <div className="inv-notes">
            {sale.note ? (
              <>
                <div className="inv-section-label">NOTES</div>
                <div className="inv-note-text">{sale.note}</div>
              </>
            ) : (
              <div className="inv-thank-you">© Thank you for your business!</div>
            )}
          </div>

          {/* Totals (right) */}
          <div className="inv-totals">
            <div className="inv-total-row">
              <span>Subtotal</span><span>{fmt(sale.subtotal)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="inv-total-row inv-disc-row">
                <span>Total Discounts</span><span>-{fmt(totalDiscount)}</span>
              </div>
            )}
            {Number(sale.tax) > 0 && (
              <div className="inv-total-row">
                <span>VAT / Tax</span><span>{fmt(sale.tax)}</span>
              </div>
            )}
            <div className="inv-grand-row">
              <span>GRAND TOTAL</span><span>{fmt(sale.total)}</span>
            </div>
            {Number(sale.paid) > 0 && (
              <div className="inv-total-row inv-paid-row">
                <span>Paid Amount</span><span>-{fmt(sale.paid)}</span>
              </div>
            )}
            <div className={`inv-total-row inv-due-row ${Number(sale.due) > 0 ? "inv-due-outstanding" : "inv-due-clear"}`}>
              <span>Balance Due</span><span>{fmt(sale.due)}</span>
            </div>
          </div>
        </div>

        {/* Thank you line when there IS a note */}
        {sale.note && <div className="inv-thank-you">© Thank you for your business!</div>}
      </div>

      {/* ── Styles ── */}
      <style>{`
        /* ── Base ── */
        .inv-page {
          background: #fff;
          color: #1a1a2e;
          font-family: 'Segoe UI', system-ui, sans-serif;
          font-size: 10.5pt;
          max-width: 794px;
          margin: 0 auto;
          padding: 32px 36px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          box-shadow: 0 2px 12px rgba(0,0,0,.08);
        }

        /* ── Header ── */
        .inv-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
          margin-bottom: 20px;
        }
        .inv-shop-icon { font-size: 2rem; line-height: 1; }
        .inv-shop-name { font-size: 18pt; font-weight: 700; color: #0f172a; line-height: 1.1; }
        .inv-shop-sub { font-size: 8.5pt; color: #64748b; }
        .inv-contact-row { font-size: 8pt; color: #475569; margin-top: 2px; }

        /* Right meta */
        .inv-meta-block { text-align: right; flex-shrink: 0; }
        .inv-status-badge {
          display: inline-block;
          font-size: 7.5pt;
          font-weight: 700;
          letter-spacing: .05em;
          padding: 3px 10px;
          border: 1px solid;
          border-radius: 999px;
        }
        .inv-title-text {
          font-size: 22pt;
          font-weight: 800;
          color: #2563eb;
          letter-spacing: .05em;
        }
        .inv-meta-table { margin-left: auto; }
        .inv-meta-label { font-size: 7.5pt; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; padding-right: 12px; white-space: nowrap; }
        .inv-meta-val { font-size: 9pt; font-weight: 600; text-align: right; white-space: nowrap; }

        /* ── Divider ── */
        .inv-divider { border: none; border-top: 1.5px solid #e2e8f0; margin: 16px 0; }

        /* ── Bill To ── */
        .inv-bill-to { margin-bottom: 16px; }
        .inv-section-label { font-size: 7.5pt; color: #94a3b8; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 4px; }
        .inv-customer-name { font-size: 12pt; font-weight: 700; color: #0f172a; }
        .inv-customer-detail { font-size: 8.5pt; color: #475569; margin-top: 2px; }

        /* ── Items Table ── */
        .inv-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 0;
          font-size: 9pt;
        }
        .inv-table thead tr {
          background: #1e293b;
          color: #fff;
        }
        .inv-table th {
          padding: 7px 10px;
          font-size: 8pt;
          font-weight: 600;
          letter-spacing: .04em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .inv-th-center { text-align: center; }
        .inv-th-right { text-align: right; }
        .inv-table td { padding: 6px 10px; vertical-align: middle; }
        .inv-row-even { background: #f8fafc; }
        .inv-row-odd { background: #fff; }
        .inv-table tbody tr { border-bottom: 1px solid #f1f5f9; }
        .inv-row-no { font-weight: 600; color: #64748b; font-size: 8pt; }
        .inv-product-name { font-weight: 500; color: #1e293b; }
        .inv-sku { font-family: monospace; font-size: 8pt; color: #64748b; }
        .inv-td-center { text-align: center; }
        .inv-td-right { text-align: right; }
        .inv-disc { color: #ef4444; font-weight: 600; }
        .inv-zero { color: #94a3b8; }
        .inv-line-total { font-weight: 700; color: #0f172a; }

        /* ── Footer row ── */
        .inv-footer-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 2rem;
          margin-top: 20px;
          page-break-inside: avoid;
          border-top: 1.5px solid #e2e8f0;
          padding-top: 16px;
        }
        .inv-notes { flex: 1; max-width: 55%; }
        .inv-note-text { font-size: 8.5pt; color: #475569; line-height: 1.5; margin-top: 4px; }

        /* Totals */
        .inv-totals { min-width: 240px; }
        .inv-total-row {
          display: flex;
          justify-content: space-between;
          font-size: 9pt;
          padding: 3px 0;
          color: #475569;
          border-bottom: 1px solid #f1f5f9;
        }
        .inv-total-row span:last-child { font-weight: 500; color: #1e293b; }
        .inv-disc-row span { color: #ef4444 !important; }
        .inv-paid-row span { color: #16a34a !important; }
        .inv-due-outstanding span { color: #ef4444 !important; font-weight: 700 !important; }
        .inv-due-clear span { color: #16a34a !important; }
        .inv-grand-row {
          display: flex;
          justify-content: space-between;
          font-size: 14pt;
          font-weight: 800;
          color: #0f172a;
          padding: 8px 0;
          border-top: 2px solid #0f172a;
          border-bottom: 2px solid #0f172a;
          margin: 4px 0;
        }

        /* Thank you */
        .inv-thank-you {
          font-size: 9pt;
          color: #2563eb;
          font-style: italic;
          font-weight: 500;
          margin-top: 20px;
          text-align: center;
        }

        /* ── Screen wrapper ── */
        .inv-screen-wrapper {
          min-height: 100vh;
          background: #f1f5f9;
          padding: 24px 16px;
        }

        /* ── Print ── */
        @media print {
          @page { size: A4; margin: 12mm 14mm; }
          .no-print { display: none !important; }
          .inv-screen-wrapper {
            background: #fff !important;
            padding: 0 !important;
            min-height: unset !important;
          }
          .inv-page {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
            font-size: 9.5pt;
          }
          /* Repeat column headers on every page */
          .inv-table thead { display: table-header-group; }
          /* Keep footer (totals + notes) together on same page */
          .inv-footer-row { page-break-inside: avoid; }
          .inv-thank-you { page-break-inside: avoid; }
        }
      `}</style>
    </>
    </div>
  );
}
