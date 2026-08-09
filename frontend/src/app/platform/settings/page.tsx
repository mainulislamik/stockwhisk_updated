"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, PageHeader } from "@/components/ui";

export default function PlatformSettingsPage() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpDefaultFrom, setSmtpDefaultFrom] = useState("");
  const [smtpUseTls, setSmtpUseTls] = useState(true);

  useEffect(() => {
    api<any>("/platform_admin/smtp-settings/").then((data) => {
      setSmtpHost(data.smtp_host || "");
      setSmtpPort(data.smtp_port?.toString() || "587");
      setSmtpUser(data.smtp_user || "");
      setSmtpPassword(data.smtp_password || "");
      setSmtpDefaultFrom(data.smtp_default_from || "");
      setSmtpUseTls(data.smtp_use_tls !== false); // default true if undefined
    }).catch(console.error);
  }, []);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    
    try {
      await api("/platform_admin/smtp-settings/", {
        method: "PUT",
        body: {
          smtp_host: smtpHost,
          smtp_port: parseInt(smtpPort) || 587,
          smtp_user: smtpUser,
          smtp_password: smtpPassword,
          smtp_default_from: smtpDefaultFrom,
          smtp_use_tls: smtpUseTls,
        }
      });
      setMsg({ ok: true, text: "SMTP settings saved successfully." });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.data?.detail || "Failed to save SMTP settings." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <PageHeader title="Platform Settings" />

      {msg && (
        <div className={`p-4 rounded-lg font-medium text-sm flex items-center gap-2 ${msg.ok ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
          <i className={`bi ${msg.ok ? "bi-check-circle-fill" : "bi-exclamation-triangle-fill"}`}></i>
          {msg.text}
        </div>
      )}

      <Card className="border-t-4 border-t-purple-500 bg-white">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2 text-purple-600">
            <i className="bi bi-envelope-at"></i> SMTP Email Configuration
          </h2>
          <p className="text-secondary text-sm mb-6">
            Configure the platform's email server used for sending Registration OTPs, password resets, and notifications. 
            Leave host/user blank to fallback to environment variables.
          </p>

          <form onSubmit={saveSettings} className="space-y-4">
            <div className="row g-3">
              <div className="col-md-8">
                <div className="form-floating">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="SMTP Host"
                    value={smtpHost}
                    onChange={e => setSmtpHost(e.target.value)}
                  />
                  <label>SMTP Host (e.g., smtp.gmail.com)</label>
                </div>
              </div>
              <div className="col-md-4">
                <div className="form-floating">
                  <input
                    type="number"
                    className="form-control"
                    placeholder="SMTP Port"
                    value={smtpPort}
                    onChange={e => setSmtpPort(e.target.value)}
                  />
                  <label>SMTP Port (e.g., 587)</label>
                </div>
              </div>
            </div>

            <div className="form-floating">
              <input
                type="text"
                className="form-control"
                placeholder="SMTP Username"
                value={smtpUser}
                onChange={e => setSmtpUser(e.target.value)}
              />
              <label>SMTP Username (e.g., your.email@gmail.com)</label>
            </div>
            
            <div className="form-floating">
              <input
                type="password"
                className="form-control"
                placeholder="SMTP Password / App Password"
                value={smtpPassword}
                onChange={e => setSmtpPassword(e.target.value)}
              />
              <label>SMTP Password / App Password</label>
            </div>
            <div className="form-text text-secondary text-sm">If using Gmail, generate a 16-character App Password.</div>

            <div className="form-floating">
              <input
                type="email"
                className="form-control"
                placeholder="Default From Email"
                value={smtpDefaultFrom}
                onChange={e => setSmtpDefaultFrom(e.target.value)}
              />
              <label>Default From Email (e.g., noreply@stockwhisk.com)</label>
            </div>

            <div className="form-check form-switch mt-4 mb-4">
              <input 
                className="form-check-input" 
                type="checkbox" 
                role="switch" 
                id="useTlsSwitch" 
                checked={smtpUseTls}
                onChange={e => setSmtpUseTls(e.target.checked)}
              />
              <label className="form-check-label text-secondary fw-medium" htmlFor="useTlsSwitch">
                Use TLS (Recommended)
              </label>
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-gray-200">
              <button type="submit" disabled={saving} className="btn btn-primary rounded-pill px-5 shadow-sm">
                {saving ? "Saving..." : "Save Configuration"}
              </button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
