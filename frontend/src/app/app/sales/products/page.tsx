"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ErrorState, Spinner, money } from "@/components/ui";
import { useLanguage } from "@/contexts/LanguageContext";

type Top = { product_id: number; product__name: string; product__current_stock: number; qty: number; revenue: number; profit: number };

export default function SoldProductsPage() {
  const { t } = useLanguage();
  const [rows, setRows] = useState<Top[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setRows((await api<Top[]>("/analytics/top-products/", { params: { limit: 200 } })) || []);
      } catch (e: any) {
        setError(e?.message || t("err_load_sold_products"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const shown = rows.filter((r) => !filter.trim() || r.product__name.toLowerCase().includes(filter.toLowerCase()));

  if (loading) return <Spinner label={t("loading_sold_products")} />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="vstack gap-3">
      <input placeholder={t("filter_product")} className="form-control form-control-sm" style={{ maxWidth: "18rem" }} value={filter} onChange={(e) => setFilter(e.target.value)} />
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-striped table-sm align-middle mb-0">
            <thead className="thead-3">
              <tr>
                <th>{t("col_product")}</th>
                <th className="text-end">{t("col_qty_sold")}</th>
                <th className="text-end">{t("col_unsold_stock")}</th>
                <th className="text-end">{t("col_revenue")}</th>
                <th className="text-end">{t("col_profit")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr data-empty="">
                  <td colSpan={5} className="text-center text-secondary py-5">{t("no_sales_yet")}</td>
                </tr>
              ) : (
                shown.map((r) => (
                  <tr key={r.product_id}>
                    <td className="fw-medium">{r.product__name}</td>
                    <td className="text-end">{Number(r.qty)}</td>
                    <td className="text-end">{Number(r.product__current_stock || 0)}</td>
                    <td className="text-end">{money(r.revenue)}</td>
                    <td className="text-end text-success">{money(r.profit)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
