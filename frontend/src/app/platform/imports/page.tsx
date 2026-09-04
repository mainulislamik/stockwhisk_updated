"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import toast from "react-hot-toast";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, EmptyRow, ErrorState, PageHeader, Spinner } from "@/components/ui";

type Job = {
  id: string;
  shop_name: string;
  import_type_display: string;
  status: string;
  status_display: string;
  total_rows: number;
  created_count: number;
  updated_count: number;
  created_at: string;
};

const STATUS_BADGE: Record<string, string> = {
  committed: "text-bg-success",
  preview_ready: "text-bg-info",
  mapping: "text-bg-secondary",
  uploaded: "text-bg-secondary",
  failed: "text-bg-danger",
  rolled_back: "text-bg-warning",
};

export default function ImportsPage() {
  const { lang, t } = useLanguage();
  const router = useRouter();
  const [meta, setMeta] = useState<{ shops: { id: number; name: string }[]; types: { value: string; label: string }[] } | null>(null);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState("");
  const [shop, setShop] = useState("");
  const [type, setType] = useState("products");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [m, j] = await Promise.all([
        api<{ shops: any[]; types: any[] }>("/platform/imports/meta/"),
        api<{ jobs: Job[] }>("/platform/imports/jobs/"),
      ]);
      setMeta(m);
      setJobs(j.jobs);
    } catch (e: any) {
      setError(e?.message || "Failed to load imports.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    const f = fileRef.current?.files?.[0];
    if (!shop || !f) { toast.error("Pick a shop and a file."); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("shop", shop);
      fd.append("import_type", type);
      fd.append("file", f);
      const job = await api<{ id: string }>("/platform/imports/upload/", { method: "POST", body: fd });
      router.push(`/platform/imports/${job.id}`);
    } catch (e: any) {
      toast.error(e?.data?.detail || e?.message || "Upload failed.");
      setBusy(false);
    }
  }

  if (error) return <ErrorState error={error} />;
  if (!meta || !jobs) return <Spinner />;

  return (
    <>
      <PageHeader title="Data Import" />

      <Card className="mb-4">
        <h2 className="h6 fw-bold mb-3">{lang === "bn" ? "নতুন ডাটা ইমপোর্ট" : "New import"}</h2>
        <form className="row g-3 align-items-end" onSubmit={upload}>
          <div className="col-md-4">
            <label className="form-label small fw-medium">{lang === "bn" ? "টার্গেট শপ নির্বাচন" : "Target shop"}</label>
            <select className="form-select" required value={shop} onChange={(e) => setShop(e.target.value)}>
              <option value="">{lang === "bn" ? "— শপ নির্বাচন করুন —" : "— choose shop —"}</option>
              {meta.shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label small fw-medium">{lang === "bn" ? "ইমপোর্টের ধরন" : "Import type"}</label>
            <select className="form-select" value={type} onChange={(e) => setType(e.target.value)}>
              {meta.types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-medium">{lang === "bn" ? "ফাইল (CSV বা XLSX)" : "File (CSV or XLSX)"}</label>
            <input ref={fileRef} type="file" accept=".csv,.xlsx" className="form-control" required />
          </div>
          <div className="col-md-1"><button className="btn btn-brand w-100" disabled={busy}>{lang === "bn" ? "আপলোড করুন →" : "Upload →"}</button></div>
        </form>
      </Card>

      <div className="card shadow-sm">
        <div className="card-body"><h2 className="h6 fw-bold mb-0">{lang === "bn" ? "সাম্প্রতিক ইমপোর্ট হিস্টোরি" : "Recent import jobs"}</h2></div>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="thead-1">
              <tr><th>{lang === "bn" ? "তারিখ" : "Created"}</th><th>{lang === "bn" ? "দোকান" : "Shop"}</th><th>{lang === "bn" ? "ধরন" : "Type"}</th><th>setStatus</th><th>{lang === "bn" ? "মোট রো" : "Rows"}</th><th>{lang === "bn" ? "তারিখ" : "Created"}</th><th>Updated</th><th className="text-end"></th></tr>
            </thead>
            <tbody>
              {jobs.length === 0 && <EmptyRow cols={8} text="No import jobs yet." />}
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td className="text-nowrap small">{new Date(j.created_at).toLocaleString()}</td>
                  <td>{j.shop_name}</td>
                  <td>{j.import_type_display}</td>
                  <td><span className={`badge ${STATUS_BADGE[j.status] || "text-bg-secondary"}`}>{j.status_display}</span></td>
                  <td>{j.total_rows}</td>
                  <td>{j.created_count}</td>
                  <td>{j.updated_count}</td>
                  <td className="text-end"><Link href={`/platform/imports/${j.id}`} className="text-decoration-none">Open →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
