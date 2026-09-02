"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, fetchAll } from "@/lib/api";
import { startImpersonation } from "@/lib/impersonation";
import { EmptyRow, ErrorState, PageHeader, Spinner, fmtDate } from "@/components/ui";
import toast from "react-hot-toast";

type Shop = {
  id: number;
  shop_code?: string;
  name: string;
  business_type: string;
  plan_tier: string | null;
  is_active: boolean;
  is_free?: boolean;
  user_count: number;
  owner_email: string | null;
  can_delete: boolean;
  days_suspended: number;
  created_at: string;
  subscription_info?: {
    state: "trial" | "paid" | "expired" | "none" | "free";
    plan_tier: string | null;
    ends_at: string | null;
    days_left: number;
    status: string | null;
  };
};

const TYPE_LABELS: Record<string, string> = {
  general: "General Retail",
  supershop: "Super Shop & Grocery",
  camical: "Chemical & Lab Supplies",
  electronics: "Electronics & Gadgets",
  computer: "Computer & IT",
  mobile: "Mobile & Accessories",
  handcrafts: "Handcrafts & Boutique",
  other: "Other"
};

const COOLOFF_DAYS = 15;

export default function ShopsPage() {
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [pwFor, setPwFor] = useState<Shop | null>(null);
  const [delFor, setDelFor] = useState<Shop | null>(null);
  const [editCatFor, setEditCatFor] = useState<Shop | null>(null);

  
  const updateCategory = async (shop_id: number, new_type: string) => {
    setBusy(shop_id);
    setEditCatFor(null);
    try {
      await api(`/platform/shops/${shop_id}/`, { method: "PATCH", body: { business_type: new_type } });
      toast.success("Shop category updated!");
      await load();
    } catch(err: any) {
      toast.error(err?.message || "Failed to update category.");
    } finally {
      setBusy(null);
    }
  };

  const load = useCallback(async () => {
    try {
      const data = await fetchAll<Shop>("/platform/shops/");
      setShops(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load shops.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!shops) return [];
    const s = q.trim().toLowerCase();
    if (!s) return shops;
    return shops.filter((x) => {
      const code = (x.shop_code || `SW-${1000 + x.id}`).toLowerCase();
      const idStr = String(x.id);
      return x.name.toLowerCase().includes(s) || code.includes(s) || idStr.includes(s);
    });
  }, [shops, q]);

  const loginAs = useCallback(async (shop: Shop) => {
    try {
      const t = await api<{ access: string; refresh: string; shop_name: string }>(
        `/platform/shops/${shop.id}/login-as/`, { method: "POST" });
      startImpersonation(t);
    } catch (e: any) {
      toast.error(e?.message || "Could not log in as this shop.");
    }
  }, []);

  const toggle = useCallback(async (shop: Shop) => {
    setBusy(shop.id);
    try {
      await api(`/platform/shops/${shop.id}/${shop.is_active ? "suspend" : "activate"}/`, { method: "POST" });
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Action failed.");
    } finally {
      setBusy(null);
    }
  }, [load]);

  if (error) return <ErrorState error={error} />;
  if (!shops) return <Spinner />;

  return (
    <>
      <PageHeader
        title="All Shops"
        actions={<Link href="/platform/shops/new" className="btn btn-brand btn-sm">+ Create shop</Link>}
      />

      <input
        className="form-control mb-3 shadow-sm"
        placeholder="Filter shops by name or unique ID (e.g. SW-1001 or Fast Electronics)…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="thead-1">
              <tr>
                <th>Unique ID</th><th>Shop</th><th>Type</th><th>Plan</th><th>Users</th>
                <th>Status</th><th>Created</th><th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <EmptyRow cols={8} text="No shops match your filter." />}
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="badge rounded-pill bg-primary bg-opacity-25 text-primary border border-primary border-opacity-25 font-monospace px-2 py-1">
                      {s.shop_code || `SW-${1000 + s.id}`}
                    </span>
                  </td>
                  <td className="fw-semibold">
                    <Link href={`/platform/shops/${s.id}`} className="text-decoration-none text-body hover-underline">
                      {s.name}
                    </Link>
                  </td>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <span>{TYPE_LABELS[s.business_type] || s.business_type}</span>
                      <button onClick={() => setEditCatFor(s)} className="btn btn-sm btn-link p-0 text-secondary" disabled={busy === s.id}>
                        <i className="bi bi-pencil-square"></i>
                      </button>
                    </div>
                  </td>
                  <td>
                    {s.subscription_info ? (
                      <div className="d-flex flex-column gap-1">
                        <div className="d-flex align-items-center gap-2">
                          <span className="fw-semibold text-capitalize text-body">
                            {s.subscription_info.plan_tier || "—"}
                          </span>
                          {s.subscription_info.state === "free" && (
                            <span className="badge bg-success" style={{ fontSize: '0.7rem' }}>🎁 Free</span>
                          )}
                          {s.is_free && s.subscription_info.state !== "free" && (
                            <span className="badge bg-secondary" style={{ fontSize: '0.7rem' }} title="Free grant is paused because the reseller is inactive — shop must pay">🎁 Free (paused)</span>
                          )}
                          {s.subscription_info.state === "trial" && (
                            <span className="badge bg-warning text-dark" style={{ fontSize: '0.7rem' }}>Trial</span>
                          )}
                          {s.subscription_info.state === "expired" && (
                            <span className="badge bg-danger" style={{ fontSize: '0.7rem' }}>Expired</span>
                          )}
                        </div>
                        {s.subscription_info.ends_at && (
                          <div className="d-flex align-items-center gap-1" style={{ fontSize: '0.8rem' }}>
                            <span className={s.subscription_info.days_left < 7 ? "text-danger fw-medium" : "text-secondary"}>
                              {s.subscription_info.days_left} days left
                            </span>
                            <span className="text-secondary opacity-50">•</span>
                            <span className="text-secondary opacity-75">
                              {fmtDate(s.subscription_info.ends_at)}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span>{s.plan_tier || "—"}</span>
                    )}
                  </td>
                  <td>{s.user_count}</td>
                  <td>
                    {s.is_active
                      ? <span className="text-success">Active</span>
                      : <span className="text-danger">Suspended{s.days_suspended ? ` · ${s.days_suspended}d` : ""}</span>}
                  </td>
                  <td className="text-nowrap">{fmtDate(s.created_at)}</td>
                  <td>
                    <div className="d-flex flex-wrap gap-1 justify-content-end">
                      <button className="btn btn-brand btn-sm py-0" onClick={() => loginAs(s)}>Login as</button>
                      <button className="btn btn-outline-secondary btn-sm py-0" onClick={() => setPwFor(s)}>Owner pw</button>
                      <button
                        className={`btn btn-sm py-0 ${s.is_active ? "btn-outline-danger" : "btn-outline-success"}`}
                        disabled={busy === s.id}
                        onClick={() => toggle(s)}
                      >
                        {s.is_active ? "Suspend" : "Activate"}
                      </button>
                      <button
                        className="btn btn-outline-danger btn-sm py-0"
                        disabled={!s.can_delete}
                        title={s.can_delete ? "Delete permanently" : `Suspend for ${COOLOFF_DAYS} days before deleting`}
                        onClick={() => setDelFor(s)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      
      {/* Edit Category Modal */}
      {editCatFor && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content text-body" style={{ background: "rgba(30,41,59,1)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="modal-header border-0">
                <h5 className="modal-title">Change Category: {editCatFor.name}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setEditCatFor(null)}></button>
              </div>
              <div className="modal-body border-0">
                <select className="form-select" id="catEditSelect" defaultValue={editCatFor.business_type}>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v as string}</option>
                  ))}
                </select>
              </div>
              <div className="modal-footer border-0">
                <button className="btn btn-secondary" onClick={() => setEditCatFor(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={() => updateCategory(editCatFor.id, (document.getElementById('catEditSelect') as HTMLSelectElement).value)}>
                  Save Category
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pwFor && <OwnerPwModal shop={pwFor} onClose={() => setPwFor(null)} />}
      {delFor && <DeleteModal shop={delFor} onClose={(done) => { setDelFor(null); if (done) load(); }} />}
    </>
  );
}

