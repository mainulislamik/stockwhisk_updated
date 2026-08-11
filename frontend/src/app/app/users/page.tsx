"use client";

import { confirmAction, showError, showSuccess, showInfo } from "@/lib/dialogs";

import { useEffect, useMemo, useState } from "react";
import { api, fetchAll } from "@/lib/api";
import { ErrorState, Spinner } from "@/components/ui";
import toast from "react-hot-toast";

type Role = { id: number; role_type: string; name: string; is_system: boolean; permission_codes: string[] };
type Perm = { id: number; code: string; name: string; category: string; description: string };

type ShopUser = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
  is_active: boolean;
  temporary_password?: string;
};

export default function UsersPage() {
  const [tab, setTab] = useState<"users" | "roles">("users");

  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [users, setUsers] = useState<ShopUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingRole, setEditingRole] = useState<number | null>(null);
  const [draftPerms, setDraftPerms] = useState<Set<string>>(new Set());
  const [savingRole, setSavingRole] = useState(false);

  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", first_name: "", last_name: "", phone: "", role: "cashier", password: "" });
  const [addingUser, setAddingUser] = useState(false);
  const [tempPassword, setTempPassword] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [r, p, u] = await Promise.all([
        fetchAll<Role>("/roles/"), 
        api<Perm[]>("/rbac/permissions/").catch(() => []),
        fetchAll<ShopUser>("/users/").catch(() => [])
      ]);
      setRoles(r);
      setPerms(Array.isArray(p) ? p : []);
      setUsers(Array.isArray(u) ? u : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const byCategory = useMemo(() => {
    const m: Record<string, Perm[]> = {};
    perms.forEach((p) => {
      (m[p.category] = m[p.category] || []).push(p);
    });
    return m;
  }, [perms]);

  const startEditRole = (r: Role) => {
    setEditingRole(r.id);
    setDraftPerms(new Set(r.permission_codes));
  };

  const togglePerm = (code: string) => {
    setDraftPerms((d) => {
      const n = new Set(d);
      n.has(code) ? n.delete(code) : n.add(code);
      return n;
    });
  };

  const saveRole = async (r: Role) => {
    setSavingRole(true);
    try {
      await api(`/roles/${r.id}/set_permissions/`, { method: "POST", body: { codes: Array.from(draftPerms) } });
      setEditingRole(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Could not save permissions");
    } finally {
      setSavingRole(false);
    }
  };

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingUser(true);
    setTempPassword("");
    try {
      const res = await api<ShopUser>("/users/", { method: "POST", body: newUser });
      if (res.temporary_password) {
        setTempPassword(res.temporary_password);
      }
      setShowAddUser(false);
      setNewUser({ email: "", first_name: "", last_name: "", phone: "", role: "cashier", password: "" });
      await load();
      if (res.temporary_password) {
        setShowAddUser(true); // Keep modal open just to show password
      }
    } catch (e: any) {
      await showError("Request failed", e?.message || "Failed to create user");
    } finally {
      setAddingUser(false);
    }
  };

  const toggleUserActive = async (u: ShopUser) => {
    if (!(await confirmAction(`Are you sure you want to ${u.is_active ? "deactivate" : "activate"} ${u.email}?`))) return;
    try {
      await api(`/users/${u.id}/`, { method: "PATCH", body: { is_active: !u.is_active } });
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update user status");
    }
  };

  const deleteUser = async (u: ShopUser) => {
    if (!(await confirmAction(`Permanently delete ${u.email}? This removes their access and cannot be undone.`))) return;
    try {
      await api(`/users/${u.id}/`, { method: "DELETE" });
      toast.success(`${u.email} deleted.`);
      await load();
    } catch (e: any) {
      toast.error(e?.data?.detail || e?.message || "Failed to delete user");
    }
  };

  if (loading) return <Spinner label="Loading Users & Roles…" />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="vstack gap-3">
      <ul className="nav nav-pills gap-2 mb-3">
        <li className="nav-item">
          <button className={`nav-link ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}>
            Staff Users
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${tab === "roles" ? "active" : ""}`} onClick={() => setTab("roles")}>
            Roles & Permissions
          </button>
        </li>
      </ul>

      {tab === "users" && (
        <div className="vstack gap-3">
          <div className="d-flex justify-content-between align-items-center">
            <div className="text-secondary small">Manage staff access to your shop.</div>
            <button className="btn btn-brand btn-sm" onClick={() => { setShowAddUser(true); setTempPassword(""); }}>
              <i className="bi bi-person-plus me-1"></i> Add User
            </button>
          </div>

          {tempPassword && (
            <div className="alert alert-success d-flex justify-content-between align-items-center">
              <div>
                <strong>User created successfully!</strong><br />
                Their temporary password is: <code className="fs-5 bg-white px-2 py-1 rounded ms-2 text-dark">{tempPassword}</code><br/>
                <small>Please copy this password and share it with the user. It will not be shown again.</small>
              </div>
              <button className="btn btn-sm btn-outline-success" onClick={() => setTempPassword("")}>Dismiss</button>
            </div>
          )}

          {showAddUser && !tempPassword && (
            <div className="card shadow-sm border-brand">
              <div className="card-header bg-brand text-white fw-medium">Create New User</div>
              <div className="card-body">
                <form onSubmit={addUser} className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-medium">Email</label>
                    <input type="email" required className="form-control form-control-sm" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-medium">Role</label>
                    <select className="form-select form-select-sm" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                      {roles.map(r => <option key={r.id} value={r.role_type}>{r.name || r.role_type}</option>)}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-medium">First Name</label>
                    <input type="text" required className="form-control form-control-sm" value={newUser.first_name} onChange={e => setNewUser({...newUser, first_name: e.target.value})} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-medium">Last Name</label>
                    <input type="text" className="form-control form-control-sm" value={newUser.last_name} onChange={e => setNewUser({...newUser, last_name: e.target.value})} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-medium">Phone</label>
                    <input type="text" className="form-control form-control-sm" value={newUser.phone} onChange={e => setNewUser({...newUser, phone: e.target.value})} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-medium">Temporary Password (Optional)</label>
                    <input type="text" className="form-control form-control-sm" placeholder="Leave blank to auto-generate" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                  </div>
                  <div className="col-12 d-flex gap-2 mt-4">
                    <button type="submit" className="btn btn-brand btn-sm" disabled={addingUser}>{addingUser ? "Creating..." : "Create User"}</button>
                    <button type="button" className="btn btn-light btn-sm" onClick={() => setShowAddUser(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="card shadow-sm table-responsive">
            <table className="table table-sm table-hover mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-secondary py-3">No staff users found.</td>
                  </tr>
                ) : users.map(u => (
                  <tr key={u.id} className={u.is_active ? "" : "text-muted"}>
                    <td className="fw-medium">{[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}</td>
                    <td>{u.email}</td>
                    <td className="text-capitalize">{u.role}</td>
                    <td>
                      {u.is_active ? <span className="badge text-bg-success">Active</span> : <span className="badge text-bg-secondary">Inactive</span>}
                    </td>
                    <td className="text-end">
                      <button className="btn btn-sm btn-link text-decoration-none" onClick={() => toggleUserActive(u)}>
                        {u.is_active ? "Deactivate" : "Activate"}
                      </button>
                      {u.role !== "owner" && (
                        <button className="btn btn-sm btn-link text-danger text-decoration-none" onClick={() => deleteUser(u)}>
                          <i className="bi bi-trash3 me-1"></i>Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "roles" && (
        <div className="vstack gap-3">
          <div className="text-secondary small">Roles &amp; permissions for your shop. Owners have all permissions implicitly.</div>
          {roles.map((r) => (
            <div key={r.id} className="card shadow-sm">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="fw-semibold text-capitalize">
                    {r.name || r.role_type} {r.is_system && <span className="badge text-bg-light ms-1">system</span>}
                  </div>
                  {editingRole === r.id ? (
                    <div className="d-flex gap-2">
                      <button className="btn btn-sm btn-light" onClick={() => setEditingRole(null)}>
                        Cancel
                      </button>
                      <button className="btn btn-sm btn-brand" disabled={savingRole} onClick={() => saveRole(r)}>
                        {savingRole ? "Saving…" : "Save"}
                      </button>
                    </div>
                  ) : (
                    <button className="btn btn-sm btn-outline-brand" onClick={() => startEditRole(r)}>
                      Edit permissions
                    </button>
                  )}
                </div>

                {editingRole === r.id ? (
                  <div className="row g-3">
                    {Object.entries(byCategory).map(([cat, ps]) => (
                      <div className="col-md-6 col-lg-4" key={cat}>
                        <div className="fw-medium small text-brand text-capitalize mb-1">{cat}</div>
                        {ps.map((p) => (
                          <div className="form-check" key={p.code}>
                            <input className="form-check-input" type="checkbox" id={`${r.id}-${p.code}`} checked={draftPerms.has(p.code)} onChange={() => togglePerm(p.code)} />
                            <label className="form-check-label small" htmlFor={`${r.id}-${p.code}`} title={p.description}>
                              {p.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="d-flex flex-wrap gap-1">
                    {r.permission_codes.length === 0 ? (
                      <span className="text-secondary small">No permissions.</span>
                    ) : (
                      r.permission_codes.map((c) => (
                        <span key={c} className="badge text-bg-light">
                          {c}
                        </span>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
