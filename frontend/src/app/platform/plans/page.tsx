"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ErrorState, PageHeader, Spinner } from "@/components/ui";

type Plan = {
  id: number;
  name: string;
  price_monthly: string | number;
  price_yearly: string | number;
  max_users: number;
  max_branches: number;
  max_products: number;
  features: Record<string, boolean>;
  is_active: boolean;
};

const FEATURE_LABELS: Record<string, string> = {
  pos: "pos",
  basic_analytics: "basicanalytics",
  advanced_analytics: "advancedanalytics",
  reports_export: "reportsexport",
  multi_branch: "multibranch",
  api_access: "apiaccess",
};

export default function PlansPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [keys, setKeys] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<{ plan: Plan | null; feature_keys: string[] }>("/platform/plan/")
      .then((d) => { setPlan(d.plan); setKeys(d.feature_keys); setLoaded(true); })
      .catch((e) => setError(e?.message || "Failed to load plan."));
  }, []);

  function upd<K extends keyof Plan>(k: K, v: Plan[K]) {
    setPlan((p) => (p ? { ...p, [k]: v } : p));
  }
  function toggleFeature(k: string) {
    setPlan((p) => (p ? { ...p, features: { ...p.features, [k]: !p.features[k] } } : p));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!plan) return;
    setBusy(true);
    setSaved(false);
    setError("");
    try {
      const enabled = keys.filter((k) => plan.features[k]);
      const d = await api<{ plan: Plan }>("/platform/plan/", {
        method: "PUT",
        body: {
          name: plan.name,
          price_monthly: plan.price_monthly,
          price_yearly: plan.price_yearly,
          max_users: plan.max_users,
          max_branches: plan.max_branches,
          max_products: plan.max_products,
          features: enabled,
        },
      });
      setPlan(d.plan);
      setSaved(true);
    } catch (e: any) {
      setError(e?.data?.detail || e?.message || "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !plan) return <ErrorState error={error} />;
  if (!loaded) return <Spinner />;
  if (!plan) return (
    <>
      <PageHeader title="Subscription Plan" />
      <div className="alert alert-info">No subscription plan exists yet. Create one from the Django Admin, then manage its pricing and features here.</div>
    </>
  );

  return (
    <>
      <PageHeader title="Subscription Plan" />
      <form className="card shadow-sm" style={{ maxWidth: "36rem" }} onSubmit={save}>
        <div className="card-body">
          {error && <ErrorState error={error} />}
          {saved && <div className="alert alert-success py-2 px-3">Plan saved.</div>}

          <div className="d-flex align-items-center justify-content-between mb-3">
            <input className="form-control me-2" style={{ maxWidth: "16rem" }} value={plan.name} onChange={(e) => upd("name", e.target.value)} />
            <span className="badge text-bg-dark">The only plan</span>
          </div>

          <div className="row g-3 mb-3">
            <Num label="৳/mo" v={plan.price_monthly} on={(v) => upd("price_monthly", v)} />
            <Num label="৳/yr" v={plan.price_yearly} on={(v) => upd("price_yearly", v)} />
            <Num label="Max users" v={plan.max_users} on={(v) => upd("max_users", Number(v))} />
            <Num label="Max branches" v={plan.max_branches} on={(v) => upd("max_branches", Number(v))} />
            <div className="col-12">
              <label className="form-label small fw-medium">Max products</label>
              <input className="form-control" type="number" value={plan.max_products} onChange={(e) => upd("max_products", Number(e.target.value))} />
            </div>
          </div>

          <label className="form-label small fw-bold">Features</label>
          <div className="row g-2 mb-3">
            {keys.map((k) => (
              <div className="col-6" key={k}>
                <div className="form-check">
                  <input className="form-check-input" type="checkbox" id={`f-${k}`} checked={!!plan.features[k]} onChange={() => toggleFeature(k)} />
                  <label className="form-check-label" htmlFor={`f-${k}`}>{FEATURE_LABELS[k] || k}</label>
                </div>
              </div>
            ))}
          </div>

          <button className="btn btn-brand w-100" disabled={busy}>Save plan</button>
        </div>
      </form>
    </>
  );
}

function Num({ label, v, on }: { label: string; v: string | number; on: (v: string) => void }) {
  return (
    <div className="col-6">
      <label className="form-label small fw-medium">{label}</label>
      <input className="form-control" type="number" step="0.01" value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}
