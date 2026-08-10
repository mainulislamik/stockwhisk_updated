"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { startImpersonation } from "@/lib/impersonation";
import { ErrorState, PageHeader, Spinner, fmtDate } from "@/components/ui";
import toast from "react-hot-toast";

type Shop = {
  id: number;
  name: string;
  business_type: string;
  phone: string;
  email: string;
  address: string;
  plan_tier: string | null;
  is_active: boolean;
  user_count: number;
  owner_email: string | null;
  owner_full_name: string | null;
  can_delete: boolean;
  days_suspended: number;
  created_at: string;
  trial_ends_at: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  electronics: "Electronics",
  computer: "Computer",
  mobile: "Mobile & Accessories",
  general: "General Retail",
};

export default function ShopDetailsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  
  const [shop, setShop] = useState<Shop | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<Shop>(`/platform/shops/${id}/`);
      setShop(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load shop details.");
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const loginAs = useCallback(async () => {
    if (!shop) return;
    try {
      const t = await api<{ access: string; refresh: string; shop_name: string }>(
        `/platform/shops/${shop.id}/login-as/`, { method: "POST" });
      startImpersonation(t);
    } catch (e: any) {
      toast.error(e?.message || "Could not log in as this shop.");
    }
  }, [shop]);

  const toggle = useCallback(async () => {
    if (!shop) return;
    setBusy(true);
    try {
      await api(`/platform/shops/${shop.id}/${shop.is_active ? "suspend" : "activate"}/`, { method: "POST" });
      await load();
      toast.success(shop.is_active ? "Shop suspended." : "Shop activated.");
    } catch (e: any) {
      toast.error(e?.message || "Action failed.");
    } finally {
      setBusy(false);
    }
  }, [shop, load]);

  const resetPassword = useCallback(async () => {
    if (!shop) return;
    const pw = prompt(`Enter new password for owner (${shop.owner_email || 'no email'}):`);
    if (!pw) return;
    if (pw.length < 6) return toast.error("Password must be at least 6 characters.");
    
    setBusy(true);
    try {
      await api(`/platform/shops/${shop.id}/owner-password/`, { method: "POST", body: { new_password: pw } });
      toast.success(`Owner password reset for ${shop.name}.`);
    } catch (e: any) {
      toast.error(e?.data?.detail || e?.message || "Failed to reset password.");
    } finally {
      setBusy(false);
    }
  }, [shop]);

  const deleteShop = useCallback(async () => {
    if (!shop) return;
    const confirmName = prompt(`This will permanently delete ${shop.name} and all its data. Type the shop name to confirm:`);
    if (confirmName !== shop.name) {
      if (confirmName) toast.error("Shop name did not match.");
      return;
    }
    
    setBusy(true);
    try {
      await api(`/platform/shops/${shop.id}/`, { method: "DELETE", body: { confirm_name: confirmName } });
      toast.success(`Shop '${shop.name}' permanently deleted.`);
      router.push("/platform/shops");
    } catch (e: any) {
      toast.error(e?.data?.detail || e?.message || "Failed to delete.");
      setBusy(false);
    }
  }, [shop, router]);

  if (error) return <ErrorState error={error} />;
  if (!shop) return <Spinner />;

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <Link href="/platform/shops" className="text-decoration-none text-secondary small d-flex align-items-center gap-1 mb-2">
            <i className="bi bi-arrow-left"></i> Back to Shops
          </Link>
          <h1 className="h3 fw-bold mb-0 text-white d-flex align-items-center gap-3">
            {shop.name}
            {shop.is_active ? (
              <span className="badge bg-success bg-opacity-25 text-success rounded-pill px-3 py-1 fs-6 fw-normal">Active</span>
            ) : (
              <span className="badge bg-danger bg-opacity-25 text-danger rounded-pill px-3 py-1 fs-6 fw-normal">Suspended</span>
            )}
          </h1>
        </div>
        
        <div className="d-flex gap-2">
          <button className="btn btn-brand rounded-pill px-4 shadow-sm" onClick={loginAs}>
            <i className="bi bi-box-arrow-in-right me-2"></i>Login as Shop
          </button>
        </div>
      </div>

      <div className="row g-4">
        {/* Left Column - Details */}
        <div className="col-lg-8">
          <div className="card border-0 shadow-sm rounded-4 h-100" style={{ background: "rgba(30, 41, 59, 0.5)", backdropFilter: "blur(10px)" }}>
            <div className="card-body p-4">
              <h5 className="fw-bold text-white mb-4"><i className="bi bi-shop me-2 text-brand"></i>Shop Information</h5>
              
              <div className="row g-4">
                <div className="col-md-6">
                  <div className="p-3 rounded-3" style={{ background: "rgba(15, 23, 42, 0.4)" }}>
                    <p className="text-secondary small mb-1">Business Type</p>
                    <p className="fw-medium text-white mb-0">{TYPE_LABELS[shop.business_type] || shop.business_type}</p>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="p-3 rounded-3" style={{ background: "rgba(15, 23, 42, 0.4)" }}>
                    <p className="text-secondary small mb-1">Contact Phone</p>
                    <p className="fw-medium text-white mb-0">{shop.phone || "—"}</p>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="p-3 rounded-3" style={{ background: "rgba(15, 23, 42, 0.4)" }}>
                    <p className="text-secondary small mb-1">Public Email</p>
                    <p className="fw-medium text-white mb-0">{shop.email || "—"}</p>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="p-3 rounded-3" style={{ background: "rgba(15, 23, 42, 0.4)" }}>
                    <p className="text-secondary small mb-1">Total Users</p>
                    <p className="fw-medium text-white mb-0">{shop.user_count} User(s)</p>
                  </div>
                </div>
                <div className="col-12">
                  <div className="p-3 rounded-3" style={{ background: "rgba(15, 23, 42, 0.4)" }}>
                    <p className="text-secondary small mb-1">Physical Address</p>
                    <p className="fw-medium text-white mb-0">{shop.address || "No address provided"}</p>
                  </div>
                </div>
              </div>

              <hr className="border-secondary my-4 opacity-25" />

              <h5 className="fw-bold text-white mb-4"><i className="bi bi-person-badge me-2 text-info"></i>Owner Details</h5>
              <div className="row g-4">
                <div className="col-md-6">
                  <div className="p-3 rounded-3" style={{ background: "rgba(15, 23, 42, 0.4)" }}>
                    <p className="text-secondary small mb-1">Owner Name</p>
                    <p className="fw-medium text-white mb-0">{shop.owner_full_name || "—"}</p>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="p-3 rounded-3" style={{ background: "rgba(15, 23, 42, 0.4)" }}>
                    <p className="text-secondary small mb-1">Owner Email (Login)</p>
                    <p className="fw-medium text-white mb-0">{shop.owner_email || "—"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Status & Actions */}
        <div className="col-lg-4">
          <div className="card border-0 shadow-sm rounded-4 mb-4" style={{ background: "rgba(30, 41, 59, 0.5)", backdropFilter: "blur(10px)" }}>
            <div className="card-body p-4">
              <h5 className="fw-bold text-white mb-4"><i className="bi bi-activity me-2 text-warning"></i>Subscription</h5>
              
              <div className="mb-3">
                <p className="text-secondary small mb-1">Current Plan</p>
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-secondary px-3 py-2 fs-6 rounded-3 text-uppercase">{shop.plan_tier || "Free"}</span>
                </div>
              </div>
              
              <div className="mb-3">
                <p className="text-secondary small mb-1">Registered On</p>
                <p className="fw-medium text-white mb-0">{fmtDate(shop.created_at)}</p>
              </div>

              {shop.trial_ends_at && (
                <div>
                  <p className="text-secondary small mb-1">Trial Expires</p>
                  <p className="fw-medium text-white mb-0">{fmtDate(shop.trial_ends_at)}</p>
                </div>
              )}
            </div>
          </div>

          <div className="card border-0 shadow-sm rounded-4 border-top border-danger border-4" style={{ background: "rgba(30, 41, 59, 0.5)", backdropFilter: "blur(10px)" }}>
            <div className="card-body p-4">
              <h5 className="fw-bold text-white mb-4"><i className="bi bi-shield-lock me-2 text-danger"></i>Admin Actions</h5>
              
              <div className="d-grid gap-3">
                <button className="btn btn-outline-light text-start p-3 rounded-3 d-flex align-items-center justify-content-between" onClick={resetPassword} disabled={busy}>
                  <span><i className="bi bi-key me-2"></i> Reset Owner Password</span>
                  <i className="bi bi-chevron-right text-secondary"></i>
                </button>
                
                <button 
                  className={`btn text-start p-3 rounded-3 d-flex align-items-center justify-content-between ${shop.is_active ? 'btn-outline-warning' : 'btn-outline-success'}`}
                  onClick={toggle} 
                  disabled={busy}
                >
                  <span>
                    <i className={`bi ${shop.is_active ? 'bi-pause-circle' : 'bi-play-circle'} me-2`}></i> 
                    {shop.is_active ? "Suspend Shop Access" : "Activate Shop Access"}
                  </span>
                </button>

                <button 
                  className="btn btn-outline-danger text-start p-3 rounded-3 d-flex align-items-center justify-content-between" 
                  onClick={deleteShop} 
                  disabled={busy || !shop.can_delete}
                  title={!shop.can_delete ? "Shop must be suspended for cool-off period before deletion." : ""}
                >
                  <span><i className="bi bi-trash3 me-2"></i> Delete Permanently</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
