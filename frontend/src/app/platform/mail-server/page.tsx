"use client";

import { useLanguage } from "@/contexts/LanguageContext";

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
  | { type: "delete"; email: string }
  | null;

export default function MailServerPage() {
  const { lang, t } = useLanguage();
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Modal>(null);

  const [createForm, setCreateForm] = useState({ email: "", password: "", quota: "1G" });
  const [passwordForm, setPasswordForm] = useState({ password: "", confirm: "" });
  const [quotaForm, setQuotaForm] = useState({ quota: "1G" });

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
      setCreateForm({ email: "", password: "", quota: "1G" });
      fetchAccounts();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create account");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modal?.type !== "password") return;
    if (passwordForm.password !== passwordForm.confirm) {
      toast.error(lang === "bn" ? "পাসওয়ার্ড দুটি মিলছে না।" : "Passwords do not match");
      return;
    }
    try {
      await api("/platform/mail-accounts/", {
        method: "PATCH",
        body: { email: modal.email, password: passwordForm.password },
      });
      toast.success(lang === "bn" ? "পাসওয়ার্ড সফলভাবে আপডেট করা হয়েছে।" : "Password updated successfully.");
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

  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (email: string) => {
    setDeleting(true);
    try {
      await api("/platform/mail-accounts/", { method: "DELETE", body: { email } });
      toast.success("Account deleted");
      setModal(null);
      fetchAccounts();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete account");
    } finally {
      setDeleting(false);
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

  const closeModal = () => setModal(null);

  return (
    <>
      {/* Page header */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h2 className="mb-1 fw-bold">{lang === "bn" ? "মেইল সার্ভার প্রশাসন ও অ্যাকাউন্টস" : "Mail Server Admin"}</h2>
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
                <th className="ps-4">setEmail</th>
                <th style={{ minWidth: 220 }}>{lang === "bn" ? "ব্যবহৃত স্টোরেজ / কোটা" : "Storage Used / Quota"}</th>
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
                          onClick={() => { setQuotaForm({ quota: acc.quota || "" }); setModal({ type: "quota", email: acc.email, current: acc.quota }); }}
                        >
                          <i className="bi-hdd"></i>
                        </button>
                        <button
                          className="btn btn-outline-danger"
                          title="Delete account"
                          onClick={() => setModal({ type: "delete", email: acc.email })}
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
        <ModalWrap title="New setEmail" icon="bi-envelope-plus" onClose={closeModal}>
          <form onSubmit={handleCreate}>
            <div className="mb-3">
              <label className="form-label small fw-semibold">setEmail</label>
              <input type="email" className="form-control" placeholder="name@stockwhisk.com"
                value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} required />
            </div>
            <div className="mb-3">
              <label className="form-label small fw-semibold">setPasswordForm</label>
              <input type="password" className="form-control" placeholder="Strong password"
                value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} required />
            </div>
            <div className="mb-4">
              <label className="form-label small fw-semibold">{lang === "bn" ? "স্টোরেজ কোটা (MB)" : "Storage Quota"}</label>
              <QuotaField value={createForm.quota}
                onChange={q => setCreateForm({ ...createForm, quota: q })} />
            </div>
            <ModalFooter onClose={closeModal} label="Create Account" />
          </form>
        </ModalWrap>
      )}

      {/* ── Change setPasswordForm Modal ── */}
      {modal?.type === "password" && (
        <ModalWrap title={lang === "bn" ? `পাসওয়ার্ড পরিবর্তন — ${modal.email}` : `Change Password — ${modal.email}`} icon="bi-key" onClose={closeModal}>
          <form onSubmit={handlePasswordChange}>
            <div className="mb-3">
              <label className="form-label small fw-semibold">{lang === "bn" ? "নতুন পাসওয়ার্ড" : "New Password"}</label>
              <input type="password" className="form-control" placeholder="New password"
                value={passwordForm.password} onChange={e => setPasswordForm({ ...passwordForm, password: e.target.value })} required />
            </div>
            <div className="mb-4">
              <label className="form-label small fw-semibold">{lang === "bn" ? "পাসওয়ার্ড নিশ্চিত করুন" : "Confirm Password"}</label>
              <input type="password" className="form-control" placeholder="Repeat password"
                value={passwordForm.confirm} onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })} required />
            </div>
            <ModalFooter onClose={closeModal} label={lang === "bn" ? "পাসওয়ার্ড আপডেট করুন" : "Update Password"} btnClass="btn-warning" />
          </form>
        </ModalWrap>
      )}

      {/* ── Change Quota Modal ── */}
      {modal?.type === "quota" && (
        <ModalWrap title={lang === "bn" ? `স্টোরেজ কোটা পরিবর্তন — ${modal.email}` : `Storage Quota — ${modal.email}`} icon="bi-hdd" onClose={closeModal}>
          <form onSubmit={handleQuotaChange}>
            <div className="mb-4">
              <label className="form-label small fw-semibold">
                Quota <span className="text-muted">(current: {modal.current || "Unlimited"})</span>
              </label>
              <QuotaField value={quotaForm.quota}
                onChange={q => setQuotaForm({ quota: q })} />
            </div>
            <ModalFooter onClose={closeModal} label="Save Quota" btnClass="btn-secondary" />
          </form>
        </ModalWrap>
      )}

      {/* ── Delete Account Modal ── */}
      {modal?.type === "delete" && (
        <ModalWrap title={lang === "bn" ? "ইমেইল অ্যাকাউন্ট মুছে ফেলুন" : "Delete Email Account"} icon="bi-exclamation-triangle" onClose={closeModal}>
          <div className="text-center mb-4">
            <div className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
              style={{ width: 64, height: 64, background: "rgba(220,53,69,0.15)" }}>
              <i className="bi-trash3 text-danger fs-3"></i>
            </div>
            <p className="mb-1">You are about to permanently delete</p>
            <p className="fw-bold fs-5 mb-3">
              <i className="bi-envelope-fill text-primary me-2"></i>{modal.email}
            </p>
            <div className="alert alert-danger py-2 small mb-0 text-start">
              <i className="bi-exclamation-octagon-fill me-1"></i>
              This removes the mailbox and <strong>all its stored email</strong>. This action
              cannot be undone.
            </div>
          </div>
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={deleting}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={() => handleDelete(modal.email)} disabled={deleting}>
              {deleting
                ? <><span className="spinner-border spinner-border-sm me-2"></span>Deleting…</>
                : <><i className="bi-trash me-1"></i>Delete Permanently</>}
            </button>
          </div>
        </ModalWrap>
      )}
    </>
  );
}

