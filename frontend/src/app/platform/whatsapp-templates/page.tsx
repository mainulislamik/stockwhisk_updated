"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { confirmAction } from "@/lib/dialogs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader, Spinner } from "@/components/ui";
import toast from "react-hot-toast";

type Templates = {
  daily_report_header: string;
  daily_report_footer: string;
  onboarding_day1: string;
  onboarding_day3: string;
  onboarding_day7_free_upload: string;
  hotline: string;
};

export default function WhatsAppTemplatesPage() {
  const { lang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [activeTab, setActiveTab] = useState<"daily" | "day1" | "day3" | "day7">("day7");
  const [testPhone, setTestPhone] = useState("01613511887");
  const [sendingTest, setSendingTest] = useState(false);

  const [templates, setTemplates] = useState<Templates>({
    daily_report_header: "",
    daily_report_footer: "",
    onboarding_day1: "",
    onboarding_day3: "",
    onboarding_day7_free_upload: "",
    hotline: "০১৬১৩-৫১১৮৮৭",
  });

  const [defaults, setDefaults] = useState<Templates | null>(null);
  const [schedule, setSchedule] = useState({
    dispatch_time: "22:00",
    min_gap: 12,
    max_gap: 18,
  });
  const [waStatus, setWaStatus] = useState<{ connected: boolean; status?: string; qr?: string; phone?: string } | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [pairingMethod, setPairingMethod] = useState<"qr" | "code">("qr");
  const [pairingPhone, setPairingPhone] = useState("01613511887");
  const [pairingCode, setPairingCode] = useState("");
  const [loadingCode, setLoadingCode] = useState(false);
  const [codeCountdown, setCodeCountdown] = useState(0);

  useEffect(() => {
    if (codeCountdown <= 0) return;
    const timer = setInterval(() => {
      setCodeCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [codeCountdown]);

  const requestPairingCode = async () => {
    const clean = pairingPhone.replace(/[^0-9]/g, "");
    if (!clean) {
      toast.error(lang === "bn" ? "হোয়াটসঅ্যাপ নম্বর দিন" : "Enter WhatsApp phone");
      return;
    }
    setLoadingCode(true);
    try {
      const res = await api<any>("/notifications/whatsapp/pairing-code/", {
        method: "POST",
        body: { phone: clean },
      });
      if (res?.success && res?.pairing_code) {
        setPairingCode(res.pairing_code);
        setCodeCountdown(120);
        toast.success(lang === "bn" ? "৮-ডিজিটের ওটিপি কোড তৈরি হয়েছে!" : "Pairing code generated!");
      } else {
        toast.error(res?.error || "Failed to generate pairing code");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate pairing code");
    } finally {
      setLoadingCode(false);
    }
  };

  const disconnectWhatsApp = async () => {
    if (!confirm(lang === "bn" ? "আপনি কি নিশ্চিতভাবে এই হোয়াটসঅ্যাপ সংযোগটি বিচ্ছিন্ন করতে চান?" : "Disconnect this WhatsApp session?")) return;
    try {
      await api("/notifications/whatsapp/disconnect/", { method: "POST" });
      toast.success(lang === "bn" ? "সংযোগ বিচ্ছিন্ন করা হয়েছে" : "WhatsApp disconnected");
      fetchWaQr();
    } catch (e: any) {
      toast.error(e?.message || "Failed to disconnect");
    }
  };

  const fetchWaQr = useCallback(async () => {
    setLoadingQr(true);
    try {
      const res = await api<any>("/notifications/whatsapp/qr/");
      setWaStatus({
        connected: Boolean(res?.connected),
        status: res?.status,
        qr: res?.qr,
        phone: res?.phone,
      });
      if (!res?.connected && !res?.qr) {
        setTimeout(fetchWaQr, 2000);
      }
    } catch {
      // ignore
    } finally {
      setLoadingQr(false);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await api<{ templates: Templates; defaults: Templates; schedule?: any }>("/platform/whatsapp-templates/");
      setTemplates(res.templates);
      setDefaults(res.defaults);
      if (res.schedule) {
        setSchedule(res.schedule);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to load WhatsApp templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
    fetchWaQr();
    const timer = setInterval(() => {
      fetchWaQr();
    }, 6000);
    return () => clearInterval(timer);
  }, [loadTemplates, fetchWaQr]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api<{ success: boolean; templates: Templates; schedule?: any }>("/platform/whatsapp-templates/", {
        method: "PUT",
        body: { templates, schedule },
      });
      if (res?.templates) {
        setTemplates(res.templates);
      }
      if (res?.schedule) {
        setSchedule(res.schedule);
      }
      toast.success(lang === "bn" ? "হোয়াটসঅ্যাপ মেসেজ টেমপ্লেট ও শিডিউল সেটিংস সংরক্ষিত হয়েছে!" : "WhatsApp templates and schedule saved!");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save templates");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!await confirmAction(lang === "bn" ? "আপনি কি নিশ্চিত যে সকল টেমপ্লেট সিস্টেমের আসল ডিফল্ট লেখায় ফিরিয়ে নিতে চান?" : "Reset all templates to system defaults?")) {
      return;
    }
    setResetting(true);
    try {
      const res = await api<{ success: boolean; templates: Templates }>("/platform/whatsapp-templates/", {
        method: "DELETE",
      });
      if (res?.templates) {
        setTemplates(res.templates);
      }
      toast.success(lang === "bn" ? "টেমপ্লেটগুলো ডিফল্ট অবস্থায় ফিরিয়ে আনা হয়েছে" : "Reset to system defaults");
    } catch (e: any) {
      toast.error(e?.message || "Failed to reset templates");
    } finally {
      setResetting(false);
    }
  }

  async function handleSendTest() {
    if (!testPhone.trim()) {
      toast.error(lang === "bn" ? "প্রথমে একটি মোবাইল নম্বর দিন" : "Enter a phone number");
      return;
    }
    setSendingTest(true);
    try {
      const res = await api<any>("/notifications/alert-config/send-test-whatsapp-report/", {
        method: "POST",
        body: { phone: testPhone.trim() },
      });
      if (res?.success) {
        toast.success(lang === "bn" ? `হোয়াটসঅ্যাপে টেস্ট মেসেজ পাঠানো হয়েছে (${testPhone})!` : `Test message sent to ${testPhone}!`);
      } else {
        toast.error(res?.gateway_result?.error || res?.error || "Gateway response: please make sure WhatsApp is connected");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to trigger test message");
    } finally {
      setSendingTest(false);
    }
  }

  // Live Preview Formatter for WhatsApp Bubble Mockup
  const previewText = useMemo(() => {
    const h = templates.hotline || "০১৬১৩-৫১১৮৮৭";
    if (activeTab === "daily") {
      const header = (templates.daily_report_header || "🏪 *দোকানের নাম* — দৈনিক ব্যবসায়িক রিপোর্ট\n📅 তারিখ: 10 Oct 2026 | রাত ১০:০০")
        .replace("{shop_name}", "Fast Electronics & Smart Gadgets")
        .replace("{date}", "10 Oct 2026");
      const footer = templates.daily_report_footer || "— *StockWhisk Business Intelligence*\n🌐 বিস্তারিত দেখতে: https://stockwhisk.com/app";
      return `${header}\n━━━━━━━━━━━━━━━━━━━━\n💰 *আজকের বিক্রয় ও নগদ আদায় (Sales & Cash)*\n• মোট বিক্রয়: *৳ ২৫,৪০০.০০* (১৪টি মেমো)\n• নগদ ক্যাশ আদায়: ৳ ১৮,২০০.০০\n• ডিজিটাল পেমেন্ট: ৳ ৪,২০০.০০\n• নতুন বাকি: ৳ ৩,০০০.০০\n━━━━━━━━━━━━━━━━━━━━\n📦 *আজকের পণ্য ক্রয় (Purchases)*\n• মোট ক্রয়: ৳ ১২,০০০.০০\n• সরবরাহকারীকে পরিশোধ: ৳ ৮,০০০.০০\n━━━━━━━━━━━━━━━━━━━━\n📉 *খরচ ও নগদ ক্যাশ স্থিতি (Cashflow)*\n• দোকানের বিবিধ খরচ: ৳ ১,২০০.০০\n• আনুমানিক মোট লাভ: *৳ ৫,৮০০.০০*\n━━━━━━━━━━━━━━━━━━━━\n🤝 *⚠️ আগামীকাল বাকি আদায়ের তাগাদা:*\n 1. তানভীর আহমেদ (০১৭XXXXXXXX) — *৳ ১,৫০০*\n 2. রহিম ট্রেডার্স — *৳ ৩,২০০*\n━━━━━━━━━━━━━━━━━━━━\n${footer}`;
    } else if (activeTab === "day1") {
      return (templates.onboarding_day1 || "")
        .replace("{name}", "ইমন স্যার")
        .replace("{hotline}", h);
    } else if (activeTab === "day3") {
      return (templates.onboarding_day3 || "")
        .replace("{name}", "ইমন স্যার")
        .replace("{hotline}", h);
    } else {
      return (templates.onboarding_day7_free_upload || "")
        .replace("{name}", "ইমন স্যার")
        .replace("{hotline}", h);
    }
  }, [activeTab, templates]);

  if (loading) return <Spinner label="Loading WhatsApp automation templates…" />;

  return (
    <div className="vstack gap-4 pb-5" style={{ maxWidth: "68rem" }}>
      {/* Top Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div>
          <div className="badge bg-success bg-opacity-10 text-success border border-success-subtle px-2.5 py-1 mb-2 fw-semibold">
            <i className="bi bi-whatsapp me-1"></i> WhatsApp Automation Engine
          </div>
          <h1 className="h3 fw-bold text-dark mb-1">
            {lang === "bn" ? "হোয়াটসঅ্যাপ অটোমেশন ও মেসেজ টেমপ্লেট" : "WhatsApp Automation & Message Templates"}
          </h1>
          <p className="text-secondary small mb-0">
            {lang === "bn"
              ? "প্রতিদিন রাত ১০:০০ টার ব্যবসায়িক রিপোর্ট এবং অনবোর্ডিং ফলো-আপ (সপ্তাহের শেষে ফ্রি প্রোডাক্ট আপলোড অফার) এর মেসেজ যেকোনো সময় কাস্টমাইজ করুন।"
              : "Customize daily 10 PM owner executive digests and automated onboarding follow-up message sequences."}
          </p>
        </div>

        {/* Top Actions */}
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting || saving}
            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
          >
            <i className="bi bi-arrow-counterclockwise"></i>
            <span>{lang === "bn" ? "ডিফল্টে রিসেট" : "Reset Defaults"}</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary btn-sm px-3 d-flex align-items-center gap-1.5 shadow-sm fw-semibold"
          >
            {saving ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-check2-circle"></i>}
            <span>{lang === "bn" ? "টেমপ্লেট সেভ করুন" : "Save Templates"}</span>
          </button>
        </div>
      </div>

      {/* Hotline & Dispatch Schedule Config Ribbon */}
      <div className="card shadow-xs border bg-white p-3 rounded-3">
        <div className="row g-3 align-items-center">
          <div className="col-md-6">
            <div className="fw-semibold text-dark small mb-0.5">
              <i className="bi bi-telephone-fill text-primary me-1.5"></i>
              {lang === "bn" ? "অফিশিয়াল সাপোর্ট ও হটলাইন নম্বর" : "Official Support & Hotline Number"}
            </div>
            <div className="text-secondary mb-1.5" style={{ fontSize: "0.78rem" }}>
              {lang === "bn"
                ? "মেসেজের ভেতর {hotline} ট্যাগ যেখানে ব্যবহার করবেন, স্বয়ংক্রিয়ভাবে এই নম্বরটি বসে যাবে।"
                : "Dynamic placeholder {hotline} inside messages will automatically resolve to this value."}
            </div>
            <input
              type="text"
              className="form-control form-control-sm font-monospace fw-semibold"
              placeholder="যেমন: ০১৬১৩-৫১১৮৮৭"
              value={templates.hotline}
              onChange={(e) => setTemplates({ ...templates, hotline: e.target.value })}
            />
          </div>

          <div className="col-md-6 border-start-md ps-md-4">
            <div className="fw-semibold text-dark small mb-0.5">
              <i className="bi bi-clock-history text-info me-1.5"></i>
              {lang === "bn" ? "দৈনিক রিপোর্ট পাঠানোর নির্ধারিত সময় ও অ্যান্টি-স্প্যাম গ্যাপ" : "Daily Dispatch Time & Anti-Spam Delays"}
            </div>
            <div className="text-secondary mb-1.5" style={{ fontSize: "0.78rem" }}>
              {lang === "bn"
                ? "প্রতিদিন এই সময়ে সক্রিয় শপগুলোতে ১০-১৫ সেকেন্ডের হিউম্যান বিরতিতে মেসেজ পাঠানো হবে।"
                : "Reports dispatch at this time with randomized 12-18s gaps between shops."}
            </div>
            <div className="d-flex align-items-center gap-2">
              <select
                className="form-select form-select-sm fw-semibold"
                style={{ width: "130px" }}
                value={schedule.dispatch_time || "22:00"}
                onChange={(e) => setSchedule({ ...schedule, dispatch_time: e.target.value })}
              >
                <option value="21:00">রাত ৯:০০ টা</option>
                <option value="21:30">রাত ৯:৩০ টা</option>
                <option value="22:00">রাত ১০:০০ টা (Standard)</option>
                <option value="22:15">রাত ১০:১৫ টা</option>
                <option value="22:30">রাত ১০:৩০ টা</option>
                <option value="23:00">রাত ১১:০০ টা</option>
              </select>
              <span className="badge bg-light text-secondary border py-1.5 px-2 small">
                🛡️ বিরতি: {schedule.min_gap || 12}s – {schedule.max_gap || 18}s
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Official WhatsApp Gateway Live Status & QR Scanner Card */}
      <div className={`card border shadow-sm ${waStatus?.connected ? 'border-success bg-success bg-opacity-10' : 'border-warning bg-warning bg-opacity-10'}`}>
        <div className="card-body p-3">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div className="d-flex align-items-center gap-3">
              <div className="fs-1 text-success d-flex align-items-center justify-content-center" style={{ width: 48, height: 48 }}>
                <i className={`bi ${waStatus?.connected ? 'bi-whatsapp' : 'bi-qr-code-scan text-warning'}`}></i>
              </div>
              <div>
                <div className="d-flex align-items-center gap-2">
                  <h6 className="fw-bold mb-0 text-dark">
                    {waStatus?.connected
                      ? (lang === "bn" ? "✅ অফিসিয়াল হোয়াটসঅ্যাপ সফলভাবে সংযুক্ত" : "✅ Official WhatsApp Gateway Connected")
                      : (lang === "bn" ? "⚠️ অফিসিয়াল হোয়াটসঅ্যাপ ডিভাইস লিঙ্ক করুন" : "⚠️ Link Official WhatsApp Device")}
                  </h6>
                  <span className={`badge rounded-pill ${waStatus?.connected ? 'bg-success' : 'bg-warning text-dark'}`}>
                    {waStatus?.connected ? "CONNECTED" : (waStatus?.status || "DISCONNECTED")}
                  </span>
                </div>
                <div className="small text-muted mt-0.5">
                  {waStatus?.connected
                    ? (lang === "bn" ? `সংযোগ নম্বর: ${waStatus.phone || "সক্রিয়"} — প্রতিদিন রাত ১০টায় এখান থেকেই শপ ওনারদের মেসেজ যাবে।` : `Active Phone: ${waStatus.phone} — All automated briefs are dispatched from this device.`)
                    : (lang === "bn" ? "প্রতিদিন রাত ১০টার অটোমেটিক রিপোর্ট ও ৭ম দিনের অফার পাঠাতে আপনার হোয়াটসঅ্যাপ দিয়ে একবার লিঙ্ক করুন।" : "Link your WhatsApp once to enable automated 10 PM daily digests and follow-up offers.")}
                </div>
              </div>
            </div>

            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                onClick={fetchWaQr}
                disabled={loadingQr}
                className="btn btn-sm btn-outline-secondary bg-white shadow-xs d-flex align-items-center gap-1.5"
              >
                <i className={`bi bi-arrow-clockwise ${loadingQr ? 'spin' : ''}`}></i>
                <span>{lang === "bn" ? "রিফ্রেশ" : "Refresh"}</span>
              </button>
            </div>
          </div>

          {/* If Disconnected, show Dual Pairing Hub (QR Code vs Manual 8-character OTP) */}
          {!waStatus?.connected && (
            <div className="mt-3 pt-3 border-top border-warning-subtle bg-white p-3 rounded-3 shadow-xs">
              {/* Method Switcher Tabs */}
              <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                <div className="btn-group btn-group-sm" role="group">
                  <button
                    type="button"
                    className={`btn px-3 fw-semibold ${pairingMethod === 'qr' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setPairingMethod('qr')}
                  >
                    <i className="bi bi-qr-code-scan me-1.5"></i>
                    {lang === "bn" ? "১. কিউআর কোড স্ক্যান (QR Code)" : "1. Scan QR Code"}
                  </button>
                  <button
                    type="button"
                    className={`btn px-3 fw-semibold ${pairingMethod === 'code' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setPairingMethod('code')}
                  >
                    <i className="bi bi-key-fill me-1.5"></i>
                    {lang === "bn" ? "২. ম্যানুয়াল ওটিপি কোড (Pairing Code)" : "2. Manual OTP / Pairing Code"}
                  </button>
                </div>
                <div className="badge bg-light text-secondary border font-monospace px-2 py-1">
                  {pairingMethod === 'qr' ? "Camera Scan" : "Code Link"}
                </div>
              </div>

              {pairingMethod === 'qr' ? (
                /* QR Code Mode */
                <div className="d-flex flex-wrap align-items-center gap-4">
                  <div className="text-center p-2 border rounded-3 bg-light shadow-2xs" style={{ width: 170, minHeight: 170 }}>
                    {waStatus?.qr ? (
                      <img src={waStatus.qr} alt="WhatsApp QR Code" className="w-100 h-100 object-contain rounded-2" />
                    ) : (
                      <div className="h-100 d-flex flex-column align-items-center justify-content-center py-4 text-muted small">
                        <span className="spinner-border spinner-border-sm mb-2 text-warning" role="status" />
                        <span>QR লোড হচ্ছে…</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-grow-1" style={{ maxWidth: 540 }}>
                    <div className="fw-bold small text-dark mb-1">
                      {lang === "bn" ? "📱 ফোন দিয়ে ক্যামেরা স্ক্যান করার নিয়ম:" : "📱 How to link with camera:"}
                    </div>
                    <ol className="small text-secondary ps-3 mb-2 vstack gap-1">
                      <li>আপনার ফোনের <strong>WhatsApp</strong> অ্যাপটি খুলুন।</li>
                      <li>উপরে ডান কোণায় <strong>⋮ (তিন ডট)</strong> মেনু চাপুন (iPhone হলে Settings)।</li>
                      <li><strong>Linked Devices</strong> ➜ <strong>Link a Device</strong> বাটনে চাপ দিন।</li>
                      <li>হোয়াটসঅ্যাপের ওপেন হওয়া ক্যামেরা দিয়ে বাঁয়ের এই কিউআর কোডটি সরাসরি স্ক্যান করুন!</li>
                    </ol>
                    <div className="small text-muted" style={{ fontSize: "0.76rem" }}>
                      <i className="bi bi-info-circle me-1 text-primary"></i>
                      {lang === "bn"
                        ? "কোডটি স্বয়ংক্রিয়ভাবে রিফ্রেশ হয়। স্ক্যান সম্পন্ন হওয়া মাত্র কার্ডটি নিজে থেকেই সবুজ হয়ে যাবে।"
                        : "QR code auto-refreshes. As soon as you scan, connection confirms automatically."}
                    </div>
                  </div>
                </div>
              ) : (
                /* Manual OTP / Pairing Code Mode */
                <div className="row g-3 align-items-center">
                  <div className="col-md-6 border-end-md">
                    <div className="fw-bold small text-dark mb-1">
                      <i className="bi bi-phone text-primary me-1"></i>
                      {lang === "bn" ? "অফিসিয়াল হোয়াটসঅ্যাপ নম্বর দিন:" : "Enter Official WhatsApp Number:"}
                    </div>
                    <p className="small text-muted mb-2" style={{ fontSize: "0.8rem" }}>
                      {lang === "bn" ? "যে হোয়াটসঅ্যাপটি আপনি সিস্টেমের সাথে কানেক্ট করতে চান তার নম্বর লিখুন।" : "The mobile number of the WhatsApp account you want to connect."}
                    </p>
                    <div className="input-group input-group-sm mb-2">
                      <span className="input-group-text bg-light text-muted fw-bold">+88</span>
                      <input
                        type="tel"
                        className="form-control fw-semibold"
                        placeholder="01613511887"
                        value={pairingPhone}
                        onChange={(e) => setPairingPhone(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-primary d-flex align-items-center gap-1.5"
                        onClick={requestPairingCode}
                        disabled={loadingCode}
                      >
                        {loadingCode ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-send-fill" />}
                        <span>{lang === "bn" ? "ওটিপি কোড পান" : "Get Code"}</span>
                      </button>
                    </div>

                    {pairingCode && (
                      <div className="mt-3 p-3 bg-light border border-primary border-opacity-25 rounded-3 text-center">
                        <div className="text-secondary small mb-1">{lang === "bn" ? "আপনার ৮-ডিজিটের ওটিপি পেয়ারিং কোড:" : "Your 8-Character Pairing Code:"}</div>
                        <div className="d-flex align-items-center justify-content-center gap-2">
                          <span className="fs-3 fw-bolder font-monospace text-primary tracking-wider bg-white px-3 py-1 border rounded shadow-2xs">
                            {pairingCode.length === 8 ? `${pairingCode.slice(0, 4)} - ${pairingCode.slice(4)}` : pairingCode}
                          </span>
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            title="Copy code"
                            onClick={() => {
                              navigator.clipboard.writeText(pairingCode);
                              toast.success("কোড কপি করা হয়েছে!");
                            }}
                          >
                            <i className="bi bi-clipboard"></i>
                          </button>
                        </div>
                        {codeCountdown > 0 && (
                          <div className="text-muted small mt-2" style={{ fontSize: "0.75rem" }}>
                            <i className="bi bi-clock me-1 text-warning"></i>
                            {lang === "bn" ? `কোডের মেয়াদ বাকি: ${codeCountdown} সেকেন্ড` : `Expires in: ${codeCountdown}s`}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="col-md-6 ps-md-4">
                    <div className="fw-bold small text-dark mb-1">
                      {lang === "bn" ? "🔢 ফোনে কোডটি যেভাবে প্রবেশ করাবেন:" : "🔢 How to enter the code in WhatsApp:"}
                    </div>
                    <ol className="small text-secondary ps-3 mb-2 vstack gap-1">
                      <li>আপনার ফোনের <strong>WhatsApp</strong> অ্যাপটি ওপেন করুন।</li>
                      <li>উপরে <strong>⋮ (তিন ডট)</strong> মেনু ➜ <strong>Linked Devices</strong>-এ যান।</li>
                      <li><strong>Link a Device</strong>-এ চাপ দিন।</li>
                      <li>নিচে থাকা <strong>"Link with phone number instead"</strong> অপশনে চাপ দিন।</li>
                      <li>স্ক্রিনে দেখানো ৮-ডিজিটের কোডটি ফোনে টাইপ করুন!</li>
                    </ol>
                    <div className="small text-success" style={{ fontSize: "0.76rem" }}>
                      <i className="bi bi-shield-check me-1"></i>
                      {lang === "bn" ? "কোড দেওয়া মাত্র ক্যামেরা স্ক্যান ছাড়াই স্বয়ংক্রিয়ভাবে কানেক্ট হয়ে যাবে।" : "Links instantly without requiring camera QR scan."}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* If Connected, show Disconnect Button */}
          {waStatus?.connected && (
            <div className="mt-2 pt-2 border-top border-success-subtle d-flex justify-content-end">
              <button
                type="button"
                onClick={disconnectWhatsApp}
                className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1.5"
              >
                <i className="bi bi-box-arrow-right"></i>
                <span>{lang === "bn" ? "সংযোগ বিচ্ছিন্ন করুন (Logout)" : "Disconnect Session"}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="nav nav-pills gap-2 bg-light p-1.5 rounded-3 border">
        <button
          type="button"
          onClick={() => setActiveTab("day7")}
          className={`nav-link rounded-pill py-1.5 px-3 small fw-bold d-flex align-items-center gap-1.5 ${
            activeTab === "day7" ? "active shadow-xs" : "text-secondary"
          }`}
        >
          <span>🎁</span>
          <span>{lang === "bn" ? "সপ্তাহের শেষ (দিন ৭) — ফ্রি আপলোড অফার" : "End of Week (Day 7) — Free Upload Offer"}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("daily")}
          className={`nav-link rounded-pill py-1.5 px-3 small fw-bold d-flex align-items-center gap-1.5 ${
            activeTab === "daily" ? "active shadow-xs" : "text-secondary"
          }`}
        >
          <span>🌙</span>
          <span>{lang === "bn" ? "প্রতিদিন রাত ১০:০০ টা — ব্যবসায়িক রিপোর্ট" : "Daily 10:00 PM — Executive Report"}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("day1")}
          className={`nav-link rounded-pill py-1.5 px-3 small fw-bold d-flex align-items-center gap-1.5 ${
            activeTab === "day1" ? "active shadow-xs" : "text-secondary"
          }`}
        >
          <span>🌸</span>
          <span>{lang === "bn" ? "দিন ১ — প্রাথমিক চেক-ইন" : "Day 1 — Welcome Check-in"}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("day3")}
          className={`nav-link rounded-pill py-1.5 px-3 small fw-bold d-flex align-items-center gap-1.5 ${
            activeTab === "day3" ? "active shadow-xs" : "text-secondary"
          }`}
        >
          <span>📱</span>
          <span>{lang === "bn" ? "দিন ৩ — মোবাইল সুবিধা ও ভিডিও" : "Day 3 — Mobile Convenience"}</span>
        </button>
      </div>

      {/* Editor & Live Preview Grid */}
      <div className="row g-4">
        {/* Left Column: Template Editor */}
        <div className="col-lg-7">
          <div className="card shadow-sm border h-100">
            <div className="card-header bg-white py-3 d-flex align-items-center justify-content-between">
              <span className="fw-bold text-dark small">
                {activeTab === "day7" && (lang === "bn" ? "🎁 সপ্তাহের শেষ (দিন ৭) ফ্রি প্রোডাক্ট আপলোড অফার এডিটর" : "Day 7 Free Product Upload Offer Template")}
                {activeTab === "daily" && (lang === "bn" ? "🌙 রাত ১০:০০ টার দৈনিক রিপোর্ট হেডার ও ফুটার এডিটর" : "Daily 10 PM Report Header & Footer Template")}
                {activeTab === "day1" && (lang === "bn" ? "🌸 দিন ১ চেক-ইন মেসেজ এডিটর" : "Day 1 Welcome Check-in Template")}
                {activeTab === "day3" && (lang === "bn" ? "📱 দিন ৩ মোবাইল টিউটোরিয়াল মেসেজ এডিটর" : "Day 3 Mobile Tutorial Template")}
              </span>
              <span className="badge bg-light text-secondary border small">
                {lang === "bn" ? "অটোমেটেড বটের বার্তা" : "Automated Bot Dispatch"}
              </span>
            </div>

            <div className="card-body vstack gap-3">
              {/* Dynamic Hints */}
              <div className="bg-light p-2.5 rounded-2 small text-secondary">
                <span className="fw-semibold text-dark">{lang === "bn" ? "উপলব্ধ ডায়নামিক ভেরিয়েবল:" : "Dynamic Variables:"} </span>
                <code className="text-primary me-2">{"{name}"}</code>
                {activeTab === "daily" && (
                  <>
                    <code className="text-primary me-2">{"{shop_name}"}</code>
                    <code className="text-primary me-2">{"{date}"}</code>
                  </>
                )}
                <code className="text-primary me-2">{"{hotline}"}</code>
                <div className="form-text mt-1 text-muted" style={{ fontSize: "0.74rem" }}>
                  {lang === "bn"
                    ? "মেসেজ পাঠানোর সময় এই ট্যাগগুলোর জায়গায় ক্লায়েন্টের আসল নাম, শপের নাম বা তারিখ স্বয়ংক্রিয়ভাবে বসে যাবে।"
                    : "Tags will automatically be replaced with client's actual data at fire time."}
                </div>
              </div>

              {/* Form Input Fields */}
              {activeTab === "day7" && (
                <div>
                  <label className="form-label small fw-semibold text-dark">
                    {lang === "bn" ? "দিন ৭ (সপ্তাহের শেষ) অফার মেসেজের টেক্সট:" : "Day 7 Offer Message Text:"}
                  </label>
                  <textarea
                    rows={12}
                    className="form-control form-control-sm font-monospace"
                    style={{ fontSize: "0.85rem", lineHeight: "1.5" }}
                    value={templates.onboarding_day7_free_upload}
                    onChange={(e) => setTemplates({ ...templates, onboarding_day7_free_upload: e.target.value })}
                  />
                </div>
              )}

              {activeTab === "daily" && (
                <div className="vstack gap-3">
                  <div>
                    <label className="form-label small fw-semibold text-dark">
                      {lang === "bn" ? "রিপোর্টের হেডার (Header):" : "Report Header:"}
                    </label>
                    <textarea
                      rows={3}
                      className="form-control form-control-sm font-monospace"
                      value={templates.daily_report_header}
                      onChange={(e) => setTemplates({ ...templates, daily_report_header: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label small fw-semibold text-dark">
                      {lang === "bn" ? "রিপোর্টের ফুটার ও সাইন-অফ (Footer):" : "Report Footer:"}
                    </label>
                    <textarea
                      rows={3}
                      className="form-control form-control-sm font-monospace"
                      value={templates.daily_report_footer}
                      onChange={(e) => setTemplates({ ...templates, daily_report_footer: e.target.value })}
                    />
                  </div>
                  <div className="alert alert-info border-0 rounded-2 py-2 small mb-0">
                    <i className="bi bi-info-circle me-1"></i>
                    {lang === "bn"
                      ? "মাঝখানের হিসাবগুলো (বিক্রয়, ক্রয়, ক্যাশ, বাকি ও প্রমিজ) স্বয়ংক্রিয়ভাবে ডাটাবেজ থেকে তৈরি হয়।"
                      : "The middle business ledger metrics are dynamically generated from today's real database records."}
                  </div>
                </div>
              )}

              {activeTab === "day1" && (
                <div>
                  <label className="form-label small fw-semibold text-dark">
                    {lang === "bn" ? "দিন ১ চেক-ইন মেসেজ টেক্সট:" : "Day 1 Welcome Check-in Message Text:"}
                  </label>
                  <textarea
                    rows={12}
                    className="form-control form-control-sm font-monospace"
                    style={{ fontSize: "0.85rem", lineHeight: "1.5" }}
                    value={templates.onboarding_day1}
                    onChange={(e) => setTemplates({ ...templates, onboarding_day1: e.target.value })}
                  />
                </div>
              )}

              {activeTab === "day3" && (
                <div>
                  <label className="form-label small fw-semibold text-dark">
                    {lang === "bn" ? "দিন ৩ মোবাইল টিউটোরিয়াল মেসেজ টেক্সট:" : "Day 3 Mobile Tutorial Message Text:"}
                  </label>
                  <textarea
                    rows={12}
                    className="form-control form-control-sm font-monospace"
                    style={{ fontSize: "0.85rem", lineHeight: "1.5" }}
                    value={templates.onboarding_day3}
                    onChange={(e) => setTemplates({ ...templates, onboarding_day3: e.target.value })}
                  />
                </div>
              )}

              {/* Bottom Save Action */}
              <div className="d-flex justify-content-end pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="btn btn-primary btn-sm px-4 fw-semibold shadow-xs"
                >
                  {saving ? "সংরক্ষণ হচ্ছে…" : (lang === "bn" ? "পরিবর্তন সংরক্ষণ করুন" : "Save Changes")}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: WhatsApp Live Preview & Testing Device */}
        <div className="col-lg-5">
          <div className="vstack gap-3">
            {/* Live WhatsApp Mockup Card */}
            <div className="card shadow-sm border overflow-hidden">
              <div className="card-header py-2.5 px-3 d-flex align-items-center justify-content-between" style={{ backgroundColor: "#075e54", color: "#fff" }}>
                <div className="d-flex align-items-center gap-2">
                  <div className="bg-white rounded-circle p-1 d-flex align-items-center justify-content-center" style={{ width: 32, height: 32 }}>
                    <i className="bi bi-whatsapp text-success fs-5"></i>
                  </div>
                  <div>
                    <div className="fw-bold small mb-0 lh-1">StockWhisk Official</div>
                    <div className="text-white-50" style={{ fontSize: "0.68rem" }}>Official Business Account</div>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2 text-white-50 small">
                  <i className="bi bi-telephone"></i>
                  <i className="bi bi-three-dots-vertical"></i>
                </div>
              </div>

              {/* Chat Canvas Background */}
              <div
                className="p-3"
                style={{
                  backgroundColor: "#efeae2",
                  backgroundImage: "radial-gradient(#d1d7db 1px, transparent 1px)",
                  backgroundSize: "16px 16px",
                  minHeight: "360px",
                  maxHeight: "520px",
                  overflowY: "auto",
                }}
              >
                {/* Chat Bubble */}
                <div
                  className="p-3 rounded-3 shadow-xs bg-white text-dark position-relative"
                  style={{
                    maxWidth: "92%",
                    borderRadius: "8px 8px 8px 0px",
                    fontSize: "0.82rem",
                    lineHeight: "1.55",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {previewText}
                  <div className="text-end text-muted mt-1" style={{ fontSize: "0.65rem" }}>
                    10:00 PM <i className="bi bi-check2-all text-primary ms-0.5"></i>
                  </div>
                </div>
              </div>
            </div>

            {/* Instant Test Message Sender Card */}
            <div className="card shadow-xs border bg-white p-3 rounded-3">
              <div className="fw-bold text-dark small mb-1">
                <i className="bi bi-send-fill text-success me-1.5"></i>
                {lang === "bn" ? "হোয়াটসঅ্যাপে টেস্ট মেসেজ পাঠিয়ে দেখুন" : "Send Live Test Preview via WhatsApp"}
              </div>
              <div className="text-secondary mb-2" style={{ fontSize: "0.76rem" }}>
                {lang === "bn"
                  ? "আপনার নিজস্ব হোয়াটসঅ্যাপ নম্বরে এখনই মেসেজের লাইভ প্রিভিউ পাঠিয়ে কোয়ালিটি যাচাই করুন।"
                  : "Dispatch a live test preview to your personal WhatsApp number right now."}
              </div>

              <div className="input-group input-group-sm">
                <span className="input-group-text bg-light font-monospace small">🇧🇩 +88</span>
                <input
                  type="text"
                  className="form-control font-monospace"
                  placeholder="01613511887"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleSendTest}
                  disabled={sendingTest}
                  className="btn btn-success fw-semibold px-3"
                >
                  {sendingTest ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-send me-1"></i>}
                  <span>{lang === "bn" ? "টেস্ট পাঠান" : "Send Test"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
