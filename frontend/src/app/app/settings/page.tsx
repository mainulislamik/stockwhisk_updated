"use client";

import { useAuth } from "@/components/AuthProvider";
import { Card } from "@/components/ui";
import { fmtDate } from "@/components/ui";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SettingsPage() {
  const { user, billing, isOwner, reload } = useAuth();
  const { t } = useLanguage();
  
  const [profileForm, setProfileForm] = useState({ first_name: "", last_name: "", phone: "" });
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  const [shopForm, setShopForm] = useState({ name: "", phone: "", address: "", currency: "BDT", vat_enabled: false, vat_percent: 0, emi_enabled: false, delivery_enabled: true, whatsapp_invoice_enabled: true, barcode_prefix: "", offline_sale_mode: false });
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
        });
        if (data.logo) {
          setCurrentLogo(data.logo);
        }
      }).catch(console.error);
    }
  }, [user, isOwner]);

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
