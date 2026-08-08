"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Card, PageHeader } from "@/components/ui";

export default function BackupsPage() {
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  
  const [driveJson, setDriveJson] = useState("");
  const [driveFolderId, setDriveFolderId] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [triggeringDrive, setTriggeringDrive] = useState(false);
  
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<any>("/platform/backups/drive-config/").then((data) => {
      setDriveJson(data.drive_credentials_json || "");
      setDriveFolderId(data.drive_folder_id || "");
    }).catch(console.error);
  }, []);

  async function saveDriveConfig(e: React.FormEvent) {
    e.preventDefault();
    setSavingConfig(true);
    setMsg(null);
    
    // Automatically extract folder ID if they pasted a full URL
    let parsedFolderId = driveFolderId.trim();
    const folderMatch = parsedFolderId.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch) {
      parsedFolderId = folderMatch[1];
      setDriveFolderId(parsedFolderId); // update UI
    }

    try {
      await api("/platform/backups/drive-config/", {
        method: "PUT",
        body: {
          drive_credentials_json: driveJson,
          drive_folder_id: parsedFolderId
        }
      });
      setMsg({ ok: true, text: "Google Drive configuration saved successfully." });
    } catch (e: any) {
      setMsg({ ok: false, text: "Failed to save Drive config." });
    } finally {
      setSavingConfig(false);
    }
  }

  async function triggerDriveBackup() {
    setTriggeringDrive(true);
    setMsg(null);
    try {
      await api("/platform/backups/drive-trigger/", { method: "POST" });
      setMsg({ ok: true, text: "Google Drive backup queued. It will run in the background." });
    } catch (e: any) {
      setMsg({ ok: false, text: "Failed to trigger Google Drive backup." });
    } finally {
      setTriggeringDrive(false);
    }
  }

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
    <div className="vstack gap-4">
      <PageHeader title="System Backups" />

      {msg && (
        <div className={`alert ${msg.ok ? "alert-success" : "alert-danger"} py-3 px-4 rounded-4 shadow-sm border-0 d-flex align-items-center gap-2 mb-0`} style={{ maxWidth: "52rem" }}>
          <i className={`bi ${msg.ok ? "bi-check-circle-fill text-success" : "bi-exclamation-triangle-fill text-danger"} fs-5`}></i>
          {msg.text}
        </div>
      )}

      {/* Google Drive Integration Section */}
      <div className="card border-0 shadow-sm rounded-4 overflow-hidden" style={{ maxWidth: "52rem" }}>
        <div className="card-header bg-primary bg-opacity-10 border-0 py-3">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-google text-primary fs-5"></i>
            <h5 className="mb-0 fw-bold text-primary">Automated Google Drive Backups</h5>
          </div>
        </div>
        <div className="card-body p-4">
          <p className="text-secondary mb-4">
            Configure automatic daily backups directly to Google Drive. This uses no local server storage. 
            You must provide a Service Account JSON and a shared folder ID.
          </p>
          
          <form onSubmit={saveDriveConfig} className="vstack gap-3 mb-4">
            <div className="form-floating">
              <input 
                type="text" 
                className="form-control" 
                id="folderId" 
                placeholder="Folder ID"
                value={driveFolderId}
                onChange={(e) => setDriveFolderId(e.target.value)}
              />
              <label htmlFor="folderId">Google Drive Folder ID</label>
            </div>
            
            <div className="form-floating">
              <textarea 
                className="form-control font-monospace text-muted" 
                id="serviceJson" 
                placeholder="{...}"
                style={{ height: "150px" }}
                value={driveJson}
                onChange={(e) => setDriveJson(e.target.value)}
              ></textarea>
              <label htmlFor="serviceJson">Service Account credentials.json</label>
            </div>
            
            <div className="d-flex justify-content-end gap-2 mt-2">
              <button 
                type="button" 
                className="btn btn-outline-primary rounded-pill px-4" 
                onClick={triggerDriveBackup}
                disabled={triggeringDrive || !driveFolderId}
              >
                {triggeringDrive ? (
                  <><span className="spinner-border spinner-border-sm me-2"></span>Triggering...</>
                ) : (
                  <><i className="bi bi-cloud-arrow-up me-2"></i>Trigger Drive Backup Now</>
                )}
              </button>
              
              <button type="submit" className="btn btn-primary rounded-pill px-4 shadow-sm" disabled={savingConfig}>
                {savingConfig ? "Saving…" : "Save Configuration"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="row g-3" style={{ maxWidth: "52rem" }}>
        <div className="col-md-6">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-body p-4 vstack">
              <div className="d-flex align-items-center gap-2 mb-2">
                <i className="bi bi-download text-dark fs-5"></i>
                <h2 className="h6 fw-bold mb-0">Manual Download</h2>
              </div>
              <p className="text-secondary small mb-4">Generates a full PostgreSQL SQL dump of the entire platform database and downloads it to your computer.</p>
              <div className="mt-auto">
                <button className="btn btn-dark rounded-pill px-4 shadow-sm w-100" disabled={downloading} onClick={download}>
                  {downloading ? (
                    <><span className="spinner-border spinner-border-sm me-2"></span>Preparing…</>
                  ) : (
                    <><i className="bi bi-file-earmark-arrow-down me-2"></i>Download .sql</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card border-0 shadow-sm rounded-4 h-100 border-top border-danger border-4">
            <div className="card-body p-4 vstack">
              <div className="d-flex align-items-center gap-2 mb-2">
                <i className="bi bi-exclamation-triangle-fill text-danger fs-5"></i>
                <h2 className="h6 fw-bold text-danger mb-0">Disaster Recovery (Restore)</h2>
              </div>
              <p className="text-secondary small mb-4">Uploads a .sql dump (from your computer or downloaded from Google Drive) and replaces all current data. This cannot be undone.</p>
              <form onSubmit={restore} className="mt-auto vstack gap-3">
                <input ref={fileRef} type="file" accept=".sql" className="form-control rounded-3" />
                <button className="btn btn-outline-danger rounded-pill px-4 w-100 fw-medium" disabled={restoring}>
                  {restoring ? (
                    <><span className="spinner-border spinner-border-sm me-2"></span>Restoring…</>
                  ) : (
                    <><i className="bi bi-database-fill-up me-2"></i>Restore database</>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
