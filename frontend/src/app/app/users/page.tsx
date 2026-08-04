"use client";

import { useEffect, useMemo, useState } from "react";
import { api, fetchAll } from "@/lib/api";
import { ErrorState, Spinner } from "@/components/ui";

type Role = { id: number; role_type: string; name: string; is_system: boolean; permission_codes: string[] };
type Perm = { id: number; code: string; name: string; category: string; description: string };

export default function UsersPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([fetchAll<Role>("/roles/"), api<Perm[]>("/rbac/permissions/").catch(() => [])]);
      setRoles(r);
      setPerms(Array.isArray(p) ? p : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load roles");
    } finally {
      setLoading(false);
    }
  }
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

  function startEdit(r: Role) {
    setEditing(r.id);
    setDraft(new Set(r.permission_codes));
  }
  function toggle(code: string) {
    setDraft((d) => {
      const n = new Set(d);
      n.has(code) ? n.delete(code) : n.add(code);
      return n;
    });
  }
  async function saveRole(r: Role) {
    setSaving(true);
    try {
      await api(`/roles/${r.id}/set_permissions/`, { method: "POST", body: { codes: Array.from(draft) } });
      setEditing(null);
      await load();
    } catch (e: any) {
      alert(e?.message || "Could not save permissions");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner label="Loading roles…" />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="vstack gap-3">
      <div className="text-secondary small">Roles &amp; permissions for your shop. Owners have all permissions implicitly.</div>
      {roles.map((r) => (
        <div key={r.id} className="card shadow-sm">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="fw-semibold text-capitalize">
                {r.name || r.role_type} {r.is_system && <span className="badge text-bg-light ms-1">system</span>}
              </div>
              {editing === r.id ? (
                <div className="d-flex gap-2">
                  <button className="btn btn-sm btn-light" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                  <button className="btn btn-sm btn-brand" disabled={saving} onClick={() => saveRole(r)}>
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              ) : (
                <button className="btn btn-sm btn-outline-brand" onClick={() => startEdit(r)}>
                  Edit permissions
                </button>
              )}
            </div>

            {editing === r.id ? (
              <div className="row g-3">
                {Object.entries(byCategory).map(([cat, ps]) => (
                  <div className="col-md-6 col-lg-4" key={cat}>
                    <div className="fw-medium small text-brand text-capitalize mb-1">{cat}</div>
                    {ps.map((p) => (
                      <div className="form-check" key={p.code}>
                        <input className="form-check-input" type="checkbox" id={`${r.id}-${p.code}`} checked={draft.has(p.code)} onChange={() => toggle(p.code)} />
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
  );
}
