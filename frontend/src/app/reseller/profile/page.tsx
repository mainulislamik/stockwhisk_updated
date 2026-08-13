"use client";

import { useEffect, useState } from "react";
import ResellerShell from "@/components/ResellerShell";
import { api } from "@/lib/api";

type Profile = {
  reseller_code: string; referral_code: string; referral_link: string; email: string; full_name: string;
  company_name: string; phone: string; address: string; country: string; commission_rate: string; status: string;
};

export default function ResellerProfilePage() {
  const [p, setP] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { api<Profile>("/reseller/profile/").then(setP).catch(() => {}); }, []);
  const set = (k: string, v: string) => setP((x) => (x ? { ...x, [k]: v } : x));

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!p) return;
    setSaving(true); setMsg("");
    try {
      const r = await api<Profile>("/reseller/profile/", { method: "PATCH", body: { company_name: p.company_name, phone: p.phone, address: p.address, country: p.country } });
      setP(r); setMsg("Saved.");
    } catch { setMsg("Failed to save."); } finally { setSaving(false); }
  }

  return (
    <ResellerShell>
      <h3 className="fw-bold mb-4">Profile</h3>
      {!p ? <div className="spinner-border" /> : (
        <div className="card shadow-sm border-0" style={{ maxWidth: 680 }}>
          <div className="card-body">
            <div className="row g-3 mb-4">
              <div className="col-md-4"><div className="text-secondary small">Reseller ID</div><div className="fw-semibold">{p.reseller_code}</div></div>
              <div className="col-md-4"><div className="text-secondary small">Referral code</div><div className="fw-semibold font-monospace">{p.referral_code}</div></div>
              <div className="col-md-4"><div className="text-secondary small">Commission rate</div><div className="fw-semibold">{p.commission_rate}% <span className="badge text-bg-light ms-1">set by admin</span></div></div>
              <div className="col-md-6"><div className="text-secondary small">Email</div><div className="fw-semibold">{p.email}</div></div>
              <div className="col-md-6"><div className="text-secondary small">Status</div><div className="fw-semibold text-capitalize">{p.status}</div></div>
            </div>
            <form onSubmit={save} className="row g-3">
              <div className="col-md-6"><label className="small">Company name</label><input className="form-control" value={p.company_name} onChange={(e) => set("company_name", e.target.value)} /></div>
              <div className="col-md-6"><label className="small">Phone</label><input className="form-control" value={p.phone} onChange={(e) => set("phone", e.target.value)} /></div>
              <div className="col-md-6"><label className="small">Country</label><input className="form-control" value={p.country} onChange={(e) => set("country", e.target.value)} /></div>
              <div className="col-md-6"><label className="small">Address</label><input className="form-control" value={p.address} onChange={(e) => set("address", e.target.value)} /></div>
              <div className="col-12 d-flex align-items-center gap-3">
                <button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
                {msg && <span className="small text-success">{msg}</span>}
              </div>
            </form>
          </div>
        </div>
      )}
    </ResellerShell>
  );
}
