"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, fetchAll } from "@/lib/api";
import { PageHeader, Spinner, EmptyRow, fmtDate } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/contexts/LanguageContext";
import toast from "react-hot-toast";

type ProductionMaterial = {
  id: number;
  product: number;
  product_name: string;
  product_sku: string;
  quantity: string;
  unit_name: string;
  unit_symbol: string;
  unit_cost: string;
  subtotal: string;
};

type ProductionBatch = {
  id: number;
  batch_number: string;
  status: "in_progress" | "completed" | "cancelled";
  started_at: string;
  completed_at: string | null;
  total_material_cost: string;
  additional_cost: string;
  additional_cost_note: string;
  total_cost: string;
  output_product: number | null;
  output_product_name: string | null;
  output_product_sku: string | null;
  output_unit_name: string | null;
  output_product_selling_price: string;
  output_quantity: string;
  calculated_unit_cost: string;
  update_product_cost: boolean;
  notes: string;
  materials: ProductionMaterial[];
  created_by_name: string | null;
  completed_by_name: string | null;
  created_at: string;
};

type Product = {
  id: number;
  name: string;
  sku: string;
  cost_price: string;
  selling_price: string;
  current_stock: string;
  unit_detail?: { name: string; symbol: string; measure_type: string };
};

type NamedItem = { id: number; name: string; short_code?: string };

type SummaryStats = {
  in_progress_count: number;
  completed_count: number;
  total_units_produced: string;
  total_material_cost_utilized: string;
};

