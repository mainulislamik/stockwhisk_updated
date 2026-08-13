"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ResellerShell from "@/components/ResellerShell";
import { api } from "@/lib/api";

type Shop = { id: number; name: string; owner_name: string; plan: string; status: string; on_trial: boolean; trial_ends_at: string | null; created_at: string | null; attributed_at: string | null };
const dt = (s: string | null) => (s ? new Date(s).toLocaleString() : "—");

export default function ResellerShopDetail() {
  const { id } = useParams<{ id: string }>();
  const [shop, setShop] = useState<Shop | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api<Shop>(`/reseller/shops/${id}/`).then(setShop).catch((e) => setError(e?.status === 404 ? "Shop not found or not connected to your account." : "Failed to load.")); }, [id]);

  return (
    <ResellerShell>
      <Link href="/reseller/shops" className="small">← Back to shops</Link>
      <h3 className="fw-bold my-3">{shop?.name || "Shop"}</h3>
      {error ? <div className="alert alert-warning">{error}</div> : !shop ? <div className="spinner-border" /> : (
        <div className="card shadow-sm border-0" style={{ maxWidth: 640 }}>
          <div className="card-body">
            {[
              ["Shop ID", shop.id],
              ["Owner", shop.owner_name || "—"],
              ["Plan", shop.plan || "—"],
              ["Status", shop.status],
              ["On trial", shop.on_trial ? "Yes" : "No"],
              ["Trial ends", dt(shop.trial_ends_at)],
              ["Created", dt(shop.created_at)],
              ["Attributed to you", dt(shop.attributed_at)],
            ].map(([k, v]) => (
              <div className="d-flex justify-content-between border-bottom py-2" key={k as string}>
                <span className="text-secondary">{k}</span><span className="fw-medium">{v as any}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </ResellerShell>
  );
}
