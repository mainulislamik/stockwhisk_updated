"use client";

import { useLanguage } from "@/contexts/LanguageContext";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ErrorState, PageHeader } from "@/components/ui";

const BUSINESS_TYPES = [
  { value: "general", label: "General Retail" },
  { value: "camical", label: "Chemical & Lab Supplies" },
  { value: "supershop", label: "Super Shop & Grocery" },
  { value: "cosmetics", label: "Cosmetics & Beauty" },
  { value: "electronics", label: "Electronics" },
  { value: "computer", label: "Computer" },
  { value: "mobile", label: "Mobile & Accessories" },
];

export default function CreateShopPage() {
  const { lang, t } = useLanguage();
  const router = useRouter();
  const [plan, setPlan] = useState<{ id: number; name: string } | null>(null);
  const [form, setForm] = useState({
    name: "", business_type: "general", plan: "", phone: "",
    owner_name: "", owner_email: "", owner_password: "",
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ plan: { id: number; name: string } | null }>("/platform/plan/")
      .then((d) => setPlan(d.plan))
      .catch(() => setPlan(null));
  }, []);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const body: any = { ...form };
      if (!body.plan) delete body.plan;
      await api("/platform/shops/", { method: "POST", body });
      router.push("/platform/shops");
    } catch (e: any) {
      setErr(e?.data?.detail || e?.message || "Could not create the shop.");
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Create a new shop" />
      <div className="card shadow-sm" style={{ maxWidth: "46rem" }}>
        <form className="card-body" onSubmit={submit}>
          {err && <ErrorState error={err} />}

          <div className="mb-3">
            <label className="form-label small fw-medium">{lang === "bn" ? "দোকানের নাম" : "Shop name"}</label>
            <input className="form-control" required value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>

          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <label className="form-label small fw-medium">{lang === "bn" ? "ব্যবসার ক্যাটাগরি / ধরন" : "Business type"}</label>
              <select className="form-select" value={form.business_type} onChange={(e) => set("business_type", e.target.value)}>
                {BUSINESS_TYPES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-medium">{lang === "bn" ? "প্যাকেজ / প্ল্যান" : "Plan"}</label>
              <select className="form-select" value={form.plan} onChange={(e) => set("plan", e.target.value)}>
                <option value="">{lang === "bn" ? "ডিফল্ট (ফ্রি ট্রায়াল)" : "Default (Free + trial)"}</option>
                {plan && <option value={plan.id}>{plan.name}</option>}
              </select>
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label small fw-medium">{lang === "bn" ? "দোকানের ফোন নম্বর" : "Shop phone"}</label>
            <input className="form-control" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>

          <hr />
          <h2 className="h6 fw-bold">{lang === "bn" ? "মালিকের অ্যাকাউন্ট তথ্য" : "Owner account"}</h2>
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <label className="form-label small fw-medium">{lang === "bn" ? "মালিকের নাম" : "Owner name"}</label>
              <input className="form-control" value={form.owner_name} onChange={(e) => set("owner_name", e.target.value)} />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-medium">{lang === "bn" ? "মালিকের ইমেইল (লগইন আইডি)" : "Owner email"}</label>
              <input type="email" className="form-control" required value={form.owner_email} onChange={(e) => set("owner_email", e.target.value)} />
            </div>
          </div>
          <div className="mb-3">
            <label className="form-label small fw-medium">{lang === "bn" ? "মালিকের পাসওয়ার্ড" : "Owner password"}</label>
            <input
              type="text"
              className="form-control"
              required
              placeholder={lang === "bn" ? "কমপক্ষে ৮ অক্ষর — মালিককে প্রদান করুন" : "min 8 chars — share with the owner"}
              value={form.owner_password}
              onChange={(e) => set("owner_password", e.target.value)}
            />
          </div>

          <div className="d-flex gap-2">
            <button className="btn btn-brand" disabled={busy}>{lang === "bn" ? "শপ তৈরি করুন" : "Create shop"}</button>
            <button type="button" className="btn btn-light" onClick={() => router.push("/platform/shops")}>{lang === "bn" ? "বাতিল" : "Cancel"}</button>
          </div>
        </form>
      </div>
    </>
  );
}
