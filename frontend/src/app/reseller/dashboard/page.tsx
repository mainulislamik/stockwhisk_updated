"use client";

import { useEffect, useState } from "react";
import ResellerShell from "@/components/ResellerShell";
import { api } from "@/lib/api";

type Dash = {
  reseller_code: string; referral_code: string; referral_link: string; commission_rate: string;
  total_shops: number; active_shops: number; trial_shops: number; suspended_shops: number;
  total_commission: string; pending_commission: string; paid_commission: string;
};

const tk = (n: any) => "৳" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ResellerDashboard() {
  const [d, setD] = useState<Dash | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { api<Dash>("/reseller/dashboard/").then(setD).catch(() => {}); }, []);

  const fullLink = d ? (typeof window !== "undefined" ? window.location.origin : "") + d.referral_link : "";
  function copy() { navigator.clipboard.writeText(fullLink); setCopied(true); setTimeout(() => setCopied(false), 1500); }

  const cards = d ? [
    ["Total shops", d.total_shops, "bg-primary"],
    ["Active", d.active_shops, "bg-success"],
    ["Trial", d.trial_shops, "bg-warning"],
    ["Suspended", d.suspended_shops, "bg-secondary"],
  ] : [];
  const money = d ? [
    ["Total commission", d.total_commission],
    ["Pending commission", d.pending_commission],
    ["Paid commission", d.paid_commission],
  ] : [];

  return (
    <ResellerShell>
      <h3 className="fw-bold mb-4">Dashboard</h3>
      {!d ? <div className="spinner-border" /> : (
        <>
          <div className="row g-3 mb-3">
            {cards.map(([label, val, bg]) => (
              <div className="col-6 col-lg-3" key={label as string}>
                <div className="card shadow-sm border-0"><div className="card-body">
                  <div className="text-secondary small">{label}</div>
                  <div className="fs-3 fw-bold">{val as number}</div>
                </div></div>
              </div>
            ))}
          </div>
          <div className="row g-3 mb-4">
            {money.map(([label, val]) => (
              <div className="col-md-4" key={label as string}>
                <div className="card shadow-sm border-0"><div className="card-body">
                  <div className="text-secondary small">{label}</div>
                  <div className="fs-4 fw-bold text-success">{tk(val)}</div>
                </div></div>
              </div>
            ))}
          </div>
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <h6 className="fw-bold mb-3">Your referral</h6>
              <div className="row g-3">
                <div className="col-md-4"><div className="text-secondary small">Reseller ID</div><div className="fw-semibold">{d.reseller_code}</div></div>
                <div className="col-md-4"><div className="text-secondary small">Referral code</div><div className="fw-semibold font-monospace">{d.referral_code}</div></div>
                <div className="col-md-4"><div className="text-secondary small">Commission rate</div><div className="fw-semibold">{d.commission_rate}%</div></div>
                <div className="col-12">
                  <div className="text-secondary small">Referral link</div>
                  <div className="input-group">
                    <input className="form-control font-monospace" readOnly value={fullLink} />
                    <button className="btn btn-outline-primary" onClick={copy}>{copied ? "Copied!" : "Copy"}</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </ResellerShell>
  );
}
