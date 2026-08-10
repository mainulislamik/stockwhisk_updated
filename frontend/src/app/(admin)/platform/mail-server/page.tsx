"use client";

import { useState, useEffect } from "react";
import PageWrapper from "@/components/PageWrapper";
import { toast } from "sonner";
import api from "@/lib/api";

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
    quota: "1024M"
  });

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/platform/mail-accounts/");
      setAccounts(data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to load accounts");
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
      await api.post("/platform/mail-accounts/", formData);
      toast.success("Account created successfully");
      setShowAddModal(false);
      setFormData({ email: "", password: "", quota: "1024M" });
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create account");
    }
  };

  const handleDelete = async (email: string) => {
    if (!window.confirm(`Are you sure you want to delete ${email}?`)) return;
    try {
      await api.delete("/platform/mail-accounts/", { data: { email } });
      toast.success("Account deleted");
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to delete account");
    }
  };

  const handleLoginAs = async (email: string) => {
    try {
      const { data } = await api.post("/platform/mail-accounts/sso/", { email });
      // Construct a form and submit it to roundcube in a new window
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "https://mail.stockwhisk.com/?_task=login";
      form.target = "_blank";
      
      const userField = document.createElement("input");
      userField.type = "hidden";
      userField.name = "_user";
      userField.value = data._user;
      
      const passField = document.createElement("input");
      passField.type = "hidden";
      passField.name = "_pass";
      passField.value = data._pass;
      
      const actionField = document.createElement("input");
      actionField.type = "hidden";
      actionField.name = "_action";
      actionField.value = "login";
      
      form.appendChild(userField);
      form.appendChild(passField);
      form.appendChild(actionField);
      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to get SSO token");
    }
  };

  return (
    <PageWrapper title="Mail Server Admin" breadcrumbs={[{ label: "Mail Server" }]}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Email Accounts</h2>
          <p className="text-sm text-gray-400">Manage all mailboxes, quotas, and perform 1-click logins.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary shadow-glow shadow-primary/30"
        >
          <i className="bi-plus-circle me-2"></i> Create Account
        </button>
      </div>

      <div className="card glass-card">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr className="border-bottom border-gray-800">
                  <th className="text-uppercase text-xs font-semibold text-gray-400 py-4 px-4 bg-transparent border-0">Email Account</th>
                  <th className="text-uppercase text-xs font-semibold text-gray-400 py-4 px-4 bg-transparent border-0">Storage Quota</th>
                  <th className="text-end text-uppercase text-xs font-semibold text-gray-400 py-4 px-4 bg-transparent border-0">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-gray-400 border-0">
                      <div className="spinner-border text-primary spinner-border-sm me-2" role="status"></div>
                      Loading accounts...
                    </td>
                  </tr>
                ) : accounts.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-gray-500 border-0">No email accounts found.</td>
                  </tr>
                ) : (
                  accounts.map((acc) => (
                    <tr key={acc.email} className="border-bottom border-gray-800/50 hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 border-0 text-white font-medium">
                        <i className="bi-envelope text-primary me-2"></i> {acc.email}
                      </td>
                      <td className="py-3 px-4 border-0">
                        <span className="badge bg-gray-800 text-gray-300 font-mono">
                          {acc.quota || 'Unlimited'}
                        </span>
                      </td>
                      <td className="text-end py-3 px-4 border-0">
                        <button 
                          onClick={() => handleLoginAs(acc.email)}
                          className="btn btn-sm btn-outline-info me-2 rounded-pill px-3"
                          title="Login securely bypassing password"
                        >
                          <i className="bi-box-arrow-in-right me-1"></i> Login As
                        </button>
                        <button 
                          onClick={() => handleDelete(acc.email)}
                          className="btn btn-sm btn-outline-danger rounded-pill px-3"
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

      {showAddModal && (
        <div className="modal-backdrop-blur fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card glass-card w-full max-w-md shadow-2xl border border-gray-800">
            <div className="card-header border-bottom border-gray-800 flex justify-between items-center py-4 px-5">
              <h5 className="mb-0 text-white font-bold"><i className="bi-envelope-plus me-2 text-primary"></i> Create Email Account</h5>
              <button type="button" className="btn-close btn-close-white opacity-50 hover:opacity-100" onClick={() => setShowAddModal(false)}></button>
            </div>
            <div className="card-body p-5">
              <form onSubmit={handleCreate}>
                <div className="mb-4">
                  <label className="form-label text-sm text-gray-400">Email Address</label>
                  <input 
                    type="email" 
                    className="form-control bg-gray-900/50 border-gray-700 text-white focus:border-primary focus:ring-1 focus:ring-primary" 
                    placeholder="e.g. hello@stockwhisk.com"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="form-label text-sm text-gray-400">Password</label>
                  <input 
                    type="password" 
                    className="form-control bg-gray-900/50 border-gray-700 text-white focus:border-primary focus:ring-1 focus:ring-primary" 
                    placeholder="Strong password"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    required
                  />
                </div>
                <div className="mb-5">
                  <label className="form-label text-sm text-gray-400">Storage Quota</label>
                  <select 
                    className="form-select bg-gray-900/50 border-gray-700 text-white focus:border-primary focus:ring-1 focus:ring-primary"
                    value={formData.quota}
                    onChange={e => setFormData({...formData, quota: e.target.value})}
                  >
                    <option value="512M">512 MB</option>
                    <option value="1024M">1 GB</option>
                    <option value="2048M">2 GB</option>
                    <option value="5120M">5 GB</option>
                    <option value="10240M">10 GB</option>
                    <option value="">Unlimited</option>
                  </select>
                </div>
                <div className="d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-light bg-gray-800 border-0 text-white hover:bg-gray-700 px-4" onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary px-4 shadow-glow shadow-primary/30">Create Account</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
