"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi, api } from "@/lib/api";
import { ErrorState, Spinner, fmtDate } from "@/components/ui";
import { useLanguage } from "@/contexts/LanguageContext";
import toast from "react-hot-toast";

type DashboardSummary = {
  stats: {
    websites: { total: number; connected: number; disconnected: number; error: number };
    couriers: { total: number; active: number; inactive: number };
    mappings: { total: number; active: number; pending: number; failed: number };
    events: { total: number; pending: number; retry: number; failed: number; success: number };
    shipments: { total: number; pending: number; in_transit: number; delivered: number; failed: number };
  };
  websites: Array<{
    id: number;
    name: string;
    provider: string;
    provider_display: string;
    status: string;
    base_url: string;
    last_sync_at: string | null;
  }>;
  couriers: Array<{
    id: number;
    name: string;
    provider: string;
    provider_display: string;
    is_active: boolean;
    is_default: boolean;
    has_credentials: boolean;
    created_at: string;
  }>;
  failed_events: Array<{
    id: number;
    event_type: string;
    integration_name: string;
    status: string;
    error_category: string | null;
    error_message: string | null;
    attempt_count: number;
    max_retries: number;
    next_retry_at: string | null;
    created_at: string;
  }>;
  recent_logs: Array<{
    id: number;
    integration_name: string;
    level: string;
    action: string;
    message: string;
    created_at: string;
  }>;
};

