"use client";

import { useEffect, useState } from "react";
import ResellerShell from "@/components/ResellerShell";
import { api } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";

type Profile = {
  reseller_code: string; referral_code: string; referral_link: string; email: string; full_name: string;
  company_name: string; phone: string; address: string; country: string; commission_rate: string; status: string;
};

export default function ResellerProfilePage() {
  const { t, lang } = useLanguage();
  const [p, setP] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { api<Profile>("/reseller/profile/").then(setP).catch(() => {}); }, []);
  const set = (k: string, v: string) => setP((x) => (x ? { ...x, [k]: v } : x));

  // referral_link is a relative path (/register/?ref=…); show it as a full URL.
  const fullReferralLink = p
    ? (typeof window !== "undefined" ? window.location.origin : "") + (p.referral_link || `/register/?ref=${p.referral_code}`)
    : "";

  async function copyReferral() {
    try {
      await navigator.clipboard.writeText(fullReferralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — ignore */ }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!p) return;
    setSaving(true); setMsg("");
    try {
      const r = await api<Profile>("/reseller/profile/", { method: "PATCH", body: { company_name: p.company_name, phone: p.phone, address: p.address, country: p.country } });
      setP(r); setMsg(lang === 'bn' ? "সংরক্ষিত হয়েছে।" : "Saved.");
    } catch { setMsg(lang === 'bn' ? "সংরক্ষণ করা যায়নি।" : "Failed to save."); } finally { setSaving(false); }
  }

  return (
    <ResellerShell>
      <h3 className="fw-bold mb-4">{lang === 'bn' ? "প্রোফাইল" : "Profile"}</h3>
      {!p ? <div className="spinner-border" /> : (
        <div className="card shadow-sm border-0" style={{ maxWidth: 680 }}>
          <div className="card-body">
            <div className="row g-3 mb-4">
              <div className="col-md-4"><div className="text-secondary small">{t("res_reseller_id") || "Reseller ID"}</div><div className="fw-semibold">{p.reseller_code}</div></div>
              <div className="col-md-4"><div className="text-secondary small">{t("cust_name") || "Full name"}</div><div className="fw-semibold">{p.full_name}</div></div>
              <div className="col-md-4"><div className="text-secondary small">{t("res_referral_code") || "Referral code"}</div><div className="fw-semibold font-monospace">{p.referral_code}</div></div>
              <div className="col-md-6"><div className="text-secondary small">{t("sup_lbl_email") || "Email"}</div><div className="fw-semibold">{p.email}</div></div>
              <div className="col-md-3"><div className="text-secondary small">{t("res_comm_rate") || "Commission rate"}</div><div className="fw-semibold">{p.commission_rate}% <span className="badge text-bg-light ms-1">{lang === 'bn' ? "অ্যাডমিন নির্ধারিত" : "set by admin"}</span></div></div>
              <div className="col-md-3"><div className="text-secondary small">{t("cust_col_status") || "Status"}</div><div className="fw-semibold text-capitalize">{p.status}</div></div>

              <div className="col-12">
                <div className="text-secondary small">{t("res_referral_link") || "Your referral link"}</div>
                <div className="input-group input-group-sm mt-1" style={{ maxWidth: 520 }}>
                  <input className="form-control font-monospace" readOnly value={fullReferralLink} onFocus={(e) => e.target.select()} />
                  <button type="button" className={`btn ${copied ? "btn-success" : "btn-outline-primary"}`} onClick={copyReferral}>
                    {copied ? (lang === 'bn' ? "কপি হয়েছে!" : "Copied!") : (lang === 'bn' ? "কপি লিংক" : "Copy link")}
                  </button>
                </div>
              </div>
            </div>
            <hr />
            <form onSubmit={save} className="row g-3">
              <div className="col-md-6"><label className="form-label small">{lang === 'bn' ? "কোম্পানির নাম" : "Company name"}</label><input className="form-control" value={p.company_name} onChange={(e) => set("company_name", e.target.value)} /></div>
              <div className="col-md-6"><label className="form-label small">{t("sup_lbl_phone") || "Phone"}</label><input className="form-control" value={p.phone} onChange={(e) => set("phone", e.target.value)} /></div>
              <div className="col-md-6"><label className="form-label small">{t("set_shop_addr") || "Address"}</label><input className="form-control" value={p.address} onChange={(e) => set("address", e.target.value)} /></div>
              <div className="col-md-6"><label className="form-label small">{lang === 'bn' ? "দেশ" : "Country"}</label><input className="form-control" value={p.country} onChange={(e) => set("country", e.target.value)} /></div>
              <div className="col-12 d-flex align-items-center gap-3">
                <button className="btn btn-brand" disabled={saving}>{saving ? (lang === 'bn' ? "সংরক্ষণ হচ্ছে..." : "Saving…") : (t("sup_btn_save") ? t("sup_btn_save").replace(/.*?(সেভ|save).*/i, "$1") : "Save")}</button>
                {msg && <span className="small text-secondary">{msg}</span>}
              </div>
            </form>
          </div>
        </div>
      )}
    </ResellerShell>
  );
}
