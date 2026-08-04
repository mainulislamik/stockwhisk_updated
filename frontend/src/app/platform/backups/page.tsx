"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { Card, PageHeader } from "@/components/ui";

export default function BackupsPage() {
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function download() {
    setDownloading(true);
    setMsg(null);
    try {
      const res = await api<Response>("/platform/backups/download/", { raw: true });
      if (!res.ok) throw new Error(`Download failed (${res.status}).`);
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const name = /filename="?([^"]+)"?/.exec(cd)?.[1] || "stockwhisk_backup.sql";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
      setMsg({ ok: true, text: "Backup downloaded." });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "Download failed." });
    } finally {
      setDownloading(false);
    }
  }

  async function restore(e: React.FormEvent) {
    e.preventDefault();
    const f = fileRef.current?.files?.[0];
    if (!f) { setMsg({ ok: false, text: "Choose a .sql file first." }); return; }
    if (!confirm("Restoring OVERWRITES the current database. Continue?")) return;
    setRestoring(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("backup_file", f);
      const res = await api<{ status: string; detail: string }>("/platform/backups/restore/", { method: "POST", body: fd });
      setMsg({ ok: true, text: res.detail || "Database restored." });
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) {
      setMsg({ ok: false, text: e?.data?.detail || e?.message || "Restore failed." });
    } finally {
      setRestoring(false);
    }
  }

  return (
    <>
      <PageHeader title="System Backups" />

      {msg && <div className={`alert ${msg.ok ? "alert-success" : "alert-danger"} py-2 px-3`}>{msg.text}</div>}

      <div className="row g-3" style={{ maxWidth: "52rem" }}>
        <div className="col-md-6">
          <Card>
            <h2 className="h6 fw-bold">Download backup</h2>
            <p className="text-secondary small">Generates a full PostgreSQL SQL dump of the entire platform database.</p>
            <button className="btn btn-brand" disabled={downloading} onClick={download}>
              {downloading ? "Preparing…" : "⬇ Download .sql"}
            </button>
          </Card>
        </div>
        <div className="col-md-6">
          <Card>
            <h2 className="h6 fw-bold text-danger">Restore backup</h2>
            <p className="text-secondary small">Uploads a .sql dump and replaces all current data. This cannot be undone.</p>
            <form onSubmit={restore}>
              <input ref={fileRef} type="file" accept=".sql" className="form-control mb-2" />
              <button className="btn btn-outline-danger" disabled={restoring}>
                {restoring ? "Restoring…" : "Restore database"}
              </button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