export default function IntegrationsDashboardPage() {
  const { t, lang } = useLanguage();
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [batchRetrying, setBatchRetrying] = useState(false);

  const { data, loading, error, mutate } = useApi<DashboardSummary>("/integrations/dashboard/summary/");

  async function handleRetry(eventId: number) {
    setRetryingId(eventId);
    try {
      await api(`/integrations/events/${eventId}/retry/`, { method: "POST" });
      toast.success(lang === "bn" ? "ইভেন্টটি সফলভাবে পুনরায় প্রসেসিং তালিকায় যুক্ত হয়েছে" : "Event queued for retry successfully");
      mutate();
    } catch (err: any) {
      toast.error(err?.message || (lang === "bn" ? "পুনরায় চেষ্টা ব্যর্থ হয়েছে" : "Retry attempt failed"));
    } finally {
      setRetryingId(null);
    }
  }

  async function handleBatchRetry() {
    setBatchRetrying(true);
    try {
      const failed = data?.failed_events || (data as any)?.recent_failures || [];
      let successCount = 0;
      for (const ev of failed) {
        try {
          await api(`/integrations/events/${ev.id}/retry/`, { method: "POST" });
          successCount++;
        } catch {}
      }
      toast.success(
        lang === "bn"
          ? `${successCount} টি ব্যর্থ ইভেন্ট পুনরায় প্রসেস শুরু হয়েছে`
          : `Queued ${successCount} failed events for retry`
      );
      mutate();
    } catch (err: any) {
      toast.error(err?.message || "Batch retry error");
    } finally {
      setBatchRetrying(false);
    }
  }

  if (loading) return <Spinner label={lang === "bn" ? "ইন্টিগ্রেশন ড্যাশবোর্ড লোড হচ্ছে…" : "Loading Integrations Dashboard…"} />;
  if (error) return <ErrorState error={error} />;

  const stats = data?.stats;

  return (
    <div className="vstack gap-4">
      {/* Page Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 pb-2 border-bottom">
        <div>
          <h1 className="h4 fw-bold mb-1 text-dark">
            <i className="bi bi-diagram-3 me-2 text-primary"></i>
            {lang === "bn" ? "ইন্টিগ্রেশন ম্যানেজমেন্ট ও ড্যাশবোর্ড" : "Integration Management Dashboard"}
          </h1>
          <p className="text-muted small mb-0">
            {lang === "bn"
              ? "ই-কমার্স ওয়েবসাইট, কুরিয়ার পার্টনার এবং ক্যাটালগ সিঙ্ক্রোনাইজেশনের কেন্দ্রীয় নিয়ন্ত্রণ"
              : "Centralized control for E-commerce websites, courier partners, and automated sync"}
          </p>
        </div>
        <div className="hstack gap-2">
          <Link href="/app/integrations/websites" className="btn btn-outline-primary btn-sm">
            <i className="bi bi-globe2 me-1"></i>
            {lang === "bn" ? "ওয়েবসাইট কানেক্ট করুন" : "Connect Website"}
          </Link>
          <Link href="/app/integrations/couriers" className="btn btn-primary btn-sm">
            <i className="bi bi-truck me-1"></i>
            {lang === "bn" ? "কুরিয়ার যুক্ত করুন" : "Add Courier"}
          </Link>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="row g-3">
        {/* Websites KPI */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card shadow-sm border-0 h-100 bg-white">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted small fw-medium">
                  {lang === "bn" ? "ওয়েবসাইট চ্যানেল" : "Websites & Stores"}
                </span>
                <span className="badge bg-primary-subtle text-primary p-2 rounded-circle">
                  <i className="bi bi-globe2 fs-6"></i>
                </span>
              </div>
              <div className="h3 fw-bold mb-1 text-dark">{stats?.websites.total || 0}</div>
              <div className="small text-muted">
                <span className="text-success fw-semibold">
                  <i className="bi bi-check-circle-fill me-1"></i>
                  {stats?.websites.connected || 0} {lang === "bn" ? "সংযুক্ত" : "Connected"}
                </span>
                {stats?.websites.error ? (
                  <span className="text-danger ms-2 fw-semibold">
                    <i className="bi bi-exclamation-triangle-fill me-1"></i>
                    {stats.websites.error} {lang === "bn" ? "ত্রুটি" : "Error"}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Couriers KPI */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card shadow-sm border-0 h-100 bg-white">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted small fw-medium">
                  {lang === "bn" ? "কুরিয়ার পার্টনার" : "Courier Accounts"}
                </span>
                <span className="badge bg-info-subtle text-info p-2 rounded-circle">
                  <i className="bi bi-truck fs-6"></i>
                </span>
              </div>
              <div className="h3 fw-bold mb-1 text-dark">{stats?.couriers.total || 0}</div>
              <div className="small text-muted">
                <span className="text-success fw-semibold">
                  <i className="bi bi-patch-check-fill me-1"></i>
                  {stats?.couriers.active || 0} {lang === "bn" ? "সক্রিয়" : "Active"}
                </span>
                <span className="ms-2">
                  {stats?.couriers.inactive || 0} {lang === "bn" ? "নিষ্ক্রিয়" : "Inactive"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Product Mappings KPI */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card shadow-sm border-0 h-100 bg-white">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted small fw-medium">
                  {lang === "bn" ? "প্রোডাক্ট ম্যাপিং" : "Mapped Products"}
                </span>
                <span className="badge bg-warning-subtle text-warning p-2 rounded-circle">
                  <i className="bi bi-arrow-left-right fs-6"></i>
                </span>
              </div>
              <div className="h3 fw-bold mb-1 text-dark">{stats?.mappings.total || 0}</div>
              <div className="small text-muted">
                <span className="text-success fw-semibold">
                  {stats?.mappings.active || 0} {lang === "bn" ? "সিঙ্ক হচ্ছে" : "Active"}
                </span>
                {stats?.mappings.pending ? (
                  <span className="text-secondary ms-2">
                    {stats.mappings.pending} {lang === "bn" ? "অপেক্ষমান" : "Pending"}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Failed / Retry Events KPI */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card shadow-sm border-0 h-100 bg-white">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted small fw-medium">
                  {lang === "bn" ? "ইভেন্ট স্বাস্থ্য" : "Events & Recovery"}
                </span>
                <span className="badge bg-danger-subtle text-danger p-2 rounded-circle">
                  <i className="bi bi-activity fs-6"></i>
                </span>
              </div>
              <div className="h3 fw-bold mb-1 text-dark">
                {stats?.events.success || 0}
                <span className="fs-6 fw-normal text-muted ms-1">/ {stats?.events.total || 0}</span>
              </div>
              <div className="small text-muted">
                {(stats?.events.failed || 0) + (stats?.events.retry || 0) > 0 ? (
                  <span className="text-danger fw-semibold">
                    <i className="bi bi-arrow-repeat me-1"></i>
                    {(stats?.events.failed || 0) + (stats?.events.retry || 0)}{" "}
                    {lang === "bn" ? "ব্যর্থ / রিট্রাই তালিকায়" : "Failed / In Retry"}
                  </span>
                ) : (
                  <span className="text-success fw-semibold">
                    <i className="bi bi-shield-check me-1"></i>
                    {lang === "bn" ? "সব ইভেন্ট স্বাভাবিক" : "All events healthy"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access Navigation Row */}
      <div className="row g-2">
        <div className="col-6 col-md-3">
          <Link
            href="/app/integrations/websites"
            className="card text-decoration-none shadow-sm border p-3 h-100 bg-light-subtle hover-shadow transition"
          >
            <div className="hstack gap-3">
              <i className="bi bi-globe2 fs-4 text-primary"></i>
              <div>
                <div className="fw-bold text-dark">{lang === "bn" ? "ওয়েবসাইট ও স্টোর" : "Websites"}</div>
                <div className="text-muted small">{lang === "bn" ? "WooCommerce, Shopify চ্যানেল" : "Store channels"}</div>
              </div>
            </div>
          </Link>
        </div>
        <div className="col-6 col-md-3">
          <Link
            href="/app/integrations/couriers"
            className="card text-decoration-none shadow-sm border p-3 h-100 bg-light-subtle hover-shadow transition"
          >
            <div className="hstack gap-3">
              <i className="bi bi-truck fs-4 text-info"></i>
              <div>
                <div className="fw-bold text-dark">{lang === "bn" ? "কুরিয়ার সার্ভিস" : "Couriers"}</div>
                <div className="text-muted small">{lang === "bn" ? "পাঠাও, স্টিডফাস্ট ইত্যাদি" : "Pathao, SteadFast"}</div>
              </div>
            </div>
          </Link>
        </div>
        <div className="col-6 col-md-3">
          <Link
            href="/app/integrations/mappings"
            className="card text-decoration-none shadow-sm border p-3 h-100 bg-light-subtle hover-shadow transition"
          >
            <div className="hstack gap-3">
              <i className="bi bi-arrow-left-right fs-4 text-warning"></i>
              <div>
                <div className="fw-bold text-dark">{lang === "bn" ? "প্রোডাক্ট ম্যাপিং" : "Mappings"}</div>
                <div className="text-muted small">{lang === "bn" ? "স্টক ও ক্যাটালগ লিঙ্ক" : "SKU & stock linking"}</div>
              </div>
            </div>
          </Link>
        </div>
        <div className="col-6 col-md-3">
          <Link
            href="/app/integrations/events"
            className="card text-decoration-none shadow-sm border p-3 h-100 bg-light-subtle hover-shadow transition"
          >
            <div className="hstack gap-3">
              <i className="bi bi-activity fs-4 text-danger"></i>
              <div>
                <div className="fw-bold text-dark">{lang === "bn" ? "ইভেন্ট ও রিকভারি" : "Events"}</div>
                <div className="text-muted small">{lang === "bn" ? "ব্যর্থ ইভেন্ট ও লগ" : "Failures & logs"}</div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Failed Events / Attention Needed Banner & Table */}
      {data?.failed_events && data.failed_events.length > 0 ? (
        <div className="card shadow-sm border-danger">
          <div className="card-header bg-danger-subtle d-flex justify-content-between align-items-center py-2">
            <span className="fw-bold text-danger d-flex align-items-center gap-2">
              <i className="bi bi-exclamation-octagon-fill"></i>
              {lang === "bn" ? "মনোযোগ প্রয়োজন: ব্যর্থ ইভেন্টস" : "Attention Required: Failed Events"} (
              {data.failed_events.length})
            </span>
            <button
              onClick={handleBatchRetry}
              disabled={batchRetrying}
              className="btn btn-danger btn-sm"
            >
              <i className={`bi bi-arrow-repeat me-1 ${batchRetrying ? "spin" : ""}`}></i>
              {batchRetrying
                ? (lang === "bn" ? "প্রসেস হচ্ছে…" : "Retrying…")
                : (lang === "bn" ? "সবগুলো রিট্রাই করুন" : "Retry All")}
            </button>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 small">
              <thead className="table-light">
                <tr>
                  <th>{lang === "bn" ? "ইভেন্ট আইডি" : "Event ID"}</th>
                  <th>{lang === "bn" ? "চ্যানেল" : "Channel"}</th>
                  <th>{lang === "bn" ? "ইভেন্ট ধরন" : "Type"}</th>
                  <th>{lang === "bn" ? "এরর ক্যাটাগরি" : "Error Category"}</th>
                  <th>{lang === "bn" ? "চেষ্টা" : "Attempts"}</th>
                  <th>{lang === "bn" ? "পরবর্তী চেষ্টা" : "Next Retry"}</th>
                  <th>{lang === "bn" ? "অ্যাকশন" : "Action"}</th>
                </tr>
              </thead>
              <tbody>
                {data.failed_events.map((ev) => (
                  <tr key={ev.id}>
                    <td className="fw-mono fw-semibold">#{ev.id}</td>
                    <td>{ev.integration_name || "—"}</td>
                    <td>
                      <span className="badge bg-secondary-subtle text-secondary">{ev.event_type}</span>
                    </td>
                    <td>
                      <span className="badge bg-danger-subtle text-danger">
                        {ev.error_category || "UNKNOWN"}
                      </span>
                    </td>
                    <td>
                      {ev.attempt_count} / {ev.max_retries}
                    </td>
                    <td>{ev.next_retry_at ? fmtDate(ev.next_retry_at) : (lang === "bn" ? "তাত্ক্ষণিক" : "Immediate")}</td>
                    <td>
                      <button
                        onClick={() => handleRetry(ev.id)}
                        disabled={retryingId === ev.id}
                        className="btn btn-outline-danger btn-sm py-0 px-2"
                      >
                        <i className={`bi bi-arrow-repeat me-1 ${retryingId === ev.id ? "spin" : ""}`}></i>
                        {retryingId === ev.id ? "…" : (lang === "bn" ? "রিট্রাই" : "Retry")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Connected Channels & Couriers Overview Grid */}
      <div className="row g-4">
        {/* Connected Websites */}
        <div className="col-12 col-lg-6">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-header bg-white d-flex justify-content-between align-items-center py-3">
              <h2 className="h6 fw-bold mb-0 text-dark">
                <i className="bi bi-globe2 me-2 text-primary"></i>
                {lang === "bn" ? "সংযুক্ত ওয়েবসাইট চ্যানেল" : "Connected Websites & Stores"}
              </h2>
              <Link href="/app/integrations/websites" className="small text-primary text-decoration-none">
                {lang === "bn" ? "সবগুলো দেখুন" : "View All"} &rarr;
              </Link>
            </div>
            <div className="card-body p-0">
              {data?.websites && data.websites.length > 0 ? (
                <div className="list-group list-group-flush">
                  {data.websites.map((w) => (
                    <div key={w.id} className="list-group-item d-flex justify-content-between align-items-center py-3">
                      <div>
                        <div className="fw-bold text-dark">{w.name}</div>
                        <div className="text-muted small">
                          <span className="badge bg-light text-dark border me-2">{w.provider_display}</span>
                          <span className="fw-mono text-truncate d-inline-block" style={{ maxWidth: 220 }}>
                            {w.base_url || "—"}
                          </span>
                        </div>
                      </div>
                      <div className="text-end">
                        <span
                          className={`badge ${
                            w.status === "CONNECTED"
                              ? "bg-success-subtle text-success"
                              : w.status === "ERROR"
                              ? "bg-danger-subtle text-danger"
                              : "bg-secondary-subtle text-secondary"
                          } mb-1 d-block`}
                        >
                          {w.status}
                        </span>
                        <span className="text-muted small" style={{ fontSize: "0.75rem" }}>
                          {w.last_sync_at ? fmtDate(w.last_sync_at) : (lang === "bn" ? "সিঙ্ক হয়নি" : "No sync yet")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted small">
                  <i className="bi bi-globe-americas fs-3 d-block mb-2 text-secondary"></i>
                  {lang === "bn" ? "কোনো ওয়েবসাইট চ্যানেল যুক্ত করা হয়নি" : "No website channels connected yet"}
                  <div className="mt-2">
                    <Link href="/app/integrations/websites" className="btn btn-outline-primary btn-sm">
                      {lang === "bn" ? "প্রথম ওয়েবসাইট যুক্ত করুন" : "Connect First Website"}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Connected Couriers */}
        <div className="col-12 col-lg-6">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-header bg-white d-flex justify-content-between align-items-center py-3">
              <h2 className="h6 fw-bold mb-0 text-dark">
                <i className="bi bi-truck me-2 text-info"></i>
                {lang === "bn" ? "সংযুক্ত কুরিয়ার অ্যাকাউন্ট" : "Connected Courier Accounts"}
              </h2>
              <Link href="/app/integrations/couriers" className="small text-primary text-decoration-none">
                {lang === "bn" ? "সবগুলো দেখুন" : "View All"} &rarr;
              </Link>
            </div>
            <div className="card-body p-0">
              {data?.couriers && data.couriers.length > 0 ? (
                <div className="list-group list-group-flush">
                  {data.couriers.map((c) => (
                    <div key={c.id} className="list-group-item d-flex justify-content-between align-items-center py-3">
                      <div>
                        <div className="fw-bold text-dark d-flex align-items-center gap-2">
                          {c.name}
                          {c.is_default ? (
                            <span className="badge bg-primary-subtle text-primary small">
                              {lang === "bn" ? "ডিফল্ট" : "Default"}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-muted small">
                          <span className="badge bg-light text-dark border me-2">{c.provider_display}</span>
                          <span className="text-success small">
                            <i className="bi bi-lock-fill me-1"></i>
                            {lang === "bn" ? "ক্রেডেনশিয়াল সুরক্ষিত" : "Credentials Protected"}
                          </span>
                        </div>
                      </div>
                      <div className="text-end">
                        <span
                          className={`badge ${
                            c.is_active ? "bg-success-subtle text-success" : "bg-secondary-subtle text-secondary"
                          } mb-1 d-block`}
                        >
                          {c.is_active ? (lang === "bn" ? "সক্রিয়" : "Active") : (lang === "bn" ? "নিষ্ক্রিয়" : "Inactive")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted small">
                  <i className="bi bi-truck fs-3 d-block mb-2 text-secondary"></i>
                  {lang === "bn" ? "কোনো কুরিয়ার অ্যাকাউন্ট যুক্ত করা হয়নি" : "No courier accounts configured yet"}
                  <div className="mt-2">
                    <Link href="/app/integrations/couriers" className="btn btn-outline-primary btn-sm">
                      {lang === "bn" ? "কুরিয়ার যুক্ত করুন" : "Add Courier Account"}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Integration Audit Logs */}
      <div className="card shadow-sm border-0">
        <div className="card-header bg-white d-flex justify-content-between align-items-center py-3">
          <h2 className="h6 fw-bold mb-0 text-dark">
            <i className="bi bi-journal-text me-2 text-secondary"></i>
            {lang === "bn" ? "সাম্প্রতিক ইন্টিগ্রেশন অডিট লগ" : "Recent Integration Audit Logs"}
          </h2>
          <Link href="/app/integrations/events" className="small text-primary text-decoration-none">
            {lang === "bn" ? "সব লগ ও ইভেন্ট" : "All Logs & Events"} &rarr;
          </Link>
        </div>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 small">
            <thead className="table-light">
              <tr>
                <th>{lang === "bn" ? "সময়" : "Timestamp"}</th>
                <th>{lang === "bn" ? "চ্যানেল" : "Integration"}</th>
                <th>{lang === "bn" ? "লেভেল" : "Level"}</th>
                <th>{lang === "bn" ? "অ্যাকশন" : "Action"}</th>
                <th>{lang === "bn" ? "বিবরণ" : "Message"}</th>
              </tr>
            </thead>
            <tbody>
              {data?.recent_logs && data.recent_logs.length > 0 ? (
                data.recent_logs.map((log) => (
                  <tr key={log.id}>
                    <td className="text-muted text-nowrap">{fmtDate(log.created_at)}</td>
                    <td className="fw-semibold">{log.integration_name || "—"}</td>
                    <td>
                      <span
                        className={`badge ${
                          log.level === "ERROR"
                            ? "bg-danger-subtle text-danger"
                            : log.level === "WARNING"
                            ? "bg-warning-subtle text-warning"
                            : "bg-info-subtle text-info"
                        }`}
                      >
                        {log.level}
                      </span>
                    </td>
                    <td className="fw-mono text-secondary">{log.action}</td>
                    <td className="text-truncate" style={{ maxWidth: 350 }}>
                      {log.message}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-3 text-muted">
                    {lang === "bn" ? "কোনো সাম্প্রতিক লগ রেকর্ড নেই" : "No recent log records found"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
