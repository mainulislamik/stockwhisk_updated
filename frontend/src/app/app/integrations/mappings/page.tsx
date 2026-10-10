"use client";

import { useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useApi, api } from "@/lib/api";
import { ErrorState, Spinner, fmtDate } from "@/components/ui";
import { useLanguage } from "@/contexts/LanguageContext";
import toast from "react-hot-toast";

type ProductMapping = {
  id: number;
  integration: number;
  integration_name?: string;
  integration_platform?: string;
  product: number;
  product_name: string;
  variation?: number | null;
  variation_name?: string | null;
  product_sku?: string;
  internal_sku?: string;
  external_product_id: string;
  external_variation_id?: string;
  external_sku?: string;
  sync_status?: string;
  status?: string;
  is_sync_enabled?: boolean;
  sync_inventory?: boolean;
  sync_inventory_enabled?: boolean;
  last_synced_at?: string | null;
  last_inventory_sync_at?: string | null;
  error_message?: string | null;
  created_at?: string;
};

type IntegrationChannel = {
  id: number;
  name: string;
  provider: string;
  category?: string;
};

type CatalogProduct = {
  id: number;
  name: string;
  sku: string;
  selling_price?: string | number;
  stock_quantity?: number;
};

function ProductMappingsContent() {
  const { lang } = useLanguage();
  const searchParams = useSearchParams();
  const defaultIntegrationId = searchParams.get("integration_id") || "";

  const [selectedChannel, setSelectedChannel] = useState<string>(defaultIntegrationId);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<number | null>(null);

  // Manual Add Mapping Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [savingMapping, setSavingMapping] = useState(false);
  const [newMappingForm, setNewMappingForm] = useState({
    integration: "",
    product: "",
    external_product_id: "",
    external_sku: "",
    sync_inventory: true,
  });

  // Load Channels & Mappings with Safe Array Unwrapping
  const { data: rawChannels, loading: channelsLoading } = useApi<any>("/integrations/channels/");
  const channels: IntegrationChannel[] = useMemo(() => {
    if (!rawChannels) return [];
    return Array.isArray(rawChannels) ? rawChannels : (rawChannels.results || []);
  }, [rawChannels]);

  // Load Catalog Products for Manual Mapping Dropdown
  const { data: rawProducts } = useApi<any>(showAddModal ? "/catalog/products/?page_size=200" : null);
  const catalogProducts: CatalogProduct[] = useMemo(() => {
    if (!rawProducts) return [];
    return Array.isArray(rawProducts) ? rawProducts : (rawProducts.results || []);
  }, [rawProducts]);

  // Load Mappings
  const mappingEndpoint = selectedChannel
    ? `/integrations/mappings/?integration=${selectedChannel}`
    : "/integrations/mappings/";
  const { data: rawMappings, loading: mappingsLoading, error, mutate } = useApi<any>(mappingEndpoint);
  const mappings: ProductMapping[] = useMemo(() => {
    if (!rawMappings) return [];
    return Array.isArray(rawMappings) ? rawMappings : (rawMappings.results || []);
  }, [rawMappings]);

  // Filtered Mappings
  const filteredMappings = useMemo(() => {
    return mappings.filter((m) => {
      // Channel Filter
      if (selectedChannel && String(m.integration) !== String(selectedChannel)) {
        return false;
      }

      // Status Filter
      const currentStatus = (m.sync_status || m.status || "MAPPED").toUpperCase();
      if (statusFilter !== "all") {
        if (statusFilter === "ACTIVE" && !["ACTIVE", "SYNCED", "MAPPED"].includes(currentStatus)) return false;
        if (statusFilter === "ERROR" && !["ERROR", "CONFLICT", "FAILED"].includes(currentStatus)) return false;
        if (statusFilter === "PENDING" && !["PENDING_SYNC", "PENDING"].includes(currentStatus)) return false;
        if (statusFilter === "DISCONNECTED" && currentStatus !== "DISCONNECTED") return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const pName = (m.product_name || "").toLowerCase();
        const pSku = (m.product_sku || m.internal_sku || "").toLowerCase();
        const extId = (m.external_product_id || "").toLowerCase();
        const extSku = (m.external_sku || "").toLowerCase();
        return pName.includes(q) || pSku.includes(q) || extId.includes(q) || extSku.includes(q);
      }

      return true;
    });
  }, [mappings, selectedChannel, statusFilter, searchQuery]);

  // Actions
  async function handleTriggerStockSync(mappingId: number) {
    setSyncingId(mappingId);
    try {
      // Backend supports sync-inventory (and alias sync-stock)
      const res = await api<any>(`/integrations/mappings/${mappingId}/sync-inventory/`, { method: "POST" });
      if (res?.success === false) {
        toast.error(res?.error_message || (lang === "bn" ? "স্টক সিঙ্ক ব্যর্থ হয়েছে" : "Stock sync failed"));
      } else {
        toast.success(
          lang === "bn"
            ? "প্রোডাক্টের স্টক সিঙ্ক সফলভাবে সম্পন্ন হয়েছে!"
            : "Product inventory synced successfully!"
        );
      }
      mutate();
    } catch (err: any) {
      toast.error(err?.message || (lang === "bn" ? "স্টক সিঙ্ক ব্যর্থ হয়েছে" : "Failed to sync stock"));
    } finally {
      setSyncingId(null);
    }
  }

  async function handleToggleSync(mapping: ProductMapping) {
    const isCurrentlyEnabled = Boolean(
      mapping.sync_inventory ?? mapping.sync_inventory_enabled ?? mapping.is_sync_enabled ?? true
    );
    const newVal = !isCurrentlyEnabled;

    try {
      await api(`/integrations/mappings/${mapping.id}/`, {
        method: "PATCH",
        body: {
          sync_inventory: newVal,
          sync_inventory_enabled: newVal,
          is_sync_enabled: newVal,
        },
      });
      toast.success(
        lang === "bn"
          ? (newVal ? "স্টক সিঙ্ক সক্রিয় করা হয়েছে" : "স্টক সিঙ্ক স্থগিত করা হয়েছে")
          : (newVal ? "Inventory sync enabled" : "Inventory sync disabled")
      );
      mutate();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update mapping sync settings");
    }
  }

  async function handleDisconnect(mapping: ProductMapping) {
    if (
      !confirm(
        lang === "bn"
          ? `আপনি কি নিশ্চিত যে "${mapping.product_name}" এর সাথে এক্সটার্নাল আইডি "${mapping.external_product_id}" এর ম্যাপিং বিচ্ছিন্ন করতে চান?`
          : `Disconnect mapping for "${mapping.product_name}" (Ext ID: ${mapping.external_product_id})?`
      )
    ) {
      return;
    }

    setDisconnectingId(mapping.id);
    try {
      await api(`/integrations/mappings/${mapping.id}/disconnect/`, { method: "POST" });
      toast.success(
        lang === "bn"
          ? "প্রোডাক্ট ম্যাপিং বিচ্ছিন্ন করা হয়েছে"
          : "Product mapping disconnected successfully"
      );
      mutate();
    } catch (err: any) {
      toast.error(err?.message || "Failed to disconnect mapping");
    } finally {
      setDisconnectingId(null);
    }
  }

  async function handleCreateMapping(e: React.FormEvent) {
    e.preventDefault();
    if (!newMappingForm.integration) {
      toast.error(lang === "bn" ? "অনুগ্রহ করে একটি চ্যানেল নির্বাচন করুন" : "Please select a channel");
      return;
    }
    if (!newMappingForm.product) {
      toast.error(lang === "bn" ? "অনুগ্রহ করে একটি প্রোডাক্ট নির্বাচন করুন" : "Please select a product");
      return;
    }
    if (!newMappingForm.external_product_id.trim()) {
      toast.error(lang === "bn" ? "এক্সটার্নাল প্রোডাক্ট আইডি প্রদান করুন" : "External product ID is required");
      return;
    }

    setSavingMapping(true);
    try {
      await api("/integrations/mappings/", {
        method: "POST",
        body: {
          integration: Number(newMappingForm.integration),
          product: Number(newMappingForm.product),
          external_product_id: newMappingForm.external_product_id.trim(),
          external_sku: newMappingForm.external_sku.trim() || undefined,
          sync_inventory: newMappingForm.sync_inventory,
        },
      });

      toast.success(
        lang === "bn"
          ? "নতুন প্রোডাক্ট ম্যাপিং সফলভাবে যুক্ত হয়েছে!"
          : "Product mapping created successfully!"
      );
      setShowAddModal(false);
      setNewMappingForm({
        integration: "",
        product: "",
        external_product_id: "",
        external_sku: "",
        sync_inventory: true,
      });
      mutate();
    } catch (err: any) {
      toast.error(err?.message || (lang === "bn" ? "ম্যাপিং যুক্ত করা সম্ভব হয়নি" : "Failed to create mapping"));
    } finally {
      setSavingMapping(false);
    }
  }

  if (mappingsLoading && !rawMappings) {
    return (
      <div className="p-4 text-center">
        <Spinner label={lang === "bn" ? "প্রোডাক্ট ম্যাপিং লোড হচ্ছে…" : "Loading product mappings…"} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <ErrorState error={error} />
      </div>
    );
  }

  return (
    <div className="p-4 vstack gap-4">
      {/* Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 pb-3 border-bottom">
        <div>
          <div className="hstack gap-2 small mb-1">
            <Link href="/app/integrations" className="text-muted text-decoration-none">
              <i className="bi bi-arrow-left me-1"></i>
              {lang === "bn" ? "ইন্টিগ্রেশন হাব" : "Integrations Hub"}
            </Link>
          </div>
          <h1 className="h4 fw-bold mb-1 text-dark">
            <i className="bi bi-arrow-left-right me-2 text-warning"></i>
            {lang === "bn" ? "প্রোডাক্ট ও ক্যাটালগ ম্যাপিং" : "Product & Catalog Mappings"}
          </h1>
          <p className="text-muted small mb-0">
            {lang === "bn"
              ? "স্টকহুইস্ক ক্যাটালগের সাথে আপনার ই-কমার্স ওয়েবসাইটের (WooCommerce, Shopify, কাস্টম স্টোর) প্রোডাক্ট লিঙ্ক ও স্বয়ংক্রিয় স্টক সিঙ্ক"
              : "Map StockWhisk products to external store IDs and SKUs for automated multi-channel stock sync"}
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary d-flex align-items-center gap-1.5 shadow-sm px-3"
          >
            <i className="bi bi-plus-lg"></i>
            <span>{lang === "bn" ? "নতুন ম্যাপিং লিঙ্ক করুন" : "Link New Product"}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card shadow-sm border-0 bg-white">
        <div className="card-body p-3">
          <div className="row g-2 align-items-center">
            {/* Search Box */}
            <div className="col-12 col-md-5">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-light border-end-0 text-muted">
                  <i className="bi bi-search"></i>
                </span>
                <input
                  type="text"
                  className="form-control form-control-sm border-start-0 ps-0"
                  placeholder={
                    lang === "bn"
                      ? "নাম, স্টকহুইস্ক SKU বা এক্সটার্নাল আইডি দিয়ে খুঁজুন…"
                      : "Search by product name, SKU, or external ID…"
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    className="btn btn-outline-secondary border-start-0"
                    type="button"
                    onClick={() => setSearchQuery("")}
                  >
                    <i className="bi bi-x"></i>
                  </button>
                )}
              </div>
            </div>

            {/* Channel Filter */}
            <div className="col-6 col-md-4">
              <select
                className="form-select form-select-sm"
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
              >
                <option value="">{lang === "bn" ? "সকল চ্যানেল" : "All Channels"}</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name} ({ch.provider})
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="col-6 col-md-3">
              <select
                className="form-select form-select-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">{lang === "bn" ? "সকল স্ট্যাটাস" : "All Status"}</option>
                <option value="ACTIVE">{lang === "bn" ? "সক্রিয় / সিঙ্কড" : "Active / Synced"}</option>
                <option value="PENDING">{lang === "bn" ? "অপেক্ষমাণ সিঙ্ক" : "Pending Sync"}</option>
                <option value="ERROR">{lang === "bn" ? "ত্রুটি / কনফ্লিক্ট" : "Error / Conflict"}</option>
                <option value="DISCONNECTED">{lang === "bn" ? "বিচ্ছিন্ন" : "Disconnected"}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Mappings Table */}
      <div className="card shadow-sm border bg-white overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 small">
            <thead className="table-light text-secondary">
              <tr>
                <th style={{ width: "26%", minWidth: 200 }}>{lang === "bn" ? "স্টকহুইস্ক প্রোডাক্ট" : "StockWhisk Product"}</th>
                <th style={{ width: "15%", minWidth: 120 }}>{lang === "bn" ? "চ্যানেল" : "Website Channel"}</th>
                <th style={{ width: "16%", minWidth: 140 }}>{lang === "bn" ? "এক্সটার্নাল আইডি / SKU" : "External ID & SKU"}</th>
                <th style={{ width: "12%", minWidth: 100 }}>{lang === "bn" ? "স্ট্যাটাস" : "Status"}</th>
                <th className="text-center" style={{ width: "11%", minWidth: 90 }}>{lang === "bn" ? "স্টক সিঙ্ক" : "Stock Sync"}</th>
                <th style={{ width: "12%", minWidth: 110 }}>{lang === "bn" ? "সর্বশেষ সিঙ্ক" : "Last Synced"}</th>
                <th className="text-end" style={{ width: "8%", minWidth: 110 }}>{lang === "bn" ? "অ্যাকশন" : "Action"}</th>
              </tr>
            </thead>
            <tbody>
              {filteredMappings.length > 0 ? (
                filteredMappings.map((m) => {
                  const channelObj = channels.find((c) => c.id === m.integration);
                  const channelDisplayName = m.integration_name || channelObj?.name || `Channel #${m.integration}`;
                  const currentStatus = (m.sync_status || m.status || "MAPPED").toUpperCase();
                  const isSyncEnabled = Boolean(
                    m.sync_inventory ?? m.sync_inventory_enabled ?? m.is_sync_enabled ?? true
                  );

                  return (
                    <tr key={m.id}>
                      {/* Product Name & SKU */}
                      <td>
                        <div className="fw-bold text-dark">{m.product_name}</div>
                        {m.variation_name && (
                          <div className="badge bg-light text-secondary border me-1">
                            {m.variation_name}
                          </div>
                        )}
                        <div className="text-muted small font-monospace">
                          SKU: {m.product_sku || m.internal_sku || "—"}
                        </div>
                      </td>

                      {/* Channel */}
                      <td>
                        <span className="badge bg-light text-dark border">
                          <i className="bi bi-globe me-1 text-primary"></i>
                          {channelDisplayName}
                        </span>
                      </td>

                      {/* External ID & SKU */}
                      <td>
                        <div className="font-monospace fw-semibold text-primary">
                          ID: {m.external_product_id}
                          {m.external_variation_id ? ` (Var: ${m.external_variation_id})` : ""}
                        </div>
                        <div className="text-muted small font-monospace">
                          {m.external_sku ? `SKU: ${m.external_sku}` : "—"}
                        </div>
                      </td>

                      {/* Sync Status */}
                      <td>
                        <span
                          className={`badge ${
                            ["ACTIVE", "SYNCED", "MAPPED"].includes(currentStatus)
                              ? "bg-success-subtle text-success border border-success-subtle"
                              : ["ERROR", "CONFLICT", "FAILED"].includes(currentStatus)
                              ? "bg-danger-subtle text-danger border border-danger-subtle"
                              : currentStatus === "DISCONNECTED"
                              ? "bg-secondary-subtle text-secondary"
                              : "bg-warning-subtle text-warning border border-warning-subtle"
                          } px-2 py-1`}
                        >
                          {lang === "bn"
                            ? currentStatus === "SYNCED"
                              ? "সিঙ্ক হয়েছে"
                              : currentStatus === "ACTIVE" || currentStatus === "MAPPED"
                              ? "সক্রিয়"
                              : currentStatus === "PENDING_SYNC"
                              ? "অপেক্ষমাণ"
                              : currentStatus === "ERROR" || currentStatus === "FAILED"
                              ? "ত্রুটি"
                              : currentStatus === "CONFLICT"
                              ? "কনফ্লিক্ট"
                              : currentStatus === "DISCONNECTED"
                              ? "বিচ্ছিন্ন"
                              : currentStatus
                            : currentStatus}
                        </span>
                        {m.error_message && (
                          <div className="text-danger small mt-1" style={{ maxWidth: 220, fontSize: "0.75rem" }}>
                            {m.error_message}
                          </div>
                        )}
                      </td>

                      {/* Stock Sync Toggle */}
                      <td className="text-center">
                        <div className="form-check form-switch d-inline-flex align-items-center justify-content-center m-0">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            role="switch"
                            checked={isSyncEnabled}
                            onChange={() => handleToggleSync(m)}
                            title={lang === "bn" ? "স্টক সিঙ্ক সক্রিয় বা নিষ্ক্রিয় করুন" : "Toggle inventory sync"}
                            style={{ cursor: "pointer", width: "2.4em", height: "1.25em" }}
                          />
                        </div>
                      </td>

                      {/* Last Synced */}
                      <td className="text-muted text-nowrap">
                        {m.last_synced_at || m.last_inventory_sync_at ? (
                          fmtDate(m.last_synced_at || m.last_inventory_sync_at!)
                        ) : (
                          <span className="text-muted fst-italic">
                            {lang === "bn" ? "সিঙ্ক হয়নি" : "Never"}
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="text-end">
                        <div className="d-inline-flex align-items-center justify-content-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleTriggerStockSync(m.id)}
                            disabled={syncingId === m.id || !isSyncEnabled}
                            className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1 px-2.5 py-1"
                            style={{ height: 32, fontSize: "0.8125rem" }}
                            title={lang === "bn" ? "স্টক এখনই সিঙ্ক করুন" : "Sync stock now"}
                          >
                            <i className={`bi bi-arrow-repeat ${syncingId === m.id ? "spin" : ""}`}></i>
                            <span>{syncingId === m.id ? "…" : lang === "bn" ? "স্টক পুশ" : "Push Stock"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDisconnect(m)}
                            disabled={disconnectingId === m.id}
                            className="btn btn-outline-danger btn-sm d-inline-flex align-items-center justify-content-center px-2 py-1"
                            style={{ width: 32, height: 32 }}
                            title={lang === "bn" ? "ম্যাপিং বিচ্ছিন্ন করুন" : "Disconnect mapping"}
                          >
                            <i className="bi bi-link-45deg fs-6"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-5 text-muted">
                    <div className="py-4">
                      <i className="bi bi-arrow-left-right fs-1 text-secondary opacity-50 d-block mb-3"></i>
                      <h6 className="fw-bold text-dark mb-1">
                        {lang === "bn"
                          ? "কোনো প্রোডাক্ট ম্যাপিং পাওয়া যায়নি"
                          : "No Product Mappings Found"}
                      </h6>
                      <p className="text-muted small mb-3" style={{ maxWidth: 440, margin: "0 auto" }}>
                        {channels.length === 0
                          ? lang === "bn"
                            ? "প্রোডাক্ট ম্যাপিংয়ের জন্য প্রথমে আপনার ওয়েবসাইট চ্যানেলটি যুক্ত করুন।"
                            : "Please connect an eCommerce website channel first to start mapping products."
                          : lang === "bn"
                          ? "আপনার ওয়েবসাইট চ্যানেল কানেক্ট করার পর বা নতুন প্রোডাক্ট ম্যাপিং লিঙ্ক করার পর তালিকা এখানে প্রদর্শিত হবে।"
                          : "Link products manually or connect webhooks to automatically sync stock."}
                      </p>
                      {channels.length === 0 ? (
                        <Link href="/app/integrations/websites" className="btn btn-primary btn-sm px-3">
                          <i className="bi bi-globe me-1.5"></i>
                          {lang === "bn" ? "ওয়েবসাইট কানেক্ট করুন" : "Connect Website Channel"}
                        </Link>
                      ) : (
                        <button
                          onClick={() => setShowAddModal(true)}
                          className="btn btn-outline-primary btn-sm px-3"
                        >
                          <i className="bi bi-plus-lg me-1.5"></i>
                          {lang === "bn" ? "প্রথম প্রোডাক্ট লিঙ্ক করুন" : "Link First Product"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Add Mapping Modal */}
      {showAddModal && (
        <div
          className="modal show d-block"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(15, 23, 42, 0.5)", backdropFilter: "blur(4px)" }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header bg-light border-bottom py-3">
                <h5 className="modal-title fw-bold text-dark fs-6">
                  <i className="bi bi-link-45deg me-2 text-primary"></i>
                  {lang === "bn" ? "নতুন প্রোডাক্ট ম্যাপিং লিঙ্ক করুন" : "Link New Product Mapping"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowAddModal(false)}
                ></button>
              </div>

              <form onSubmit={handleCreateMapping}>
                <div className="modal-body p-4 vstack gap-3">
                  {/* Select Channel */}
                  <div>
                    <label className="form-label small fw-bold text-dark">
                      {lang === "bn" ? "ই-কমার্স ওয়েবসাইট চ্যানেল *" : "E-Commerce Website Channel *"}
                    </label>
                    <select
                      className="form-select form-select-sm"
                      required
                      value={newMappingForm.integration}
                      onChange={(e) =>
                        setNewMappingForm((prev) => ({ ...prev, integration: e.target.value }))
                      }
                    >
                      <option value="">
                        {lang === "bn" ? "— ওয়েবসাইট চ্যানেল নির্বাচন করুন —" : "— Select Website Channel —"}
                      </option>
                      {channels.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {ch.name} ({ch.provider})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Select StockWhisk Product */}
                  <div>
                    <label className="form-label small fw-bold text-dark">
                      {lang === "bn" ? "স্টকহুইস্ক ক্যাটালগ প্রোডাক্ট *" : "StockWhisk Catalog Product *"}
                    </label>
                    <select
                      className="form-select form-select-sm"
                      required
                      value={newMappingForm.product}
                      onChange={(e) =>
                        setNewMappingForm((prev) => ({ ...prev, product: e.target.value }))
                      }
                    >
                      <option value="">
                        {lang === "bn" ? "— প্রোডাক্ট নির্বাচন করুন —" : "— Select Product —"}
                      </option>
                      {catalogProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.sku ? `(SKU: ${p.sku})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* External Product ID */}
                  <div>
                    <label className="form-label small fw-bold text-dark">
                      {lang === "bn" ? "এক্সটার্নাল প্রোডাক্ট আইডি (Remote ID) *" : "External Product ID (Remote ID) *"}
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm font-monospace"
                      placeholder="e.g. 1042 or 8472918"
                      required
                      value={newMappingForm.external_product_id}
                      onChange={(e) =>
                        setNewMappingForm((prev) => ({ ...prev, external_product_id: e.target.value }))
                      }
                    />
                    <div className="form-text small text-muted">
                      {lang === "bn"
                        ? "আপনার WooCommerce/Shopify প্রোডাক্টের আইডি নম্বর।"
                        : "Unique product ID from your external online store."}
                    </div>
                  </div>

                  {/* External SKU */}
                  <div>
                    <label className="form-label small fw-bold text-dark">
                      {lang === "bn" ? "এক্সটার্নাল SKU (ঐচ্ছিক)" : "External SKU (Optional)"}
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm font-monospace"
                      placeholder="e.g. WOO-TSHIRT-01"
                      value={newMappingForm.external_sku}
                      onChange={(e) =>
                        setNewMappingForm((prev) => ({ ...prev, external_sku: e.target.value }))
                      }
                    />
                  </div>

                  {/* Sync Inventory Toggle */}
                  <div className="form-check form-switch pt-1">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="syncInvSwitch"
                      checked={newMappingForm.sync_inventory}
                      onChange={(e) =>
                        setNewMappingForm((prev) => ({ ...prev, sync_inventory: e.target.checked }))
                      }
                    />
                    <label className="form-check-label small fw-semibold text-dark" htmlFor="syncInvSwitch">
                      {lang === "bn" ? "স্বয়ংক্রিয় স্টক সিঙ্ক সক্রিয় রাখুন" : "Enable Automated Stock Sync"}
                    </label>
                  </div>
                </div>

                <div className="modal-footer bg-light border-top py-2 px-4">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setShowAddModal(false)}
                  >
                    {lang === "bn" ? "বাতিল" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    disabled={savingMapping}
                    className="btn btn-primary btn-sm px-3"
                  >
                    {savingMapping ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                        {lang === "bn" ? "সংরক্ষণ হচ্ছে…" : "Saving…"}
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-lg me-1"></i>
                        {lang === "bn" ? "ম্যাপিং লিঙ্ক করুন" : "Save Mapping"}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductMappingsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-center">
          <Spinner label="Loading product mappings…" />
        </div>
      }
    >
      <ProductMappingsContent />
    </Suspense>
  );
}
