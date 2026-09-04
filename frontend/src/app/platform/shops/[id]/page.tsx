"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { startImpersonation } from "@/lib/impersonation";
import { ErrorState, PageHeader, Spinner, fmtDate } from "@/components/ui";
import toast from "react-hot-toast";
import { useLanguage } from "@/contexts/LanguageContext";

type Shop = {
  id: number;
  shop_code?: string;
  name: string;
  business_type: string;
  phone: string;
  email: string;
  address: string;
  plan_tier: string | null;
  is_active: boolean;
  is_test?: boolean;
  is_free?: boolean;
  manufacturing_enabled?: boolean;
  user_count: number;
  owner_email: string | null;
  owner_full_name: string | null;
  can_delete: boolean;
  days_suspended: number;
  created_at: string;
  trial_ends_at: string | null;
  subscription?: SubInfo;
  plans?: Plan[];
};

type SubInfo = {
  state: "trial" | "paid" | "expired" | "none";
  plan_tier: string | null;
  ends_at: string | null;
  days_left: number;
  status: string | null;
};

type Plan = { id: number; name: string; tier: string; price_monthly: string };

const DURATIONS = [
  { label: "1 month", days: 30 },
  { label: "3 months", days: 90 },
  { label: "6 months", days: 180 },
  { label: "1 year", days: 365 },
];

const TYPE_LABELS: Record<string, string> = {
  electronics: "Electronics",
  computer: "Computer",
  mobile: "Mobile & Accessories",
  general: "General Retail",
  camical: "Chemical & Lab Supplies",
    supershop: "Super Shop & Grocery",
  cosmetics: "Cosmetics & Beauty",
};

