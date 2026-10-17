"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { startImpersonation } from "@/lib/impersonation";
import { ErrorState, PageHeader, Spinner, fmtDate } from "@/components/ui";
import toast from "react-hot-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { MODULE_DETAILS, ModuleDetail } from "@/lib/moduleDetails";

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
  is_demo?: boolean;
  is_free?: boolean;
  manufacturing_enabled?: boolean;
  mobile_repair_enabled?: boolean;
  mobile_repair_master_enabled?: boolean;
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

type ModuleItem = {
  key: string;
  name_en: string;
  name_bn: string;
  category: string;
  icon: string;
  description: string;
  default_enabled: boolean;
};

type PresetPackage = {
  name: string;
  description: string;
  modules: string[];
};

type ModuleData = {
  catalog: ModuleItem[];
  presets: Record<string, PresetPackage>;
  modules: Record<string, boolean>;
};

const DURATIONS = [
  { label: "1 month", days: 30 },
  { label: "3 months", days: 90 },
  { label: "6 months", days: 180 },
  { label: "1 year", days: 365 },
];

const TYPE_LABELS: Record<string, string> = {
  fashion: "Fashion & Apparel",
  apparel: "Fashion & Apparel",
  online_shop: "Online Shop & E-Commerce",
  ecommerce: "Online Shop & E-Commerce",
  electronics: "Electronics",
  computer: "Computer",
  mobile: "Mobile & Accessories",
  general: "General Retail",
  camical: "Chemical & Lab Supplies",
  supershop: "Super Shop & Grocery",
  printing: "Printing, Media & Online Services",
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

  // 24-Module Dynamic Feature Matrix
  const [moduleData, setModuleData] = useState<ModuleData | null>(null);
  const [moduleCategory, setModuleCategory] = useState<string>("all");
  const [savingModule, setSavingModule] = useState<string | null>(null);

  // Module Details & Impact Info Modal
  const [infoModalModule, setInfoModalModule] = useState<ModuleDetail | null>(null);
  const [infoModalLang, setInfoModalLang] = useState<"bn" | "en">("bn");

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

  const loadModules = useCallback(async () => {
    try {
      const res = await api<ModuleData>(`/platform/shops/${id}/modules/`);
      setModuleData(res);
    } catch {}
  }, [id]);

  useEffect(() => {
    load();
    loadModules();
  }, [load, loadModules]);

  const toggleModule = useCallback(async (key: string, currentVal: boolean) => {
    if (!shop) return;
    const nextVal = !currentVal;
    setSavingModule(key);
    setModuleData((prev) =>
      prev ? { ...prev, modules: { ...prev.modules, [key]: nextVal } } : null
    );
    try {
      await api(`/platform/shops/${shop.id}/modules/`, {
        method: "PATCH",
        body: { modules: { [key]: nextVal } },
      });
      toast.success(
        lang === "bn"
          ? `${key} মডিউল ${nextVal ? "চালু" : "বন্ধ"} করা হয়েছে`
          : `Module ${key} ${nextVal ? "enabled" : "disabled"}`
      );
      if (key === "manufacturing") {
        setShop((prev) => (prev ? { ...prev, manufacturing_enabled: nextVal } : null));
      }
      if (key === "mobile_repair_pos") {
        setShop((prev) => (prev ? { ...prev, mobile_repair_master_enabled: nextVal } : null));
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to update module.");
      loadModules();
    } finally {
      setSavingModule(null);
    }
  }, [shop, lang, loadModules]);

  const toggleCategoryModules = useCallback(async (catId: string, enable: boolean) => {
    if (!shop || !moduleData?.catalog) return;
    const catModules = moduleData.catalog.filter((m) => m.category === catId);
    if (!catModules.length) return;
    const patchPayload: Record<string, boolean> = {};
    catModules.forEach((m) => {
      patchPayload[m.key] = enable;
    });
    setBusy(true);
    setModuleData((prev) =>
      prev ? { ...prev, modules: { ...prev.modules, ...patchPayload } } : null
    );
    try {
      await api(`/platform/shops/${shop.id}/modules/`, {
        method: "PATCH",
        body: { modules: patchPayload },
      });
      toast.success(
        lang === "bn"
          ? `ক্যাটাগরির ${catModules.length}টি মডিউল ${enable ? "সক্রিয়" : "নিষ্ক্রিয়"} করা হয়েছে`
          : `${catModules.length} modules in category ${enable ? "enabled" : "disabled"}`
      );
      await loadModules();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update category modules.");
      await loadModules();
    } finally {
      setBusy(false);
    }
  }, [shop, moduleData, lang, loadModules]);

  const applyPreset = useCallback(async (presetKey: string) => {
    if (!shop) return;
    setBusy(true);
    try {
      const res = await api<{ success: boolean; preset_name: string; modules: Record<string, boolean> }>(
        `/platform/shops/${shop.id}/apply-preset/`,
        { method: "POST", body: { preset: presetKey } }
      );
      toast.success(
        lang === "bn"
          ? `প্যাকেজ '${res.preset_name}' সফলভাবে শপে অ্যাসাইন করা হয়েছে!`
          : `Package '${res.preset_name}' assigned to shop successfully!`
      );
      await loadModules();
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to apply preset package.");
    } finally {
      setBusy(false);
    }
  }, [shop, lang, loadModules, load]);

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

  const toggleMobileRepair = useCallback(async () => {
    if (!shop) return;
    setBusy(true);
    try {
      const nextVal = !shop.mobile_repair_master_enabled;
      await api(`/platform/shops/${shop.id}/`, {
        method: "PATCH",
        body: { mobile_repair_master_enabled: nextVal },
      });
      setShop((prev) => prev ? { ...prev, mobile_repair_master_enabled: nextVal } : null);
      toast.success(nextVal ? "📱 Mobile Repair Shop module ENABLED for this shop!" : "Mobile Repair module disabled.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update Mobile Repair feature.");
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

  const toggleDemo = useCallback(async () => {
    if (!shop) return;
    setBusy(true);
    try {
      const r = await api<{ is_demo: boolean; is_test: boolean }>(`/platform/shops/${shop.id}/toggle-demo/`, { method: "POST" });
      await load();
      toast.success(r.is_demo ? "Marked as Demo Store (separated)." : "Marked as Live Merchant Store.");
    } catch (e: any) {
      toast.error(e?.message || "Action failed.");
    } finally {
      setBusy(false);
    }
  }, [shop, load]);

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

  const toggleWhatsAppDigest = useCallback(async () => {
    if (!shop) return;
    setBusy(true);
    try {
      const r = await api<{ whatsapp_daily_digest_enabled: boolean }>(`/platform/shops/${shop.id}/toggle-whatsapp-digest/`, { method: "POST" });
      await load();
      toast.success(r.whatsapp_daily_digest_enabled ? "হোয়াটসঅ্যাপ দৈনিক রিপোর্ট চালু হয়েছে (ON)." : "হোয়াটসঅ্যাপ দৈনিক রিপোর্ট বন্ধ হয়েছে (OFF).");
    } catch (e: any) {
      toast.error(e?.message || "Failed to toggle WhatsApp digest.");
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
          <h1 className="h3 fw-bold mb-0 text-body d-flex align-items-center gap-3">
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
          <div className="card border shadow-sm rounded-4 h-100 bg-body">
            <div className="card-body p-4">
              <h5 className="fw-bold text-body mb-4"><i className="bi bi-shop me-2 text-brand"></i>{lang === "bn" ? "দোকানের সাধারণ তথ্য" : "Shop Information"}</h5>
              
              <div className="row g-4">
                <div className="col-md-6">
                  <div className="p-3 rounded-3 bg-body-tertiary border">
                    <p className="text-secondary small mb-1">{lang === "bn" ? "ইউনিক শপ আইডি" : "Unique Shop ID"}</p>
                    <p className="fw-bold text-brand mb-0 font-monospace fs-5">{shop.shop_code || `SW-${1000 + shop.id}`}</p>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="p-3 rounded-3 bg-body-tertiary border">
                    <p className="text-secondary small mb-1">{lang === "bn" ? "ব্যবসার ধরন" : "Business Type"}</p>
                    <p className="fw-medium text-body mb-0">{TYPE_LABELS[shop.business_type] || shop.business_type}</p>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="p-3 rounded-3 bg-body-tertiary border">
                    <p className="text-secondary small mb-1">{lang === "bn" ? "যোগাযোগের নম্বর" : "Contact Phone"}</p>
                    <p className="fw-medium text-body mb-0">{shop.phone || "—"}</p>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="p-3 rounded-3 bg-body-tertiary border">
                    <p className="text-secondary small mb-1">{lang === "bn" ? "অফিসিয়াল ইমেইল" : "Public Email"}</p>
                    <p className="fw-medium text-body mb-0">{shop.email || "—"}</p>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="p-3 rounded-3 bg-body-tertiary border">
                    <p className="text-secondary small mb-1">{lang === "bn" ? "মোট ব্যবহারকারী" : "Total Users"}</p>
                    <p className="fw-medium text-body mb-0">{shop.user_count} User(s)</p>
                  </div>
                </div>
                <div className="col-12">
                  <div className="p-3 rounded-3 bg-body-tertiary border">
                    <p className="text-secondary small mb-1">{lang === "bn" ? "ঠিকানা" : "Physical Address"}</p>
                    <p className="fw-medium text-body mb-0">{shop.address || "No address provided"}</p>
                  </div>
                </div>
              </div>

                            <hr className="border-secondary my-4 opacity-25" />

              {/* 24-Module Dynamic Feature Matrix & Package Presets */}
              <div className="mb-4">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                  <div>
                    <h5 className="fw-bold text-body mb-1">
                      <i className="bi bi-grid-3x3-gap-fill me-2 text-primary"></i>
                      {lang === "bn" ? "ক্যাটাগরি-ভিত্তিক মডিউলার ফিচার আর্কিটেকচার (২৮টি মডিউল)" : "Category-Based Modular Feature Architecture (28 Modules)"}
                    </h5>
                    <p className="text-secondary small mb-0">
                      {lang === "bn"
                        ? "ব্যবসার ধরন অনুযায়ী ক্যাটাগরিভিত্তিক (ফ্যাশন, অনলাইন শপ, ইলেকট্রনিক্স শপ, সার্বজনীন রিটেইল ও ম্যানুফ্যাকচারিং) মডিউল কনফিগার করুন।"
                        : "Configure standalone modules organized by business vertical: Fashion & Apparel, Online Shop, Electronics Shop, Universal Retail, and Manufacturing."}
                    </p>
                  </div>
                  {moduleData && (
                    <div className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-2 rounded-pill fs-7">
                      <i className="bi bi-check2-circle me-1"></i>
                      {Object.values(moduleData.modules || {}).filter(Boolean).length} / {moduleData.catalog?.length || 28} Active
                    </div>
                  )}
                </div>

                {/* 1-Click Package Presets Dropdown */}
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 p-3 bg-body-tertiary rounded-3 border mb-4 shadow-sm">
                  <div className="d-flex align-items-center gap-2">
                    <div className="p-2 bg-primary-subtle text-primary rounded-3">
                      <i className="bi bi-box-seam fs-5"></i>
                    </div>
                    <div>
                      <div className="fw-bold small text-dark">
                        {lang === "bn" ? "১-ক্লিক প্যাকেজ প্রিসেট" : "1-Click Package Preset"}
                      </div>
                      <div className="text-secondary" style={{ fontSize: "0.78rem" }}>
                        {lang === "bn"
                          ? "নির্দিষ্ট ব্যবসার উপযোগী মডিউল প্যাকেজ ১-ক্লিকে অ্যাসাইন করুন"
                          : "Select a vertical package preset to instantly configure active modules"}
                      </div>
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-2 flex-grow-1 flex-sm-grow-0" style={{ minWidth: "300px" }}>
                    <select
                      className="form-select form-select-sm fw-semibold shadow-xs"
                      disabled={busy}
                      defaultValue=""
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          applyPreset(val);
                          e.target.value = "";
                        }
                      }}
                    >
                      <option value="" disabled>
                        {busy
                          ? (lang === "bn" ? "অপেক্ষা করুন..." : "Applying Preset...")
                          : (lang === "bn" ? "▼ প্যাকেজ প্রিসেট নির্বাচন করুন" : "▼ Choose Package Preset")}
                      </option>
                      <option value="apparel_fashion">👗 Fashion & Apparel Boutique (12 Modules)</option>
                      <option value="online_store">🌐 Online Shop & Courier (12 Modules)</option>
                      <option value="repair_specialty">🔌 Electronics & Repair Lab (11 Modules)</option>
                      <option value="retailer">🏬 Universal Retailer (13 Modules)</option>
                      <option value="supershop">🛒 SuperShop & Grocery (17 Modules)</option>
                      <option value="manufacturing_preset">⚙️ Manufacturing & Production (9 Modules)</option>
                      <option value="starter">🚀 Starter Retailer (7 Modules)</option>
                      <option value="enterprise">⭐ Full Enterprise Suite (All 28 Modules)</option>
                      <option value="all">⚡ Unlock All 28 Modules</option>
                      <option value="minimal">🔒 Minimal Core POS Only</option>
                    </select>
                    <div className="d-flex gap-1">
                      <button
                        type="button"
                        className="btn btn-sm btn-success fw-bold px-2 py-1 shadow-xs text-nowrap"
                        disabled={busy}
                        onClick={() => applyPreset("all")}
                        title="Enable All 28 Modules for this shop"
                      >
                        <i className="bi-check-all me-1" />
                        {lang === "bn" ? "সব অন" : "All On"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger fw-bold px-2 py-1 shadow-xs text-nowrap"
                        disabled={busy}
                        onClick={() => applyPreset("minimal")}
                        title="Disable optional modules"
                      >
                        <i className="bi-slash-circle me-1" />
                        {lang === "bn" ? "মিনিমাল" : "Minimal"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Category Filters */}
                {(() => {
                  const categoriesDef = [
                    {
                      id: "all",
                      label: lang === "bn" ? `সকল মডিউল (${moduleData?.catalog?.length || 28})` : `All Modules (${moduleData?.catalog?.length || 28})`,
                      icon: "bi-grid-fill",
                      color: "primary",
                      name_en: "All Modules",
                      name_bn: "সকল মডিউল",
                      desc: lang === "bn" ? "সকল ২৮টি ব্যবসায়িক মডিউলের সম্পূর্ণ ক্যাটালগ" : "Complete catalog of all 28 business modules across all verticals",
                    },
                    {
                      id: "fashion",
                      label: lang === "bn" ? "👗 ফ্যাশন ও পোশাক" : "👗 Fashion & Apparel",
                      icon: "bi-bag-check-fill",
                      color: "danger",
                      name_en: "Fashion & Apparel",
                      name_bn: "ফ্যাশন ও পোশাক শপ",
                      desc: lang === "bn" ? "সাইজ-কালার ম্যাট্রিক্স, টেইলারিং অলটারেশন, ফিটিং টিকেট ও সাইজ মেজারমেন্ট গাইড" : "2D Size × Color matrix, tailor alterations & fitting tickets, measurement guides, and apparel tags.",
                    },
                    {
                      id: "online_shop",
                      label: lang === "bn" ? "🌐 অনলাইন শপ" : "🌐 Online Shop",
                      icon: "bi-globe2",
                      color: "info",
                      name_en: "Online Shop & E-Commerce",
                      name_bn: "অনলাইন শপ ও ই-কমার্স",
                      desc: lang === "bn" ? "কুরিয়ার ডেলিভারি ট্র্যাকিং (Steadfast, Pathao, RedX), ওয়েবসাইট ইন্টিগ্রেশন ও পাবলিক এপিআই" : "Courier delivery tracking, WooCommerce/Shopify sync, and public developer APIs.",
                    },
                    {
                      id: "electronics",
                      label: lang === "bn" ? "🔌 ইলেকট্রনিক্স শপ" : "🔌 Electronics Shop",
                      icon: "bi-cpu-fill",
                      color: "warning",
                      name_en: "Electronics & Gadget Shop",
                      name_bn: "ইলেকট্রনিক্স ও গ্যাজেট শপ",
                      desc: lang === "bn" ? "সার্ভিস ওয়ারেন্টি ও মেরামত টিকেট, মোবাইল ল্যাব, IMEI ট্র্যাকিং এবং কিস্তি/ইএমআই" : "Device repair tickets, warranty claims, IMEI diagnostics, pattern lock, and EMI installments.",
                    },
                    {
                      id: "universal",
                      label: lang === "bn" ? "🏬 সার্বজনীন রিটেইল" : "🏬 Universal / Core",
                      icon: "bi-shop",
                      color: "primary",
                      name_en: "Universal / Core Retail",
                      name_bn: "সার্বজনীন / কোর রিটেইল",
                      desc: lang === "bn" ? "যেকোনো সাধারণ দোকানের জন্য অপরিহার্য পিওএস, ইনভেন্টরি, হিসাববিজ্ঞান ও সিআরএম" : "Foundational POS, inventory, purchasing, accounting, CRM, and day-to-day retail operations.",
                    },
                    {
                      id: "manufacturing",
                      label: lang === "bn" ? "⚙️ ম্যানুফ্যাকচারিং" : "⚙️ Manufacturing",
                      icon: "bi-gear-wide-connected",
                      color: "secondary",
                      name_en: "Manufacturing & Production",
                      name_bn: "উৎপাদন ও প্রক্রিয়াজাতকরণ",
                      desc: lang === "bn" ? "বিল অফ ম্যাটেরিয়ালস (BOM), কাঁচামাল ব্যবহার ও ফিনিশড গুডস অ্যাসেম্বলি" : "Bill of materials (BOM), raw material consumption, and assembly production.",
                    },
                  ];

                  const getCatMeta = (catId: string) => {
                    switch (catId) {
                      case "fashion":
                        return {
                          icon: "bi-bag-check-fill",
                          color: "danger",
                          badgeBg: "bg-danger-subtle text-danger border-danger-subtle",
                          label: "👗 Fashion",
                          title_en: "Fashion & Apparel",
                          title_bn: "ফ্যাশন ও পোশাক শপ",
                          desc: lang === "bn" ? "সাইজ-কালার ম্যাট্রিক্স, টেইলারিং অলটারেশন, ফিটিং টিকেট ও সাইজ মেজারমেন্ট গাইড" : "2D Size × Color matrix, tailor alterations, fitting tickets, and size measurement guides.",
                        };
                      case "online_shop":
                        return {
                          icon: "bi-globe2",
                          color: "info",
                          badgeBg: "bg-info-subtle text-info border-info-subtle",
                          label: "🌐 Online Shop",
                          title_en: "Online Shop & E-Commerce",
                          title_bn: "অনলাইন শপ ও ই-কমার্স",
                          desc: lang === "bn" ? "কুরিয়ার পার্সেল ট্র্যাকিং (Steadfast, Pathao, RedX), ওয়েবসাইট ইন্টিগ্রেশন ও এপিআই" : "Courier delivery tracking, WooCommerce/Shopify sync, and public developer APIs.",
                        };
                      case "electronics":
                        return {
                          icon: "bi-cpu-fill",
                          color: "warning",
                          badgeBg: "bg-warning-subtle text-warning border-warning-subtle",
                          label: "🔌 Electronics",
                          title_en: "Electronics & Gadget Shop",
                          title_bn: "ইলেকট্রনিক্স ও গ্যাজেট শপ",
                          desc: lang === "bn" ? "সার্ভিস ওয়ারেন্টি ও মেরামত টিকেট, মোবাইল ল্যাব, IMEI ট্র্যাকিং এবং কিস্তি/ইএমআই" : "Device repair tickets, warranty claims, IMEI diagnostics, pattern lock, and EMI installments.",
                        };
                      case "manufacturing":
                        return {
                          icon: "bi-gear-wide-connected",
                          color: "secondary",
                          badgeBg: "bg-secondary-subtle text-secondary border-secondary-subtle",
                          label: "⚙️ Manufacturing",
                          title_en: "Manufacturing & Production",
                          title_bn: "উৎপাদন ও প্রক্রিয়াজাতকরণ",
                          desc: lang === "bn" ? "বিল অফ ম্যাটেরিয়ালস (BOM), কাঁচামাল ব্যবহার ও ফিনিশড গুডস অ্যাসেম্বলি" : "Bill of materials (BOM), raw material consumption, and assembly production.",
                        };
                      case "universal":
                      default:
                        return {
                          icon: "bi-shop",
                          color: "primary",
                          badgeBg: "bg-primary-subtle text-primary border-primary-subtle",
                          label: "🏬 Universal",
                          title_en: "Universal / Core Retail",
                          title_bn: "সার্বজনীন / কোর রিটেইল",
                          desc: lang === "bn" ? "যেকোনো সাধারণ দোকানের জন্য অপরিহার্য পিওএস, ইনভেন্টরি, হিসাববিজ্ঞান ও সিআরএম" : "Foundational POS, inventory, purchasing, accounting, CRM, and day-to-day operations.",
                        };
                    }
                  };

                  const visibleCategories = moduleCategory === "all"
                    ? ["fashion", "online_shop", "electronics", "universal", "manufacturing"]
                    : [moduleCategory];

                  return (
                    <>
                      {/* Filter Pills with Counts */}
                      <div className="d-flex flex-wrap gap-1 mb-4">
                        {categoriesDef.map((cat) => {
                          const count = cat.id === "all"
                            ? (moduleData?.catalog?.length || 28)
                            : (moduleData?.catalog || []).filter((m) => m.category === cat.id).length;
                          const activeCount = cat.id === "all"
                            ? Object.values(moduleData?.modules || {}).filter(Boolean).length
                            : (moduleData?.catalog || []).filter((m) => m.category === cat.id && !!moduleData?.modules?.[m.key]).length;

                          return (
                            <button
                              key={cat.id}
                              type="button"
                              className={`btn btn-sm rounded-pill px-3 py-1 d-flex align-items-center gap-1 ${
                                moduleCategory === cat.id
                                  ? "btn-primary shadow-sm"
                                  : "btn-outline-secondary"
                              }`}
                              onClick={() => setModuleCategory(cat.id)}
                            >
                              <span>{cat.label}</span>
                              <span
                                className={`badge rounded-pill ${
                                  moduleCategory === cat.id ? "bg-white text-primary" : "bg-secondary bg-opacity-25 text-body"
                                }`}
                                style={{ fontSize: "0.72rem" }}
                              >
                                {activeCount}/{count}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Category Sections */}
                      <div className="d-flex flex-column gap-4">
                        {visibleCategories.map((catId) => {
                          const catMeta = getCatMeta(catId);
                          const catModules = (moduleData?.catalog || []).filter((m) => m.category === catId);
                          if (!catModules.length) return null;
                          const catActiveCount = catModules.filter((m) => !!moduleData?.modules?.[m.key]).length;

                          return (
                            <div key={catId} className="border rounded-4 p-3 bg-body shadow-xs">
                              {/* Category Header Banner */}
                              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 pb-3 mb-3 border-bottom">
                                <div className="d-flex align-items-center gap-2">
                                  <div className={`p-2 rounded-3 bg-${catMeta.color}-subtle text-${catMeta.color} fs-5`}>
                                    <i className={`bi ${catMeta.icon}`}></i>
                                  </div>
                                  <div>
                                    <div className="d-flex align-items-center gap-2">
                                      <h6 className="fw-bold mb-0 text-dark">
                                        {lang === "bn" ? catMeta.title_bn : catMeta.title_en}
                                      </h6>
                                      <span className="text-secondary small">({lang === "bn" ? catMeta.title_en : catMeta.title_bn})</span>
                                      <span className={`badge rounded-pill ${catMeta.badgeBg} border px-2 py-0 fs-8`}>
                                        {catActiveCount} / {catModules.length} {lang === "bn" ? "সক্রিয়" : "Active"}
                                      </span>
                                    </div>
                                    <div className="text-secondary small" style={{ fontSize: "0.8rem" }}>
                                      {catMeta.desc}
                                    </div>
                                  </div>
                                </div>

                                <div className="d-flex align-items-center gap-2">
                                  <button
                                    type="button"
                                    className={`btn btn-sm btn-outline-${catMeta.color} px-2 py-1 rounded-pill fw-semibold`}
                                    style={{ fontSize: "0.76rem" }}
                                    disabled={busy || catActiveCount === catModules.length}
                                    onClick={() => toggleCategoryModules(catId, true)}
                                    title="Enable all modules in this category"
                                  >
                                    <i className="bi bi-check-all me-1"></i>
                                    {lang === "bn" ? "ক্যাটাগরি অন" : "Enable Category"}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary px-2 py-1 rounded-pill fw-semibold"
                                    style={{ fontSize: "0.76rem" }}
                                    disabled={busy || catActiveCount === 0}
                                    onClick={() => toggleCategoryModules(catId, false)}
                                    title="Disable all modules in this category"
                                  >
                                    <i className="bi bi-x-circle me-1"></i>
                                    {lang === "bn" ? "ক্যাটাগরি অফ" : "Disable Category"}
                                  </button>
                                </div>
                              </div>

                              {/* Modules Grid */}
                              <div className="row g-3">
                                {catModules.map((m) => {
                                  const isEnabled = !!moduleData?.modules?.[m.key];
                                  const isSaving = savingModule === m.key;

                                  return (
                                    <div key={m.key} className="col-md-6">
                                      <div
                                        className={`p-3 rounded-3 border h-100 transition-all ${
                                          isEnabled
                                            ? "bg-body border-primary shadow-sm"
                                            : "bg-body-tertiary border-secondary-subtle opacity-75"
                                        }`}
                                        style={{ transition: "all 0.2s ease" }}
                                      >
                                        <div className="d-flex align-items-start justify-content-between gap-2">
                                          <div className="d-flex align-items-start gap-3">
                                            <div
                                              className={`p-2 rounded-3 fs-5 d-flex align-items-center justify-content-center ${
                                                isEnabled ? `bg-${catMeta.color} text-white shadow-xs` : "bg-secondary bg-opacity-25 text-secondary"
                                              }`}
                                              style={{ width: 42, height: 42, flexShrink: 0 }}
                                            >
                                              <i className={`bi ${m.icon || "bi-puzzle"}`}></i>
                                            </div>
                                            <div>
                                              <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                                                <h6 className="fw-bold text-body mb-0" style={{ fontSize: "0.95rem" }}>
                                                  {m.name_en}
                                                </h6>
                                                <span className={`badge rounded-pill ${catMeta.badgeBg} border px-2 py-0 fs-8`}>
                                                  {catMeta.label}
                                                </span>
                                                {isEnabled ? (
                                                  <span className="badge bg-success-subtle text-success border border-success-subtle py-0 px-2 fs-8 rounded-pill">
                                                    Active
                                                  </span>
                                                ) : (
                                                  <span className="badge bg-light text-secondary border py-0 px-2 fs-8 rounded-pill">
                                                    Off
                                                  </span>
                                                )}
                                                <button
                                                  type="button"
                                                  className="btn btn-sm btn-outline-info rounded-circle d-inline-flex align-items-center justify-content-center p-0"
                                                  style={{ width: 22, height: 22, flexShrink: 0 }}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setInfoModalLang(lang === "en" ? "en" : "bn");
                                                    setInfoModalModule(MODULE_DETAILS[m.key] || {
                                                      key: m.key,
                                                      name_en: m.name_en || m.key,
                                                      name_bn: m.name_bn || m.key,
                                                      category: catMeta.title_en,
                                                      icon: m.icon || "bi-puzzle",
                                                      summary_en: m.description || "",
                                                      summary_bn: m.description || "",
                                                      how_it_works_en: m.description || "",
                                                      how_it_works_bn: m.description || "",
                                                      shop_changes_en: ["Enables " + (m.name_en || m.key) + " features across the tenant shop."],
                                                      shop_changes_bn: [(m.name_bn || m.key) + " এর সুবিধাসমূহ দোকানে সক্রিয় হবে।"],
                                                      recommended_for_en: "General retail shops.",
                                                      recommended_for_bn: "সাধারণ খুচরা দোকান。"
                                                    });
                                                  }}
                                                  title={lang === "bn" ? "মডিউলটির বিস্তারিত ও দোকানে কী কী পরিবর্তন হবে দেখুন" : "View how this module works & what changes in shop"}
                                                >
                                                  <i className="bi bi-info fw-bold" style={{ fontSize: "0.85rem" }}></i>
                                                </button>
                                              </div>
                                              <div className="text-secondary small fw-medium mb-1">{m.name_bn}</div>
                                              <p className="text-secondary small mb-0 lh-sm" style={{ fontSize: "0.82rem" }}>
                                                {m.description}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="form-check form-switch fs-4 mb-0 ms-2">
                                            <input
                                              className="form-check-input"
                                              type="checkbox"
                                              role="switch"
                                              checked={isEnabled}
                                              disabled={busy || isSaving}
                                              onChange={() => toggleModule(m.key, isEnabled)}
                                              style={{ cursor: "pointer" }}
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>

              <h5 className="fw-bold text-body mb-4"><i className="bi bi-person-badge me-2 text-info"></i>Owner Details</h5>
              <div className="row g-4">
                <div className="col-md-6">
                  <div className="p-3 rounded-3 bg-body-tertiary border">
                    <p className="text-secondary small mb-1">Owner Name</p>
                    <p className="fw-medium text-body mb-0">{shop.owner_full_name || "—"}</p>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="p-3 rounded-3 bg-body-tertiary border">
                    <p className="text-secondary small mb-1">Owner Email (Login)</p>
                    <p className="fw-medium text-body mb-0">{shop.owner_email || "—"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Status & Actions */}
        <div className="col-lg-4">
          <div className="card border shadow-sm rounded-4 mb-4 bg-body">
            <div className="card-body p-4">
              <h5 className="fw-bold text-body mb-4"><i className="bi bi-activity me-2 text-warning"></i>Subscription</h5>

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
                        <p className="fw-medium text-body mb-0">
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
                      <p className="fw-medium text-body mb-0">{fmtDate(shop.created_at)}</p>
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

          <div className="card border shadow-sm rounded-4 border-top border-danger border-4 bg-body">
            <div className="card-body p-4">
              <h5 className="fw-bold text-body mb-4"><i className="bi bi-shield-lock me-2 text-danger"></i>Admin Actions</h5>
              
              <div className="d-grid gap-3">
                <button className="btn btn-outline-secondary text-start p-3 rounded-3 d-flex align-items-center justify-content-between" onClick={resetPassword} disabled={busy}>
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
                  {shop.is_free && <span className="badge bg-success-subtle text-success border border-success-subtle">FREE</span>}
                </button>

                <button
                  className={`btn text-start p-3 rounded-3 d-flex align-items-center justify-content-between ${shop.is_demo ? "btn-outline-warning" : "btn-outline-secondary"}`}
                  onClick={toggleDemo}
                  disabled={busy}
                  title="Demo shops are separated in platform admin"
                >
                  <span>
                    <i className="bi bi-flask-fill me-2"></i>
                    {shop.is_demo ? "Unmark Demo Store (move to live)" : "Mark as Demo Store (separate)"}
                  </span>
                  {shop.is_demo && <span className="badge bg-warning text-dark">DEMO</span>}
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
                  className={`btn text-start p-3 rounded-3 d-flex align-items-center justify-content-between ${(shop as any).whatsapp_daily_digest_enabled ? "btn-success" : "btn-outline-success"}`}
                  onClick={toggleWhatsAppDigest}
                  disabled={busy}
                  title="Toggle 10 PM automated WhatsApp business digest for this shop"
                >
                  <span>
                    <i className="bi bi-whatsapp me-2"></i>
                    {(shop as any).whatsapp_daily_digest_enabled ? "হোয়াটসঅ্যাপ দৈনিক রিপোর্ট: চালু (ON)" : "হোয়াটসঅ্যাপ দৈনিক রিপোর্ট: বন্ধ (OFF)"}
                  </span>
                  {(shop as any).whatsapp_daily_digest_enabled && <span className="badge bg-white text-success fw-bold">ACTIVE</span>}
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

      {/* Module Info & Shop Impact Modal Popup */}
      {infoModalModule && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
          style={{ zIndex: 100050, background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(4px)" }}
          onClick={() => setInfoModalModule(null)}
        >
          <div
            className="bg-body rounded-4 shadow-lg border overflow-hidden d-flex flex-column"
            style={{ maxWidth: 680, width: "100%", maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-3 px-4 border-bottom bg-body-tertiary d-flex align-items-center justify-content-between gap-3">
              <div className="d-flex align-items-center gap-3">
                <div
                  className="p-2 rounded-3 bg-primary text-white d-flex align-items-center justify-content-center shadow-sm"
                  style={{ width: 44, height: 44, flexShrink: 0 }}
                >
                  <i className={`bi ${infoModalModule.icon || "bi-puzzle"} fs-4`}></i>
                </div>
                <div>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <h5 className="fw-bold mb-0 text-body">
                      {infoModalLang === "bn" ? infoModalModule.name_bn : infoModalModule.name_en}
                    </h5>
                    {moduleData?.modules?.[infoModalModule.key] ? (
                      <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-1 fs-8">
                        Active
                      </span>
                    ) : (
                      <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle rounded-pill px-2 py-1 fs-8">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="text-secondary small fw-medium">
                    {infoModalLang === "bn" ? infoModalModule.name_en : infoModalModule.name_bn} • {infoModalModule.category}
                  </div>
                </div>
              </div>

              <div className="d-flex align-items-center gap-2">
                {/* Language Switcher Buttons */}
                <div className="btn-group btn-group-sm shadow-xs" role="group">
                  <button
                    type="button"
                    className={`btn ${infoModalLang === "bn" ? "btn-primary fw-bold" : "btn-outline-secondary"}`}
                    onClick={() => setInfoModalLang("bn")}
                  >
                    বাংলা
                  </button>
                  <button
                    type="button"
                    className={`btn ${infoModalLang === "en" ? "btn-primary fw-bold" : "btn-outline-secondary"}`}
                    onClick={() => setInfoModalLang("en")}
                  >
                    English
                  </button>
                </div>
                <button
                  type="button"
                  className="btn-close ms-2"
                  onClick={() => setInfoModalModule(null)}
                  aria-label="Close"
                ></button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 overflow-y-auto">
              {/* Summary Banner */}
              <div className="p-3 bg-primary-subtle text-primary-emphasis rounded-3 border border-primary-subtle mb-4">
                <div className="fw-semibold small d-flex align-items-center gap-2 mb-1">
                  <i className="bi bi-info-circle-fill"></i>
                  {infoModalLang === "bn" ? "সারসংক্ষেপ" : "Overview"}
                </div>
                <p className="small mb-0">
                  {infoModalLang === "bn" ? infoModalModule.summary_bn : infoModalModule.summary_en}
                </p>
              </div>

              {/* How it works */}
              <div className="mb-4">
                <h6 className="fw-bold text-body d-flex align-items-center gap-2 mb-2">
                  <i className="bi bi-gear-wide-connected text-primary"></i>
                  {infoModalLang === "bn" ? "কীভাবে এই মডিউলটি কাজ করে:" : "How this module works:"}
                </h6>
                <div className="p-3 bg-body-tertiary rounded-3 border">
                  <p className="text-body small mb-0 lh-base">
                    {infoModalLang === "bn" ? infoModalModule.how_it_works_bn : infoModalModule.how_it_works_en}
                  </p>
                </div>
              </div>

              {/* What changes in shop */}
              <div className="mb-4">
                <h6 className="fw-bold text-body d-flex align-items-center gap-2 mb-2">
                  <i className="bi bi-shop-window text-success"></i>
                  {infoModalLang === "bn" ? "চালু করলে দোকানে কী কী যোগ ও পরিবর্তন হবে:" : "What changes in the shop when turned ON:"}
                </h6>
                <div className="vstack gap-2">
                  {(infoModalLang === "bn" ? infoModalModule.shop_changes_bn : infoModalModule.shop_changes_en).map(
                    (change, idx) => (
                      <div
                        key={idx}
                        className="d-flex align-items-start gap-2 p-2 px-3 rounded-2 bg-body-tertiary border border-secondary-subtle"
                      >
                        <i className="bi bi-check-circle-fill text-success mt-1 flex-shrink-0"></i>
                        <span className="small text-body fw-medium">{change}</span>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Recommended For */}
              <div className="p-3 bg-body-tertiary rounded-3 border">
                <div className="text-secondary small fw-bold text-uppercase mb-1 d-flex align-items-center gap-1">
                  <i className="bi bi-bullseye text-warning"></i>
                  {infoModalLang === "bn" ? "যাদের ব্যবসার জন্য সুপারিশকৃত:" : "Recommended for:"}
                </div>
                <div className="small text-body fw-medium">
                  {infoModalLang === "bn" ? infoModalModule.recommended_for_bn : infoModalModule.recommended_for_en}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 px-4 border-top bg-body-tertiary d-flex align-items-center justify-content-between gap-2">
              <div>
                {(() => {
                  const isCurrentActive = !!moduleData?.modules?.[infoModalModule.key];
                  return (
                    <button
                      type="button"
                      className={`btn btn-sm ${isCurrentActive ? "btn-outline-danger" : "btn-success"} px-3 py-2 fw-bold shadow-xs d-flex align-items-center gap-2`}
                      disabled={busy || savingModule === infoModalModule.key}
                      onClick={() => {
                        toggleModule(infoModalModule.key, isCurrentActive);
                      }}
                    >
                      {savingModule === infoModalModule.key ? (
                        <span className="spinner-border spinner-border-sm" />
                      ) : (
                        <i className={`bi ${isCurrentActive ? "bi-toggle-on" : "bi-toggle-off"}`}></i>
                      )}
                      <span>
                        {isCurrentActive
                          ? infoModalLang === "bn"
                            ? "মডিউল বন্ধ করুন"
                            : "Deactivate Module"
                          : infoModalLang === "bn"
                          ? "মডিউল চালু করুন"
                          : "Activate Module"}
                      </span>
                    </button>
                  );
                })()}
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm px-4 py-2 fw-semibold"
                onClick={() => setInfoModalModule(null)}
              >
                {infoModalLang === "bn" ? "বন্ধ করুন" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
