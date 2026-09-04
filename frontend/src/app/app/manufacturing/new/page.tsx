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
      toast.error(lang === "bn" ? "কমপক্ষে একটি কাঁচামাল থাকা আবশ্যক।" : "At least one raw material is required.");
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
      toast.error(lang === "bn" ? "অনুগ্রহ করে অন্তত একটি কাঁচামাল এবং তার সঠিক পরিমাণ প্রদান করুন।" : "Please add at least one raw material with quantity greater than 0.");
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
      toast.success(lang === "bn" ? `🎉 ব্যাচ #${res.batch_number} সফলভাবে শুরু হয়েছে! কাঁচামাল স্টক কর্তন সম্পন্ন।` : `🎉 Batch #${res.batch_number} started successfully! Raw materials deducted.`);
      router.push("/app/manufacturing");
    } catch (err: any) {
      toast.error(err?.message || (lang === "bn" ? "ব্যাচ শুরু করতে ব্যর্থ হয়েছে।" : "Failed to start batch."));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-5 text-center"><Spinner /></div>;

  return (
    <div className="container-fluid px-0 pb-5 max-w-5xl">
      <div className="mb-3">
        <Link href="/app/manufacturing" className="text-decoration-none text-secondary small d-flex align-items-center gap-1 mb-2">
          <i className="bi bi-arrow-left"></i> {lang === "bn" ? "ম্যানুফ্যাকচারিং হাবে ফিরে যান" : "Back to Manufacturing Hub"}
        </Link>
        <PageHeader
          title={lang === "bn" ? "নতুন প্রোডাকশন ব্যাচ শুরু করুন (WIP)" : "Start Production Batch (WIP)"}
          subtitle={lang === "bn" ? "ধাপ ১: কাঁচামাল নিশ্চিত করুন এবং ইনভেন্টরি থেকে কেটে নিন। উৎপাদন সম্পন্ন হলে ধাপ ২-তে চূড়ান্ত ফলন এন্ট্রি করা হবে।" : "Step 1: Commit and deduct raw materials from inventory. Final yield output will be recorded in Step 2 when manufacturing is completed."}
        />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 mb-4">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3 border-bottom pb-3">
            <h5 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
              <i className="bi bi-list-check text-primary fs-5"></i>
              <span>{lang === "bn" ? "ব্যবহৃত কাঁচামালসমূহ" : "Raw Materials to Use"}</span>
            </h5>
            <button type="button" className="btn btn-outline-primary btn-sm rounded-pill px-3 shadow-sm" onClick={addRow}>
              <i className="bi bi-plus-lg me-1"></i> {lang === "bn" ? "+ আরও উপাদান যোগ করুন" : "+ Add Another Material"}
            </button>
          </div>

          <div className="table-responsive mb-3">
            <table className="table align-top" style={{ minWidth: "620px" }}>
              <thead className="table-light small text-secondary">
                <tr>
                  <th style={{ width: "38%" }}>{lang === "bn" ? "কাঁচামাল নির্বাচন" : "Select Raw Material"}</th>
                  <th style={{ width: "22%" }}>{lang === "bn" ? "পরিমাণ" : "Quantity"}</th>
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
                    <tr key={idx} className="border-bottom">
                      <td className="py-2">
                        <select
                          className="form-select form-select-sm"
                          value={row.product_id}
                          onChange={(e) => handleProductChange(idx, e.target.value)}
                          required
                        >
                          <option value="">{lang === "bn" ? "-- কাঁচামাল নির্বাচন করুন --" : "-- Choose Raw Material --"}</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({lang === "bn" ? "স্টক:" : "Stock:"} {p.current_stock} {p.unit_detail?.name || ""})
                            </option>
                          ))}
                        </select>
                        {prod && (
                          <div className={`small mt-1.5 ${isStockLow ? "text-danger fw-bold" : "text-secondary"}`} style={{ fontSize: "0.78rem" }}>
                            {isStockLow && (lang === "bn" ? "⚠️ সতর্কতা: " : "⚠️ Warning: ")}
                            {lang === "bn" ? "বর্তমান স্টক: " : "Current Stock: "}
                            <span className="fw-semibold text-dark">{prod.current_stock}</span> {prod.unit_detail?.name || (lang === "bn" ? "ইউনিট" : "Units")}
                          </div>
                        )}
                      </td>
                      <td className="py-2">
                        <div className="input-group input-group-sm">
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            className="form-control"
                            placeholder={lang === "bn" ? "পরিমাণ" : "Qty"}
                            value={row.quantity}
                            onChange={(e) => handleQtyChange(idx, e.target.value)}
                            required
                          />
                          <span className="input-group-text small bg-light text-secondary">{prod?.unit_detail?.name || (lang === "bn" ? "একক" : "Unit")}</span>
                        </div>
                      </td>
                      <td className="py-2">
                        <div className="input-group input-group-sm">
                          <span className="input-group-text bg-light text-secondary">৳</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-control"
                            value={row.unit_cost}
                            onChange={(e) => handleCostChange(idx, e.target.value)}
                            title={lang === "bn" ? "এই ব্যাচের জন্য ক্রয়মূল্য" : "Snapshot cost price for this batch"}
                          />
                        </div>
                      </td>
                      <td className="py-2 text-end fw-bold text-dark font-monospace fs-6 pt-2">
                        ৳{sub.toFixed(2)}
                      </td>
                      <td className="py-2 text-center pt-2">
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm border-0 p-1"
                          onClick={() => removeRow(idx)}
                          title={lang === "bn" ? "উপাদান মুছে ফেলুন" : "Remove material"}
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

          <div className="d-flex flex-wrap justify-content-end mb-4">
            <div className="p-3 rounded-3 bg-light border text-end w-100 w-sm-auto shadow-sm" style={{ minWidth: 260 }}>
              <span className="text-secondary small d-block mb-1">{lang === "bn" ? "কাঁচামালে মোট বিনিয়োগ:" : "Total Raw Material Investment:"}</span>
              <h4 className="fw-bold text-primary mb-0 font-monospace">৳{totalMaterialCost.toFixed(2)}</h4>
            </div>
          </div>

          <div className="row g-3 pt-2 border-top">
            <div className="col-md-6">
              <label className="form-label small fw-bold text-dark">{lang === "bn" ? "আনুমানিক অতিরিক্ত খরচ (ঐচ্ছিক)" : "Upfront Estimated Extra Cost (Optional)"}</label>
              <div className="input-group input-group-sm mb-1">
                <span className="input-group-text bg-light text-secondary">৳</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control"
                  value={additionalCost}
                  onChange={(e) => setAdditionalCost(e.target.value)}
                />
              </div>
              <div className="form-text small text-secondary">{lang === "bn" ? "মজুরি, বোতল/প্যাকেজিং, বিদ্যুৎ, জ্বালানি ও ওভারহেড খরচ।" : "Labor, packaging bottles, fuel, electricity overheads."}</div>
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-bold text-dark">{lang === "bn" ? "অতিরিক্ত খরচের বিবরণ" : "Extra Cost Note"}</label>
              <input
                type="text"
                className="form-control form-control-sm mb-1"
                placeholder={lang === "bn" ? "যেমন: মজুরি ও প্যাকেজিং বোতল" : "e.g. Labor & Bottles"}
                value={additionalCostNote}
                onChange={(e) => setAdditionalCostNote(e.target.value)}
              />
              <div className="form-text small text-secondary">{lang === "bn" ? "অতিরিক্ত খরচের খাত বা রেফারেন্স লিখুন।" : "Specify what the extra costs cover."}</div>
            </div>
            <div className="col-12">
              <label className="form-label small fw-bold text-dark">{lang === "bn" ? "ব্যাচ নোট / রেসিপি বিবরণ (ঐচ্ছিক)" : "Batch Notes / Recipe Reference (Optional)"}</label>
              <textarea
                className="form-control form-control-sm"
                rows={2}
                placeholder={lang === "bn" ? "যেমন: ফর্মুলা বি-১২ শ্যাম্পু বা অ্যাসিড মিশ্রণ" : "e.g. Formula B-12 Shampoos with Rose Fragrance"}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              ></textarea>
            </div>
          </div>
        </div>

        <div className="d-flex flex-wrap align-items-center justify-content-between p-3 p-md-4 rounded-4 bg-body-tertiary border shadow-sm gap-3">
          <div>
            <span className="text-secondary small d-block mb-1">{lang === "bn" ? "ব্যাচের মোট সম্ভাব্য খরচ:" : "Grand Total Batch Cost:"}</span>
            <strong className="text-success fs-4 font-monospace">৳{grandTotalEstimatedCost.toFixed(2)}</strong>
          </div>
          <div className="d-flex flex-wrap gap-2">
            <Link href="/app/manufacturing" className="btn btn-outline-secondary rounded-pill px-4">
              {lang === "bn" ? "বাতিল" : "Cancel"}
            </Link>
            <button type="submit" className="btn btn-brand rounded-pill px-4 px-md-5 shadow-sm" disabled={busy || rows.length === 0}>
              {busy ? (lang === "bn" ? "ব্যাচ শুরু হচ্ছে..." : "Starting Batch...") : (lang === "bn" ? "🚀 ব্যাচ শুরু করুন (কাঁচামাল কর্তন)" : "🚀 Start Batch (Commit Materials)")}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
