"use client";

import { confirmAction, showError, showSuccess, showInfo } from "@/lib/dialogs";
import { useEffect, useMemo, useState } from "react";
import { api, fetchAll } from "@/lib/api";
import { ErrorState, Spinner } from "@/components/ui";
import toast from "react-hot-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/components/AuthProvider";

type Role = { id: number; role_type: string; name: string; is_system: boolean; permission_codes: string[] };
type Perm = { id: number; code: string; name: string; category: string; description: string };
type Branch = { id: number; name: string; is_main?: boolean };

type ShopUser = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
  branch: number | null;
  branch_name?: string | null;
  is_active: boolean;
  temporary_password?: string;
};

export default function UsersPage() {
  const { t, lang } = useLanguage();
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState<"users" | "roles">("users");

  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [users, setUsers] = useState<ShopUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingRole, setEditingRole] = useState<number | null>(null);
  const [draftPerms, setDraftPerms] = useState<Set<string>>(new Set());
  const [savingRole, setSavingRole] = useState(false);

  // Add User State
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    first_name: "",
    last_name: "",
    phone: "",
    role: "cashier",
    branch: "",
    password: "",
  });
  const [addingUser, setAddingUser] = useState(false);
  const [tempPassword, setTempPassword] = useState("");
  const [tempPasswordUser, setTempPasswordUser] = useState("");

  // Edit User State
  const [editingUser, setEditingUser] = useState<ShopUser | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    role: "cashier",
    branch: "",
  });
  const [savingUser, setSavingUser] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [r, p, u, b] = await Promise.all([
        fetchAll<Role>("/roles/"),
        api<Perm[]>("/rbac/permissions/").catch(() => []),
        fetchAll<ShopUser>("/users/").catch(() => []),
        fetchAll<Branch>("/branches/").catch(() => []),
      ]);
      setRoles(r);
      setPerms(Array.isArray(p) ? p : []);
      setUsers(Array.isArray(u) ? u : []);
      setBranches(Array.isArray(b) ? b : []);
    } catch (e: any) {
      setError(e?.message || t("usr_err_load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Filter out Owner role for staff assignment (only 1 owner per shop)
  const staffRoles = useMemo(() => {
    return roles.filter((r) => r.role_type !== "owner");
  }, [roles]);

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
      toast.success(lang === "bn" ? "পারমিশন সফলভাবে সেভ হয়েছে।" : "Permissions saved successfully.");
    } catch (e: any) {
      toast.error(e?.message || t("usr_err_save_perm"));
    } finally {
      setSavingRole(false);
    }
  };

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingUser(true);
    setTempPassword("");
    setTempPasswordUser("");
    try {
      const payload: any = {
        email: newUser.email.trim(),
        first_name: newUser.first_name.trim(),
        last_name: newUser.last_name.trim(),
        phone: newUser.phone.trim(),
        role: newUser.role || "cashier",
        branch: newUser.branch ? Number(newUser.branch) : null,
      };
      if (newUser.password.trim()) {
        payload.password = newUser.password.trim();
      }
      const res = await api<ShopUser>("/users/", { method: "POST", body: payload });
      setShowAddUser(false);
      setNewUser({ email: "", first_name: "", last_name: "", phone: "", role: "cashier", branch: "", password: "" });
      await load();

      if (res.temporary_password) {
        setTempPassword(res.temporary_password);
        setTempPasswordUser(res.email);
      } else {
        toast.success(lang === "bn" ? "ইউজার সফলভাবে তৈরি হয়েছে।" : "User created successfully.");
      }
    } catch (e: any) {
      const msg = e?.data?.detail || e?.data?.[0] || e?.message || t("usr_err_add");
      await showError(t("usr_req_fail"), msg);
    } finally {
      setAddingUser(false);
    }
  };

  const startEditUser = (u: ShopUser) => {
    setEditingUser(u);
    setEditForm({
      first_name: u.first_name || "",
      last_name: u.last_name || "",
      phone: u.phone || "",
      role: u.role || "cashier",
      branch: u.branch ? String(u.branch) : "",
    });
  };

  const saveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingUser(true);
    try {
      const payload: any = {
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        phone: editForm.phone.trim(),
        branch: editForm.branch ? Number(editForm.branch) : null,
      };
      if (editingUser.role !== "owner") {
        payload.role = editForm.role;
      }
      await api(`/users/${editingUser.id}/`, { method: "PATCH", body: payload });
      setEditingUser(null);
      await load();
      toast.success(lang === "bn" ? "ইউজার তথ্য আপডেট হয়েছে।" : "User profile updated.");
    } catch (e: any) {
      const msg = e?.data?.detail || e?.data?.[0] || e?.message || "Failed to update user.";
      toast.error(msg);
    } finally {
      setSavingUser(false);
    }
  };

  const resetStaffPassword = async (u: ShopUser) => {
    if (!(await confirmAction(lang === "bn" ? `${u.email}-এর জন্য নতুন পাসওয়ার্ড জেনারেট করবেন?` : `Reset password for ${u.email}?`))) return;
    try {
      const res = await api<{ status: string; temporary_password: string }>(`/users/${u.id}/reset_password/`, { method: "POST" });
      if (res.temporary_password) {
        setTempPassword(res.temporary_password);
        setTempPasswordUser(u.email);
      }
      toast.success(lang === "bn" ? "পাসওয়ার্ড সফলভাবে রিসেট হয়েছে।" : "Password reset successfully.");
    } catch (e: any) {
      toast.error(e?.data?.detail || e?.message || "Failed to reset password.");
    }
  };

  const toggleUserActive = async (u: ShopUser) => {
    if (u.role === "owner" || u.id === currentUser?.id) {
      toast.error(lang === "bn" ? "ওনার অ্যাকাউন্ট নিষ্ক্রিয় করা যাবে না।" : "Owner account cannot be deactivated.");
      return;
    }
    if (!(await confirmAction(t("usr_conf_deact", { action: u.is_active ? t("usr_deact") : t("usr_act"), email: u.email })))) return;
    try {
      await api(`/users/${u.id}/`, { method: "PATCH", body: { is_active: !u.is_active } });
      await load();
    } catch (e: any) {
      toast.error(e?.data?.detail || e?.message || t("usr_err_status"));
    }
  };

  const deleteUser = async (u: ShopUser) => {
    if (u.role === "owner" || u.id === currentUser?.id) {
      toast.error(lang === "bn" ? "ওনার অ্যাকাউন্ট মুছে ফেলা যাবে না।" : "Owner account cannot be deleted.");
      return;
    }
    if (!(await confirmAction(t("usr_conf_del", { email: u.email })))) return;
    try {
      await api(`/users/${u.id}/`, { method: "DELETE" });
      toast.success(t("usr_del_ok", { email: u.email }));
      await load();
    } catch (e: any) {
      toast.error(e?.data?.detail || e?.message || t("usr_err_del"));
    }
  };

  if (loading) return <Spinner label={t("usr_loading")} />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="vstack gap-3">
      <ul className="nav nav-pills gap-2 mb-3">
        <li className="nav-item">
          <button className={`nav-link ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}>
            {t("usr_tab_staff")}
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${tab === "roles" ? "active" : ""}`} onClick={() => setTab("roles")}>
            {t("usr_tab_roles")}
          </button>
        </li>
      </ul>

      {tab === "users" && (
        <div className="vstack gap-3">
          <div className="d-flex justify-content-between align-items-center">
            <div className="text-secondary small">{t("usr_desc_staff")}</div>
            <button className="btn btn-brand btn-sm" onClick={() => { setShowAddUser(true); setEditingUser(null); }}>
              <i className="bi bi-person-plus me-1"></i> {t("usr_btn_add")}
            </button>
          </div>

          {tempPassword && (
            <div className="alert alert-success d-flex justify-content-between align-items-center shadow-sm">
              <div>
                <strong>
                  {lang === "bn" ? `ইউজার (${tempPasswordUser})-এর পাসওয়ার্ড প্রস্তুত:` : `Password ready for (${tempPasswordUser}):`}
                </strong>
                <br />
                {t("usr_pwd_msg")}{" "}
                <code className="fs-5 bg-white px-3 py-1 rounded ms-2 text-dark fw-bold border">
                  {tempPassword}
                </code>
                <br />
                <small className="text-muted">{t("usr_pwd_note")}</small>
              </div>
              <button className="btn btn-sm btn-outline-success" onClick={() => { setTempPassword(""); setTempPasswordUser(""); }}>
                {t("usr_btn_dimiss")}
              </button>
            </div>
          )}

          {/* Add User Form Modal / Card */}
          {showAddUser && (
            <div className="card shadow-sm border-brand">
              <div className="card-header bg-brand text-white fw-medium d-flex justify-content-between align-items-center">
                <span>{t("usr_add_title")}</span>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowAddUser(false)}></button>
              </div>
              <div className="card-body">
                <form onSubmit={addUser} className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-medium">{t("usr_lbl_email")} <span className="text-danger">*</span></label>
                    <input type="email" required className="form-control form-control-sm" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-medium">{t("usr_lbl_role")} <span className="text-danger">*</span></label>
                    <select className="form-select form-select-sm" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                      {staffRoles.map((r) => (
                        <option key={r.id} value={r.role_type}>
                          {r.name || r.role_type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-medium">{t("usr_lbl_fname")} <span className="text-danger">*</span></label>
                    <input type="text" required className="form-control form-control-sm" value={newUser.first_name} onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-medium">{t("usr_lbl_lname")}</label>
                    <input type="text" className="form-control form-control-sm" value={newUser.last_name} onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-medium">{t("usr_lbl_phone")}</label>
                    <input type="text" className="form-control form-control-sm" value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} />
                  </div>
                  {branches.length > 0 && (
                    <div className="col-md-6">
                      <label className="form-label small fw-medium">{lang === "bn" ? "শাখা" : "Branch"}</label>
                      <select className="form-select form-select-sm" value={newUser.branch} onChange={(e) => setNewUser({ ...newUser, branch: e.target.value })}>
                        <option value="">{lang === "bn" ? "সকল শাখা / প্রধান কার্যালয়" : "All Branches / Main"}</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="col-md-6">
                    <label className="form-label small fw-medium">{t("usr_lbl_temp_pwd")}</label>
                    <input type="text" className="form-control form-control-sm" placeholder={t("usr_ph_pwd")} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
                  </div>
                  <div className="col-12 d-flex gap-2 mt-4">
                    <button type="submit" className="btn btn-brand btn-sm" disabled={addingUser}>
                      {addingUser ? t("usr_btn_creating") : t("usr_btn_create")}
                    </button>
                    <button type="button" className="btn btn-light btn-sm" onClick={() => setShowAddUser(false)}>
                      {t("usr_btn_cancel")}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit User Form Card */}
          {editingUser && (
            <div className="card shadow-sm border-primary">
              <div className="card-header bg-primary text-white fw-medium d-flex justify-content-between align-items-center">
                <span>{lang === "bn" ? `ইউজার এডিট করুন: ${editingUser.email}` : `Edit User: ${editingUser.email}`}</span>
                <button type="button" className="btn-close btn-close-white" onClick={() => setEditingUser(null)}></button>
              </div>
              <div className="card-body">
                <form onSubmit={saveEditUser} className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-medium">{t("usr_lbl_fname")} <span className="text-danger">*</span></label>
                    <input type="text" required className="form-control form-control-sm" value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-medium">{t("usr_lbl_lname")}</label>
                    <input type="text" className="form-control form-control-sm" value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-medium">{t("usr_lbl_phone")}</label>
                    <input type="text" className="form-control form-control-sm" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                  </div>
                  {editingUser.role !== "owner" && (
                    <div className="col-md-6">
                      <label className="form-label small fw-medium">{t("usr_lbl_role")}</label>
                      <select className="form-select form-select-sm" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                        {staffRoles.map((r) => (
                          <option key={r.id} value={r.role_type}>
                            {r.name || r.role_type}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {branches.length > 0 && (
                    <div className="col-md-6">
                      <label className="form-label small fw-medium">{lang === "bn" ? "শাখা" : "Branch"}</label>
                      <select className="form-select form-select-sm" value={editForm.branch} onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })}>
                        <option value="">{lang === "bn" ? "সকল শাখা / প্রধান কার্যালয়" : "All Branches / Main"}</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="col-12 d-flex gap-2 mt-4">
                    <button type="submit" className="btn btn-primary btn-sm" disabled={savingUser}>
                      {savingUser ? (lang === "bn" ? "সেভ হচ্ছে..." : "Saving...") : (lang === "bn" ? "আপডেট করুন" : "Save Changes")}
                    </button>
                    <button type="button" className="btn btn-light btn-sm" onClick={() => setEditingUser(null)}>
                      {t("usr_btn_cancel")}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="card shadow-sm table-responsive">
            <table className="table table-sm table-hover mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th>{t("usr_col_name")}</th>
                  <th>{t("usr_col_email")}</th>
                  <th>{t("usr_col_role")}</th>
                  {branches.length > 0 && <th>{lang === "bn" ? "শাখা" : "Branch"}</th>}
                  <th>{t("usr_col_status")}</th>
                  <th className="text-end">{t("usr_col_actions")}</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={branches.length > 0 ? 6 : 5} className="text-center text-secondary py-3">
                      {t("usr_no_staff")}
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const isOwner = u.role === "owner";
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <tr key={u.id} className={u.is_active ? "" : "text-muted opacity-75"}>
                        <td className="fw-medium">
                          {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                          {isSelf && <span className="badge bg-secondary-subtle text-secondary ms-1">{lang === "bn" ? "আপনি" : "You"}</span>}
                        </td>
                        <td>{u.email}</td>
                        <td>
                          {isOwner ? (
                            <span className="badge bg-purple-subtle text-purple border" style={{ backgroundColor: "#f3e8ff", color: "#6b21a8" }}>
                              👑 Owner
                            </span>
                          ) : (
                            <span className="text-capitalize badge bg-light text-dark border">{u.role}</span>
                          )}
                        </td>
                        {branches.length > 0 && (
                          <td className="small text-secondary">
                            {u.branch_name || (lang === "bn" ? "সকল শাখা" : "All Branches")}
                          </td>
                        )}
                        <td>
                          {u.is_active ? (
                            <span className="badge text-bg-success">{t("usr_stat_active")}</span>
                          ) : (
                            <span className="badge text-bg-secondary">{t("usr_stat_inactive")}</span>
                          )}
                        </td>
                        <td className="text-end">
                          <button
                            className="btn btn-sm btn-link text-decoration-none me-1"
                            onClick={() => startEditUser(u)}
                          >
                            <i className="bi bi-pencil-square me-1"></i>
                            {lang === "bn" ? "এডিট" : "Edit"}
                          </button>

                          {!isOwner && (
                            <button
                              className="btn btn-sm btn-link text-decoration-none me-1 text-warning-emphasis"
                              onClick={() => resetStaffPassword(u)}
                            >
                              <i className="bi bi-key me-1"></i>
                              {lang === "bn" ? "পাসওয়ার্ড রিসেট" : "Reset Pwd"}
                            </button>
                          )}

                          {!isOwner && !isSelf && (
                            <>
                              <button
                                className="btn btn-sm btn-link text-decoration-none"
                                onClick={() => toggleUserActive(u)}
                              >
                                {u.is_active ? t("usr_btn_deactivate") : t("usr_btn_activate")}
                              </button>
                              <button
                                className="btn btn-sm btn-link text-danger text-decoration-none"
                                onClick={() => deleteUser(u)}
                              >
                                <i className="bi bi-trash3 me-1"></i>
                                {t("usr_btn_del")}
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "roles" && (
        <div className="vstack gap-3">
          <div className="text-secondary small">{t("usr_desc_roles")}</div>
          {roles.map((r) => (
            <div key={r.id} className="card shadow-sm">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="fw-semibold text-capitalize">
                    {r.name || r.role_type} {r.is_system && <span className="badge text-bg-light ms-1">{t("usr_sys")}</span>}
                  </div>
                  {editingRole === r.id ? (
                    <div className="d-flex gap-2">
                      <button className="btn btn-sm btn-light" onClick={() => setEditingRole(null)}>
                        {t("usr_btn_cancel")}
                      </button>
                      <button className="btn btn-sm btn-brand" disabled={savingRole} onClick={() => saveRole(r)}>
                        {savingRole ? t("usr_btn_saving") : t("usr_btn_save")}
                      </button>
                    </div>
                  ) : (
                    <button className="btn btn-sm btn-outline-brand" onClick={() => startEditRole(r)}>
                      {t("usr_btn_edit_perm")}
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
                      <span className="text-secondary small">{t("usr_no_perm")}</span>
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
