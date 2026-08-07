"use client";

import { useAuth } from "@/components/AuthProvider";
import { Card } from "@/components/ui";
import { fmtDate } from "@/components/ui";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const { user, billing, isOwner, reload } = useAuth();
  
  const [profileForm, setProfileForm] = useState({ first_name: "", last_name: "", phone: "" });
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  const [shopForm, setShopForm] = useState({ name: "", phone: "", address: "", currency: "BDT", vat_enabled: false, vat_percent: 0 });
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
      api<any>("/accounts/auth/shop-settings/").then(data => {
        setShopForm({
          name: data.name || "",
          phone: data.phone || "",
          address: data.address || "",
          currency: data.currency || "BDT",
          vat_enabled: data.vat_enabled || false,
          vat_percent: data.vat_percent || 0,
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
      await api("/accounts/auth/me/", { method: "PATCH", body: profileForm });
      setProfileSuccess(true);
      await reload();
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      alert(err?.message || "Failed to update profile");
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
      
      if (logoFile) {
        formData.append("logo", logoFile);
      }

      const res = await api<any>("/accounts/auth/shop-settings/", { method: "PATCH", body: formData });
      if (res.logo) {
        setCurrentLogo(res.logo);
      }
      setShopSuccess(true);
      await reload(); // reload user to get updated shop name
      setTimeout(() => setShopSuccess(false), 3000);
    } catch (err: any) {
      alert(err?.message || "Failed to update shop settings");
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
      <h1 className="h4 fw-bold text-brand mb-0">Settings</h1>

      <div className="card shadow-sm">
        <div className="card-header fw-semibold">Your Profile</div>
        <div className="card-body">
          <form onSubmit={updateProfile} className="vstack gap-3">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label small fw-medium">First Name</label>
                <input className="form-control form-control-sm" value={profileForm.first_name} onChange={e => setProfileForm({...profileForm, first_name: e.target.value})} />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-medium">Last Name</label>
                <input className="form-control form-control-sm" value={profileForm.last_name} onChange={e => setProfileForm({...profileForm, last_name: e.target.value})} />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-medium">Phone</label>
                <input className="form-control form-control-sm" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-medium">Email (Read-only)</label>
                <input className="form-control form-control-sm bg-light" value={user?.email || ""} readOnly disabled />
              </div>
            </div>
            <div className="d-flex align-items-center gap-3 mt-2">
              <button type="submit" className="btn btn-primary btn-sm px-4" disabled={profileBusy}>
                {profileBusy ? "Saving..." : "Save Profile"}
              </button>
              {profileSuccess && <span className="text-success small"><i className="bi bi-check-circle me-1"></i>Saved</span>}
            </div>
          </form>
        </div>
      </div>

      {isOwner && (
        <div className="card shadow-sm">
          <div className="card-header fw-semibold">Shop Settings</div>
          <div className="card-body">
            <form onSubmit={updateShop} className="vstack gap-3">
              <div className="row g-3">
                <div className="col-12 mb-3">
                  <label className="form-label small fw-medium d-block">Shop Logo</label>
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
                        Choose Image
                      </button>
                      <div className="small text-secondary" style={{ fontSize: "0.75rem" }}>
                        Recommended size: 200x50px. Max 2MB.
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
                  <label className="form-label small fw-medium">Shop Name</label>
                  <input className="form-control form-control-sm" required value={shopForm.name} onChange={e => setShopForm({...shopForm, name: e.target.value})} />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-medium">Shop Phone</label>
                  <input className="form-control form-control-sm" value={shopForm.phone} onChange={e => setShopForm({...shopForm, phone: e.target.value})} />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-medium">Currency</label>
                  <input className="form-control form-control-sm" required value={shopForm.currency} onChange={e => setShopForm({...shopForm, currency: e.target.value})} />
                </div>
                <div className="col-md-12">
                  <label className="form-label small fw-medium">Address</label>
                  <textarea className="form-control form-control-sm" rows={2} value={shopForm.address} onChange={e => setShopForm({...shopForm, address: e.target.value})}></textarea>
                </div>
                
                <div className="col-12 mt-3 mb-1 fw-medium text-secondary border-bottom pb-2">Tax / VAT Settings</div>
                <div className="col-md-12">
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" role="switch" id="vatSwitch" checked={shopForm.vat_enabled} onChange={e => setShopForm({...shopForm, vat_enabled: e.target.checked})} />
                    <label className="form-check-label small" htmlFor="vatSwitch">Enable VAT</label>
                  </div>
                </div>
                {shopForm.vat_enabled && (
                  <div className="col-md-6">
                    <label className="form-label small fw-medium">VAT Percentage (%)</label>
                    <input type="number" step="0.01" min="0" className="form-control form-control-sm" value={shopForm.vat_percent} onChange={e => setShopForm({...shopForm, vat_percent: parseFloat(e.target.value) || 0})} />
                  </div>
                )}
              </div>
              <div className="d-flex align-items-center gap-3 mt-3">
                <button type="submit" className="btn btn-primary btn-sm px-4" disabled={shopBusy}>
                  {shopBusy ? "Saving..." : "Save Shop Settings"}
                </button>
                {shopSuccess && <span className="text-success small"><i className="bi bi-check-circle me-1"></i>Saved</span>}
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="row g-3">
        <div className="col-md-6">
          <Card>
            <div className="small text-secondary">Current plan</div>
            <div className="fs-5 fw-bold text-capitalize">{billing?.plan || "—"}</div>
          </Card>
        </div>
        <div className="col-md-6">
          <Card>
            <div className="small text-secondary">Subscription status</div>
            <div className="fs-5 fw-bold">
              {billing?.on_trial ? "Trial" : billing?.status || "—"}
              {billing?.trial_ends_at && <span className="small text-secondary ms-2">ends {fmtDate(billing.trial_ends_at)}</span>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
