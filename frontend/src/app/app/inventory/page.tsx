"use client";

import { useEffect, useState } from "react";
import { api, fetchAll } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Card, ErrorState, Pagination, Spinner, money, fmtDate, usePagination } from "@/components/ui";
import toast from "react-hot-toast";

type InvSummary = {
  stock_value: number;
  by_category: { category__name: string | null; units: number; value: number }[];
  low_stock: { id: number; name: string; sku: string; current_stock: string; reorder_level: string }[];
  out_of_stock: { id: number; name: string; sku: string; current_stock: string }[];
};
type Movement = {
  id: number;
  product_name: string;
  movement_type: string;
  quantity: string;
  unit_cost: string;
  note: string;
  created_at: string;
};

export default function InventoryPage() {
  const { can, isOwner } = useAuth();
  const canAdjust = isOwner || can("manage_inventory");
  const [inv, setInv] = useState<InvSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adj, setAdj] = useState({ product: "", movement_type: "adjust_in", quantity: "", unit_cost: "", note: "", barcodes: "" });
  const [products, setProducts] = useState<{ id: number; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  // Stock movements: server-side paginated (only the current page is fetched).
  const [moveData, setMoveData] = useState<{ count: number; next: string | null; previous: string | null; results: Movement[] } | null>(null);
  const [movePageNo, setMovePageNo] = useState(1);
  const [movLoading, setMovLoading] = useState(true);
  const [movTick, setMovTick] = useState(0);

  async function load() {
    setLoading(true);
    try {
      const [i, p] = await Promise.all([
        api<InvSummary>("/analytics/inventory/"),
        // light=1 → products without their (potentially thousands of) units.
        fetchAll<{ id: number; name: string }>("/catalog/products/?light=1").catch(() => []),
      ]);
      setInv(i);
      setProducts(p);
    } catch (e: any) {
      setError(e?.message || "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    let alive = true;
    setMovLoading(true);
    api<{ count: number; next: string | null; previous: string | null; results: Movement[] }>(`/inventory/stock-movements/?page=${movePageNo}&page_size=25`)
      .then((d) => { if (alive) setMoveData(d); })
      .catch(() => { if (alive) setMoveData({ count: 0, next: null, previous: null, results: [] }); })
      .finally(() => { if (alive) setMovLoading(false); });
    return () => { alive = false; };
  }, [movePageNo, movTick]);

  async function submitAdjust(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const parsedBarcodes = adj.barcodes?.split("\n").map(b => b.trim()).filter(Boolean) || [];
      await api("/inventory/stock-movements/adjust/", {
        method: "POST",
        body: {
          product: Number(adj.product),
          movement_type: adj.movement_type,
          quantity: Math.max(0, Math.round(Number(adj.quantity) || 0)),
          unit_cost: adj.unit_cost || 0,
          note: adj.note,
          barcodes: parsedBarcodes,
        },
      });
      setAdj({ product: "", movement_type: "adjust_in", quantity: "", unit_cost: "", note: "", barcodes: "" });
      await load();
      setMovePageNo(1);
      setMovTick((t) => t + 1);
    } catch (e: any) {
      toast.error(e?.message || "Could not adjust stock");
    } finally {
      setSaving(false);
    }
  }

  const lowStock = usePagination(inv?.low_stock ?? []);
  const outStock = usePagination(inv?.out_of_stock ?? []);
  const moves = moveData?.results ?? [];
  const moveTotalPages = Math.max(1, Math.ceil((moveData?.count ?? 0) / 25));

  if (loading) return <Spinner label="Loading inventory…" />;
  if (error) return <ErrorState error={error} />;
  if (!inv) return null;

  return (
    <div className="vstack gap-3">
      <div className="row g-3">
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">Stock value</div>
            <div className="fs-4 fw-bold">{money(inv.stock_value)}</div>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">Low stock</div>
            <div className="fs-4 fw-bold text-warning">{inv.low_stock.length}</div>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">Out of stock</div>
            <div className="fs-4 fw-bold text-danger">{inv.out_of_stock.length}</div>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">Categories</div>
            <div className="fs-4 fw-bold">{inv.by_category.length}</div>
          </Card>
        </div>
      </div>

      {canAdjust && (
        <div className="card shadow-sm">
          <div className="card-body">
            <div className="fw-semibold mb-3">Manual stock adjustment</div>
            <form onSubmit={submitAdjust} className="row g-2 align-items-start">
              <div className="col-md-3">
                <label className="small">Product</label>
                <select required className="form-select form-select-sm" value={adj.product} onChange={(e) => setAdj({ ...adj, product: e.target.value })}>
                  <option value="">Select…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <label className="small">Type</label>
                <select className="form-select form-select-sm" value={adj.movement_type} onChange={(e) => setAdj({ ...adj, movement_type: e.target.value })}>
                  <option value="adjust_in">Adjust in</option>
                  <option value="adjust_out">Adjust out</option>
                  <option value="damage_out">Damage out</option>
                  <option value="opening">Opening balance</option>
                </select>
              </div>
              <div className="col-md-1">
                <label className="small">Quantity</label>
                <input required type="number" step="1" min="1" className="form-control form-control-sm" value={adj.quantity} onChange={(e) => setAdj({ ...adj, quantity: e.target.value })} />
              </div>
              <div className="col-md-2">
                <label className="small">Unit cost</label>
                <input type="number" step="0.01" className="form-control form-control-sm" value={adj.unit_cost} onChange={(e) => setAdj({ ...adj, unit_cost: e.target.value })} />
              </div>
              <div className="col-md-4">
                <label className="small">Barcodes (One per line)</label>
                <textarea 
                  className="form-control form-control-sm font-monospace" 
                  rows={3} 
                  placeholder="Scan or paste barcodes (optional)"
                  value={adj.barcodes || ""} 
                  onChange={(e) => {
                    const val = e.target.value;
                    const parts = val.split("\n");
                    const last = parts[parts.length - 1];
                    // Optional auto-newline after 8+ chars (simple continuous scan support)
                    if (last.length >= 13) {
                      setAdj({ ...adj, barcodes: val.trimEnd() + "\n" });
                    } else {
                      setAdj({ ...adj, barcodes: val });
                    }
                  }} 
                />
                {adj.barcodes && (
                  <div className={`small mt-1 ${
                    adj.barcodes.split("\n").filter(b => b.trim()).length !== Number(adj.quantity || 0) 
                      ? "text-danger fw-bold" 
                      : "text-success fw-bold"
                  }`}>
                    {adj.barcodes.split("\n").filter(b => b.trim()).length} barcodes scanned.
                    {adj.barcodes.split("\n").filter(b => b.trim()).length !== Number(adj.quantity || 0) && " Must match quantity!"}
                  </div>
                )}
              </div>
              
              <div className="col-md-6 mt-2">
                <label className="small">Note</label>
                <input className="form-control form-control-sm" value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} placeholder="Optional…" />
              </div>
              <div className="col-md-6 mt-2 d-flex align-items-end justify-content-end">
                <button 
                  className="btn btn-brand btn-sm w-100" 
                  disabled={saving || (
                    adj.barcodes?.trim() ? adj.barcodes.split("\n").filter(b => b.trim()).length !== Number(adj.quantity || 0) : false
                  )}
                >
                  {saving ? "Saving…" : "Apply adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="fw-semibold mb-3">Low stock</div>
              <div className="table-responsive">
                <table className="table table-striped table-sm mb-0">
                  <thead className="thead-5">
                    <tr>
                      <th>Product</th>
                      <th className="text-end">Stock</th>
                      <th className="text-end">Reorder</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inv.low_stock.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-secondary">All good.</td>
                      </tr>
                    ) : (
                      lowStock.paged.map((p) => (
                        <tr key={p.id}>
                          <td>{p.name}</td>
                          <td className="text-end text-warning fw-semibold">{p.current_stock}</td>
                          <td className="text-end">{p.reorder_level}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination page={lowStock.page} totalPages={lowStock.totalPages} setPage={lowStock.setPage} total={lowStock.total} />
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="fw-semibold mb-3">Out of stock</div>
              <div className="table-responsive">
                <table className="table table-striped table-sm mb-0">
                  <thead className="thead-1">
                    <tr>
                      <th>Product</th>
                      <th className="text-end">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inv.out_of_stock.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="text-secondary">All good.</td>
                      </tr>
                    ) : (
                      outStock.paged.map((p) => (
                        <tr key={p.id}>
                          <td>{p.name}</td>
                          <td className="text-end text-danger fw-semibold">{p.current_stock}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination page={outStock.page} totalPages={outStock.totalPages} setPage={outStock.setPage} total={outStock.total} />
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-body">
          <div className="fw-semibold mb-3">Recent stock movements</div>
          <div className="table-responsive position-relative">
            {movLoading && (
              <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ background: "rgba(255,255,255,.5)", zIndex: 2 }}>
                <Spinner label="Loading…" />
              </div>
            )}
            <table className="table table-striped table-sm mb-0">
              <thead className="thead-6">
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Type</th>
                  <th className="text-end">Qty</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {moves.length === 0 && !movLoading ? (
                  <tr data-empty="">
                    <td colSpan={5} className="text-center text-secondary py-4">No movements recorded.</td>
                  </tr>
                ) : (
                  moves.map((m) => (
                    <tr key={m.id}>
                      <td className="text-secondary">{fmtDate(m.created_at)}</td>
                      <td>{m.product_name}</td>
                      <td>
                        <span className="badge text-bg-light">{m.movement_type}</span>
                      </td>
                      <td className="text-end">{m.quantity}</td>
                      <td className="text-secondary">{m.note || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 pt-2">
            <span className="small text-secondary">{(moveData?.count ?? 0).toLocaleString()} movements · Page {movePageNo} of {moveTotalPages}</span>
            <div className="btn-group btn-group-sm">
              <button className="btn btn-outline-secondary" disabled={movLoading || !moveData?.previous} onClick={() => setMovePageNo(1)}>«</button>
              <button className="btn btn-outline-secondary" disabled={movLoading || !moveData?.previous} onClick={() => setMovePageNo((p) => Math.max(1, p - 1))}>‹ Prev</button>
              <button className="btn btn-outline-secondary" disabled={movLoading || !moveData?.next} onClick={() => setMovePageNo((p) => p + 1)}>Next ›</button>
              <button className="btn btn-outline-secondary" disabled={movLoading || !moveData?.next} onClick={() => setMovePageNo(moveTotalPages)}>»</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
