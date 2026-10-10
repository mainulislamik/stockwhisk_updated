"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi, api } from "@/lib/api";
import { ErrorState, Spinner, fmtDate } from "@/components/ui";
import { useLanguage } from "@/contexts/LanguageContext";
import toast from "react-hot-toast";

type IntegrationEvent = {
  id: number;
  integration: number;
  integration_name: string;
  event_type: string;
  status: string;
  error_category: string | null;
  error_message: string | null;
  attempt_count: number;
  max_retries: number;
  next_retry_at: string | null;
  raw_payload_masked?: Record<string, any>;
  created_at: string;
  updated_at: string;
};

type IntegrationLog = {
  id: number;
  integration: number;
  integration_name: string;
  level: string;
  action: string;
  message: string;
  created_at: string;
};

export default function IntegrationEventsPage() {
  const { lang } = useLanguage();
  const [activeTab, setActiveTab] = useState<"failed" | "all" | "logs">("failed");
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [batchRetrying, setBatchRetrying] = useState(false);
  const [inspectingEvent, setInspectingEvent] = useState<IntegrationEvent | null>(null);

  // Queries
  const {
    data: rawFailedEvents,
    loading: loadingFailed,
    error: errorFailed,
    mutate: mutateFailed,
  } = useApi<any>("/integrations/events/failed/");
  const failedEvents: IntegrationEvent[] = Array.isArray(rawFailedEvents)
    ? rawFailedEvents
    : (rawFailedEvents?.results || []);

  const {
    data: rawAllEvents,
    loading: loadingAll,
    error: errorAll,
    mutate: mutateAll,
  } = useApi<any>(activeTab === "all" ? "/integrations/events/" : null);
  const allEvents: IntegrationEvent[] = Array.isArray(rawAllEvents)
    ? rawAllEvents
    : (rawAllEvents?.results || []);

  const {
    data: rawLogs,
    loading: loadingLogs,
    error: errorLogs,
  } = useApi<any>(activeTab === "logs" ? "/integrations/logs/" : null);
  const logs: IntegrationLog[] = Array.isArray(rawLogs)
    ? rawLogs
    : (rawLogs?.results || []);

  async function handleRetry(eventId: number) {
    setRetryingId(eventId);
    try {
      await api(`/integrations/events/${eventId}/retry/`, { method: "POST" });
      toast.success(
        lang === "bn"
          ? "ইভেন্টটি রিট্রাই কিউতে যুক্ত করা হয়েছে"
          : "Event queued for retry successfully"
      );
      mutateFailed();
      if (activeTab === "all") mutateAll();
      if (inspectingEvent?.id === eventId) setInspectingEvent(null);
    } catch (err: any) {
      toast.error(err?.message || (lang === "bn" ? "রিট্রাই শুরু করা যায়নি" : "Retry failed"));
    } finally {
      setRetryingId(null);
    }
  }

  async function handleBatchRetry() {
    if (!failedEvents || failedEvents.length === 0) return;
    setBatchRetrying(true);
    let count = 0;
    try {
      for (const ev of failedEvents) {
        try {
          await api(`/integrations/events/${ev.id}/retry/`, { method: "POST" });
          count++;
        } catch {}
      }
      toast.success(
        lang === "bn"
          ? `${count} টি ব্যর্থ ইভেন্ট পুনরায় প্রসেস করার অনুরোধ সফল হয়েছে`
          : `Queued ${count} failed events for retry`
      );
      mutateFailed();
      if (activeTab === "all") mutateAll();
    } catch (err: any) {
      toast.error(err?.message || "Batch retry error");
    } finally {
      setBatchRetrying(false);
    }
  }

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
            <i className="bi bi-activity me-2 text-danger"></i>
            {lang === "bn" ? "ইভেন্ট মনিটরিং ও রিকভারি সেন্টার" : "Event Monitoring & Recovery"}
          </h1>
          <p className="text-muted small mb-0">
            {lang === "bn"
              ? "ওয়েবহুক ইভেন্ট স্ট্যাটাস, এরর ক্যাটাগরাইজেশন, এক্সপোনেনশিয়াল রিট্রাই এবং রিকভারি অ্যাকশন"
              : "Monitor inbound webhook events, structured error categorization, and execute manual recovery"}
          </p>
        </div>

        {activeTab === "failed" && failedEvents && failedEvents.length > 0 ? (
          <button
            onClick={handleBatchRetry}
            disabled={batchRetrying}
            className="btn btn-danger btn-sm"
          >
            <i className={`bi bi-arrow-repeat me-1 ${batchRetrying ? "spin" : ""}`}></i>
            {batchRetrying
              ? (lang === "bn" ? "প্রসেস হচ্ছে…" : "Retrying…")
              : (lang === "bn" ? "ব্যর্থ ইভেন্টগুলো সব রিট্রাই করুন" : "Retry All Failed")}
          </button>
        ) : null}
      </div>

      {/* Tabs */}
      <ul className="nav nav-pills gap-2 bg-light p-1 rounded-2 border">
        <li className="nav-item">
          <button
            className={`nav-link btn-sm ${activeTab === "failed" ? "active bg-primary" : "text-dark"}`}
            onClick={() => setActiveTab("failed")}
          >
            <i className="bi bi-exclamation-octagon-fill me-1 text-danger"></i>
            {lang === "bn" ? "ব্যর্থ ও রিট্রাই তালিকা" : "Failed & In-Retry"} (
            {failedEvents ? failedEvents.length : 0})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link btn-sm ${activeTab === "all" ? "active bg-primary" : "text-dark"}`}
            onClick={() => setActiveTab("all")}
          >
            <i className="bi bi-list-check me-1"></i>
            {lang === "bn" ? "সকল ইভেন্টস" : "All Events"}
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link btn-sm ${activeTab === "logs" ? "active bg-primary" : "text-dark"}`}
            onClick={() => setActiveTab("logs")}
          >
            <i className="bi bi-journal-text me-1"></i>
            {lang === "bn" ? "অডিট ও অ্যাক্টিভিটি লগ" : "Audit Logs"}
          </button>
        </li>
      </ul>

      {/* Failed & In-Retry Tab */}
      {activeTab === "failed" && (
        <div className="card shadow-sm border bg-white">
          {loadingFailed ? (
            <div className="py-5 text-center">
              <Spinner label={lang === "bn" ? "ব্যর্থ ইভেন্ট লোড হচ্ছে…" : "Loading failed events…"} />
            </div>
          ) : errorFailed ? (
            <ErrorState error={errorFailed} />
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 small">
                <thead className="table-light">
                  <tr>
                    <th>{lang === "bn" ? "ইভেন্ট আইডি" : "Event ID"}</th>
                    <th>{lang === "bn" ? "চ্যানেল" : "Channel"}</th>
                    <th>{lang === "bn" ? "ইভেন্ট টাইপ" : "Type"}</th>
                    <th>{lang === "bn" ? "এরর ক্যাটাগরি" : "Error Category"}</th>
                    <th>{lang === "bn" ? "স্ট্যাটাস" : "Status"}</th>
                    <th>{lang === "bn" ? "চেষ্টা" : "Attempts"}</th>
                    <th>{lang === "bn" ? "পরবর্তী চেষ্টা" : "Next Retry"}</th>
                    <th className="text-end">{lang === "bn" ? "অ্যাকশন" : "Action"}</th>
                  </tr>
                </thead>
                <tbody>
                  {failedEvents && failedEvents.length > 0 ? (
                    failedEvents.map((ev) => (
                      <tr key={ev.id}>
                        <td className="fw-mono fw-semibold text-primary">#{ev.id}</td>
                        <td className="fw-semibold">{ev.integration_name || "—"}</td>
                        <td>
                          <span className="badge bg-secondary-subtle text-secondary">{ev.event_type}</span>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              ev.error_category === "RATE_LIMITED"
                                ? "bg-warning-subtle text-warning"
                                : ev.error_category === "TIMEOUT" || ev.error_category === "NETWORK_ERROR"
                                ? "bg-info-subtle text-info"
                                : "bg-danger-subtle text-danger"
                            }`}
                          >
                            {ev.error_category || "UNKNOWN"}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              ev.status === "RETRY"
                                ? "bg-warning-subtle text-warning"
                                : ev.status === "FAILED_PERMANENTLY"
                                ? "bg-dark text-white"
                                : "bg-danger-subtle text-danger"
                            }`}
                          >
                            {ev.status}
                          </span>
                        </td>
                        <td>
                          {ev.attempt_count} / {ev.max_retries}
                        </td>
                        <td>
                          {ev.next_retry_at ? fmtDate(ev.next_retry_at) : (lang === "bn" ? "অবিলম্বে" : "Immediate")}
                        </td>
                        <td className="text-end">
                          <div className="hstack gap-1 justify-content-end">
                            <button
                              onClick={() => setInspectingEvent(ev)}
                              className="btn btn-outline-secondary btn-sm py-0 px-2"
                              title={lang === "bn" ? "বিস্তারিত দেখুন" : "Inspect details"}
                            >
                              <i className="bi bi-eye"></i>
                            </button>
                            <button
                              onClick={() => handleRetry(ev.id)}
                              disabled={retryingId === ev.id}
                              className="btn btn-outline-danger btn-sm py-0 px-2"
                              title={lang === "bn" ? "পুনরায় চেষ্টা করুন" : "Retry now"}
                            >
                              <i className={`bi bi-arrow-repeat me-1 ${retryingId === ev.id ? "spin" : ""}`}></i>
                              {retryingId === ev.id ? "…" : (lang === "bn" ? "রিট্রাই" : "Retry")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="text-center py-5 text-muted">
                        <i className="bi bi-check-circle-fill text-success fs-2 d-block mb-2"></i>
                        {lang === "bn"
                          ? "চমৎকার! বর্তমানে কোনো ব্যর্থ বা অপেক্ষমান রিট্রাই ইভেন্ট নেই।"
                          : "Excellent! No failed or pending retry events found."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* All Events Tab */}
      {activeTab === "all" && (
        <div className="card shadow-sm border bg-white">
          {loadingAll ? (
            <div className="py-5 text-center">
              <Spinner label={lang === "bn" ? "ইভেন্টস লোড হচ্ছে…" : "Loading events…"} />
            </div>
          ) : errorAll ? (
            <ErrorState error={errorAll} />
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 small">
                <thead className="table-light">
                  <tr>
                    <th>{lang === "bn" ? "আইডি" : "ID"}</th>
                    <th>{lang === "bn" ? "চ্যানেল" : "Channel"}</th>
                    <th>{lang === "bn" ? "টাইপ" : "Type"}</th>
                    <th>{lang === "bn" ? "স্ট্যাটাস" : "Status"}</th>
                    <th>{lang === "bn" ? "চেষ্টা" : "Attempts"}</th>
                    <th>{lang === "bn" ? "তারিখ" : "Created At"}</th>
                    <th className="text-end">{lang === "bn" ? "অ্যাকশন" : "Action"}</th>
                  </tr>
                </thead>
                <tbody>
                  {allEvents && allEvents.length > 0 ? (
                    allEvents.map((ev) => (
                      <tr key={ev.id}>
                        <td className="fw-mono">#{ev.id}</td>
                        <td className="fw-semibold">{ev.integration_name || "—"}</td>
                        <td>
                          <span className="badge bg-light text-dark border">{ev.event_type}</span>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              ev.status === "SUCCESS"
                                ? "bg-success-subtle text-success"
                                : ev.status === "RETRY"
                                ? "bg-warning-subtle text-warning"
                                : "bg-danger-subtle text-danger"
                            }`}
                          >
                            {ev.status}
                          </span>
                        </td>
                        <td>
                          {ev.attempt_count} / {ev.max_retries}
                        </td>
                        <td className="text-muted text-nowrap">{fmtDate(ev.created_at)}</td>
                        <td className="text-end">
                          <button
                            onClick={() => setInspectingEvent(ev)}
                            className="btn btn-outline-secondary btn-sm py-0 px-2"
                          >
                            <i className="bi bi-eye me-1"></i>
                            {lang === "bn" ? "বিস্তারিত" : "Inspect"}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center py-5 text-muted">
                        {lang === "bn" ? "কোনো ইভেন্ট পাওয়া যায়নি" : "No events recorded yet"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === "logs" && (
        <div className="card shadow-sm border bg-white">
          {loadingLogs ? (
            <div className="py-5 text-center">
              <Spinner label={lang === "bn" ? "লগ রেকর্ড লোড হচ্ছে…" : "Loading audit logs…"} />
            </div>
          ) : errorLogs ? (
            <ErrorState error={errorLogs} />
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 small">
                <thead className="table-light">
                  <tr>
                    <th>{lang === "bn" ? "সময়" : "Timestamp"}</th>
                    <th>{lang === "bn" ? "চ্যানেল" : "Integration"}</th>
                    <th>{lang === "bn" ? "লেভেল" : "Level"}</th>
                    <th>{lang === "bn" ? "অ্যাকশন" : "Action"}</th>
                    <th>{lang === "bn" ? "বার্তা" : "Message"}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs && logs.length > 0 ? (
                    logs.map((log) => (
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
                        <td>{log.message}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-5 text-muted">
                        {lang === "bn" ? "কোনো অডিট লগ রেকর্ড নেই" : "No audit log records"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Event Inspector Modal */}
      {inspectingEvent ? (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-file-earmark-code me-2 text-primary"></i>
                  {lang === "bn" ? "ইভেন্ট বিস্তারিত ও এরর লগ" : "Event Inspection & Error Details"} (#{inspectingEvent.id})
                </h5>
                <button type="button" className="btn-close" onClick={() => setInspectingEvent(null)}></button>
              </div>
              <div className="modal-body vstack gap-3">
                <div className="row g-2 small">
                  <div className="col-sm-6">
                    <span className="text-muted">{lang === "bn" ? "চ্যানেল:" : "Integration Channel:"}</span>{" "}
                    <strong>{inspectingEvent.integration_name || "—"}</strong>
                  </div>
                  <div className="col-sm-6">
                    <span className="text-muted">{lang === "bn" ? "ইভেন্ট ধরণ:" : "Event Type:"}</span>{" "}
                    <span className="badge bg-secondary-subtle text-secondary">{inspectingEvent.event_type}</span>
                  </div>
                  <div className="col-sm-6">
                    <span className="text-muted">{lang === "bn" ? "স্ট্যাটাস:" : "Status:"}</span>{" "}
                    <span className="badge bg-light text-dark border">{inspectingEvent.status}</span>
                  </div>
                  <div className="col-sm-6">
                    <span className="text-muted">{lang === "bn" ? "এরর ক্যাটাগরি:" : "Error Category:"}</span>{" "}
                    <span className="badge bg-danger-subtle text-danger">
                      {inspectingEvent.error_category || "NONE"}
                    </span>
                  </div>
                  <div className="col-sm-6">
                    <span className="text-muted">{lang === "bn" ? "চেষ্টা:" : "Attempts:"}</span>{" "}
                    <strong>
                      {inspectingEvent.attempt_count} / {inspectingEvent.max_retries}
                    </strong>
                  </div>
                  <div className="col-sm-6">
                    <span className="text-muted">{lang === "bn" ? "সময়:" : "Timestamp:"}</span>{" "}
                    <span>{fmtDate(inspectingEvent.created_at)}</span>
                  </div>
                </div>

                {inspectingEvent.error_message ? (
                  <div>
                    <label className="form-label small fw-bold text-danger">
                      <i className="bi bi-bug me-1"></i>
                      {lang === "bn" ? "এরর বার্তা (স্যানিটাইজড):" : "Sanitized Error Message:"}
                    </label>
                    <pre className="p-3 bg-danger-subtle text-danger rounded small fw-mono text-wrap mb-0">
                      {inspectingEvent.error_message}
                    </pre>
                  </div>
                ) : null}

                <div className="p-3 bg-light rounded border small">
                  <div className="d-flex align-items-center gap-2 mb-1 text-success fw-semibold">
                    <i className="bi bi-shield-check"></i>
                    {lang === "bn" ? "সিকিউরিটি গার্ড সক্রিয়" : "Security Guard Active"}
                  </div>
                  <p className="text-muted mb-0" style={{ fontSize: "0.8rem" }}>
                    {lang === "bn"
                      ? "সকল ক্রেডেনশিয়াল, এপিআই কি, পাসওয়ার্ড এবং প্রাইভেট টোকেন স্বয়ংক্রিয়ভাবে ফিল্টার করা হয়েছে এবং স্ক্রিনে কখনোই দৃশ্যমান হবে না।"
                      : "All credentials, API keys, passwords, and private tokens are automatically sanitized and never displayed."}
                  </p>
                </div>
              </div>
              <div className="modal-footer d-flex justify-content-between">
                {inspectingEvent.status !== "SUCCESS" ? (
                  <button
                    type="button"
                    onClick={() => handleRetry(inspectingEvent.id)}
                    disabled={retryingId === inspectingEvent.id}
                    className="btn btn-danger btn-sm"
                  >
                    <i className={`bi bi-arrow-repeat me-1 ${retryingId === inspectingEvent.id ? "spin" : ""}`}></i>
                    {lang === "bn" ? "এখনই রিট্রাই করুন" : "Retry Now"}
                  </button>
                ) : <div></div>}
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setInspectingEvent(null)}
                >
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
