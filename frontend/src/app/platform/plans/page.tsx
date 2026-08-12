"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { ErrorState, PageHeader, Spinner } from "@/components/ui";
import toast from "react-hot-toast";

type Plan = {
  id: number;
  name: string;
  tier: string;
  price_monthly: string | number;
  price_yearly: string | number;
  max_users: number;
  max_branches: number;
  max_products: number;
  features: Record<string, boolean>;
  highlights: string[];
  show_users: boolean;
  show_branches: boolean;
  show_products: boolean;
  is_active: boolean;
};

type Offer = { enabled: boolean; url: string | null; is_pdf: boolean };

type Content = Record<string, string>;
const CONTENT_FIELDS: { key: string; label: string; hint?: string }[] = [
  { key: "hero_title", label: "Hero title" },
  { key: "hero_subtitle", label: "Hero subtitle" },
  { key: "trial_badge", label: "Trial badge", hint: "Use {days} for the trial length" },
  { key: "features_heading", label: "Features heading" },
  { key: "cta_label", label: "Button text" },
  { key: "popular_badge", label: "'Most Popular' badge text" },
];

const TIER_LABEL: Record<string, string> = {
  free: "Free", basic: "Basic", professional: "Professional (Most Popular)", enterprise: "Enterprise",
};

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [keys, setKeys] = useState<string[]>([]);
  const [tiers, setTiers] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);

  // Offer state
  const [offer, setOffer] = useState<Offer>({ enabled: false, url: null, is_pdf: false });
  const [offerBusy, setOfferBusy] = useState(false);
  const offerInput = useRef<HTMLInputElement>(null);

  const [content, setContent] = useState<Content>({});
  const [savingContent, setSavingContent] = useState(false);

  async function loadAll() {
    try {
      const [p, o, c] = await Promise.all([
        api<{ plans: Plan[]; feature_keys: string[]; tiers: string[] }>("/platform/plans-manage/"),
        api<Offer>("/platform/promo-offer/").catch(() => ({ enabled: false, url: null, is_pdf: false })),
        api<{ pricing_content: Content }>("/platform/pricing-content/").catch(() => ({ pricing_content: {} })),
      ]);
      setPlans(p.plans); setKeys(p.feature_keys); setTiers(p.tiers); setOffer(o);
      setContent(c.pricing_content || {});
      setLoaded(true);
    } catch (e: any) { setError(e?.message || "Failed to load plans."); }
  }

  async function saveContent() {
    setSavingContent(true);
    try {
      const d = await api<{ pricing_content: Content }>("/platform/pricing-content/", {
        method: "PUT", body: { pricing_content: content },
      });
      setContent(d.pricing_content);
      toast.success("Pricing page text saved.");
    } catch { toast.error("Failed to save text."); }
    finally { setSavingContent(false); }
  }
  useEffect(() => { loadAll(); }, []);

  function upd(id: number, patch: Partial<Plan>) {
    setPlans((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function toggleFeature(id: number, k: string) {
    setPlans((ps) => ps.map((p) => (p.id === id ? { ...p, features: { ...p.features, [k]: !p.features[k] } } : p)));
  }

  async function savePlan(plan: Plan) {
    setSavingId(plan.id);
    try {
      const saved = await api<Plan>(`/platform/plans-manage/${plan.id}/`, {
        method: "PATCH",
        body: {
          name: plan.name, tier: plan.tier,
          price_monthly: plan.price_monthly, price_yearly: plan.price_yearly,
          max_users: plan.max_users, max_branches: plan.max_branches, max_products: plan.max_products,
          show_users: plan.show_users, show_branches: plan.show_branches, show_products: plan.show_products,
          features: plan.features, highlights: plan.highlights || [], is_active: plan.is_active,
        },
      });
      upd(plan.id, saved);
      toast.success("Package saved.");
    } catch (e: any) {
      toast.error(e?.data?.tier?.[0] || e?.data?.detail || "Save failed.");
    } finally { setSavingId(null); }
  }

  async function addPackage() {
    const usedTiers = new Set(plans.map((p) => p.tier));
    const freeTier = tiers.find((t) => !usedTiers.has(t));
    if (!freeTier) { toast.error("All package tiers are in use (max 4)."); return; }
    try {
      const created = await api<Plan>("/platform/plans-manage/", {
        method: "POST",
        body: {
          name: TIER_LABEL[freeTier]?.split(" ")[0] || "New Package", tier: freeTier,
          price_monthly: 0, price_yearly: 0, max_users: 2, max_branches: 1, max_products: 100,
          features: keys.reduce((a, k) => ({ ...a, [k]: false }), {}), highlights: [],
          show_users: true, show_branches: true, show_products: true, is_active: false,
        },
      });
      setPlans((ps) => [...ps, created]);
      toast.success("Package added — set its price and Save.");
    } catch (e: any) { toast.error(e?.data?.detail || "Could not add package."); }
  }

  async function deletePackage(id: number) {
    if (!confirm("Delete this package? This cannot be undone.")) return;
    try {
      await api(`/platform/plans-manage/${id}/`, { method: "DELETE" });
      setPlans((ps) => ps.filter((p) => p.id !== id));
      toast.success("Package deleted.");
    } catch (e: any) { toast.error(e?.data?.detail || "Delete failed."); }
  }

  // ── Offer handlers ─────────────────────────────────────────────────────────
  async function uploadOffer(file: File) {
    setOfferBusy(true);
    try {
      const fd = new FormData();
      fd.append("offer_file", file);
      fd.append("offer_enabled", "true");
      const o = await api<Offer>("/platform/promo-offer/", { method: "POST", body: fd });
      setOffer(o);
      toast.success("Offer uploaded and enabled.");
    } catch (e: any) { toast.error(e?.data?.detail || "Upload failed."); }
    finally { setOfferBusy(false); if (offerInput.current) offerInput.current.value = ""; }
  }
  async function toggleOffer(enabled: boolean) {
    setOfferBusy(true);
    try {
      const fd = new FormData();
      fd.append("offer_enabled", String(enabled));
      const o = await api<Offer>("/platform/promo-offer/", { method: "POST", body: fd });
      setOffer(o);
    } catch { toast.error("Failed to update."); }
    finally { setOfferBusy(false); }
  }
  async function removeOffer() {
    if (!confirm("Remove the offer image/PDF?")) return;
    setOfferBusy(true);
    try {
      const o = await api<Offer>("/platform/promo-offer/", { method: "DELETE" });
      setOffer(o);
      toast.success("Offer removed.");
    } catch { toast.error("Failed to remove."); }
    finally { setOfferBusy(false); }
  }

  if (error && !plans.length) return <ErrorState error={error} />;
  if (!loaded) return <Spinner />;

  const usedTiers = new Set(plans.map((p) => p.tier));

  return (
    <div className="vstack gap-4">
      <PageHeader title="Packages & Pricing" />

      {/* ── Promotional offer popup ── */}
      <div className="card shadow-sm border-top border-4 border-warning">
        <div className="card-body">
          <h2 className="h6 fw-bold d-flex align-items-center gap-2 text-warning-emphasis mb-1">
            <i className="bi bi-megaphone"></i> Offer Popup (Pricing page)
          </h2>
          <p className="text-secondary small mb-3">
            Upload an image (JPG/PNG) or PDF. When enabled, it pops up on the public pricing page.
          </p>
          <div className="row g-3 align-items-center">
            <div className="col-md-4">
              {offer.url ? (
                offer.is_pdf ? (
                  <a href={offer.url} target="_blank" rel="noreferrer" className="btn btn-outline-secondary btn-sm">
                    <i className="bi bi-file-earmark-pdf me-1"></i> View current PDF
                  </a>
                ) : (
                  <img src={offer.url} alt="Offer" style={{ maxWidth: "100%", maxHeight: 120, borderRadius: 8, border: "1px solid var(--line)" }} />
                )
              ) : (
                <span className="text-secondary small">No offer uploaded.</span>
              )}
            </div>
            <div className="col-md-8">
              <div className="d-flex flex-wrap align-items-center gap-3">
                <input ref={offerInput} type="file" accept="image/*,application/pdf" className="form-control form-control-sm" style={{ maxWidth: 260 }}
                  disabled={offerBusy} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadOffer(f); }} />
                <div className="form-check form-switch mb-0">
                  <input className="form-check-input" type="checkbox" role="switch" id="offerSwitch"
                    checked={offer.enabled} disabled={offerBusy || !offer.url} onChange={(e) => toggleOffer(e.target.checked)} />
                  <label className="form-check-label small" htmlFor="offerSwitch">Show on pricing page</label>
                </div>
                {offer.url && (
                  <button className="btn btn-outline-danger btn-sm" disabled={offerBusy} onClick={removeOffer}>
                    <i className="bi bi-trash me-1"></i> Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Pricing page text (CMS) ── */}
      <div className="card shadow-sm border-top border-4 border-info">
        <div className="card-body">
          <h2 className="h6 fw-bold d-flex align-items-center gap-2 text-info mb-1">
            <i className="bi bi-fonts"></i> Pricing Page Text
          </h2>
          <p className="text-secondary small mb-3">Edit the wording shown on the public pricing page.</p>
          <div className="row g-3">
            {CONTENT_FIELDS.map((f) => (
              <div className="col-md-6" key={f.key}>
                <label className="form-label small fw-medium">{f.label}</label>
                <input className="form-control form-control-sm" value={content[f.key] ?? ""}
                  onChange={(e) => setContent((c) => ({ ...c, [f.key]: e.target.value }))} />
                {f.hint && <div className="form-text small">{f.hint}</div>}
              </div>
            ))}
          </div>
          <div className="d-flex justify-content-end mt-3">
            <button className="btn btn-info text-white rounded-pill px-4" disabled={savingContent} onClick={saveContent}>
              {savingContent ? "Saving..." : "Save Text"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Packages ── */}
      <div className="d-flex align-items-center justify-content-between">
        <h2 className="h6 fw-bold mb-0">Packages ({plans.length})</h2>
        <button className="btn btn-brand btn-sm" onClick={addPackage} disabled={usedTiers.size >= tiers.length}>
          <i className="bi bi-plus-lg me-1"></i> Add Package
        </button>
      </div>

      {plans.length === 0 && (
        <div className="alert alert-info">No packages yet. Click <strong>Add Package</strong> to create one.</div>
      )}

      <div className="row g-3">
        {plans.map((plan) => (
          <div className="col-lg-6" key={plan.id}>
            <div className={`card shadow-sm h-100 ${plan.is_active ? "border-success" : ""}`}>
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <input className="form-control me-2 fw-bold" style={{ maxWidth: "14rem" }} value={plan.name}
                    onChange={(e) => upd(plan.id, { name: e.target.value })} />
                  <span className={`badge ${plan.is_active ? "text-bg-success" : "text-bg-secondary"}`}>
                    {plan.is_active ? "Shown" : "Hidden"}
                  </span>
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-6">
                    <label className="form-label small fw-medium">Tier</label>
                    <select className="form-select" value={plan.tier} onChange={(e) => upd(plan.id, { tier: e.target.value })}>
                      {tiers.map((t) => (
                        <option key={t} value={t} disabled={t !== plan.tier && usedTiers.has(t)}>{TIER_LABEL[t] || t}</option>
                      ))}
                    </select>
                  </div>
                  <Num c="col-6" label="৳ / month" v={plan.price_monthly} on={(v) => upd(plan.id, { price_monthly: v })} />
                  <YearField c="col-6" monthly={plan.price_monthly} yearly={plan.price_yearly} on={(v) => upd(plan.id, { price_yearly: v })} />
                  <LimitNum c="col-6" label="Max users" v={plan.max_users} show={plan.show_users}
                    on={(v) => upd(plan.id, { max_users: Number(v) })} onShow={(b) => upd(plan.id, { show_users: b })} id={`u-${plan.id}`} />
                  <LimitNum c="col-6" label="Max branches" v={plan.max_branches} show={plan.show_branches}
                    on={(v) => upd(plan.id, { max_branches: Number(v) })} onShow={(b) => upd(plan.id, { show_branches: b })} id={`b-${plan.id}`} />
                  <LimitNum c="col-6" label="Max products" v={plan.max_products} show={plan.show_products}
                    on={(v) => upd(plan.id, { max_products: Number(v) })} onShow={(b) => upd(plan.id, { show_products: b })} id={`p-${plan.id}`} />
                </div>

                <label className="form-label small fw-bold">Features</label>
                <div className="row g-2 mb-3">
                  {keys.map((k) => (
                    <div className="col-6" key={k}>
                      <div className="form-check">
                        <input className="form-check-input" type="checkbox" id={`f-${plan.id}-${k}`}
                          checked={!!plan.features[k]} onChange={() => toggleFeature(plan.id, k)} />
                        <label className="form-check-label small" htmlFor={`f-${plan.id}-${k}`}>{k}</label>
                      </div>
                    </div>
                  ))}
                </div>

                <label className="form-label small fw-bold">Feature bullets (one per line)</label>
                <textarea className="form-control form-control-sm font-monospace mb-1" rows={5}
                  placeholder={"Leave blank to auto-list limits & features.\nUp to 1000 Users\nPoint of Sale (POS)\nFree setup & training"}
                  value={(plan.highlights || []).join("\n")}
                  onChange={(e) => upd(plan.id, { highlights: e.target.value.split("\n") })} />
                <div className="form-text small mb-3">These replace the auto feature list on the pricing card.</div>

                <div className="form-check form-switch mb-3">
                  <input className="form-check-input" type="checkbox" role="switch" id={`show-${plan.id}`}
                    checked={plan.is_active} onChange={(e) => upd(plan.id, { is_active: e.target.checked })} />
                  <label className="form-check-label small fw-medium" htmlFor={`show-${plan.id}`}>Show this package on the pricing page</label>
                </div>

                <div className="d-flex gap-2">
                  <button className="btn btn-brand flex-grow-1" disabled={savingId === plan.id} onClick={() => savePlan(plan)}>
                    {savingId === plan.id ? "Saving…" : "Save Package"}
                  </button>
                  <button className="btn btn-outline-danger" onClick={() => deletePackage(plan.id)} title="Delete package">
                    <i className="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Num({ c, label, v, on }: { c: string; label: string; v: string | number; on: (v: string) => void }) {
  return (
    <div className={c}>
      <label className="form-label small fw-medium">{label}</label>
      <input className="form-control" type="number" step="0.01" value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}

function YearField({ c, monthly, yearly, on }: {
  c: string; monthly: string | number; yearly: string | number; on: (v: string) => void;
}) {
  const m = parseFloat(String(monthly)) || 0;
  const y = parseFloat(String(yearly)) || 0;
  const pct = m > 0 && y > 0 && y < m * 12 ? Math.round((1 - (y / 12) / m) * 100) : 0;
  return (
    <div className={c}>
      <div className="d-flex align-items-center justify-content-between">
        <label className="form-label small fw-medium mb-0">৳ / year</label>
        {pct > 0
          ? <span className="badge text-bg-success">{pct}% off</span>
          : y > 0 ? <span className="badge text-bg-secondary">no discount</span> : null}
      </div>
      <input className="form-control" type="number" step="0.01" value={yearly} onChange={(e) => on(e.target.value)} />
    </div>
  );
}

function LimitNum({ c, label, v, show, on, onShow, id }: {
  c: string; label: string; v: number; show: boolean; on: (v: string) => void; onShow: (b: boolean) => void; id: string;
}) {
  return (
    <div className={c}>
      <div className="d-flex align-items-center justify-content-between">
        <label className="form-label small fw-medium mb-0">{label}</label>
        <div className="form-check form-switch mb-0" title="Show this line on the pricing page">
          <input className="form-check-input" type="checkbox" role="switch" id={`show-${id}`} checked={show} onChange={(e) => onShow(e.target.checked)} />
          <label className="form-check-label small text-secondary" htmlFor={`show-${id}`}>Show</label>
        </div>
      </div>
      <input className={`form-control ${show ? "" : "opacity-50"}`} type="number" value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}
