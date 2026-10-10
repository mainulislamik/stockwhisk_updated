"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi, api } from "@/lib/api";
import { ErrorState, Spinner, fmtDate } from "@/components/ui";
import { useLanguage } from "@/contexts/LanguageContext";
import toast from "react-hot-toast";

type CourierAccount = {
  id: number;
  name: string;
  provider: string;
  provider_display: string;
  merchant_id: string;
  is_active: boolean;
  is_default: boolean;
  default_pickup_address: Record<string, any>;
  metadata: Record<string, any>;
  has_credentials: boolean;
  masked_credentials: Record<string, any>;
  created_at: string;
};

type CourierShipment = {
  id: number;
  account: number;
  account_name: string;
  provider: string;
  sale: number | null;
  sale_invoice_no: string | null;
  external_order: number | null;
  external_order_number: string | null;
  tracking_id: string;
  consignment_id: string;
  tracking_url: string;
  status: string;
  status_display: string;
  raw_status: string;
  cod_amount: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  recipient_city: string;
  created_at: string;
};

export default function CouriersIntegrationPage() {
  const { lang } = useLanguage();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CourierAccount | null>(null);
  const [validatingId, setValidatingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Shipments & Failures Drawer State
  const [viewingAccount, setViewingAccount] = useState<CourierAccount | null>(null);
  const [shipments, setShipments] = useState<CourierShipment[]>([]);
  const [loadingShipments, setLoadingShipments] = useState(false);
  const [shipmentFilter, setShipmentFilter] = useState<"all" | "failures">("all");

  // Add Account Form
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    provider: "steadfast",
    merchant_id: "",
    api_key: "",
    api_secret: "",
    access_token: "",
    client_id: "",
    client_secret: "",
    username: "",
    password: "",
    store_id: "",
    is_default: false,
    pickup_address: "",
    pickup_city: "",
  });

  const { data: rawAccounts, loading, error, mutate } = useApi<any>("/integrations/couriers/");
  const accounts: CourierAccount[] = Array.isArray(rawAccounts)
    ? rawAccounts
    : (rawAccounts?.results || []);

  async function handleAddCourier(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/integrations/couriers/", {
        method: "POST",
        body: {
          name: form.name,
          provider: form.provider,
          merchant_id: form.merchant_id || "",
          is_default: form.is_default,
          default_pickup_address: {
            address: form.pickup_address,
            city: form.pickup_city,
          },
          api_key: form.api_key || form.client_id,
          api_secret: form.api_secret || form.client_secret,
          access_token: form.access_token || form.api_key,
          client_id: form.client_id,
          client_secret: form.client_secret,
          username: form.username,
          password: form.password,
          store_id: form.store_id,
        },
      });

      toast.success(
        lang === "bn"
          ? "কুরিয়ার অ্যাকাউন্ট সফলভাবে যুক্ত হয়েছে এবং ক্রেডেনশিয়াল সুরক্ষিত রাখা হয়েছে"
          : "Courier account connected successfully with encrypted credentials"
      );
      setShowAddModal(false);
      setEditingAccount(null);
      setForm({
        name: "",
        provider: "steadfast",
        merchant_id: "",
        api_key: "",
        api_secret: "",
        access_token: "",
        client_id: "",
        client_secret: "",
        username: "",
        password: "",
        store_id: "",
        is_default: false,
        pickup_address: "",
        pickup_city: "",
      });
      mutate();
    } catch (err: any) {
      toast.error(err?.message || (lang === "bn" ? "কুরিয়ার অ্যাকাউন্ট যুক্ত করা যায়নি" : "Failed to add courier account"));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateCourier(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAccount) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        name: form.name,
        merchant_id: form.merchant_id || "",
        is_default: form.is_default,
        default_pickup_address: {
          address: form.pickup_address,
          city: form.pickup_city,
        },
      };
      if (form.api_key) payload.api_key = form.api_key;
      if (form.api_secret) payload.api_secret = form.api_secret;
      if (form.access_token) payload.access_token = form.access_token;
      if (form.client_id) payload.client_id = form.client_id;
      if (form.client_secret) payload.client_secret = form.client_secret;
      if (form.username) payload.username = form.username;
      if (form.password) payload.password = form.password;
      if (form.store_id) payload.store_id = form.store_id;

      await api(`/integrations/couriers/${editingAccount.id}/`, {
        method: "PATCH",
        body: payload,
      });

      toast.success(
        lang === "bn"
          ? "কুরিয়ার অ্যাকাউন্ট ও ক্রেডেনশিয়াল সফলভাবে আপডেট হয়েছে"
          : "Courier account & credentials updated successfully"
      );
      setEditingAccount(null);
      mutate();
    } catch (err: any) {
      toast.error(err?.message || (lang === "bn" ? "আপডেট করা সম্ভব হয়নি" : "Failed to update"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCourier(acc: CourierAccount) {
    if (!confirm(lang === "bn" ? `আপনি কি নিশ্চিত যে '${acc.name}' কুরিয়ার অ্যাকাউন্ট মুছে ফেলতে চান?` : `Are you sure you want to delete '${acc.name}'?`)) {
      return;
    }
    setDeletingId(acc.id);
    try {
      await api(`/integrations/couriers/${acc.id}/`, { method: "DELETE" });
      toast.success(lang === "bn" ? "কুরিয়ার অ্যাকাউন্ট মুছে ফেলা হয়েছে" : "Courier account deleted");
      mutate();
    } catch (err: any) {
      toast.error(err?.message || (lang === "bn" ? "মুছে ফেলা সম্ভব হয়নি" : "Failed to delete"));
    } finally {
      setDeletingId(null);
    }
  }

  function startEdit(acc: CourierAccount) {
    setEditingAccount(acc);
    setForm({
      name: acc.name,
      provider: acc.provider,
      merchant_id: acc.merchant_id || "",
      api_key: "",
      api_secret: "",
      access_token: "",
      client_id: "",
      client_secret: "",
      username: "",
      password: "",
      store_id: "",
      is_default: acc.is_default,
      pickup_address: acc.default_pickup_address?.address || "",
      pickup_city: acc.default_pickup_address?.city || "",
    });
  }

  async function handleValidateCredentials(account: CourierAccount) {
    setValidatingId(account.id);
    try {
      const res = await api<{ success: boolean; message: string }>(
        `/integrations/couriers/${account.id}/validate-credentials/`,
        { method: "POST" }
      );
      if (res?.success) {
        toast.success(
          lang === "bn"
            ? `ক্রেডেনশিয়াল সঠিক! ${account.name} এর সাথে সফলভাবে যোগাযোগ স্থাপন করা গেছে`
            : `Credentials valid! Connected to ${account.name} successfully`
        );
      } else {
        toast.error(res?.message || (lang === "bn" ? "ক্রেডেনশিয়াল যাচাই ব্যর্থ হয়েছে" : "Credentials validation failed"));
      }
      mutate();
    } catch (err: any) {
      toast.error(
        err?.message || (lang === "bn" ? "ক্রেডেনশিয়াল যাচাই ত্রুটি" : "Credential validation error")
      );
    } finally {
      setValidatingId(null);
    }
  }

  async function handleToggleActive(account: CourierAccount) {
    setTogglingId(account.id);
    try {
      await api(`/integrations/couriers/${account.id}/toggle-active/`, { method: "POST" });
      toast.success(
        lang === "bn"
          ? `অ্যাকাউন্ট স্ট্যাটাস পরিবর্তন করা হয়েছে`
          : "Account status toggled successfully"
      );
      mutate();
    } catch (err: any) {
      toast.error(err?.message || "Status toggle error");
    } finally {
      setTogglingId(null);
    }
  }

  async function loadShipments(account: CourierAccount, filter: "all" | "failures" = "all") {
    setViewingAccount(account);
    setShipmentFilter(filter);
    setLoadingShipments(true);
    try {
      const endpoint =
        filter === "failures"
          ? `/integrations/couriers/${account.id}/failures/`
          : `/integrations/couriers/${account.id}/shipments/`;
      const data = await api<CourierShipment[]>(endpoint);
      setShipments(data || []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load shipments");
      setShipments([]);
    } finally {
      setLoadingShipments(false);
    }
  }

  if (loading) return <Spinner label={lang === "bn" ? "কুরিয়ার অ্যাকাউন্ট তালিকা লোড হচ্ছে…" : "Loading Courier Accounts…"} />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="vstack gap-4">
      {/* Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 pb-2 border-bottom">
        <div>
          <div className="hstack gap-2 small mb-1">
            <Link href="/app/integrations" className="text-muted text-decoration-none">
              <i className="bi bi-arrow-left me-1"></i>
              {lang === "bn" ? "ইন্টিগ্রেশন ড্যাশবোর্ড" : "Integrations Dashboard"}
            </Link>
          </div>
          <h1 className="h4 fw-bold mb-1 text-dark">
            <i className="bi bi-truck me-2 text-info"></i>
            {lang === "bn" ? "কুরিয়ার ইন্টিগ্রেশন ও পার্টনার ম্যানেজমেন্ট" : "Courier Integrations & Accounts"}
          </h1>
          <p className="text-muted small mb-0">
            {lang === "bn"
              ? "পাঠাও, স্টিডফাস্ট, রেডএক্স ইত্যাদি কুরিয়ার অ্যাকাউন্টের মাধ্যমে স্বয়ংক্রিয় পার্সেল বুকিং ও ট্র্যাকিং"
              : "Manage courier API credentials, automated parcel booking, and live shipment tracking"}
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm">
          <i className="bi bi-plus-lg me-1"></i>
          {lang === "bn" ? "কুরিয়ার অ্যাকাউন্ট যুক্ত করুন" : "Add Courier Account"}
        </button>
      </div>

      {/* Couriers List */}
      <div className="row g-3">
        {accounts && accounts.length > 0 ? (
          accounts.map((acc) => (
            <div key={acc.id} className="col-12">
              <div className="card shadow-sm border bg-white">
                <div className="card-body">
                  <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
                    <div className="d-flex gap-3 align-items-center">
                      <div className="rounded-3 p-3 bg-light border text-info fs-3">
                        <i className="bi bi-box-seam-fill"></i>
                      </div>
                      <div>
                        <div className="d-flex align-items-center gap-2">
                          <h2 className="h5 fw-bold mb-0 text-dark">{acc.name}</h2>
                          {acc.is_default ? (
                            <span className="badge bg-primary-subtle text-primary">
                              <i className="bi bi-star-fill me-1"></i>
                              {lang === "bn" ? "ডিফল্ট কুরিয়ার" : "Default Courier"}
                            </span>
                          ) : null}
                          <span
                            className={`badge ${
                              acc.is_active ? "bg-success-subtle text-success" : "bg-secondary-subtle text-secondary"
                            }`}
                          >
                            {acc.is_active ? (lang === "bn" ? "সক্রিয়" : "Active") : (lang === "bn" ? "নিষ্ক্রিয়" : "Inactive")}
                          </span>
                        </div>
                        <div className="text-muted small mt-1">
                          <span className="badge bg-light text-secondary border me-2">{acc.provider_display}</span>
                          {acc.merchant_id ? (
                            <span className="fw-mono me-3">
                              {lang === "bn" ? "মার্চেন্ট:" : "Merchant:"} {acc.merchant_id}
                            </span>
                          ) : null}
                          <span>
                            <i className="bi bi-calendar3 me-1"></i>
                            {fmtDate(acc.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="hstack gap-2 flex-wrap">
                      <button
                        onClick={() => handleValidateCredentials(acc)}
                        disabled={validatingId === acc.id}
                        className="btn btn-outline-info btn-sm"
                        title={lang === "bn" ? "ক্রেডেনশিয়াল যাচাই করুন" : "Validate credentials"}
                      >
                        <i className={`bi bi-key-fill me-1 ${validatingId === acc.id ? "spin" : ""}`}></i>
                        {validatingId === acc.id
                          ? (lang === "bn" ? "যাচাই হচ্ছে…" : "Testing…")
                          : (lang === "bn" ? "ক্রেডেনশিয়াল টেস্ট" : "Test Credentials")}
                      </button>

                      <button
                        onClick={() => loadShipments(acc, "all")}
                        className="btn btn-outline-secondary btn-sm"
                      >
                        <i className="bi bi-truck me-1"></i>
                        {lang === "bn" ? "শিপমেন্টসমূহ" : "Shipments"}
                      </button>

                      <button
                        onClick={() => loadShipments(acc, "failures")}
                        className="btn btn-outline-warning btn-sm"
                      >
                        <i className="bi bi-exclamation-octagon me-1"></i>
                        {lang === "bn" ? "ব্যর্থ পার্সেল" : "Failures"}
                      </button>

                      <button
                        onClick={() => handleToggleActive(acc)}
                        disabled={togglingId === acc.id}
                        className={`btn btn-sm ${acc.is_active ? "btn-outline-danger" : "btn-outline-success"}`}
                      >
                        <i className={`bi ${acc.is_active ? "bi-pause-fill" : "bi-play-fill"} me-1`}></i>
                        {acc.is_active ? (lang === "bn" ? "পজ করুন" : "Deactivate") : (lang === "bn" ? "চালু করুন" : "Activate")}
                      </button>

                      <button
                        onClick={() => startEdit(acc)}
                        className="btn btn-outline-primary btn-sm"
                        title={lang === "bn" ? "ক্রেডেনশিয়াল এডিট করুন" : "Edit credentials"}
                      >
                        <i className="bi bi-pencil-square me-1"></i>
                        {lang === "bn" ? "এডিট" : "Edit"}
                      </button>

                      <button
                        onClick={() => handleDeleteCourier(acc)}
                        disabled={deletingId === acc.id}
                        className="btn btn-outline-danger btn-sm"
                        title={lang === "bn" ? "মুছে ফেলুন" : "Delete account"}
                      >
                        <i className="bi bi-trash3 me-1"></i>
                        {deletingId === acc.id ? "..." : (lang === "bn" ? "মুছুন" : "Delete")}
                      </button>
                    </div>
                  </div>

                  {/* Masked Credential Protection Overview */}
                  <div className="mt-3 pt-3 border-top d-flex flex-wrap justify-content-between align-items-center small text-muted">
                    <div className="d-flex align-items-center gap-2">
                      <i className="bi bi-shield-check text-success"></i>
                      <span>
                        {lang === "bn"
                          ? "নিরাপত্তা সুরক্ষা: ক্লায়েন্ট আইডি, সিক্রেট ও পাসওয়ার্ড এনক্রিপ্ট করে সংরক্ষিত (Plaintext প্রদর্শিত হয় না)"
                          : "Security Shield: Client credentials and secrets are encrypted with AES-256 (Never exposed)"}
                      </span>
                    </div>
                    {acc.has_credentials ? (
                      <div className="hstack gap-2">
                        <span className="badge bg-light text-dark border">
                          <i className="bi bi-lock-fill me-1 text-success"></i>
                          {lang === "bn" ? "এনক্রিপ্টেড ক্রেডেনশিয়াল সংরক্ষিত" : "Encrypted Credentials Stored"}
                        </span>
                        {acc.masked_credentials?.api_key_masked ? (
                          <span className="badge bg-light text-secondary border">
                            ID: {acc.masked_credentials.api_key_masked}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="badge bg-warning-subtle text-warning">
                        {lang === "bn" ? "ক্রেডেনশিয়াল দেওয়া হয়নি" : "No Credentials Configured"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-12">
            <div className="card shadow-sm border text-center py-5 bg-white">
              <i className="bi bi-truck fs-1 text-muted mb-3"></i>
              <h2 className="h5 fw-bold text-dark">{lang === "bn" ? "কোনো কুরিয়ার অ্যাকাউন্ট নেই" : "No Courier Accounts Configured"}</h2>
              <p className="text-muted small mx-auto" style={{ maxWidth: 450 }}>
                {lang === "bn"
                  ? "পাঠাও বা অন্য কুরিয়ার অ্যাকাউন্ট যুক্ত করে সরাসরি স্টকহুইস্ক সেলস অর্ডার থেকে পার্সেল বুক করুন এবং লাইভ ট্র্যাকিং দেখুন।"
                  : "Connect Pathao or other couriers to book parcels directly from sales invoices and monitor real-time tracking."}
              </p>
              <div>
                <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm">
                  <i className="bi bi-plus-lg me-1"></i>
                  {lang === "bn" ? "কুরিয়ার যুক্ত করুন" : "Add Courier Account"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Courier Modal */}
      {showAddModal || editingAccount ? (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-truck me-2 text-info"></i>
                  {editingAccount
                    ? (lang === "bn" ? "কুরিয়ার অ্যাকাউন্ট ও ক্রেডেনশিয়াল এডিট করুন" : "Edit Courier Account & Credentials")
                    : (lang === "bn" ? "নতুন কুরিয়ার অ্যাকাউন্ট যুক্ত করুন" : "Connect New Courier Account")}
                </h5>
                <button type="button" className="btn-close" onClick={() => { setShowAddModal(false); setEditingAccount(null); }}></button>
              </div>
              <form onSubmit={editingAccount ? handleUpdateCourier : handleAddCourier}>
                <div className="modal-body vstack gap-3">
                  <div className="row g-3">
                    <div className="col-md-7">
                      <label className="form-label small fw-semibold">
                        {lang === "bn" ? "অ্যাকাউন্টের নাম *" : "Account Label / Name *"}
                      </label>
                      <input
                        required
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="যেমন: Pathao Express Main"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                      />
                    </div>
                    <div className="col-md-5">
                      <label className="form-label small fw-semibold">
                        {lang === "bn" ? "কুরিয়ার প্রোভাইডার *" : "Courier Provider *"}
                      </label>
                      <select
                        className="form-select form-select-sm"
                        value={form.provider}
                        onChange={(e) => setForm({ ...form, provider: e.target.value })}
                      >
                        <option value="pathao">পাঠাও (Pathao Courier)</option>
                        <option value="steadfast">স্টিডফাস্ট (SteadFast)</option>
                        <option value="redx">রেডএক্স (RedX)</option>
                        <option value="paperfly">পেপারফ্লাই (Paperfly)</option>
                        <option value="mock">মক কুরিয়ার (Mock / Sandbox)</option>
                      </select>
                    </div>
                  </div>

                  {/* Dynamic Credential Inputs based on selected Provider */}
                  {form.provider === "steadfast" ? (
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold text-dark">
                          {lang === "bn" ? "স্টিরডফাস্ট API Key" : "Steadfast API Key"} {!editingAccount && "*"}
                        </label>
                        <input
                          required={!editingAccount}
                          type="text"
                          className="form-control form-control-sm"
                          placeholder={editingAccount ? "পরিবর্তন করতে নতুন কী লিখুন (অন্যথায় ফাঁকা রাখুন)" : "portal.packzy.com থেকে প্রাপ্ত Api-Key"}
                          value={form.api_key}
                          onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold text-dark">
                          {lang === "bn" ? "স্টিরডফাস্ট Secret Key" : "Steadfast Secret Key"} {!editingAccount && "*"} <span className="text-muted">(সুরক্ষিত)</span>
                        </label>
                        <input
                          required={!editingAccount}
                          type="password"
                          className="form-control form-control-sm"
                          placeholder={editingAccount ? "পরিবর্তন করতে নতুন সিক্রেট লিখুন" : "•••••••••••• (Secret-Key)"}
                          value={form.api_secret}
                          onChange={(e) => setForm({ ...form, api_secret: e.target.value })}
                        />
                      </div>
                    </div>
                  ) : form.provider === "redx" ? (
                    <div className="row g-3">
                      <div className="col-md-12">
                        <label className="form-label small fw-semibold text-dark">
                          {lang === "bn" ? "রেডএক্স API Access Token" : "RedX API Access Token"} {!editingAccount && "*"} <span className="text-muted">(সুরক্ষিত)</span>
                        </label>
                        <input
                          required={!editingAccount}
                          type="password"
                          className="form-control form-control-sm"
                          placeholder={editingAccount ? "পরিবর্তন করতে নতুন টোকেন লিখুন" : "openapi.redx.com.bd থেকে প্রাপ্ত Bearer Token"}
                          value={form.access_token || form.api_key}
                          onChange={(e) => setForm({ ...form, access_token: e.target.value, api_key: e.target.value })}
                        />
                      </div>
                    </div>
                  ) : form.provider === "pathao" ? (
                    <>
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label small fw-semibold">
                            {lang === "bn" ? "পাঠাও Client ID" : "Pathao Client ID"} {!editingAccount && "*"}
                          </label>
                          <input
                            required={!editingAccount}
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="পাঠাও মার্চেন্ট পোর্টালের Client ID"
                            value={form.client_id}
                            onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small fw-semibold">
                            {lang === "bn" ? "পাঠাও Client Secret" : "Pathao Client Secret"} {!editingAccount && "*"} <span className="text-muted">(সুরক্ষিত)</span>
                          </label>
                          <input
                            required={!editingAccount}
                            type="password"
                            className="form-control form-control-sm"
                            placeholder="••••••••••••"
                            value={form.client_secret}
                            onChange={(e) => setForm({ ...form, client_secret: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="row g-3 mt-0.5">
                        <div className="col-md-6">
                          <label className="form-label small fw-semibold">
                            {lang === "bn" ? "ইউজারনেম / ইমেইল" : "API Username / Email"} {!editingAccount && "*"}
                          </label>
                          <input
                            required={!editingAccount}
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="পাঠাও মার্চেন্ট লগইন ইমেইল"
                            value={form.username}
                            onChange={(e) => setForm({ ...form, username: e.target.value })}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small fw-semibold">
                            {lang === "bn" ? "পাসওয়ার্ড" : "API Password"} {!editingAccount && "*"} <span className="text-muted">(সুরক্ষিত)</span>
                          </label>
                          <input
                            required={!editingAccount}
                            type="password"
                            className="form-control form-control-sm"
                            placeholder="••••••••••••"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">
                          {lang === "bn" ? "API Key / Client ID *" : "API Key / Client ID *"}
                        </label>
                        <input
                          required
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="API Key / Client ID"
                          value={form.api_key || form.client_id}
                          onChange={(e) => setForm({ ...form, api_key: e.target.value, client_id: e.target.value })}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">
                          {lang === "bn" ? "Secret / Password *" : "Secret / Password *"}
                        </label>
                        <input
                          type="password"
                          className="form-control form-control-sm"
                          placeholder="Secret / Password"
                          value={form.api_secret || form.client_secret}
                          onChange={(e) => setForm({ ...form, api_secret: e.target.value, client_secret: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">
                        {lang === "bn" ? "ডিফল্ট পিকআপ স্টোর আইডি" : "Default Pickup Store ID"}
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="যেমন: 12345"
                        value={form.store_id}
                        onChange={(e) => setForm({ ...form, store_id: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">
                        {lang === "bn" ? "মার্চেন্ট রেফারেন্স আইডি (ঐচ্ছিক)" : "Merchant Reference ID (Optional)"}
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={form.merchant_id}
                        onChange={(e) => setForm({ ...form, merchant_id: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="card bg-light border-0 p-3 rounded-2">
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="isDefault"
                        checked={form.is_default}
                        onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                      />
                      <label className="form-check-label small fw-semibold" htmlFor="isDefault">
                        {lang === "bn" ? "এই অ্যাকাউন্টকে ডিফল্ট কুরিয়ার হিসেবে নির্ধারণ করুন" : "Set as Default Courier"}
                      </label>
                    </div>
                  </div>

                  <div className="small text-muted d-flex align-items-center gap-2">
                    <i className="bi bi-shield-lock-fill text-success"></i>
                    <span>
                      {lang === "bn"
                        ? "নিরাপত্তা প্রতিজ্ঞা: আপনার পাসওয়ার্ড এবং সিক্রেট কি-গুলো কখনোই ব্রাউজারে বা লগে প্রদর্শিত হবে না।"
                        : "Security Promise: Your passwords and secrets are encrypted and never shown back to browsers or logs."}
                    </span>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => { setShowAddModal(false); setEditingAccount(null); }}>
                    {lang === "bn" ? "বাতিল" : "Cancel"}
                  </button>
                  <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
                    {saving
                      ? (lang === "bn" ? "সংরক্ষণ হচ্ছে…" : "Saving…")
                      : editingAccount
                      ? (lang === "bn" ? "আপডেট সংরক্ষণ করুন" : "Update Courier")
                      : (lang === "bn" ? "অ্যাকাউন্ট যুক্ত করুন" : "Save Courier")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {/* Shipments & Failures Drawer/Modal */}
      {viewingAccount ? (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered modal-xl">
            <div className="modal-content shadow">
              <div className="modal-header d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="modal-title fw-bold text-dark mb-0">
                    <i className="bi bi-truck me-2 text-info"></i>
                    {viewingAccount.name} —{" "}
                    {shipmentFilter === "failures"
                      ? (lang === "bn" ? "ব্যর্থ পার্সেল ও ডেলিভারি ত্রুটি" : "Failed Shipments")
                      : (lang === "bn" ? "সাম্প্রতিক শিপমেন্ট তালিকা" : "Recent Shipments")}
                  </h5>
                  <div className="text-muted small mt-1">
                    <span className="badge bg-light text-dark border me-2">{viewingAccount.provider_display}</span>
                    <span>{shipments.length} {lang === "bn" ? "টি পার্সেল রেকর্ড" : "records found"}</span>
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setViewingAccount(null)}></button>
              </div>

              <div className="modal-body p-0">
                <div className="p-2 border-bottom bg-light d-flex gap-2">
                  <button
                    onClick={() => loadShipments(viewingAccount, "all")}
                    className={`btn btn-sm ${shipmentFilter === "all" ? "btn-primary" : "btn-outline-secondary"}`}
                  >
                    {lang === "bn" ? "সব শিপমেন্ট" : "All Shipments"}
                  </button>
                  <button
                    onClick={() => loadShipments(viewingAccount, "failures")}
                    className={`btn btn-sm ${shipmentFilter === "failures" ? "btn-warning" : "btn-outline-secondary"}`}
                  >
                    <i className="bi bi-exclamation-triangle me-1"></i>
                    {lang === "bn" ? "শুধুমাত্র ব্যর্থ ও রিটার্ন" : "Failures & Returns Only"}
                  </button>
                </div>

                {loadingShipments ? (
                  <div className="py-5 text-center">
                    <Spinner label={lang === "bn" ? "শিপমেন্ট তালিকা লোড হচ্ছে…" : "Loading shipments…"} />
                  </div>
                ) : shipments.length > 0 ? (
                  <div className="table-responsive" style={{ maxHeight: "60vh" }}>
                    <table className="table table-hover align-middle mb-0 small">
                      <thead className="table-light sticky-top">
                        <tr>
                          <th>{lang === "bn" ? "ট্র্যাকিং / কনসাইনমেন্ট" : "Tracking / Consignment"}</th>
                          <th>{lang === "bn" ? "ইনভয়েস" : "Invoice"}</th>
                          <th>{lang === "bn" ? "প্রাপক" : "Recipient"}</th>
                          <th>{lang === "bn" ? "ঠিকানা ও শহর" : "Address & City"}</th>
                          <th>{lang === "bn" ? "ক্যাশ অন ডেলিভারি (COD)" : "COD Amount"}</th>
                          <th>{lang === "bn" ? "স্ট্যাটাস" : "Status"}</th>
                          <th>{lang === "bn" ? "তারিখ" : "Date"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shipments.map((s) => (
                          <tr key={s.id}>
                            <td>
                              <div className="fw-bold fw-mono text-primary">
                                {s.tracking_id || s.consignment_id || `ID: #${s.id}`}
                              </div>
                              {s.tracking_url ? (
                                <a
                                  href={s.tracking_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="small text-decoration-none"
                                >
                                  {lang === "bn" ? "লাইভ ট্র্যাকিং লিঙ্ক" : "Track Live"} &rarr;
                                </a>
                              ) : null}
                            </td>
                            <td>
                              <span className="fw-mono">{s.sale_invoice_no || "—"}</span>
                            </td>
                            <td>
                              <div className="fw-semibold">{s.recipient_name}</div>
                              <div className="text-muted small">{s.recipient_phone}</div>
                            </td>
                            <td>
                              <div className="text-truncate" style={{ maxWidth: 200 }}>
                                {s.recipient_address}
                              </div>
                              <span className="badge bg-light text-dark border">{s.recipient_city}</span>
                            </td>
                            <td className="fw-bold">৳{s.cod_amount}</td>
                            <td>
                              <span
                                className={`badge ${
                                  s.status === "DELIVERED"
                                    ? "bg-success-subtle text-success"
                                    : s.status === "IN_TRANSIT"
                                    ? "bg-info-subtle text-info"
                                    : s.status === "DELIVERY_FAILED" || s.status === "RTO_RETURNED"
                                    ? "bg-danger-subtle text-danger"
                                    : "bg-secondary-subtle text-secondary"
                                }`}
                              >
                                {s.status_display || s.status}
                              </span>
                            </td>
                            <td className="text-muted text-nowrap">{fmtDate(s.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-5 text-muted">
                    <i className="bi bi-box2 fs-2 d-block mb-2"></i>
                    {lang === "bn" ? "কোনো শিপমেন্ট রেকর্ড পাওয়া যায়নি" : "No shipment records found"}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setViewingAccount(null)}>
                  {lang === "bn" ? "বন্ধ করুন" : "Close"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
