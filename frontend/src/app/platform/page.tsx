"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { startImpersonation } from "@/lib/impersonation";
import { Card, EmptyRow, ErrorState, PageHeader, Spinner, StatCard, money } from "@/components/ui";

type Shop = {
  id: number;
  name: string;
  plan_tier: string | null;
  is_active: boolean;
};

type Dashboard = {
  total_shops: number;
  active_shops: number;
  trial_shops: number;
  suspended_shops: number;
  by_business_type: { business_type: string; n: number; label: string }[];
  pending_payments: number;
  approved_revenue: string | number;
  unread_messages: number;
  recent_shops: Shop[];
};

export default function OverviewPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Dashboard>("/platform/dashboard/")
      .then(setData)
      .catch((e) => setError(e?.message || "Failed to load dashboard."));
  }, []);

  const loginAs = useCallback(async (shop: Shop) => {
    try {
      const t = await api<{ access: string; refresh: string; shop_name: string }>(
        `/platform/shops/${shop.id}/login-as/`,
        { method: "POST" }
      );
      startImpersonation(t);
    } catch (e: any) {
      alert(e?.message || "Could not log in as this shop.");
    }
  }, []);

  if (error) return <ErrorState error={error} />;
  if (!data) return <Spinner />;

  return (
    <>
      <PageHeader title="Platform Overview" />

      <div className="row g-3 mb-3">
        <div className="col-6 col-lg-3"><StatCard label="Total shops" value={data.total_shops} icon="bi-shop" /></div>
        <div className="col-6 col-lg-3"><StatCard label="Active" value={data.active_shops} icon="bi-check-circle" tone="success" /></div>
        <div className="col-6 col-lg-3"><StatCard label="On trial" value={data.trial_shops} icon="bi-hourglass-split" tone="warning" /></div>
        <div className="col-6 col-lg-3"><StatCard label="Suspended" value={data.suspended_shops} icon="bi-slash-circle" tone="danger" /></div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <Card>
            <div className="text-secondary small">Pending manual payments</div>
            <div className="fs-3 fw-bold">{data.pending_payments}</div>
            <Link href="/platform/payments" className="small text-decoration-none">Review queue →</Link>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card>
            <div className="text-secondary small">Unread messages</div>
            <div className="fs-3 fw-bold">{data.unread_messages}</div>
            <Link href="/platform/messages" className="small text-decoration-none">Open inbox →</Link>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card>
            <div className="text-secondary small">Approved revenue (all time)</div>
            <div className="fs-3 fw-bold">{money(data.approved_revenue)}</div>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card>
            <div className="text-secondary small mb-1">Shops by type</div>
            {data.by_business_type.length === 0 && <div className="text-secondary small">—</div>}
            {data.by_business_type.map((b) => (
              <div key={b.business_type} className="d-flex justify-content-between small">
                <span>{b.label}</span><span className="fw-semibold">{b.n}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>

      <Card body={false}>
        <div className="card-body d-flex align-items-center justify-content-between">
          <h2 className="h6 fw-bold mb-0">Recent shops</h2>
          <div className="d-flex gap-2">
            <Link href="/platform/shops/new" className="btn btn-brand btn-sm">+ Create shop</Link>
            <Link href="/platform/shops" className="btn btn-outline-brand btn-sm">All shops →</Link>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="thead-1">
              <tr><th>Shop</th><th>Plan</th><th>Status</th><th className="text-end">Action</th></tr>
            </thead>
            <tbody>
              {data.recent_shops.length === 0 && <EmptyRow cols={4} />}
              {data.recent_shops.map((s) => (
                <tr key={s.id}>
                  <td className="fw-semibold">{s.name}</td>
                  <td>{s.plan_tier || "—"}</td>
                  <td>
                    {s.is_active
                      ? <span className="text-success">Active</span>
                      : <span className="text-danger">Suspended</span>}
                  </td>
                  <td className="text-end">
                    <button className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => loginAs(s)}>
                      Login as →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
