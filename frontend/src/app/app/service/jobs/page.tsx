"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { api, useApi, Paginated } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { ErrorState, Pagination, Spinner, money, fmtDate } from "@/components/ui";
import toast from "react-hot-toast";
import { useLanguage } from "@/contexts/LanguageContext";

type ServiceJob = {
  id: number;
  job_number: string;
  customer: number | null;
  customer_name: string;
  customer_phone: string;
  service_type: string;
  reference_no: string;
  delivery_date: string;
  actual_delivery_date: string | null;
  status: string;
  status_display: string;
  govt_fee: string;
  service_charge: string;
  other_charge: string;
  discount: string;
  total_bill: string;
  advance_paid: string;
  due_amount: string;
  material_cost: string;
  track_token: string;
  public_track_url: string;
  whatsapp_ready_url: string;
  is_overdue: boolean;
  created_at: string;
};

type Summary = {
  total_jobs: number;
  pending_count: number;
  processing_count: number;
  ready_count: number;
  delivered_count: number;
  total_govt_fee: number;
  total_service_charge: number;
  total_material_cost: number;
  total_bill: number;
  total_advance_paid: number;
  total_due_amount: number;
  net_service_profit: number;
};

const statusBadge: Record<string, string> = {
  pending: "bg-secondary text-white",
  processing: "bg-warning text-dark",
  ready: "bg-primary text-white",
  delivered: "bg-success text-white",
  cancelled: "bg-dark text-white",
};

