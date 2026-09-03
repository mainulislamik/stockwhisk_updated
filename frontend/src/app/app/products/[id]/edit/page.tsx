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
  const { id } = useParams<{ id: string }>();

  const router = useRouter();
  const [form, setForm] = useState<any>(null);
  const [categories, setCategories] = useState<Named[]>([]);
  const [brands, setBrands] = useState<Named[]>([]);
  const [units, setUnits] = useState<UnitT[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
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
          warranty_months: form.warranty_months,
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
              <label className="small fw-semibold text-primary">{lang === "bn" ? "খুচরা ইউনিট (Base)" : "Retail Unit (Base)"}</label>
              <select className="form-select form-select-sm" value={form.unit || ""} onChange={set("unit")}>
                <option value="">{lang === "bn" ? "-- সিলেক্ট করুন --" : "-- Select --"}</option>
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
                  <label className="small fw-semibold text-primary">{lang === "bn" ? "হোলসেইল/ড্রাম ইউনিট (Bulk)" : "Bulk/Purchase Unit"}</label>
                  <select className="form-select form-select-sm" value={form.purchase_unit || ""} onChange={set("purchase_unit")}>
                    <option value="">{lang === "bn" ? "-- সিলেক্ট করুন --" : "-- Select --"}</option>
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
            {!isSpecialShop && (
              <div className="col-md-3">
                <label className="small">{t("pe_lbl_warranty")}</label>
                <input type="number" className="form-control form-control-sm" value={form.warranty_months || ""} onChange={set("warranty_months")} />
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
