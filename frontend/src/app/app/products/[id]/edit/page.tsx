"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, unwrap } from "@/lib/api";
import { ErrorState, Spinner } from "@/components/ui";
import toast from "react-hot-toast";

type Named = { id: number; name: string };

export default function ProductEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState<any>(null);
  const [categories, setCategories] = useState<Named[]>([]);
  const [brands, setBrands] = useState<Named[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [p, c, b] = await Promise.all([
          api(`/catalog/products/${id}/`),
          api("/catalog/categories/").catch(() => []),
          api("/catalog/brands/").catch(() => []),
        ]);
        setForm(p);
        setCategories(unwrap<Named>(c));
        setBrands(unwrap<Named>(b));
      } catch (e: any) {
        setError(e?.message || "Failed to load product");
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
          cost_price: form.cost_price,
          selling_price: form.selling_price,
          reorder_level: form.reorder_level === "" || form.reorder_level == null ? 1 : Math.max(0, Math.round(Number(form.reorder_level) || 0)),
          warranty_months: form.warranty_months,
          description: form.description,
          is_active: form.is_active,
        },
      });
      router.push(`/app/products/${id}`);
    } catch (e: any) {
      toast.error(e?.message || "Could not save");
      setSaving(false);
    }
  }

  if (loading) return <Spinner label="Loading product…" />;
  if (error) return <ErrorState error={error} />;
  if (!form) return null;

  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="vstack gap-3" style={{ maxWidth: "48rem" }}>
      <h1 className="h4 fw-bold text-brand mb-0">Edit product</h1>
      <div className="card shadow-sm">
        <div className="card-body">
          <form onSubmit={save} className="row g-3">
            <div className="col-md-6">
              <label className="small">Product name</label>
              <input required className="form-control form-control-sm" value={form.name || ""} onChange={set("name")} />
            </div>
            <div className="col-md-6">
              <label className="small">SKU</label>
              <input className="form-control form-control-sm" value={form.sku || ""} onChange={set("sku")} />
            </div>
            <div className="col-md-6">
              <label className="small">Category</label>
              <select className="form-select form-select-sm" value={form.category || ""} onChange={set("category")}>
                <option value="">— none —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-6">
              <label className="small">Brand</label>
              <select className="form-select form-select-sm" value={form.brand || ""} onChange={set("brand")}>
                <option value="">— none —</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="small">Cost</label>
              <input type="number" step="0.01" className="form-control form-control-sm" value={form.cost_price || ""} onChange={set("cost_price")} />
            </div>
            <div className="col-md-3">
              <label className="small">Selling price</label>
              <input type="number" step="0.01" className="form-control form-control-sm" value={form.selling_price || ""} onChange={set("selling_price")} />
            </div>
            <div className="col-md-3">
              <label className="small">Reorder level</label>
              <input type="number" step="1" min="0" className="form-control form-control-sm" value={form.reorder_level || ""} onChange={set("reorder_level")} />
            </div>
            <div className="col-md-3">
              <label className="small">Warranty (months)</label>
              <input type="number" className="form-control form-control-sm" value={form.warranty_months || ""} onChange={set("warranty_months")} />
            </div>
            <div className="col-md-6">
              <label className="small">Barcode</label>
              <input className="form-control form-control-sm" value={form.barcode || ""} onChange={set("barcode")} />
            </div>
            <div className="col-md-6 d-flex align-items-end">
              <div className="form-check">
                <input className="form-check-input" type="checkbox" id="isActive" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                <label className="form-check-label" htmlFor="isActive">
                  Active
                </label>
              </div>
            </div>
            <div className="col-12">
              <label className="small">Description</label>
              <textarea className="form-control form-control-sm" rows={3} value={form.description || ""} onChange={set("description")} />
            </div>
            <div className="col-12 d-flex gap-2">
              <button className="btn btn-brand btn-sm" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button type="button" className="btn btn-light btn-sm" onClick={() => router.back()}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
