"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, ErrorState, Pagination, Spinner, money, fmtDate, usePagination } from "@/components/ui";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const [inv, setInv] = useState<InvSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Stock movements: server-side paginated (only the current page is fetched).
  const [moveData, setMoveData] = useState<{ count: number; next: string | null; previous: string | null; results: Movement[] } | null>(null);
  const [movePageNo, setMovePageNo] = useState(1);
  const [movLoading, setMovLoading] = useState(true);
  const [movTick, setMovTick] = useState(0);

  async function load() {
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
    </div>
  );
}
