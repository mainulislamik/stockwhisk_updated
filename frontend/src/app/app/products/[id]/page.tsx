"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, unwrap } from "@/lib/api";
import { Card, ErrorState, Spinner, money, fmtDate } from "@/components/ui";

type Product = {
  id: number;
  name: string;
  sku: string;
  barcode: string;
  cost_price: string;
  selling_price: string;
  current_stock: string;
  reorder_level: string;
  is_low_stock: boolean;
  is_active: boolean;
  description: string;
};
type Movement = { id: number; movement_type: string; quantity: string; note: string; created_at: string };
type ProductUnit = { 
  id: number; 
  barcode: string; 
  status: string; 
  cost_price: string | null; 
  selling_price: string | null; 
  warranty_months: number | null; 
  effective_cost_price: string; 
  effective_selling_price: string; 
  effective_warranty_months: number; 
  created_at: string; 
};
export default function ProductProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<Product | null>(null);
  const [moves, setMoves] = useState<Movement[]>([]);
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingUnit, setEditingUnit] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ cost_price: "", selling_price: "", warranty_months: "" });

  const startEditing = (u: ProductUnit) => {
    setEditingUnit(u.id);
    setEditForm({
      cost_price: u.cost_price?.toString() ?? u.effective_cost_price?.toString() ?? "",
      selling_price: u.selling_price?.toString() ?? u.effective_selling_price?.toString() ?? "",
      warranty_months: u.warranty_months?.toString() ?? u.effective_warranty_months?.toString() ?? "",
    });
  };

  const saveUnit = async (u: ProductUnit) => {
    try {
      const data = {
        cost_price: editForm.cost_price ? Number(editForm.cost_price) : null,
        selling_price: editForm.selling_price ? Number(editForm.selling_price) : null,
        warranty_months: editForm.warranty_months ? Number(editForm.warranty_months) : null,
      };
      await api(`/catalog/product-units/${u.id}/`, { method: "PATCH", body: data });
      
      const un = await api<ProductUnit[]>(`/catalog/product-units/`, { params: { product: id, status: "in_stock" } });
      setUnits(unwrap(un));
      setEditingUnit(null);
    } catch (e: any) {
      alert(e.message || "Failed to update unit");
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [prod, mv, un] = await Promise.all([
          api<Product>(`/catalog/products/${id}/`),
          api(`/inventory/stock-movements/`, { params: { product: id } }).catch(() => []),
          api(`/catalog/product-units/`, { params: { product: id, status: "in_stock" } }).catch(() => []),
        ]);
        setP(prod);
        setMoves(unwrap<Movement>(mv));
        setUnits(unwrap<ProductUnit>(un));
      } catch (e: any) {
        setError(e?.message || "Failed to load product");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <Spinner label="Loading product…" />;
  if (error) return <ErrorState error={error} />;
  if (!p) return null;

  return (
    <div className="vstack gap-3">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div>
          <h1 className="h4 fw-bold text-brand mb-0">{p.name}</h1>
          <div className="text-secondary small">SKU {p.sku || "—"} · Barcode {p.barcode || "—"}</div>
        </div>
        <div className="d-flex gap-2">
          <Link href={`/app/products/${p.id}/edit`} className="btn btn-outline-brand btn-sm">
            Edit
          </Link>
          <Link href="/app/products" className="btn btn-light btn-sm">
            Back
          </Link>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">Cost</div>
            <div className="fs-5 fw-bold">{money(p.cost_price)}</div>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">Selling price</div>
            <div className="fs-5 fw-bold">{money(p.selling_price)}</div>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">In stock</div>
            <div className={`fs-5 fw-bold ${p.is_low_stock ? "text-danger" : ""}`}>{p.current_stock}</div>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">Reorder level</div>
            <div className="fs-5 fw-bold">{p.reorder_level}</div>
          </Card>
        </div>
      </div>

      {p.description && (
        <div className="card shadow-sm">
          <div className="card-body">
            <div className="fw-semibold mb-1">Description</div>
            <div className="text-secondary">{p.description}</div>
          </div>
        </div>
      )}

      {units.length > 0 && (
        <div className="card shadow-sm">
          <div className="card-body">
            <h2 className="h6 fw-bold mb-3 text-brand">📦 Individual Units (In Stock)</h2>
            <div className="table-responsive">
              <table className="table table-hover table-sm align-middle mb-0">
                <thead className="thead-6">
                  <tr>
                    <th>Date Received</th>
                    <th>Barcode / Serial</th>
                    <th className="text-end">Cost Price</th>
                    <th className="text-end">Selling Price</th>
                    <th className="text-end">Warranty (Months)</th>
                    <th className="text-end">Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((u) => {
                    const isEditing = editingUnit === u.id;
                    return (
                      <tr key={u.id}>
                        <td className="text-secondary small">{fmtDate(u.created_at)}</td>
                        <td className="fw-medium font-monospace small">
                          <i className="bi bi-upc-scan me-2 text-secondary"></i>
                          {u.barcode}
                        </td>
                        <td className="text-end">
                          {isEditing ? (
                            <input 
                              type="number" className="form-control form-control-sm text-end"
                              value={editForm.cost_price} 
                              onChange={(e) => setEditForm({ ...editForm, cost_price: e.target.value })}
                            />
                          ) : (
                            <span className="text-secondary small">{money(u.effective_cost_price)}</span>
                          )}
                        </td>
                        <td className="text-end fw-semibold text-brand small">
                          {isEditing ? (
                            <input 
                              type="number" className="form-control form-control-sm text-end"
                              value={editForm.selling_price} 
                              onChange={(e) => setEditForm({ ...editForm, selling_price: e.target.value })}
                            />
                          ) : (
                            money(u.effective_selling_price)
                          )}
                        </td>
                        <td className="text-end small">
                          {isEditing ? (
                            <input 
                              type="number" className="form-control form-control-sm text-end"
                              value={editForm.warranty_months} 
                              onChange={(e) => setEditForm({ ...editForm, warranty_months: e.target.value })}
                            />
                          ) : (
                            u.effective_warranty_months || "—"
                          )}
                        </td>
                        <td className="text-end">
                          <span className="badge bg-success-subtle text-success text-capitalize px-2 py-1">
                            {u.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="text-end">
                          {isEditing ? (
                            <div className="btn-group btn-group-sm">
                              <button className="btn btn-primary" onClick={() => saveUnit(u)}>Save</button>
                              <button className="btn btn-light" onClick={() => setEditingUnit(null)}>Cancel</button>
                            </div>
                          ) : (
                            <button className="btn btn-sm btn-light" onClick={() => startEditing(u)}>Edit</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="card shadow-sm">
        <div className="card-body">
          <div className="fw-semibold mb-3">Stock movements</div>
          <div className="table-responsive">
            <table className="table table-striped table-sm mb-0">
              <thead className="thead-6">
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th className="text-end">Qty</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {moves.length === 0 ? (
                  <tr data-empty="">
                    <td colSpan={4} className="text-center text-secondary py-4">No movements.</td>
                  </tr>
                ) : (
                  moves.map((m) => (
                    <tr key={m.id}>
                      <td className="text-secondary">{fmtDate(m.created_at)}</td>
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
        </div>
      </div>
    </div>
  );
}
