"use client";

import toast from "react-hot-toast";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, ErrorState, Pagination, Spinner, money, fmtDate, usePagination } from "@/components/ui";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/components/AuthProvider";

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
  const { t } = useLanguage();
  const { user } = useAuth();
  const isRepairShop = !!user?.shop_mobile_repair_enabled;
  const [brandStock, setBrandStock] = useState<any[]>([]);
  const [inv, setInv] = useState<InvSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Stock movements: server-side paginated (only the current page is fetched).
  const [moveData, setMoveData] = useState<{ count: number; next: string | null; previous: string | null; results: Movement[] } | null>(null);
  const [movePageNo, setMovePageNo] = useState(1);
  const [movLoading, setMovLoading] = useState(true);
  const [movTick, setMovTick] = useState(0);
  const [showWastageModal, setShowWastageModal] = useState(false);
  const [wasteProdList, setWasteProdList] = useState<any[]>([]);
  const [wasteSelectedProd, setWasteSelectedProd] = useState<any>(null);
  const [wasteQty, setWasteQty] = useState("");
  const [wasteReason, setWasteReason] = useState("rotten");
  const [wasteNote, setWasteNote] = useState("");
  const [wasteSaving, setWasteSaving] = useState(false);

    async function openWastageModal() {
    setShowWastageModal(true);
    setWasteQty("");
    setWasteNote("");
    try {
      const res = await api<any>("/catalog/products/?page_size=200&light=1");
      setWasteProdList(res.results || res || []);
    } catch {}
  }

  async function handleWastageSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!wasteSelectedProd) { toast.error("পণ্য নির্বাচন করুন"); return; }
    const q = Number(wasteQty);
    if (!q || q <= 0) { toast.error("সঠিক পরিমাণ লিখুন"); return; }

    const reasonLabels: Record<string, string> = {
      rotten: "পচে যাওয়া / পচনশীল নষ্ট",
      expired: "মেয়াদোত্তীর্ণ (Expired)",
      broken: "ভেঙে যাওয়া / ক্ষতিগ্রস্ত (Damaged)",
      pest: "পোকা বা ইঁদুরে নষ্ট (Pest/Rodent)",
      other: "অন্যান্য ক্ষতি"
    };

    setWasteSaving(true);
    try {
      await api("/inventory/movements/adjust/", {
        method: "POST",
        body: {
          product: wasteSelectedProd.id,
          movement_type: "damage_out",
          quantity: q,
          unit_cost: Number(wasteSelectedProd.cost_price || 0),
          note: `[ডেইলি ওয়েস্টেজ: ${reasonLabels[wasteReason] || wasteReason}] ${wasteNote}`.trim(),
        }
      });
      toast.success("ওয়েস্টেজ / নষ্ট পণ্যের হিসাব সংরক্ষিত হয়েছে!");
      setShowWastageModal(false);
      setWasteSelectedProd(null);
      setWasteQty("");
      setWasteNote("");
      load();
      setMovTick(t => t + 1);
    } catch (err: any) {
      toast.error(err?.message || "ওয়েস্টেজ এন্ট্রি ব্যর্থ হয়েছে");
    } finally {
      setWasteSaving(false);
    }
  }

  async function load() {
    if (isRepairShop) {
      api<any>("/catalog/products/?light=1&page_size=100").then((res) => {
        const prods = res.results || res || [];
        const map: Record<string, { brand: string; count: number; stock: number; value: number }> = {};
        prods.forEach((p: any) => {
          const bName = p.brand_name || p.brand_detail?.name || p.brand?.name || (p.name.includes("SAMSUNG") ? "SAMSUNG" : p.name.includes("OPPO") ? "OPPO" : "Other");
          if (!map[bName]) map[bName] = { brand: bName, count: 0, stock: 0, value: 0 };
          map[bName].count += 1;
          const s = Number(p.current_stock) || 0;
          map[bName].stock += s;
          map[bName].value += s * (Number(p.cost_price) || 0);
        });
        setBrandStock(Object.values(map));
      }).catch(() => {});
    }
    setLoading(true);
    try {
      const i = await api<InvSummary>("/analytics/inventory/");
      setInv(i);
    } catch (e: any) {
      setError(e?.message || t("inv_err_load"));
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

  const lowStock = usePagination(inv?.low_stock ?? []);
  const outStock = usePagination(inv?.out_of_stock ?? []);
  const moves = moveData?.results ?? [];
  const moveTotalPages = Math.max(1, Math.ceil((moveData?.count ?? 0) / 25));

  if (loading) return <Spinner label={t("inv_loading")} />;
  if (error) return <ErrorState error={error} />;
  if (!inv) return null;

  return (
    <div className="vstack gap-3">
      <div className="row g-3">
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">{t("inv_val")}</div>
            <div className="fs-4 fw-bold">{money(inv.stock_value)}</div>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">{t("inv_low")}</div>
            <div className="fs-4 fw-bold text-warning">{inv.low_stock.length}</div>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">{t("inv_out")}</div>
            <div className="fs-4 fw-bold text-danger">{inv.out_of_stock.length}</div>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">{t("inv_cat")}</div>
            <div className="fs-4 fw-bold">{inv.by_category.length}</div>
          </Card>
        </div>
      </div>



      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="fw-semibold mb-3">{t("inv_low")}</div>
              <div className="table-responsive">
                <table className="table table-striped table-sm mb-0">
                  <thead className="thead-5">
                    <tr>
                      <th>{t("inv_low_col_prod")}</th>
                      <th className="text-end">{t("inv_low_col_stock")}</th>
                      <th className="text-end">{t("inv_low_col_reorder")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inv.low_stock.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-secondary">{t("inv_low_all_good")}</td>
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
              <div className="fw-semibold mb-3">{t("inv_out")}</div>
              <div className="table-responsive">
                <table className="table table-striped table-sm mb-0">
                  <thead className="thead-1">
                    <tr>
                      <th>{t("inv_low_col_prod")}</th>
                      <th className="text-end">{t("inv_low_col_stock")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inv.out_of_stock.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="text-secondary">{t("inv_low_all_good")}</td>
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
          <div className="fw-semibold mb-3">{t("inv_mov_title")}</div>
          <div className="table-responsive position-relative">
            {movLoading && (
              <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ background: "rgba(255,255,255,.5)", zIndex: 2 }}>
                <Spinner label={t("inv_mov_loading")} />
              </div>
            )}
            <table className="table table-striped table-sm mb-0">
              <thead className="thead-6">
                <tr>
                  <th>{t("inv_mov_col_date")}</th>
                  <th>{t("inv_mov_col_prod")}</th>
                  <th>{t("inv_mov_col_type")}</th>
                  <th className="text-end">{t("inv_mov_col_qty")}</th>
                  <th>{t("inv_mov_col_note")}</th>
                </tr>
              </thead>
              <tbody>
                {moves.length === 0 && !movLoading ? (
                  <tr data-empty="">
                    <td colSpan={5} className="text-center text-secondary py-4">{t("inv_mov_no_mov")}</td>
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
            <span className="small text-secondary">{t("inv_mov_page", { count: moveData?.count ?? 0, page: movePageNo, total: moveTotalPages })}</span>
            <div className="btn-group btn-group-sm">
              <button className="btn btn-outline-secondary" disabled={movLoading || !moveData?.previous} onClick={() => setMovePageNo(1)}>«</button>
              <button className="btn btn-outline-secondary" disabled={movLoading || !moveData?.previous} onClick={() => setMovePageNo((p) => Math.max(1, p - 1))}>{t("inv_mov_prev")}</button>
              <button className="btn btn-outline-secondary" disabled={movLoading || !moveData?.next} onClick={() => setMovePageNo((p) => p + 1)}>{t("inv_mov_next")}</button>
              <button className="btn btn-outline-secondary" disabled={movLoading || !moveData?.next} onClick={() => setMovePageNo(moveTotalPages)}>»</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Wastage / Spoilage Modal ── */}
      {showWastageModal && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden">
              <div className="modal-header bg-danger text-white py-3">
                <h5 className="modal-title h6 fw-bold d-flex align-items-center gap-2">
                  <i className="bi bi-trash3-fill"></i>
                  <span>পচনশীল ও নষ্ট পণ্যের ওয়েস্টেজ এন্ট্রি (Wastage Log)</span>
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowWastageModal(false)} />
              </div>
              <form onSubmit={handleWastageSubmit}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-bold text-dark">১. নষ্ট হওয়া পণ্য নির্বাচন করুন <span className="text-danger">*</span></label>
                    <select
                      className="form-select"
                      required
                      value={wasteSelectedProd?.id || ""}
                      onChange={(e) => {
                        const found = wasteProdList.find(p => String(p.id) === e.target.value);
                        setWasteSelectedProd(found || null);
                      }}
                    >
                      <option value="">-- পণ্য নির্বাচন করুন --</option>
                      {wasteProdList.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} (বর্তমান স্টক: {p.current_stock} {p.unit_name || p.unit?.name || "একক"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-dark">২. নষ্টের পরিমাণ <span className="text-danger">*</span></label>
                      <div className="input-group">
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          required
                          className="form-control"
                          placeholder="যেমন: 2.5 বা 1"
                          value={wasteQty}
                          onChange={(e) => setWasteQty(e.target.value)}
                        />
                        <span className="input-group-text bg-light text-secondary">
                          {wasteSelectedProd?.unit_name || wasteSelectedProd?.unit?.name || "Unit"}
                        </span>
                      </div>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-dark">৩. নষ্ট হওয়ার কারণ</label>
                      <select
                        className="form-select"
                        value={wasteReason}
                        onChange={(e) => setWasteReason(e.target.value)}
                      >
                        <option value="rotten">🥦 পচে যাওয়া / পচনশীল নষ্ট</option>
                        <option value="expired">📅 মেয়াদোত্তীর্ণ (Expired)</option>
                        <option value="broken">🥚 ভেঙে যাওয়া / ক্ষতিগ্রস্ত</option>
                        <option value="pest">🐭 ইঁদুর বা পোকায় নষ্ট</option>
                        <option value="other">📝 অন্যান্য কারণ</option>
                      </select>
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="form-label small fw-medium text-secondary">অতিরিক্ত নোট (ঐচ্ছিক)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="যেমন: ৩ নম্বর বক্সে পচা পাওয়া গেছে"
                      value={wasteNote}
                      onChange={(e) => setWasteNote(e.target.value)}
                    />
                  </div>

                  <div className="p-2.5 bg-danger bg-opacity-10 border border-danger border-opacity-25 rounded-3 text-danger small mt-3">
                    <i className="bi bi-exclamation-triangle-fill me-1"></i>
                    এই এন্ট্রিটি করার সাথে সাথে উক্ত পরিমাণ স্টক থেকে বিয়োগ হবে এবং দিনশেষে ফাইন্যান্সিয়াল লস হিসেবে লগে যুক্ত হবে।
                  </div>
                </div>
                <div className="modal-footer bg-light border-top py-2.5">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowWastageModal(false)}>
                    বাতিল
                  </button>
                  <button type="submit" className="btn btn-danger btn-sm fw-bold px-3" disabled={wasteSaving}>
                    {wasteSaving ? "সংরক্ষণ হচ্ছে…" : "ওয়েস্টেজ কনফার্ম করুন"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
