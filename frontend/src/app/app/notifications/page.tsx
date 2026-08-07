"use client";

import { useEffect, useState } from "react";
import { api, fetchAll } from "@/lib/api";
import { ErrorState, PageHeader, Spinner, fmtDate } from "@/components/ui";

type Note = { id: number; type: string; title: string; message: string; is_read: boolean; created_at: string };

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
  const [error, setError] = useState("");

  async function load() {
    try {
      setRows(await fetchAll<Note>("/notifications/notifications/"));
    } catch (e: any) {
      setError(e?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function markRead(n: Note) {
    try {
      await api(`/notifications/notifications/${n.id}/read/`, { method: "POST" });
      setRows((rs) => rs.map((r) => (r.id === n.id ? { ...r, is_read: true } : r)));
      window.dispatchEvent(new Event("notifications_updated"));
    } catch (e: any) {
      alert(e?.message || "Could not update");
    }
  }

  async function markAll() {
    try {
      await api(`/notifications/notifications/read_all/`, { method: "POST" });
      setRows((rs) => rs.map((r) => ({ ...r, is_read: true })));
      window.dispatchEvent(new Event("notifications_updated"));
    } catch (e: any) {
      alert(e?.message || "Could not update");
    }
  }

  if (loading) return <Spinner label="Loading notifications…" />;
  if (error) return <ErrorState error={error} />;

  const unreadCount = rows.filter((r) => !r.is_read).length;

  return (
    <div className="vstack gap-3">
      <PageHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
        actions={
          unreadCount > 0 ? (
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
              <div className="mt-2">No notifications yet.</div>
              <div className="small mt-1">You'll see low-stock alerts and other updates here.</div>
            </div>
          ) : (
            rows.map((n) => (
              <div
                key={n.id}
                className={`list-group-item d-flex justify-content-between align-items-start gap-3 py-3 ${n.is_read ? "" : "bg-light border-start border-4 border-danger"}`}
              >
                <div className="d-flex gap-3 align-items-start">
                  <span style={{ fontSize: "1.3rem", lineHeight: 1.2 }}>{TYPE_ICON[n.type] || "🔔"}</span>
                  <div>
                    <div className="fw-medium">
                      {!n.is_read && <span className="badge text-bg-danger me-2">New</span>}
                      {n.title}
                    </div>
                    {n.message && <div className="small text-secondary mt-1">{n.message}</div>}
                    <div className="small text-secondary mt-1">{fmtDate(n.created_at)}</div>
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
    </div>
  );
}
