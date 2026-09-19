"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, fetchAll } from "@/lib/api";
import { startImpersonation } from "@/lib/impersonation";
import { EmptyRow, ErrorState, PageHeader, Spinner, fmtDate } from "@/components/ui";
import toast from "react-hot-toast";

type Shop = {
  id: number;
  shop_code?: string;
  name: string;
  business_type: string;
  plan_tier: string | null;
  is_active: boolean;
  is_test?: boolean;
  is_demo?: boolean;
  is_free?: boolean;
  manufacturing_enabled?: boolean;
  mobile_repair_enabled?: boolean;
  user_count: number;
  owner_email: string | null;
  can_delete: boolean;
  days_suspended: number;
  created_at: string;
  subscription_info?: {
    state: "trial" | "paid" | "expired" | "none" | "free";
    plan_tier: string | null;
    ends_at: string | null;
    days_left: number;
    status: string | null;
  };
};

const TYPE_LABELS: Record<string, string> = {
  general: "General Retail",
  supershop: "Super Shop & Grocery",
  printing: "Printing, Media & Online Services",
  cosmetics: "Cosmetics & Beauty",
  camical: "Chemical & Lab Supplies",
  electronics: "Electronics & Gadgets",
  computer: "Computer & IT",
  mobile: "Mobile & Accessories",
  fashion: "Fashion & Apparel",
  handcrafts: "Handcrafts & Boutique",
  other: "Other"
};

const COOLOFF_DAYS = 15;

