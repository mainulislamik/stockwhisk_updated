"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ErrorState, PageHeader, Spinner, fmtDateTime } from "@/components/ui";
import toast from "react-hot-toast";
import { useLanguage } from "@/contexts/LanguageContext";

type Note = {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};
type Paged = { results: Note[]; next: string | null; count: number };

const PAGE_SIZE = 20;

const TYPE_ICON: Record<string, string> = {
  low_stock: "📦",
  out_of_stock: "🚫",
  payment_due: "💳",
  subscription: "📋",
  general: "🔔",
};

export default function NotificationsPage() {
  const { t, lang } = useLanguage();
  const [rows, setRows] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  async function loadPage(p: number, append: boolean) {
    const d = await api<Paged>("/notifications/notifications/", {
      params: { page: p, page_size: PAGE_SIZE },
    });
    const list = Array.isArray(d) ? (d as Note[]) : (d.results ?? []);
    setRows((prev) => (append ? [...prev, ...list] : list));
    setHasMore(!Array.isArray(d) && !!d.next);
    setPage(p);
  }

  async function load() {
    try {
      const [, unread] = await Promise.all([
        loadPage(1, false),
        api<{ unread: number }>("/notifications/notifications/unread_count/").catch(() => ({ unread: 0 })),
      ]);
      setUnreadTotal(unread.unread ?? 0);
    } catch (e: any) {
      setError(e?.message || (lang === "bn" ? "বিজ্ঞপ্তি লোড করতে সমস্যা হয়েছে" : "Failed to load notifications"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function loadMore() {
    setLoadingMore(true);
    try {
      await loadPage(page + 1, true);
    } catch {
      toast.error(lang === "bn" ? "আরও বিজ্ঞপ্তি লোড করা যায়নি" : "Failed to load more notifications");
    } finally {
      setLoadingMore(false);
    }
  }

  async function markRead(n: Note) {
    try {
      await api(`/notifications/notifications/${n.id}/read/`, { method: "POST" });
      setRows((rs) => rs.map((r) => (r.id === n.id ? { ...r, is_read: true } : r)));
      setUnreadTotal((c) => Math.max(0, c - 1));
      window.dispatchEvent(new Event("notifications_updated"));
      toast.success(lang === "bn" ? "পঠিত হিসেবে চিহ্নিত করা হয়েছে" : "Marked as read");
    } catch (e: any) {
      toast.error(e?.message || (lang === "bn" ? "আপডেট করা সম্ভব হয়নি" : "Failed to update"));
    }
  }

  async function markAll() {
    try {
      await api(`/notifications/notifications/read_all/`, { method: "POST" });
      setRows((rs) => rs.map((r) => ({ ...r, is_read: true })));
      setUnreadTotal(0);
      window.dispatchEvent(new Event("notifications_updated"));
      toast.success(lang === "bn" ? "সব বিজ্ঞপ্তি পঠিত হিসেবে চিহ্নিত করা হয়েছে" : "All notifications marked as read");
    } catch (e: any) {
      toast.error(e?.message || (lang === "bn" ? "আপডেট করা সম্ভব হয়নি" : "Failed to update"));
    }
  }

  async function deleteNote(id: number) {
    setDeletingId(id);
    try {
      await api(`/notifications/notifications/${id}/`, { method: "DELETE" });
      const target = rows.find((r) => r.id === id);
      setRows((rs) => rs.filter((r) => r.id !== id));
      if (target && !target.is_read) {
        setUnreadTotal((c) => Math.max(0, c - 1));
      }
      window.dispatchEvent(new Event("notifications_updated"));
      toast.success(lang === "bn" ? "বিজ্ঞপ্তি মুছে ফেলা হয়েছে" : "Notification deleted");
    } catch (e: any) {
      toast.error(e?.message || (lang === "bn" ? "মুছে ফেলা সম্ভব হয়নি" : "Failed to delete"));
    } finally {
      setDeletingId(null);
    }
  }

  async function clearAll() {
    if (!window.confirm(lang === "bn" ? "আপনি কি নিশ্চিত যে সব বিজ্ঞপ্তি মুছে ফেলতে চান?" : "Are you sure you want to delete all notifications?")) {
      return;
    }
    setClearing(true);
    try {
      await api(`/notifications/notifications/clear_all/`, { method: "POST" });
      setRows([]);
      setUnreadTotal(0);
      window.dispatchEvent(new Event("notifications_updated"));
      toast.success(lang === "bn" ? "সকল বিজ্ঞপ্তি সফলভাবে মুছে ফেলা হয়েছে" : "All notifications cleared successfully");
    } catch (e: any) {
      toast.error(e?.message || (lang === "bn" ? "মুছে ফেলা সম্ভব হয়নি" : "Failed to clear notifications"));
    } finally {
      setClearing(false);
    }
  }

  async function clearRead() {
    setClearing(true);
    try {
      await api(`/notifications/notifications/clear_read/`, { method: "POST" });
      setRows((rs) => rs.filter((r) => !r.is_read));
      window.dispatchEvent(new Event("notifications_updated"));
      toast.success(lang === "bn" ? "পঠিত বিজ্ঞপ্তিগুলো মুছে ফেলা হয়েছে" : "Read notifications cleared");
    } catch (e: any) {
      toast.error(e?.message || (lang === "bn" ? "মুছে ফেলা সম্ভব হয়নি" : "Failed to clear read notifications"));
    } finally {
      setClearing(false);
    }
  }

  const filteredRows = rows.filter((r) => {
    if (filter === "unread") return !r.is_read;
    if (filter === "read") return r.is_read;
    return true;
  });

  const hasReadNotes = rows.some((r) => r.is_read);

  if (loading) return <Spinner label={t("notif_loading")} />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="vstack gap-3">
      <PageHeader
        title={t("notif_title") || (lang === "bn" ? "বিজ্ঞপ্তি" : "Notifications")}
        subtitle={
          unreadTotal > 0
            ? (lang === "bn" ? `${unreadTotal}টি অপঠিত বিজ্ঞপ্তি রয়েছে` : `${unreadTotal} unread notifications`)
            : (lang === "bn" ? "সব বিজ্ঞপ্তি পড়া হয়ে গেছে" : "All caught up")
        }
        actions={
          <div className="d-flex flex-wrap align-items-center gap-2">
            {unreadTotal > 0 && (
              <button className="btn btn-outline-brand btn-sm d-flex align-items-center gap-1" onClick={markAll}>
                <i className="bi bi-check2-all"></i> {lang === "bn" ? "সব পঠিত করুন" : "Mark all read"}
              </button>
            )}
            {hasReadNotes && (
              <button
                className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                onClick={clearRead}
                disabled={clearing}
              >
                <i className="bi bi-eraser"></i> {lang === "bn" ? "পঠিতগুলো মুছুন" : "Clear read"}
              </button>
            )}
            {rows.length > 0 && (
              <button
                className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1"
                onClick={clearAll}
                disabled={clearing}
              >
                {clearing ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  <i className="bi bi-trash3"></i>
                )}
                {lang === "bn" ? "সব মুছুন" : "Clear all"}
              </button>
            )}
          </div>
        }
      />

      {/* Filter Tabs */}
      {rows.length > 0 && (
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 fw-medium ${
              filter === "all" ? "btn-brand shadow-sm" : "btn-light border"
            }`}
            onClick={() => setFilter("all")}
          >
            {lang === "bn" ? "সকল" : "All"} ({rows.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 fw-medium ${
              filter === "unread" ? "btn-brand shadow-sm" : "btn-light border"
            }`}
            onClick={() => setFilter("unread")}
          >
            {lang === "bn" ? "অপঠিত" : "Unread"} ({unreadTotal})
          </button>
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 fw-medium ${
              filter === "read" ? "btn-brand shadow-sm" : "btn-light border"
            }`}
            onClick={() => setFilter("read")}
          >
            {lang === "bn" ? "পঠিত" : "Read"} ({rows.filter((r) => r.is_read).length})
          </button>
        </div>
      )}

      <div className="card shadow-sm border-0">
        <div className="list-group list-group-flush rounded-3">
          {filteredRows.length === 0 ? (
            <div className="text-center text-secondary py-5">
              <div style={{ fontSize: "2.5rem" }}>🔔</div>
              <div className="mt-2 fw-medium">
                {filter === "unread"
                  ? (lang === "bn" ? "কোনো অপঠিত বিজ্ঞপ্তি নেই" : "No unread notifications")
                  : filter === "read"
                  ? (lang === "bn" ? "কোনো পঠিত বিজ্ঞপ্তি নেই" : "No read notifications")
                  : (lang === "bn" ? "কোনো বিজ্ঞপ্তি পাওয়া যায়নি" : "No notifications found")}
              </div>
              <div className="small text-muted mt-1">
                {lang === "bn" ? "নতুন কোনো সতর্কতা আসলে এখানে দেখতে পাবেন" : "New alerts and notices will appear here"}
              </div>
            </div>
          ) : (
            filteredRows.map((n) => (
              <div
                key={n.id}
                className={`list-group-item d-flex justify-content-between align-items-start gap-3 py-3 transition-all ${
                  n.is_read ? "" : "border-start border-4 border-danger"
                }`}
                style={n.is_read ? undefined : { background: "rgba(220,53,69,0.04)" }}
              >
                <div className="d-flex gap-3 align-items-start flex-grow-1 min-vw-0">
                  <span
                    className="d-flex align-items-center justify-content-center rounded-3 flex-shrink-0"
                    style={{
                      fontSize: "1.3rem",
                      width: "40px",
                      height: "40px",
                      background: n.is_read ? "var(--sidebar-hover, #f1f5f9)" : "rgba(220,53,69,0.1)",
                    }}
                  >
                    {TYPE_ICON[n.type] || "🔔"}
                  </span>
                  <div className="flex-grow-1 min-vw-0">
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      {!n.is_read && (
                        <span className="badge text-bg-danger rounded-pill px-2 py-0.5" style={{ fontSize: "0.7rem" }}>
                          {lang === "bn" ? "নতুন" : "NEW"}
                        </span>
                      )}
                      <span className="fw-semibold text-break">{n.title}</span>
                    </div>
                    {n.message && (
                      <div
                        className="small text-secondary mt-1 text-break"
                        style={{ whiteSpace: "pre-line", maxHeight: 160, overflowY: "auto" }}
                      >
                        {n.message}
                      </div>
                    )}
                    <div className="small text-muted mt-1 d-flex align-items-center gap-1">
                      <i className="bi bi-clock" style={{ fontSize: "0.75rem" }}></i>
                      {fmtDateTime(n.created_at)}
                    </div>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-1 flex-shrink-0">
                  {!n.is_read && (
                    <button
                      className="btn btn-sm btn-outline-secondary py-1 px-2.5 rounded-2 d-flex align-items-center gap-1"
                      onClick={() => markRead(n)}
                      title={lang === "bn" ? "পঠিত করুন" : "Mark as read"}
                    >
                      <i className="bi bi-check2"></i>
                      <span className="d-none d-sm-inline">{lang === "bn" ? "পঠিত" : "Read"}</span>
                    </button>
                  )}
                  <button
                    className="btn btn-sm btn-outline-danger py-1 px-2 rounded-2 d-flex align-items-center justify-content-center"
                    onClick={() => deleteNote(n.id)}
                    disabled={deletingId === n.id}
                    title={lang === "bn" ? "মুছে ফেলুন" : "Delete notification"}
                  >
                    {deletingId === n.id ? (
                      <span className="spinner-border spinner-border-sm" />
                    ) : (
                      <i className="bi bi-trash3"></i>
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {hasMore && (
        <div className="text-center">
          <button className="btn btn-outline-brand btn-sm px-4" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                {lang === "bn" ? "লোড হচ্ছে..." : "Loading..."}
              </>
            ) : (
              lang === "bn" ? "আরও লোড করুন" : "Load more"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
