"use client";

import { confirmAction, showError, showSuccess, showInfo } from "@/lib/dialogs";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Card, PageHeader } from "@/components/ui";

export default function BackupsPage() {
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  
  const [driveClientId, setDriveClientId] = useState("");
  const [driveClientSecret, setDriveClientSecret] = useState("");
  const [driveFolderId, setDriveFolderId] = useState("");
  const [backupEnabled, setBackupEnabled] = useState(false);
  const [backupInterval, setBackupInterval] = useState(1440);
  const [savingConfig, setSavingConfig] = useState(false);
  const [triggeringDrive, setTriggeringDrive] = useState(false);
  const [downloadingMedia, setDownloadingMedia] = useState(false);
  const [restoringMedia, setRestoringMedia] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check for OAuth callback code
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      setMsg({ ok: true, text: "Authenticating with Google..." });
      api<{detail: string}>("/platform/backups/drive-callback/", {
        method: "POST",
        body: { code, redirect_uri: window.location.origin + window.location.pathname }
      }).then(res => {
        setMsg({ ok: true, text: "Google Drive connected successfully!" });
        setIsConnected(true);
        // Remove code from URL cleanly
        window.history.replaceState({}, document.title, window.location.pathname);
      }).catch(e => {
        setMsg({ ok: false, text: e?.data?.detail || "Failed to connect Google Drive." });
      });
    }

    api<any>("/platform/backups/drive-config/").then((data) => {
      setDriveClientId(data.drive_client_id || "");
      setDriveClientSecret(data.drive_client_secret || "");
      setDriveFolderId(data.drive_folder_id || "");
      setBackupEnabled(data.drive_backup_enabled || false);
      setBackupInterval(data.drive_backup_interval_minutes || 1440);
      setIsConnected(!!data.has_refresh_token);
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
          drive_client_id: driveClientId,
          drive_client_secret: driveClientSecret,
          drive_folder_id: parsedFolderId,
          drive_backup_enabled: backupEnabled,
          drive_backup_interval_minutes: backupInterval
        }
      });
      
      if (!isConnected) {
        // After saving, generate auth URL and redirect
        const authRes = await api<{auth_url: string}>("/platform/backups/drive-auth-url/", {
          method: "POST",
          body: { redirect_uri: window.location.origin + window.location.pathname }
        });
        window.location.href = authRes.auth_url;
      } else {
        setMsg({ ok: true, text: "Settings saved successfully." });
        setSavingConfig(false);
      }
      
    } catch (e: any) {
      setMsg({ ok: false, text: e?.data?.detail || "Failed to save Drive config or start auth." });
      setSavingConfig(false);
    }
  }

  async function reconnectGoogleDrive() {
    setSavingConfig(true);
    try {
      const authRes = await api<{auth_url: string}>("/platform/backups/drive-auth-url/", {
        method: "POST",
        body: { redirect_uri: window.location.origin + window.location.pathname }
      });
      window.location.href = authRes.auth_url;
    } catch (e: any) {
      setMsg({ ok: false, text: e?.data?.detail || "Failed to start auth." });
      setSavingConfig(false);
    }
  }

  async function triggerDriveBackup() {
    setTriggeringDrive(true);
    setMsg(null);
    try {
      const res = await api<{detail: string}>("/platform/backups/drive-trigger/", { method: "POST" });
      setMsg({ ok: true, text: res.detail || "Google Drive backup completed successfully." });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.data?.detail || e?.message || "Failed to trigger Google Drive backup." });
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
    if (!(await confirmAction("Restoring OVERWRITES the current database. Continue?"))) return;
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

  async function downloadMedia() {
    setDownloadingMedia(true);
    setMsg(null);
    try {
      const res = await api<Response>("/platform/backups/media/download/", { raw: true });
      if (!res.ok) throw new Error(`Media download failed (${res.status}).`);
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const name = /filename="?([^"]+)"?/.exec(cd)?.[1] || "stockwhisk_media.zip";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
      setMsg({ ok: true, text: "Media backup downloaded." });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "Media download failed." });
    } finally {
      setDownloadingMedia(false);
    }
  }

  async function restoreMedia(e: React.FormEvent) {
    e.preventDefault();
    const f = mediaFileRef.current?.files?.[0];
    if (!f) { setMsg({ ok: false, text: "Choose a .zip file first." }); return; }
    if (!(await confirmAction("Restoring will OVERWRITE existing media files. Continue?"))) return;
    setRestoringMedia(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("backup_file", f);
      const res = await api<{ status: string; detail: string }>("/platform/backups/media/restore/", { method: "POST", body: fd });
      setMsg({ ok: true, text: res.detail || "Media restored successfully." });
      if (mediaFileRef.current) mediaFileRef.current.value = "";
    } catch (e: any) {
      setMsg({ ok: false, text: e?.data?.detail || e?.message || "Media restore failed." });
    } finally {
      setRestoringMedia(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <PageHeader title="System Backups" />

      {msg && (
        <div className={`p-4 rounded-lg font-medium text-sm flex items-center gap-2 ${msg.ok ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
          <i className={`bi ${msg.ok ? "bi-check-circle-fill" : "bi-exclamation-triangle-fill"}`}></i>
          {msg.text}
        </div>
      )}

      {/* Google Drive Automated Backups Card */}
      <Card className="border-t-4 border-t-blue-500 bg-slate-900/40">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2 text-blue-400">
            <i className="bi bi-google"></i> Automated Google Drive Backups
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Configure automatic daily backups directly to Google Drive. This securely backs up both your Database (.sql) and all Media Images (.zip) without using local server storage.
          </p>

          <form onSubmit={saveDriveConfig} className="space-y-4">
            <div className="form-check form-switch mb-4">
              <input 
                className="form-check-input" 
                type="checkbox" 
                role="switch" 
                id="enableBackupSwitch" 
                checked={backupEnabled}
                onChange={e => setBackupEnabled(e.target.checked)}
              />
              <label className="form-check-label text-slate-300" htmlFor="enableBackupSwitch">
                Enable Automated Google Drive Backups
              </label>
            </div>

            {backupEnabled && (
              <div className="form-floating">
                <input
                  type="number"
                  min="1"
                  className="form-control font-mono text-sm"
                  placeholder="Backup Interval (minutes)"
                  value={backupInterval}
                  onChange={e => setBackupInterval(parseInt(e.target.value) || 1)}
                  required
                />
                <label>Backup Interval (minutes)</label>
              </div>
            )}

            <div className="form-floating">
              <input
                type="text"
                className="form-control font-mono text-sm"
                placeholder="Google Drive Folder ID"
                value={driveFolderId}
                onChange={e => setDriveFolderId(e.target.value)}
                required
              />
              <label>Google Drive Folder ID</label>
            </div>
            
            <div className="form-floating">
              <input
                type="text"
                className="form-control font-mono text-sm"
                placeholder="OAuth Client ID"
                value={driveClientId}
                onChange={e => setDriveClientId(e.target.value)}
                required
              />
              <label>OAuth Client ID</label>
            </div>
            
            <div className="form-floating">
              <input
                type="text"
                className="form-control font-mono text-sm"
                placeholder="OAuth Client Secret"
                value={driveClientSecret}
                onChange={e => setDriveClientSecret(e.target.value)}
                required
              />
              <label>OAuth Client Secret</label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700/50">
              {isConnected && (
                <span className="text-green-500 text-sm font-medium mr-auto flex items-center gap-2">
                  <i className="bi bi-check-circle-fill"></i> Connected to Google Drive
                </span>
              )}
              
              <button 
                type="button" 
                onClick={triggerDriveBackup}
                disabled={triggeringDrive || !isConnected}
                className="btn btn-outline-primary rounded-pill px-4"
              >
                {triggeringDrive ? <><span className="spinner-border spinner-border-sm me-2"></span>Triggering...</> : <><i className="bi bi-cloud-arrow-up me-2"></i>Trigger Backup Now</>}
              </button>

              {isConnected && (
                <button 
                  type="button" 
                  onClick={reconnectGoogleDrive}
                  disabled={savingConfig}
                  className="btn btn-outline-secondary rounded-pill px-4"
                >
                  Reconnect Google
                </button>
              )}

              <button type="submit" disabled={savingConfig} className="btn btn-primary rounded-pill px-4 shadow-sm">
                {savingConfig ? "Saving..." : (isConnected ? "Save Settings" : "Save & Connect Google Drive")}
              </button>
            </div>
          </form>
        </div>
      </Card>

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

      <div className="row g-3" style={{ maxWidth: "52rem" }}>
        <div className="col-md-6">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-body p-4 vstack">
              <div className="d-flex align-items-center gap-2 mb-2">
                <i className="bi bi-images text-dark fs-5"></i>
                <h2 className="h6 fw-bold mb-0">Media Backup (Images)</h2>
              </div>
              <p className="text-secondary small mb-4">Generates a .zip file of all uploaded shop media (images, logos) and downloads it to your computer.</p>
              <div className="mt-auto">
                <button className="btn btn-dark rounded-pill px-4 shadow-sm w-100" disabled={downloadingMedia} onClick={downloadMedia}>
                  {downloadingMedia ? (
                    <><span className="spinner-border spinner-border-sm me-2"></span>Zipping Media…</>
                  ) : (
                    <><i className="bi bi-file-zip-fill me-2"></i>Download Media (.zip)</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card border-0 shadow-sm rounded-4 h-100 border-top border-warning border-4">
            <div className="card-body p-4 vstack">
              <div className="d-flex align-items-center gap-2 mb-2">
                <i className="bi bi-folder-symlink-fill text-warning fs-5"></i>
                <h2 className="h6 fw-bold text-warning mb-0">Media Disaster Recovery</h2>
              </div>
              <p className="text-secondary small mb-4">Uploads a .zip media backup (from your computer or downloaded from Google Drive) and restores images.</p>
              <form onSubmit={restoreMedia} className="mt-auto vstack gap-3">
                <input ref={mediaFileRef} type="file" accept=".zip" className="form-control rounded-3" />
                <button className="btn btn-outline-warning rounded-pill px-4 w-100 fw-medium" disabled={restoringMedia}>
                  {restoringMedia ? (
                    <><span className="spinner-border spinner-border-sm me-2"></span>Restoring Media…</>
                  ) : (
                    <><i className="bi bi-cloud-upload-fill me-2"></i>Restore Media (.zip)</>
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
