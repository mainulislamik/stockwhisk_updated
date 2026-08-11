"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { api, ApiError } from "@/lib/api";

type MailAccount = {
  email: string;
  quota: string | null;
  used?: number;              // bytes actually used on disk
  quota_bytes?: number | null; // quota in bytes, null = unlimited
};

function formatBytes(n: number): string {
  if (!n || n < 1) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

type Modal =
  | { type: "create" }
  | { type: "password"; email: string }
  | { type: "quota"; email: string; current: string | null }
  | null;

export default function MailServerPage() {
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Modal>(null);

  const [createForm, setCreateForm] = useState({ email: "", password: "", quota: "1024M" });
  const [passwordForm, setPasswordForm] = useState({ password: "", confirm: "" });
  const [quotaForm, setQuotaForm] = useState({ quota: "1024M" });

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const data = await api<MailAccount[]>("/platform/mail-accounts/");
      setAccounts(data ?? []);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAccounts(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("/platform/mail-accounts/", { method: "POST", body: createForm });
      toast.success("Account created");
      setModal(null);
      setCreateForm({ email: "", password: "", quota: "1024M" });
      fetchAccounts();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create account");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modal?.type !== "password") return;
    if (passwordForm.password !== passwordForm.confirm) {
      toast.error("Passwords do not match");
      return;
    }
    try {
      await api("/platform/mail-accounts/", {
        method: "PATCH",
        body: { email: modal.email, password: passwordForm.password },
      });
      toast.success("Password updated");
      setModal(null);
      setPasswordForm({ password: "", confirm: "" });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update password");
    }
  };

  const handleQuotaChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modal?.type !== "quota") return;
    try {
      await api("/platform/mail-accounts/", {
        method: "PATCH",
        body: { email: modal.email, quota: quotaForm.quota },
      });
      toast.success("Quota updated");
      setModal(null);
      fetchAccounts();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update quota");
    }
  };

  const handleDelete = async (email: string) => {
    if (!window.confirm(`Delete ${email}? This is permanent.`)) return;
    try {
      await api("/platform/mail-accounts/", { method: "DELETE", body: { email } });
      toast.success("Account deleted");
      fetchAccounts();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete account");
    }
  };

  const handleLoginAs = async (email: string) => {
    try {
      const data = await api<{ sso_url: string }>(
        "/platform/mail-accounts/sso/",
        { method: "POST", body: { email } }
      );
      // Open the server-side SSO handler — Caddy routes mail.stockwhisk.com/sso to Django,
      // Django logs into Roundcube server-side, sets the session cookie, then redirects.
      window.open(`https://mail.stockwhisk.com${data.sso_url}`, "_blank");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "SSO login failed");
    }
  };

  const QUOTA_OPTIONS = [
    { label: "512 MB", value: "512M" },
    { label: "1 GB", value: "1024M" },
    { label: "2 GB", value: "2048M" },
    { label: "5 GB", value: "5120M" },
    { label: "10 GB", value: "10240M" },
    { label: "Unlimited", value: "" },
  ];

  const closeModal = () => setModal(null);

  return (
    <>
      {/* Page header */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h2 className="mb-1 fw-bold">Mail Server Admin</h2>
          <p className="text-muted small mb-0">
            <i className="bi-envelope-at me-1 text-primary"></i>
            Manage mailboxes, quotas &amp; 1-click logins
          </p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary" onClick={fetchAccounts} disabled={loading} title="Refresh usage">
            <i className="bi-arrow-clockwise"></i>
          </button>
          <button className="btn btn-primary" onClick={() => setModal({ type: "create" })}>
            <i className="bi-plus-lg me-2"></i>New Account
          </button>
        </div>
      </div>

      {/* Accounts table */}
      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-dark">
              <tr>
                <th className="ps-4">Email Account</th>
                <th style={{ minWidth: 220 }}>Storage Used / Quota</th>
                <th className="text-end pe-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="text-center py-5 text-muted">
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Loading accounts…
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-5 text-muted">
                    <i className="bi-inbox fs-3 d-block mb-2"></i>
                    No email accounts yet. Create one to get started.
                  </td>
                </tr>
              ) : (
                accounts.map((acc) => (
                  <tr key={acc.email}>
                    <td className="ps-4 fw-medium">
                      <i className="bi-envelope-fill text-primary me-2"></i>
                      {acc.email}
                    </td>
                    <td>
                      <UsageCell used={acc.used ?? 0} quotaBytes={acc.quota_bytes ?? null} />
                    </td>
                    <td className="text-end pe-3">
                      <div className="btn-group btn-group-sm">
                        <button
                          className="btn btn-outline-info"
                          title="Login as this user"
                          onClick={() => handleLoginAs(acc.email)}
                        >
                          <i className="bi-box-arrow-in-right me-1"></i>Login As
                        </button>
                        <button
                          className="btn btn-outline-warning"
                          title="Change password"
                          onClick={() => { setPasswordForm({ password: "", confirm: "" }); setModal({ type: "password", email: acc.email }); }}
                        >
                          <i className="bi-key"></i>
                        </button>
                        <button
                          className="btn btn-outline-secondary"
                          title="Change quota"
                          onClick={() => { setQuotaForm({ quota: acc.quota || "1024M" }); setModal({ type: "quota", email: acc.email, current: acc.quota }); }}
                        >
                          <i className="bi-hdd"></i>
                        </button>
                        <button
                          className="btn btn-outline-danger"
                          title="Delete account"
                          onClick={() => handleDelete(acc.email)}
                        >
                          <i className="bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Create Account Modal ── */}
      {modal?.type === "create" && (
        <ModalWrap title="New Email Account" icon="bi-envelope-plus" onClose={closeModal}>
          <form onSubmit={handleCreate}>
            <div className="mb-3">
              <label className="form-label small fw-semibold">Email Address</label>
              <input type="email" className="form-control" placeholder="name@stockwhisk.com"
                value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} required />
            </div>
            <div className="mb-3">
              <label className="form-label small fw-semibold">Password</label>
              <input type="password" className="form-control" placeholder="Strong password"
                value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} required />
            </div>
            <div className="mb-4">
              <label className="form-label small fw-semibold">Storage Quota</label>
              <select className="form-select" value={createForm.quota}
                onChange={e => setCreateForm({ ...createForm, quota: e.target.value })}>
                {QUOTA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <ModalFooter onClose={closeModal} label="Create Account" />
          </form>
        </ModalWrap>
      )}

      {/* ── Change Password Modal ── */}
      {modal?.type === "password" && (
        <ModalWrap title={`Change Password — ${modal.email}`} icon="bi-key" onClose={closeModal}>
          <form onSubmit={handlePasswordChange}>
            <div className="mb-3">
              <label className="form-label small fw-semibold">New Password</label>
              <input type="password" className="form-control" placeholder="New password"
                value={passwordForm.password} onChange={e => setPasswordForm({ ...passwordForm, password: e.target.value })} required />
            </div>
            <div className="mb-4">
              <label className="form-label small fw-semibold">Confirm Password</label>
              <input type="password" className="form-control" placeholder="Repeat password"
                value={passwordForm.confirm} onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })} required />
            </div>
            <ModalFooter onClose={closeModal} label="Update Password" btnClass="btn-warning" />
          </form>
        </ModalWrap>
      )}

      {/* ── Change Quota Modal ── */}
      {modal?.type === "quota" && (
        <ModalWrap title={`Storage Quota — ${modal.email}`} icon="bi-hdd" onClose={closeModal}>
          <form onSubmit={handleQuotaChange}>
            <div className="mb-4">
              <label className="form-label small fw-semibold">
                Quota <span className="text-muted">(current: {modal.current || "Unlimited"})</span>
              </label>
              <select className="form-select" value={quotaForm.quota}
                onChange={e => setQuotaForm({ quota: e.target.value })}>
                {QUOTA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <ModalFooter onClose={closeModal} label="Save Quota" btnClass="btn-secondary" />
          </form>
        </ModalWrap>
      )}
    </>
  );
}