export default function ManufacturingPage() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const [batches, setBatches] = useState<ProductionBatch[] | null>(null);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<NamedItem[]>([]);
  const [categories, setCategories] = useState<NamedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [busy, setBusy] = useState(false);

  // Complete Modal State
  const [completeBatch, setCompleteBatch] = useState<ProductionBatch | null>(null);
  const [outProductMode, setOutProductMode] = useState<"existing" | "new">("existing");
  const [outProductId, setOutProductId] = useState<string>("");
  const [newProdName, setNewProdName] = useState<string>("");
  const [newProdSellPrice, setNewProdSellPrice] = useState<string>("");
  const [newProdUnit, setNewProdUnit] = useState<string>("");
  const [newProdCategory, setNewProdCategory] = useState<string>("");
  const [outQty, setOutQty] = useState<string>("");
  const [extraCost, setExtraCost] = useState<string>("0");
  const [extraCostNote, setExtraCostNote] = useState<string>("");
  const [updateCostPrice, setUpdateCostPrice] = useState<boolean>(true);

  // View Details Modal State
  const [viewBatch, setViewBatch] = useState<ProductionBatch | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [batchList, sumData, prodList, unitList, catList] = await Promise.all([
        fetchAll<ProductionBatch>("/manufacturing/batches/"),
        api<SummaryStats>("/manufacturing/batches/summary/"),
        fetchAll<Product>("/catalog/products/"),
        fetchAll<NamedItem>("/catalog/units/").catch(() => []),
        fetchAll<NamedItem>("/catalog/categories/").catch(() => []),
      ]);
      setBatches(batchList);
      setSummary(sumData);
      setProducts(prodList);
      setUnits(unitList);
      setCategories(catList);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load manufacturing data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredBatches = useMemo(() => {
    if (!batches) return [];
    let list = batches;
    if (filterStatus !== "all") {
      list = list.filter((b) => b.status === filterStatus);
    }
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (b) =>
          b.batch_number.toLowerCase().includes(query) ||
          (b.output_product_name && b.output_product_name.toLowerCase().includes(query)) ||
          b.notes.toLowerCase().includes(query) ||
          b.materials.some((m) => m.product_name.toLowerCase().includes(query))
      );
    }
    return list;
  }, [batches, filterStatus, q]);

  // Handle Cancel Batch
  const handleCancelBatch = async (batch: ProductionBatch) => {
    const reason = prompt(`Cancel Batch #${batch.batch_number}? All raw materials will be refunded back to stock. Enter reason (optional):`);
    if (reason === null) return;
    setBusy(true);
    try {
      await api(`/manufacturing/batches/${batch.id}/cancel/`, {
        method: "POST",
        body: { reason },
      });
      toast.success(`Batch #${batch.batch_number} cancelled & raw materials restored to stock.`);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to cancel batch.");
    } finally {
      setBusy(false);
    }
  };

  // Open Complete Modal
  const openCompleteModal = (batch: ProductionBatch) => {
    setCompleteBatch(batch);
    setOutProductMode("existing");
    setOutProductId(batch.output_product ? String(batch.output_product) : (products[0] ? String(products[0].id) : ""));
    setNewProdName("");
    setNewProdSellPrice("");
    setNewProdUnit(units[0] ? String(units[0].id) : "");
    setNewProdCategory("");
    setOutQty("");
    setExtraCost(batch.additional_cost ? String(batch.additional_cost) : "0");
    setExtraCostNote(batch.additional_cost_note || "");
    setUpdateCostPrice(true);
  };

  // Submit Complete Batch
  const handleFinalizeProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeBatch) return;

    const qty = Number(outQty);
    if (!qty || qty <= 0) {
      toast.error("Please enter a valid output quantity greater than 0.");
      return;
    }

    setBusy(true);
    try {
      let targetProductId = Number(outProductId);

      if (outProductMode === "new") {
        if (!newProdName.trim()) {
          toast.error("Please enter a name for the new finished product.");
          setBusy(false);
          return;
        }
        if (!newProdSellPrice || Number(newProdSellPrice) < 0) {
          toast.error("Please enter a valid selling price for the new product.");
          setBusy(false);
          return;
        }

        // 1. Create the new product in catalog
        const createdProd = await api<Product>("/catalog/products/", {
          method: "POST",
          body: {
            name: newProdName.trim(),
            cost_price: liveCalculatedCost,
            selling_price: newProdSellPrice,
            unit: newProdUnit ? Number(newProdUnit) : undefined,
            category: newProdCategory ? Number(newProdCategory) : undefined,
            track_inventory: true,
          },
        });
        targetProductId = createdProd.id;
      } else {
        if (!targetProductId) {
          toast.error("Please select a finished output product.");
          setBusy(false);
          return;
        }
      }

      // 2. Complete batch and credit the yield to targetProductId
      await api(`/manufacturing/batches/${completeBatch.id}/complete/`, {
        method: "POST",
        body: {
          output_product_id: targetProductId,
          output_quantity: qty,
          additional_cost: Number(extraCost) || 0,
          additional_cost_note: extraCostNote,
          update_product_cost: updateCostPrice,
        },
      });

      toast.success(
        outProductMode === "new"
          ? `Product "${newProdName}" created & Batch #${completeBatch.batch_number} completed with ${qty} units in stock!`
          : `Batch #${completeBatch.batch_number} successfully completed & ${qty} units credited to stock!`
      );
      setCompleteBatch(null);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to complete production batch.");
    } finally {
      setBusy(false);
    }
  };

  const selectedOutputProduct = useMemo(() => {
    if (outProductMode === "new") {
      const u = units.find((x) => String(x.id) === String(newProdUnit));
      return {
        id: 0,
        sku: "Auto-generated",
        current_stock: "0",
        name: newProdName || "New Product",
        cost_price: "0",
        selling_price: newProdSellPrice || "0",
        unit_detail: { name: u?.name || "Unit", symbol: u?.short_code || "", measure_type: "count" },
      };
    }
    return products.find((p) => String(p.id) === String(outProductId));
  }, [products, outProductId, outProductMode, newProdName, newProdSellPrice, newProdUnit, units]);

  const liveCalculatedCost = useMemo(() => {
    if (!completeBatch) return "0.00";
    const matCost = Number(completeBatch.total_material_cost) || 0;
    const added = Number(extraCost) || 0;
    const total = matCost + added;
    const qty = Number(outQty) || 0;
    if (qty <= 0) return "0.00";
    return (total / qty).toFixed(2);
  }, [completeBatch, extraCost, outQty]);

  return (
    <div className="container-fluid px-0 pb-5">
      <PageHeader
        title="Manufacturing & Production Hub"
        subtitle="2-Step Dynamic Batch Production: Commit raw materials, process, and enter final yield with automatic unit cost calculation."
        actions={
          <Link href="/app/manufacturing/new" className="btn btn-brand rounded-pill px-4 shadow-sm">
            <i className="bi bi-plus-lg me-1"></i> {lang === "bn" ? "নতুন ব্যাচ শুরু করুন" : "Start New Batch"}
          </Link>
        }
      />

      {/* Summary KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm rounded-4 h-100 p-3" style={{ background: "linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(245, 158, 11, 0.03))", borderLeft: "4px solid #f59e0b" }}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <p className="text-secondary small fw-medium mb-1">{lang === "bn" ? "চলমান ব্যাচ (WIP)" : "Active Batches (WIP)"}</p>
                <h3 className="fw-bold mb-0 text-warning d-flex align-items-center gap-2">
                  {summary?.in_progress_count ?? 0}
                  <span className="spinner-grow spinner-grow-sm text-warning" role="status"></span>
                </h3>
              </div>
              <div className="p-3 bg-warning bg-opacity-25 text-warning rounded-circle fs-4">
                <i className="bi bi-hourglass-split"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm rounded-4 h-100 p-3" style={{ background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.03))", borderLeft: "4px solid #10b981" }}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <p className="text-secondary small fw-medium mb-1">{lang === "bn" ? "সম্পন্ন ব্যাচ" : "Completed Batches"}</p>
                <h3 className="fw-bold mb-0 text-success">{summary?.completed_count ?? 0}</h3>
              </div>
              <div className="p-3 bg-success bg-opacity-25 text-success rounded-circle fs-4">
                <i className="bi bi-check-circle-fill"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm rounded-4 h-100 p-3" style={{ background: "linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(99, 102, 241, 0.03))", borderLeft: "4px solid #6366f1" }}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <p className="text-secondary small fw-medium mb-1">{lang === "bn" ? "মোট উৎপাদিত ইউনিট" : "Total Finished Units"}</p>
                <h3 className="fw-bold mb-0 text-primary">{Number(summary?.total_units_produced || 0).toLocaleString()}</h3>
              </div>
              <div className="p-3 bg-primary bg-opacity-25 text-primary rounded-circle fs-4">
                <i className="bi bi-box-seam-fill"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm rounded-4 h-100 p-3" style={{ background: "linear-gradient(135deg, rgba(14, 165, 233, 0.12), rgba(14, 165, 233, 0.03))", borderLeft: "4px solid #0ea5e9" }}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <p className="text-secondary small fw-medium mb-1">{lang === "bn" ? "ব্যবহৃত কাঁচামাল খরচ" : "Raw Material Utilized"}</p>
                <h3 className="fw-bold mb-0 text-info">৳{Number(summary?.total_material_cost_utilized || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
              </div>
              <div className="p-3 bg-info bg-opacity-25 text-info rounded-circle fs-4">
                <i className="bi bi-cash-coin"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card border-0 shadow-sm rounded-4 mb-4 p-3 bg-body-tertiary">
        <div className="row g-3 align-items-center">
          <div className="col-md-5">
            <div className="input-group">
              <span className="input-group-text bg-body border-end-0"><i className="bi bi-search text-secondary"></i></span>
              <input
                type="text"
                className="form-control bg-body border-start-0 shadow-none"
                placeholder={lang === "bn" ? "ব্যাচ #, কাঁচামাল বা পণ্য দিয়ে খুঁজুন..." : "Search by batch #, raw material, or finished product..."}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
          <div className="col-md-7">
            <div className="d-flex flex-wrap gap-2 justify-content-md-end">
              <button
                className={`btn btn-sm rounded-pill px-3 ${filterStatus === "all" ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => setFilterStatus("all")}
              >
                {lang === "bn" ? "সকল ব্যাচ (" : "All Batches ("}{batches?.length ?? 0})
              </button>
              <button
                className={`btn btn-sm rounded-pill px-3 ${filterStatus === "in_progress" ? "btn-warning text-dark fw-bold" : "btn-outline-warning"}`}
                onClick={() => setFilterStatus("in_progress")}
              >
                {lang === "bn" ? "প্রক্রিয়াধীন ⏳ (" : "Processing ⏳ ("}{batches?.filter((b) => b.status === "in_progress").length ?? 0})
              </button>
              <button
                className={`btn btn-sm rounded-pill px-3 ${filterStatus === "completed" ? "btn-success" : "btn-outline-success"}`}
                onClick={() => setFilterStatus("completed")}
              >
                {lang === "bn" ? "সম্পন্ন ✅ (" : "Completed ✅ ("}{batches?.filter((b) => b.status === "completed").length ?? 0})
              </button>
              <button
                className={`btn btn-sm rounded-pill px-3 ${filterStatus === "cancelled" ? "btn-danger" : "btn-outline-danger"}`}
                onClick={() => setFilterStatus("cancelled")}
              >
                {lang === "bn" ? "বাতিল (" : "Cancelled ("}{batches?.filter((b) => b.status === "cancelled").length ?? 0})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Batches Table */}
      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        {loading ? (
          <div className="p-5 text-center"><Spinner /></div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="ps-4">{lang === "bn" ? "ব্যাচ নম্বর" : "Batch Number"}</th>
                  <th>{lang === "bn" ? "স্ট্যাটাস" : "Status"}</th>
                  <th>{lang === "bn" ? "ব্যবহৃত কাঁচামাল" : "Raw Materials Used"}</th>
                  <th>{lang === "bn" ? "মোট খরচ" : "Total Cost"}</th>
                  <th>{lang === "bn" ? "উৎপাদিত পণ্য / পরিমাণ" : "Yield / Output"}</th>
                  <th>{lang === "bn" ? "ইউনিট প্রতি খরচ" : "Per-Unit Cost"}</th>
                  <th>{lang === "bn" ? "শুরুর সময়" : "Started Time"}</th>
                  <th className="text-end pe-4">{lang === "bn" ? "অ্যাকশন" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredBatches.length === 0 ? (
                  <EmptyRow cols={8} text={lang === "bn" ? "কোনো প্রোডাকশন ব্যাচ পাওয়া যায়নি।" : "No production batches found matching your criteria."} />
                ) : (
                  filteredBatches.map((b) => (
                    <tr key={b.id}>
                      <td className="ps-4">
                        <span className="fw-bold text-primary font-monospace">{b.batch_number}</span>
                        {b.notes && <div className="text-secondary small text-truncate" style={{ maxWidth: 200 }}>{b.notes}</div>}
                      </td>
                      <td>
                        {b.status === "in_progress" && (
                          <span className="badge bg-warning bg-opacity-25 text-warning border border-warning border-opacity-25 rounded-pill px-3 py-1">
                            <i className="bi bi-hourglass-split me-1"></i> {lang === "bn" ? "প্রক্রিয়াধীন" : "Processing"}
                          </span>
                        )}
                        {b.status === "completed" && (
                          <span className="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25 rounded-pill px-3 py-1">
                            <i className="bi bi-check2-circle me-1"></i> {lang === "bn" ? "সম্পন্ন" : "Completed"}
                          </span>
                        )}
                        {b.status === "cancelled" && (
                          <span className="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25 rounded-pill px-3 py-1">
                            <i className="bi bi-x-circle me-1"></i> {lang === "bn" ? "বাতিল" : "Cancelled"}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-1" style={{ maxWidth: 280 }}>
                          {b.materials && b.materials.length > 0 ? (
                            b.materials.slice(0, 3).map((m, idx) => (
                              <span key={idx} className="badge bg-white text-dark border shadow-xs rounded-pill px-2 py-1 small fw-normal">
                                🧪 {m.product_name} <strong className="text-primary">({Number(m.quantity)} {m.unit_name || m.unit_symbol || "Unit"})</strong>
                              </span>
                            ))
                          ) : (
                            <span className="text-muted small fst-italic">{lang === "bn" ? "কোনো উপাদান নেই" : "No materials recorded"}</span>
                          )}
                          {b.materials && b.materials.length > 3 && (
                            <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 rounded-pill px-2 py-1 small">
                              +{b.materials.length - 3} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="fw-bold text-nowrap">
                        ৳{Number(b.total_cost || b.total_material_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        {b.status === "completed" && b.output_product_name ? (
                          <div>
                            <div className="fw-semibold text-success">{b.output_product_name}</div>
                            <div className="text-secondary small">
                              {Number(b.output_quantity)} {b.output_unit_name || "Units"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-secondary small fst-italic">{lang === "bn" ? "উৎপাদন এন্ট্রি অপেক্ষমাণ..." : "Pending Yield Entry..."}</span>
                        )}
                      </td>
                      <td className="text-nowrap">
                        {b.status === "completed" ? (
                          <span className="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25 fs-6 fw-bold px-2 py-1">
                            ৳{Number(b.calculated_unit_cost).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-secondary">—</span>
                        )}
                      </td>
                      <td className="text-secondary small text-nowrap">
                        {fmtDate(b.started_at)}
                      </td>
                      <td className="text-end pe-4 text-nowrap">
                        <div className="d-flex align-items-center justify-content-end gap-2">
                          {b.status === "in_progress" && (
                            <>
                              <button
                                className="btn btn-success btn-sm rounded-pill px-3 shadow-sm"
                                onClick={() => openCompleteModal(b)}
                                disabled={busy}
                              >
                                <i className="bi bi-bullseye me-1"></i> {lang === "bn" ? "উৎপাদন এন্ট্রি" : "Enter Yield"}
                              </button>
                              <button
                                className="btn btn-outline-danger btn-sm rounded-pill px-2"
                                onClick={() => handleCancelBatch(b)}
                                title="Cancel batch and restore raw materials"
                                disabled={busy}
                              >
                                <i className="bi bi-x-lg"></i>
                              </button>
                            </>
                          )}
                          <button
                            className="btn btn-outline-secondary btn-sm rounded-pill px-3"
                            onClick={() => setViewBatch(b)}
                          >
                            <i className="bi bi-eye me-1"></i> {lang === "bn" ? "বিস্তারিত" : "Details"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Complete Batch & Enter Yield Modal */}
      {completeBatch && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header bg-success bg-opacity-10 border-bottom border-success border-opacity-25 py-3">
                <h5 className="modal-title fw-bold text-success d-flex align-items-center gap-2">
                  <i className="bi bi-bullseye"></i> {lang === "bn" ? "প্রোডাকশন সম্পন্ন ও উৎপাদিত পণ্য যুক্তকরণ" : "Complete Production & Record Output Yield"}
                </h5>
                <button type="button" className="btn-close" onClick={() => setCompleteBatch(null)}></button>
              </div>

              <form onSubmit={handleFinalizeProduction}>
                <div className="modal-body p-4">
                  <div className="p-3 rounded-3 mb-4" style={{ backgroundColor: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                    <div className="row g-3">
                      <div className="col-sm-4">
                        <span className="text-secondary small d-block">{lang === "bn" ? "ব্যাচ নম্বর" : "Batch Number"}</span>
                        <strong className="text-primary font-monospace">{completeBatch.batch_number}</strong>
                      </div>
                      <div className="col-sm-4">
                        <span className="text-secondary small d-block">{lang === "bn" ? "কাঁচামালে মোট বিনিয়োগ" : "Raw Material Invested"}</span>
                        <strong className="text-success fs-6">৳{Number(completeBatch.total_material_cost).toFixed(2)}</strong>
                      </div>
                      <div className="col-sm-4">
                        <span className="text-secondary small d-block">{lang === "bn" ? "কাঁচামালের সংখ্যা" : "Materials Count"}</span>
                        <strong className="text-dark">{completeBatch.materials.length} Raw Materials</strong>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <label className="form-label fw-bold mb-0">
                        {lang === "bn" ? "চূড়ান্ত উৎপাদিত পণ্য" : "Finished Output Product"} <span className="text-danger">*</span>
                      </label>
                      <div className="btn-group btn-group-sm">
                        <button
                          type="button"
                          className={`btn btn-sm ${outProductMode === "existing" ? "btn-primary" : "btn-outline-secondary"}`}
                          onClick={() => setOutProductMode("existing")}
                        >
                          <i className="bi bi-list-check me-1"></i> {lang === "bn" ? "বিদ্যমান পণ্য" : "Existing Product"}
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${outProductMode === "new" ? "btn-success" : "btn-outline-secondary"}`}
                          onClick={() => setOutProductMode("new")}
                        >
                          <i className="bi bi-plus-circle me-1"></i> {lang === "bn" ? "+ নতুন পণ্য তৈরি" : "+ Create New Product"}
                        </button>
                      </div>
                    </div>

                    {outProductMode === "existing" ? (
                      <div className="row g-3">
                        <div className="col-md-7">
                          <select
                            className="form-select"
                            value={outProductId}
                            onChange={(e) => setOutProductId(e.target.value)}
                            required={outProductMode === "existing"}
                          >
                            <option value="">{lang === "bn" ? "-- উৎপাদিত পণ্য নির্বাচন করুন --" : "-- Select Finished Product --"}</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (SKU: {p.sku || "N/A"}) [Stock: {p.current_stock}]
                              </option>
                            ))}
                          </select>
                          <div className="form-text small">{lang === "bn" ? "উৎপাদিত স্টক যোগ করার জন্য বিদ্যমান পণ্য নির্বাচন করুন।" : "Select an existing catalog product to receive the produced yield."}</div>
                        </div>

                        <div className="col-md-5">
                          <label className="form-label fw-bold small">{lang === "bn" ? "প্রকৃত উৎপাদিত পরিমাণ (Yield)" : "Actual Produced Yield (Quantity)"} <span className="text-danger">*</span></label>
                          <div className="input-group">
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              className="form-control"
                              placeholder="e.g. 150"
                              value={outQty}
                              onChange={(e) => setOutQty(e.target.value)}
                              required
                            />
                            <span className="input-group-text">{selectedOutputProduct?.unit_detail?.name || "Units"}</span>
                          </div>
                          <div className="form-text small">Final produced quantity.</div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-light rounded-3 border border-success border-opacity-50">
                        <div className="row g-3 mb-2">
                          <div className="col-md-7">
                            <label className="small fw-bold text-dark">{lang === "bn" ? "নতুন প্রোডাক্টের নাম" : "New Product Name"} <span className="text-danger">*</span></label>
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="e.g. Yellow Textile Dye 500ml"
                              value={newProdName}
                              onChange={(e) => setNewProdName(e.target.value)}
                              required={outProductMode === "new"}
                            />
                          </div>
                          <div className="col-md-5">
                            <label className="small fw-bold text-dark">{lang === "bn" ? "বিক্রয় মূল্য (৳)" : "Selling Price (৳)"} <span className="text-danger">*</span></label>
                            <div className="input-group input-group-sm">
                              <span className="input-group-text">৳</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="form-control"
                                placeholder="e.g. 120.00"
                                value={newProdSellPrice}
                                onChange={(e) => setNewProdSellPrice(e.target.value)}
                                required={outProductMode === "new"}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="row g-3 mb-2">
                          <div className="col-md-4">
                            <label className="small fw-semibold text-dark">{lang === "bn" ? "পরিমাপের একক (Unit)" : "Unit of Measure"}</label>
                            <select
                              className="form-select form-select-sm"
                              value={newProdUnit}
                              onChange={(e) => setNewProdUnit(e.target.value)}
                            >
                              <option value="">-- Default (Piece / Pcs) --</option>
                              {units.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name} {u.short_code ? `(${u.short_code})` : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-md-4">
                            <label className="small fw-semibold text-dark">{lang === "bn" ? "ক্যাটাগরি (ঐচ্ছিক)" : "Category (Optional)"}</label>
                            <select
                              className="form-select form-select-sm"
                              value={newProdCategory}
                              onChange={(e) => setNewProdCategory(e.target.value)}
                            >
                              <option value="">-- None --</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-md-4">
                            <label className="small fw-bold text-dark">{lang === "bn" ? "প্রকৃত উৎপাদিত পরিমাণ (Yield)" : "Actual Produced Yield (Quantity)"} <span className="text-danger">*</span></label>
                            <div className="input-group input-group-sm">
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                className="form-control"
                                placeholder="e.g. 150"
                                value={outQty}
                                onChange={(e) => setOutQty(e.target.value)}
                                required={outProductMode === "new"}
                              />
                              <span className="input-group-text">{units.find(u => String(u.id) === String(newProdUnit))?.short_code || "Units"}</span>
                            </div>
                          </div>
                        </div>
                        <div className="small text-success mt-1">
                          <i className="bi bi-info-circle me-1"></i> This new product will be created with Cost Price = <strong>৳{liveCalculatedCost}</strong> and initial Stock = <strong>{outQty || "0"} {units.find(u => String(u.id) === String(newProdUnit))?.name || "Units"}</strong>.
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <label className="form-label fw-medium text-secondary">Additional Production Cost (Labor / Packaging / Fuel) ৳</label>
                      <div className="input-group">
                        <span className="input-group-text">৳</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-control"
                          value={extraCost}
                          onChange={(e) => setExtraCost(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-medium text-secondary">Additional Cost Description</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. 150 Plastic Bottles + Labor charges"
                        value={extraCostNote}
                        onChange={(e) => setExtraCostNote(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Dynamic Cost Calculator Box */}
                  <div className="card border-0 rounded-4 p-3 mb-3" style={{ background: "linear-gradient(135deg, rgba(13, 110, 253, 0.08), rgba(16, 185, 129, 0.08))", border: "1px solid rgba(13, 110, 253, 0.2)" }}>
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="fw-bold text-dark"><i className="bi bi-calculator me-1"></i> {lang === "bn" ? "উৎপাদন খরচের হিসাব ও বিশ্লেষণ:" : "Cost Breakdown & Calculation:"}</span>
                      <span className="badge bg-primary px-3 py-1">Auto-Derived</span>
                    </div>

                    <div className="row g-2 small text-secondary">
                      <div className="col-6">{lang === "bn" ? "মোট কাঁচামাল খরচ:" : "Total Raw Material Cost:"}</div>
                      <div className="col-6 text-end fw-bold text-dark">৳{Number(completeBatch.total_material_cost).toFixed(2)}</div>

                      <div className="col-6">{lang === "bn" ? "অতিরিক্ত খরচ:" : "Additional Costs:"}</div>
                      <div className="col-6 text-end fw-bold text-dark">+ ৳{(Number(extraCost) || 0).toFixed(2)}</div>

                      <div className="col-6 border-top pt-1 text-dark fw-bold">{lang === "bn" ? "সর্বমোট ব্যাচ খরচ:" : "Total Batch Cost:"}</div>
                      <div className="col-6 border-top pt-1 text-end text-dark fw-bold">
                        ৳{(Number(completeBatch.total_material_cost) + (Number(extraCost) || 0)).toFixed(2)}
                      </div>

                      <div className="col-6 text-dark fw-bold">{lang === "bn" ? "মোট উৎপাদিত ইউনিট:" : "Total Finished Units:"}</div>
                      <div className="col-6 text-end text-dark fw-bold">÷ {Number(outQty) || 0} Units</div>
                    </div>

                    <hr className="my-2" />

                    <div className="d-flex align-items-center justify-content-between">
                      <div>
                        <span className="d-block small text-secondary">{lang === "bn" ? "ইউনিট প্রতি উৎপাদন খরচ:" : "Calculated Unit Cost Price:"}</span>
                        <h4 className="fw-bold text-success mb-0">৳{liveCalculatedCost} <span className="fs-6 fw-normal text-secondary">/ {selectedOutputProduct?.unit_detail?.name || "Unit"}</span></h4>
                      </div>
                      {selectedOutputProduct && Number(selectedOutputProduct.selling_price) > 0 && (
                        <div className="text-end">
                          <span className="d-block small text-secondary">{lang === "bn" ? "বিক্রয় মূল্য:" : "Selling Price:"} ৳{selectedOutputProduct.selling_price}</span>
                          <span className="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25 px-2 py-1">
                            Margin: ৳{(Number(selectedOutputProduct.selling_price) - Number(liveCalculatedCost)).toFixed(2)} ({((Number(selectedOutputProduct.selling_price) - Number(liveCalculatedCost)) / Number(selectedOutputProduct.selling_price) * 100).toFixed(1)}%)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="form-check form-switch mb-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="updateCostPriceCheck"
                      checked={updateCostPrice}
                      onChange={(e) => setUpdateCostPrice(e.target.checked)}
                    />
                    <label className="form-check-label small fw-medium" htmlFor="updateCostPriceCheck">
                      Update this product's catalog Cost Price to ৳{liveCalculatedCost}
                    </label>
                  </div>
                </div>

                <div className="modal-footer bg-light border-top p-3">
                  <button type="button" className="btn btn-outline-secondary rounded-pill px-4" onClick={() => setCompleteBatch(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-success rounded-pill px-4 shadow-sm" disabled={busy || !Number(outQty)}>
                    {busy ? (lang === "bn" ? "প্রসেস হচ্ছে..." : "Finalizing...") : (lang === "bn" ? "কনফার্ম করুন ও স্টকে যোগ করুন" : "Confirm & Credit Stock")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Batch Details Modal */}
      {viewBatch && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header bg-primary bg-opacity-10 border-bottom border-primary border-opacity-25 py-3">
                <h5 className="modal-title fw-bold text-primary d-flex align-items-center gap-2">
                  <i className="bi bi-card-checklist"></i> Production Batch Details #{viewBatch.batch_number}
                </h5>
                <button type="button" className="btn-close" onClick={() => setViewBatch(null)}></button>
              </div>

              <div className="modal-body p-4">
                <div className="row g-3 mb-4">
                  <div className="col-md-3">
                    <div className="p-3 rounded-3 bg-light">
                      <span className="text-secondary small d-block">Status</span>
                      <strong className="text-capitalize">{viewBatch.status.replace("_", " ")}</strong>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="p-3 rounded-3 bg-light">
                      <span className="text-secondary small d-block">Started At</span>
                      <strong>{fmtDate(viewBatch.started_at)}</strong>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="p-3 rounded-3 bg-light">
                      <span className="text-secondary small d-block">Total Cost</span>
                      <strong className="text-primary">৳{Number(viewBatch.total_cost || viewBatch.total_material_cost).toFixed(2)}</strong>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="p-3 rounded-3 bg-light">
                      <span className="text-secondary small d-block">Output Yield</span>
                      <strong className="text-success">{viewBatch.status === "completed" ? `${Number(viewBatch.output_quantity)} Units` : "Pending"}</strong>
                    </div>
                  </div>
                </div>

                <h6 className="fw-bold mb-2 text-dark"><i className="bi bi-box-arrow-down text-danger me-1"></i> Raw Materials Deducted from Inventory:</h6>
                <div className="table-responsive rounded-3 border mb-4">
                  <table className="table table-sm table-striped align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Material</th>
                        <th>SKU</th>
                        <th>Quantity Used</th>
                        <th>Unit Cost (Snapshot)</th>
                        <th className="text-end">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewBatch.materials.map((m) => (
                        <tr key={m.id}>
                          <td className="fw-semibold">{m.product_name}</td>
                          <td className="font-monospace small text-secondary">{m.product_sku || "—"}</td>
                          <td>{Number(m.quantity)} {m.unit_name || "Unit"}</td>
                          <td>৳{Number(m.unit_cost).toFixed(2)}</td>
                          <td className="text-end fw-bold">৳{Number(m.subtotal).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="table-light">
                      <tr>
                        <td colSpan={4} className="fw-bold text-end">Total Material Cost:</td>
                        <td className="fw-bold text-end text-primary">৳{Number(viewBatch.total_material_cost).toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {viewBatch.status === "completed" && (
                  <>
                    <h6 className="fw-bold mb-2 text-dark"><i className="bi bi-box-arrow-up text-success me-1"></i> Finished Production Output:</h6>
                    <div className="p-3 rounded-3 bg-success bg-opacity-10 border border-success border-opacity-25 mb-3">
                      <div className="row g-2">
                        <div className="col-md-6">
                          <span className="text-secondary small d-block">Product:</span>
                          <strong className="text-dark fs-5">{viewBatch.output_product_name}</strong>
                          <span className="text-secondary small d-block">SKU: {viewBatch.output_product_sku || "N/A"}</span>
                        </div>
                        <div className="col-md-3">
                          <span className="text-secondary small d-block">Quantity Produced:</span>
                          <strong className="text-success fs-5">{Number(viewBatch.output_quantity)} {viewBatch.output_unit_name || "Units"}</strong>
                        </div>
                        <div className="col-md-3">
                          <span className="text-secondary small d-block">Calculated Unit Cost:</span>
                          <strong className="text-success fs-5">৳{Number(viewBatch.calculated_unit_cost).toFixed(2)}</strong>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {viewBatch.notes && (
                  <div className="p-3 bg-light rounded-3">
                    <span className="text-secondary small d-block fw-bold mb-1">Notes / Logs:</span>
                    <p className="mb-0 small text-body">{viewBatch.notes}</p>
                  </div>
                )}
              </div>

              <div className="modal-footer bg-light border-top p-3">
                <button type="button" className="btn btn-secondary rounded-pill px-4" onClick={() => setViewBatch(null)}>
                  {lang === "bn" ? "বন্ধ করুন" : "Close"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
