"use client";

import { confirmAction, showError, showSuccess, showInfo } from "@/lib/dialogs";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, fetchAll, useApi, Paginated } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { ErrorState, Pagination, Spinner } from "@/components/ui";
import toast from "react-hot-toast";
import { useLanguage } from "@/contexts/LanguageContext";

type Product = {
  id: number;
  name: string;
  sku: string;
  barcode: string;
  category: number | null;
  brand: number | null;
  cost_price: string;
  selling_price: string;
  current_stock: string;
  is_low_stock: boolean;
  is_active: boolean;
  track_inventory?: boolean;
};
type Named = { id: number; name: string };

export default function ProductsPage() {
  const { user, can, isOwner } = useAuth();
  const isCosmetics = user?.shop_business_type === "cosmetics";
  const isSpecialShop = user?.shop_business_type === "camical" || user?.shop_business_type === "supershop" || user?.shop_business_type === "cosmetics";
  const { t, lang } = useLanguage();

  const canManage = isOwner || can("manage_products");
  const [categories, setCategories] = useState<Named[]>([]);
  const [brands, setBrands] = useState<Named[]>([]);
  const [units, setUnits] = useState<Named[]>([]);
  const [filter, setFilter] = useState("");
  const [debouncedFilter, setDebouncedFilter] = useState("");
  const [page, setPage] = useState(1);

  // Debounce filter for server-side search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFilter(filter), 300);
    return () => clearTimeout(timer);
  }, [filter]);

  // Reset page to 1 when search changes
  useEffect(() => { setPage(1); }, [debouncedFilter]);

  // Server-side fetching via SWR
  const PAGE_SIZE = 20;
  // light=1 → skip each product's in-stock units in the payload (the list only
  // needs product fields), so a shop with thousands of units still loads fast.
  const { data, loading, error, mutate } = useApi<Paginated<Product>>("/catalog/products/", { search: debouncedFilter, page, page_size: PAGE_SIZE, ordering: "-current_stock", light: 1 });
  const products = data?.results || [];
  const total = data?.count || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<any>({ name: "", sku: "", barcode: "", category: "", brand: "", unit: "", purchase_unit: "", purchase_multiplier: "1", full_pack_cost: "", cost_price: "", selling_price: "", reorder_level: "", warranty_months: "", replacement_guarantee_days: "" });
  const [saving, setSaving] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [newBrand, setNewBrand] = useState("");

  // Load small dictionaries once
  useEffect(() => {
    fetchAll<Named>("/catalog/categories/").then(setCategories).catch(() => {});
    fetchAll<Named>("/catalog/brands/").then(setBrands).catch(() => {});
    fetchAll<Named>("/catalog/units/").then(setUnits).catch(() => {});
  }, []);

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/catalog/products/", {
        method: "POST",
        body: {
          name: form.name,
          sku: form.sku || "",
          barcode: form.barcode || "",
          category: form.category || null,
          brand: form.brand || null,
          unit: form.unit || null,
          purchase_unit: form.purchase_unit || null,
          purchase_multiplier: form.purchase_multiplier !== "" ? Number(form.purchase_multiplier) : 1.0,
          cost_price: form.cost_price || 0,
          selling_price: form.selling_price || 0,
          reorder_level: form.reorder_level === "" ? 5 : Math.max(0, Math.round(Number(form.reorder_level) || 0)),
          warranty_months: form.warranty_months || 0,
          replacement_guarantee_days: form.replacement_guarantee_days || 0,
        },
      });
      setForm({ name: "", sku: "", barcode: "", category: "", brand: "", unit: "", purchase_unit: "", purchase_multiplier: "1", full_pack_cost: "", cost_price: "", selling_price: "", reorder_level: "", warranty_months: "", replacement_guarantee_days: "" });
      setShowAdd(false);
      mutate();
    } catch (e: any) {
      toast.error(e?.message || t("prod_err_save"));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(p: Product) {
    try {
      await api(`/catalog/products/${p.id}/`, { method: "PATCH", body: { is_active: !p.is_active } });
      mutate();
    } catch (e: any) {
      toast.error(e?.message || t("prod_err_update"));
    }
  }

  async function remove(p: Product) {
    if (!(await confirmAction(t("prod_confirm_delete", { name: p.name })))) return;
    try {
      await api(`/catalog/products/${p.id}/`, { method: "DELETE" });
      mutate();
    } catch (e: any) {
      toast.error(e?.message || t("prod_err_delete"));
    }
  }

  async function quickAdd(kind: "category" | "brand") {
    const name = kind === "category" ? newCat.trim() : newBrand.trim();
    if (!name) return;
    try {
      const created = await api(`/catalog/${kind === "category" ? "categories" : "brands"}/`, { method: "POST", body: { name } });
      if (kind === "category") { setCategories((c) => [...c, created]); setNewCat(""); }
      else { setBrands((b) => [...b, created]); setNewBrand(""); }
      setForm((f: any) => ({ ...f, [kind]: created.id }));
    } catch (e: any) {
      toast.error(e?.message || t("prod_err_add"));
    }
  }

  if (loading) return <Spinner label={t("prod_loading")} />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="vstack gap-3">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <input
          placeholder={t("prod_list_filter")}
          className="form-control form-control-sm"
          style={{ maxWidth: "18rem" }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {canManage && (
          <div className="d-flex gap-2">
            <button onClick={() => setShowAdd((s) => !s)} className="btn btn-outline-brand btn-sm">
              {t("prod_list_new")}
            </button>
            <Link href="/app/products/purchase" className="btn btn-brand btn-sm">
              {t("prod_list_purchase")}
            </Link>
          </div>
        )}
      </div>

      {showAdd && (
        <div className="card shadow-sm">
          <div className="card-body">
            <form onSubmit={saveProduct} className="row g-3">
              <div className="col-md-4">
                <label className="small">{t("prod_list_name")}</label>
                <input required className="form-control form-control-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="col-md-4">
                <label className="small">
                  {t("prod_list_sku")} <span className="text-secondary">{t("prod_list_auto")}</span>
                </label>
                <input placeholder={t("prod_list_auto_gen")} className="form-control form-control-sm" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>

              <div className="col-md-4">
                <label className="small">{t("prod_list_category")}</label>
                <select className="form-select form-select-sm mb-1" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">{t("prod_list_none")}</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="input-group input-group-sm">
                  <input className="form-control" placeholder={t("prod_list_new_cat")} value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), quickAdd("category"))} />
                  <button type="button" className="btn btn-outline-brand" onClick={() => quickAdd("category")}>{t("prod_list_add")}</button>
                </div>
              </div>
              <div className="col-md-2">
                <label className="small">{t("prod_list_brand")}</label>
                <select className="form-select form-select-sm mb-1" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}>
                  <option value="">{t("prod_list_none")}</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <div className="input-group input-group-sm">
                  <input className="form-control" placeholder={t("prod_list_new_brand")} value={newBrand} onChange={(e) => setNewBrand(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), quickAdd("brand"))} />
                  <button type="button" className="btn btn-outline-brand" onClick={() => quickAdd("brand")}>{t("prod_list_add")}</button>
                </div>
              </div>
              <div className="col-md-2">
                <label className="small">Sale Unit (Base)</label>
                <select className="form-select form-select-sm mb-1" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                  <option value="">(e.g., Liter/Kg/Pcs)</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>

              {isSpecialShop && (
                <>
                  <div className="col-md-2">
                    <label className="small">Purchase Unit</label>
                    <select className="form-select form-select-sm mb-1" value={form.purchase_unit} onChange={(e) => setForm({ ...form, purchase_unit: e.target.value })}>
                      <option value="">(e.g., Drum/Box)</option>
                      {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div className="col-md-2">
                    <label className="small">Liters/Kg per Drum</label>
                    <input type="number" step="0.01" min="1" className="form-control form-control-sm mb-1" 
                      value={form.purchase_multiplier} 
                      onChange={(e) => {
                        const newMult = e.target.value;
                        const multiplierVal = Number(newMult) || 1;
                        const packCost = Number(form.full_pack_cost) || 0;
                        const perUnitCost = (packCost / multiplierVal).toFixed(2);
                        
                        if (isSpecialShop && packCost > 0) {
                          setForm({ ...form, purchase_multiplier: newMult, cost_price: perUnitCost });
                        } else {
                          setForm({ ...form, purchase_multiplier: newMult });
                        }
                      }} 
                      title="Example: If 1 Drum contains 50 Liters, place 50 here. Place 1 if none." />
                  </div>
                </>
              )}

              
              {/* Added dynamic base unit name */}
              {(isSpecialShop && Number(form.purchase_multiplier) > 1) && (
                <div className="col-md-2">
                  <label className="small text-primary fw-medium">Full Drum/Box Cost</label>
                  <div className="input-group input-group-sm mb-1">
                    <span className="input-group-text">৳</span>
                    <input type="number" step="0.01" min="0" className="form-control" 
                      value={form.full_pack_cost} 
                      onChange={(e) => {
                        const packCost = Number(e.target.value) || 0;
                        const multiplier = Number(form.purchase_multiplier) || 1;
                        const perUnitCost = (packCost / multiplier).toFixed(2);
                        setForm({ ...form, full_pack_cost: e.target.value, cost_price: perUnitCost });
                      }} 
                      title="Enter full cost. Per literal/kg cost will be auto calculated." 
                    />
                  </div>
                </div>
              )}
              
              <div className="col-md-3">
                <label className="small text-primary fw-medium">{(isSpecialShop && Number(form.purchase_multiplier) > 1) ? `Cost per ${units.find(u => String(u.id) === String(form.unit))?.name || "Unit"}` : t("prod_list_cost")}</label>
                <div className="input-group input-group-sm mb-1">
                  <span className="input-group-text">৳</span>
                  <input type="number" step="0.01" min="0" className="form-control" value={form.cost_price} 
                    onChange={(e) => setForm({ ...form, cost_price: e.target.value })} 
                    readOnly={(isSpecialShop && Number(form.purchase_multiplier) > 1)} 
                    title={(isSpecialShop && Number(form.purchase_multiplier) > 1) ? "Auto calculated from Pack Cost / Multiplier" : ""}
                  />
                </div>
              </div>
              <div className="col-md-3">
                <label className="small text-primary fw-medium">{(isSpecialShop && Number(form.purchase_multiplier) > 1) ? `Selling Price per ${units.find(u => String(u.id) === String(form.unit))?.name || "Unit"}` : t("prod_list_selling_price")}</label>
                <div className="input-group input-group-sm mb-1">
                  <span className="input-group-text">৳</span>
                  <input type="number" step="0.01" min="0" className="form-control" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} />
                </div>
                {(isSpecialShop && Number(form.purchase_multiplier) > 1) && Number(form.selling_price) > 0 && Number(form.cost_price) > 0 && (
                  <div className="text-success fw-bold" style={{ fontSize: "0.75rem", marginTop: "-2px" }}>
                    ✅ Profit Margin: ৳{ (Number(form.selling_price) - Number(form.cost_price)).toFixed(2) } per unit
                  </div>
                )}
              </div>

              <div className="col-md-3">
                <label className="small">{t("prod_list_reorder_level")}</label>
                <input type="number" step="1" min="0" className="form-control form-control-sm" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} placeholder="5" />
              </div>
              <div className="col-md-2">
                <label className="small">{t("prod_list_warranty_months")}</label>
                <input type="number" min="0" className="form-control form-control-sm" value={form.warranty_months} onChange={(e) => setForm({ ...form, warranty_months: e.target.value })} placeholder="0" />
              </div>
              <div className="col-md-2">
                <label className="small" title="Replacement Guarantee (Days)">{t("prod_list_replacement_days")}</label>
                <input type="number" min="0" className="form-control form-control-sm" value={form.replacement_guarantee_days} onChange={(e) => setForm({ ...form, replacement_guarantee_days: e.target.value })} placeholder="0" />
              </div>
              <div className="col-12">
                <button className="btn btn-brand btn-sm" disabled={saving}>
                  {saving ? t("prod_list_saving") : t("prod_list_save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-striped table-sm align-middle mb-0">
            <thead className="thead-1">
              <tr>
                <th>{t("prod_list_col_name")}</th>
                <th className="text-end">{t("prod_list_col_cost")}</th>
                <th className="text-end">{t("prod_list_col_price")}</th>
                <th className="text-end">{t("prod_list_col_stock")}</th>
                <th className="text-center">{t("prod_list_col_active")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr data-empty="">
                  <td colSpan={6} className="text-center text-secondary py-5">
                    <div style={{ fontSize: "2.5rem", lineHeight: 1 }}>📦</div>
                    <div className="fw-semibold mt-2">{t("prod_list_no_products")}</div>
                    <div className="small mb-3">{t("prod_list_add_first")}</div>
                    {canManage && (
                      <button onClick={() => setShowAdd(true)} className="btn btn-brand btn-sm">
                        {t("prod_list_new")}
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className={p.is_low_stock ? "table-danger" : ""}>
                    <td>
                      <Link href={`/app/products/${p.id}`} className="text-decoration-none fw-medium">
                        {p.name}
                      </Link>
                      <div className="text-secondary small">{p.sku}</div>
                    </td>
                    <td className="text-end">{p.cost_price}</td>
                    <td className="text-end">{p.selling_price}</td>
                    <td className={`text-end ${p.is_low_stock ? "text-danger fw-semibold" : ""}`}>
                      {p.track_inventory === false ? (
                        <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25" style={{ fontSize: "0.72rem" }}>
                          {lang === "bn" ? "সার্ভিস / আনট্র্যাকড" : "Service / Untracked"}
                        </span>
                      ) : (
                        Math.max(0, Number(p.current_stock || 0))
                      )}
                    </td>


                    <td className="text-center">
                      {canManage ? (
                        <button onClick={() => toggle(p)} className={`btn btn-sm ${p.is_active ? "btn-success" : "btn-outline-secondary"} py-0 px-2`}>
                          {p.is_active ? t("prod_list_on") : t("prod_list_off")}
                        </button>
                      ) : p.is_active ? (
                        t("prod_list_yes")
                      ) : (
                        t("prod_list_no")
                      )}
                    </td>
                    <td className="text-end text-nowrap">
                      {canManage && (
                        <>
                          <Link href={`/app/products/${p.id}/edit`} className="small text-decoration-none me-2">
                            {t("prod_list_edit")}
                          </Link>
                          <button onClick={() => remove(p)} className="btn btn-link btn-sm text-danger p-0">
                            {t("prod_list_delete")}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} setPage={setPage} total={total} />
      </div>
    </div>
  );
}