/* ── Custom quota allocator ── */
const QUOTA_PRESETS: { label: string; value: string }[] = [
  { label: "512 MB", value: "512M" },
  { label: "1 GB", value: "1G" },
  { label: "2 GB", value: "2G" },
  { label: "5 GB", value: "5G" },
  { label: "10 GB", value: "10G" },
  { label: "25 GB", value: "25G" },
];

const UNIT_LABEL: Record<string, string> = { M: "MB", G: "GB", T: "TB" };

function parseQuota(v: string): { amount: string; unit: string } {
  const m = /^(\d+(?:\.\d+)?)\s*([MGT])$/i.exec((v || "").trim());
  return m ? { amount: m[1], unit: m[2].toUpperCase() } : { amount: "1", unit: "G" };
}

function QuotaField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const init = parseQuota(value);
  const [unlimited, setUnlimited] = useState(!value);
  const [amount, setAmount] = useState(init.amount);
  const [unit, setUnit] = useState(init.unit);

  useEffect(() => {
    if (unlimited) { onChange(""); return; }
    const n = parseFloat(amount);
    onChange(n > 0 ? `${amount}${unit}` : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlimited, amount, unit]);

  const current = unlimited ? "" : `${amount}${unit}`.toUpperCase();

  return (
    <div>
      <div className="form-check form-switch mb-3">
        <input className="form-check-input" type="checkbox" id="qUnlimited" role="switch"
          checked={unlimited} onChange={e => setUnlimited(e.target.checked)} />
        <label className="form-check-label small fw-semibold" htmlFor="qUnlimited">
          Unlimited storage
        </label>
      </div>

      {!unlimited && (
        <>
          <div className="d-flex flex-wrap gap-2 mb-3">
            {QUOTA_PRESETS.map(p => {
              const active = current === p.value.toUpperCase();
              return (
                <button type="button" key={p.value}
                  className={`btn btn-sm ${active ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => { const q = parseQuota(p.value); setAmount(q.amount); setUnit(q.unit); }}>
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="input-group">
            <span className="input-group-text">Custom</span>
            <input type="number" min={1} step={1} className="form-control"
              value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" />
            <select className="form-select" style={{ maxWidth: 90 }}
              value={unit} onChange={e => setUnit(e.target.value)}>
              <option value="M">MB</option>
              <option value="G">GB</option>
              <option value="T">TB</option>
            </select>
          </div>
          <div className="form-text">
            {parseFloat(amount) > 0
              ? `Mailbox limited to ${amount} ${UNIT_LABEL[unit]}.`
              : "Enter an amount above 0."}
          </div>
        </>
      )}
    </div>
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
