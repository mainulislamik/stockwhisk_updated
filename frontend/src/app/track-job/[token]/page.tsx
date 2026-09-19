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
  job_number: string;
  status: string;
  status_display: string;
  service_type: string;
  reference_no: string;
  specifications: string;
  delivery_date: string | null;
  actual_delivery_date: string | null;
  govt_fee: number;
  service_charge: number;
  other_charge: number;
  discount: number;
  total_bill: number;
  advance_paid: number;
  due_amount: number;
  customer_name: string;
  customer_phone_masked: string;
  shop: {
    id: number;
    name: string;
    phone: string;
    email: string;
    address: string;
  };
  history: HistoryItem[];
};

const STEPS = [
  { key: "pending", labelBn: "অর্ডার গৃহীত", labelEn: "Order Placed", icon: "bi-inbox" },
  { key: "processing", labelBn: "কাজ চলছে", labelEn: "In Progress", icon: "bi-gear-wide" },
  { key: "ready", labelBn: "ডেলিভারি প্রস্তুত", labelEn: "Ready for Pickup", icon: "bi-check2-circle" },
  { key: "delivered", labelBn: "ডেলিভার্ড", labelEn: "Delivered", icon: "bi-box-seam" },
];

function getStepIndex(status: string) {
  if (status === "cancelled") return -1;
  const idx = STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

export default function PublicJobTrackingPage() {
  const params = useParams();
  const token = params?.token as string;

  const [data, setData] = useState<TrackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`/api/service/public/track-job/${token}/`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || "ট্র্যাকিং তথ্য পাওয়া যায়নি");
        }
        return res.json();
      })
      .then((json) => {
        setData(json);
        setError(null);
      })
      .catch((err) => {
        setError(err.message || "নেটওয়ার্ক ত্রুটি");
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-vh-100 bg-light d-flex align-items-center justify-content-center p-3">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">লোড হচ্ছে...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-vh-100 bg-light d-flex align-items-center justify-content-center p-3">
        <div className="card border-0 shadow-sm p-4 text-center" style={{ maxWidth: 460 }}>
          <i className="bi bi-exclamation-triangle text-danger display-4 mb-3"></i>
          <h5 className="fw-bold mb-2">সেবা ট্র্যাকিং পাওয়া যায়নি</h5>
          <p className="text-muted small mb-4">{error || "টোকেন নম্বর সঠিক নয় অথবা মেয়াদোত্তীর্ণ।"}</p>
          <Link href="/" className="btn btn-primary btn-sm">স্টকহুইস্ক হোমপেজে যান</Link>
        </div>
      </div>
    );
  }

  const currentStep = getStepIndex(data.status);
  const isCancelled = data.status === "cancelled";

  return (
    <div className="min-vh-100 bg-light py-4 px-2">
      <div className="container" style={{ maxWidth: 640 }}>
        {/* Shop Branding Header */}
        <div className="card border-0 shadow-sm p-4 mb-3 bg-white text-center rounded-3">
          <div className="fw-bold fs-5 text-dark mb-1">{data.shop.name}</div>
          <div className="text-muted small mb-1">{data.shop.address || "ডিজিটাল সেবা ও প্রিন্টিং সেন্টার"}</div>
          {data.shop.phone && (
            <div className="small">
              <a href={`tel:${data.shop.phone}`} className="text-decoration-none text-primary fw-medium">
                <i className="bi bi-telephone-fill me-1"></i> {data.shop.phone}
              </a>
            </div>
          )}
        </div>

        {/* Job Token Status Card */}
        <div className="card border-0 shadow-sm p-4 mb-3 bg-white rounded-3">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <span className="text-muted small">টোকেন / মেমো নং:</span>
              <div className="fs-5 fw-bold text-primary font-monospace">{data.job_number}</div>
            </div>
            <span className={`badge px-3 py-2 ${
              data.status === "delivered" ? "bg-success" :
              data.status === "ready" ? "bg-primary" :
              data.status === "processing" ? "bg-warning text-dark" : "bg-secondary"
            }`}>
              {data.status_display}
            </span>
          </div>

          {/* Progress Timeline */}
          {!isCancelled && (
            <div className="my-4">
              <div className="d-flex justify-content-between position-relative">
                {STEPS.map((step, idx) => {
                  const isDone = idx <= currentStep;
                  const isCurrent = idx === currentStep;
                  return (
                    <div key={step.key} className="text-center flex-fill position-relative" style={{ zIndex: 2 }}>
                      <div
                        className={`rounded-circle mx-auto d-flex align-items-center justify-content-center shadow-sm ${
                          isCurrent
                            ? "bg-primary text-white ring-4"
                            : isDone
                            ? "bg-success text-white"
                            : "bg-light text-muted border"
                        }`}
                        style={{ width: 38, height: 38 }}
                      >
                        <i className={`bi ${step.icon} fs-6`}></i>
                      </div>
                      <div className="small fw-semibold mt-2" style={{ fontSize: "0.75rem" }}>
                        {step.labelBn}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Job Details */}
          <div className="border rounded-2 p-3 bg-light mb-3">
            <div className="row g-2 small">
              <div className="col-6">
                <span className="text-muted">কাস্টমার:</span>
                <div className="fw-semibold text-dark">{data.customer_name}</div>
              </div>
              <div className="col-6">
                <span className="text-muted">মোবাইল:</span>
                <div className="fw-semibold text-dark">{data.customer_phone_masked}</div>
              </div>
              <div className="col-12 mt-2">
                <span className="text-muted">সেবার ধরন:</span>
                <div className="fw-semibold text-dark">{data.service_type}</div>
              </div>
              {data.reference_no && (
                <div className="col-12">
                  <span className="text-muted">রেফারেন্স নং:</span>
                  <div className="fw-semibold text-dark">{data.reference_no}</div>
                </div>
              )}
              {data.delivery_date && (
                <div className="col-12 mt-2">
                  <span className="text-muted">সম্ভাব্য ডেলিভারি:</span>
                  <div className="fw-semibold text-primary">
                    {new Date(data.delivery_date).toLocaleString("bn-BD")}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bill Summary */}
          <div className="border rounded-2 p-3 bg-white">
            <div className="d-flex justify-content-between small text-muted mb-1">
              <span>মোট বিল:</span>
              <span className="fw-bold text-dark">৳{data.total_bill.toFixed(2)}</span>
            </div>
            <div className="d-flex justify-content-between small text-muted mb-1">
              <span>অগ্রিম পরিশোধিত:</span>
              <span className="text-success fw-semibold">৳{data.advance_paid.toFixed(2)}</span>
            </div>
            <hr className="my-2" />
            <div className="d-flex justify-content-between fw-bold">
              <span>পরিশোধযোগ্য বকেয়া:</span>
              <span className={data.due_amount > 0 ? "text-danger fs-5" : "text-success"}>
                {data.due_amount > 0 ? `৳${data.due_amount.toFixed(2)}` : "পরিশোধিত ✓"}
              </span>
            </div>
          </div>

          {data.status === "ready" && (
            <div className="alert alert-primary mt-3 mb-0 small">
              <i className="bi bi-info-circle-fill me-1"></i> আপনার ফাইল/সার্টিফিকেট প্রিন্ট ডেলিভারির জন্য প্রস্তুত। দোকানে এসে টোকেন নং প্রদর্শন করে ডেলিভারি সংগ্রহ করুন।
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-muted small py-3">
          Powered by <strong>StockWhisk ERP</strong>
        </div>
      </div>
    </div>
  );
}
