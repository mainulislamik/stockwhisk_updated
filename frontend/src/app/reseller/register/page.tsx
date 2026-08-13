"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function ResellerRegisterPage() {
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", company_name: "", country: "", address: "", password: "", confirm_password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await api("/reseller/register/", { method: "POST", body: form });
      setDone(true);
    } catch (err: any) {
      const d = err?.data;
      setError(d?.detail || (d ? Object.values(d).flat().join(" ") : "Registration failed."));
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100" style={{ background: "#0f172a" }}>
        <div className="card shadow-lg border-0 text-center" style={{ width: 460, maxWidth: "92vw" }}>
          <div className="card-body p-5">
            <div style={{ fontSize: "3rem" }}>✅</div>
            <h4 className="fw-bold">Registration received</h4>
            <p className="text-secondary">Your reseller account is <strong>pending admin approval</strong>. You’ll be able to log in once it’s activated.</p>
            <Link href="/reseller/login" className="btn btn-primary">Go to login</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex align-items-center justify-content-center py-5" style={{ minHeight: "100vh", background: "#0f172a" }}>
      <div className="card shadow-lg border-0" style={{ width: 560, maxWidth: "94vw" }}>
        <div className="card-body p-4">
          <div className="fw-bold fs-4">Become a StockWhisk Reseller</div>
          <div className="text-secondary small mb-4">Earn a share of the profit from shops you refer.</div>
          <form onSubmit={submit} className="row g-3">
            <div className="col-md-6"><input className="form-control" placeholder="Full name *" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} required /></div>
            <div className="col-md-6"><input className="form-control" type="email" placeholder="Email *" value={form.email} onChange={(e) => set("email", e.target.value)} required /></div>
            <div className="col-md-6"><input className="form-control" placeholder="Phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
            <div className="col-md-6"><input className="form-control" placeholder="Company / business name" value={form.company_name} onChange={(e) => set("company_name", e.target.value)} /></div>
            <div className="col-md-6"><input className="form-control" placeholder="Country" value={form.country} onChange={(e) => set("country", e.target.value)} /></div>
            <div className="col-md-6"><input className="form-control" placeholder="Address" value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
            <div className="col-md-6"><input className="form-control" type="password" placeholder="Password *" value={form.password} onChange={(e) => set("password", e.target.value)} required /></div>
            <div className="col-md-6"><input className="form-control" type="password" placeholder="Confirm password *" value={form.confirm_password} onChange={(e) => set("confirm_password", e.target.value)} required /></div>
            {error && <div className="col-12"><div className="alert alert-danger py-2 mb-0 small">{error}</div></div>}
            <div className="col-12 d-flex justify-content-between align-items-center">
              <Link href="/reseller/login" className="small">Already a partner? Sign in</Link>
              <button className="btn btn-primary" disabled={busy}>{busy ? "Submitting…" : "Register"}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
