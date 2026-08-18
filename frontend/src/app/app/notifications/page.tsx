"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ErrorState, PageHeader, Spinner, fmtDateTime } from "@/components/ui";
import toast from "react-hot-toast";

type Note = { id: number; type: string; title: string; message: string; is_read: boolean; created_at: string };
type Paged = { results: Note[]; next: string | null; count: number };

const PAGE_SIZE = 30;

const TYPE_ICON: Record<string, string> = {
  low_stock: "📦",
  out_of_stock: "🚫",
  payment_due: "💳",
  subscription: "📋",
  general: "🔔",
};

export default function NotificationsPage() {
  const [rows, setRows] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);

  async function loadPage(p: number, append: boolean) {
    const d = await api<Paged>("/notifications/notifications/", { params: { page: p, page_size: PAGE_SIZE } });
    const list = Array.isArray(d) ? (d as Note[]) : (d.results ?? []);
    setRows((prev) => (append ? [...prev, ...list] : list));
    setHasMore(!Array.isArray(d) && !!d.next);
    setPage(p);
  }

  async function load() {
    try {
      // First page + the real unread total (independent of what's loaded).
      const [, unread] = await Promise.all([
        loadPage(1, false),
        api<{ unread: number }>("/notifications/notifications/unread_count/").catch(() => ({ unread: 0 })),
      ]);
      setUnreadTotal(unread.unread ?? 0);
    } catch (e: any) {
      setError(e?.message || t("notif_err_load"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function loadMore() {
    setLoadingMore(true);
    try {
      await loadPage(page + 1, true);
    } catch {
      toast.error(t("notif_err_more"));
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
    } catch (e: any) {
      toast.error(e?.message || t("notif_err_update"));
    }
  }

  async function markAll() {
    try {
      await api(`/notifications/notifications/read_all/`, { method: "POST" });
      setRows((rs) => rs.map((r) => ({ ...r, is_read: true })));
      setUnreadTotal(0);
      window.dispatchEvent(new Event("notifications_updated"));
    } catch (e: any) {
      toast.error(e?.message || t("notif_err_update"));
    }
  }

  if (loading) return <Spinner label={t("notif_loading")} />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="vstack gap-3">
      <PageHeader
        title={t("notif_title")}
        subtitle={unreadTotal > 0 ? t("notif_unread_count", { count: unreadTotal }) : t("notif_all_caught")}
        actions={
          unreadTotal > 0 ? (
            <button className="btn btn-outline-brand btn-sm" onClick={markAll}>
              Mark all read
            </button>
          ) : null
        }
      />

      <div className="card shadow-sm">
        <div className="list-group list-group-flush">
          {rows.length === 0 ? (
            <div className="text-center text-secondary py-5">
              <div style={{ fontSize: "2.5rem" }}>🔔</div>
              <div className="mt-2">{t("notif_no_notes_title")}</div>
              <div className="small mt-1">{t("notif_no_notes_desc")}</div>
            </div>
          ) : (
            rows.map((n) => (
              <div
                key={n.id}
                className={`list-group-item d-flex justify-content-between align-items-start gap-3 py-3 ${
                  n.is_read ? "" : "border-start border-4 border-danger"
                }`}
                style={n.is_read ? undefined : { background: "rgba(220,53,69,0.08)" }}
              >
                <div className="d-flex gap-3 align-items-start">
                  <span style={{ fontSize: "1.3rem", lineHeight: 1.2 }}>{TYPE_ICON[n.type] || "🔔"}</span>
                  <div>
                    <div className="fw-medium">
                      {!n.is_read && <span className="badge text-bg-danger me-2">{t("notif_badge_new")}</span>}
                      {n.title}
                    </div>
                    {n.message && (
                      <div
                        className="small text-secondary mt-1"
                        style={{ whiteSpace: "pre-line", maxHeight: 160, overflowY: "auto" }}
                      >
                        {n.message}
                      </div>
                    )}
                    <div className="small text-secondary mt-1">{fmtDateTime(n.created_at)}</div>
                  </div>
                </div>
                {!n.is_read && (
                  <button className="btn btn-sm btn-outline-secondary flex-shrink-0 py-0" onClick={() => markRead(n)}>
                    Mark read
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {hasMore && (
        <div className="text-center">
          <button className="btn btn-outline-brand btn-sm px-4" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? <><span className="spinner-border spinner-border-sm me-2" />{t("notif_loading_more")}</> : t("notif_btn_load_more")}
          </button>
        </div>
      )}
    </div>
  );
}
