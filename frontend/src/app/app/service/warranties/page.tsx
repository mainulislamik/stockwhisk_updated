"use client";

import { useEffect, useState } from "react";
import { useApi, Paginated } from "@/lib/api";
import { ErrorState, Pagination, Spinner, fmtDate, usePagination } from "@/components/ui";
import { useLanguage } from "@/contexts/LanguageContext";

type Warranty = {
  id: number;
  product_name: string;
  customer_name: string | null;
  serial_no: string;
  period_months: number;
  start_date: string;
  expiry_date: string;
  status: string;
};

type Product = {
  id: number;
  name: string;
  sku: string;
  warranty_months: number;
  count: number;
};
type WarrantyGroup = { product_id: number; product_name: string; sku: string; warranty_months: number; count: number };

const statusBadge: Record<string, string> = {
  active: "text-bg-success",
  expiring_soon: "text-bg-warning",
  expired: "text-bg-secondary",
  claimed: "text-bg-info",
  void: "text-bg-dark",
};

export default function WarrantiesPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"products" | "issued">("products");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [pageW, setPageW] = useState(1);

  // Read URL search params on mount
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      const status = params.get("status");
      if (tab === "issued" || status) {
        setActiveTab("issued");
      }
      if (status) {
        setStatusFilter(status);
      }
    } catch {}
  }, []);

  // Debounce the filter into the server `search` param (issued tab) + reset page.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(filter.trim()); setPageW(1); }, 350);
    return () => clearTimeout(t);
  }, [filter]);

  // Warrantied products: one aggregate call (bounded by distinct products).
  const { data: groups, loading: loadingP, error: errorP } = useApi<WarrantyGroup[]>("/catalog/product-units/warranty-groups/");
  const products: Product[] = (groups || []).map((g) => ({
    id: g.product_id, name: g.product_name, sku: g.sku, warranty_months: g.warranty_months, count: g.count,
  }));
  const shownProducts = products.filter((p) => {
    const q = filter.trim().toLowerCase();
    return !q || `${p.name} ${p.sku}`.toLowerCase().includes(q);
  });
  const { paged: pagedProducts, page: pageP, setPage: setPageP, totalPages: totalPagesP, total: totalP } = usePagination(shownProducts, [filter, activeTab]);

  // Coverage records: server-side paginated (only the current page is fetched).
  const PAGE_SIZE = 20;
  const { data: wData, loading: loadingW, error: errorW } = useApi<Paginated<Warranty>>("/service/warranties/", { 
    page: pageW, 
    page_size: PAGE_SIZE, 
    search,
    status: statusFilter || undefined,
  });
  const pagedWarranties = wData?.results || [];
  const totalW = wData?.count || 0;
  const totalPagesW = Math.max(1, Math.ceil(totalW / PAGE_SIZE));

  const loading = activeTab === "products" ? loadingP : loadingW;
  const error = activeTab === "products" ? errorP : errorW;
  if (loading) return <Spinner label={t("war_loading")} />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="vstack gap-3">
      {/* Modernized Header & Tabs */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
        <div className="nav nav-pills p-1 bg-light rounded-3" style={{ width: "fit-content" }}>
          <button 
            className={`nav-link border-0 rounded-2 ${activeTab === "products" ? "active shadow-sm fw-semibold" : "text-dark"}`} 
            onClick={() => { setActiveTab("products"); setFilter(""); }}
          >
            <i className="bi bi-box-seam me-2"></i>{t("war_tab_products")}
          </button>
          <button 
            className={`nav-link border-0 rounded-2 ${activeTab === "issued" ? "active shadow-sm fw-semibold" : "text-dark"}`} 
            onClick={() => { setActiveTab("issued"); setFilter(""); }}
          >
            <i className="bi bi-shield-check me-2"></i>{t("war_tab_issued")}
          </button>
        </div>
        
        <input 
          placeholder={activeTab === "products" ? t("war_filter_prod") : t("war_filter_rec")} 
          className="form-control form-control-sm rounded-pill px-3 shadow-sm border-0" 
          style={{ maxWidth: "22rem" }} 
          value={filter} 
          onChange={(e) => setFilter(e.target.value)} 
        />
      </div>

      {activeTab === "issued" && (
        <div className="d-flex flex-wrap align-items-center gap-2 pt-1">
          <span className="small text-secondary fw-semibold me-1">Status:</span>
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-1 ${!statusFilter ? "btn-dark shadow-sm" : "btn-light border text-secondary"}`}
            onClick={() => { setStatusFilter(""); setPageW(1); }}
          >
            {t("war_status_all")}
          </button>
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-1 ${statusFilter === "expiring_soon" ? "btn-warning text-dark shadow-sm fw-semibold" : "btn-light border text-secondary"}`}
            onClick={() => { setStatusFilter("expiring_soon"); setPageW(1); }}
          >
            ⏳ {t("war_status_expiring")}
          </button>
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-1 ${statusFilter === "active" ? "btn-success shadow-sm" : "btn-light border text-secondary"}`}
            onClick={() => { setStatusFilter("active"); setPageW(1); }}
          >
            ✓ {t("war_status_active")}
          </button>
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-1 ${statusFilter === "expired" ? "btn-secondary shadow-sm" : "btn-light border text-secondary"}`}
            onClick={() => { setStatusFilter("expired"); setPageW(1); }}
          >
            {t("war_status_expired")}
          </button>
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-1 ${statusFilter === "claimed" ? "btn-info shadow-sm" : "btn-light border text-secondary"}`}
            onClick={() => { setStatusFilter("claimed"); setPageW(1); }}
          >
            {t("war_status_claimed")}
          </button>
        </div>
      )}

      <div className="card shadow-sm border-0 rounded-4 overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover table-borderless align-middle mb-0">
            <thead className="table-light border-bottom">
              {activeTab === "products" ? (
                <tr>
                  <th className="ps-4 py-3">{t("war_col_prod_name")}</th>
                  <th className="py-3">{t("war_col_sku")}</th>
                  <th className="py-3 text-center">{t("war_col_period")}</th>
                  <th className="pe-4 py-3 text-end">{t("war_col_stock")}</th>
                </tr>
              ) : (
                <tr>
                  <th className="ps-4 py-3">{t("war_col_prod")}</th>
                  <th className="py-3">{t("war_col_serial")}</th>
                  <th className="py-3">{t("war_col_customer")}</th>
                  <th className="py-3">{t("war_col_start")}</th>
                  <th className="py-3">{t("war_col_expiry")}</th>
                  <th className="pe-4 py-3">{t("war_col_status")}</th>
                </tr>
              )}
            </thead>
            <tbody>
              {activeTab === "products" ? (
                shownProducts.length === 0 ? (
                  <tr data-empty="">
                    <td colSpan={4} className="text-center text-secondary py-5">
                      <div className="display-4 mb-3">🛍️</div>
                      <h5>{t("war_no_prod_title")}</h5>
                      <p className="text-muted">{t("war_no_prod_desc")}</p>
                    </td>
                  </tr>
                ) : (
                  pagedProducts.map((p) => (
                    <tr key={`${p.id}-${p.warranty_months}`} className="border-bottom">
                      <td className="ps-4 fw-medium">{p.name}</td>
                      <td className="text-secondary">{p.sku || "—"}</td>
                      <td className="text-center">
                        <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-2">
                          {p.warranty_months} {p.warranty_months === 1 ? t("war_month") : t("war_months")}
                        </span>
                      </td>
                      <td className="pe-4 text-end fw-semibold">{p.count} {p.count === 1 ? t("war_unit") : t("war_units")}</td>
                    </tr>
                  ))
                )
              ) : (
                pagedWarranties.length === 0 ? (
                  <tr data-empty="">
                    <td colSpan={6} className="text-center text-secondary py-5">
                      <div className="display-4 mb-3">{statusFilter === "expiring_soon" ? "🎉" : "🛡️"}</div>
                      <h5>{statusFilter === "expiring_soon" ? (t("dash_no_expiring_war") || "No warranties expiring soon") : t("war_no_rec_title")}</h5>
                      <p className="text-muted">
                        {statusFilter === "expiring_soon"
                          ? "There are currently no product warranties expiring within the next 30 days."
                          : t("war_no_rec_desc")}
                      </p>
                    </td>
                  </tr>
                ) : (
                  pagedWarranties.map((w) => (
                    <tr key={w.id} className="border-bottom">
                      <td className="ps-4 fw-medium">{w.product_name}</td>
                      <td className="text-secondary">{w.serial_no || "—"}</td>
                      <td className="text-secondary">{w.customer_name || "—"}</td>
                      <td className="text-secondary">{fmtDate(w.start_date)}</td>
                      <td className="text-secondary">{fmtDate(w.expiry_date)}</td>
                      <td className="pe-4">
                        <span className={`badge ${statusBadge[w.status] || "text-bg-light"} rounded-pill px-2 py-1`}>{w.status.replace("_", " ")}</span>
                      </td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
        {activeTab === "products" ? (
           <Pagination page={pageP} totalPages={totalPagesP} setPage={setPageP} total={totalP} />
        ) : (
           <Pagination page={pageW} totalPages={totalPagesW} setPage={setPageW} total={totalW} />
        )}
      </div>
    </div>
  );
}