export default function ServiceJobsPage() {
  const { t } = useLanguage();
  const { can, isOwner, user } = useAuth();
  const canManage = isOwner || can("manage_service");
  
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [activeJobForPayment, setActiveJobForPayment] = useState<ServiceJob | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  // Preset calculator state
  const [calcPreset, setCalcPreset] = useState("custom");
  const [bannerWidth, setBannerWidth] = useState("");
  const [bannerHeight, setBannerHeight] = useState("");
  const [bannerRate, setBannerRate] = useState("25");
  const [docPages, setDocPages] = useState("1");
  const [docRate, setDocRate] = useState("2.50");

  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    service_type: "Online Service",
    reference_no: "",
    specifications: "",
    delivery_date: "",
    govt_fee: "0",
    service_charge: "0",
    other_charge: "0",
    discount: "0",
    advance_paid: "0",
    payment_method: "cash",
  });
  const [saving, setSaving] = useState(false);

  const PAGE_SIZE = 20;
  const queryParams: Record<string, any> = { page, page_size: PAGE_SIZE };
  if (statusFilter) queryParams.status = statusFilter;
  if (search) queryParams.search = search;

  const { data, loading, error, mutate } = useApi<Paginated<ServiceJob>>("/service/jobs/", queryParams);
  const { data: summary, mutate: mutateSummary } = useApi<Summary>("/service/jobs/summary/");

  const rows = data?.results || [];
  const total = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 1-Click Preset Handler
  const handlePresetSelect = (presetKey: string) => {
    setCalcPreset(presetKey);
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dateStr = tomorrow.toISOString().slice(0, 16);

    if (presetKey === "passport_5y") {
      setForm((prev) => ({
        ...prev,
        service_type: "ই-পাসপোর্ট আবেদন (৫ বছর / ৪৮ পাতা)",
        govt_fee: "4025",
        service_charge: "500",
        other_charge: "0",
        delivery_date: dateStr,
      }));
    } else if (presetKey === "passport_10y") {
      setForm((prev) => ({
        ...prev,
        service_type: "ই-পাসপোর্ট আবেদন (১০ বছর / ৪৮ পাতা)",
        govt_fee: "5750",
        service_charge: "500",
        other_charge: "0",
        delivery_date: dateStr,
      }));
    } else if (presetKey === "police_clearance") {
      setForm((prev) => ({
        ...prev,
        service_type: "পুলিশ ক্লিয়ারেন্স সার্টিফিকেট",
        govt_fee: "500",
        service_charge: "250",
        other_charge: "0",
        delivery_date: dateStr,
      }));
    } else if (presetKey === "nid_smartcard") {
      setForm((prev) => ({
        ...prev,
        service_type: "ভোটার এনআইডি সংশোধন / রি-ইস্যু",
        govt_fee: "230",
        service_charge: "200",
        other_charge: "0",
        delivery_date: dateStr,
      }));
    } else if (presetKey === "banner_print") {
      setForm((prev) => ({
        ...prev,
        service_type: "পিভিসি ব্যানার ও সাইনবোর্ড প্রিন্ট",
        govt_fee: "0",
        delivery_date: dateStr,
      }));
    } else if (presetKey === "photocopy_print") {
      setForm((prev) => ({
        ...prev,
        service_type: "ফটোকপি ও কালার প্রিন্ট",
        govt_fee: "0",
        delivery_date: dateStr,
      }));
    }
  };

  // Re-calculate banner sqft
  const handleBannerCalc = (w: string, h: string, r: string) => {
    const width = parseFloat(w) || 0;
    const height = parseFloat(h) || 0;
    const rate = parseFloat(r) || 0;
    const sqft = width * height;
    const totalCost = (sqft * rate).toFixed(2);
    setForm((prev) => ({
      ...prev,
      service_charge: totalCost,
      specifications: `${width} ft x ${height} ft = ${sqft} sq.ft @ ${rate} Tk/sqft`,
    }));
  };

  // Re-calculate photocopy
  const handleDocCalc = (p: string, r: string) => {
    const pages = parseInt(p) || 0;
    const rate = parseFloat(r) || 0;
    const totalCost = (pages * rate).toFixed(2);
    setForm((prev) => ({
      ...prev,
      service_charge: totalCost,
      specifications: `${pages} পাতা x ${rate} Tk`,
    }));
  };

  // Live bill computation
  const liveTotalBill = useMemo(() => {
    const g = parseFloat(form.govt_fee) || 0;
    const s = parseFloat(form.service_charge) || 0;
    const o = parseFloat(form.other_charge) || 0;
    const d = parseFloat(form.discount) || 0;
    return Math.max(0, g + s + o - d).toFixed(2);
  }, [form.govt_fee, form.service_charge, form.other_charge, form.discount]);

  const liveDue = useMemo(() => {
    const tot = parseFloat(liveTotalBill) || 0;
    const adv = parseFloat(form.advance_paid) || 0;
    return Math.max(0, tot - adv).toFixed(2);
  }, [liveTotalBill, form.advance_paid]);

  // Create Job Handler
  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name.trim() || !form.customer_phone.trim()) {
      toast.error("গ্রাহকের নাম ও মোবাইল নম্বর দেওয়া বাধ্যতামূলক!");
      return;
    }
    setSaving(true);
    try {
      await api("/service/jobs/", { method: "POST", body: form });
      toast.success("সার্ভিস জব সফলভাবে তৈরি হয়েছে!");
      setShowAdd(false);
      setForm({
        customer_name: "",
        customer_phone: "",
        service_type: "Online Service",
        reference_no: "",
        specifications: "",
        delivery_date: "",
        govt_fee: "0",
        service_charge: "0",
        other_charge: "0",
        discount: "0",
        advance_paid: "0",
        payment_method: "cash",
      });
      mutate();
      mutateSummary();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "জব তৈরি করা যায়নি");
    } finally {
      setSaving(false);
    }
  };

  // Status transition
  const handleStatusChange = async (jobId: number, newStatus: string) => {
    try {
      await api(`/service/jobs/${jobId}/update_status/`, { method: "POST", body: { status: newStatus } });
      toast.success(`স্ট্যাটাস পরিবর্তন করা হয়েছে: ${newStatus}`);
      mutate();
      mutateSummary();
    } catch (err: any) {
      toast.error("স্ট্যাটাস আপডেট ব্যর্থ হয়েছে");
    }
  };

  // Settle Payment
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeJobForPayment || !paymentAmount) return;
    try {
      await api(`/service/jobs/${activeJobForPayment.id}/add_payment/`, {
        method: "POST",
        body: {
          amount: paymentAmount,
          payment_method: paymentMethod,
        },
      });
      toast.success("পেমেন্ট জমা হয়েছে!");
      setActiveJobForPayment(null);
      setPaymentAmount("");
      mutate();
      mutateSummary();
    } catch (err: any) {
      toast.error("পেমেন্ট যোগ করা যায়নি");
    }
  };

  return (
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <h2 className="h4 mb-1 fw-bold text-dark">🖨️ প্রিন্টিং ও ডিজিটাল অনলাইন সেবা (Cyber & Service Hub)</h2>
          <p className="text-muted mb-0 small">
            পাসপোর্ট, পুলিশ ক্লিয়ারেন্স, ব্যানার ডাইমেনশন ক্যালকুলেটর, টোকেন ট্র্যাকিং এবং স্প্লিট অ্যাকাউন্টিং।
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              setShowAdd(true);
              handlePresetSelect("passport_10y");
            }}
            className="btn btn-primary d-flex align-items-center gap-2 shadow-sm"
          >
            <i className="bi bi-plus-circle"></i> নতুন সার্ভিস জব / টোকেন স্লিপ
          </button>
        )}
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="row g-3 mb-4">
          <div className="col-12 col-sm-6 col-xl-3">
            <div className="card border-0 shadow-sm p-3 bg-white h-100 border-start border-4 border-primary">
              <div className="text-muted small fw-semibold">মোট সেবা কাজ (Total Jobs)</div>
              <div className="fs-4 fw-bold text-dark mt-1">{summary.total_jobs} টি</div>
              <div className="small text-muted mt-1">
                <span className="text-warning fw-bold">{summary.processing_count} রানিং</span> |{" "}
                <span className="text-primary fw-bold">{summary.ready_count} প্রস্তুত</span> |{" "}
                <span className="text-success fw-bold">{summary.delivered_count} সমাপ্ত</span>
              </div>
            </div>
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            <div className="card border-0 shadow-sm p-3 bg-white h-100 border-start border-4 border-info">
              <div className="text-muted small fw-semibold">সরকারি ফি (Pass-Through)</div>
              <div className="fs-4 fw-bold text-info mt-1">৳{money(summary.total_govt_fee)}</div>
              <div className="small text-muted mt-1">ব্যাংক/চালান জমাকৃত (দোকানের মূলধন নয়)</div>
            </div>
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            <div className="card border-0 shadow-sm p-3 bg-white h-100 border-start border-4 border-success">
              <div className="text-muted small fw-semibold">দোকানের নিট সেবা লাভ</div>
              <div className="fs-4 fw-bold text-success mt-1">৳{money(summary.net_service_profit)}</div>
              <div className="small text-muted mt-1">সার্ভিস ফি বাদ কাঁচামাল খরচ</div>
            </div>
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            <div className="card border-0 shadow-sm p-3 bg-white h-100 border-start border-4 border-danger">
              <div className="text-muted small fw-semibold">মোট কাস্টমার বকেয়া (Due)</div>
              <div className="fs-4 fw-bold text-danger mt-1">৳{money(summary.total_due_amount)}</div>
              <div className="small text-muted mt-1">ডেলিভারির সময় আদায়যোগ্য</div>
            </div>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="card border-0 shadow-sm p-3 mb-4 bg-white">
        <div className="row g-3 align-items-center">
          <div className="col-12 col-md-5">
            <div className="input-group">
              <span className="input-group-text bg-light border-0"><i className="bi bi-search"></i></span>
              <input
                type="text"
                className="form-control bg-light border-0"
                placeholder="টোকেন নং, কাস্টমারের নাম, ফোন বা রেফারেন্স আইডি..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </div>
          <div className="col-12 col-md-4">
            <select
              className="form-select bg-light border-0"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">সকল স্ট্যাটাস (All Status)</option>
              <option value="pending">Pending (অপেক্ষমান)</option>
              <option value="processing">Processing (কাজ চলছে)</option>
              <option value="ready">Ready for Delivery (প্রস্তুত)</option>
              <option value="delivered">Delivered (ডেলিভার্ড)</option>
              <option value="cancelled">Cancelled (বাতিল)</option>
            </select>
          </div>
          <div className="col-12 col-md-3 text-md-end">
            <button
              onClick={() => { mutate(); mutateSummary(); }}
              className="btn btn-outline-secondary btn-sm px-3"
            >
              <i className="bi bi-arrow-clockwise"></i> রিফ্রেশ
            </button>
          </div>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="card border-0 shadow-sm bg-white overflow-hidden">
        {loading && <div className="p-5 text-center"><Spinner /></div>}
        {error && <ErrorState error={error} />}
        {!loading && !error && (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light small text-muted text-uppercase">
                <tr>
                  <th>টোকেন ও আইডি</th>
                  <th>কাস্টমার ও যোগাযোগ</th>
                  <th>সেবার নাম ও বিবরণ</th>
                  <th>অর্থ বিভাজন (Split Bill)</th>
                  <th>বকেয়া</th>
                  <th>ডেলিভারি তারিখ</th>
                  <th>স্ট্যাটাস</th>
                  <th className="text-end">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="small">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-5 text-muted">
                      কোনো সার্ভিস জব পাওয়া যায়নি। "নতুন সার্ভিস জব" বাটনে ক্লিক করে প্রথম অর্ডার গ্রহণ করুন।
                    </td>
                  </tr>
                ) : (
                  rows.map((j) => (
                    <tr key={j.id}>
                      <td>
                        <div className="fw-bold text-primary font-monospace">{j.job_number}</div>
                        {j.reference_no && <div className="text-muted small">Ref: {j.reference_no}</div>}
                      </td>
                      <td>
                        <div className="fw-semibold text-dark">{j.customer_name}</div>
                        <div className="text-muted">{j.customer_phone}</div>
                      </td>
                      <td>
                        <div className="fw-medium">{j.service_type}</div>
                        <div className="text-muted small">{j.reference_no || "—"}</div>
                      </td>
                      <td>
                        <div>মোট বিল: <span className="fw-bold">৳{money(j.total_bill)}</span></div>
                        <div className="text-muted small">
                          সরকারি: ৳{money(j.govt_fee)} | ফি: ৳{money(j.service_charge)}
                        </div>
                      </td>
                      <td>
                        {parseFloat(j.due_amount) > 0 ? (
                          <span className="badge bg-danger text-white">বকেয়া: ৳{money(j.due_amount)}</span>
                        ) : (
                          <span className="badge bg-success text-white">পরিশোধিত</span>
                        )}
                      </td>
                      <td>
                        <div>{fmtDate(j.delivery_date)}</div>
                        {j.is_overdue && <span className="badge bg-danger-subtle text-danger">বিলম্বিত</span>}
                      </td>
                      <td>
                        <span className={`badge ${statusBadge[j.status] || "bg-secondary"}`}>
                          {j.status_display}
                        </span>
                      </td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          {/* Settle Due button if due exists */}
                          {parseFloat(j.due_amount) > 0 && canManage && (
                            <button
                              onClick={() => {
                                setActiveJobForPayment(j);
                                setPaymentAmount(j.due_amount);
                              }}
                              className="btn btn-outline-success"
                              title="বকেয়া আদায় করুন"
                            >
                              <i className="bi bi-cash"></i>
                            </button>
                          )}
                          {/* Next Status Quick Button */}
                          {j.status === "pending" && canManage && (
                            <button
                              onClick={() => handleStatusChange(j.id, "processing")}
                              className="btn btn-outline-warning"
                              title="কাজ শুরু করুন (Processing)"
                            >
                              <i className="bi bi-play-fill"></i>
                            </button>
                          )}
                          {j.status === "processing" && canManage && (
                            <button
                              onClick={() => handleStatusChange(j.id, "ready")}
                              className="btn btn-outline-primary"
                              title="রেডি মার্ক করুন (Ready)"
                            >
                              <i className="bi bi-check2-circle"></i>
                            </button>
                          )}
                          {j.status === "ready" && canManage && (
                            <button
                              onClick={() => handleStatusChange(j.id, "delivered")}
                              className="btn btn-outline-success"
                              title="ডেলিভার্ড মার্ক করুন"
                            >
                              <i className="bi bi-box-arrow-right"></i>
                            </button>
                          )}
                          {/* WhatsApp Ready Alert */}
                          {j.customer_phone && (
                            <a
                              href={j.whatsapp_ready_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-outline-success"
                              title="কাস্টমারকে হোয়াটসঅ্যাপে জানান"
                            >
                              <i className="bi bi-whatsapp"></i>
                            </a>
                          )}
                          {/* Public Tracking Link */}
                          <a
                            href={j.public_track_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline-secondary"
                            title="পাবলিক ট্র্যাকিং পেজ"
                          >
                            <i className="bi bi-eye"></i>
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="p-3 border-top">
          <Pagination page={page} totalPages={totalPages} setPage={setPage} total={data?.count || 0} />
        </div>
      </div>

      {/* New Job Sheet Modal */}
      {showAdd && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-file-earmark-plus me-2"></i> নতুন ডিজিটাল জব শিট ও টোকেন অর্ডার
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowAdd(false)}></button>
              </div>
              <form onSubmit={handleCreateJob}>
                <div className="modal-body p-4">
                  {/* Quick Presets */}
                  <label className="form-label fw-bold text-dark mb-2">⚡ ১-ক্লিক দ্রুত সেবা প্রিসেট নির্বাচন:</label>
                  <div className="d-flex flex-wrap gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => handlePresetSelect("passport_10y")}
                      className={`btn btn-sm ${calcPreset === "passport_10y" ? "btn-primary" : "btn-outline-primary"}`}
                    >
                      🛂 পাসপোর্ট (১০ বছর / ৳৫,৭৫০)
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePresetSelect("passport_5y")}
                      className={`btn btn-sm ${calcPreset === "passport_5y" ? "btn-primary" : "btn-outline-primary"}`}
                    >
                      🛂 পাসপোর্ট (৫ বছর / ৳৪,০২৫)
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePresetSelect("police_clearance")}
                      className={`btn btn-sm ${calcPreset === "police_clearance" ? "btn-primary" : "btn-outline-primary"}`}
                    >
                      👮 পুলিশ ক্লিয়ারেন্স (৳৫০০)
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePresetSelect("nid_smartcard")}
                      className={`btn btn-sm ${calcPreset === "nid_smartcard" ? "btn-primary" : "btn-outline-primary"}`}
                    >
                      🆔 এনআইডি কার্ড (৳২৩০)
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePresetSelect("banner_print")}
                      className={`btn btn-sm ${calcPreset === "banner_print" ? "btn-primary" : "btn-outline-primary"}`}
                    >
                      📐 ব্যানার স্কয়ারফিট ক্যালকুলেটর
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePresetSelect("photocopy_print")}
                      className={`btn btn-sm ${calcPreset === "photocopy_print" ? "btn-primary" : "btn-outline-primary"}`}
                    >
                      📄 ফটোকপি কাউন্টার
                    </button>
                  </div>

                  {/* Banner Dynamic Calculator View */}
                  {calcPreset === "banner_print" && (
                    <div className="p-3 mb-4 rounded bg-light border border-info">
                      <h6 className="fw-bold text-info mb-2">📐 ব্যানার ডাইমেনশন (দৈর্ঘ্য × প্রস্থ) ক্যালকুলেটর:</h6>
                      <div className="row g-2">
                        <div className="col-4">
                          <label className="form-label small text-muted">দৈর্ঘ্য (ফুট):</label>
                          <input
                            type="number"
                            step="0.1"
                            className="form-control"
                            placeholder="e.g. 8"
                            value={bannerWidth}
                            onChange={(e) => {
                              setBannerWidth(e.target.value);
                              handleBannerCalc(e.target.value, bannerHeight, bannerRate);
                            }}
                          />
                        </div>
                        <div className="col-4">
                          <label className="form-label small text-muted">প্রস্থ (ফুট):</label>
                          <input
                            type="number"
                            step="0.1"
                            className="form-control"
                            placeholder="e.g. 3"
                            value={bannerHeight}
                            onChange={(e) => {
                              setBannerHeight(e.target.value);
                              handleBannerCalc(bannerWidth, e.target.value, bannerRate);
                            }}
                          />
                        </div>
                        <div className="col-4">
                          <label className="form-label small text-muted">রেট (৳/স্কয়ারফিট):</label>
                          <input
                            type="number"
                            step="1"
                            className="form-control"
                            value={bannerRate}
                            onChange={(e) => {
                              setBannerRate(e.target.value);
                              handleBannerCalc(bannerWidth, bannerHeight, e.target.value);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Customer Info */}
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">কাস্টমারের নাম *</label>
                      <input
                        type="text"
                        required
                        className="form-control"
                        placeholder="কাস্টমারের পূর্ণ নাম"
                        value={form.customer_name}
                        onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">মোবাইল নম্বর * (এসএমএস/হোয়াটসঅ্যাপ)</label>
                      <input
                        type="tel"
                        required
                        className="form-control"
                        placeholder="017XXXXXXXX"
                        value={form.customer_phone}
                        onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">সেবার নাম ও টাইটেল</label>
                      <input
                        type="text"
                        className="form-control"
                        value={form.service_type}
                        onChange={(e) => setForm({ ...form, service_type: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">রেফারেন্স / আবেদন আইডি নং</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="যেমন: OID-98234, ট্র্যাকিং নং"
                        value={form.reference_no}
                        onChange={(e) => setForm({ ...form, reference_no: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">সম্ভাব্য ডেলিভারির তারিখ ও সময় *</label>
                    <input
                      type="datetime-local"
                      required
                      className="form-control"
                      value={form.delivery_date}
                      onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
                    />
                  </div>

                  {/* Split Accounting Fields */}
                  <div className="p-3 bg-light rounded border mb-4">
                    <h6 className="fw-bold text-dark mb-3">💰 স্প্লিট বিল ও আর্থিক বিভাজন (Split Accounting)</h6>
                    <div className="row g-3">
                      <div className="col-md-4">
                        <label className="form-label small text-muted fw-bold">সরকারি ফি (৳ - Pass Through)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="form-control text-info fw-bold"
                          value={form.govt_fee}
                          onChange={(e) => setForm({ ...form, govt_fee: e.target.value })}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label small text-muted fw-bold">দোকানের সেবা ফি (৳ - মূল লাভ)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="form-control text-success fw-bold"
                          value={form.service_charge}
                          onChange={(e) => setForm({ ...form, service_charge: e.target.value })}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label small text-muted fw-bold">কাগজ/অন্যান্য চার্জ (৳)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="form-control"
                          value={form.other_charge}
                          onChange={(e) => setForm({ ...form, other_charge: e.target.value })}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small text-muted fw-bold">অগ্রিম গ্রহণ (Advance Paid ৳)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="form-control text-primary fw-bold"
                          value={form.advance_paid}
                          onChange={(e) => setForm({ ...form, advance_paid: e.target.value })}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small text-muted fw-bold">পেমেন্ট মেথড</label>
                        <select
                          className="form-select"
                          value={form.payment_method}
                          onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                        >
                          <option value="cash">নগদ (Cash)</option>
                          <option value="bkash">বিকাশ (bKash)</option>
                          <option value="nagad">নগদ ডিজিটাল (Nagad)</option>
                          <option value="bank">ব্যাংক ট্রান্সফার</option>
                        </select>
                      </div>
                    </div>

                    <hr />
                    <div className="d-flex justify-content-between align-items-center mt-2">
                      <div>
                        <span className="text-muted">সর্বমোট বিল:</span>{" "}
                        <span className="fs-5 fw-bold text-dark">৳{liveTotalBill}</span>
                      </div>
                      <div>
                        <span className="text-muted">ডেলিভারি বকেয়া:</span>{" "}
                        <span className="fs-5 fw-bold text-danger">৳{liveDue}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>বাতিল</button>
                  <button type="submit" disabled={saving} className="btn btn-primary px-4 fw-bold">
                    {saving ? "সংরক্ষণ হচ্ছে..." : "টোকেন তৈরি ও নিশ্চিত করুন"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Settle Due Modal */}
      {activeJobForPayment && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title fw-bold">💵 বকেয়া বিল পরিশোধ ও ডেলিভারি</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveJobForPayment(null)}></button>
              </div>
              <form onSubmit={handleAddPayment}>
                <div className="modal-body p-4">
                  <p className="mb-3">
                    টোকেন <strong>{activeJobForPayment.job_number}</strong> - কাস্টমার <strong>{activeJobForPayment.customer_name}</strong> এর বকেয়া বিল জমা করুন।
                  </p>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">জমার পরিমাণ (৳)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      className="form-control fs-5 text-success fw-bold"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">পেমেন্ট মেথড</label>
                    <select
                      className="form-select"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="cash">নগদ (Cash)</option>
                      <option value="bkash">বিকাশ (bKash)</option>
                      <option value="nagad">নগদ ডিজিটাল (Nagad)</option>
                    </select>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveJobForPayment(null)}>বাতিল</button>
                  <button type="submit" className="btn btn-success px-4 fw-bold">পেমেন্ট গ্রহণ করুন</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
