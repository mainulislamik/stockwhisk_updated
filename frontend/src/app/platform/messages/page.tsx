"use client";

import { confirmAction, showError, showSuccess, showInfo } from "@/lib/dialogs";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { EmptyRow, ErrorState, PageHeader, Spinner } from "@/components/ui";
import toast from "react-hot-toast";

type Message = {
  id: number;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

function fmt(v: string) {
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function MessagesPage() {
  const [rows, setRows] = useState<Message[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await api<{ messages: Message[] }>("/platform/messages/");
      setRows(d.messages);
    } catch (e: any) {
      setError(e?.message || "Failed to load messages.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const s = q.trim().toLowerCase();
    return s ? rows.filter((r) => `${r.name} ${r.email} ${r.subject} ${r.message}`.toLowerCase().includes(s)) : rows;
  }, [rows, q]);

  async function markRead(m: Message) {
    try { await api(`/platform/messages/${m.id}/mark-read/`, { method: "POST" }); await load(); }
    catch (e: any) { toast.error(e?.message || "Failed."); }
  }
  async function del(m: Message) {
    if (!(await confirmAction("Delete this message?"))) return;
    try { await api(`/platform/messages/${m.id}/`, { method: "DELETE" }); await load(); }
    catch (e: any) { toast.error(e?.message || "Failed."); }
  }

  if (error) return <ErrorState error={error} />;
  if (!rows) return <Spinner />;

  return (
    <>
      <PageHeader title="Contact Messages" />
      <input className="form-control mb-3" placeholder="Filter messages…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="thead-4">
              <tr><th>When</th><th>From</th><th>Subject</th><th>Message</th><th className="text-end">Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <EmptyRow cols={5} text="No messages." />}
              {filtered.map((m) => (
                <tr key={m.id} className={m.is_read ? "" : "table-light"}>
                  <td className="text-nowrap small">{fmt(m.created_at)}</td>
                  <td>
                    <div className="fw-semibold">{m.name} {!m.is_read && <span className="badge text-bg-primary">new</span>}</div>
                    <div className="text-secondary small">{m.email}{m.phone ? ` · ${m.phone}` : ""}</div>
                  </td>
                  <td>{m.subject || "—"}</td>
                  <td style={{ whiteSpace: "pre-wrap", maxWidth: "28rem" }}>{m.message}</td>
                  <td className="text-end">
                    <div className="d-flex gap-2 justify-content-end">
                      {!m.is_read && <button className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => markRead(m)}>Mark read</button>}
                      <button className="btn btn-link btn-sm p-0 text-decoration-none text-danger" onClick={() => del(m)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
