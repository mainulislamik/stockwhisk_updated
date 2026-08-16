"use client";

import { useEffect, useState } from "react";
import ResellerShell from "@/components/ResellerShell";
import { api } from "@/lib/api";

type FreeShop = { id: number; name: string; code: string; owner_email: string; is_active: boolean; created_at: string };
type FreeData = { enabled: boolean; quota: number; used: number; remaining: number; shops: FreeShop[] };

const SHOP_CATEGORIES = [
  { value: "fashion", label: "Fashion & Apparel" },
  { value: "beauty", label: "Beauty & Cosmetics" },
  { value: "jewelry", label: "Jewelry & Accessories" },
  { value: "home_decor", label: "Home Decor & Furniture" },
  { value: "food", label: "Groceries & Organic Food" },
  { value: "footwear", label: "Footwear & Shoes" },
  { value: "handcrafts", label: "Handcrafts & Boutique" },
  { value: "electronics", label: "Electronics & Gadgets" },
  { value: "computer", label: "Computer & IT" },
  { value: "mobile", label: "Mobile & Accessories" },
  { value: "general", label: "General Retail" },
  { value: "other", label: "Other" },
];

const EMPTY_FORM = {
  shop_name: "", owner_name: "", owner_email: "", owner_password: "",
  phone: "", business_type: "general", address: "",
};

export default function ResellerFreeShopsPage() {
  const [data, setData] = useState<FreeData | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [step, setStep] = useState<"form" | "otp">("form");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function load() {
    try { setData(await api<FreeData>("/reseller/free-shops/")); }
    catch { setData({ enabled: false, quota: 0, used: 0, remaining: 0, shops: [] }); }
  }
  useEffect(() => { load(); }, []);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function resetAll() {
    setForm({ ...EMPTY_FORM }); setOtp(""); setStep("form"); setMsg(null);
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await api("/reseller/free-shops/initiate/", { method: "POST", body: form });
      setStep("otp");
      setMsg({ text: `We emailed a 6-digit code to ${form.owner_email}. Enter it below to finish.`, ok: true });
    } catch (e: any) {
      setMsg({ text: e?.data?.detail || e?.message || "Could not send the verification code.", ok: false });
    } finally { setBusy(false); }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const res = await api<FreeData>("/reseller/free-shops/verify/", {
        method: "POST", body: { email: form.owner_email.trim().toLowerCase(), otp: otp.trim() },
      });
      setData(res);
      resetAll();
      setMsg({ text: "Free shop created! The owner can log in at stockwhisk.com/login.", ok: true });
    } catch (e: any) {
      setMsg({ text: e?.data?.detail || e?.message || "Verification failed.", ok: false });
    } finally { setBusy(false); }
  }

  return (
    <ResellerShell>
      <h3 className="fw-bold mb-1">Free Shops</h3>
      <p className="text-secondary mb-4">Sign up shops that are free for life. They keep working while your account is active.</p>

      {!data ? (
        <div className="text-center py-5"><span className="spinner-border" /></div>
      ) : !data.enabled ? (
        <div className="card border-0 shadow-sm"><div className="card-body text-center py-5 text-secondary">
          <div className="fs-1 mb-2">🎁</div>
          <div className="fw-semibold">Free-shop grants aren’t enabled for your account.</div>
          <div className="small">Contact the StockWhisk team to get free-shop credits.</div>
        </div></div>
      ) : (
        <div className="row g-4">
          {/* Create flow */}
          <div className="col-lg-5">
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div className="fw-semibold">Create a free shop</div>
                  <span className={`badge ${data.remaining > 0 ? "text-bg-success" : "text-bg-secondary"}`}>
                    {data.used} / {data.quota} used
                  </span>
                </div>

                {data.remaining <= 0 ? (
                  <div className="alert alert-warning py-2 small mb-0">You’ve used all your free-shop credits.</div>
                ) : step === "form" ? (
                  <form onSubmit={sendCode} className="vstack gap-2">
                    <input required className="form-control form-control-sm" placeholder="Shop name *"
                      value={form.shop_name} onChange={(e) => set("shop_name", e.target.value)} />
                    <input required className="form-control form-control-sm" placeholder="Owner full name *"
                      value={form.owner_name} onChange={(e) => set("owner_name", e.target.value)} />
                    <input required type="email" className="form-control form-control-sm" placeholder="Owner email *"
                      value={form.owner_email} onChange={(e) => set("owner_email", e.target.value)} />
                    <input required type="password" minLength={8} className="form-control form-control-sm" placeholder="Owner password (min 8) *"
                      value={form.owner_password} onChange={(e) => set("owner_password", e.target.value)} />
                    <input className="form-control form-control-sm" placeholder="Phone"
                      value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                    <select className="form-select form-select-sm" value={form.business_type}
                      onChange={(e) => set("business_type", e.target.value)}>
                      {SHOP_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <textarea className="form-control form-control-sm" rows={2} placeholder="Address"
                      value={form.address} onChange={(e) => set("address", e.target.value)} />
                    <button className="btn btn-primary btn-sm mt-1" disabled={busy}>
                      {busy ? "Sending code…" : "Send verification code"}
                    </button>
                    {msg && <div className={`small ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</div>}
                  </form>
                ) : (
                  <form onSubmit={verify} className="vstack gap-2">
                    <div className="small text-secondary">A 6-digit code was emailed to <b>{form.owner_email}</b> (valid for 3 minutes).</div>
                    <input required inputMode="numeric" maxLength={6} className="form-control text-center fs-5 font-monospace"
                      placeholder="------" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
                    <button className="btn btn-success btn-sm" disabled={busy || otp.length !== 6}>
                      {busy ? "Verifying…" : "Verify & create shop"}
                    </button>
                    <button type="button" className="btn btn-link btn-sm text-secondary p-0" onClick={() => { setStep("form"); setMsg(null); }}>
                      ← Change details / resend
                    </button>
                    {msg && <div className={`small ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</div>}
                  </form>
                )}
              </div>
            </div>
          </div>

          {/* Existing free shops */}
          <div className="col-lg-7">
            <div className="card border-0 shadow-sm">
              <div className="table-responsive">
                <table className="table table-striped align-middle mb-0">
                  <thead className="table-light"><tr><th>Shop</th><th>Code</th><th>Owner</th><th>Status</th></tr></thead>
                  <tbody>
                    {data.shops.length === 0 ? (
                      <tr><td colSpan={4} className="text-center text-secondary py-5">No free shops yet.</td></tr>
                    ) : data.shops.map((s) => (
                      <tr key={s.id}>
                        <td className="fw-medium">{s.name}</td>
                        <td className="font-monospace small">{s.code}</td>
                        <td className="small">{s.owner_email}</td>
                        <td><span className={`badge ${s.is_active ? "text-bg-success" : "text-bg-secondary"}`}>{s.is_active ? "active" : "suspended"}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </ResellerShell>
  );
}
