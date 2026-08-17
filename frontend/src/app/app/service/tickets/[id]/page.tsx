"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { ErrorState, Spinner, money, fmtDate } from "@/components/ui";
import toast from "react-hot-toast";

type Part = { id: number; product_name: string; warranty_months?: number; quantity: string; unit_cost: string; unit_price: string; line_total: string };
type History = { id: number; from_status: string; to_status: string; note: string; created_at: string };
type Ticket = {
  id: number;
  ticket_no: string;
  device_description: string;
  complaint: string;
  status: string;
  service_charge: string;
  received_at: string;
  estimated_delivery: string | null;
  is_overdue: boolean;
  customer_name?: string;
  customer_phone?: string;
  paid: string;
  parts_total: string;
  bill_total: string;
  due: string;
  parts: Part[];
  history: History[];
};
type ProductHit = { id: number; name: string; sku: string; selling_price: string };

const STATUSES = ["received", "diagnosing", "awaiting_parts", "in_repair", "ready_for_pickup", "delivered", "cancelled"];

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isOwner, can, user } = useAuth();
  const canManage = isOwner || can("manage_service");  // status change is a write
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  // Add-product-to-ticket state
  const [prodSearch, setProdSearch] = useState("");
  const [prodHits, setProdHits] = useState<ProductHit[]>([]);
  const [picked, setPicked] = useState<ProductHit | null>(null);
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [addingPart, setAddingPart] = useState(false);

  // Edit service charge state
  const [editingCharge, setEditingCharge] = useState(false);
  const [chargeVal, setChargeVal] = useState("");

  useEffect(() => {
    if (picked || prodSearch.trim().length < 1) { setProdHits([]); return; }
    let active = true;
    const t = setTimeout(async () => {
      try {
        const d = await api<{ results: ProductHit[] }>(`/catalog/products/`, { params: { search: prodSearch.trim(), page_size: 8, light: 1 } });
        if (active) setProdHits(d.results || []);
      } catch { if (active) setProdHits([]); }
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [prodSearch, picked]);

  async function addPart(e: React.FormEvent) {
    e.preventDefault();
    if (!picked) { toast.error("Pick a product first"); return; }
    setAddingPart(true);
    try {
      await api(`/service/tickets/${id}/add_part/`, {
        method: "POST",
        body: {
          product: picked.id,
          quantity: Math.max(1, Math.round(Number(qty) || 1)),
          unit_price: price === "" ? undefined : Math.max(0, Number(price)),
          from_stock: true,
        },
      });
      setPicked(null); setProdSearch(""); setProdHits([]); setQty("1"); setPrice("");
      await load();
      toast.success("Product added to ticket");
    } catch (e: any) {
      toast.error(e?.message || "Could not add product");
    } finally {
      setAddingPart(false);
    }
  }

  async function load() {
    try {
      const t = await api<Ticket>(`/service/tickets/${id}/`);
      setTicket(t);
      setStatus(t.status);
      setChargeVal(t.service_charge);
    } catch (e: any) {
      setError(e?.message || "Failed to load ticket");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [id]);

  async function changeStatus() {
    try {
      await api(`/service/tickets/${id}/change_status/`, { method: "POST", body: { status } });
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Could not change status");
    }
  }

  const updateCharge = async () => {
    try {
      const fresh = await api<Ticket>(`/service/tickets/${id}/`, {
        method: "PATCH",
        body: { service_charge: chargeVal || "0" }
      });
      setTicket(fresh);
      setEditingCharge(false);
      toast.success("Service charge updated");
    } catch (e: any) {
      toast.error(e.message || "Failed to update charge");
    }
  };

  if (loading) return <Spinner label="Loading ticket…" />;
  if (error) return <ErrorState error={error} />;
  if (!ticket) return null;

  return (
    <>
      {/* ── Screen layout (hidden on print) ── */}
      <div className="vstack gap-3 d-print-none">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div>
          <h1 className="h4 fw-bold text-brand mb-0">Ticket {ticket.ticket_no || `#${ticket.id}`}</h1>
          <div className="text-secondary small">
            {ticket.device_description} · received {fmtDate(ticket.received_at)}
          </div>
        </div>
        <div className="d-flex gap-2 d-print-none">
          <button className="btn btn-brand btn-sm" onClick={() => window.print()}>
            <i className="bi bi-printer me-1"></i> Print
          </button>
          <Link href="/app/service/tickets" className="btn btn-light btn-sm">
            Back
          </Link>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-7">
          <div className="card shadow-sm">
            <div className="card-body">
              {(ticket.customer_name || ticket.customer_phone) && (
                <div className="mb-3">
                  <div className="fw-semibold mb-1">Customer</div>
                  <div>{ticket.customer_name || "Walk-in"}</div>
                  {ticket.customer_phone && <div className="text-secondary small">📞 {ticket.customer_phone}</div>}
                </div>
              )}
              <div className="fw-semibold mb-2">Complaint</div>
              <p className="mb-3">{ticket.complaint}</p>
              <div className="fw-semibold mb-2">Products &amp; parts</div>
              {ticket.parts.length === 0 ? (
                <div className="text-secondary small mb-2">No products added.</div>
              ) : (
                <table className="table table-sm mb-2">
                  <thead>
                    <tr className="text-secondary small">
                      <th>Product</th>
                      <th className="text-end">Qty</th>
                      <th className="text-end">Price</th>
                      <th className="text-end">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ticket.parts.map((p) => (
                      <tr key={p.id}>
                        <td>
                          {p.product_name}
                          {p.warranty_months ? (
                            <div className="text-success" style={{ fontSize: "0.75rem" }}>{p.warranty_months} months warranty</div>
                          ) : null}
                        </td>
                        <td className="text-end">{p.quantity}</td>
                        <td className="text-end">{money(p.unit_price)}</td>
                        <td className="text-end">{money(p.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {canManage && (
                <form onSubmit={addPart} className="border-top pt-3 mt-2">
                  <div className="fw-semibold small mb-2">Sell a product to this customer</div>
                  <div className="position-relative mb-2">
                    {picked ? (
                      <div className="d-flex align-items-center justify-content-between border rounded px-2 py-1">
                        <span className="small"><b>{picked.name}</b> {picked.sku && <span className="text-secondary">· {picked.sku}</span>}</span>
                        <button type="button" className="btn btn-sm btn-link text-danger p-0" onClick={() => { setPicked(null); setPrice(""); }}>Change</button>
                      </div>
                    ) : (
                      <>
                        <input className="form-control form-control-sm" placeholder="Search product by name / SKU…"
                          value={prodSearch} onChange={(e) => setProdSearch(e.target.value)} />
                        {prodHits.length > 0 && (
                          <div className="list-group position-absolute w-100 shadow-sm" style={{ zIndex: 20, maxHeight: 220, overflowY: "auto" }}>
                            {prodHits.map((h) => (
                              <button type="button" key={h.id} className="list-group-item list-group-item-action py-1 small"
                                onClick={() => { setPicked(h); setPrice(String(h.selling_price ?? "")); setProdHits([]); setProdSearch(""); }}>
                                <b>{h.name}</b> {h.sku && <span className="text-secondary">· {h.sku}</span>} <span className="float-end">{money(h.selling_price)}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="row g-2 align-items-end">
                    <div className="col-4">
                      <label className="small">Qty</label>
                      <input type="number" step="1" min="1" className="form-control form-control-sm" value={qty} onChange={(e) => setQty(e.target.value)} />
                    </div>
                    <div className="col-4">
                      <label className="small">Sell price</label>
                      <input type="number" step="0.01" min="0" className="form-control form-control-sm" value={price} onChange={(e) => setPrice(e.target.value)} />
                    </div>
                    <div className="col-4">
                      <button className="btn btn-brand btn-sm w-100" disabled={addingPart || !picked}>
                        {addingPart ? "Adding…" : "Add product"}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="card shadow-sm">
            <div className="card-body">
              <div className="fw-semibold mb-2">Status</div>
              {canManage ? (
                <div className="input-group input-group-sm mb-3">
                  <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                  <button className="btn btn-brand" onClick={changeStatus}>
                    Update
                  </button>
                </div>
              ) : (
                <div className="mb-3"><span className="badge text-bg-secondary">{status.replace(/_/g, " ")}</span></div>
              )}
              
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span className="text-secondary">Service charge</span>
                {editingCharge ? (
                  <div className="input-group input-group-sm" style={{ width: '130px' }}>
                    <input type="number" step="0.01" className="form-control" value={chargeVal} onChange={e => setChargeVal(e.target.value)} />
                    <button className="btn btn-brand" onClick={updateCharge}><i className="bi bi-check2"></i></button>
                    <button className="btn btn-light border" onClick={() => { setEditingCharge(false); setChargeVal(ticket.service_charge); }}><i className="bi bi-x"></i></button>
                  </div>
                ) : (
                  <span>
                    {money(ticket.service_charge)}
                    {canManage && (
                      <button className="btn btn-sm btn-link text-secondary p-0 ms-2 text-decoration-none" onClick={() => setEditingCharge(true)}>
                        <i className="bi bi-pencil-square"></i> Edit
                      </button>
                    )}
                  </span>
                )}
              </div>
              <div className="d-flex justify-content-between mb-1">
                <span className="text-secondary">Products &amp; parts</span>
                <span>{money(ticket.parts_total)}</span>
              </div>
              <div className="d-flex justify-content-between fw-semibold border-top pt-1 mt-1">
                <span>Bill total</span>
                <span>{money(ticket.bill_total)}</span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-secondary">Paid</span>
                <span>{money(ticket.paid)}</span>
              </div>
              <div className="d-flex justify-content-between fw-semibold">
                <span>Due</span>
                <span className={Number(ticket.due) > 0 ? "text-danger" : "text-success"}>{money(ticket.due)}</span>
              </div>
              <div className="d-flex justify-content-between mt-1">
                <span className="text-secondary">Est. delivery</span>
                <span>{fmtDate(ticket.estimated_delivery)}</span>
              </div>

              <div className="fw-semibold mt-3 mb-2">History</div>
              {ticket.history.length === 0 ? (
                <div className="text-secondary small">No status changes.</div>
              ) : (
                <ul className="list-unstyled small mb-0">
                  {ticket.history.map((h) => (
                    <li key={h.id} className="border-bottom py-1">
                      <span className="text-secondary">{fmtDate(h.created_at)}</span> — {h.from_status || "—"} → <b>{h.to_status}</b>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* ── A4 Ticket Sheet (Print Only) ── */}
      <div className="inv-page d-none d-print-block">
        <div className="inv-header">
          <div className="inv-shop-block">
            <div className="d-flex align-items-center gap-2 mb-1">
              <div className="inv-shop-icon">🏪</div>
              <div>
                <div className="inv-shop-name">{isOwner ? user?.shop_name : "StockWhisk Shop"}</div>
                <div className="inv-shop-sub">Service & Repair Center</div>
              </div>
            </div>
          </div>
          <div className="inv-meta-block">
            <div className="d-flex align-items-center justify-content-end gap-3 mb-2">
              <div className="inv-title-text" style={{ fontSize: '18pt' }}>REPAIR TICKET</div>
            </div>
            <table className="inv-meta-table">
              <tbody>
                <tr><td className="inv-meta-label">TICKET #</td><td className="inv-meta-val">{ticket.ticket_no || `#${ticket.id}`}</td></tr>
                <tr><td className="inv-meta-label">DATE</td><td className="inv-meta-val">{fmtDate(ticket.received_at)}</td></tr>
                <tr><td className="inv-meta-label">STATUS</td><td className="inv-meta-val">{ticket.status.replace(/_/g, " ").toUpperCase()}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="inv-divider" />

        <div className="inv-bill-to">
          <div className="inv-section-label">CUSTOMER DETAILS</div>
          <div className="inv-customer-name">{ticket.customer_name || "Walk-in customer"}</div>
          {ticket.customer_phone && <div className="inv-customer-detail">📞 {ticket.customer_phone}</div>}
        </div>

        <div className="mt-4 mb-3">
          <div className="inv-section-label">DEVICE & COMPLAINT</div>
          <div style={{ fontSize: '11pt', fontWeight: 600, color: '#0f172a' }}>{ticket.device_description}</div>
          <div style={{ fontSize: '9.5pt', color: '#475569', marginTop: '4px' }}>{ticket.complaint}</div>
        </div>

        <table className="inv-table mt-4">
          <thead>
            <tr>
              <th style={{ width: "65%" }}>Description</th>
              <th className="inv-th-center" style={{ width: "10%" }}>Qty</th>
              <th className="inv-th-right" style={{ width: "25%" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span className="inv-product-name">Service Charge</span></td>
              <td className="inv-td-center">1</td>
              <td className="inv-td-right"><span className="inv-line-total">{money(ticket.service_charge)}</span></td>
            </tr>
            {ticket.parts.map(p => (
              <tr key={p.id}>
                <td>
                  <span className="inv-product-name">{p.product_name}</span>
                  {p.warranty_months ? (
                    <div style={{ fontSize: "8pt", color: "#16a34a", marginTop: "2px", fontStyle: "italic" }}>
                      Warranty: {p.warranty_months} months
                    </div>
                  ) : null}
                </td>
                <td className="inv-td-center">{p.quantity}</td>
                <td className="inv-td-right"><span className="inv-line-total">{money(p.line_total)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="inv-footer-row">
          <div className="inv-notes">
            {ticket.estimated_delivery && (
              <div className="inv-note-text">
                <strong>Estimated Delivery:</strong> {fmtDate(ticket.estimated_delivery)}
              </div>
            )}
            <div className="inv-note-text mt-2" style={{ fontStyle: 'italic' }}>
              Please bring this ticket when collecting your device.
            </div>
          </div>
          <div className="inv-totals">
            <div className="inv-total-row">
              <span>Bill Total</span>
              <span>{money(ticket.bill_total)}</span>
            </div>
            <div className="inv-total-row inv-paid-row">
              <span>Paid</span>
              <span>{money(ticket.paid)}</span>
            </div>
            <div className="inv-grand-row">
              <span>Due</span>
              <span style={{ color: Number(ticket.due) > 0 ? '#ef4444' : '#16a34a' }}>{money(ticket.due)}</span>
            </div>
          </div>
        </div>
      </div>

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
        }

        /* ── Header ── */
        .inv-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 20px; }
        .inv-shop-icon { font-size: 2rem; line-height: 1; }
        .inv-shop-name { font-size: 18pt; font-weight: 700; color: #0f172a; line-height: 1.1; }
        .inv-shop-sub { font-size: 8.5pt; color: #64748b; }

        /* Right meta */
        .inv-meta-block { text-align: right; flex-shrink: 0; }
        .inv-title-text { font-size: 22pt; font-weight: 800; color: #2563eb; letter-spacing: .05em; }
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
        .inv-table { width: 100%; border-collapse: collapse; margin-bottom: 0; font-size: 9pt; }
        .inv-table thead tr { background: #1e293b; color: #fff; }
        .inv-table th { padding: 7px 10px; font-size: 8pt; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; white-space: nowrap; }
        .inv-th-center { text-align: center; }
        .inv-th-right { text-align: right; }
        .inv-table td { padding: 6px 10px; vertical-align: middle; border-bottom: 1px solid #f1f5f9; }
        .inv-product-name { font-weight: 500; color: #1e293b; }
        .inv-td-center { text-align: center; }
        .inv-td-right { text-align: right; }
        .inv-line-total { font-weight: 700; color: #0f172a; }

        /* ── Footer row ── */
        .inv-footer-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 2rem; margin-top: 20px; border-top: 1.5px solid #e2e8f0; padding-top: 16px; }
        .inv-notes { flex: 1; max-width: 55%; }
        .inv-note-text { font-size: 8.5pt; color: #475569; line-height: 1.5; margin-top: 4px; }

        /* Totals */
        .inv-totals { min-width: 240px; }
        .inv-total-row { display: flex; justify-content: space-between; font-size: 9pt; padding: 3px 0; color: #475569; border-bottom: 1px solid #f1f5f9; }
        .inv-total-row span:last-child { font-weight: 500; color: #1e293b; }
        .inv-paid-row span { color: #16a34a !important; }
        .inv-grand-row { display: flex; justify-content: space-between; font-size: 14pt; font-weight: 800; color: #0f172a; padding: 8px 0; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; margin: 4px 0; }

        @media print {
          @page { size: A4; margin: 12mm 14mm; }
          .d-print-none, .sidebar, .topbar, .offcanvas { display: none !important; }
          .inv-page { display: block !important; width: 100% !important; padding: 0 !important; max-width: 100% !important; box-shadow: none !important; border: none !important; border-radius: 0 !important; font-size: 9.5pt; }
          body { background: #fff !important; }
          .flex-grow-1 { margin: 0 !important; padding: 0 !important; }
        }
      `}</style>
    </>
  );
}
