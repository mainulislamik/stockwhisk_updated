"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type HistoryItem = {
  id: number;
  from_status: string;
  to_status: string;
  note: string;
  created_at: string;
};

type TrackData = {
  ticket_no: string;
  status: string;
  status_display: string;
  device_description: string;
  device_type: string;
  complaint: string;
  received_at: string;
  estimated_delivery: string | null;
  actual_delivery: string | null;
  service_charge: number;
  discount: number;
  paid: number;
  bill_total: number;
  due: number;
  customer_name: string;
  customer_phone_masked: string;
  shop: {
    id: number;
    name: string;
    phone: string;
    email: string;
    address: string;
    logo: string;
  };
  history: HistoryItem[];
};

const STEPS = [
  { key: "received", labelBn: "রিসিভড", labelEn: "Received", icon: "bi-inbox" },
  { key: "diagnosing", labelBn: "ডায়াগনোসিস", labelEn: "Diagnosing", icon: "bi-search" },
  { key: "in_repair", labelBn: "সার্ভিসিং চলছে", labelEn: "In Repair", icon: "bi-tools" },
  { key: "ready_for_pickup", labelBn: "রেডি (সংগ্রহ করুন)", labelEn: "Ready for Pickup", icon: "bi-check2-circle" },
  { key: "delivered", labelBn: "ডেলিভার্ড", labelEn: "Delivered", icon: "bi-box-seam" },
];

