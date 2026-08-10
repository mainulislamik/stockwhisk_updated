"use client";

import { useState, useEffect } from "react";
import PageWrapper from "@/components/PageWrapper";
import toast from "react-hot-toast";
import { api, ApiError } from "@/lib/api";

type MailAccount = {
  email: string;
  quota: string | null;
};

export default function MailServerPage() {
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    quota: "1024M",
  });

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const data = await api<MailAccount[]>("/platform/mail-accounts/");
      setAccounts(data ?? []);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to load accounts";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("/platform/mail-accounts/", { method: "POST", body: formData });
      toast.success("Account created successfully");
      setShowAddModal(false);
      setFormData({ email: "", password: "", quota: "1024M" });
      fetchAccounts();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to create account";
      toast.error(msg);
    }
  };

  const handleDelete = async (email: string) => {
    if (!window.confirm(`Are you sure you want to delete ${email}?`)) return;
    try {
      await api("/platform/mail-accounts/", { method: "DELETE", body: { email } });
      toast.success("Account deleted");
      fetchAccounts();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to delete account";
      toast.error(msg);
    }
  };

  const handleLoginAs = async (email: string) => {
    try {
      const data = await api<{ _user: string; _pass: string; _action: string }>(
        "/platform/mail-accounts/sso/",
        { method: "POST", body: { email } }
      );

      // Build a hidden form and POST to Roundcube in a new tab
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "https://mail.stockwhisk.com/?_task=login";
      form.target = "_blank";

      const fields: Record<string, string> = {
        _user: data._user,
        _pass: data._pass,
        _action: data._action,
      };
      Object.entries(fields).forEach(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to get SSO token";
      toast.error(msg);
    }
  };

  return (
    <PageWrapper title="Mail Server Admin" breadcrumbs={[{ label: "Mail Server" }]}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="fw-bold text-white mb-1">Email Accounts</h4>
          <p className="text-muted small mb-0">Manage mailboxes, quotas, and 1-click logins.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
          <i className="bi-plus-circle me-2"></i>Create Account
        </button>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th className="ps-4 py-3 text-uppercase small fw-semibold text-muted">Email Account</th>
                  <th className="py-3 text-uppercase small fw-semibold text-muted">Storage Quota</th>
                  <th className="pe-4 py-3 text-uppercase small fw-semibold text-muted text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="text-center py-5 text-muted">
                      <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                      Loading accounts...
                    </td>
                  </tr>
                ) : accounts.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-5 text-muted">
                      <i className="bi-inbox fs-4 d-block mb-2"></i>
                      No email accounts found. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  accounts.map((acc) => (
                    <tr key={acc.email}>
                      <td className="ps-4 py-3">
                        <span className="fw-medium text-white">
                          <i className="bi-envelope text-primary me-2"></i>
                          {acc.email}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="badge bg-secondary font-monospace">
                          {acc.quota || "Unlimited"}
                        </span>
                      </td>
                      <td className="pe-4 py-3 text-end">
                        <button
                          onClick={() => handleLoginAs(acc.email)}
                          className="btn btn-sm btn-outline-info me-2"
                          title="Log into this mailbox directly"
                        >
                          <i className="bi-box-arrow-in-right me-1"></i>Login As
                        </button>
                        <button
                          onClick={() => handleDelete(acc.email)}
                          className="btn btn-sm btn-outline-danger"
                          title="Delete account"
                        >
                          <i className="bi-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Account Modal */}
      {showAddModal && (
        <div
          className="modal d-block"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header border-secondary">
                <h5 className="modal-title fw-bold">
                  <i className="bi-envelope-plus text-primary me-2"></i>Create Email Account
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowAddModal(false)}
                ></button>
              </div>
              <form onSubmit={handleCreate}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small text-muted">Email Address</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="e.g. hello@stockwhisk.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small text-muted">Password</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Strong password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-1">
                    <label className="form-label small text-muted">Storage Quota</label>
                    <select
                      className="form-select"
                      value={formData.quota}
                      onChange={(e) => setFormData({ ...formData, quota: e.target.value })}
                    >
                      <option value="512M">512 MB</option>
                      <option value="1024M">1 GB</option>
                      <option value="2048M">2 GB</option>
                      <option value="5120M">5 GB</option>
                      <option value="10240M">10 GB</option>
                      <option value="">Unlimited</option>
                    </select>
                  </div>
                </div>
                <div className="modal-footer border-secondary">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Create Account
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
