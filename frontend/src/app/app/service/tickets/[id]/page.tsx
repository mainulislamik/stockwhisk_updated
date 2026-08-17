"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { ErrorState, Spinner, money, fmtDate } from "@/components/ui";
import toast from "react-hot-toast";

type Part = { id: number; product_name: string; quantity: string; unit_cost: string; unit_price: string; line_total: string };
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
  const { isOwner, can } = useAuth();
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

  if (loading) return <Spinner label="Loading ticket…" />;
  if (error) return <ErrorState error={error} />;
  if (!ticket) return null;

  return (
    <div className="vstack gap-3">
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
                        <td>{p.product_name}</td>
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
              <div className="d-flex justify-content-between">
                <span className="text-secondary">Service charge</span>
                <span>{money(ticket.service_charge)}</span>
              </div>
              <div className="d-flex justify-content-between">
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

      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          .sidebar, .topbar, .offcanvas { display: none !important; }
          .flex-grow-1 { margin: 0 !important; padding: 0 !important; width: 100% !important; }
          body, .flex-grow-1, [data-bs-theme="dark"] body { background: #fff !important; color: #000 !important; }
          .card { border: none !important; box-shadow: none !important; background: transparent !important; }
          .card-body { padding: 0 !important; }
          .text-brand, .text-primary { color: #000 !important; }
          .btn, .form-select, input { display: none !important; }
          .table { border-color: #dee2e6 !important; }
          .table th, .table td { color: #000 !important; }
          .row { display: flex !important; flex-wrap: nowrap !important; }
          .col-lg-7 { width: 60% !important; }
          .col-lg-5 { width: 40% !important; }
          .d-print-none { display: none !important; }
        }
      `}} />
    </div>
  );
}
