"use client";

import { useEffect, useState } from "react";
import { api, fetchAll } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Card, ErrorState, Pagination, Spinner, money, fmtDate, usePagination } from "@/components/ui";

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
  const [moves, setMoves] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adj, setAdj] = useState({ product: "", movement_type: "adjust_in", quantity: "", unit_cost: "", note: "", barcodes: "" });
  const [products, setProducts] = useState<{ id: number; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [i, m, p] = await Promise.all([
        api<InvSummary>("/analytics/inventory/"),
        fetchAll<Movement>("/inventory/stock-movements/").catch(() => []),
        fetchAll<{ id: number; name: string }>("/catalog/products/").catch(() => []),
      ]);
      setInv(i);
      setMoves(m);
      setProducts(p);
    } catch (e: any) {
      setError(e?.message || "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

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
          quantity: adj.quantity,
          unit_cost: adj.unit_cost || 0,
          note: adj.note,
          barcodes: parsedBarcodes,
        },
      });
      setAdj({ product: "", movement_type: "adjust_in", quantity: "", unit_cost: "", note: "", barcodes: "" });
      await load();
    } catch (e: any) {
      alert(e?.message || "Could not adjust stock");
    } finally {
      setSaving(false);
    }
  }

  const lowStock = usePagination(inv?.low_stock ?? []);
  const outStock = usePagination(inv?.out_of_stock ?? []);
  const movePage = usePagination(moves);

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
                <input required type="number" step="0.01" className="form-control form-control-sm" value={adj.quantity} onChange={(e) => setAdj({ ...adj, quantity: e.target.value })} />
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
          <div className="table-responsive">
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
                {moves.length === 0 ? (
                  <tr data-empty="">
                    <td colSpan={5} className="text-center text-secondary py-4">No movements recorded.</td>
                  </tr>
                ) : (
                  movePage.paged.map((m) => (
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
          <Pagination page={movePage.page} totalPages={movePage.totalPages} setPage={movePage.setPage} total={movePage.total} />
        </div>
      </div>
    </div>
  );
}
