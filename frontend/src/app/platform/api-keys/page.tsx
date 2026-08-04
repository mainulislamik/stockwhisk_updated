"use client";

import { useCallback, useEffect, useState } from "react";
import { api, fetchAll } from "@/lib/api";
import { Card, EmptyRow, ErrorState, PageHeader, Spinner, fmtDate } from "@/components/ui";

type Key = {
  id: number;
  shop_name: string;
  name: string;
  prefix: string;
  can_read: boolean;
  can_write: boolean;
  resources: string[];
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
};

const RESOURCES = ["products", "inventory", "customers", "sales", "reports"];

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<Key[] | null>(null);
  const [shops, setShops] = useState<{ id: number; name: string }[]>([]);
  const [error, setError] = useState("");
  const [rawKey, setRawKey] = useState<{ name: string; key: string } | null>(null);
  const [form, setForm] = useState({ shop: "", name: "", can_read: true, can_write: false, resources: ["products", "inventory"] as string[] });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [k, s] = await Promise.all([
        fetchAll<Key>("/platform/api-keys/"),
        fetchAll<{ id: number; name: string }>("/platform/shops/"),
      ]);
      setKeys(k);
      setShops(s);
    } catch (e: any) {
      setError(e?.message || "Failed to load API keys.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleResource(r: string) {
    setForm((f) => ({ ...f, resources: f.resources.includes(r) ? f.resources.filter((x) => x !== r) : [...f.resources, r] }));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.shop) return;
    setBusy(true);
    try {
      const res = await api<Key & { raw_key: string }>("/platform/api-keys/", {
        method: "POST",
        body: { shop: Number(form.shop), name: form.name || "API key", can_read: form.can_read, can_write: form.can_write, resources: form.resources },
      });
      setRawKey({ name: res.name, key: res.raw_key });
      setForm((f) => ({ ...f, name: "" }));
      await load();
    } catch (e: any) {
      alert(e?.data?.detail || e?.message || "Could not create key.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(k: Key) {
    if (!confirm(`Revoke "${k.name}"?`)) return;
    try { await api(`/platform/api-keys/${k.id}/`, { method: "DELETE" }); await load(); }
    catch (e: any) { alert(e?.message || "Failed."); }
  }

  async function regenerate(k: Key) {
    if (!confirm(`Regenerate "${k.name}"? The old secret stops working.`)) return;
    try {
      const res = await api<Key & { raw_key: string }>(`/platform/api-keys/${k.id}/regenerate/`, { method: "POST" });
      setRawKey({ name: res.name, key: res.raw_key });
      await load();
    } catch (e: any) { alert(e?.message || "Failed."); }
  }

  if (error) return <ErrorState error={error} />;
  if (!keys) return <Spinner />;

  return (
    <>
      <PageHeader title="API Keys" />

      {rawKey && (
        <div className="alert alert-warning">
          <div className="fw-semibold mb-1">New key “{rawKey.name}” — copy it now, it won’t be shown again.</div>
          <code className="d-block bg-white border rounded p-2 text-break">{rawKey.key}</code>
          <button className="btn btn-sm btn-outline-secondary mt-2" onClick={() => navigator.clipboard?.writeText(rawKey.key)}>Copy</button>
        </div>
      )}

      <Card className="mb-4">
        <form className="row g-3 align-items-end" onSubmit={create}>
          <div className="col-md-3">
            <label className="form-label small fw-medium">Shop</label>
            <select className="form-select" required value={form.shop} onChange={(e) => setForm((f) => ({ ...f, shop: e.target.value }))}>
              <option value="">— choose shop —</option>
              {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-medium">Key name</label>
            <input className="form-control" placeholder="API key" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="col-md-2">
            <div className="form-check"><input className="form-check-input" type="checkbox" id="cr" checked={form.can_read} onChange={(e) => setForm((f) => ({ ...f, can_read: e.target.checked }))} /><label className="form-check-label" htmlFor="cr">Read</label></div>
            <div className="form-check"><input className="form-check-input" type="checkbox" id="cw" checked={form.can_write} onChange={(e) => setForm((f) => ({ ...f, can_write: e.target.checked }))} /><label className="form-check-label" htmlFor="cw">Write</label></div>
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-medium d-block">Resources</label>
            {RESOURCES.map((r) => (
              <span key={r} className="form-check form-check-inline">
                <input className="form-check-input" type="checkbox" id={`r-${r}`} checked={form.resources.includes(r)} onChange={() => toggleResource(r)} />
                <label className="form-check-label small" htmlFor={`r-${r}`}>{r}</label>
              </span>
            ))}
          </div>
          <div className="col-md-1"><button className="btn btn-brand w-100" disabled={busy}>Issue</button></div>
        </form>
      </Card>

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="thead-3">
              <tr><th>Shop</th><th>Name</th><th>Prefix</th><th>Scopes</th><th>Status</th><th>Last used</th><th>Created</th><th className="text-end">Actions</th></tr>
            </thead>
            <tbody>
              {keys.length === 0 && <EmptyRow cols={8} text="No API keys." />}
              {keys.map((k) => (
                <tr key={k.id}>
                  <td className="fw-semibold">{k.shop_name}</td>
                  <td>{k.name}</td>
                  <td><code>{k.prefix}…</code></td>
                  <td className="small">{[k.can_read && "read", k.can_write && "write"].filter(Boolean).join(", ")}<br /><span className="text-secondary">{(k.resources || []).join(", ")}</span></td>
                  <td>{k.is_active ? <span className="text-success">Active</span> : <span className="text-danger">Revoked</span>}</td>
                  <td className="text-nowrap small">{k.last_used_at ? fmtDate(k.last_used_at) : "—"}</td>
                  <td className="text-nowrap small">{fmtDate(k.created_at)}</td>
                  <td className="text-end">
                    {k.is_active && (
                      <div className="d-flex gap-1 justify-content-end">
                        <button className="btn btn-outline-secondary btn-sm py-0" onClick={() => regenerate(k)}>Regenerate</button>
                        <button className="btn btn-outline-danger btn-sm py-0" onClick={() => revoke(k)}>Revoke</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
