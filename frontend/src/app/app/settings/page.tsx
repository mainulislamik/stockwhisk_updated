"use client";

import { useAuth } from "@/components/AuthProvider";
import { Card } from "@/components/ui";
import { fmtDate } from "@/components/ui";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import WhatsAppConnectModal from "@/components/WhatsAppConnectModal";

export default function SettingsPage() {
  const { user, billing, isOwner, reload, hasModule } = useAuth();
  const { t, lang } = useLanguage();
  
  const [profileForm, setProfileForm] = useState({ first_name: "", last_name: "", phone: "" });
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  const [waConfig, setWaConfig] = useState<{
    is_connected: boolean;
    connected_phone: string;
    connected_name: string;
    default_mode: string;
    auto_send_pos: boolean;
  }>({
    is_connected: false,
    connected_phone: "",
    connected_name: "",
    default_mode: "direct",
    auto_send_pos: false,
  });
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waBusy, setWaBusy] = useState(false);

  const [shopForm, setShopForm] = useState({ 
    name: "", phone: "", address: "", currency: "BDT", 
    vat_enabled: false, vat_percent: 0, emi_enabled: false, 
    delivery_enabled: true, whatsapp_invoice_enabled: true, 
    barcode_prefix: "", offline_sale_mode: false, pos_print_mode: "ask", pos_receipt_enabled: true,
    pos_ui_layout: "standard",
    service_enabled: true, reports_enabled: true, finance_enabled: true,
    mobile_repair_enabled: false,
    mobile_repair_master_enabled: false
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [currentLogo, setCurrentLogo] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [shopBusy, setShopBusy] = useState(false);
  const [shopSuccess, setShopSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileForm({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        phone: user.phone || ""
      });
    }
    if (isOwner) {
      api<any>("/auth/shop-settings/").then(data => {
        setShopForm({
          name: data.name || "",
          phone: data.phone || "",
          address: data.address || "",
          currency: data.currency || "BDT",
          vat_enabled: data.vat_enabled || false,
          vat_percent: data.vat_percent || 0,
          emi_enabled: data.emi_enabled || false,
          delivery_enabled: data.delivery_enabled !== false,
          whatsapp_invoice_enabled: data.whatsapp_invoice_enabled !== false,
          barcode_prefix: data.barcode_prefix || "",
          offline_sale_mode: data.offline_sale_mode || false,
          pos_print_mode: data.pos_print_mode || "ask",
          pos_receipt_enabled: data.pos_receipt_enabled !== false,
          pos_ui_layout: data.pos_ui_layout || (data.invoice_settings && data.invoice_settings.pos_ui_layout) || "standard",
          service_enabled: data.service_enabled !== false,
          reports_enabled: data.reports_enabled !== false,
          finance_enabled: data.finance_enabled !== false,
          mobile_repair_enabled: data.mobile_repair_enabled === true,
          mobile_repair_master_enabled: data.mobile_repair_master_enabled === true,
        });
        if (data.logo) {
          setCurrentLogo(data.logo);
        }
      }).catch(console.error);

      loadWhatsAppStatus();
    }
  }, [user, isOwner]);

  const loadWhatsAppStatus = async () => {
    try {
      const data = await api<any>("/notifications/whatsapp/status/");
      setWaConfig({
        is_connected: Boolean(data.connected),
        connected_phone: data.phone || "",
        connected_name: data.name || "",
        default_mode: data.default_mode || "direct",
        auto_send_pos: Boolean(data.auto_send_pos),
      });
    } catch (err) {
      console.error("Failed to load WhatsApp status", err);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    if (!confirm(lang === "bn" ? "আপনি কি নিশ্চিত যে WhatsApp সংযোগ বিচ্ছিন্ন করতে চান?" : "Are you sure you want to disconnect WhatsApp?")) return;
    setWaBusy(true);
    try {
      await api("/notifications/whatsapp/disconnect/", { method: "POST" });
      setWaConfig(prev => ({ ...prev, is_connected: false, connected_phone: "", connected_name: "" }));
      toast.success(lang === "bn" ? "WhatsApp সংযোগ বিচ্ছিন্ন করা হয়েছে" : "WhatsApp disconnected successfully");
    } catch (err: any) {
      toast.error(err?.message || "Failed to disconnect WhatsApp");
    } finally {
      setWaBusy(false);
    }
  };

  const updateWaPrefs = async (updates: Partial<typeof waConfig>) => {
    const next = { ...waConfig, ...updates };
    setWaConfig(next);
    try {
      await api("/notifications/whatsapp/config/", {
        method: "PATCH",
        body: {
          default_mode: next.default_mode,
          auto_send_pos: next.auto_send_pos,
        },
      });
      toast.success(lang === "bn" ? "WhatsApp সেটিংস সংরক্ষিত হয়েছে" : "WhatsApp settings updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update WhatsApp settings");
    }
  };

  async function updateProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileBusy(true);
    setProfileSuccess(false);
    try {
      await api("/auth/me/", { method: "PATCH", body: profileForm });
      setProfileSuccess(true);
      await reload();
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      toast.error(err?.message || t("settings_err_prof"));
    } finally {
      setProfileBusy(false);
    }
  }

  // Instant-save toggle for Mobile Repair module — takes effect immediately everywhere
  async function toggleMobileRepair(nextVal: boolean) {
    setShopForm(f => ({ ...f, mobile_repair_enabled: nextVal }));
    try {
      const fd = new FormData();
      fd.append("mobile_repair_enabled", nextVal.toString());
      await api("/auth/shop-settings/", { method: "PATCH", body: fd });
      await reload(); // refresh user payload → POS/menus react instantly
      const isBn = lang === "bn";
      toast.success(nextVal
        ? (isBn ? "মোবাইল রিপেয়ার মডিউল চালু হয়েছে" : "Mobile Repair module enabled")
        : (isBn ? "মোবাইল রিপেয়ার মডিউল বন্ধ হয়েছে" : "Mobile Repair module disabled"));
    } catch (err: any) {
      setShopForm(f => ({ ...f, mobile_repair_enabled: !nextVal }));
      toast.error(err?.message || t("settings_err_shop"));
    }
  }

  async function updateShop(e: React.FormEvent) {
    e.preventDefault();
    setShopBusy(true);
    setShopSuccess(false);
    try {
      const formData = new FormData();
      formData.append("name", shopForm.name);
      formData.append("phone", shopForm.phone);
      formData.append("address", shopForm.address);
      formData.append("currency", shopForm.currency);
      formData.append("vat_enabled", shopForm.vat_enabled.toString());
      formData.append("vat_percent", shopForm.vat_percent.toString());
      formData.append("emi_enabled", shopForm.emi_enabled.toString());
      formData.append("delivery_enabled", shopForm.delivery_enabled.toString());
      formData.append("whatsapp_invoice_enabled", shopForm.whatsapp_invoice_enabled.toString());
      formData.append("barcode_prefix", shopForm.barcode_prefix);
      formData.append("offline_sale_mode", shopForm.offline_sale_mode.toString());
      formData.append("pos_print_mode", shopForm.pos_print_mode);
      formData.append("pos_receipt_enabled", shopForm.pos_receipt_enabled.toString());
      formData.append("pos_ui_layout", shopForm.pos_ui_layout || "standard");
      try {
        localStorage.setItem("stockwhisk_pos_layout", shopForm.pos_ui_layout || "standard");
      } catch {}
      formData.append("service_enabled", shopForm.service_enabled.toString());
      formData.append("reports_enabled", shopForm.reports_enabled.toString());
      formData.append("finance_enabled", shopForm.finance_enabled.toString());
      formData.append("mobile_repair_enabled", shopForm.mobile_repair_enabled.toString());

      if (logoFile) {
        formData.append("logo", logoFile);
      }

      const res = await api<any>("/auth/shop-settings/", { method: "PATCH", body: formData });
      if (res.logo) {
        setCurrentLogo(res.logo);
      }
      if (res.barcode_prefix !== undefined) {
        setShopForm((f) => ({ ...f, barcode_prefix: res.barcode_prefix || "" }));
      }
      setShopSuccess(true);
      await reload(); // reload user to get updated shop name
      setTimeout(() => setShopSuccess(false), 3000);
    } catch (err: any) {
      toast.error(err?.message || t("settings_err_shop"));
    } finally {
      setShopBusy(false);
    }
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setLogoFile(e.target.files[0]);
    }
  };

  const logoPreview = logoFile ? URL.createObjectURL(logoFile) : currentLogo;

  return (
    <div className="vstack gap-4" style={{ maxWidth: "48rem" }}>
      <h1 className="h4 fw-bold text-brand mb-0">{t("settings_title")}</h1>

      <div className="card shadow-sm">
        <div className="card-header fw-semibold">{t("settings_profile")}</div>
        <div className="card-body">
          <form onSubmit={updateProfile} className="vstack gap-3">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label small fw-medium">{t("settings_fname")}</label>
                <input className="form-control form-control-sm" value={profileForm.first_name} onChange={e => setProfileForm({...profileForm, first_name: e.target.value})} />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-medium">{t("settings_lname")}</label>
                <input className="form-control form-control-sm" value={profileForm.last_name} onChange={e => setProfileForm({...profileForm, last_name: e.target.value})} />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-medium">{t("settings_phone")}</label>
                <input className="form-control form-control-sm" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-medium">{t("settings_email")}</label>
                <input className="form-control form-control-sm" value={user?.email || ""} readOnly disabled />
              </div>
            </div>
            <div className="d-flex align-items-center gap-3 mt-2">
              <button type="submit" className="btn btn-primary btn-sm px-4" disabled={profileBusy}>
                {profileBusy ? t("settings_saving") : t("settings_save_prof")}
              </button>
              {profileSuccess && <span className="text-success small"><i className="bi bi-check-circle me-1"></i>{t("settings_saved")}</span>}
            </div>
          </form>
        </div>
      </div>

      {isOwner && (
        <div className="card shadow-sm">
          <div className="card-header fw-semibold d-flex align-items-center justify-content-between">
            <span>{t("settings_shop")}</span>
            {(user?.shop_code || user?.shop) && (
              <span className="badge rounded-pill bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 font-monospace px-3 py-1">
                {t("settings_shop_uid")}: {user?.shop_code || `SW-${1000 + (user?.shop || 0)}`}
              </span>
            )}
          </div>
          <div className="card-body">
            <form onSubmit={updateShop} className="vstack gap-3">
              <div className="row g-3">
                <div className="col-md-12">
                  <label className="form-label small fw-medium">{t("settings_shop_uid")}</label>
                  <input 
                    className="form-control form-control-sm font-monospace fw-bold text-brand bg-body-tertiary" 
                    readOnly 
                    disabled 
                    value={user?.shop_code || `SW-${1000 + (user?.shop || 0)}`} 
                  />
                  <div className="form-text" style={{ fontSize: "0.75rem" }}>
                    {t("settings_shop_uid_help")}
                  </div>
                </div>

                <div className="col-12 mb-3">
                  <label className="form-label small fw-medium d-block">{t("settings_shop_logo")}</label>
                  <div className="d-flex align-items-center gap-3">
                    <div 
                      className="border rounded d-flex align-items-center justify-content-center bg-body-tertiary shadow-sm"
                      style={{ width: "80px", height: "80px", overflow: "hidden" }}
                    >
                      {logoPreview ? (
                        <img src={logoPreview} alt="Shop Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      ) : (
                        <span className="fs-3 opacity-50">🏪</span>
                      )}
                    </div>
                    <div>
                      <button 
                        type="button" 
                        className="btn btn-outline-secondary btn-sm mb-1"
                        onClick={() => logoInputRef.current?.click()}
                      >
                        {t("settings_shop_logo_btn")}
                      </button>
                      <div className="small text-secondary" style={{ fontSize: "0.75rem" }}>
                        {t("settings_shop_logo_help")}
                      </div>
                      <input 
                        type="file" 
                        ref={logoInputRef} 
                        className="d-none" 
                        accept="image/*"
                        onChange={handleLogoChange}
                      />
                    </div>
                  </div>
                </div>

                <div className="col-md-12">
                  <label className="form-label small fw-medium">{t("settings_shop_name")}</label>
                  <input className="form-control form-control-sm" required value={shopForm.name} onChange={e => setShopForm({...shopForm, name: e.target.value})} />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-medium">{t("settings_shop_phone")}</label>
                  <input className="form-control form-control-sm" value={shopForm.phone} onChange={e => setShopForm({...shopForm, phone: e.target.value})} />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-medium">{t("settings_currency")}</label>
                  <input className="form-control form-control-sm" required value={shopForm.currency} onChange={e => setShopForm({...shopForm, currency: e.target.value})} />
                </div>
                <div className="col-md-12">
                  <label className="form-label small fw-medium">{t("settings_address")}</label>
                  <textarea className="form-control form-control-sm" rows={2} value={shopForm.address} onChange={e => setShopForm({...shopForm, address: e.target.value})}></textarea>
                </div>
                
                <div className="col-12 mt-3 mb-1 fw-medium text-secondary border-bottom pb-2">{t("settings_tax_title")}</div>
                <div className="col-md-12">
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" role="switch" id="vatSwitch" checked={shopForm.vat_enabled} onChange={e => setShopForm({...shopForm, vat_enabled: e.target.checked})} />
                    <label className="form-check-label small" htmlFor="vatSwitch">{t("settings_vat_en")}</label>
                  </div>
                </div>
                {shopForm.vat_enabled && (
                  <div className="col-md-6">
                    <label className="form-label small fw-medium">{t("settings_vat_pct")}</label>
                    <input type="number" step="0.01" min="0" className="form-control form-control-sm" value={shopForm.vat_percent} onChange={e => setShopForm({...shopForm, vat_percent: parseFloat(e.target.value) || 0})} />
                  </div>
                )}
                
                <div className="col-md-6">
                  <label className="form-label small fw-medium">{t("settings_barcode_prefix")}</label>
                  <input
                    type="text"
                    className="form-control form-control-sm text-uppercase font-monospace"
                    maxLength={5}
                    placeholder="e.g. VSE"
                    value={shopForm.barcode_prefix}
                    onChange={e => setShopForm({...shopForm, barcode_prefix: e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 5)})}
                  />
                  <div className="form-text small">{t("settings_barcode_help")}</div>
                </div>

                <div className="col-12 mt-3 mb-1 fw-medium text-secondary border-bottom pb-2">{t("settings_flags_title")}</div>
                <div className="col-md-12">
                  {/* Modular Sections Toggle Card */}
                  <div className="p-3 bg-body-tertiary rounded-3 mb-3 border">
                    <div className="fw-bold small text-brand mb-3 d-flex align-items-center gap-2">
                      <i className="bi bi-toggles2 text-primary fs-6"></i>
                      <span>{t("settings_flags_title")}</span>
                    </div>

                    {/* 1. Service Section Switch */}
                    <div className="form-check form-switch mb-3">
                      <input 
                        className="form-check-input" 
                        type="checkbox" 
                        role="switch" 
                        id="serviceSwitch" 
                        checked={shopForm.service_enabled} 
                        onChange={e => setShopForm({...shopForm, service_enabled: e.target.checked})} 
                      />
                      <label className="form-check-label small fw-semibold" htmlFor="serviceSwitch">
                        🔧 {t("settings_service_en")}
                      </label>
                      <div className="form-text" style={{ fontSize: "0.75rem" }}>
                        {t("settings_service_help")}
                      </div>
                    </div>

                    {/* 2. Reports Section Switch */}
                    <div className="form-check form-switch mb-3">
                      <input 
                        className="form-check-input" 
                        type="checkbox" 
                        role="switch" 
                        id="reportsSwitch" 
                        checked={shopForm.reports_enabled} 
                        onChange={e => setShopForm({...shopForm, reports_enabled: e.target.checked})} 
                      />
                      <label className="form-check-label small fw-semibold" htmlFor="reportsSwitch">
                        📊 {t("settings_reports_en")}
                      </label>
                      <div className="form-text" style={{ fontSize: "0.75rem" }}>
                        {t("settings_reports_help")}
                      </div>
                    </div>

                    {/* 3. Finance Section Switch */}
                    <div className="form-check form-switch mb-3">
                      <input 
                        className="form-check-input" 
                        type="checkbox" 
                        role="switch" 
                        id="financeSwitch" 
                        checked={shopForm.finance_enabled} 
                        onChange={e => setShopForm({...shopForm, finance_enabled: e.target.checked})} 
                      />
                      <label className="form-check-label small fw-semibold" htmlFor="financeSwitch">
                        💰 {t("settings_finance_en")}
                      </label>
                      <div className="form-text" style={{ fontSize: "0.75rem" }}>
                        {t("settings_finance_help")}
                      </div>
                    </div>

                    {/* 4. Mobile Repair Module Switch (shown only if superadmin master license is ON) */}
                    {shopForm.mobile_repair_master_enabled && (
                      <div className="form-check form-switch">
                        <input 
                          className="form-check-input" 
                          type="checkbox" 
                          role="switch" 
                          id="mobileRepairSwitch" 
                          checked={shopForm.mobile_repair_enabled} 
                          onChange={e => toggleMobileRepair(e.target.checked)} 
                        />
                        <label className="form-check-label small fw-semibold" htmlFor="mobileRepairSwitch">
                          🔧 {t("settings_repair_en")}
                        </label>
                        <div className="form-text" style={{ fontSize: "0.75rem" }}>
                          {t("settings_repair_help")}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" role="switch" id="emiSwitch" checked={shopForm.emi_enabled} onChange={e => setShopForm({...shopForm, emi_enabled: e.target.checked})} />
                    <label className="form-check-label small" htmlFor="emiSwitch">{t("settings_emi_en")}</label>
                  </div>
                  <div className="form-check form-switch mt-2">
                    <input className="form-check-input" type="checkbox" role="switch" id="deliverySwitch" checked={shopForm.delivery_enabled} onChange={e => setShopForm({...shopForm, delivery_enabled: e.target.checked})} />
                    <label className="form-check-label small" htmlFor="deliverySwitch">{t("settings_del_en")}</label>
                  </div>
                  <div className="form-check form-switch mt-2">
                    <input className="form-check-input" type="checkbox" role="switch" id="whatsappSwitch" checked={shopForm.whatsapp_invoice_enabled} onChange={e => setShopForm({...shopForm, whatsapp_invoice_enabled: e.target.checked})} />
                    <label className="form-check-label small" htmlFor="whatsappSwitch">{t("settings_wa_en")}</label>
                  </div>
                  <div className="form-check form-switch mt-3 pt-2 border-top">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id="offlineSaleSwitch"
                      checked={shopForm.offline_sale_mode}
                      onChange={e => setShopForm({...shopForm, offline_sale_mode: e.target.checked})}
                    />
                    <label className="form-check-label small fw-semibold" htmlFor="offlineSaleSwitch">
                      {t("settings_offline_en")}
                    </label>
                    <div className="form-text" style={{ fontSize: "0.75rem" }}>
                      {t("settings_offline_help")}
                    </div>
                  </div>
                </div>

                {/* ── Invoice & Print Settings ── */}
                <div className="col-12 mt-3 mb-1 fw-medium text-secondary border-bottom pb-2">
                  {t("settings_print_section_title")}
                </div>
                <div className="col-md-12">
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id="posReceiptSwitch"
                      checked={shopForm.pos_receipt_enabled}
                      onChange={e => setShopForm({...shopForm, pos_receipt_enabled: e.target.checked})}
                    />
                    <label className="form-check-label small fw-semibold" htmlFor="posReceiptSwitch">
                      {t("settings_pos_receipt_enable")}
                    </label>
                    <div className="form-text" style={{ fontSize: "0.75rem" }}>
                      {t("settings_pos_receipt_enable_desc")}
                    </div>
                  </div>
                </div>
                {shopForm.pos_receipt_enabled && (
                  <div className="col-md-12 mt-2">
                    <label className="form-label small fw-medium">{t("settings_print_mode_label")}</label>
                    <select
                      className="form-select form-select-sm"
                      value={shopForm.pos_print_mode}
                      onChange={e => setShopForm({...shopForm, pos_print_mode: e.target.value})}
                    >
                      <option value="ask">🔀 {t("settings_print_mode_ask")}</option>
                      <option value="pos">🧾 {t("settings_print_mode_pos")}</option>
                      <option value="regular">📄 {t("settings_print_mode_regular")}</option>
                    </select>
                  </div>
                )}

                <div className="col-md-12 mt-3">
                  <label className="form-label small fw-semibold text-dark">
                    {lang === "bn" ? "পিওএস (POS) ইন্টারফেস ডিজাইন / লেআউট" : "POS Interface Design / Layout"}
                  </label>
                  <select
                    className="form-select form-select-sm"
                    value={shopForm.pos_ui_layout || "standard"}
                    onChange={e => setShopForm({...shopForm, pos_ui_layout: e.target.value})}
                  >
                    <option value="standard">
                      {lang === "bn" ? "📋 স্ট্যান্ডার্ড পিওএস (Standard POS - বারকোড ও লিস্ট সার্চ)" : "📋 Standard POS (Barcode & Search Focused)"}
                    </option>
                    <option value="visual_grid">
                      {lang === "bn" ? "🛍️ ভিজ্যুয়াল প্রোডাক্ট গ্রিড পিওএস (Visual Product Grid POS - ক্যাটালগ ও বারকোড/ওয়ারেন্টি ড্রয়ার)" : "🛍️ Visual Product Grid POS (Product Grid & Barcode/Warranty Selector)"}
                    </option>
                  </select>
                  <div className="form-text small text-secondary mt-1" style={{ fontSize: "0.76rem" }}>
                    {lang === "bn"
                      ? "ভিজ্যুয়াল গ্রিড মোডে প্ল্যাটফর্মের স্টক থাকা পণ্যসমূহ বড় কার্ড গ্রিডে প্রদর্শিত হবে এবং বারকোড/ওয়ারেন্টিযুক্ত পণ্য বিক্রির সময় সরাসরি বারকোড লিস্ট ওপেন হবে।"
                      : "Visual Grid mode shows available in-stock products in a responsive grid and opens a barcode & warranty list upon clicking serialized products."}
                  </div>
                </div>
              </div>
              <div className="d-flex align-items-center gap-3 mt-3">
                <button type="submit" className="btn btn-primary btn-sm px-4" disabled={shopBusy}>
                  {shopBusy ? t("settings_saving") : t("settings_save_shop")}
                </button>
                {shopSuccess && <span className="text-success small"><i className="bi bi-check-circle me-1"></i>{t("settings_saved")}</span>}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── WhatsApp QR & 1-Tap Automation Card ── */}
      {isOwner && (
        <div className="card shadow-sm mb-4 border-0" style={{ borderRadius: 12, overflow: "hidden" }}>
          <div
            className="card-header bg-white py-3 px-4 d-flex justify-content-between align-items-center border-bottom"
            style={{ background: "linear-gradient(to right, #f8fafc, #ffffff)" }}
          >
            <div className="d-flex align-items-center gap-2">
              <span style={{ fontSize: "1.4rem" }}>💬</span>
              <div>
                <h6 className="mb-0 fw-bold text-slate-800">
                  {lang === "bn" ? "WhatsApp ইন্টিগ্রেশন ও অটোমেটেড বিলিং" : "WhatsApp Integration & Automated Billing"}
                </h6>
                <p className="text-muted small mb-0" style={{ fontSize: "0.8rem" }}>
                  {lang === "bn" 
                    ? "শপের নিজস্ব WhatsApp কানেক্ট করে পিওএস ও ইনভয়েস থেকে ১-ক্লিকে সরাসরি বিল পাঠান" 
                    : "Connect your shop WhatsApp to send invoices in 1-click directly from POS"}
                </p>
              </div>
            </div>
            <div>
              {waConfig.is_connected ? (
                <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2 rounded-pill fw-medium">
                  ● Connected ({waConfig.connected_phone || "Active"})
                </span>
              ) : (
                <span className="badge bg-secondary-subtle text-secondary border px-3 py-2 rounded-pill fw-medium">
                  ○ Disconnected
                </span>
              )}
            </div>
          </div>

          <div className="card-body p-4">
            <div className="row g-4 align-items-center">
              <div className="col-md-7">
                <div className="p-3 rounded-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div className="fw-semibold text-slate-900 mb-1" style={{ fontSize: "0.95rem" }}>
                    {waConfig.is_connected ? (
                      <span className="text-success">✅ WhatsApp সেশন সক্রিয় রয়েছে</span>
                    ) : (
                      <span>📲 WhatsApp সংযোগ স্থাপন করুন</span>
                    )}
                  </div>
                  <div className="text-slate-600 small mb-3">
                    {waConfig.is_connected ? (
                      <>
                        কানেক্টেড নম্বর: <strong>{waConfig.connected_phone}</strong> {waConfig.connected_name && `(${waConfig.connected_name})`}
                        <br />
                        এখন পিওএস থেকে সরাসরি ১-ট্যাপে কাস্টমারের হোয়াটসঅ্যাপে চালান পৌঁছাবে।
                      </>
                    ) : (
                      "আপনার মোবাইল দিয়ে QR কোড স্ক্যান করে এই শপের জন্য আলাদা WhatsApp যুক্ত করুন। একবার যুক্ত করলে ক্যাশিয়ার ব্রাউজার ছাড়াই সরাসরি বিল পাঠাতে পারবে।"
                    )}
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    {waConfig.is_connected ? (
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm px-3 rounded-2 fw-medium"
                        onClick={handleDisconnectWhatsApp}
                        disabled={waBusy}
                      >
                        {waBusy ? "Disconnecting..." : "🔌 ডিসকানেক্ট করুন"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-success btn-sm px-3 py-2 rounded-2 fw-medium d-flex align-items-center gap-2 shadow-sm"
                        onClick={() => setWaModalOpen(true)}
                        style={{ background: "linear-gradient(135deg, #25D366, #128C7E)", border: "none" }}
                      >
                        <span>📷</span>
                        <span>QR কোড স্ক্যান করে কানেক্ট করুন</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-light btn-sm border px-3"
                      onClick={loadWhatsAppStatus}
                      title="রিফ্রেশ স্ট্যাটাস"
                    >
                      🔄
                    </button>
                  </div>
                </div>
              </div>

              <div className="col-md-5">
                <div className="p-3 rounded-3 border bg-white">
                  <div className="fw-semibold text-slate-900 mb-2 small">
                    ⚙️ ডিফল্ট সেন্ডিং মোড (Dual Mode):
                  </div>

                  <div className="d-flex flex-column gap-2">
                    <label
                      className={`p-2 rounded-2 border d-flex align-items-start gap-2 cursor-pointer ${
                        waConfig.default_mode === "direct" ? "border-primary bg-primary-subtle text-primary-emphasis" : "bg-light"
                      }`}
                      style={{ cursor: "pointer", fontSize: "0.85rem" }}
                    >
                      <input
                        type="radio"
                        name="wa_mode"
                        className="mt-1"
                        checked={waConfig.default_mode === "direct"}
                        onChange={() => updateWaPrefs({ default_mode: "direct" })}
                      />
                      <div>
                        <div className="fw-bold">⚡ মোড ১: ১-ট্যাপ ডিরেক্ট সেন্ড (সুপার ফাস্ট)</div>
                        <div className="small text-muted" style={{ fontSize: "0.75rem" }}>
                          সরাসরি সফটওয়্যার থেকে ১-ক্লিকে কাস্টমারের কাছে বিল যাবে (ব্রাউজার ওপেন হবে না)।
                        </div>
                      </div>
                    </label>

                    <label
                      className={`p-2 rounded-2 border d-flex align-items-start gap-2 cursor-pointer ${
                        waConfig.default_mode === "browser" ? "border-primary bg-primary-subtle text-primary-emphasis" : "bg-light"
                      }`}
                      style={{ cursor: "pointer", fontSize: "0.85rem" }}
                    >
                      <input
                        type="radio"
                        name="wa_mode"
                        className="mt-1"
                        checked={waConfig.default_mode === "browser"}
                        onChange={() => updateWaPrefs({ default_mode: "browser" })}
                      />
                      <div>
                        <div className="fw-bold">🔗 মোড ২: WhatsApp Web ব্রাউজার লিঙ্ক</div>
                        <div className="small text-muted" style={{ fontSize: "0.75rem" }}>
                          পূর্বের সিস্টেমের মতো ক্লিক করলে ব্রাউজারে wa.me প্রি-ফিল্ড মেসেজ খুলবে।
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── POS Hardware & Digital Scale Card ── */}
      {isOwner && hasModule("pos_hardware") && (
        <div className="card shadow-sm mb-4 border-0" style={{ borderRadius: 12, overflow: "hidden" }}>
          <div className="card-header bg-white py-3 px-4 border-bottom">
            <div className="d-flex align-items-center gap-2">
              <span style={{ fontSize: "1.4rem" }}>⚖️</span>
              <div>
                <h6 className="mb-0 fw-bold text-slate-800">
                  {lang === "bn" ? "ডিজিটাল ওজন স্কেল ও হার্ডওয়্যার" : "Digital Weight Scale & POS Hardware"}
                </h6>
                <p className="text-muted small mb-0" style={{ fontSize: "0.8rem" }}>
                  {lang === "bn" 
                    ? "সুপারশপ ও গ্রোসারি স্কেল বারকোড অটোমেশন (প্রিফিক্স, ওজন ও মূল্য স্বয়ংক্রিয় রিডিং)" 
                    : "Configure embedded scale barcode prefixes for automatic weight and price extraction"}
                </p>
              </div>
            </div>
          </div>
          <div className="card-body p-4">
            <div className="row g-3 align-items-center">
              <div className="col-md-6">
                <label className="form-label small fw-semibold text-secondary">
                  {lang === "bn" ? "স্কেল বারকোড প্রিফিক্স (Prefix)" : "Scale Barcode Prefix"}
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="e.g. 20 or 21"
                  value={shopForm.barcode_prefix}
                  onChange={(e) => setShopForm({ ...shopForm, barcode_prefix: e.target.value })}
                />
                <div className="form-text small" style={{ fontSize: "0.75rem" }}>
                  {lang === "bn"
                    ? "স্কেলের মুদ্রিত বারকোড এই সংখ্যা দিয়ে শুরু হলে (যেমন ২০), পিওএস সরাসরি পণ্যের সঠিক ওজন ও মোট মূল্য আলাদা করে কার্টে যোগ করবে।"
                    : "Barcodes starting with this prefix (e.g., 20) are automatically decoded into product SKU and weight/price."}
                </div>
              </div>
              <div className="col-md-6">
                <div className="p-3 rounded-3 bg-light border">
                  <div className="small fw-bold text-slate-700 mb-1">
                    {lang === "bn" ? "কিভাবে কাজ করে?" : "How Scale Decoding Works"}
                  </div>
                  <div className="text-muted small" style={{ fontSize: "0.8rem" }}>
                    {lang === "bn"
                      ? "স্কেল থেকে বের হওয়া ১৩-ডিজিট বারকোড (যেমন 20PPPPPWWWWWX) রিড করে পিওএস স্বয়ংক্রিয়ভাবে মিলিগ্রাম/গ্রাম হিসেবে ওজন ইনপুট করে নেয়।"
                      : "The 13-digit EAN barcode embeds product code and weighed quantity, eliminating manual weight typing at POS."}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Wireless Phone Scanner Bridge Card ── */}
      {hasModule("scanner_bridge") && (
        <div className="card shadow-sm mb-4 border-0" style={{ borderRadius: 12, overflow: "hidden" }}>
          <div className="card-header bg-white py-3 px-4 border-bottom">
            <div className="d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2">
                <span style={{ fontSize: "1.4rem" }}>📱</span>
                <div>
                  <h6 className="mb-0 fw-bold text-slate-800">
                    {lang === "bn" ? "ওয়্যারলেস ফোন স্ক্যানার ব্রিজ" : "Wireless Phone Scanner Bridge"}
                  </h6>
                  <p className="text-muted small mb-0" style={{ fontSize: "0.8rem" }}>
                    {lang === "bn" 
                      ? "যে কোনো মোবাইল ফোনকে হাই-স্পিড ওয়্যারলেস বারকোড স্ক্যানার হিসেবে ব্যবহার করুন" 
                      : "Use any smartphone camera as a wireless laser barcode scanner for this POS"}
                  </p>
                </div>
              </div>
              <a
                href="/scanner"
                target="_blank"
                rel="noreferrer"
                className="btn btn-sm btn-outline-primary px-3 rounded-pill fw-medium"
              >
                <i className="bi-box-arrow-up-right me-1" />
                {lang === "bn" ? "স্ক্যানার খুলুন" : "Launch Scanner"}
              </a>
            </div>
          </div>
          <div className="card-body p-4">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 p-3 rounded-3 bg-light border">
              <div>
                <div className="fw-semibold text-slate-900 mb-1" style={{ fontSize: "0.95rem" }}>
                  {lang === "bn" ? "মোবাইল স্ক্যানার পেয়ারিং" : "Mobile Phone Pairing"}
                </div>
                <div className="text-muted small">
                  {lang === "bn"
                    ? "মোবাইলের ব্রাউজারে /scanner ওপেন করে শপে লগইন করুন। ক্যামেরার সামনে বারকোড ধরলে তাৎক্ষণিকভাবে পিসির পিওএস স্ক্রিনে আইটেমটি যুক্ত হবে।"
                    : "Open /scanner on your smartphone and log into this shop. Scanning barcodes with the phone camera instantly transmits items to this POS screen."}
                </div>
              </div>
              <div className="text-end">
                <a
                  href="/scanner"
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary btn-sm px-4 rounded-pill shadow-xs fw-bold"
                >
                  <i className="bi-camera-fill me-1" />
                  {lang === "bn" ? "মোবাইল স্ক্যানার লিঙ্ক" : "Open Phone Scanner"}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Developer API & Public Integration Card ── */}
      {isOwner && hasModule("public_api") && (
        <div className="card shadow-sm mb-4 border-0" style={{ borderRadius: 12, overflow: "hidden" }}>
          <div className="card-header bg-white py-3 px-4 border-bottom">
            <div className="d-flex align-items-center gap-2">
              <span style={{ fontSize: "1.4rem" }}>⚡</span>
              <div>
                <h6 className="mb-0 fw-bold text-slate-800">
                  {lang === "bn" ? "ডেভেলপার এপিআই ও এক্সটার্নাল এক্সেস" : "Developer REST API & Integrations"}
                </h6>
                <p className="text-muted small mb-0" style={{ fontSize: "0.8rem" }}>
                  {lang === "bn" 
                    ? "আপনার কাস্টম ওয়েবসাইট, মোবাইল অ্যাপ বা ইআরপি সিস্টেমের সাথে স্টক ও বিক্রয় সংযুক্ত করুন" 
                    : "Connect custom mobile apps, e-commerce, or enterprise systems to StockWhisk"}
                </p>
              </div>
            </div>
          </div>
          <div className="card-body p-4">
            <div className="row g-3">
              <div className="col-md-6">
                <div className="small fw-semibold text-secondary mb-1">
                  {lang === "bn" ? "এপিআই বেস ইউআরএল (API Base URL)" : "API Base URL"}
                </div>
                <div className="p-2 bg-light rounded border text-monospace small fw-bold text-dark">
                  https://customshop.picasaerp.com/api/v1/
                </div>
              </div>
              <div className="col-md-6">
                <div className="small fw-semibold text-secondary mb-1">
                  {lang === "bn" ? "শপ আইডেন্টিফায়ার (Tenant ID)" : "Shop Tenant Identifier"}
                </div>
                <div className="p-2 bg-light rounded border text-monospace small fw-bold text-dark">
                  {user?.shop_code || (user?.shop ? `shop-${user.shop}` : "tenant-default")}
                </div>
              </div>
            </div>
            <div className="mt-3 text-muted small">
              {lang === "bn"
                ? "সুরক্ষিত Bearer Token তৈরি এবং ওয়েবশপ ইন্টিগ্রেশন কনফিগারেশনের জন্য প্ল্যাটফর্ম অ্যাডমিনিস্ট্রেশনের সহায়তা নিন অথবা ইন্টিগ্রেশন মেনু ব্যবহার করুন।"
                : "Generate secure REST tokens in Platform Administration or use the Integrations module to connect WooCommerce/Shopify."}
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp QR Modal */}
      <WhatsAppConnectModal
        isOpen={waModalOpen}
        onClose={() => setWaModalOpen(false)}
        onConnected={(phone) => {
          setWaConfig(prev => ({ ...prev, is_connected: true, connected_phone: phone || "" }));
          loadWhatsAppStatus();
        }}
      />

      <div className="row g-3">
        <div className="col-md-6">
          <Card>
            <div className="small text-secondary">{t("settings_plan")}</div>
            <div className="fs-5 fw-bold text-capitalize">{billing?.plan || "—"}</div>
          </Card>
        </div>
        <div className="col-md-6">
          <Card>
            <div className="small text-secondary">{t("settings_sub_status")}</div>
            <div className="fs-5 fw-bold">
              {billing?.on_trial ? t("settings_trial") : billing?.status || "—"}
              {billing?.trial_ends_at && <span className="small text-secondary ms-2">{t("settings_ends", { date: fmtDate(billing.trial_ends_at) })}</span>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
