"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, fetchAll } from "@/lib/api";
import { PageHeader, Spinner } from "@/components/ui";
import { useLanguage } from "@/contexts/LanguageContext";
import toast from "react-hot-toast";

type Product = {
  id: number;
  name: string;
  sku: string;
  cost_price: string;
  selling_price: string;
  current_stock: string;
  unit_detail?: { name: string; symbol: string; measure_type: string };
};

type MaterialRow = {
  product_id: string;
  quantity: string;
  unit_cost: string;
};

export default function NewProductionBatchPage() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [notes, setNotes] = useState("");
  const [additionalCost, setAdditionalCost] = useState("0");
  const [additionalCostNote, setAdditionalCostNote] = useState("");

  const [rows, setRows] = useState<MaterialRow[]>([
    { product_id: "", quantity: "", unit_cost: "0" },
  ]);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchAll<Product>("/catalog/products/");
      setProducts(data);
      if (data.length > 0 && rows.length === 1 && !rows[0].product_id) {
        setRows([{ product_id: String(data[0].id), quantity: "1", unit_cost: data[0].cost_price || "0" }]);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to load products.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleProductChange = (index: number, prodId: string) => {
    const prod = products.find((p) => String(p.id) === prodId);
    const updated = [...rows];
    updated[index] = {
      ...updated[index],
      product_id: prodId,
      unit_cost: prod ? String(prod.cost_price || 0) : "0",
    };
    setRows(updated);
  };

  const handleQtyChange = (index: number, qty: string) => {
    const updated = [...rows];
    updated[index].quantity = qty;
    setRows(updated);
  };

  const handleCostChange = (index: number, cost: string) => {
    const updated = [...rows];
    updated[index].unit_cost = cost;
    setRows(updated);
  };

  const addRow = () => {
    const defaultProd = products[0];
    setRows([
      ...rows,
      {
        product_id: defaultProd ? String(defaultProd.id) : "",
        quantity: "1",
        unit_cost: defaultProd ? String(defaultProd.cost_price || 0) : "0",
      },
    ]);
  };

  const removeRow = (index: number) => {
    if (rows.length === 1) {
      toast.error("At least one raw material is required.");
      return;
    }
    setRows(rows.filter((_, i) => i !== index));
  };

  const totalMaterialCost = useMemo(() => {
    return rows.reduce((sum, r) => {
      const q = Number(r.quantity) || 0;
      const c = Number(r.unit_cost) || 0;
      return sum + q * c;
    }, 0);
  }, [rows]);

  const grandTotalEstimatedCost = useMemo(() => {
    return totalMaterialCost + (Number(additionalCost) || 0);
  }, [totalMaterialCost, additionalCost]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validMaterials = rows
      .filter((r) => r.product_id && Number(r.quantity) > 0)
      .map((r) => ({
        product_id: Number(r.product_id),
        quantity: Number(r.quantity),
        unit_cost: Number(r.unit_cost),
      }));

    if (validMaterials.length === 0) {
      toast.error("Please add at least one raw material with quantity greater than 0.");
      return;
    }

    setBusy(true);
    try {
      const res = await api<{ id: number; batch_number: string }>("/manufacturing/batches/", {
        method: "POST",
        body: {
          materials: validMaterials,
          notes,
          additional_cost: Number(additionalCost) || 0,
          additional_cost_note: additionalCostNote,
        },
      });
      toast.success(`🎉 Batch #${res.batch_number} started successfully! Raw materials deducted.`);
      router.push("/app/manufacturing");
    } catch (err: any) {
      toast.error(err?.message || "Failed to start batch.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-5 text-center"><Spinner /></div>;

  return (
    <div className="container-fluid px-0 pb-5 max-w-5xl">
      <div className="mb-3">
        <Link href="/app/manufacturing" className="text-decoration-none text-secondary small d-flex align-items-center gap-1 mb-2">
          <i className="bi bi-arrow-left"></i> Back to Manufacturing Hub
        </Link>
        <PageHeader
          title={lang === "bn" ? "নতুন প্রোডাকশন ব্যাচ শুরু করুন (WIP)" : "Start Production Batch (WIP)"}
          subtitle="Step 1: Commit and deduct raw materials from inventory. Final yield output will be recorded in Step 2 when manufacturing is completed."
        />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card border-0 shadow-sm rounded-4 p-4 mb-4">
          <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
            <h5 className="fw-bold mb-0 text-dark">
              <i className="bi bi-list-check me-2 text-primary"></i>Raw Materials to Use
            </h5>
            <button type="button" className="btn btn-outline-primary btn-sm rounded-pill px-3" onClick={addRow}>
              <i className="bi bi-plus-lg me-1"></i> {lang === "bn" ? "আরও উপাদান যোগ করুন" : "Add Another Material"}
            </button>
          </div>

          <div className="table-responsive mb-3">
            <table className="table align-middle">
              <thead className="table-light small text-secondary">
                <tr>
                  <th style={{ width: "40%" }}>{lang === "bn" ? "কাঁচামাল নির্বাচন" : "Select Raw Material"}</th>
                  <th style={{ width: "20%" }}>{lang === "bn" ? "পরিমাণ" : "Quantity"}</th>
                  <th style={{ width: "20%" }}>{lang === "bn" ? "একক খরচ (৳)" : "Unit Cost (৳)"}</th>
                  <th style={{ width: "15%" }} className="text-end">{lang === "bn" ? "সাবটোটাল (৳)" : "Subtotal (৳)"}</th>
                  <th style={{ width: "5%" }} className="text-center"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const prod = products.find((p) => String(p.id) === row.product_id);
                  const sub = (Number(row.quantity) || 0) * (Number(row.unit_cost) || 0);
                  const stock = Number(prod?.current_stock || 0);
                  const isStockLow = stock < Number(row.quantity || 0);

                  return (
                    <tr key={idx}>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={row.product_id}
                          onChange={(e) => handleProductChange(idx, e.target.value)}
                          required
                        >
                          <option value="">{lang === "bn" ? "-- কাঁচামাল নির্বাচন করুন --" : "-- Choose Raw Material --"}</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (In Stock: {p.current_stock} {p.unit_detail?.name || ""})
                            </option>
                          ))}
                        </select>
                        {prod && (
                          <div className={`small mt-1 ${isStockLow ? "text-danger fw-bold" : "text-secondary"}`}>
                            {isStockLow && "⚠️ Warning: "}Current Stock: {prod.current_stock} {prod.unit_detail?.name || "Units"}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="input-group input-group-sm">
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            className="form-control"
                            placeholder="Qty"
                            value={row.quantity}
                            onChange={(e) => handleQtyChange(idx, e.target.value)}
                            required
                          />
                          <span className="input-group-text small">{prod?.unit_detail?.name || "Unit"}</span>
                        </div>
                      </td>
                      <td>
                        <div className="input-group input-group-sm">
                          <span className="input-group-text">৳</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-control"
                            value={row.unit_cost}
                            onChange={(e) => handleCostChange(idx, e.target.value)}
                            title="Snapshot cost price for this batch"
                          />
                        </div>
                      </td>
                      <td className="text-end fw-bold text-dark">
                        ৳{sub.toFixed(2)}
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          className="btn btn-link text-danger p-0"
                          onClick={() => removeRow(idx)}
                          title="Remove material"
                        >
                          <i className="bi bi-trash fs-6"></i>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="d-flex justify-content-end mb-4">
            <div className="p-3 rounded-3 bg-light border text-end" style={{ minWidth: 280 }}>
              <span className="text-secondary small d-block">{lang === "bn" ? "কাঁচামালে মোট বিনিয়োগ:" : "Total Raw Material Investment:"}</span>
              <h4 className="fw-bold text-primary mb-0">৳{totalMaterialCost.toFixed(2)}</h4>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label small fw-bold">{lang === "bn" ? "আনুমানিক অতিরিক্ত খরচ (ঐচ্ছিক)" : "Upfront Estimated Extra Cost (Optional)"}</label>
              <div className="input-group input-group-sm">
                <span className="input-group-text">৳</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control"
                  value={additionalCost}
                  onChange={(e) => setAdditionalCost(e.target.value)}
                />
              </div>
              <div className="form-text small">{lang === "bn" ? "মজুরি, বোতল/প্যাকেজিং, বিদ্যুৎ, জ্বালানি ও ওভারহেড খরচ।" : "Labor, packaging bottles, fuel, electricity overheads."}</div>
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-bold">{lang === "bn" ? "অতিরিক্ত খরচের বিবরণ" : "Extra Cost Note"}</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="e.g. Labor & Bottles"
                value={additionalCostNote}
                onChange={(e) => setAdditionalCostNote(e.target.value)}
              />
            </div>
            <div className="col-12">
              <label className="form-label small fw-bold">{lang === "bn" ? "ব্যাচ নোট / রেসিপি বিবরণ" : "Batch Notes / Recipe Reference"}</label>
              <textarea
                className="form-control form-control-sm"
                rows={2}
                placeholder="e.g. Formula B-12 Shampoos with Rose Fragrance"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              ></textarea>
            </div>
          </div>
        </div>

        <div className="d-flex align-items-center justify-content-between p-3 rounded-4 bg-body-tertiary border">
          <div>
            <span className="text-secondary small d-block">{lang === "bn" ? "ব্যাচের মোট সম্ভাব্য খরচ:" : "Grand Total Batch Cost:"}</span>
            <strong className="text-success fs-5">৳{grandTotalEstimatedCost.toFixed(2)}</strong>
          </div>
          <div className="d-flex gap-2">
            <Link href="/app/manufacturing" className="btn btn-outline-secondary rounded-pill px-4">
              {lang === "bn" ? "বাতিল" : "Cancel"}
            </Link>
            <button type="submit" className="btn btn-brand rounded-pill px-5 shadow-sm" disabled={busy || rows.length === 0}>
              {busy ? "Starting Batch..." : "🚀 Start Batch (Commit Materials)"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
