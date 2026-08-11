"use client";

import { useEffect, useState } from "react";
import { api, fetchAll } from "@/lib/api";
import { ErrorState, Pagination, Spinner, fmtDate, usePagination } from "@/components/ui";

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
  const [activeTab, setActiveTab] = useState<"products" | "issued">("products");
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [wList, groups] = await Promise.all([
          fetchAll<Warranty>("/service/warranties/"),
          api<WarrantyGroup[]>("/catalog/product-units/warranty-groups/").catch(() => []),
        ]);
        setWarranties(wList);
        setProducts((groups || []).map((g) => ({
          id: g.product_id, name: g.product_name, sku: g.sku,
          warranty_months: g.warranty_months, count: g.count,
        })));
      } catch (e: any) {
        setError(e?.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const shownWarranties = warranties.filter((w) => {
    const q = filter.trim().toLowerCase();
    return !q || `${w.product_name} ${w.serial_no} ${w.customer_name || ""}`.toLowerCase().includes(q);
  });
  const { paged: pagedWarranties, page: pageW, setPage: setPageW, totalPages: totalPagesW, total: totalW } = usePagination(shownWarranties, [filter, activeTab]);

  const shownProducts = products.filter((p) => {
    const q = filter.trim().toLowerCase();
    return !q || `${p.name} ${p.sku}`.toLowerCase().includes(q);
  });
  const { paged: pagedProducts, page: pageP, setPage: setPageP, totalPages: totalPagesP, total: totalP } = usePagination(shownProducts, [filter, activeTab]);

  if (loading) return <Spinner label="Loading warranty data…" />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="vstack gap-4">
      {/* Modernized Header & Tabs */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
        <div className="nav nav-pills p-1 bg-light rounded-3" style={{ width: "fit-content" }}>
          <button 
            className={`nav-link border-0 rounded-2 ${activeTab === "products" ? "active shadow-sm fw-semibold" : "text-dark"}`} 
            onClick={() => { setActiveTab("products"); setFilter(""); }}
          >
            <i className="bi bi-box-seam me-2"></i>Warrantied Products
          </button>
          <button 
            className={`nav-link border-0 rounded-2 ${activeTab === "issued" ? "active shadow-sm fw-semibold" : "text-dark"}`} 
            onClick={() => { setActiveTab("issued"); setFilter(""); }}
          >
            <i className="bi bi-shield-check me-2"></i>Coverage Records
          </button>
        </div>
        
        <input 
          placeholder={activeTab === "products" ? "Filter products/sku…" : "Filter product/serial/customer…"} 
          className="form-control form-control-sm rounded-pill px-3 shadow-sm border-0" 
          style={{ maxWidth: "22rem" }} 
          value={filter} 
          onChange={(e) => setFilter(e.target.value)} 
        />
      </div>

      <div className="card shadow-sm border-0 rounded-4 overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover table-borderless align-middle mb-0">
            <thead className="table-light border-bottom">
              {activeTab === "products" ? (
                <tr>
                  <th className="ps-4 py-3">Product Name</th>
                  <th className="py-3">SKU</th>
                  <th className="py-3 text-center">Warranty Period</th>
                  <th className="pe-4 py-3 text-end">In-Stock Units</th>
                </tr>
              ) : (
                <tr>
                  <th className="ps-4 py-3">Product</th>
                  <th className="py-3">Serial</th>
                  <th className="py-3">Customer</th>
                  <th className="py-3">Start</th>
                  <th className="py-3">Expiry</th>
                  <th className="pe-4 py-3">Status</th>
                </tr>
              )}
            </thead>
            <tbody>
              {activeTab === "products" ? (
                shownProducts.length === 0 ? (
                  <tr data-empty="">
                    <td colSpan={4} className="text-center text-secondary py-5">
                      <div className="display-4 mb-3">🛍️</div>
                      <h5>No products with warranty</h5>
                      <p className="text-muted">Edit products in your catalog to add warranty periods.</p>
                    </td>
                  </tr>
                ) : (
                  pagedProducts.map((p) => (
                    <tr key={`${p.id}-${p.warranty_months}`} className="border-bottom">
                      <td className="ps-4 fw-medium">{p.name}</td>
                      <td className="text-secondary">{p.sku || "—"}</td>
                      <td className="text-center">
                        <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-2">
                          {p.warranty_months} {p.warranty_months === 1 ? 'Month' : 'Months'}
                        </span>
                      </td>
                      <td className="pe-4 text-end fw-semibold">{p.count} unit{p.count === 1 ? "" : "s"}</td>
                    </tr>
                  ))
                )
              ) : (
                shownWarranties.length === 0 ? (
                  <tr data-empty="">
                    <td colSpan={6} className="text-center text-secondary py-5">
                      <div className="display-4 mb-3">🛡️</div>
                      <h5>No warranties recorded</h5>
                      <p className="text-muted">Sell products via POS to automatically record warranty coverage.</p>
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