/* ── Storage usage bar ── */
function UsageCell({ used, quotaBytes }: { used: number; quotaBytes: number | null }) {
  const unlimited = quotaBytes == null;
  const pct = unlimited || quotaBytes === 0 ? 0 : Math.min(100, Math.round((used / quotaBytes) * 100));
  const barColor = pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-warning" : "bg-success";
  return (
    <div style={{ maxWidth: 240 }}>
      <div className="d-flex justify-content-between small mb-1">
        <span className="font-monospace">{formatBytes(used)}</span>
        <span className="text-muted font-monospace">
          {unlimited ? "Unlimited" : `${formatBytes(quotaBytes ?? 0)} · ${pct}%`}
        </span>
      </div>
      {unlimited ? (
        <div className="progress" style={{ height: 6 }}>
          <div className="progress-bar bg-secondary" style={{ width: "100%", opacity: 0.25 }} />
        </div>
      ) : (
        <div className="progress" style={{ height: 6 }}>
          <div className={`progress-bar ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

/* ── Shared Modal helpers ── */
function ModalWrap({ title, icon, onClose, children }: {
  title: string; icon: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="modal d-block" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title fw-bold">
              <i className={`${icon} text-primary me-2`}></i>{title}
            </h5>
            <button className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          <div className="modal-body">{children}</div>
        </div>
      </div>
    </div>
  );
}

function ModalFooter({ onClose, label, btnClass = "btn-primary" }: {
  onClose: () => void; label: string; btnClass?: string;
}) {
  return (
    <div className="d-flex justify-content-end gap-2">
      <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
      <button type="submit" className={`btn ${btnClass}`}>{label}</button>
    </div>
  );
}