export default function ShopDetailsPage() {
  const { lang, t } = useLanguage();
  const { id } = useParams() as { id: string };
  const router = useRouter();
  
  const [shop, setShop] = useState<Shop | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Manage-plan form
  const [planId, setPlanId] = useState<string>("");
  const [days, setDays] = useState<string>("30");
  const [amount, setAmount] = useState<string>("");
  const [showTrialChoice, setShowTrialChoice] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<Shop>(`/platform/shops/${id}/`);
      setShop(data);
      if (data.plans && data.plans.length) {
        const preferred =
          data.plans.find((p) => p.tier === data.subscription?.plan_tier) ||
          data.plans.find((p) => p.tier === "professional") ||
          data.plans[0];
        setPlanId(String(preferred.id));
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load shop details.");
    }
  }, [id]);

  const grantPlan = useCallback(async (stack: boolean) => {
    if (!shop) return;
    setShowTrialChoice(false);
    setBusy(true);
    try {
      const res = await api<{ invoice_number: string }>(
        `/platform/shops/${shop.id}/grant-plan/`,
        { method: "POST", body: { plan: planId || undefined, days: parseInt(days) || 30, amount: amount || 0, cycle: "monthly", add_remaining: stack } }
      );
      toast.success(`Plan activated — invoice ${res.invoice_number} emailed to the owner.`);
      await load();
    } catch (e: any) {
      toast.error(e?.data?.detail || e?.message || "Failed to activate plan.");
    } finally {
      setBusy(false);
    }
  }, [shop, planId, days, amount, load]);

  // On-trial shops: clicking Activate asks whether to keep the remaining trial
  // days on top of the paid plan, or start the paid period fresh.
  const onActivateClick = useCallback(() => {
    if (!shop) return;
    if (shop.subscription?.state === "trial") { setShowTrialChoice(true); return; }
    grantPlan(true);
  }, [shop, grantPlan]);

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

  const toggleManufacturing = useCallback(async () => {
    if (!shop) return;
    setBusy(true);
    try {
      const nextVal = !shop.manufacturing_enabled;
      await api(`/platform/shops/${shop.id}/`, {
        method: "PATCH",
        body: { manufacturing_enabled: nextVal },
      });
      setShop((prev) => prev ? { ...prev, manufacturing_enabled: nextVal } : null);
      toast.success(nextVal ? "🏭 Manufacturing & Production module ENABLED for this shop!" : "Manufacturing module disabled.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update manufacturing feature.");
    } finally {
      setBusy(false);
    }
  }, [shop]);

  const toggleFree = useCallback(async () => {
    if (!shop) return;
    setBusy(true);
    try {
      await api(`/platform/shops/${shop.id}/toggle-free/`, { method: "POST" });
      await load();
      toast.success(shop.is_free ? "Free access removed — shop must pay now." : "Shop granted lifetime-free access.");
    } catch (e: any) {
      toast.error(e?.message || "Action failed.");
    } finally {
      setBusy(false);
    }
  }, [shop]);

  const toggleTest = useCallback(async () => {
    if (!shop) return;
    setBusy(true);
    try {
      const r = await api<{ is_test: boolean }>(`/platform/shops/${shop.id}/toggle-test/`, { method: "POST" });
      await load();
      toast.success(r.is_test ? "Marked as test shop — excluded from revenue." : "Marked as live shop.");
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
            <span className="badge bg-primary bg-opacity-25 text-primary border border-primary border-opacity-25 rounded-pill px-3 py-1 fs-6 font-monospace">
              {shop.shop_code || `SW-${1000 + shop.id}`}
            </span>
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
              <h5 className="fw-bold text-white mb-4"><i className="bi bi-shop me-2 text-brand"></i>{lang === "bn" ? "দোকানের সাধারণ তথ্য" : "Shop Information"}</h5>
              
              <div className="row g-4">
                <div className="col-md-6">
                  <div className="p-3 rounded-3" style={{ background: "rgba(15, 23, 42, 0.4)" }}>
                    <p className="text-secondary small mb-1">{lang === "bn" ? "ইউনিক শপ আইডি" : "Unique Shop ID"}</p>
                    <p className="fw-bold text-brand mb-0 font-monospace fs-5">{shop.shop_code || `SW-${1000 + shop.id}`}</p>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="p-3 rounded-3" style={{ background: "rgba(15, 23, 42, 0.4)" }}>
                    <p className="text-secondary small mb-1">{lang === "bn" ? "ব্যবসার ধরন" : "Business Type"}</p>
                    <p className="fw-medium text-white mb-0">{TYPE_LABELS[shop.business_type] || shop.business_type}</p>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="p-3 rounded-3" style={{ background: "rgba(15, 23, 42, 0.4)" }}>
                    <p className="text-secondary small mb-1">{lang === "bn" ? "যোগাযোগের নম্বর" : "Contact Phone"}</p>
                    <p className="fw-medium text-white mb-0">{shop.phone || "—"}</p>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="p-3 rounded-3" style={{ background: "rgba(15, 23, 42, 0.4)" }}>
                    <p className="text-secondary small mb-1">{lang === "bn" ? "অফিসিয়াল ইমেইল" : "Public Email"}</p>
                    <p className="fw-medium text-white mb-0">{shop.email || "—"}</p>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="p-3 rounded-3" style={{ background: "rgba(15, 23, 42, 0.4)" }}>
                    <p className="text-secondary small mb-1">{lang === "bn" ? "মোট ব্যবহারকারী" : "Total Users"}</p>
                    <p className="fw-medium text-white mb-0">{shop.user_count} User(s)</p>
                  </div>
                </div>
                <div className="col-12">
                  <div className="p-3 rounded-3" style={{ background: "rgba(15, 23, 42, 0.4)" }}>
                    <p className="text-secondary small mb-1">{lang === "bn" ? "ঠিকানা" : "Physical Address"}</p>
                    <p className="fw-medium text-white mb-0">{shop.address || "No address provided"}</p>
                  </div>
                </div>
              </div>

                            <hr className="border-secondary my-4 opacity-25" />

              <h5 className="fw-bold text-white mb-3"><i className="bi bi-toggles me-2 text-primary"></i>Module Controls & Features</h5>
              <div className="d-flex align-items-center justify-content-between p-3 rounded-3 mb-3" style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
                <div className="d-flex align-items-center gap-3">
                  <div className="p-2 rounded-circle bg-primary bg-opacity-25 text-primary fs-4">
                    <i className="bi bi-gear-wide-connected"></i>
                  </div>
                  <div>
                    <h6 className="text-white fw-bold mb-0">Manufacturing & Batch Production</h6>
                    <p className="text-secondary small mb-0">Enable 2-step dynamic yield production batches, raw material deductions, and automatic unit cost calculation.</p>
                  </div>
                </div>
                <div className="form-check form-switch fs-4 mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    checked={!!shop.manufacturing_enabled}
                    disabled={busy}
                    onChange={toggleManufacturing}
                    style={{ cursor: "pointer" }}
                  />
                </div>
              </div>

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

              {(() => {
                const sub = shop.subscription;
                const state = sub?.state ?? (shop.trial_ends_at ? "trial" : "none");
                const badge =
                  state === "paid" ? { c: "success", t: "PRO ACTIVE" } :
                  state === "trial" ? { c: "info", t: "ON TRIAL" } :
                  state === "expired" ? { c: "danger", t: "EXPIRED" } :
                  { c: "secondary", t: "NO PLAN" };
                const daysLeft = sub?.days_left ?? 0;
                return (
                  <>
                    <div className="mb-3 d-flex align-items-center gap-2">
                      <span className={`badge bg-${badge.c} bg-opacity-25 text-${badge.c} border border-${badge.c} border-opacity-25 px-3 py-2 rounded-3`}>{badge.t}</span>
                      <span className="badge bg-secondary px-3 py-2 rounded-3 text-uppercase">{(sub?.plan_tier || shop.plan_tier) || "Free"}</span>
                    </div>
                    {(state === "trial" || state === "paid" || state === "expired") && (
                      <div className="mb-3">
                        <p className="text-secondary small mb-1">{state === "expired" ? "Expired on" : (state === "trial" ? "Trial ends" : "Renews / expires")}</p>
                        <p className="fw-medium text-white mb-0">
                          {fmtDate(sub?.ends_at || shop.trial_ends_at)}
                          {state !== "expired" && (
                            <span className={`ms-2 badge bg-${daysLeft <= 5 ? "danger" : "success"} bg-opacity-25 text-${daysLeft <= 5 ? "danger" : "success"}`}>
                              {daysLeft} day{daysLeft === 1 ? "" : "s"} left
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                    <div className="mb-2">
                      <p className="text-secondary small mb-1">Registered On</p>
                      <p className="fw-medium text-white mb-0">{fmtDate(shop.created_at)}</p>
                    </div>
                  </>
                );
              })()}

              <hr className="border-secondary my-3 opacity-25" />

              {/* Manage plan */}
              {shop.is_free ? (
              <div className="p-3 rounded-3 text-center" style={{ background: "rgba(34,197,94,.12)" }}>
                <div className="fs-4">🎁</div>
                <div className="fw-semibold text-success">Lifetime-free shop</div>
                <div className="small text-secondary">Paid plans and billing don’t apply. Remove free access below to start charging this shop.</div>
              </div>
              ) : (
              <>
              <p className="text-secondary small mb-2 fw-semibold"><i className="bi bi-gear me-1"></i>Activate / Renew Plan</p>
              <p className="text-secondary small mb-2" style={{ fontSize: "0.72rem" }}>
                Renewing before expiry <b>adds</b> the days on top of the remaining time. An invoice is emailed to the owner.
              </p>

              <label className="form-label small text-secondary mb-1">Plan</label>
              <select className="form-select form-select-sm mb-2" value={planId} onChange={(e) => setPlanId(e.target.value)}>
                {(shop.plans || []).map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.tier})</option>
                ))}
              </select>

              <label className="form-label small text-secondary mb-1">Duration</label>
              <div className="d-flex flex-wrap gap-1 mb-2">
                {DURATIONS.map((d) => (
                  <button key={d.days} type="button"
                    className={`btn btn-sm ${String(d.days) === days ? "btn-primary" : "btn-outline-secondary"}`}
                    onClick={() => setDays(String(d.days))}>{d.label}</button>
                ))}
              </div>
              <div className="input-group input-group-sm mb-2">
                <input type="number" min={1} className="form-control" value={days} onChange={(e) => setDays(e.target.value)} />
                <span className="input-group-text">days</span>
              </div>

              <label className="form-label small text-secondary mb-1">Amount received (optional)</label>
              <div className="input-group input-group-sm mb-3">
                <span className="input-group-text">৳</span>
                <input type="number" min={0} className="form-control" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>

              <button className="btn btn-success w-100 rounded-3" onClick={onActivateClick} disabled={busy || !planId}>
                {busy ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-check2-circle me-2" />}
                {shop.subscription?.state === "paid" ? "Renew / Extend" : "Activate Plan"}
              </button>
              </>
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
                  className={`btn text-start p-3 rounded-3 d-flex align-items-center justify-content-between ${shop.is_free ? "btn-success" : "btn-outline-success"}`}
                  onClick={toggleFree}
                  disabled={busy}
                  title="Free shops bypass billing while active and add no platform revenue"
                >
                  <span>
                    <i className="bi bi-gift me-2"></i>
                    {shop.is_free ? "Remove Free Access (start charging)" : "Grant Lifetime-Free Access"}
                  </span>
                  {shop.is_free && <span className="badge bg-light text-success">FREE</span>}
                </button>

                <button
                  className={`btn text-start p-3 rounded-3 d-flex align-items-center justify-content-between ${shop.is_test ? "btn-outline-secondary" : "btn-outline-info"}`}
                  onClick={toggleTest}
                  disabled={busy}
                  title="Test shops are excluded from platform revenue totals"
                >
                  <span>
                    <i className="bi bi-cone-striped me-2"></i>
                    {shop.is_test ? "Unmark Test Shop (count revenue)" : "Mark as Test Shop (exclude revenue)"}
                  </span>
                  {shop.is_test && <span className="badge bg-secondary">TEST</span>}
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

      {/* Trial-day choice when activating a plan on a trialing shop */}
      {showTrialChoice && shop && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ zIndex: 100000, background: "rgba(0,0,0,.55)" }} onClick={() => setShowTrialChoice(false)}>
          <div className="bg-body rounded-4 shadow-lg p-4" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <h5 className="fw-bold mb-2">Activate plan</h5>
            <p className="text-secondary mb-3">
              This shop still has <b>{shop.subscription?.days_left ?? 0} trial day(s)</b> left.
              How should the {parseInt(days) || 30}-day plan start?
            </p>
            <div className="vstack gap-2">
              <button className="btn btn-success text-start p-3 rounded-3" disabled={busy} onClick={() => grantPlan(true)}>
                <div className="fw-semibold"><i className="bi bi-plus-circle me-2"></i>Add trial days on top</div>
                <div className="small opacity-75">Keep the remaining trial — the plan starts after it ends (extend).</div>
              </button>
              <button className="btn btn-outline-primary text-start p-3 rounded-3" disabled={busy} onClick={() => grantPlan(false)}>
                <div className="fw-semibold"><i className="bi bi-calendar-check me-2"></i>Start fresh — {parseInt(days) || 30} days from today</div>
                <div className="small opacity-75">Ignore the remaining trial; the paid period begins now.</div>
              </button>
              <button className="btn btn-link text-secondary" disabled={busy} onClick={() => setShowTrialChoice(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