function getStepIndex(status: string) {
  if (status === "awaiting_parts") return 2; // Treat as In Repair step
  if (status === "cancelled") return -1;
  const idx = STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

export default function PublicTicketTrackingPage() {
  const params = useParams();
  const token = params?.token as string;

  const [data, setData] = useState<TrackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [lang, setLang] = useState<"bn" | "en">("bn");

  async function fetchTracking(silent = false) {
    if (!token) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/service/public/track/${token}/`);
      if (!res.ok) {
        throw new Error(res.status === 404 ? (lang === "bn" ? "সার্ভিস টিকিট খুঁজে পাওয়া যায়নি।" : "Service ticket not found.") : "Failed to load tracking info.");
      }
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());
      setError("");
    } catch (err: any) {
      if (!silent) setError(err.message || "Failed to load tracking data");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    fetchTracking();
    // Auto-refresh every 10 seconds for real-time live updates
    const interval = setInterval(() => {
      fetchTracking(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [token]);

  function fmtDate(d: string | null | undefined) {
    if (!d) return "—";
    try {
      const dt = new Date(d);
      return dt.toLocaleDateString("bn-BD", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return d;
    }
  }

  function fmtDateTime(d: string | null | undefined) {
    if (!d) return "—";
    try {
      const dt = new Date(d);
      return dt.toLocaleString("bn-BD", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return d;
    }
  }

  function money(n: number) {
    return `৳${Number(n || 0).toFixed(2)}`;
  }

  if (loading) {
    return (
      <div className="min-vh-100 d-flex flex-column align-items-center justify-content-center bg-light p-3">
        <div className="spinner-border text-primary mb-3" role="status" style={{ width: "3rem", height: "3rem" }}></div>
        <p className="text-secondary fw-semibold">{lang === "bn" ? "সার্ভিস ট্র্যাকিং ডেটা লোড হচ্ছে..." : "Loading service tracking..."}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-vh-100 d-flex flex-column align-items-center justify-content-center bg-light p-3">
        <div className="card shadow-sm border-0 rounded-4 p-4 text-center" style={{ maxWidth: 420 }}>
          <div className="display-4 text-danger mb-3">⚠️</div>
          <h4 className="fw-bold mb-2">{lang === "bn" ? "টিকিট পাওয়া যায়নি" : "Ticket Not Found"}</h4>
          <p className="text-secondary mb-4">{error || (lang === "bn" ? "ট্র্যাকিং লিংকটি সঠিক নয় অথবা মেয়াদোত্তীর্ণ।" : "Invalid tracking link.")}</p>
          <button className="btn btn-primary rounded-pill px-4" onClick={() => fetchTracking()}>
            🔄 {lang === "bn" ? "আবার চেষ্টা করুন" : "Try Again"}
          </button>
        </div>
      </div>
    );
  }

  const currentStepIdx = getStepIndex(data.status);
  const isCancelled = data.status === "cancelled";

  return (
    <div className="min-vh-100 bg-light py-4 px-2 px-md-3">
      <div className="container" style={{ maxWidth: 680 }}>
        {/* Language & Live Indicator Header */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex align-items-center gap-2">
            <span className="spinner-grow spinner-grow-sm text-success" role="status"></span>
            <span className="small text-secondary fw-semibold">
              {lang === "bn" ? "লাইভ ট্র্যাকিং সক্রিয়" : "Live Tracking Active"} • {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
          <button
            className="btn btn-sm btn-outline-secondary rounded-pill px-3 py-0"
            style={{ fontSize: "0.8rem" }}
            onClick={() => setLang(lang === "bn" ? "en" : "bn")}
          >
            🌐 {lang === "bn" ? "English" : "বাংলা"}
          </button>
        </div>

        {/* Shop Branding Card */}
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-3 bg-white">
          <div className="p-4 d-flex align-items-center gap-3 border-bottom">
            {data.shop.logo ? (
              <img src={data.shop.logo} alt={data.shop.name} className="rounded-3" style={{ width: 60, height: 60, objectFit: "contain" }} />
            ) : (
              <div className="rounded-4 bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center fw-bold fs-2 shadow-sm" style={{ width: 60, height: 60 }}>
                🔧
              </div>
            )}
            <div className="flex-grow-1">
              <h4 className="fw-bold mb-1 text-dark">{data.shop.name}</h4>
              <p className="text-secondary small mb-0">{data.shop.address || (lang === "bn" ? "সার্ভিসিং ও রিপেয়ার সেন্টার" : "Service & Repair Center")}</p>
            </div>
            {data.shop.phone && (
              <a href={`tel:${data.shop.phone}`} className="btn btn-primary rounded-circle d-flex align-items-center justify-content-center shadow-sm" style={{ width: 44, height: 44 }} title="কল করুন">
                📞
              </a>
            )}
          </div>

          {/* Ticket ID & Main Status Badge */}
          <div className="p-3 bg-body-tertiary d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div>
              <div className="small text-secondary">{lang === "bn" ? "সার্ভিস টিকিট নম্বর:" : "Ticket No:"}</div>
              <div className="fw-bold font-monospace fs-5 text-primary">#{data.ticket_no}</div>
            </div>
            <div>
              {isCancelled ? (
                <span className="badge bg-danger rounded-pill px-3 py-2 fs-6">❌ {lang === "bn" ? "বাতিল করা হয়েছে" : "Cancelled"}</span>
              ) : (
                <span className={`badge rounded-pill px-3 py-2 fs-6 ${data.status === "delivered" ? "bg-success" : (data.status === "ready_for_pickup" ? "bg-primary" : "bg-warning text-dark")}`}>
                  ● {STEPS.find(s => s.key === data.status)?.[lang === "bn" ? "labelBn" : "labelEn"] || data.status_display}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Live Visual Stepper Card */}
        {!isCancelled && (
          <div className="card border-0 shadow-sm rounded-4 p-4 mb-3 bg-white">
            <h6 className="fw-bold text-dark mb-4 d-flex align-items-center gap-2">
              <span>🚀</span>
              <span>{lang === "bn" ? "সার্ভিস অগ্রগতির ধাপ" : "Service Progress"}</span>
            </h6>

            <div className="position-relative mb-2">
              {/* Progress Line */}
              <div className="position-absolute top-50 start-0 translate-middle-y w-100 bg-secondary bg-opacity-25" style={{ height: 4, zIndex: 1 }}></div>
              <div
                className="position-absolute top-50 start-0 translate-middle-y bg-success transition-all"
                style={{
                  height: 4,
                  zIndex: 2,
                  width: `${(currentStepIdx / (STEPS.length - 1)) * 100}%`,
                  transition: "width 0.4s ease-in-out",
                }}
              ></div>

              {/* Step Circles */}
              <div className="d-flex justify-content-between position-relative" style={{ zIndex: 3 }}>
                {STEPS.map((step, idx) => {
                  const isDone = idx <= currentStepIdx;
                  const isCurrent = idx === currentStepIdx;
                  return (
                    <div key={step.key} className="d-flex flex-column align-items-center text-center" style={{ width: 70 }}>
                      <div
                        className={`rounded-circle d-flex align-items-center justify-content-center shadow-sm transition-all ${
                          isDone
                            ? (isCurrent ? "bg-primary text-white ring-4" : "bg-success text-white")
                            : "bg-white text-secondary border border-2"
                        }`}
                        style={{
                          width: 38,
                          height: 38,
                          boxShadow: isCurrent ? "0 0 0 4px rgba(13, 110, 253, 0.25)" : undefined,
                        }}
                      >
                        <i className={`bi ${step.icon} fs-6`}></i>
                      </div>
                      <span className={`small mt-2 ${isCurrent ? "fw-bold text-primary" : (isDone ? "fw-semibold text-dark" : "text-muted")}`} style={{ fontSize: "0.72rem", lineHeight: 1.2 }}>
                        {lang === "bn" ? step.labelBn : step.labelEn}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Device & Problem Details Card */}
        <div className="card border-0 shadow-sm rounded-4 p-4 mb-3 bg-white">
          <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
            <span>📱</span>
            <span>{lang === "bn" ? "ডিভাইস ও সমস্যার বিবরণ" : "Device & Problem Info"}</span>
          </h6>

          <div className="row g-3">
            <div className="col-12 col-sm-6">
              <div className="p-3 bg-light rounded-3">
                <div className="small text-secondary mb-1">{lang === "bn" ? "ডিভাইস মডেল" : "Device Model"}</div>
                <div className="fw-bold text-dark">{data.device_description}</div>
              </div>
            </div>
            <div className="col-12 col-sm-6">
              <div className="p-3 bg-light rounded-3">
                <div className="small text-secondary mb-1">{lang === "bn" ? "রিসিভ তারিখ" : "Received Date"}</div>
                <div className="fw-semibold text-dark">{fmtDate(data.received_at)}</div>
              </div>
            </div>
            <div className="col-12">
              <div className="p-3 bg-light rounded-3">
                <div className="small text-secondary mb-1">{lang === "bn" ? "সমস্যার বিবরণ / অভিযোগ" : "Problem / Complaint"}</div>
                <div className="text-dark fw-medium">{data.complaint || "—"}</div>
              </div>
            </div>
            {data.estimated_delivery && (
              <div className="col-12">
                <div className="p-3 bg-info bg-opacity-10 border border-info border-opacity-25 rounded-3 d-flex justify-content-between align-items-center">
                  <span className="small text-info-emphasis fw-semibold">📅 {lang === "bn" ? "সম্ভাব্য ডেলিভারি তারিখ:" : "Est. Delivery Date:"}</span>
                  <span className="fw-bold text-info-emphasis">{fmtDate(data.estimated_delivery)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Financial & Due Breakdown Card */}
        <div className="card border-0 shadow-sm rounded-4 p-4 mb-3 bg-white">
          <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
            <span>💵</span>
            <span>{lang === "bn" ? "বিল ও পেমেন্ট বিবরণ" : "Billing & Payment"}</span>
          </h6>

          <div className="d-flex flex-column gap-2">
            <div className="d-flex justify-content-between text-secondary small">
              <span>{lang === "bn" ? "সার্ভিসিং চার্জ:" : "Service Charge:"}</span>
              <span className="fw-semibold text-dark">{money(data.service_charge)}</span>
            </div>
            {data.discount > 0 && (
              <div className="d-flex justify-content-between text-danger small">
                <span>{lang === "bn" ? "ডিসকাউন্ট:" : "Discount:"}</span>
                <span className="fw-semibold">-{money(data.discount)}</span>
              </div>
            )}
            <hr className="my-1 border-secondary opacity-25" />
            <div className="d-flex justify-content-between fw-bold text-dark">
              <span>{lang === "bn" ? "মোট বিল:" : "Total Bill:"}</span>
              <span className="text-primary fs-5">{money(data.bill_total)}</span>
            </div>
            <div className="d-flex justify-content-between text-success small">
              <span>{lang === "bn" ? "অগ্রিম জমা (Paid):" : "Advance Paid:"}</span>
              <span className="fw-semibold">{money(data.paid)}</span>
            </div>
            {data.due > 0 ? (
              <div className="d-flex justify-content-between text-danger fw-bold p-2 bg-danger bg-opacity-10 rounded-3 mt-1">
                <span>{lang === "bn" ? "অবশিষ্ট বাকি (Due):" : "Remaining Due:"}</span>
                <span>{money(data.due)}</span>
              </div>
            ) : (
              <div className="d-flex justify-content-between text-success fw-bold p-2 bg-success bg-opacity-10 rounded-3 mt-1">
                <span>{lang === "bn" ? "পরিশোধ স্ট্যাটাস:" : "Payment Status:"}</span>
                <span>✅ {lang === "bn" ? "সম্পূর্ণ পরিশোধিত" : "Fully Paid"}</span>
              </div>
            )}
          </div>
        </div>

        {/* Activity Timeline Card */}
        {data.history && data.history.length > 0 && (
          <div className="card border-0 shadow-sm rounded-4 p-4 mb-3 bg-white">
            <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
              <span>🕒</span>
              <span>{lang === "bn" ? "সার্ভিস আপডেট টাইমলাইন" : "Status History Timeline"}</span>
            </h6>

            <div className="d-flex flex-column gap-3">
              {data.history.map((h, i) => (
                <div key={h.id || i} className="d-flex gap-3 align-items-start border-start border-2 border-primary ps-3 position-relative">
                  <div className="position-absolute top-0 start-0 translate-middle-x bg-primary rounded-circle" style={{ width: 10, height: 10, marginTop: 4 }}></div>
                  <div className="flex-grow-1">
                    <div className="fw-bold text-dark small">
                      {h.from_status ? `${h.from_status} → ` : ""}
                      <span className="text-primary">{h.to_status.replace(/_/g, " ").toUpperCase()}</span>
                    </div>
                    {h.note && <div className="text-muted small mt-0.5">{h.note}</div>}
                    <div className="text-secondary" style={{ fontSize: "0.72rem" }}>{fmtDateTime(h.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="text-center text-muted small py-3">
          <p className="mb-1">{data.shop.name} • {data.shop.phone}</p>
          <p className="mb-0 text-secondary" style={{ fontSize: "0.75rem" }}>
            Powered by <strong className="text-brand">StockWhisk</strong> Service Suite
          </p>
        </div>
      </div>
    </div>
  );
}
