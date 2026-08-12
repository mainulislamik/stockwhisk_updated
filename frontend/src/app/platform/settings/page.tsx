"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, PageHeader } from "@/components/ui";

export default function PlatformSettingsPage() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string; trace?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpDefaultFrom, setSmtpDefaultFrom] = useState("");
  const [smtpUseTls, setSmtpUseTls] = useState(true);
  const [trialDays, setTrialDays] = useState("45");
  const [contactEmail, setContactEmail] = useState("");
  const [contactSmtpUser, setContactSmtpUser] = useState("");
  const [contactSmtpPassword, setContactSmtpPassword] = useState("");
  const [savingContact, setSavingContact] = useState(false);

  useEffect(() => {
    api<any>("/platform/smtp-settings/").then((data) => {
      setSmtpHost(data.smtp_host || "");
      setSmtpPort(data.smtp_port?.toString() || "587");
      setSmtpUser(data.smtp_user || "");
      setSmtpPassword(data.smtp_password || "");
      setSmtpDefaultFrom(data.smtp_default_from || "");
      setSmtpUseTls(data.smtp_use_tls !== false); // default true if undefined
      setTrialDays((data.default_trial_days ?? 45).toString());
      setContactEmail(data.contact_email || "");
      setContactSmtpUser(data.contact_smtp_user || "");
      setContactSmtpPassword(data.contact_smtp_password || "");
    }).catch(console.error);
  }, []);

  async function saveContactEmail(e: React.FormEvent) {
    e.preventDefault();
    setSavingContact(true);
    setMsg(null);
    try {
      await api("/platform/smtp-settings/", { method: "PUT", body: {
        contact_email: contactEmail,
        contact_smtp_user: contactSmtpUser,
        contact_smtp_password: contactSmtpPassword,
      } });
      setMsg({ ok: true, text: "Contact settings saved." });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.data?.detail || "Failed to save contact email." });
    } finally {
      setSavingContact(false);
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    
    try {
      await api("/platform/smtp-settings/", {
        method: "PUT",
        body: {
          smtp_host: smtpHost,
          smtp_port: parseInt(smtpPort) || 587,
          smtp_user: smtpUser,
          smtp_password: smtpPassword,
          smtp_default_from: smtpDefaultFrom,
          smtp_use_tls: smtpUseTls,
          default_trial_days: parseInt(trialDays) || 45,
        }
      });
      setMsg({ ok: true, text: "Settings saved successfully." });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.data?.detail || "Failed to save SMTP settings." });
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setMsg(null);
    try {
      await api("/platform/smtp-test/", { method: "POST" });
      setMsg({ ok: true, text: "Connection successful! A test email was sent to your SMTP Username." });
    } catch (e: any) {
      setMsg({ 
        ok: false, 
        text: e?.data?.detail || "Connection failed.", 
        trace: e?.data?.trace 
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <PageHeader title="Platform Settings" />

      {msg && (
        <div className={`alert ${msg.ok ? 'alert-success' : 'alert-danger'} d-flex flex-column gap-2`}>
          <div className="d-flex align-items-center gap-2">
            <i className={`bi ${msg.ok ? "bi-check-circle-fill" : "bi-exclamation-triangle-fill"}`}></i>
            {msg.text}
          </div>
          {msg.trace && (
            <pre className="mt-2 p-2 bg-dark bg-opacity-25 rounded overflow-auto small mb-0" style={{ whiteSpace: "pre-wrap" }}>
              {msg.trace}
            </pre>
          )}
        </div>
      )}

      <Card className="border-top border-4 border-primary">
        <div className="p-2">
          <h2 className="h5 fw-bold mb-2 d-flex align-items-center gap-2 text-primary">
            <i className="bi bi-envelope-at"></i> SMTP Email Configuration
          </h2>
          <p className="text-secondary small mb-4">
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
            <div className="form-text text-secondary small">If using Gmail, generate a 16-character App Password.</div>

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

            <div className="d-flex align-items-center justify-content-end gap-3 pt-4 mt-3 border-top border-secondary border-opacity-25">
              <button 
                type="button" 
                onClick={testConnection} 
                disabled={testing || saving || !smtpHost} 
                className="btn btn-outline-secondary rounded-pill px-4 shadow-sm"
              >
                {testing ? "Testing..." : "Test Connection"}
              </button>
              <button type="submit" disabled={saving || testing} className="btn btn-primary rounded-pill px-5 shadow-sm">
                {saving ? "Saving..." : "Save Configuration"}
              </button>
            </div>
          </form>
        </div>
      </Card>

      <Card className="border-top border-4 border-success">
        <div className="p-2">
          <h2 className="h5 fw-bold mb-2 d-flex align-items-center gap-2 text-success">
            <i className="bi bi-inbox"></i> Contact Form Recipient
          </h2>
          <p className="text-secondary small mb-4">
            Messages sent from the public <strong>Contact Us</strong> page are emailed to this address
            (and always saved under <strong>Messages</strong>). Optionally set this mailbox's own SMTP
            login below so the notification &amp; auto-reply are sent <strong>from</strong> this address
            (reuses the host/port/TLS above). Leave the login blank to send from the noreply address.
          </p>
          <form onSubmit={saveContactEmail} className="row g-3">
            <div className="col-12">
              <div className="form-floating">
                <input
                  type="email"
                  className="form-control"
                  placeholder="contact@stockwhisk.com"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                />
                <label>Contact inbox / From email (e.g., contact@stockwhisk.com)</label>
              </div>
            </div>
            <div className="col-md-6">
              <div className="form-floating">
                <input
                  type="text"
                  autoComplete="off"
                  className="form-control"
                  placeholder="contact@stockwhisk.com"
                  value={contactSmtpUser}
                  onChange={e => setContactSmtpUser(e.target.value)}
                />
                <label>Contact SMTP Username (optional)</label>
              </div>
            </div>
            <div className="col-md-6">
              <div className="form-floating">
                <input
                  type="password"
                  autoComplete="new-password"
                  className="form-control"
                  placeholder="Contact mailbox password"
                  value={contactSmtpPassword}
                  onChange={e => setContactSmtpPassword(e.target.value)}
                />
                <label>Contact SMTP Password (optional)</label>
              </div>
            </div>
            <div className="col-12 d-flex justify-content-end">
              <button type="submit" disabled={savingContact} className="btn btn-success rounded-pill px-4 shadow-sm">
                {savingContact ? "Saving..." : "Save Contact Settings"}
              </button>
            </div>
          </form>
        </div>
      </Card>

      <Card className="border-top border-4 border-info">
        <div className="p-2">
          <h2 className="h5 fw-bold mb-2 d-flex align-items-center gap-2 text-info">
            <i className="bi bi-hourglass-split"></i> Subscription Defaults
          </h2>
          <p className="text-secondary small mb-4">
            How many days of free trial every newly registered shop gets. Existing shops are not affected.
          </p>
          <form onSubmit={saveSettings} className="row g-3 align-items-end">
            <div className="col-md-4">
              <div className="form-floating">
                <input
                  type="number"
                  min={0}
                  className="form-control"
                  placeholder="45"
                  value={trialDays}
                  onChange={(e) => setTrialDays(e.target.value)}
                />
                <label>Default trial length (days)</label>
              </div>
            </div>
            <div className="col-md-4">
              <button type="submit" disabled={saving} className="btn btn-primary rounded-pill px-5 shadow-sm">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
