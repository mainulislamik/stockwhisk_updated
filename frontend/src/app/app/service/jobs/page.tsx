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
  finishing_charge: string;
  other_charge: string;
  discount: string;
  total_bill: string;
  advance_paid: string;
  due_amount: string;
  material_cost: string;
  artwork_url?: string;
  design_approved?: boolean;
  design_approved_at?: string | null;
  meter_start?: number | null;
  meter_end?: number | null;
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

  // Modern finishing options
  const [hasEyelets, setHasEyelets] = useState(false);
  const [eyeletCount, setEyeletCount] = useState("4");
  const [hasPipe, setHasPipe] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);

  // Photocopy meter state
  const [docCopies, setDocCopies] = useState("10");
  const [docRate, setDocRate] = useState("2.50");
  const [meterStart, setMeterStart] = useState("");
  const [meterEnd, setMeterEnd] = useState("");

  // Offset Press Estimator
  const [offsetPlates, setOffsetPlates] = useState("1");
  const [offsetSheets, setOffsetSheets] = useState("1000");
  const [offsetPlateRate, setOffsetPlateRate] = useState("350");
  const [offsetPrintRate, setOffsetPrintRate] = useState("600");

  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    service_type: "Online Service",
    reference_no: "",
    specifications: {} as any,
    delivery_date: "",
    govt_fee: "0",
    service_charge: "0",
    finishing_charge: "0",
    other_charge: "0",
    discount: "0",
    advance_paid: "0",
    payment_method: "cash",
    artwork_url: "",
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
        finishing_charge: "0",
        other_charge: "0",
        delivery_date: dateStr,
        specifications: { category: "passport", pages: 48, validity: 5 },
      }));
    } else if (presetKey === "passport_10y") {
      setForm((prev) => ({
        ...prev,
        service_type: "ই-পাসপোর্ট আবেদন (১০ বছর / ৪৮ পাতা)",
        govt_fee: "5750",
        service_charge: "500",
        finishing_charge: "0",
        other_charge: "0",
        delivery_date: dateStr,
        specifications: { category: "passport", pages: 48, validity: 10 },
      }));
    } else if (presetKey === "police_clearance") {
      setForm((prev) => ({
        ...prev,
        service_type: "পুলিশ ক্লিয়ারেন্স সার্টিফিকেট",
        govt_fee: "500",
        service_charge: "250",
        finishing_charge: "0",
        other_charge: "0",
        delivery_date: dateStr,
        specifications: { category: "police_clearance" },
      }));
    } else if (presetKey === "nid_smartcard") {
      setForm((prev) => ({
        ...prev,
        service_type: "ভোটার এনআইডি সংশোধন / রি-ইস্যু",
        govt_fee: "230",
        service_charge: "200",
        finishing_charge: "0",
        other_charge: "0",
        delivery_date: dateStr,
        specifications: { category: "nid" },
      }));
    } else if (presetKey === "banner_print") {
      setBannerWidth("8");
      setBannerHeight("3");
      setBannerRate("25");
      setHasEyelets(true);
      setEyeletCount("4");
      const sqft = 8 * 3;
      const baseCost = sqft * 25;
      const finCost = 4 * 10; // 40 Tk eyelets
      setForm((prev) => ({
        ...prev,
        service_type: "পিভিসি ব্যানার ও সাইনবোর্ড প্রিন্ট",
        govt_fee: "0",
        service_charge: baseCost.toFixed(2),
        finishing_charge: finCost.toFixed(2),
        delivery_date: dateStr,
        specifications: {
          category: "banner",
          width_ft: 8,
          height_ft: 3,
          total_sqft: sqft,
          sqft_rate: 25,
          finishing: { eyelets: { enabled: true, count: 4 } },
        },
      }));
    } else if (presetKey === "photocopy_print") {
      setDocCopies("20");
      setDocRate("2.50");
      const baseCost = 20 * 2.5;
      setForm((prev) => ({
        ...prev,
        service_type: "ফটোকপি ও কালার প্রিন্ট",
        govt_fee: "0",
        service_charge: baseCost.toFixed(2),
        finishing_charge: "0",
        delivery_date: dateStr,
        specifications: { category: "photocopy", total_copies: 20, rate_per_page: 2.5, sheets_deducted: 20 },
      }));
    } else if (presetKey === "offset_press") {
      setOffsetPlates("2");
      setOffsetSheets("1000");
      setOffsetPlateRate("350");
      setOffsetPrintRate("600");
      const plateCost = 2 * 350;
      const totalOffset = plateCost + 600;
      setForm((prev) => ({
        ...prev,
        service_type: "অফসেট প্রেস প্রিন্ট (ক্যাশ মেমো / ভাউচার)",
        govt_fee: "0",
        service_charge: totalOffset.toFixed(2),
        finishing_charge: "150", // binding charge
        delivery_date: dateStr,
        specifications: { category: "offset", plates_count: 2, paper_sheets: 1000 },
      }));
    }
  };

  // Re-calculate banner sqft & finishing
  const handleBannerCalc = (w: string, h: string, r: string, eyelets: boolean, eCount: string, pipe: boolean, frame: boolean) => {
    const width = parseFloat(w) || 0;
    const height = parseFloat(h) || 0;
    const rate = parseFloat(r) || 0;
    const sqft = width * height;
    const baseCost = sqft * rate;

    let finishingTotal = 0;
    if (eyelets) {
      finishingTotal += (parseInt(eCount) || 4) * 10;
    }
    if (pipe) {
      finishingTotal += width * 15; // 15 Tk per running ft
    }
    if (frame) {
      finishingTotal += sqft * 35; // 35 Tk per sqft framing
    }

    setForm((prev) => ({
      ...prev,
      service_charge: baseCost.toFixed(2),
      finishing_charge: finishingTotal.toFixed(2),
      specifications: {
        category: "banner",
        width_ft: width,
        height_ft: height,
        total_sqft: sqft,
        sqft_rate: rate,
        finishing: {
          eyelets: { enabled: eyelets, count: parseInt(eCount) || 4 },
          pipe: { enabled: pipe },
          frame: { enabled: frame },
        },
      },
    }));
  };

  // Re-calculate photocopy
  const handleDocCalc = (c: string, r: string, mS: string, mE: string) => {
    let copies = parseInt(c) || 0;
    const rate = parseFloat(r) || 0;
    const start = parseInt(mS);
    const end = parseInt(mE);
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      copies = end - start;
      setDocCopies(copies.toString());
    }
    const totalCost = copies * rate;
    setForm((prev) => ({
      ...prev,
      service_charge: totalCost.toFixed(2),
      specifications: {
        category: "photocopy",
        total_copies: copies,
        rate_per_page: rate,
        sheets_deducted: copies,
        meter_start: !isNaN(start) ? start : null,
        meter_end: !isNaN(end) ? end : null,
      },
    }));
  };

  // Re-calculate Offset
  const handleOffsetCalc = (plates: string, sheets: string, pRate: string, prRate: string) => {
    const pCount = parseInt(plates) || 1;
    const pCost = pCount * (parseFloat(pRate) || 0);
    const printCost = parseFloat(prRate) || 0;
    const totalCost = pCost + printCost;
    setForm((prev) => ({
      ...prev,
      service_charge: totalCost.toFixed(2),
      specifications: {
        category: "offset",
        plates_count: pCount,
        paper_sheets: parseInt(sheets) || 500,
        plate_rate: parseFloat(pRate) || 0,
        print_rate: printCost,
      },
    }));
  };

  // Live bill computation
  const liveTotalBill = useMemo(() => {
    const g = parseFloat(form.govt_fee) || 0;
    const s = parseFloat(form.service_charge) || 0;
    const f = parseFloat(form.finishing_charge) || 0;
    const o = parseFloat(form.other_charge) || 0;
    const d = parseFloat(form.discount) || 0;
    return Math.max(0, g + s + f + o - d).toFixed(2);
  }, [form.govt_fee, form.service_charge, form.finishing_charge, form.other_charge, form.discount]);

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
        specifications: {},
        delivery_date: "",
        govt_fee: "0",
        service_charge: "0",
        finishing_charge: "0",
        other_charge: "0",
        discount: "0",
        advance_paid: "0",
        payment_method: "cash",
        artwork_url: "",
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
          <h2 className="h4 mb-1 fw-bold text-dark">🖨️ প্রিন্টিং, মিডিয়া ও ডিজিটাল সেবা হাব (Cyber, Media & Press)</h2>
          <p className="text-muted mb-0 small">
            ব্যানার ফিনিশিং মেকিং, অফসেট এস্টিমেটর, আর্টওয়ার্ক প্রুফ অ্যাপ্রুভাল, কাউন্টার মিটার এবং স্প্লিট অ্যাকাউন্টিং।
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
                  <th>আর্টওয়ার্ক ও প্রুফ</th>
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
                    <td colSpan={9} className="text-center py-5 text-muted">
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
                        {j.artwork_url ? (
                          <div className="d-flex align-items-center gap-1">
                            <a
                              href={j.artwork_url}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-outline-primary btn-sm py-0 px-2"
                              style={{ fontSize: "0.75rem" }}
                            >
                              <i className="bi bi-file-earmark-image me-1"></i> ফাইল
                            </a>
                            {j.design_approved ? (
                              <span className="badge bg-success-subtle text-success border border-success" title="কাস্টমার কর্তৃক অনুমোদিত">
                                ✓ Approved
                              </span>
                            ) : (
                              <span className="badge bg-warning-subtle text-warning border border-warning" title="অনুমোদন অপেক্ষমান">
                                প্রুফ বাকি
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted small">—</span>
                        )}
                      </td>
                      <td>
                        <div>মোট বিল: <span className="fw-bold">৳{money(j.total_bill)}</span></div>
                        <div className="text-muted small">
                          সরকারি: ৳{money(j.govt_fee)} | লাভ: ৳{money(parseFloat(j.service_charge) + parseFloat(j.finishing_charge || "0"))}
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
                  <i className="bi bi-file-earmark-plus me-2"></i> আধুনিক জব শিট, প্রেস এস্টিমেটর ও টোকেন অর্ডার
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowAdd(false)}></button>
              </div>
              <form onSubmit={handleCreateJob}>
                <div className="modal-body p-4">
                  {/* Quick Presets */}
                  <label className="form-label fw-bold text-dark mb-2">⚡ ১-ক্লিক দ্রুত সেবা ও এস্টিমেশন নির্বাচন:</label>
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
                      📐 ব্যানার + ফিনিশিং মেকিং
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePresetSelect("offset_press")}
                      className={`btn btn-sm ${calcPreset === "offset_press" ? "btn-primary" : "btn-outline-primary"}`}
                    >
                      📑 অফসেট প্রেস এস্টিমেটর
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePresetSelect("photocopy_print")}
                      className={`btn btn-sm ${calcPreset === "photocopy_print" ? "btn-primary" : "btn-outline-primary"}`}
                    >
                      📄 ফটোকপি ও মিটার কাউন্টার
                    </button>
                  </div>

                  {/* Banner Dynamic Calculator View with Finishing */}
                  {calcPreset === "banner_print" && (
                    <div className="p-3 mb-4 rounded bg-light border border-info">
                      <h6 className="fw-bold text-info mb-2">📐 ব্যানার ডাইমেনশন ও ফিনিশিং মেকিং ক্যালকুলেটর:</h6>
                      <div className="row g-2 mb-3">
                        <div className="col-4">
                          <label className="form-label small text-muted">দৈর্ঘ্য (ফুট):</label>
                          <input
                            type="number"
                            step="0.1"
                            className="form-control"
                            value={bannerWidth}
                            onChange={(e) => {
                              setBannerWidth(e.target.value);
                              handleBannerCalc(e.target.value, bannerHeight, bannerRate, hasEyelets, eyeletCount, hasPipe, hasFrame);
                            }}
                          />
                        </div>
                        <div className="col-4">
                          <label className="form-label small text-muted">প্রস্থ (ফুট):</label>
                          <input
                            type="number"
                            step="0.1"
                            className="form-control"
                            value={bannerHeight}
                            onChange={(e) => {
                              setBannerHeight(e.target.value);
                              handleBannerCalc(bannerWidth, e.target.value, bannerRate, hasEyelets, eyeletCount, hasPipe, hasFrame);
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
                              handleBannerCalc(bannerWidth, bannerHeight, e.target.value, hasEyelets, eyeletCount, hasPipe, hasFrame);
                            }}
                          />
                        </div>
                      </div>

                      {/* Finishing Checkboxes */}
                      <label className="form-label small fw-bold text-dark">🛠️ পোস্ট-প্রিন্টিং ফিনিশিং ও মেকিং অপশন:</label>
                      <div className="row g-2 align-items-center">
                        <div className="col-md-4">
                          <div className="form-check">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              id="eyeletCheck"
                              checked={hasEyelets}
                              onChange={(e) => {
                                setHasEyelets(e.target.checked);
                                handleBannerCalc(bannerWidth, bannerHeight, bannerRate, e.target.checked, eyeletCount, hasPipe, hasFrame);
                              }}
                            />
                            <label className="form-check-label small" htmlFor="eyeletCheck">
                              আইলেট / রিং পাঞ্চ (+৳১০/টি)
                            </label>
                          </div>
                        </div>
                        {hasEyelets && (
                          <div className="col-md-2">
                            <input
                              type="number"
                              className="form-control form-control-sm"
                              placeholder="রিং সংখ্যা"
                              value={eyeletCount}
                              onChange={(e) => {
                                setEyeletCount(e.target.value);
                                handleBannerCalc(bannerWidth, bannerHeight, bannerRate, hasEyelets, e.target.value, hasPipe, hasFrame);
                              }}
                            />
                          </div>
                        )}
                        <div className="col-md-3">
                          <div className="form-check">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              id="pipeCheck"
                              checked={hasPipe}
                              onChange={(e) => {
                                setHasPipe(e.target.checked);
                                handleBannerCalc(bannerWidth, bannerHeight, bannerRate, hasEyelets, eyeletCount, e.target.checked, hasFrame);
                              }}
                            />
                            <label className="form-check-label small" htmlFor="pipeCheck">
                              পাইপ ও রশি (+৳১৫/ফুট)
                            </label>
                          </div>
                        </div>
                        <div className="col-md-3">
                          <div className="form-check">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              id="frameCheck"
                              checked={hasFrame}
                              onChange={(e) => {
                                setHasFrame(e.target.checked);
                                handleBannerCalc(bannerWidth, bannerHeight, bannerRate, hasEyelets, eyeletCount, hasPipe, e.target.checked);
                              }}
                            />
                            <label className="form-check-label small" htmlFor="frameCheck">
                              কাঠের ফ্রেম ফিটিং
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Offset Press Estimator View */}
                  {calcPreset === "offset_press" && (
                    <div className="p-3 mb-4 rounded bg-light border border-warning">
                      <h6 className="fw-bold text-dark mb-2">📑 অফসেট প্রেস দ্রুত খরচ এস্টিমেটর (Plates + Impression):</h6>
                      <div className="row g-2">
                        <div className="col-3">
                          <label className="form-label small text-muted">CTP প্লেট সংখ্যা:</label>
                          <input
                            type="number"
                            className="form-control"
                            value={offsetPlates}
                            onChange={(e) => {
                              setOffsetPlates(e.target.value);
                              handleOffsetCalc(e.target.value, offsetSheets, offsetPlateRate, offsetPrintRate);
                            }}
                          />
                        </div>
                        <div className="col-3">
                          <label className="form-label small text-muted">প্লেট প্রতি খরচ (৳):</label>
                          <input
                            type="number"
                            className="form-control"
                            value={offsetPlateRate}
                            onChange={(e) => {
                              setOffsetPlateRate(e.target.value);
                              handleOffsetCalc(offsetPlates, offsetSheets, e.target.value, offsetPrintRate);
                            }}
                          />
                        </div>
                        <div className="col-3">
                          <label className="form-label small text-muted">ছাপা/ইমপ্রেশন চার্জ (৳):</label>
                          <input
                            type="number"
                            className="form-control"
                            value={offsetPrintRate}
                            onChange={(e) => {
                              setOffsetPrintRate(e.target.value);
                              handleOffsetCalc(offsetPlates, offsetSheets, offsetPlateRate, e.target.value);
                            }}
                          />
                        </div>
                        <div className="col-3">
                          <label className="form-label small text-muted">কাগজ শিট সংখ্যা:</label>
                          <input
                            type="number"
                            className="form-control"
                            value={offsetSheets}
                            onChange={(e) => {
                              setOffsetSheets(e.target.value);
                              handleOffsetCalc(offsetPlates, e.target.value, offsetPlateRate, offsetPrintRate);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Photocopy Meter Reading View */}
                  {calcPreset === "photocopy_print" && (
                    <div className="p-3 mb-4 rounded bg-light border border-secondary">
                      <h6 className="fw-bold text-dark mb-2">📄 ফটোকপি কাউন্টার ও মেশিন মিটার রিডিং:</h6>
                      <div className="row g-2">
                        <div className="col-3">
                          <label className="form-label small text-muted">শুরু মিটার (Start):</label>
                          <input
                            type="number"
                            className="form-control"
                            placeholder="e.g. 15200"
                            value={meterStart}
                            onChange={(e) => {
                              setMeterStart(e.target.value);
                              handleDocCalc(docCopies, docRate, e.target.value, meterEnd);
                            }}
                          />
                        </div>
                        <div className="col-3">
                          <label className="form-label small text-muted">শেষ মিটার (End):</label>
                          <input
                            type="number"
                            className="form-control"
                            placeholder="e.g. 15250"
                            value={meterEnd}
                            onChange={(e) => {
                              setMeterEnd(e.target.value);
                              handleDocCalc(docCopies, docRate, meterStart, e.target.value);
                            }}
                          />
                        </div>
                        <div className="col-3">
                          <label className="form-label small text-muted">মোট কপি (Sheets):</label>
                          <input
                            type="number"
                            className="form-control"
                            value={docCopies}
                            onChange={(e) => {
                              setDocCopies(e.target.value);
                              handleDocCalc(e.target.value, docRate, meterStart, meterEnd);
                            }}
                          />
                        </div>
                        <div className="col-3">
                          <label className="form-label small text-muted">প্রতি কপি রেট (৳):</label>
                          <input
                            type="number"
                            step="0.5"
                            className="form-control"
                            value={docRate}
                            onChange={(e) => {
                              setDocRate(e.target.value);
                              handleDocCalc(docCopies, e.target.value, meterStart, meterEnd);
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

                  {/* Artwork URL / Design Proof Link */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      🎨 আর্টওয়ার্ক / ডিজাইন প্রুফ ড্রাইভ লিংক (Customer Proof URL)
                    </label>
                    <input
                      type="url"
                      className="form-control"
                      placeholder="https://drive.google.com/... অথবা ছবির সরাসরি লিংক"
                      value={form.artwork_url}
                      onChange={(e) => setForm({ ...form, artwork_url: e.target.value })}
                    />
                    <div className="text-muted small mt-1">
                      * লিংক দিলে কাস্টমার ট্র্যাকিং পেজে ডিজাইন দেখে প্রিন্ট অনুমোদন (Approval) দিতে পারবে।
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
                        <label className="form-label small text-muted fw-bold">ফিনিশিং ও মেকিং চার্জ (৳)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="form-control text-dark fw-bold"
                          value={form.finishing_charge}
                          onChange={(e) => setForm({ ...form, finishing_charge: e.target.value })}
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
