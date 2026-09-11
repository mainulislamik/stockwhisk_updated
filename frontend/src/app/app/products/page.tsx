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
  purchase_multiplier?: string | number;
  full_pack_cost?: string | number;
  full_pack_sell?: string | number;
  unit?: number | null;
  purchase_unit?: number | null;
  unit_detail?: { id: number; name: string; short_code: string; measure_type: string; allow_decimal: boolean } | null;
  purchase_unit_detail?: { id: number; name: string; short_code: string; measure_type: string } | null;
  warranty_months?: number;
  replacement_guarantee_days?: number;
  expiry_date?: string | null;
  lot_number?: string;
  mfg_date?: string | null;
  size_variants?: Array<{size: string; color: string; stock: number}>;
  fabric_material?: string;
  gender_target?: string;
  season?: string;
  style_type?: string;
  fit_type?: string;
  collection_name?: string;
  care_instructions?: string;
};
type Named = { id: number; name: string; measure_type?: string; short_code?: string };

export default function ProductsPage() {
  const { user, can, isOwner } = useAuth();
  const isCosmetics = user?.shop_business_type === "cosmetics";
  const isSpecialShop = user?.shop_business_type === "camical" || user?.shop_business_type === "supershop" || user?.shop_business_type === "cosmetics" || user?.shop_business_type === "beauty";
  const isFashionShop = user?.shop_business_type === "fashion" || user?.shop_business_type === "footwear" || user?.shop_business_type === "handcrafts" || user?.shop_business_type === "jewelry" || user?.shop_business_type === "apparel";
  const isRepairShop = !!user?.shop_mobile_repair_enabled;
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<number | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<number | null>(null);
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
  const { data, loading, error, mutate } = useApi<Paginated<Product>>("/catalog/products/", { search: debouncedFilter, page, page_size: PAGE_SIZE, ordering: "-current_stock", light: 1, ...(selectedBrandFilter ? { brand: selectedBrandFilter } : {}), ...(selectedCategoryFilter ? { category: selectedCategoryFilter } : {}) });
  const products = data?.results || [];
  const total = data?.count || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<any>({ name: "", sku: "", barcode: "", category: "", brand: "", unit: "", purchase_unit: "", purchase_multiplier: "1", full_pack_cost: "", full_pack_sell: "", cost_price: "", selling_price: "", reorder_level: "", warranty_months: "", replacement_guarantee_days: "", expiry_date: "", lot_number: "", mfg_date: "", fabric_material: "", gender_target: "", season: "", style_type: "", fit_type: "", collection_name: "", care_instructions: "", size_variants: [] });

  // Smart size presets based on selected category (fashion only)
  const catName = (categories.find((c: any) => String(c.id) === String(form.category))?.name || "").toLowerCase();
  const SIZE_PRESETS: string[] = (() => {
    if (/(pant|jeans|trouser|panjabi|punjabi)/.test(catName)) return ["28","30","32","34","36","38","40","42","44","46","48"];
    if (/(shirt|polo)/.test(catName)) return ["38","39","40","41","42","43","44","45","46"];
    if (/(t-shirt|tshirt|tee)/.test(catName)) return ["XS","S","M","L","XL","XXL","XXXL","Free Size"];
    if (/(kids|baby|child)/.test(catName)) return ["0-6M","6-12M","1-2Y","3-4Y","5-6Y","7-8Y","9-10Y"];
    if (/(shoe|footwear|sneaker|sandal)/.test(catName)) return ["39","40","41","42","43","44","45"];
    return ["XS","S","M","L","XL","XXL","Free Size"];
  })();
  const [saving, setSaving] = useState(false);
  const [pricingMode, setPricingMode] = useState<'regular' | 'bulk'>('regular');
  const [newCat, setNewCat] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newUnit, setNewUnit] = useState("");

  // Fashion custom attributes list & quick-add states
  const [fabricList, setFabricList] = useState<string[]>([
    "Cotton", "Polyester", "Silk", "Denim", "Linen", "Wool", "Mixed", "Rayon", "Georgette", "Chiffon", "Viscose", "Khadi"
  ]);
  const [genderList, setGenderList] = useState<string[]>([
    "Men", "Women", "Kids", "Unisex", "Girls", "Boys"
  ]);
  const [seasonList, setSeasonList] = useState<string[]>([
    "Summer", "Winter", "All Season", "Eid Collection", "Puja Collection", "Festive"
  ]);
  const [styleList, setStyleList] = useState<string[]>([
    "Casual", "Formal", "Party / Ethnic", "Sportswear", "Traditional", "Indo-Western"
  ]);
  const [fitList, setFitList] = useState<string[]>([
    "Slim Fit", "Regular Fit", "Oversized", "Relaxed Fit", "Tailored Fit", "Loose Fit", "Comfort Fit"
  ]);
  const [collectionList, setCollectionList] = useState<string[]>([
    "Eid 2026 Collection", "Puja Festive", "Summer Drop", "Winter Warmth", "Boishakh Special", "Daily Wear"
  ]);
  const [careList, setCareList] = useState<string[]>([
    "Dry Clean Only", "Machine Wash Cold", "Hand Wash Only", "Do Not Bleach", "Warm Iron", "Wash with Like Colors"
  ]);

  const [newFabric, setNewFabric] = useState("");
  const [newGender, setNewGender] = useState("");
  const [newSeason, setNewSeason] = useState("");
  const [newStyle, setNewStyle] = useState("");
  const [newFit, setNewFit] = useState("");
  const [newCollection, setNewCollection] = useState("");
  const [newCare, setNewCare] = useState("");

  // Load small dictionaries once
  useEffect(() => {
    fetchAll<Named>("/catalog/categories/").then(setCategories).catch(() => {});
    fetchAll<Named>("/catalog/brands/").then(setBrands).catch(() => {});
    fetchAll<Named>("/catalog/units/").then((res) => {
      setUnits(res);
      if (!isSpecialShop && res.length > 0) {
        const pcs = res.find((u) => u.name.toLowerCase().includes("piece") || u.name.toLowerCase().includes("pcs") || u.short_code?.toLowerCase() === "pcs");
        const defaultUnitId = pcs ? String(pcs.id) : String(res[0].id);
        setForm((f: any) => (f.unit ? f : { ...f, unit: defaultUnitId }));
      }
    }).catch(() => {});
  }, [isSpecialShop]);

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
          full_pack_cost: form.full_pack_cost !== "" ? Number(form.full_pack_cost) : 0,
          full_pack_sell: form.full_pack_sell !== "" ? Number(form.full_pack_sell) : 0,
          cost_price: form.cost_price || 0,
          selling_price: form.selling_price || 0,
          reorder_level: form.reorder_level === "" ? 5 : Math.max(0, Math.round(Number(form.reorder_level) || 0)),
          warranty_months: form.warranty_months || 0,
          replacement_guarantee_days: form.replacement_guarantee_days || 0,
          expiry_date: form.expiry_date || null,
          lot_number: form.lot_number || "",
          mfg_date: form.mfg_date || null,
          fabric_material: form.fabric_material || "",
          gender_target: form.gender_target || "",
          season: form.season || "",
          style_type: form.style_type || "",
          size_variants: form.size_variants || [],
        },
      });
      setForm({ name: "", sku: "", barcode: "", category: "", brand: "", unit: "", purchase_unit: "", purchase_multiplier: "1", full_pack_cost: "", full_pack_sell: "", cost_price: "", selling_price: "", reorder_level: "", warranty_months: "", replacement_guarantee_days: "", expiry_date: "", lot_number: "", mfg_date: "", fabric_material: "", gender_target: "", season: "", style_type: "", fit_type: "", collection_name: "", care_instructions: "", size_variants: [] });
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

  async function quickAdd(kind: "category" | "brand" | "unit") {
    const name = kind === "category" ? newCat.trim() : kind === "brand" ? newBrand.trim() : newUnit.trim();
    if (!name) return;
    try {
      const endpoint = kind === "category" ? "categories" : kind === "brand" ? "brands" : "units";
      const created = await api(`/catalog/${endpoint}/`, { method: "POST", body: { name } });
      if (kind === "category") { setCategories((c) => [...c, created]); setNewCat(""); }
      else if (kind === "brand") { setBrands((b) => [...b, created]); setNewBrand(""); }
      else { setUnits((u) => [...u, created]); setNewUnit(""); }
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
                <input required className="form-control form-control-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={lang === "bn" ? "যেমন: ক্যাস্টর অয়েল / শ্যাম্পু" : "e.g. Castor Oil / Shampoo"} />
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
              <div className="col-md-3">
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
              {isSpecialShop ? (
                <div className="col-md-3">
                  <label className="small fw-medium text-primary">{lang === "bn" ? "বিক্রয় ইউনিট (Unit)" : "Sale Unit"}</label>
                  <select className="form-select form-select-sm mb-1" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                    <option value="">{lang === "bn" ? "-- ইউনিট সিলেক্ট করুন --" : "-- Select Unit --"}</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.name} {u.short_code ? `(${u.short_code})` : ""}</option>)}
                  </select>
                  <div className="input-group input-group-sm">
                    <input className="form-control" placeholder={lang === "bn" ? "নতুন ইউনিট (যেমন: Kg, Liter)" : "+ New unit"} value={newUnit} onChange={(e) => setNewUnit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), quickAdd("unit"))} />
                    <button type="button" className="btn btn-outline-brand" onClick={() => quickAdd("unit")}>{t("prod_list_add")}</button>
                  </div>
                </div>
              ) : (
                <div className="col-md-2">
                  <label className="small fw-medium">{t("prod_list_unit") || "Unit"}</label>
                  <select className="form-select form-select-sm" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                    {units.length === 0 && <option value="">{lang === "bn" ? "পিস (Piece / Pcs)" : "Piece / Pcs"}</option>}
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} {u.short_code ? `(${u.short_code})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {isSpecialShop && (
                <>
                  <div className="col-md-3">
                    <label className="small fw-medium text-primary">{lang === "bn" ? "পাইকারি/ড্রাম ইউনিট (Purchase Unit)" : "Bulk/Purchase Unit"}</label>
                    <select className="form-select form-select-sm mb-1" value={form.purchase_unit} onChange={(e) => setForm({ ...form, purchase_unit: e.target.value })}>
                      <option value="">{lang === "bn" ? "-- ড্রাম/বক্স ইউনিট (ঐচ্ছিক) --" : "-- Select Bulk Unit (Optional) --"}</option>
                      {units.map((u) => <option key={u.id} value={u.id}>{u.name} {u.short_code ? `(${u.short_code})` : ""}</option>)}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="small fw-semibold text-primary" title="Conversion Multiplier">{lang === "bn" ? "প্রতি ড্রাম/বক্সে পরিমাণ" : "Qty per Drum/Box"}</label>
                    <input type="number" step="0.01" min="1" className="form-control form-control-sm mb-1" 
                      value={form.purchase_multiplier} 
                      placeholder="e.g. 50"
                      onChange={(e) => {
                        const newMult = e.target.value;
                        const multiplierVal = Number(newMult) || 1;
                        const packCost = Number(form.full_pack_cost) || 0;
                        const packSell = Number(form.full_pack_sell) || 0;
                        const perUnitCost = packCost > 0 ? (packCost / multiplierVal).toFixed(2) : form.cost_price;
                        const perUnitSell = packSell > 0 ? (packSell / multiplierVal).toFixed(2) : form.selling_price;
                        setForm({ ...form, purchase_multiplier: newMult, cost_price: perUnitCost, selling_price: perUnitSell });
                      }} 
                      title="Example: 1 Drum = 50 Liters, place 50 here." />
                  </div>
                </>
              )}

              {isSpecialShop && Number(form.purchase_multiplier) > 1 && (
                <div className="col-12 mb-2 p-2 rounded" style={{ backgroundColor: "rgba(13,110,253,0.05)", border: "1px solid rgba(13,110,253,0.1)" }}>
                  <label className="small text-primary fw-bold mb-1">{lang === "bn" ? "দাম নির্ধারণ পদ্ধতি" : "Pricing Entry Method"}</label>
                  <select className="form-select form-select-sm" value={pricingMode} onChange={(e) => setPricingMode(e.target.value as any)}>
                    <option value="regular">{lang === "bn" ? `সাধারণ (প্রতি ${units.find(u => String(u.id) === String(form.unit))?.name || "লিটার/কেজি"} আলাদা ইনপুট)` : `Regular (Per ${units.find(u => String(u.id) === String(form.unit))?.name || "Unit"} manually)`}</option>
                    <option value="bulk">{lang === "bn" ? `বাল্ক অটো-ক্যালকুলেট (সম্পূর্ণ ${units.find(u => String(u.id) === String(form.purchase_unit))?.name || "ড্রাম/বক্স"} এর দাম)` : `Bulk Auto-Calculate (Full ${units.find(u => String(u.id) === String(form.purchase_unit))?.name || "Drum/Pack"} Price)`}</option>
                  </select>
                </div>
              )}

              {(isSpecialShop && pricingMode === "bulk" && Number(form.purchase_multiplier) > 1) && (
                <>
                  <div className="col-md-3">
                    <label className="small text-primary fw-medium">Full {units.find(u => String(u.id) === String(form.purchase_unit))?.name || "Drum/Box"} Cost</label>
                    <div className="input-group input-group-sm mb-1">
                      <span className="input-group-text">৳</span>
                      <input type="number" step="0.01" min="0" className="form-control" 
                        value={form.full_pack_cost} 
                        placeholder="e.g. 20000"
                        onChange={(e) => {
                          const packCost = Number(e.target.value) || 0;
                          const multiplier = Number(form.purchase_multiplier) || 1;
                          const perUnitCost = (packCost / multiplier).toFixed(2);
                          setForm({ ...form, full_pack_cost: e.target.value, cost_price: perUnitCost });
                        }} 
                        title="Enter full drum cost. Per unit cost will be auto calculated." 
                      />
                    </div>
                  </div>
                  <div className="col-md-3">
                    <label className="small text-primary fw-medium">Full {units.find(u => String(u.id) === String(form.purchase_unit))?.name || "Drum/Box"} Sell</label>
                    <div className="input-group input-group-sm mb-1">
                      <span className="input-group-text">৳</span>
                      <input type="number" step="0.01" min="0" className="form-control" 
                        value={form.full_pack_sell} 
                        placeholder="e.g. 24000"
                        onChange={(e) => {
                          const packSell = Number(e.target.value) || 0;
                          const multiplier = Number(form.purchase_multiplier) || 1;
                          const perUnitSell = (packSell / multiplier).toFixed(2);
                          setForm({ ...form, full_pack_sell: e.target.value, selling_price: perUnitSell });
                        }} 
                      />
                    </div>
                  </div>
                </>
              )}
              
              <div className="col-md-3">
                <label className="small text-primary fw-medium">{(isSpecialShop && pricingMode === "bulk" && Number(form.purchase_multiplier) > 1) ? `Cost per ${units.find(u => String(u.id) === String(form.unit))?.name || "Unit"}` : t("prod_list_cost")}</label>
                <div className="input-group input-group-sm mb-1">
                  <span className="input-group-text">৳</span>
                  <input type="number" step="0.01" min="0" className="form-control" value={form.cost_price} 
                    onChange={(e) => setForm({ ...form, cost_price: e.target.value })} 
                    title={(isSpecialShop && pricingMode === "bulk" && Number(form.purchase_multiplier) > 1) ? "Auto calculated from Pack Cost / Multiplier (or type manually)" : ""}
                  />
                </div>
              </div>

              <div className="col-md-3">
                <label className="small text-primary fw-medium">{(isSpecialShop && pricingMode === "bulk" && Number(form.purchase_multiplier) > 1) ? `Selling Price per ${units.find(u => String(u.id) === String(form.unit))?.name || "Unit"}` : t("prod_list_selling_price")}</label>
                <div className="input-group input-group-sm mb-1">
                  <span className="input-group-text">৳</span>
                  <input type="number" step="0.01" min="0" className="form-control" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} />
                </div>
                {(isSpecialShop && pricingMode === "bulk" && Number(form.purchase_multiplier) > 1) && Number(form.selling_price) > 0 && Number(form.cost_price) > 0 && (
                  <div className="text-success fw-bold" style={{ fontSize: "0.75rem", marginTop: "-2px" }}>
                    ✅ Margin: ৳{(Number(form.selling_price) - Number(form.cost_price)).toFixed(2)} per {units.find(u => String(u.id) === String(form.unit))?.short_code || "Unit"}
                  </div>
                )}
              </div>

              <div className="col-md-3">
                <label className="small">{t("prod_list_reorder_level")}</label>
                <input type="number" step="1" min="0" className="form-control form-control-sm" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} placeholder="5" />
              </div>
              {/* Unit-based Warranty vs Expiry Management */}
              {(() => {
                const selectedUnit = units.find((u) => String(u.id) === String(form.unit));
                const isCountUnit = !selectedUnit || selectedUnit.measure_type === "count" || selectedUnit.name?.toLowerCase().includes("piece") || selectedUnit.name?.toLowerCase().includes("pcs") || selectedUnit.short_code?.toLowerCase() === "pcs";
                const isChemicalBulk = isSpecialShop && !isCountUnit;

                if (isChemicalBulk) {
                  return (
                    <>
                      <div className="col-md-3">
                        <label className="small fw-semibold text-danger">{t("prod_lbl_expiry") || (lang === "bn" ? "মেয়াদোত্তীর্ণের তারিখ (Expiry Date)" : "Expiry Date")}</label>
                        <input type="date" className="form-control form-control-sm" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
                      </div>
                      <div className="col-md-3">
                        <label className="small fw-medium">{t("prod_lbl_lot") || (lang === "bn" ? "লট / ব্যাচ নম্বর" : "Lot / Batch No")}</label>
                        <input type="text" className="form-control form-control-sm" value={form.lot_number} onChange={(e) => setForm({ ...form, lot_number: e.target.value })} placeholder="e.g. LOT-2026-09" />
                      </div>
                      <div className="col-md-3">
                        <label className="small fw-medium">{t("prod_lbl_mfg") || (lang === "bn" ? "উৎপাদন তারিখ (ঐচ্ছিক)" : "Mfg Date (Optional)")}</label>
                        <input type="date" className="form-control form-control-sm" value={form.mfg_date} onChange={(e) => setForm({ ...form, mfg_date: e.target.value })} />
                      </div>
                    </>
                  );
                }

                if (isFashionShop) {
                  return (
                    <div className="col-md-3">
                      <label className="small fw-medium" title={t("fashion_exchange_hint") || "Days allowed for size/defect replacement"}>
                        {t("fashion_lbl_exchange_days") || (lang === "bn" ? "রিটার্ন / এক্সচেঞ্জ (দিন)" : "Exchange / Return (Days)")}
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="form-control form-control-sm"
                        value={form.replacement_guarantee_days}
                        onChange={(e) => setForm({ ...form, replacement_guarantee_days: e.target.value })}
                        placeholder="7"
                      />
                    </div>
                  );
                }

                return (
                  <>
                    <div className="col-md-2">
                      <label className="small">{t("prod_list_warranty_months") || (lang === "bn" ? "ওয়ারেন্টি (মাস)" : "Warranty (Months)")}</label>
                      <input type="number" min="0" className="form-control form-control-sm" value={form.warranty_months} onChange={(e) => setForm({ ...form, warranty_months: e.target.value })} placeholder="0" />
                    </div>
                    <div className="col-md-2">
                      <label className="small" title="Replacement Guarantee (Days)">{t("prod_list_replacement_days") || (lang === "bn" ? "রিপ্লেসমেন্ট (দিন)" : "Replacement (Days)")}</label>
                      <input type="number" min="0" className="form-control form-control-sm" value={form.replacement_guarantee_days} onChange={(e) => setForm({ ...form, replacement_guarantee_days: e.target.value })} placeholder="0" />
                    </div>
                  </>
                );
              })()}
              {/* ── Apparel & Fashion Section ──────────────────────── */}
              {isFashionShop && (
                <>
                  <div className="col-12 mt-2">
                    <div className="p-2 rounded" style={{background:"#f8f4ff",border:"1px solid #c084fc"}}>
                      <div className="fw-semibold text-purple mb-2" style={{color:"#7c3aed",fontSize:"0.85rem"}}>
                        👗 {t("fashion_section_title") || (lang === "bn" ? "পোশাক ও ফ্যাশন বিবরণ" : "Apparel & Fashion Details")}
                      </div>
                      <div className="row g-2">
                        {/* 1. Fabric Material */}
                        <div className="col-md-3">
                          <label className="small text-primary fw-medium">{t("fashion_lbl_fabric") || (lang === "bn" ? "কাপড়ের ধরন" : "Fabric Material")}</label>
                          <select className="form-select form-select-sm mb-1" value={form.fabric_material || ""} onChange={(e) => setForm({ ...form, fabric_material: e.target.value })}>
                            <option value="">{lang === "bn" ? "-- ফেব্রিক বেছে নিন --" : "-- Select Fabric --"}</option>
                            {fabricList.map((f) => <option key={f} value={f}>{f}</option>)}
                          </select>
                          <div className="input-group input-group-sm">
                            <input
                              className="form-control"
                              placeholder={lang === "bn" ? "নতুন ফেব্রিক..." : "+ New fabric"}
                              value={newFabric}
                              onChange={(e) => setNewFabric(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (newFabric.trim()) {
                                    const v = newFabric.trim();
                                    if (!fabricList.includes(v)) setFabricList((prev) => [...prev, v]);
                                    setForm((f: any) => ({ ...f, fabric_material: v }));
                                    setNewFabric("");
                                  }
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="btn btn-outline-brand"
                              onClick={() => {
                                if (newFabric.trim()) {
                                  const v = newFabric.trim();
                                  if (!fabricList.includes(v)) setFabricList((prev) => [...prev, v]);
                                  setForm((f: any) => ({ ...f, fabric_material: v }));
                                  setNewFabric("");
                                }
                              }}
                            >
                              {t("prod_list_add") || (lang === "bn" ? "যোগ" : "+ Add")}
                            </button>
                          </div>
                        </div>

                        {/* 2. Target Group / Gender */}
                        <div className="col-md-3">
                          <label className="small text-primary fw-medium">{t("fashion_lbl_gender") || (lang === "bn" ? "টার্গেট গ্রুপ" : "Target Group (Gender)")}</label>
                          <select className="form-select form-select-sm mb-1" value={form.gender_target || ""} onChange={(e) => setForm({ ...form, gender_target: e.target.value })}>
                            <option value="">{lang === "bn" ? "-- টার্গেট বেছে নিন --" : "-- Select Target --"}</option>
                            {genderList.map((g) => <option key={g} value={g}>{g}</option>)}
                          </select>
                          <div className="input-group input-group-sm">
                            <input
                              className="form-control"
                              placeholder={lang === "bn" ? "নতুন টার্গেট..." : "+ New target"}
                              value={newGender}
                              onChange={(e) => setNewGender(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (newGender.trim()) {
                                    const v = newGender.trim();
                                    if (!genderList.includes(v)) setGenderList((prev) => [...prev, v]);
                                    setForm((f: any) => ({ ...f, gender_target: v }));
                                    setNewGender("");
                                  }
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="btn btn-outline-brand"
                              onClick={() => {
                                if (newGender.trim()) {
                                  const v = newGender.trim();
                                  if (!genderList.includes(v)) setGenderList((prev) => [...prev, v]);
                                  setForm((f: any) => ({ ...f, gender_target: v }));
                                  setNewGender("");
                                }
                              }}
                            >
                              {t("prod_list_add") || (lang === "bn" ? "যোগ" : "+ Add")}
                            </button>
                          </div>
                        </div>

                        {/* 3. Season */}
                        <div className="col-md-3">
                          <label className="small text-primary fw-medium">{t("fashion_lbl_season") || (lang === "bn" ? "মৌসুম" : "Season")}</label>
                          <select className="form-select form-select-sm mb-1" value={form.season || ""} onChange={(e) => setForm({ ...form, season: e.target.value })}>
                            <option value="">{lang === "bn" ? "-- মৌসুম বেছে নিন --" : "-- Select Season --"}</option>
                            {seasonList.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <div className="input-group input-group-sm">
                            <input
                              className="form-control"
                              placeholder={lang === "bn" ? "নতুন মৌসুম/উৎসব..." : "+ New season"}
                              value={newSeason}
                              onChange={(e) => setNewSeason(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (newSeason.trim()) {
                                    const v = newSeason.trim();
                                    if (!seasonList.includes(v)) setSeasonList((prev) => [...prev, v]);
                                    setForm((f: any) => ({ ...f, season: v }));
                                    setNewSeason("");
                                  }
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="btn btn-outline-brand"
                              onClick={() => {
                                if (newSeason.trim()) {
                                  const v = newSeason.trim();
                                  if (!seasonList.includes(v)) setSeasonList((prev) => [...prev, v]);
                                  setForm((f: any) => ({ ...f, season: v }));
                                  setNewSeason("");
                                }
                              }}
                            >
                              {t("prod_list_add") || (lang === "bn" ? "যোগ" : "+ Add")}
                            </button>
                          </div>
                        </div>

                        {/* 4. Style Type */}
                        <div className="col-md-3">
                          <label className="small text-primary fw-medium">{t("fashion_lbl_style") || (lang === "bn" ? "স্টাইল" : "Style Type")}</label>
                          <select className="form-select form-select-sm mb-1" value={form.style_type || ""} onChange={(e) => setForm({ ...form, style_type: e.target.value })}>
                            <option value="">{lang === "bn" ? "-- স্টাইল বেছে নিন --" : "-- Select Style --"}</option>
                            {styleList.map((st) => <option key={st} value={st}>{st}</option>)}
                          </select>
                          <div className="input-group input-group-sm">
                            <input
                              className="form-control"
                              placeholder={lang === "bn" ? "নতুন স্টাইল..." : "+ New style"}
                              value={newStyle}
                              onChange={(e) => setNewStyle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (newStyle.trim()) {
                                    const v = newStyle.trim();
                                    if (!styleList.includes(v)) setStyleList((prev) => [...prev, v]);
                                    setForm((f: any) => ({ ...f, style_type: v }));
                                    setNewStyle("");
                                  }
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="btn btn-outline-brand"
                              onClick={() => {
                                if (newStyle.trim()) {
                                  const v = newStyle.trim();
                                  if (!styleList.includes(v)) setStyleList((prev) => [...prev, v]);
                                  setForm((f: any) => ({ ...f, style_type: v }));
                                  setNewStyle("");
                                }
                              }}
                            >
                              {t("prod_list_add") || (lang === "bn" ? "যোগ" : "+ Add")}
                            </button>
                          </div>
                        </div>

                        {/* 5. Fit Type */}
                        <div className="col-md-4">
                          <label className="small text-primary fw-medium">{lang === "bn" ? "ফিট টাইপ (Fit)" : "Fit Type"}</label>
                          <select className="form-select form-select-sm mb-1" value={form.fit_type || ""} onChange={(e) => setForm({ ...form, fit_type: e.target.value })}>
                            <option value="">{lang === "bn" ? "-- ফিট বেছে নিন --" : "-- Select Fit --"}</option>
                            {fitList.map((ft) => <option key={ft} value={ft}>{ft}</option>)}
                          </select>
                          <div className="input-group input-group-sm">
                            <input
                              className="form-control"
                              placeholder={lang === "bn" ? "নতুন ফিট..." : "+ New fit"}
                              value={newFit}
                              onChange={(e) => setNewFit(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (newFit.trim()) {
                                    const v = newFit.trim();
                                    if (!fitList.includes(v)) setFitList((prev) => [...prev, v]);
                                    setForm((f: any) => ({ ...f, fit_type: v }));
                                    setNewFit("");
                                  }
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="btn btn-outline-brand"
                              onClick={() => {
                                if (newFit.trim()) {
                                  const v = newFit.trim();
                                  if (!fitList.includes(v)) setFitList((prev) => [...prev, v]);
                                  setForm((f: any) => ({ ...f, fit_type: v }));
                                  setNewFit("");
                                }
                              }}
                            >
                              {t("prod_list_add") || (lang === "bn" ? "যোগ" : "+ Add")}
                            </button>
                          </div>
                        </div>

                        {/* 6. Collection / Drop */}
                        <div className="col-md-4">
                          <label className="small text-primary fw-medium">{lang === "bn" ? "কালেকশন / ড্রপ" : "Collection / Drop"}</label>
                          <select className="form-select form-select-sm mb-1" value={form.collection_name || ""} onChange={(e) => setForm({ ...form, collection_name: e.target.value })}>
                            <option value="">{lang === "bn" ? "-- কালেকশন বেছে নিন --" : "-- Select Collection --"}</option>
                            {collectionList.map((cl) => <option key={cl} value={cl}>{cl}</option>)}
                          </select>
                          <div className="input-group input-group-sm">
                            <input
                              className="form-control"
                              placeholder={lang === "bn" ? "নতুন কালেকশন..." : "+ New collection"}
                              value={newCollection}
                              onChange={(e) => setNewCollection(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (newCollection.trim()) {
                                    const v = newCollection.trim();
                                    if (!collectionList.includes(v)) setCollectionList((prev) => [...prev, v]);
                                    setForm((f: any) => ({ ...f, collection_name: v }));
                                    setNewCollection("");
                                  }
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="btn btn-outline-brand"
                              onClick={() => {
                                if (newCollection.trim()) {
                                  const v = newCollection.trim();
                                  if (!collectionList.includes(v)) setCollectionList((prev) => [...prev, v]);
                                  setForm((f: any) => ({ ...f, collection_name: v }));
                                  setNewCollection("");
                                }
                              }}
                            >
                              {t("prod_list_add") || (lang === "bn" ? "যোগ" : "+ Add")}
                            </button>
                          </div>
                        </div>

                        {/* 7. Care Instructions */}
                        <div className="col-md-4">
                          <label className="small text-primary fw-medium">{lang === "bn" ? "কেয়ার / ওয়াশ নির্দেশিকা" : "Care Instructions"}</label>
                          <select className="form-select form-select-sm mb-1" value={form.care_instructions || ""} onChange={(e) => setForm({ ...form, care_instructions: e.target.value })}>
                            <option value="">{lang === "bn" ? "-- নির্দেশিকা বেছে নিন --" : "-- Select Care --"}</option>
                            {careList.map((cr) => <option key={cr} value={cr}>{cr}</option>)}
                          </select>
                          <div className="input-group input-group-sm">
                            <input
                              className="form-control"
                              placeholder={lang === "bn" ? "নতুন নির্দেশিকা..." : "+ New care instruction"}
                              value={newCare}
                              onChange={(e) => setNewCare(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (newCare.trim()) {
                                    const v = newCare.trim();
                                    if (!careList.includes(v)) setCareList((prev) => [...prev, v]);
                                    setForm((f: any) => ({ ...f, care_instructions: v }));
                                    setNewCare("");
                                  }
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="btn btn-outline-brand"
                              onClick={() => {
                                if (newCare.trim()) {
                                  const v = newCare.trim();
                                  if (!careList.includes(v)) setCareList((prev) => [...prev, v]);
                                  setForm((f: any) => ({ ...f, care_instructions: v }));
                                  setNewCare("");
                                }
                              }}
                            >
                              {t("prod_list_add") || (lang === "bn" ? "যোগ" : "+ Add")}
                            </button>
                          </div>
                        </div>
                      </div>
                      {/* Size & Color Variant Matrix */}
                      <div className="mt-2">
                        <label className="small text-primary fw-medium">{t("fashion_lbl_variants") || "সাইজ ও রঙের স্টক"}</label>
                        {(form.size_variants||[]).map((v:any,i:number)=>(
                          <div key={i} className="row g-1 mb-1 align-items-center">
                            <div className="col-3">
                              <input
                                className="form-control form-control-sm"
                                list="fashion-size-list"
                                placeholder={lang==="bn"?"সাইজ (টাইপ করুন)":"Size (type or pick)"}
                                value={v.size||""}
                                onChange={e=>{const sv=[...form.size_variants];sv[i]={...sv[i],size:e.target.value};setForm({...form,size_variants:sv})}}
                              />
                              <datalist id="fashion-size-list">
                                {SIZE_PRESETS.map((s:any)=><option key={s} value={s} />)}
                              </datalist>
                            </div>
                            <div className="col-4">
                              <input className="form-control form-control-sm" placeholder={lang==="bn"?"রং (Color)":"Color"} value={v.color||""} onChange={e=>{const sv=[...form.size_variants];sv[i]={...sv[i],color:e.target.value};setForm({...form,size_variants:sv})}} />
                            </div>
                            <div className="col-3">
                              <input type="number" min="0" className="form-control form-control-sm" placeholder={lang==="bn"?"পরিমাণ":"Qty"} value={v.stock||""} onChange={e=>{const sv=[...form.size_variants];sv[i]={...sv[i],stock:Number(e.target.value)};setForm({...form,size_variants:sv})}} />
                            </div>
                            <div className="col-2">
                              <button type="button" className="btn btn-outline-danger btn-sm w-100" onClick={()=>{const sv=form.size_variants.filter((_:any,j:number)=>j!==i);setForm({...form,size_variants:sv})}}>🗑</button>
                            </div>
                          </div>
                        ))}
                        <button type="button" className="btn btn-outline-secondary btn-sm mt-1" onClick={()=>setForm({...form,size_variants:[...(form.size_variants||[]),{size:"M",color:"",stock:0}]})}>
                          + {t("fashion_btn_add_variant")||"ভেরিয়েন্ট যোগ করুন"}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
              <div className="col-12">
                <button className="btn btn-brand btn-sm" disabled={saving}>
                  {saving ? t("prod_list_saving") : t("prod_list_save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Repair Shop: Brand -> Category Hierarchy Header */}
      {/* ══════════════════════════════════════════════════════════════════════
          REPAIR SHOP MODE: STRICT 3-STEP HIERARCHY DRILL-DOWN
          Step 1: Big Brand Cards -> Step 2: Category Cards -> Step 3: Products Table
          ══════════════════════════════════════════════════════════════════════ */}
      {isRepairShop ? (
        <div className="d-flex flex-column gap-3 mb-4">
          {/* Breadcrumb / Navigation Bar */}
          <div className="card shadow-sm border-0 mb-2">
            <div className="card-body p-2 px-3 d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2 small">
                <button
                  type="button"
                  className={`btn btn-sm py-1 px-3 fw-bold rounded-3 ${!selectedBrandFilter ? "btn-primary shadow-sm" : "btn-outline-primary"}`}
                  onClick={() => { setSelectedBrandFilter(null); setSelectedCategoryFilter(null); }}
                >
                  <i className="bi bi-phone me-1"></i>১. ব্র্যান্ড (Brands)
                </button>
                {selectedBrandFilter && (
                  <>
                    <span className="text-secondary fw-bold">›</span>
                    <button
                      type="button"
                      className={`btn btn-sm py-1 px-3 fw-bold rounded-3 ${!selectedCategoryFilter ? "btn-warning text-dark shadow-sm" : "btn-outline-warning text-dark"}`}
                      onClick={() => setSelectedCategoryFilter(null)}
                    >
                      <i className="bi bi-cpu me-1"></i>{brands.find(b => b.id === selectedBrandFilter)?.name || "ক্যাটাগরি"}
                    </button>
                  </>
                )}
                {selectedBrandFilter && selectedCategoryFilter && (
                  <>
                    <span className="text-secondary fw-bold">›</span>
                    <span className="badge bg-success py-2 px-3 fw-bold rounded-3" style={{ fontSize: "0.8rem" }}>
                      <i className="bi bi-box-seam me-1"></i>{categories.find((c: any) => c.id === selectedCategoryFilter)?.name || "প্রোডাক্ট তালিকা"}
                    </span>
                  </>
                )}
              </div>
              {selectedBrandFilter && (
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm py-1 px-3 fw-bold rounded-3"
                  style={{ fontSize: "12px" }}
                  onClick={() => { setSelectedBrandFilter(null); setSelectedCategoryFilter(null); }}
                >
                  শুরুতে ফিরুন ↺
                </button>
              )}
            </div>
          </div>

          {/* ── STEP 1: Select Brand (Big Touch Cards) ── */}
          {!selectedBrandFilter && (
            <div className="card shadow-sm border-0">
              <div className="card-body p-4">
                <h6 className="fw-bold text-primary mb-3">
                  <i className="bi bi-grid-3x3-gap me-2"></i>ব্র্যান্ড নির্বাচন করুন (Select Device Brand):
                </h6>
                <div className="row g-3">
                  {brands.length === 0 ? (
                    <div className="col-12 text-center py-5 text-secondary">
                      <div style={{ fontSize: "2.5rem" }}>📱</div>
                      <div className="mt-2 fw-semibold">কোনো ব্র্যান্ড পাওয়া যায়নি</div>
                      <div className="small">উপরের "+ New Product Record" থেকে ব্র্যান্ড যোগ করুন।</div>
                    </div>
                  ) : (
                    brands.map((b) => (
                      <div className="col-6 col-md-3" key={b.id}>
                        <button
                          type="button"
                          className="btn btn-light w-100 p-4 rounded-4 text-center border shadow-sm d-flex flex-column align-items-center justify-content-center gap-2"
                          style={{ minHeight: "130px", transition: "all 0.2s" }}
                          onClick={() => setSelectedBrandFilter(b.id)}
                        >
                          <div className="p-3 rounded-circle bg-primary bg-opacity-10 text-primary fs-2">
                            <i className="bi bi-phone"></i>
                          </div>
                          <div className="fw-bold fs-5 text-dark">{b.name}</div>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Select Category (Component Cards) ── */}
          {selectedBrandFilter && !selectedCategoryFilter && (
            <div className="card shadow-sm border-0">
              <div className="card-body p-4">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h6 className="fw-bold text-warning text-dark mb-0">
                    <i className="bi bi-tools me-2 text-warning"></i><strong>{brands.find(b => b.id === selectedBrandFilter)?.name}</strong> এর ক্যাটাগরি / পার্টস বেছে নিন:
                  </h6>
                  <button type="button" className="btn btn-outline-secondary btn-sm py-1 px-3" onClick={() => setSelectedBrandFilter(null)}>
                    ← ব্র্যান্ড পরিবর্তন
                  </button>
                </div>
                <div className="row g-3">
                  {categories.length === 0 ? (
                    <div className="col-12 text-center py-5 text-secondary">
                      <div style={{ fontSize: "2.5rem" }}>⚙️</div>
                      <div className="mt-2 fw-semibold">কোনো ক্যাটাগরি পাওয়া যায়নি</div>
                    </div>
                  ) : (
                    categories.map((c: any) => (
                      <div className="col-6 col-md-3" key={c.id}>
                        <button
                          type="button"
                          className="btn btn-light w-100 p-4 rounded-4 text-center border shadow-sm d-flex flex-column align-items-center justify-content-center gap-2"
                          style={{ minHeight: "120px", transition: "all 0.2s" }}
                          onClick={() => setSelectedCategoryFilter(c.id)}
                        >
                          <div className="p-3 rounded-circle bg-warning bg-opacity-10 text-warning fs-3">
                            <i className="bi bi-cpu"></i>
                          </div>
                          <div className="fw-bold fs-5 text-dark">{c.name}</div>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Products Table (Visible ONLY after Category Selection) ── */}
          {selectedBrandFilter && selectedCategoryFilter && (
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h6 className="fw-bold text-success mb-0">
                  <i className="bi bi-box-seam me-2"></i>{brands.find(b => b.id === selectedBrandFilter)?.name} · {categories.find((c: any) => c.id === selectedCategoryFilter)?.name} এর পার্টস তালিকা:
                </h6>
                <button type="button" className="btn btn-outline-secondary btn-sm py-0" onClick={() => setSelectedCategoryFilter(null)}>
                  ← ক্যাটাগরি পরিবর্তন
                </button>
              </div>

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
                        products.map((p) => {
                          const mult = Number(p.purchase_multiplier) || 1;
                          const isBulk = mult > 1;
                          const baseUnit = p.unit_detail?.short_code || p.unit_detail?.name || "";
                          const bulkUnit = p.purchase_unit_detail?.name || "Pack";
                          const cost = Number(p.cost_price) || 0;
                          const sell = Number(p.selling_price) || 0;
                          const stockNum = Math.max(0, Number(p.current_stock || 0));

                          return (
                            <tr key={p.id} className={p.is_low_stock ? "table-danger" : ""}>
                              <td>
                                <Link href={`/app/products/${p.id}`} className="text-decoration-none fw-medium">
                                  {p.name}
                                </Link>
                                <div className="text-secondary small d-flex flex-wrap align-items-center gap-2">
                                  <span>{p.sku || "—"}</span>
                                  {isBulk && (
                                    <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25" style={{ fontSize: "0.68rem" }}>
                                      📦 1 {bulkUnit} = {mult} {baseUnit || "Unit"}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="text-end">`৳${Number(cost).toFixed(2)}`</td>
                              <td className="text-end">`৳${Number(sell).toFixed(2)}`</td>
                              <td className="text-end">
                                <span className={stockNum <= 0 ? "text-danger fw-bold" : ""}>
                                  {stockNum} {baseUnit || "pcs"}
                                </span>
                              </td>
                              <td className="text-center">
                                <span className={`badge ${p.is_active ? "bg-success" : "bg-secondary"}`}>
                                  {p.is_active ? "Active" : "Inactive"}
                                </span>
                              </td>
                              <td className="text-end">
                                {canManage && (
                                  <>
                                    <Link href={`/app/products/${p.id}/edit`} className="small text-decoration-none me-2">
                                      {t("prod_list_edit") || "Edit"}
                                    </Link>
                                    <button onClick={() => remove(p)} className="btn btn-link btn-sm text-danger p-0">
                                      {t("prod_list_delete") || "Delete"}
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Default Flat Product Table (Non-Repair Shops) ── */
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
                  products.map((p) => {
                    const mult = Number(p.purchase_multiplier) || 1;
                    const isBulk = mult > 1;
                    const baseUnit = p.unit_detail?.short_code || p.unit_detail?.name || "";
                    const bulkUnit = p.purchase_unit_detail?.name || "Pack";
                    const cost = Number(p.cost_price) || 0;
                    const sell = Number(p.selling_price) || 0;
                    const stockNum = Math.max(0, Number(p.current_stock || 0));

                    return (
                      <tr key={p.id} className={p.is_low_stock ? "table-danger" : ""}>
                        <td>
                          <Link href={`/app/products/${p.id}`} className="text-decoration-none fw-medium">
                            {p.name}
                          </Link>
                          <div className="text-secondary small d-flex flex-wrap align-items-center gap-2">
                            <span>{p.sku || "—"}</span>
                            {isBulk && (
                              <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25" style={{ fontSize: "0.68rem" }}>
                                📦 1 {bulkUnit} = {mult} {baseUnit || "Unit"}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-end">`৳${Number(cost).toFixed(2)}`</td>
                        <td className="text-end">`৳${Number(sell).toFixed(2)}`</td>
                        <td className="text-end">
                          <span className={stockNum <= 0 ? "text-danger fw-bold" : ""}>
                            {stockNum} {baseUnit || "pcs"}
                          </span>
                        </td>
                        <td className="text-center">
                          <span className={`badge ${p.is_active ? "bg-success" : "bg-secondary"}`}>
                            {p.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="text-end">
                                {canManage && (
                                  <>
                                    <Link href={`/app/products/${p.id}/edit`} className="small text-decoration-none me-2">
                                      {t("prod_list_edit") || "Edit"}
                                    </Link>
                                    <button onClick={() => remove(p)} className="btn btn-link btn-sm text-danger p-0">
                                      {t("prod_list_delete") || "Delete"}
                                    </button>
                                  </>
                                )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
