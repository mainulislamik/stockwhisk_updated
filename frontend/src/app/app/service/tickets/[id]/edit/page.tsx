"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ErrorState, Spinner, money } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import toast from "react-hot-toast";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

type Product = { id: number; name: string; selling_price: string; cost_price: string; current_stock: string; barcode?: string; sku?: string };
type TicketPart = {
  id?: number;
  product_id: number;
  name: string;
  barcode?: string;
  sku?: string;
  quantity: number | string;
  unit_price: number | string;
  unit_cost?: number | string;
  line_total?: number | string;
  from_stock?: boolean;
};

type Ticket = {
  id: number;
  ticket_no: string;
  device_description: string;
  complaint: string;
  status: string;
  service_charge: string;
  discount: string;
  paid: string;
  bill_total: string;
  due: string;
  customer?: number | null;
  customer_name?: string;
  customer_phone?: string;
  estimated_delivery?: string | null;
  parts: any[];
};

type CustomerHit = { id: number; name: string; phone: string };

export default function EditServiceTicketPage() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isOwner, can, user } = useAuth();
  const canManage = isOwner || can("manage_service");

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Ticket Form States
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);

  const [deviceDesc, setDeviceDesc] = useState("");
  const [complaint, setComplaint] = useState("");
  const [estimatedDelivery, setEstimatedDelivery] = useState("");

  const [serviceCharge, setServiceCharge] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [reason, setReason] = useState("");

  // Parts List
  const [parts, setParts] = useState<TicketPart[]>([]);

  // Product Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);

  // Customer Search
  const [custSearch, setCustSearch] = useState("");
  const [custHits, setCustHits] = useState<CustomerHit[]>([]);
  const [searchingCust, setSearchingCust] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api<Ticket>(`/service/tickets/${id}/`);
        if (data.status === "cancelled") {
          setError("বাতিলকৃত সার্ভিস ইনভয়েস সংশোধন করা যাবে না।");
          setLoading(false);
          return;
        }

        setTicket(data);
        setCustomerName(data.customer_name || "");
        setCustomerPhone(data.customer_phone || "");
        setCustomerId(data.customer || null);
        setDeviceDesc(data.device_description || "");
        setComplaint(data.complaint || "");
        setEstimatedDelivery(data.estimated_delivery || "");
        setServiceCharge(Number(data.service_charge) || 0);
        setDiscount(Number(data.discount) || 0);

        const initialParts: TicketPart[] = (data.parts || []).map((p: any) => ({
          product_id: p.product?.id || p.product_id || p.product,
          name: p.product_name || p.product?.name || "Part",
          barcode: p.product_barcode || p.product?.barcode || "",
          sku: p.product_sku || p.product?.sku || "",
          quantity: Number(p.quantity) || 1,
          unit_price: Number(p.unit_price) || 0,
          unit_cost: Number(p.unit_cost) || 0,
          from_stock: p.from_stock !== false,
        }));
        setParts(initialParts);
      } catch (err: any) {
        setError(err?.message || "সার্ভিস ইনভয়েস লোড করতে সমস্যা হয়েছে।");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Search products
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api<any>("/catalog/products/", {
          params: { search: searchQuery.trim(), page_size: 8, light: 1 },
        });
        const list = Array.isArray(res) ? res : res?.results || [];
        setSearchResults(list);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Search customers
  useEffect(() => {
    if (!custSearch.trim()) {
      setCustHits([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingCust(true);
      try {
        const res = await api<any>("/crm/customers/", {
          params: { search: custSearch.trim(), page_size: 5 },
        });
        const list = Array.isArray(res) ? res : res?.results || [];
        setCustHits(list);
      } catch {
        setCustHits([]);
      } finally {
        setSearchingCust(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [custSearch]);

  const addPart = (prod: Product) => {
    const existingIndex = parts.findIndex((p) => p.product_id === prod.id);
    if (existingIndex >= 0) {
      const updated = [...parts];
      updated[existingIndex].quantity = Number(updated[existingIndex].quantity) + 1;
      setParts(updated);
    } else {
      setParts([
        ...parts,
        {
          product_id: prod.id,
          name: prod.name,
          barcode: prod.barcode || "",
          sku: prod.sku || "",
          quantity: 1,
          unit_price: Number(prod.selling_price) || 0,
          unit_cost: Number(prod.cost_price) || 0,
          from_stock: true,
        },
      ]);
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  const updatePartQty = (index: number, qty: number) => {
    if (qty <= 0) {
      removePart(index);
      return;
    }
    const updated = [...parts];
    updated[index].quantity = qty;
    setParts(updated);
  };

  const updatePartPrice = (index: number, price: number) => {
    const updated = [...parts];
    updated[index].unit_price = Math.max(0, price);
    setParts(updated);
  };

  const removePart = (index: number) => {
    setParts(parts.filter((_, i) => i !== index));
  };

  // Financial Calculations
  const partsTotal = parts.reduce((sum, p) => sum + Number(p.quantity) * Number(p.unit_price), 0);
  const subtotal = serviceCharge + partsTotal;
  const billTotal = Math.max(0, subtotal - discount);
  const paidAmount = ticket ? Number(ticket.paid) || 0 : 0;
  const remainingDue = billTotal - paidAmount;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("অনুগ্রহ করে সংশোধনের কারণ (Correction Reason) লিখুন।");
      return;
    }

    setSubmitting(true);
    try {
      await api(`/service/tickets/${id}/edit/`, {
        method: "POST",
        body: {
          customer_id: customerId,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          device_description: deviceDesc.trim(),
          complaint: complaint.trim(),
          estimated_delivery: estimatedDelivery || null,
          service_charge: serviceCharge,
          discount: discount,
          parts: parts.map((p) => ({
            product_id: p.product_id,
            quantity: p.quantity,
            unit_price: p.unit_price,
            unit_cost: p.unit_cost,
            from_stock: p.from_stock !== false,
          })),
          correction_reason: reason.trim(),
        },
      });

      toast.success("সার্ভিস ইনভয়েস সফলভাবে সংশোধন করা হয়েছে!");
      router.push(`/app/service/tickets/${id}`);
    } catch (err: any) {
      toast.error(err?.data?.detail || err?.message || "ইনভয়েস আপডেট করতে ব্যর্থ হয়েছে।");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner label="সার্ভিস ইনভয়েস লোড হচ্ছে..." />;
  if (error) return <ErrorState error={error} />;
  if (!ticket) return null;

  return (
    <div className="container-fluid p-0">
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <Link href={`/app/service/tickets/${ticket.id}`} className="btn btn-outline-secondary btn-sm">
              &larr; পেছনের পেজ
            </Link>
            <h1 className="h4 fw-bold mb-0 text-brand">সার্ভিস ইনভয়েস সংশোধন (Edit Service Invoice)</h1>
          </div>
          <span className="badge bg-primary fs-6 font-monospace mt-1">#{ticket.ticket_no}</span>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div className="row g-4">
          {/* Left Column: Form & Parts */}
          <div className="col-lg-8">
            {/* Customer Details Card */}
            <div className="card shadow-sm border-0 mb-4">
              <div className="card-header bg-white fw-bold py-3">
                <i className="bi bi-person me-2 text-brand"></i>কাস্টমার তথ্য (Customer Information)
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-6 position-relative">
                    <label className="form-label small fw-semibold">কাস্টমারের নাম</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        setCustSearch(e.target.value);
                      }}
                      placeholder="কাস্টমারের নাম লিখুন বা খুঁজুন..."
                      required
                    />
                    {custHits.length > 0 && (
                      <div className="position-absolute w-100 bg-white border rounded shadow-lg mt-1 p-0 z-3" style={{ maxHeight: "180px", overflowY: "auto" }}>
                        {custHits.map((c) => (
                          <div
                            key={c.id}
                            className="p-2 border-bottom cursor-pointer hover-bg-light small d-flex justify-content-between"
                            onClick={() => {
                              setCustomerId(c.id);
                              setCustomerName(c.name);
                              setCustomerPhone(c.phone || "");
                              setCustHits([]);
                              setCustSearch("");
                            }}
                          >
                            <strong>{c.name}</strong>
                            <span className="text-secondary">{c.phone}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">মোবাইল নম্বর</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="017xxxxxxxx"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Device & Service Info Card */}
            <div className="card shadow-sm border-0 mb-4">
              <div className="card-header bg-white fw-bold py-3">
                <i className="bi bi-laptop me-2 text-brand"></i>ডিভাইস ও সার্ভিসের বিবরণ (Device &amp; Service Info)
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">ডিভাইস বিবরণ (Device Model / Name) *</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={deviceDesc}
                      onChange={(e) => setDeviceDesc(e.target.value)}
                      placeholder="যেমন: Asus ZenBook 1201"
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">সম্ভাব্য ডেলিভারি তারিখ</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={estimatedDelivery}
                      onChange={(e) => setEstimatedDelivery(e.target.value)}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label small fw-semibold">সমস্যা / অভিযোগের বিবরণ (Complaint / Issue) *</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows={2}
                      value={complaint}
                      onChange={(e) => setComplaint(e.target.value)}
                      placeholder="যেমন: Display problem, slow performance, Increase HDD"
                      required
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>

            {/* Products & Parts Section */}
            <div className="card shadow-sm border-0 mb-4">
              <div className="card-header bg-white fw-bold py-3 d-flex justify-content-between align-items-center">
                <span>
                  <i className="bi bi-cpu me-2 text-brand"></i>ব্যবহৃত পার্টস ও যন্ত্রাংশ (Products &amp; Parts Used)
                </span>
                <span className="badge bg-secondary">{parts.length} টি পার্টস</span>
              </div>
              <div className="card-body">
                {/* Product Search Bar */}
                <div className="position-relative mb-3">
                  <div className="input-group input-group-sm">
                    <span className="input-group-text bg-light border-end-0">
                      <i className="bi bi-search"></i>
                    </span>
                    <input
                      type="text"
                      className="form-control border-start-0"
                      placeholder="স্টক থেকে নতুন পার্টস বা প্রোডাক্ট সার্চ করুন..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  {searching && <div className="small text-muted mt-1">খোঁজা হচ্ছে...</div>}

                  {searchResults.length > 0 && (
                    <div
                      className="position-absolute w-100 bg-white border rounded shadow-lg mt-1 p-0 z-3"
                      style={{ maxHeight: "220px", overflowY: "auto" }}
                    >
                      {searchResults.map((p) => (
                        <div
                          key={p.id}
                          className="p-2 border-bottom cursor-pointer hover-bg-light d-flex justify-content-between align-items-center"
                          onClick={() => addPart(p)}
                        >
                          <div>
                            <div className="fw-semibold small">{p.name}</div>
                            <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                              স্টক: {p.current_stock}
                            </div>
                          </div>
                          <div className="text-end">
                            <span className="fw-bold text-primary small">{money(p.selling_price)}</span>
                            <button type="button" className="btn btn-outline-brand btn-sm ms-2 py-0 px-2">
                              + যোগ
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Parts Table */}
                {parts.length === 0 ? (
                  <div className="text-center py-4 bg-light rounded text-muted small">
                    কোনো পার্টস যুক্ত করা হয়নি। শুধুমাত্র সার্ভিস চার্জ প্রযোজ্য হবে।
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead className="table-light">
                        <tr className="small text-secondary">
                          <th>প্রোডাক্ট / পার্টস</th>
                          <th style={{ width: "120px" }} className="text-center">পরিমাণ</th>
                          <th style={{ width: "140px" }} className="text-end">একক মূল্য (৳)</th>
                          <th style={{ width: "140px" }} className="text-end">মোট মূল্য (৳)</th>
                          <th style={{ width: "50px" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {parts.map((p, idx) => (
                          <tr key={idx}>
                            <td className="small">
                              <div className="fw-medium">{p.name}</div>
                            </td>
                            <td>
                              <div className="input-group input-group-sm justify-content-center">
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary py-0 px-2"
                                  onClick={() => updatePartQty(idx, Number(p.quantity) - 1)}
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  className="form-control text-center py-0"
                                  style={{ maxWidth: "50px" }}
                                  value={p.quantity}
                                  onChange={(e) => updatePartQty(idx, Number(e.target.value) || 1)}
                                />
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary py-0 px-2"
                                  onClick={() => updatePartQty(idx, Number(p.quantity) + 1)}
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="text-end">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="form-control form-control-sm text-end"
                                value={p.unit_price}
                                onChange={(e) => updatePartPrice(idx, Number(e.target.value) || 0)}
                              />
                            </td>
                            <td className="text-end fw-bold text-dark">
                              {money(Number(p.quantity) * Number(p.unit_price))}
                            </td>
                            <td className="text-end">
                              <button
                                type="button"
                                className="btn btn-link text-danger p-0"
                                onClick={() => removePart(idx)}
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Billing Summary & Save */}
          <div className="col-lg-4">
            <div className="card shadow-sm border-0 sticky-top" style={{ top: "1rem" }}>
              <div className="card-header bg-white fw-bold py-3">
                <i className="bi bi-receipt me-2 text-brand"></i>বিল সামারি ও হিসাব
              </div>
              <div className="card-body">
                {/* Service Charge Input */}
                <div className="mb-3">
                  <label className="form-label small fw-semibold">সার্ভিস / লেবার চার্জ (৳)</label>
                  <div className="input-group input-group-sm">
                    <span className="input-group-text">৳</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control form-control-sm text-end fw-bold"
                      value={serviceCharge}
                      onChange={(e) => setServiceCharge(Number(e.target.value) || 0)}
                    />
                  </div>
                </div>

                {/* Parts Total */}
                <div className="d-flex justify-content-between small text-secondary mb-2">
                  <span>পার্টস মোট মূল্য:</span>
                  <span className="fw-semibold text-dark">{money(partsTotal)}</span>
                </div>

                {/* Subtotal */}
                <div className="d-flex justify-content-between small text-secondary mb-3 pb-2 border-bottom">
                  <span>সাবটোটাল (Subtotal):</span>
                  <span className="fw-semibold text-dark">{money(subtotal)}</span>
                </div>

                {/* Discount Input */}
                <div className="mb-3">
                  <label className="form-label small fw-semibold">ডিসকাউন্ট (৳)</label>
                  <div className="input-group input-group-sm">
                    <span className="input-group-text">৳</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control form-control-sm text-end"
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                    />
                  </div>
                </div>

                {/* Total Bill Highlight */}
                <div className="p-3 bg-light rounded-3 border mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="fw-bold">সর্বমোট বিল (Total Bill):</span>
                    <span className="fs-5 fw-bold text-brand">{money(billTotal)}</span>
                  </div>
                  <div className="d-flex justify-content-between small text-secondary mb-1">
                    <span>পরিশোধিত (Already Paid):</span>
                    <span className="fw-medium text-success">+{money(paidAmount)}</span>
                  </div>
                  <div className="d-flex justify-content-between small fw-bold pt-2 border-top">
                    <span>বকেয়া (Remaining Due):</span>
                    <span className={remainingDue > 0 ? "text-danger" : "text-success"}>
                      {money(remainingDue)}
                    </span>
                  </div>
                </div>

                {/* Correction Reason */}
                <div className="mb-4">
                  <label className="form-label small fw-semibold text-danger">
                    সংশোধনের কারণ (Correction Reason) *
                  </label>
                  <textarea
                    className="form-control form-control-sm"
                    rows={2}
                    placeholder="কেন ইনভয়েস সংশোধন করছেন? যেমন: পার্টস পরিবর্তন, ভুল বিল সংশোধন..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                  ></textarea>
                </div>

                {/* Action Buttons */}
                <div className="d-grid gap-2">
                  <button type="submit" className="btn btn-brand btn-lg" disabled={submitting}>
                    {submitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>সংরক্ষণ হচ্ছে...
                      </>
                    ) : (
                      "✓ পরিবর্তন সংরক্ষণ করুন"
                    )}
                  </button>
                  <Link href={`/app/service/tickets/${ticket.id}`} className="btn btn-outline-secondary btn-sm">
                    বাতিল
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
