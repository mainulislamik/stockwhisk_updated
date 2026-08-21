"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Barcode from "react-barcode";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { ErrorState, Spinner, money, fmtDate } from "@/components/ui";
import toast from "react-hot-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import InvoiceLockModal from "@/components/InvoiceLockModal";

type Part = { id: number; product_name: string; warranty_months?: number; quantity: string; unit_cost: string; unit_price: string; line_total: string };
type History = { id: number; from_status: string; to_status: string; note: string; created_at: string };
type Ticket = {
  id: number;
  ticket_no: string;
  device_description: string;
  complaint: string;
  status: string;
  service_charge: string;
  discount?: string;
  received_at: string;
  estimated_delivery: string | null;
  actual_delivery?: string | null;
  is_overdue: boolean;
  customer?: number | null;
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
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const { isOwner, can, user } = useAuth();
  const canManage = isOwner || can("manage_service");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [customerInfo, setCustomerInfo] = useState<any>(null);
  const isEditable = canManage && ticket?.status !== "delivered" && ticket?.status !== "cancelled";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockReason, setLockReason] = useState("");

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

  // Edit discount state
  const [editingDiscount, setEditingDiscount] = useState(false);
  const [discountVal, setDiscountVal] = useState("");

  const [printMode, setPrintMode] = useState<"invoice" | "token">("invoice");
  const handlePrint = (mode: "invoice" | "token") => {
    setPrintMode(mode);
    setTimeout(() => window.print(), 100);
  };

  const [addingPayment, setAddingPayment] = useState(false);
  const [payAmount, setPayAmount] = useState("");

  // Delivery Modal state
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryDiscount, setDeliveryDiscount] = useState("");
  const [deliveryPayment, setDeliveryPayment] = useState("");
  const [processingDelivery, setProcessingDelivery] = useState(false);

  useEffect(() => {
    if (picked || prodSearch.trim().length < 1) { setProdHits([]); return; }
    let active = true;
    const tm = setTimeout(async () => {
      try {
        const d = await api<{ results: ProductHit[] }>(`/catalog/products/`, { params: { search: prodSearch.trim(), page_size: 8, light: 1 } });
        if (active) setProdHits(d.results || []);
      } catch { if (active) setProdHits([]); }
    }, 250);
    return () => { active = false; clearTimeout(tm); };
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
      const res = await api<Ticket>(`/service/tickets/${id}/`);
      setTicket(res);
      setStatus(res.status);
      setChargeVal(res.service_charge);
      setDiscountVal(res.discount || "0");
      if (res.customer) {
        api<any>(`/crm/customers/${res.customer}/`)
          .then(setCustomerInfo)
          .catch(() => {});
      }
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
    if (!ticket) return;
    if (status === "delivered" && ticket.status !== "delivered") {
      setDeliveryDiscount(ticket.discount || "0");
      setDeliveryPayment("");
      setShowDeliveryModal(true);
      return;
    }
    try {
      await api(`/service/tickets/${id}/change_status/`, { method: "POST", body: { status } });
      await load();
      toast.success("Status updated");
    } catch (e: any) {
      toast.error(e?.message || "Could not change status");
    }
  }

  async function saveCharge() {
    const val = Number(chargeVal);
    if (isNaN(val) || val < 0) { toast.error("Invalid service charge"); return; }
    try {
      await api(`/service/tickets/${id}/`, { method: "PATCH", body: { service_charge: val } });
      setEditingCharge(false);
      await load();
      toast.success("Service charge updated");
    } catch (e: any) {
      toast.error(e?.message || "Could not update service charge");
    }
  }

  async function saveDiscount() {
    const val = Number(discountVal);
    if (isNaN(val) || val < 0) { toast.error("Invalid discount"); return; }
    try {
      await api(`/service/tickets/${id}/`, { method: "PATCH", body: { discount: val } });
      setEditingDiscount(false);
      await load();
      toast.success("Discount updated");
    } catch (e: any) {
      toast.error(e?.message || "Could not update discount");
    }
  }

  async function recordPayment() {
    const amt = Number(payAmount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (ticket && amt > Number(ticket.due)) {
      toast.error(`Amount cannot exceed remaining due of ${money(ticket.due)}`);
      return;
    }
    try {
      await api(`/service/tickets/${id}/add_payment/`, { method: "POST", body: { amount: amt } });
      setPayAmount("");
      setAddingPayment(false);
      await load();
      toast.success("Payment recorded");
    } catch (e: any) {
      toast.error(e?.message || "Could not record payment");
    }
  }

  function calcDeliveryDue() {
    if (!ticket) return "0";
    const partsTotal = Number(ticket.parts_total || 0);
    const serviceCharge = Number(ticket.service_charge || 0);
    const discount = Number(deliveryDiscount || 0);
    const paid = Number(ticket.paid || 0);
    const due = Math.max(0, serviceCharge + partsTotal - discount - paid);
    return due.toFixed(2);
  }

  async function confirmDelivery() {
    if (!ticket) return;
    setProcessingDelivery(true);
    try {
      const discountNum = Number(deliveryDiscount);
      if (!isNaN(discountNum) && discountNum >= 0 && String(discountNum) !== String(ticket.discount || 0)) {
        await api(`/service/tickets/${id}/`, { method: "PATCH", body: { discount: discountNum } });
      }
      const payNum = Number(deliveryPayment);
      if (!isNaN(payNum) && payNum > 0) {
        await api(`/service/tickets/${id}/add_payment/`, { method: "POST", body: { amount: payNum } });
      }
      await api(`/service/tickets/${id}/change_status/`, { method: "POST", body: { status: "delivered" } });
      setShowDeliveryModal(false);
      await load();
      toast.success("Ticket marked as DELIVERED");
    } catch (e: any) {
      toast.error(e?.message || "Failed to deliver ticket");
    } finally {
      setProcessingDelivery(false);
    }
  }

  if (loading) return <Spinner label={t("tkt_loading")} />;
  if (error || !ticket) return <ErrorState error={error || "Ticket not found"} />;

  const shopName = user?.shop_name || "StockWhisk Shop";
  const shopPhone = user?.shop_phone || user?.phone || "";
  const shopEmail = user?.email || "";

  return (
    <>
      {/* ── Screen layout (hidden on print) ── */}
      <div className="vstack gap-3 d-print-none">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div>
            <h1 className="h4 fw-bold text-brand mb-0">{ticket.ticket_no}</h1>
            <div className="text-secondary small">{ticket.device_description}</div>
          </div>
          <div className="d-flex flex-wrap gap-2 d-print-none">
            {(() => {
              if (!canManage) return null;

              const isCancelled = ticket.status === "cancelled";
              const isDelivered = ticket.status === "delivered";
              
              const deliveryDate = ticket.actual_delivery ? new Date(ticket.actual_delivery).toLocaleDateString() : null;
              const today = new Date().toLocaleDateString();
              const isPastDelivery = isDelivered && deliveryDate && deliveryDate !== today;

              if (isCancelled) {
                return (
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                    onClick={() => {
                      setLockReason("সার্ভিস টিকিটটি বাতিল (Cancelled) করা হয়েছে।");
                      setShowLockModal(true);
                    }}
                  >
                    <i className="bi bi-shield-lock-fill text-warning"></i>
                    <span>লকড (বাতিল)</span>
                  </button>
                );
              }

              if (isPastDelivery) {
                return (
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                    onClick={() => {
                      setLockReason(`সার্ভিসটি ডেলিভারি হয়েছিল ${fmtDate(ticket.actual_delivery || ticket.received_at)} তারিখে। পূর্বের দৈনিক হিসাব ও ক্যাশ বুক সুরক্ষিত রাখতে এটি লক করা হয়েছে।`);
                      setShowLockModal(true);
                    }}
                  >
                    <i className="bi bi-shield-lock-fill text-warning"></i>
                    <span>লকড (Locked)</span>
                  </button>
                );
              }

              return (
                <Link href={`/app/service/tickets/${ticket.id}/edit`} className="btn btn-outline-primary btn-sm">
                  <i className="bi bi-pencil-square me-1"></i>এডিট ইনভয়েস
                </Link>
              );
            })()}
            <button className="btn btn-outline-brand btn-sm" onClick={() => handlePrint("token")}>
              <i className="bi bi-receipt me-1"></i>{t("tktd_print_token")}
            </button>
            <button className="btn btn-brand btn-sm" onClick={() => handlePrint("invoice")} disabled={ticket.status !== 'delivered'}>
              <i className="bi bi-printer me-1"></i>{t("tktd_print_invoice")}
            </button>
            <Link href="/app/service/tickets" className="btn btn-light btn-sm border">{t("tktd_back")}</Link>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-lg-7">
            <div className="card shadow-sm">
              <div className="card-body">
                {(customerInfo?.name || ticket.customer_name || ticket.customer_phone) && (
                  <div className="mb-3">
                    <div className="fw-semibold mb-1">{t("tktd_customer")}</div>
                    <div>
                      {ticket.customer ? (
                        <Link href={`/app/customers/${ticket.customer}`} className="text-decoration-none text-brand fw-semibold">
                          {customerInfo?.name || ticket.customer_name || t("tkt_walkin")}
                        </Link>
                      ) : (
                        <span className="fw-semibold">{ticket.customer_name || t("tkt_walkin")}</span>
                      )}
                    </div>
                    {(customerInfo?.phone || ticket.customer_phone) && (
                      <div className="text-secondary small">📞 {customerInfo?.phone || ticket.customer_phone}</div>
                    )}
                    {customerInfo?.address && (
                      <div className="text-secondary small">📍 {customerInfo.address}</div>
                    )}
                  </div>
                )}
                <div className="fw-semibold mb-2">{t("tktd_complaint")}</div>
                <p className="mb-3">{ticket.complaint}</p>
                <div className="fw-semibold mb-2">{t("tktd_products_parts")}</div>
                {ticket.parts.length === 0 ? (
                  <div className="text-secondary small mb-2">{t("tktd_no_products")}</div>
                ) : (
                  <div className="table-responsive mb-2">
                    <table className="table table-sm align-middle mb-0">
                      <thead>
                        <tr>
                          <th>{t("tktd_product")}</th>
                          <th className="text-end">{t("tktd_qty")}</th>
                          <th className="text-end">{t("tktd_price")}</th>
                          <th className="text-end">{t("tktd_total")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ticket.parts.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <div>{p.product_name}</div>
                              {p.warranty_months ? (
                                <div className="text-success small fst-italic">
                                  {t("tktd_warranty_months", { count: p.warranty_months })}
                                </div>
                              ) : null}
                            </td>
                            <td className="text-end">{p.quantity}</td>
                            <td className="text-end">{money(p.unit_price)}</td>
                            <td className="text-end fw-semibold">{money(p.line_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {isEditable && (
                  <form onSubmit={addPart} className="border-top pt-3 mt-2">
                    <div className="fw-semibold small mb-2">{t("tktd_sell_product")}</div>
                    <div className="vstack gap-2">
                      <div className="position-relative">
                        <input
                          className="form-control form-control-sm"
                          placeholder={t("tktd_search_product")}
                          value={picked ? `${picked.name} (${picked.sku})` : prodSearch}
                          onChange={(e) => { setPicked(null); setProdSearch(e.target.value); }}
                          disabled={addingPart}
                        />
                        {picked && (
                          <button
                            type="button"
                            className="btn btn-sm btn-link text-secondary position-absolute top-50 end-0 translate-middle-y me-1 py-0"
                            onClick={() => { setPicked(null); setProdSearch(""); setPrice(""); }}
                          >
                            {t("tktd_change")}
                          </button>
                        )}
                        {prodHits.length > 0 && !picked && (
                          <div className="list-group position-absolute w-100 shadow-sm mt-1 z-3" style={{ maxHeight: 200, overflowY: "auto" }}>
                            {prodHits.map((h) => (
                              <button
                                type="button"
                                key={h.id}
                                className="list-group-item list-group-item-action py-1 small"
                                onClick={() => {
                                  setPicked(h);
                                  setPrice(h.selling_price || "");
                                  setProdHits([]);
                                }}
                              >
                                <div className="fw-semibold">{h.name}</div>
                                <div className="text-secondary" style={{ fontSize: "0.75rem" }}>
                                  SKU: {h.sku} · {money(h.selling_price)}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {picked && (
                        <div className="row g-2 align-items-end">
                          <div className="col-4">
                            <label className="form-label small mb-1">{t("tktd_qty")}</label>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              className="form-control form-control-sm"
                              value={qty}
                              onChange={(e) => setQty(e.target.value)}
                              disabled={addingPart}
                            />
                          </div>
                          <div className="col-4">
                            <label className="form-label small mb-1">{t("tktd_sell_price")}</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="form-control form-control-sm"
                              value={price}
                              onChange={(e) => setPrice(e.target.value)}
                              disabled={addingPart}
                            />
                          </div>
                          <div className="col-4">
                            <button className="btn btn-brand btn-sm w-100" disabled={addingPart}>
                              {addingPart ? t("tktd_processing") : t("tktd_add_product")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>

          <div className="col-lg-5">
            <div className="card shadow-sm mb-3">
              <div className="card-body">
                <div className="fw-semibold mb-2">{t("tktd_status")}</div>
                {canManage ? (
                  <div className="d-flex gap-2 mb-3">
                    <select
                      className="form-select form-select-sm"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{t(`tktd_status_${s}`) || s.replace(/_/g, " ").toUpperCase()}</option>
                      ))}
                    </select>
                    <button
                      className="btn btn-brand btn-sm"
                      onClick={changeStatus}
                      disabled={status === ticket.status}
                    >
                      {t("tktd_update")}
                    </button>
                  </div>
                ) : (
                  <div className="badge text-bg-secondary fs-6 mb-3">
                    {t(`tktd_status_${ticket.status}`) || ticket.status.replace(/_/g, " ").toUpperCase()}
                  </div>
                )}

                <div className="d-flex justify-content-between align-items-center py-2 border-top">
                  <span className="text-secondary">{t("tktd_service_charge")}</span>
                  {editingCharge ? (
                    <div className="d-flex gap-1 align-items-center">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-control form-control-sm"
                        style={{ width: "90px" }}
                        value={chargeVal}
                        onChange={(e) => setChargeVal(e.target.value)}
                        autoFocus
                      />
                      <button className="btn btn-sm btn-brand py-0 px-2" onClick={saveCharge}><i className="bi bi-check"></i></button>
                      <button className="btn btn-sm btn-light border py-0 px-2" onClick={() => setEditingCharge(false)}><i className="bi bi-x"></i></button>
                    </div>
                  ) : (
                    <span className="fw-semibold">
                      {money(ticket.service_charge)}
                      {isEditable && (
                        <button className="btn btn-link btn-sm text-secondary p-0 ms-2" onClick={() => setEditingCharge(true)}>
                          <i className="bi bi-pencil"></i>
                        </button>
                      )}
                    </span>
                  )}
                </div>

                <div className="d-flex justify-content-between align-items-center py-2 border-top">
                  <span className="text-secondary">{t("tktd_products_parts")}</span>
                  <span className="fw-semibold">{money(ticket.parts_total)}</span>
                </div>

                <div className="d-flex justify-content-between align-items-center py-2 border-top">
                  <span className="text-secondary">{t("tktd_discount")}</span>
                  {editingDiscount ? (
                    <div className="d-flex gap-1 align-items-center">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-control form-control-sm"
                        style={{ width: "90px" }}
                        value={discountVal}
                        onChange={(e) => setDiscountVal(e.target.value)}
                        autoFocus
                      />
                      <button className="btn btn-sm btn-brand py-0 px-2" onClick={saveDiscount}><i className="bi bi-check"></i></button>
                      <button className="btn btn-sm btn-light border py-0 px-2" onClick={() => setEditingDiscount(false)}><i className="bi bi-x"></i></button>
                    </div>
                  ) : (
                    <span className="fw-semibold text-danger">
                      -{money(ticket.discount || "0")}
                      {isEditable && (
                        <button className="btn btn-link btn-sm text-secondary p-0 ms-2" onClick={() => setEditingDiscount(true)}>
                          <i className="bi bi-pencil"></i>
                        </button>
                      )}
                    </span>
                  )}
                </div>

                <div className="d-flex justify-content-between py-2 border-top fs-5 fw-bold">
                  <span>{t("tktd_bill_total")}</span>
                  <span className="text-brand">{money(ticket.bill_total)}</span>
                </div>

                <div className="d-flex justify-content-between align-items-center py-2 border-top text-success">
                  <span>{t("tktd_paid")}</span>
                  <div className="d-flex align-items-center gap-2">
                    <span className="fw-semibold">{money(ticket.paid)}</span>
                    {Number(ticket.due) > 0 && canManage && !addingPayment && (
                      <button className="btn btn-outline-success btn-sm py-0" onClick={() => setAddingPayment(true)}>
                        +{t("tktd_add")}
                      </button>
                    )}
                  </div>
                </div>

                {addingPayment && (
                  <div className="bg-light rounded p-2 my-2 border">
                    <div className="d-flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={ticket.due}
                        placeholder={t("tktd_amount")}
                        className="form-control form-control-sm"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                      />
                      <button className="btn btn-success btn-sm" onClick={recordPayment}>Save</button>
                      <button className="btn btn-light btn-sm border" onClick={() => setAddingPayment(false)}>✕</button>
                    </div>
                  </div>
                )}

                <div className="d-flex justify-content-between py-2 border-top fs-5 fw-bold text-danger">
                  <span>{t("tktd_due")}</span>
                  <span>{money(ticket.due)}</span>
                </div>

                <div className="border-top pt-2 mt-1 small text-secondary">
                  <div>{t("tktd_received")}: {fmtDate(ticket.received_at)}</div>
                  {ticket.estimated_delivery && (
                    <div className={ticket.is_overdue ? "text-danger fw-semibold" : ""}>
                      {t("tktd_est_delivery")}: {fmtDate(ticket.estimated_delivery)}
                      {ticket.is_overdue && " (OVERDUE)"}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="card shadow-sm">
              <div className="card-body">
                <div className="fw-semibold mb-2">{t("tktd_history")}</div>
                {ticket.history.length === 0 ? (
                  <div className="text-secondary small">{t("tktd_no_history")}</div>
                ) : (
                  <ul className="list-unstyled small mb-0 vstack gap-2">
                    {ticket.history.map((h) => (
                      <li key={h.id} className="border-bottom pb-1">
                        <div className="fw-semibold">
                          {h.from_status ? `${h.from_status} → ` : ""}{h.to_status}
                        </div>
                        <div className="text-secondary">{fmtDate(h.created_at)}{h.note ? ` · ${h.note}` : ""}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── POS Token Sheet (Print Only) ── */}
      {printMode === "token" && (
        <div className="token-page d-none d-print-block">
          <div className="text-center mb-3">
            <h4 className="fw-bold mb-1" style={{ fontSize: '14pt' }}>{shopName}</h4>
            <div style={{ fontSize: '9pt', color: '#475569' }}>{t("tktd_repair_token")}</div>
            {shopPhone && <div style={{ fontSize: '8pt', color: '#64748b' }}>📞 {shopPhone}</div>}
          </div>
          <div className="token-divider" />
          <div className="text-center mb-2">
            <Barcode value={ticket.ticket_no || `SVC-${ticket.id}`} width={1.2} height={30} displayValue={false} margin={0} background="transparent" />
          </div>
          <div className="token-row"><strong>{t("tktd_ticket_hash")}</strong> {ticket.ticket_no || `#${ticket.id}`}</div>
          <div className="token-row"><strong>{t("tktd_date")}</strong> {fmtDate(ticket.received_at)}</div>
          <div className="token-row">
            <strong>{t("tktd_customer_colon")}</strong> {customerInfo?.name || ticket.customer_name || t("tkt_walkin")} 
            {(customerInfo?.phone || ticket.customer_phone) && <div>📞 {customerInfo?.phone || ticket.customer_phone}</div>}
          </div>
          <div className="token-divider" />
          <div className="token-row"><strong>{t("tktd_device_colon")}</strong> {ticket.device_description}</div>
          <div className="token-row"><strong>{t("tktd_complaint_colon")}</strong> {ticket.complaint}</div>
          {ticket.estimated_delivery && (
            <div className="token-row mt-2"><strong>{t("tktd_est_delivery_colon")}</strong> {fmtDate(ticket.estimated_delivery)}</div>
          )}
          <div className="token-divider" />
          <div className="token-row"><strong>{t("tktd_service_charge_colon")}</strong> {money(ticket.service_charge)}</div>
          {Number(ticket.discount) > 0 && (
            <div className="token-row text-danger"><strong>{t("tktd_discount_colon")}</strong> -{money(ticket.discount)}</div>
          )}
          {ticket.parts.length > 0 && (
            <div className="mt-2">
              <strong>{t("tktd_parts_colon")}</strong>
              {ticket.parts.map(p => (
                <div key={p.id} className="d-flex justify-content-between" style={{ fontSize: '9pt' }}>
                  <span>{p.quantity}x {p.product_name}</span>
                  <span>{money(p.line_total)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="token-divider" />
          <div className="d-flex justify-content-between fw-bold">
            <span>{t("tktd_est_total_colon")}</span>
            <span>{money(ticket.bill_total)}</span>
          </div>
          <div className="d-flex justify-content-between">
            <span>{t("tktd_advance_paid")}</span>
            <span>{money(ticket.paid)}</span>
          </div>

          <div className="token-divider" />
          <div className="text-center mt-4" style={{ fontSize: '9pt' }}>
            <p className="mb-1 fw-semibold">{t("tktd_keep_safe")}</p>
            <p className="mb-0">{t("tktd_present_collect")}</p>
          </div>
        </div>
      )}

      {/* ── A4 Ticket Sheet (Print Only) ── */}
      {printMode === "invoice" && (
      <div className="inv-page d-none d-print-block">
        <div className="inv-header">
          <div className="inv-shop-block">
            <div className="d-flex align-items-center gap-2 mb-1">
              {user?.shop_logo ? (
                <img src={user.shop_logo} alt="Logo" style={{ width: "42px", height: "42px", objectFit: "contain", borderRadius: "6px" }} />
              ) : (
                <div className="inv-shop-icon" style={{ fontSize: "2rem" }}>🏪</div>
              )}
              <div>
                <div className="inv-shop-name">{shopName}</div>
                <div className="inv-shop-sub">{t("tktd_repair_center")}</div>
              </div>
            </div>
            {shopPhone && <div className="inv-contact-row">📞 {shopPhone}</div>}
            {shopEmail && <div className="inv-contact-row">✉ {shopEmail}</div>}
          </div>
          <div className="inv-meta-block">
            <div className="d-flex align-items-center justify-content-end gap-2 mb-2">
              <div className="inv-status-badge" style={{ 
                background: ticket.status === 'delivered' ? '#16a34a1a' : '#2563eb1a', 
                color: ticket.status === 'delivered' ? '#16a34a' : '#2563eb', 
                borderColor: ticket.status === 'delivered' ? '#16a34a' : '#2563eb' 
              }}>
                ● {t(`tktd_status_${ticket.status}`) || ticket.status.replace(/_/g, " ").toUpperCase()}
              </div>
              <div className="inv-title-text">{t("tktd_invoice_heading")}</div>
            </div>
            <div className="d-flex justify-content-end mb-2" style={{ marginRight: '-10px' }}>
              <Barcode value={ticket.ticket_no || `SVC-${ticket.id}`} width={1.5} height={40} displayValue={false} margin={0} background="transparent" />
            </div>
            <table className="inv-meta-table">
              <tbody>
                <tr><td className="inv-meta-label">{t("tktd_ticket_hash_heading")}</td><td className="inv-meta-val">{ticket.ticket_no || `#${ticket.id}`}</td></tr>
                <tr><td className="inv-meta-label">{t("tktd_date_heading")}</td><td className="inv-meta-val">{fmtDate(ticket.received_at)}</td></tr>
                <tr><td className="inv-meta-label">{t("tktd_status_heading")}</td><td className="inv-meta-val fw-bold">{t(`tktd_status_${ticket.status}`) || ticket.status.replace(/_/g, " ").toUpperCase()}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="inv-divider" />

        {/* Customer & Device Information Grid */}
        <div className="row g-3 inv-info-grid mb-3">
          <div className="col-6">
            <div className="inv-section-box h-100">
              <div className="inv-section-label">{t("tktd_customer_details")}</div>
              <div className="inv-customer-name">{customerInfo?.name || ticket.customer_name || t("tkt_walkin")}</div>
              {(customerInfo?.phone || ticket.customer_phone) && (
                <div className="inv-customer-detail">📞 {customerInfo?.phone || ticket.customer_phone}</div>
              )}
              {customerInfo?.address && (
                <div className="inv-customer-detail">📍 {customerInfo.address}</div>
              )}
              {customerInfo?.email && (
                <div className="inv-customer-detail">✉️ {customerInfo.email}</div>
              )}
            </div>
          </div>
          <div className="col-6">
            <div className="inv-section-box h-100">
              <div className="inv-section-label">{t("tktd_device_complaint")}</div>
              <div className="inv-device-desc">{ticket.device_description}</div>
              {ticket.complaint && (
                <div className="inv-complaint-text">{ticket.complaint}</div>
              )}
            </div>
          </div>
        </div>

        <table className="inv-table mt-3">
          <thead>
            <tr>
              <th style={{ width: "65%" }}>{t("tktd_description")}</th>
              <th className="inv-th-center" style={{ width: "10%" }}>{t("tktd_qty")}</th>
              <th className="inv-th-right" style={{ width: "25%" }}>{t("tktd_total")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span className="inv-product-name">{t("tktd_service_charge")}</span></td>
              <td className="inv-td-center">1</td>
              <td className="inv-td-right"><span className="inv-line-total">{money(ticket.service_charge)}</span></td>
            </tr>
            {ticket.parts.map(p => (
              <tr key={p.id}>
                <td>
                  <span className="inv-product-name">{p.product_name}</span>
                  {p.warranty_months ? (
                    <div style={{ fontSize: "8pt", color: "#16a34a", marginTop: "2px", fontStyle: "italic" }}>
                      {t("tktd_warranty_months", { count: p.warranty_months })}
                    </div>
                  ) : null}
                </td>
                <td className="inv-td-center">{p.quantity}</td>
                <td className="inv-td-right"><span className="inv-line-total">{money(p.line_total)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>

        {Number(ticket.discount) > 0 && (
          <div className="d-flex justify-content-end w-100 pe-2 mt-2">
            <span className="text-danger fw-semibold" style={{ width: "30%", textAlign: "right" }}>
              Discount: -{money(ticket.discount)}
            </span>
          </div>
        )}

        <div className="inv-footer-row">
          <div className="inv-notes">
            {ticket.status === "delivered" ? (
              <>
                <div className="inv-note-text">
                  <strong>{t("tktd_actual_delivery")}</strong> {fmtDate(ticket.received_at)}
                </div>
                <div className="inv-note-text mt-2 text-success fw-semibold">
                  {t("tktd_thank_you_service")}
                </div>
              </>
            ) : (
              <>
                {ticket.estimated_delivery && (
                  <div className="inv-note-text">
                    <strong>{t("tktd_est_delivery_colon")}</strong> {fmtDate(ticket.estimated_delivery)}
                  </div>
                )}
                <div className="inv-note-text mt-2" style={{ fontStyle: 'italic' }}>
                  {t("tktd_bring_ticket")}
                </div>
              </>
            )}
          </div>
          <div className="inv-totals">
            <div className="inv-total-row">
              <span>{t("tktd_bill_total")}</span>
              <span>{money(ticket.bill_total)}</span>
            </div>
            <div className="inv-total-row inv-paid-row">
              <span>{t("tktd_paid")}</span>
              <span>{money(ticket.paid)}</span>
            </div>
            <div className="inv-grand-row">
              <span>{t("tktd_due")}</span>
              <span style={{ color: Number(ticket.due) > 0 ? '#ef4444' : '#16a34a' }}>{money(ticket.due)}</span>
            </div>
          </div>
        </div>
      </div>
      )}

      <style>{`
        /* ── Base ── */
        .inv-page {
          background: #fff;
          color: #1a1a2e;
          font-family: 'Segoe UI', system-ui, sans-serif;
          font-size: 10pt;
          max-width: 794px;
          margin: 0 auto;
          padding: 28px 32px;
        }

        /* ── Header ── */
        .inv-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 16px; }
        .inv-shop-icon { font-size: 2rem; line-height: 1; }
        .inv-shop-name { font-size: 16pt; font-weight: 700; color: #0f172a; line-height: 1.1; }
        .inv-shop-sub { font-size: 8.5pt; color: #64748b; margin-top: 2px; }
        .inv-contact-row { font-size: 8.5pt; color: #475569; margin-top: 2px; }

        /* Right meta */
        .inv-meta-block { text-align: right; flex-shrink: 0; }
        .inv-status-badge { font-size: 8pt; font-weight: 700; padding: 3px 8px; border-radius: 4px; border: 1px solid; text-transform: uppercase; }
        .inv-title-text { font-size: 18pt; font-weight: 800; color: #2563eb; letter-spacing: .05em; }
        .inv-meta-table { margin-left: auto; margin-top: 4px; }
        .inv-meta-label { font-size: 7.5pt; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; padding-right: 10px; white-space: nowrap; }
        .inv-meta-val { font-size: 8.5pt; font-weight: 600; text-align: right; white-space: nowrap; }

        /* ── Divider ── */
        .inv-divider { border: none; border-top: 1.5px solid #e2e8f0; margin: 12px 0 16px 0; }

        /* ── Customer & Device Box ── */
        .inv-section-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; }
        .inv-section-label { font-size: 7.5pt; color: #94a3b8; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 4px; }
        .inv-customer-name { font-size: 11pt; font-weight: 700; color: #0f172a; }
        .inv-customer-detail { font-size: 8.5pt; color: #475569; margin-top: 2px; }
        .inv-device-desc { font-size: 10.5pt; font-weight: 600; color: #0f172a; }
        .inv-complaint-text { font-size: 8.5pt; color: #475569; margin-top: 3px; }

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
        .inv-footer-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 2rem; margin-top: 16px; border-top: 1.5px solid #e2e8f0; padding-top: 14px; }
        .inv-notes { flex: 1; max-width: 55%; }
        .inv-note-text { font-size: 8.5pt; color: #475569; line-height: 1.5; margin-top: 3px; }

        /* Totals */
        .inv-totals { min-width: 240px; }
        .inv-total-row { display: flex; justify-content: space-between; font-size: 9pt; padding: 3px 0; color: #475569; border-bottom: 1px solid #f1f5f9; }
        .inv-total-row span:last-child { font-weight: 500; color: #1e293b; }
        .inv-paid-row span { color: #16a34a !important; }
        .inv-grand-row { display: flex; justify-content: space-between; font-size: 13pt; font-weight: 800; color: #0f172a; padding: 6px 0; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; margin: 4px 0; }

        /* ── Token ── */
        .token-page {
          background: #fff;
          color: #000;
          font-family: monospace, sans-serif;
          font-size: 10pt;
          width: 100%;
          max-width: 80mm;
          margin: 0 auto;
          padding: 10px;
          line-height: 1.4;
        }
        .token-divider { border-top: 1px dashed #000; margin: 10px 0; }
        .token-row { margin-bottom: 4px; }

        @media print {
          @page { size: ${printMode === "token" ? "80mm auto" : "A4"}; margin: ${printMode === "token" ? "0" : "10mm 12mm"}; }
          .d-print-none, .sidebar, .topbar, .offcanvas { display: none !important; }
          .inv-page { display: block !important; width: 100% !important; padding: 0 !important; max-width: 100% !important; box-shadow: none !important; border: none !important; border-radius: 0 !important; font-size: 9.5pt; }
          .token-page { display: block !important; max-width: 100% !important; padding: 5mm !important; }
          body { background: #fff !important; margin: 0 !important; }
          .flex-grow-1 { margin: 0 !important; padding: 0 !important; }
        }
      `}</style>

      {showDeliveryModal && (
        <>
          <div className="modal-backdrop fade show"></div>
          <div className="modal d-block" tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">{t("tktd_confirm_delivery")}</h5>
                  <button type="button" className="btn-close" onClick={() => setShowDeliveryModal(false)}></button>
                </div>
                <div className="modal-body">
                  <p className="small text-secondary mb-3">
                    You are marking this ticket as <b>{t("tktd_delivered")}</b>{t("tktd_once_delivered")}</p>
                  
                  <div className="mb-3">
                    <label className="form-label small mb-1">{t("tktd_discount")}</label>
                    <input type="number" step="0.01" className="form-control" value={deliveryDiscount} onChange={e => setDeliveryDiscount(e.target.value)} />
                  </div>

                  <div className="mb-3 d-flex justify-content-between align-items-center text-danger">
                    <span className="fw-semibold">{t("tktd_final_due")}</span>
                    <span className="fw-semibold">{money(calcDeliveryDue())}</span>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small mb-1">{t("tktd_collect_payment")}</label>
                    <input type="number" step="0.01" className="form-control" placeholder="0.00" value={deliveryPayment} onChange={e => setDeliveryPayment(e.target.value)} />
                  </div>
                  
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light border" onClick={() => setShowDeliveryModal(false)} disabled={processingDelivery}>{t("tktd_cancel")}</button>
                  <button type="button" className="btn btn-brand" onClick={confirmDelivery} disabled={processingDelivery}>
                    {processingDelivery ? t("tktd_processing") : t("tktd_confirm_and_deliver")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Service Invoice Lock Info Modal */}
      <InvoiceLockModal
        isOpen={showLockModal}
        onClose={() => setShowLockModal(false)}
        invoiceType="service"
        invoiceNo={ticket.ticket_no}
        reason={lockReason}
      />
    </>
  );
}
