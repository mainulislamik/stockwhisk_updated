"use client";

import { useLanguage } from "@/contexts/LanguageContext";

import { useEffect, useState } from "react";
import Link from "next/link";
import ResellerShell from "@/components/ResellerShell";
import { api } from "@/lib/api";

type Shop = { id: number; name: string; owner_name: string; plan: string; status: string; on_trial: boolean; trial_ends_at: string | null; created_at: string | null; attributed_at: string | null };

const badge: Record<string, string> = { active: "text-bg-success", trial: "text-bg-warning", suspended: "text-bg-secondary" };
const dt = (s: string | null) => (s ? new Date(s).toLocaleDateString() : "—");

export default function ResellerShopsPage() {
  const { lang, t } = useLanguage();
  const [rows, setRows] = useState<Shop[] | null>(null);
  useEffect(() => { api<Shop[]>("/reseller/shops/").then(setRows).catch(() => setRows([])); }, []);

  return (
    <ResellerShell>
      <h3 className="fw-bold mb-4">{lang === "bn" ? "আমার রেফারকৃত শপসমূহ" : "My Shops"}</h3>
      <div className="card shadow-sm border-0">
        <div className="table-responsive">
          <table className="table table-striped align-middle mb-0">
            <thead className="table-light"><tr>
              <th>{lang === "bn" ? "দোকান" : "Shop"}</th><th>{lang === "bn" ? "মালিক" : "Owner"}</th><th>{lang === "bn" ? "প্যাকেজ" : "Plan"}</th><th>setStatus</th><th>{lang === "bn" ? "ট্রায়াল শেষ" : "Trial ends"}</th><th>{lang === "bn" ? "যুক্ত হওয়ার তারিখ" : "Attributed"}</th><th></th>
            </tr></thead>
            <tbody>
              {!rows ? (<tr><td colSpan={7} className="text-center py-4"><span className="spinner-border spinner-border-sm" /></td></tr>)
                : rows.length === 0 ? (<tr><td colSpan={7} className="text-center text-secondary py-5">{lang === "bn" ? "এখনও কোনো শপ যুক্ত হয়নি। আপনার রেফারেল লিংক শেয়ার করে শুরু করুন।" : "No connected shops yet. Share your referral link to get started."}</td></tr>)
                : rows.map((s) => (
                  <tr key={s.id}>
                    <td className="fw-medium">{s.name}</td>
                    <td className="text-secondary">{s.owner_name || "—"}</td>
                    <td>{s.plan || "—"}</td>
                    <td><span className={`badge ${badge[s.status] || "text-bg-light"}`}>{s.status}</span></td>
                    <td className="text-secondary">{dt(s.trial_ends_at)}</td>
                    <td className="text-secondary">{dt(s.attributed_at)}</td>
                    <td className="text-end"><Link href={`/reseller/shops/${s.id}`} className="small">{lang === "bn" ? "দেখুন" : "View"}</Link></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </ResellerShell>
  );
}
