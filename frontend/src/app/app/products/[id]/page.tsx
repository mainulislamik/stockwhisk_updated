"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, unwrap } from "@/lib/api";
import { Card, ErrorState, Spinner, money, fmtDate } from "@/components/ui";
import toast from "react-hot-toast";

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
  sale_id?: number | null;
  sale_invoice_no?: string | null;
  sold_at?: string | null;
  warranty_status?: string | null;
  repair_status?: string | null;
};
function warrantyBadge(status: string | null | undefined, t: any) {
  if (!status) return <span className="text-secondary small">—</span>;
  const map: Record<string, [string, string]> = {
    active: ["bg-success-subtle text-success", "Active"],
    expiring_soon: ["bg-warning-subtle text-warning", "Expiring soon"],
    expired: ["bg-secondary-subtle text-secondary", "Expired"],
    claimed: ["bg-info-subtle text-info", "Claimed"],
    void: ["bg-dark-subtle text-dark", "Void"],
  };
  const [cls, label] = map[status] || ["bg-secondary-subtle text-secondary", status];
  return <span className={`badge ${cls} px-2 py-1`}>{label}</span>;
}

function repairBadge(status?: string | null) {
  if (!status) return <span className="text-secondary small">—</span>;
  const label = status.replace(/_/g, " ");
  const cls = status === "delivered" ? "bg-success-subtle text-success"
    : status === "ready_for_pickup" ? "bg-info-subtle text-info"
    : "bg-warning-subtle text-warning";
  return <span className={`badge ${cls} px-2 py-1 text-capitalize`}>{label}</span>;
}

export default function ProductProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<Product | null>(null);
  const [moves, setMoves] = useState<Movement[]>([]);
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [soldUnits, setSoldUnits] = useState<ProductUnit[]>([]);
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
      toast.error(e.message || t("prd_err_update_unit"));
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [prod, mv, un, sold] = await Promise.all([
          api<Product>(`/catalog/products/${id}/`),
          api(`/inventory/stock-movements/`, { params: { product: id } }).catch(() => []),
          api(`/catalog/product-units/`, { params: { product: id, status: "in_stock" } }).catch(() => []),
          api(`/catalog/product-units/`, { params: { product: id, status: "sold" } }).catch(() => []),
        ]);
        setP(prod);
        setMoves(unwrap<Movement>(mv));
        setUnits(unwrap<ProductUnit>(un));
        setSoldUnits(unwrap<ProductUnit>(sold));
      } catch (e: any) {
        setError(e?.message || t("prd_err_load"));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <Spinner label={t("prd_loading")} />;
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
            <div className="small text-secondary">{t("prd_lbl_cost_val")}</div>
            <div className="fs-5 fw-bold">{money(Number(p.cost_price || 0) * Number(p.current_stock || 0))}</div>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">{t("prd_lbl_retail_val")}</div>
            <div className="fs-5 fw-bold">{money(Number(p.selling_price || 0) * Number(p.current_stock || 0))}</div>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">{t("prd_lbl_in_stock")}</div>
            <div className={`fs-5 fw-bold ${p.is_low_stock ? "text-danger" : ""}`}>{p.current_stock}</div>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">{t("prd_lbl_reorder")}</div>
            <div className="fs-5 fw-bold">{p.reorder_level}</div>
          </Card>
        </div>
      </div>

      {p.description && (
        <div className="card shadow-sm">
          <div className="card-body">
            <div className="fw-semibold mb-1">{t("prd_lbl_desc")}</div>
            <div className="text-secondary">{p.description}</div>
          </div>
        </div>
      )}

      {units.length > 0 && (
        <div className="card shadow-sm">
          <div className="card-body">
            <h2 className="h6 fw-bold mb-3 text-brand">{t("prd_title_units")}</h2>
            <div className="table-responsive">
              <table className="table table-hover table-sm align-middle mb-0">
                <thead className="thead-6">
                  <tr>
                    <th>{t("prd_col_date_rec")}</th>
                    <th>{t("prd_col_barcode")}</th>
                    <th className="text-end">{t("prd_col_cost")}</th>
                    <th className="text-end">{t("prd_col_sell")}</th>
                    <th className="text-end">{t("prd_col_warranty")}</th>
                    <th className="text-end">{t("prd_col_status")}</th>
                    <th className="text-end">{t("prd_col_actions")}</th>
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
                              <button className="btn btn-primary" onClick={() => saveUnit(u)}>{t("prd_btn_save")}</button>
                              <button className="btn btn-light" onClick={() => setEditingUnit(null)}>{t("prd_btn_cancel")}</button>
                            </div>
                          ) : (
                            <button className="btn btn-sm btn-light" onClick={() => startEditing(u)}>{t("prd_btn_edit")}</button>
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

      {soldUnits.length > 0 && (
        <div className="card shadow-sm">
          <div className="card-body">
            <h2 className="h6 fw-bold mb-3" style={{ color: "#b45309" }}>{t("prd_title_sold")}</h2>
            <div className="table-responsive">
              <table className="table table-hover table-sm align-middle mb-0">
                <thead className="thead-6">
                  <tr>
                    <th>{t("prd_col_sold_on")}</th>
                    <th>{t("prd_col_barcode")}</th>
                    <th>{t("prd_col_invoice")}</th>
                    <th className="text-center">{t("prd_col_warranty").replace(" (Months)", "").replace(" (মাস)", "")}</th>
                    <th className="text-center">{t("prd_col_repair")}</th>
                  </tr>
                </thead>
                <tbody>
                  {soldUnits.map((u) => (
                    <tr key={u.id}>
                      <td className="text-secondary small">{u.sold_at ? fmtDate(u.sold_at) : "—"}</td>
                      <td className="fw-medium font-monospace small">
                        <i className="bi bi-upc-scan me-2 text-secondary"></i>{u.barcode}
                      </td>
                      <td>
                        {u.sale_id ? (
                          <a href={`/invoice/${u.sale_id}`} target="_blank" rel="noopener noreferrer" className="text-decoration-none fw-medium">
                            <i className="bi bi-receipt me-1"></i>{u.sale_invoice_no || `#${u.sale_id}`}
                          </a>
                        ) : <span className="text-secondary">—</span>}
                      </td>
                      <td className="text-center">{warrantyBadge(u.warranty_status, t)}</td>
                      <td className="text-center">{repairBadge(u.repair_status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="card shadow-sm">
        <div className="card-body">
          <div className="fw-semibold mb-3">{t("prd_title_moves")}</div>
          <div className="table-responsive">
            <table className="table table-striped table-sm mb-0">
              <thead className="thead-6">
                <tr>
                  <th>{t("prd_col_date")}</th>
                  <th>{t("prd_col_type")}</th>
                  <th className="text-end">{t("prd_col_qty")}</th>
                  <th>{t("prd_col_note")}</th>
                </tr>
              </thead>
              <tbody>
                {moves.length === 0 ? (
                  <tr data-empty="">
                    <td colSpan={4} className="text-center text-secondary py-4">{t("prd_no_moves")}</td>
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
