"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, unwrap } from "@/lib/api";
import { ErrorState, Spinner } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import toast from "react-hot-toast";
import { useLanguage } from "@/contexts/LanguageContext";

type Named = { id: number; name: string };
type UnitT = { id: number; name: string; short_code?: string; measure_type?: string };

export default function ProductEditPage() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const isSpecialShop = user?.shop_business_type === "camical" || user?.shop_business_type === "supershop" || user?.shop_business_type === "cosmetics" || user?.shop_business_type === "beauty";
  const isFashionShop = user?.shop_business_type === "fashion" || user?.shop_business_type === "footwear" || user?.shop_business_type === "handcrafts" || user?.shop_business_type === "jewelry" || user?.shop_business_type === "apparel";
  const { id } = useParams<{ id: string }>();

  const router = useRouter();
  const [form, setForm] = useState<any>(null);
  const [categories, setCategories] = useState<Named[]>([]);
  const [brands, setBrands] = useState<Named[]>([]);
  const [units, setUnits] = useState<UnitT[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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
  const [pricingMode, setPricingMode] = useState<'regular' | 'bulk'>('regular');

  const bulkActive = isSpecialShop && Number(form?.purchase_multiplier || 1) > 1 && pricingMode === "bulk";

  useEffect(() => {
    (async () => {
      try {
        const [p, c, b, u] = await Promise.all([
          api(`/catalog/products/${id}/`),
          api("/catalog/categories/").catch(() => []),
          api("/catalog/brands/").catch(() => []),
          api("/catalog/units/").catch(() => []),
        ]);
        // Restore bulk mode if this product was entered with drum-level prices
        const mult = Number(p?.purchase_multiplier || 1);
        const hasDrumVals = Number(p?.full_pack_cost || 0) > 0 || Number(p?.full_pack_sell || 0) > 0;
        if (isSpecialShop && mult > 1 && hasDrumVals) {
          setPricingMode("bulk");
          p.full_pack_cost = p.full_pack_cost ? String(p.full_pack_cost) : "";
          p.full_pack_sell = p.full_pack_sell ? String(p.full_pack_sell) : "";
        } else {
          p.full_pack_cost = p.full_pack_cost ? String(p.full_pack_cost) : "";
          p.full_pack_sell = p.full_pack_sell ? String(p.full_pack_sell) : "";
        }
        p.unit = p.unit ? String(p.unit) : "";
        p.purchase_unit = p.purchase_unit ? String(p.purchase_unit) : "";
        p.purchase_multiplier = p.purchase_multiplier ? String(p.purchase_multiplier) : "1";
        setForm(p);
        setCategories(unwrap<Named>(c));
        setBrands(unwrap<Named>(b));
        setUnits(unwrap<UnitT>(u));
      } catch (e: any) {
        setError(e?.message || t("pe_err_load"));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/catalog/products/${id}/`, {
        method: "PATCH",
        body: {
          name: form.name,
          sku: form.sku,
          barcode: form.barcode,
          category: form.category || null,
          brand: form.brand || null,
          unit: form.unit ? Number(form.unit) : null,
          purchase_unit: form.purchase_unit ? Number(form.purchase_unit) : null,
          cost_price: form.cost_price,
          selling_price: form.selling_price,
          purchase_multiplier: form.purchase_multiplier !== "" ? Number(form.purchase_multiplier) : 1,
          full_pack_cost: form.full_pack_cost !== "" ? Number(form.full_pack_cost) : 0,
          full_pack_sell: form.full_pack_sell !== "" ? Number(form.full_pack_sell) : 0,
          reorder_level: form.reorder_level === "" || form.reorder_level == null ? 5 : Math.max(0, Math.round(Number(form.reorder_level) || 0)),
          warranty_months: isFashionShop ? 0 : (form.warranty_months !== "" && form.warranty_months != null ? Number(form.warranty_months) : 0),
          replacement_guarantee_days: form.replacement_guarantee_days !== "" && form.replacement_guarantee_days != null ? Number(form.replacement_guarantee_days) : 0,
          fabric_material: form.fabric_material || "",
          gender_target: form.gender_target || "",
          season: form.season || "",
          style_type: form.style_type || "",
          fit_type: form.fit_type || "",
          collection_name: form.collection_name || "",
          care_instructions: form.care_instructions || "",
          size_variants: form.size_variants || [],
          description: form.description,
          is_active: form.is_active,
          track_inventory: form.track_inventory !== false,
        },
      });
      toast.success(lang === "bn" ? "প্রোডাক্ট সফলভাবে আপডেট হয়েছে" : "Product updated successfully");
      router.push(`/app/products/${id}`);

    } catch (e: any) {
      toast.error(e?.message || t("pe_err_save"));
      setSaving(false);
    }
  }

  if (loading) return <Spinner label={t("pe_loading")} />;
  if (error) return <ErrorState error={error} />;
  if (!form) return null;

  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  const selectedBaseUnit = units.find(u => String(u.id) === String(form.unit));
  const selectedBulkUnit = units.find(u => String(u.id) === String(form.purchase_unit));

  return (
    <div className="vstack gap-3" style={{ maxWidth: "52rem" }}>
      <h1 className="h4 fw-bold text-brand mb-0">{t("pe_title")}</h1>
      <div className="card shadow-sm">
        <div className="card-body">
          <form onSubmit={save} className="row g-3">
            <div className="col-md-6">
              <label className="small fw-medium">{t("pe_lbl_name")}</label>
              <input required className="form-control form-control-sm" value={form.name || ""} onChange={set("name")} />
            </div>
            <div className="col-md-6">
              <label className="small fw-medium">{t("pe_lbl_sku")}</label>
              <input className="form-control form-control-sm" value={form.sku || ""} onChange={set("sku")} />
            </div>
            <div className="col-md-4">
              <label className="small">{t("pe_lbl_cat")}</label>
              <select className="form-select form-select-sm" value={form.category || ""} onChange={set("category")}>
                <option value="">{t("pe_opt_none")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="small">{t("pe_lbl_brand")}</label>
              <select className="form-select form-select-sm" value={form.brand || ""} onChange={set("brand")}>
                <option value="">{t("pe_opt_none")}</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="small fw-medium">{isSpecialShop ? (lang === "bn" ? "বিক্রয় ইউনিট (Unit)" : "Sale Unit") : (t("pe_lbl_unit") || "Unit")}</label>
              <select className="form-select form-select-sm" value={form.unit || ""} onChange={set("unit")}>
                <option value="">{isSpecialShop ? (lang === "bn" ? "-- ইউনিট সিলেক্ট করুন --" : "-- Select Unit --") : (lang === "bn" ? "পিস (Piece / Pcs)" : "Piece / Pcs")}</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.short_code ? `(${u.short_code})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {isSpecialShop && (
              <>
                <div className="col-md-4">
                  <label className="small fw-medium text-primary">{lang === "bn" ? "পাইকারি/ড্রাম ইউনিট (Purchase Unit)" : "Bulk/Purchase Unit"}</label>
                  <select className="form-select form-select-sm" value={form.purchase_unit || ""} onChange={set("purchase_unit")}>
                    <option value="">{lang === "bn" ? "-- ড্রাম/বক্স ইউনিট (ঐচ্ছিক) --" : "-- Select Bulk Unit (Optional) --"}</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} {u.short_code ? `(${u.short_code})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="small fw-semibold text-primary" title="Multiplier">{lang === "bn" ? "প্রতি ড্রাম/বক্সে পরিমাণ" : "Qty per Drum/Box"}</label>
                  <input type="number" step="0.001" min="1" className="form-control form-control-sm"
                    value={form.purchase_multiplier || "1"}
                    placeholder="e.g. 50"
                    onChange={(e) => {
                      const newMult = e.target.value;
                      const multiplierVal = Number(newMult) || 1;
                      const packCost = Number(form.full_pack_cost) || 0;
                      const packSell = Number(form.full_pack_sell) || 0;
                      const perUnitCost = packCost > 0 ? (packCost / multiplierVal).toFixed(2) : form.cost_price;
                      const perUnitSell = packSell > 0 ? (packSell / multiplierVal).toFixed(2) : form.selling_price;
                      setForm({ ...form, purchase_multiplier: newMult, cost_price: perUnitCost, selling_price: perUnitSell });
                    }} />
                </div>
                <div className="col-md-4">
                  <label className="small fw-semibold text-primary">{lang === "bn" ? "দাম নির্ধারণ পদ্ধতি" : "Pricing Method"}</label>
                  <select className="form-select form-select-sm" value={pricingMode}
                    onChange={(e) => {
                      const mode = e.target.value as 'regular' | 'bulk';
                      setPricingMode(mode);
                    }}>
                    <option value="regular">{lang === "bn" ? "সাধারণ (প্রতি ইউনিট)" : "Regular (per unit)"}</option>
                    <option value="bulk">{lang === "bn" ? "বাল্ক অটো-ক্যালকুলেট (ড্রাম)" : "Bulk Auto-Calculate"}</option>
                  </select>
                </div>
              </>
            )}

            {bulkActive && (
              <>
                <div className="col-md-3">
                  <label className="small text-primary fw-medium">Full {selectedBulkUnit?.name || "Drum/Box"} Cost</label>
                  <div className="input-group input-group-sm">
                    <span className="input-group-text">৳</span>
                    <input type="number" step="0.01" min="0" className="form-control"
                      value={form.full_pack_cost || ""}
                      placeholder="e.g. 20000"
                      onChange={(e) => {
                        const packCost = e.target.value;
                        const perUnitCost = packCost && Number(packCost) > 0 && Number(form.purchase_multiplier || 1) > 0
                          ? (Number(packCost) / Number(form.purchase_multiplier || 1)).toFixed(2) : "";
                        setForm({ ...form, full_pack_cost: packCost, cost_price: perUnitCost });
                      }} />
                  </div>
                </div>
                <div className="col-md-3">
                  <label className="small text-primary fw-medium">Full {selectedBulkUnit?.name || "Drum/Box"} Sell</label>
                  <div className="input-group input-group-sm">
                    <span className="input-group-text">৳</span>
                    <input type="number" step="0.01" min="0" className="form-control"
                      value={form.full_pack_sell || ""}
                      placeholder="e.g. 24000"
                      onChange={(e) => {
                        const packSell = e.target.value;
                        const perUnitSell = packSell && Number(packSell) > 0 && Number(form.purchase_multiplier || 1) > 0
                          ? (Number(packSell) / Number(form.purchase_multiplier || 1)).toFixed(2) : "";
                        setForm({ ...form, full_pack_sell: packSell, selling_price: perUnitSell });
                      }} />
                  </div>
                </div>
              </>
            )}

            <div className="col-md-3">
              <label className="small fw-medium">
                {bulkActive ? `Cost per ${selectedBaseUnit?.name || "Unit"}` : t("pe_lbl_cost")}
              </label>
              <div className="input-group input-group-sm">
                <span className="input-group-text">৳</span>
                <input type="number" step="0.01" className="form-control" value={form.cost_price || ""} onChange={set("cost_price")} />
              </div>
            </div>
            <div className="col-md-3">
              <label className="small fw-medium">
                {bulkActive ? `Sell per ${selectedBaseUnit?.name || "Unit"}` : t("pe_lbl_selling")}
              </label>
              <div className="input-group input-group-sm">
                <span className="input-group-text">৳</span>
                <input type="number" step="0.01" className="form-control" value={form.selling_price || ""} onChange={set("selling_price")} />
              </div>
              {bulkActive && Number(form.selling_price) > 0 && Number(form.cost_price) > 0 && (
                <div className="text-success fw-bold" style={{ fontSize: "0.72rem", marginTop: "2px" }}>
                  ✅ Margin: ৳{(Number(form.selling_price) - Number(form.cost_price)).toFixed(2)} / {selectedBaseUnit?.short_code || "Unit"}
                </div>
              )}
            </div>
            <div className="col-md-3">
              <label className="small">{t("pe_lbl_reorder")}</label>
              <input type="number" step="1" min="0" className="form-control form-control-sm" value={form.reorder_level || ""} onChange={set("reorder_level")} />
            </div>
            {!isSpecialShop && !isFashionShop && (
              <div className="col-md-3">
                <label className="small">{t("pe_lbl_warranty")}</label>
                <input type="number" min="0" className="form-control form-control-sm" value={form.warranty_months || ""} onChange={set("warranty_months")} placeholder="0" />
              </div>
            )}
            {isFashionShop && (
              <div className="col-md-3">
                <label className="small" title={t("fashion_exchange_hint") || "Days allowed for size/defect replacement"}>
                  {t("fashion_lbl_exchange_days") || (lang === "bn" ? "রিটার্ন / এক্সচেঞ্জ (দিন)" : "Exchange / Return (Days)")}
                </label>
                <input
                  type="number"
                  min="0"
                  className="form-control form-control-sm"
                  value={form.replacement_guarantee_days || ""}
                  onChange={set("replacement_guarantee_days")}
                  placeholder="7"
                />
              </div>
            )}

            <div className="col-md-6 d-flex align-items-end gap-4">
              <div className="form-check">
                <input className="form-check-input" type="checkbox" id="isActive" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                <label className="form-check-label small" htmlFor="isActive">
                  {t("pe_lbl_active")}
                </label>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" id="trackInventory" checked={form.track_inventory !== false} onChange={(e) => setForm({ ...form, track_inventory: e.target.checked })} />
                <label className="form-check-label small" htmlFor="trackInventory">
                  {lang === "bn" ? "ইনভেন্টরি স্টক ট্র্যাক করুন" : "Track Stock Inventory"}
                </label>
              </div>
            </div>

            <div className="col-12">
              <label className="small">{t("pe_lbl_desc")}</label>
              <textarea className="form-control form-control-sm" rows={2} value={form.description || ""} onChange={set("description")} />
            </div>
            {/* ── Fashion Section in Edit Form ───────────── */}
            {isFashionShop && (
              <div className="col-12">
                <div className="p-2 rounded mb-2" style={{background:"#f8f4ff",border:"1px solid #c084fc"}}>
                  <div className="fw-semibold mb-2" style={{color:"#7c3aed",fontSize:"0.85rem"}}>
                    👗 {lang === "bn" ? "পোশাক ও ফ্যাশন বিবরণ" : "Apparel & Fashion Details"}
                  </div>
                  <div className="row g-2">
                    {/* 1. Fabric Material */}
                    <div className="col-md-3">
                      <label className="small text-primary fw-medium">{lang === "bn" ? "কাপড়ের ধরন" : "Fabric Material"}</label>
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
                          {lang === "bn" ? "যোগ" : "+ Add"}
                        </button>
                      </div>
                    </div>

                    {/* 2. Target Group / Gender */}
                    <div className="col-md-3">
                      <label className="small text-primary fw-medium">{lang === "bn" ? "টার্গেট গ্রুপ" : "Target Group (Gender)"}</label>
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
                          {lang === "bn" ? "যোগ" : "+ Add"}
                        </button>
                      </div>
                    </div>

                    {/* 3. Season */}
                    <div className="col-md-3">
                      <label className="small text-primary fw-medium">{lang === "bn" ? "মৌসুম" : "Season"}</label>
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
                          {lang === "bn" ? "যোগ" : "+ Add"}
                        </button>
                      </div>
                    </div>

                    {/* 4. Style Type */}
                    <div className="col-md-3">
                      <label className="small text-primary fw-medium">{lang === "bn" ? "স্টাইল" : "Style Type"}</label>
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
                          {lang === "bn" ? "যোগ" : "+ Add"}
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
                          {lang === "bn" ? "যোগ" : "+ Add"}
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
                          {lang === "bn" ? "যোগ" : "+ Add"}
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
                          {lang === "bn" ? "যোগ" : "+ Add"}
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* Size Variants with Creatable Datalist */}
                  <div className="mt-2">
                    <label className="small text-primary fw-medium">{lang==="bn"?"সাইজ ও রঙের স্টক":"Size & Color Stock"}</label>
                    {(form.size_variants||[]).map((v:any,i:number)=>(
                      <div key={i} className="row g-1 mb-1 align-items-center">
                        <div className="col-3">
                          <input
                            className="form-control form-control-sm"
                            list="edit-fashion-size-list"
                            placeholder={lang==="bn"?"সাইজ (টাইপ করুন)":"Size (type or pick)"}
                            value={v.size||""}
                            onChange={e=>{const sv=[...form.size_variants];sv[i]={...sv[i],size:e.target.value};setForm({...form,size_variants:sv})}}
                          />
                          <datalist id="edit-fashion-size-list">
                            {["XS","S","M","L","XL","XXL","XXXL","Free Size","28","30","32","34","36","38","40","42","44","46","1-2Y","3-4Y","5-6Y","7-8Y"].map((s:string)=><option key={s} value={s} />)}
                          </datalist>
                        </div>
                        <div className="col-4">
                          <input
                            className="form-control form-control-sm"
                            placeholder={lang==="bn"?"রং (Color)":"Color"}
                            value={v.color||""}
                            onChange={e=>{const sv=[...form.size_variants];sv[i]={...sv[i],color:e.target.value};setForm({...form,size_variants:sv})}}
                          />
                        </div>
                        <div className="col-3">
                          <input
                            type="number"
                            min="0"
                            className="form-control form-control-sm"
                            placeholder={lang==="bn"?"পরিমাণ":"Qty"}
                            value={v.stock||""}
                            onChange={e=>{const sv=[...form.size_variants];sv[i]={...sv[i],stock:Number(e.target.value)};setForm({...form,size_variants:sv})}}
                          />
                        </div>
                        <div className="col-2">
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm w-100"
                            onClick={()=>{const sv=form.size_variants.filter((_:any,j:number)=>j!==i);setForm({...form,size_variants:sv})}}
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm mt-1"
                      onClick={()=>setForm({...form,size_variants:[...(form.size_variants||[]),{size:"M",color:"",stock:0}]})}
                    >
                      + {lang==="bn"?"ভেরিয়েন্ট যোগ করুন":"Add Variant"}
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="col-12 d-flex gap-2">
              <button className="btn btn-brand btn-sm" disabled={saving}>
                {saving ? t("pe_btn_saving") : t("pe_btn_save")}
              </button>
              <button type="button" className="btn btn-light btn-sm" onClick={() => router.back()}>
                {t("pe_btn_cancel")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