function OwnerPwModal({ shop, onClose }: { shop: Shop; onClose: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setErr("");
    setBusy(true);
    try {
      await api(`/platform/shops/${shop.id}/owner-password/`, { method: "POST", body: { new_password: pw } });
      toast.error(`Owner password reset for ${shop.name}.`);
      onClose();
    } catch (e: any) {
      setErr(e?.data?.detail || e?.message || "Failed.");
      setBusy(false);
    }
  }

  return (
    <Backdrop onClose={onClose}>
      <h5 className="fw-bold mb-1">Reset owner password</h5>
      <p className="text-secondary small">{shop.name} · {shop.owner_email || "no owner"}</p>
      {err && <div className="alert alert-danger py-2 px-3">{err}</div>}
      <input
        type="text"
        className="form-control mb-3"
        placeholder="New password (min 6 chars)"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
      />
      <div className="d-flex justify-content-end gap-2">
        <button className="btn btn-light btn-sm" onClick={onClose}>Cancel</button>
        <button className="btn btn-brand btn-sm" disabled={busy || pw.length < 6} onClick={save}>Reset password</button>
      </div>
    </Backdrop>
  );
}

function DeleteModal({ shop, onClose }: { shop: Shop; onClose: (done?: boolean) => void }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function del() {
    setErr("");
    setBusy(true);
    try {
      await api(`/platform/shops/${shop.id}/`, { method: "DELETE", body: { confirm_name: name } });
      toast.error(`Shop '${shop.name}' permanently deleted.`);
      onClose(true);
    } catch (e: any) {
      setErr(e?.data?.detail || e?.message || "Failed.");
      setBusy(false);
    }
  }

  return (
    <Backdrop onClose={() => onClose()}>
      <h5 className="fw-bold text-danger mb-1">Delete shop permanently</h5>
      <p className="text-secondary small mb-2">
        This erases <strong>{shop.name}</strong> and all its data. Type the shop name to confirm.
      </p>
      {err && <div className="alert alert-danger py-2 px-3">{err}</div>}
      <input
        className="form-control mb-3"
        placeholder={shop.name}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="d-flex justify-content-end gap-2">
        <button className="btn btn-light btn-sm" onClick={() => onClose()}>Cancel</button>
        <button className="btn btn-danger btn-sm" disabled={busy || name !== shop.name} onClick={del}>Delete forever</button>
      </div>
    </Backdrop>
  );
}

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
      style={{ background: "rgba(0,0,0,.4)", zIndex: 1090 }}
      onClick={onClose}
    >
      <div className="card shadow-lg" style={{ maxWidth: "26rem", width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <div className="card-body">{children}</div>
      </div>
    </div>
  );
}