export default function ShopsPage() {
  const { lang, t } = useLanguage();
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "live" | "demo" | "test">("all");
  const [busy, setBusy] = useState<number | null>(null);
  const [pwFor, setPwFor] = useState<Shop | null>(null);
  const [delFor, setDelFor] = useState<Shop | null>(null);
  const [editCatFor, setEditCatFor] = useState<Shop | null>(null);

  const updateCategory = async (shop_id: number, new_type: string) => {
    setBusy(shop_id);
    setEditCatFor(null);
    try {
      await api(`/platform/shops/${shop_id}/`, { method: "PATCH", body: { business_type: new_type } });
      toast.success("Shop category updated!");
      await load();
    } catch(err: any) {
      toast.error(err?.message || "Failed to update category.");
    } finally {
      setBusy(null);
    }
  };

  const load = useCallback(async () => {
    try {
      const data = await fetchAll<Shop>("/platform/shops/");
      setShops(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load shops.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    if (!shops) return { all: 0, live: 0, demo: 0, test: 0 };
    const demo = shops.filter(x => x.is_demo).length;
    const test = shops.filter(x => x.is_test && !x.is_demo).length;
    const live = shops.filter(x => !x.is_demo && !x.is_test).length;
    return { all: shops.length, live, demo, test };
  }, [shops]);

  const filtered = useMemo(() => {
    if (!shops) return [];
    
    // Filter by active tab (Separate Demo, Test, Live)
    let list = shops;
    if (tab === "live") {
      list = shops.filter(x => !x.is_demo && !x.is_test);
    } else if (tab === "demo") {
      list = shops.filter(x => x.is_demo);
    } else if (tab === "test") {
      list = shops.filter(x => x.is_test && !x.is_demo);
    }

    // Filter by search query
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((x) => {
      const code = (x.shop_code || `SW-${1000 + x.id}`).toLowerCase();
      const idStr = String(x.id);
      return x.name.toLowerCase().includes(s) || code.includes(s) || idStr.includes(s);
    });
  }, [shops, tab, q]);

  const loginAs = useCallback(async (shop: Shop) => {
    try {
      const t = await api<{ access: string; refresh: string; shop_name: string }>(
        `/platform/shops/${shop.id}/login-as/`, { method: "POST" });
      startImpersonation(t);
    } catch (e: any) {
      toast.error(e?.message || "Could not log in as this shop.");
    }
  }, []);

  const toggle = useCallback(async (shop: Shop) => {
    setBusy(shop.id);
    try {
      await api(`/platform/shops/${shop.id}/${shop.is_active ? "suspend" : "activate"}/`, { method: "POST" });
      await load();
      toast.success(shop.is_active ? "Shop suspended" : "Shop activated");
    } catch (e: any) {
      toast.error(e?.message || "Action failed.");
    } finally {
      setBusy(null);
    }
  }, [load]);

  const toggleDemo = useCallback(async (shop: Shop) => {
    setBusy(shop.id);
    try {
      const r = await api<{ is_demo: boolean; is_test: boolean }>(`/platform/shops/${shop.id}/toggle-demo/`, { method: "POST" });
      await load();
      toast.success(r.is_demo ? "Marked as Demo shop (moved to Demo tab)" : "Unmarked from Demo shop");
    } catch (e: any) {
      toast.error(e?.message || "Action failed.");
    } finally {
      setBusy(null);
    }
  }, [load]);

  const toggleTest = useCallback(async (shop: Shop) => {
    setBusy(shop.id);
    try {
      const r = await api<{ is_test: boolean }>(`/platform/shops/${shop.id}/toggle-test/`, { method: "POST" });
      await load();
      toast.success(r.is_test ? "Marked as Test shop (moved to Test tab)" : "Unmarked from Test shop");
    } catch (e: any) {
      toast.error(e?.message || "Action failed.");
    } finally {
      setBusy(null);
    }
  }, [load]);

  if (error) return <ErrorState error={error} />;
  if (!shops) return <Spinner />;

  return (
    <>
      <PageHeader
        title="All Shops"
        actions={<Link href="/platform/shops/new" className="btn btn-brand btn-sm">{lang === "bn" ? "+ নতুন শপ তৈরি" : "+ Create shop"}</Link>}
      />

      {/* ── Separate Live, Demo, and Test Shops Tabs ── */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
        <div className="btn-group p-1 bg-body-tertiary rounded-pill shadow-sm border" role="group">
          {/* All Shops Tab */}
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 fw-semibold ${tab === "all" ? "btn-brand shadow-sm text-white" : "btn-light border-0 text-secondary"}`}
            onClick={() => setTab("all")}
          >
            <i className="bi bi-shop me-1"></i>
            {lang === "bn" ? "সকল শপ" : "All Shops"}
            <span className={`badge ms-2 rounded-pill ${tab === "all" ? "bg-white text-dark" : "bg-secondary bg-opacity-25 text-body"}`}>
              {counts.all}
            </span>
          </button>

          {/* Live Merchant Shops Tab */}
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 fw-semibold ${tab === "live" ? "btn-success shadow-sm text-white" : "btn-light border-0 text-secondary"}`}
            onClick={() => setTab("live")}
          >
            <i className="bi bi-check-circle-fill me-1"></i>
            {lang === "bn" ? "মার্চেন্ট শপ (লাইভ)" : "Live Merchants"}
            <span className={`badge ms-2 rounded-pill ${tab === "live" ? "bg-white text-success" : "bg-success bg-opacity-25 text-success"}`}>
              {counts.live}
            </span>
          </button>

          {/* Demo Shops Tab */}
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 fw-semibold ${tab === "demo" ? "btn-warning shadow-sm text-dark" : "btn-light border-0 text-secondary"}`}
            onClick={() => setTab("demo")}
          >
            <i className="bi bi-eye-fill me-1"></i>
            {lang === "bn" ? "ডেমো শপ" : "Demo Shops"}
            <span className={`badge ms-2 rounded-pill ${tab === "demo" ? "bg-dark text-white" : "bg-warning bg-opacity-25 text-body"}`}>
              {counts.demo}
            </span>
          </button>

          {/* Test Shops Tab */}
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 fw-semibold ${tab === "test" ? "btn-info shadow-sm text-white" : "btn-light border-0 text-secondary"}`}
            onClick={() => setTab("test")}
          >
            <i className="bi bi-flask-fill me-1"></i>
            {lang === "bn" ? "টেস্ট শপ" : "Test Shops"}
            <span className={`badge ms-2 rounded-pill ${tab === "test" ? "bg-white text-dark" : "bg-info bg-opacity-25 text-body"}`}>
              {counts.test}
            </span>
          </button>
        </div>

        <div className="text-secondary small">
          {tab === "live" && (lang === "bn" ? "⚡ শুধুমাত্র মূল ক্লায়েন্ট/মার্চেন্ট শপগুলো প্রদর্শিত হচ্ছে" : "⚡ Showing real client merchant stores")}
          {tab === "demo" && (lang === "bn" ? "🧪 শুধুমাত্র পাবলিক ডেমো স্টোরগুলো প্রদর্শিত হচ্ছে" : "🧪 Showing public demo stores")}
          {tab === "test" && (lang === "bn" ? "🔬 শুধুমাত্র টেস্ট/পরীক্ষামূলক শপগুলো প্রদর্শিত হচ্ছে (রেভিনিউ থেকে বাদ)" : "🔬 Showing internal test stores (excluded from revenue)")}
          {tab === "all" && (lang === "bn" ? "🏬 প্ল্যাটফর্মের সব দোকান একসাথে প্রদর্শিত হচ্ছে" : "🏬 Showing all registered shops")}
        </div>
      </div>

      <input
        className="form-control mb-3 shadow-sm"
        placeholder={lang === "bn" ? "নাম বা ইউনিক শপ আইডি দিয়ে খুঁজুন (যেমন: SW-1001 বা রকি টেলিকম)…" : "Filter shops by name or unique ID (e.g. SW-1001 or Fast Electronics)…"}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="thead-1">
              <tr>
                <th>{lang === "bn" ? "ইউনিক আইডি" : "Unique ID"}</th>
                <th>{lang === "bn" ? "দোকান / ব্যবসা" : "Shop"}</th>
                <th>{lang === "bn" ? "মোড / ধরন" : "Mode"}</th>
                <th>{lang === "bn" ? "ক্যাটাগরি" : "Category"}</th>
                <th>{lang === "bn" ? "প্যাকেজ" : "Plan"}</th>
                <th>{lang === "bn" ? "ব্যবহারকারী" : "Users"}</th>
                <th>setStatus</th>
                <th>{lang === "bn" ? "তৈরির তারিখ" : "Created"}</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <EmptyRow
                  cols={9}
                  text={
                    tab === "demo"
                      ? "কোনো ডেমো শপ পাওয়া যায়নি।"
                      : tab === "test"
                      ? "কোনো টেস্ট শপ পাওয়া যায়নি।"
                      : tab === "live"
                      ? "কোনো মার্চেন্ট শপ ফিল্টারের সাথে মেলেনি।"
                      : "No shops match your filter."
                  }
                />
              )}
              {filtered.map((s) => (
                <tr key={s.id} className={s.is_demo ? "table-warning-subtle" : s.is_test ? "table-info-subtle" : ""}>
                  <td>
                    <span className="badge rounded-pill bg-primary-subtle text-primary border border-primary-subtle font-monospace px-2.5 py-1 fw-bold" style={{ fontSize: "11px" }}>
                      {s.shop_code || `SW-${1000 + s.id}`}
                    </span>
                  </td>
                  <td className="fw-semibold">
                    <div className="d-flex flex-column">
                      <Link href={`/platform/shops/${s.id}`} className="text-decoration-none fw-bold hover-underline" style={{ color: "var(--text-body, #0f172a)", fontSize: "0.92rem" }}>
                        {s.name}
                      </Link>
                      {s.owner_email && (
                        <span className="font-monospace mt-0.5" style={{ fontSize: "0.76rem", color: "#64748b" }}>
                          {s.owner_email}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="d-flex flex-nowrap align-items-center">
                      {s.is_demo ? (
                        <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2.5 py-1 fw-bold" style={{ whiteSpace: "nowrap", fontSize: "11px" }} title="Public Demo Store">
                          🧪 Demo
                        </span>
                      ) : s.is_test ? (
                        <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle px-2.5 py-1 fw-bold" style={{ whiteSpace: "nowrap", fontSize: "11px" }} title="Internal Test Store (Excluded from Revenue)">
                          🔬 Test
                        </span>
                      ) : (
                        <span className="badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1 fw-bold" style={{ whiteSpace: "nowrap", fontSize: "11px" }} title="Live Client Merchant Store">
                          🟢 Live Client
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <span className="fw-medium" style={{ color: "var(--text-body, #0f172a)" }}>{TYPE_LABELS[s.business_type] || s.business_type}</span>
                      <button onClick={() => setEditCatFor(s)} className="btn btn-sm btn-link p-0 text-secondary" disabled={busy === s.id} title="Change Category">
                        <i className="bi bi-pencil-square"></i>
                      </button>
                    </div>
                  </td>
                  <td>
                    {s.subscription_info ? (
                      <div className="d-flex flex-column gap-1">
                        <div className="d-flex align-items-center gap-2">
                          <span className="fw-bold text-capitalize" style={{ color: "var(--text-body, #0f172a)" }}>
                            {s.subscription_info.plan_tier || "—"}
                          </span>
                          {s.manufacturing_enabled && (<span className="badge bg-info-subtle text-info-emphasis border border-info-subtle me-1" style={{ fontSize: "0.65rem" }}>🏭 Mfg</span>)}
                          {s.mobile_repair_enabled && (<span className="badge bg-primary-subtle text-primary border border-primary-subtle me-1" style={{ fontSize: "0.65rem" }}>🛠️ Repair</span>)}
                          {s.subscription_info.state === "free" && (
                            <span className="badge bg-success-subtle text-success border border-success-subtle fw-bold" style={{ fontSize: '0.7rem' }}>🎁 Free</span>
                          )}
                          {s.is_free && s.subscription_info.state !== "free" && (
                            <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle fw-bold" style={{ fontSize: '0.7rem' }} title="Free grant is paused because the reseller is inactive — shop must pay">🎁 Free (paused)</span>
                          )}
                          {s.subscription_info.state === "trial" && (
                            <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle fw-bold" style={{ fontSize: '0.7rem' }}>Trial</span>
                          )}
                          {s.subscription_info.state === "expired" && (
                            <span className="badge bg-danger-subtle text-danger border border-danger-subtle fw-bold" style={{ fontSize: '0.7rem' }}>Expired</span>
                          )}
                        </div>
                        {s.subscription_info.ends_at && (
                          <div className="d-flex align-items-center gap-1" style={{ fontSize: '0.8rem' }}>
                            <span className={s.subscription_info.days_left < 7 ? "text-danger fw-bold" : "text-muted"} style={{ color: s.subscription_info.days_left < 7 ? undefined : "#64748b" }}>
                              {s.subscription_info.days_left} days left
                            </span>
                            <span className="text-secondary opacity-50">•</span>
                            <span style={{ color: "#64748b" }}>
                              {fmtDate(s.subscription_info.ends_at)}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="fw-medium" style={{ color: "var(--text-body, #0f172a)" }}>{s.plan_tier || "—"}</span>
                    )}
                  </td>
                  <td><span className="fw-semibold" style={{ color: "var(--text-body, #0f172a)" }}>{s.user_count}</span></td>
                  <td>
                    {s.is_active
                      ? <span className="badge bg-success-subtle text-success border border-success-subtle fw-bold px-2 py-1">Active</span>
                      : <span className="badge bg-danger-subtle text-danger border border-danger-subtle fw-bold px-2 py-1">Suspended{s.days_suspended ? ` · ${s.days_suspended}d` : ""}</span>}
                  </td>
                  <td className="text-nowrap" style={{ color: "#475569", fontSize: "0.82rem" }}>{fmtDate(s.created_at)}</td>
                  <td>
                    <div className="d-flex flex-wrap gap-1 justify-content-end">
                      <button className="btn btn-brand btn-sm py-0" onClick={() => loginAs(s)} title="Login directly into this shop's dashboard">Login as</button>
                      <button className="btn btn-outline-secondary btn-sm py-0" onClick={() => setPwFor(s)}>Owner pw</button>
                      
                      {/* Demo Toggle Button */}
                      <button
                        className={`btn btn-sm py-0 ${s.is_demo ? "btn-warning text-dark" : "btn-outline-secondary"}`}
                        disabled={busy === s.id}
                        onClick={() => toggleDemo(s)}
                        title={s.is_demo ? "Unmark Demo (move out of Demo tab)" : "Mark as Demo (move to Demo tab)"}
                      >
                        {s.is_demo ? "Demo ✓" : "Demo"}
                      </button>

                      {/* Test Toggle Button */}
                      <button
                        className={`btn btn-sm py-0 ${s.is_test && !s.is_demo ? "btn-info text-white" : "btn-outline-secondary"}`}
                        disabled={busy === s.id}
                        onClick={() => toggleTest(s)}
                        title={s.is_test ? "Unmark Test (move to Live Merchants)" : "Mark as Test (move to Test tab)"}
                      >
                        {s.is_test && !s.is_demo ? "Test ✓" : "Test"}
                      </button>

                      <button
                        className={`btn btn-sm py-0 ${s.is_active ? "btn-outline-danger" : "btn-outline-success"}`}
                        disabled={busy === s.id}
                        onClick={() => toggle(s)}
                      >
                        {s.is_active ? "Suspend" : "Activate"}
                      </button>
                      <button
                        className="btn btn-outline-danger btn-sm py-0"
                        disabled={busy === s.id || !s.can_delete}
                        title={s.can_delete ? "Permanent delete" : `Must be suspended for ${COOLOFF_DAYS} days before deletion (${COOLOFF_DAYS - (s.days_suspended || 0)}d remaining)`}
                        onClick={() => setDelFor(s)}
                      >
                        <i className="bi bi-trash3"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Owner Password Modal ── */}
      {pwFor && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-body border-bottom">
                <h5 className="modal-title h6 fw-bold text-body">
                  {lang === "bn" ? `মালিকের পাসওয়ার্ড: ${pwFor.name}` : `Owner Password: ${pwFor.name}`}
                </h5>
                <button type="button" className="btn-close" onClick={() => setPwFor(null)} />
              </div>
              <div className="modal-body">
                <p className="text-secondary small mb-3">
                  {lang === "bn"
                    ? "সুপারএডমিন হিসেবে আপনি এই দোকানের ওনার পাসওয়ার্ড দেখতে এবং নতুন পাসওয়ার্ড সেট করতে পারেন।"
                    : "As superadmin you can view and reset the owner's password."}
                </p>
                <div className="mb-3">
                  <label className="form-label text-secondary small">{lang === "bn" ? "ওনার ইমেইল / ইউজারনেম" : "Owner Email / Username"}</label>
                  <input className="form-control" readOnly value={pwFor.owner_email || "N/A"} />
                </div>
                <div className="d-flex justify-content-end gap-2">
                  <button className="btn btn-secondary btn-sm" onClick={() => setPwFor(null)}>
                    {lang === "bn" ? "বন্ধ করুন" : "Close"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal ── */}
      {delFor && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title h6 fw-bold">Delete Shop Permanently</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setDelFor(null)} />
              </div>
              <div className="modal-body">
                <p className="text-body mb-2">Are you sure you want to permanently delete <strong>{delFor.name}</strong> ({delFor.shop_code || `SW-${1000 + delFor.id}`})?</p>
                <p className="text-danger small mb-0">This action is irreversible. All inventory, sales, and accounts for this shop will be deleted.</p>
              </div>
              <div className="modal-footer border-top">
                <button className="btn btn-secondary btn-sm" onClick={() => setDelFor(null)}>Cancel</button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={async () => {
                    setBusy(delFor.id);
                    setDelFor(null);
                    try {
                      await api(`/platform/shops/${delFor.id}/`, { method: "DELETE" });
                      toast.success("Shop deleted permanently.");
                      await load();
                    } catch (e: any) {
                      toast.error(e?.message || "Delete failed.");
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Category Modal ── */}
      {editCatFor && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-body border-bottom">
                <h5 className="modal-title h6 fw-bold text-body">
                  {lang === "bn" ? `ক্যাটাগরি পরিবর্তন: ${editCatFor.name}` : `Change Category: ${editCatFor.name}`}
                </h5>
                <button type="button" className="btn-close" onClick={() => setEditCatFor(null)} />
              </div>
              <div className="modal-body">
                <label className="form-label text-secondary small">{lang === "bn" ? "নতুন বিজনেস টাইপ নির্বাচন করুন" : "Select Business Type"}</label>
                <select
                  className="form-select mb-3"
                  defaultValue={editCatFor.business_type}
                  id="cat-select"
                >
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <div className="d-flex justify-content-end gap-2">
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditCatFor(null)}>
                    {lang === "bn" ? "বাতিল" : "Cancel"}
                  </button>
                  <button
                    className="btn btn-brand btn-sm"
                    onClick={() => {
                      const sel = (document.getElementById("cat-select") as HTMLSelectElement)?.value;
                      if (sel && editCatFor) updateCategory(editCatFor.id, sel);
                    }}
                  >
                    {lang === "bn" ? "সংরক্ষণ করুন" : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
