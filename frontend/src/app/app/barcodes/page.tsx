"use client";

import { useEffect, useRef, useState } from "react";
import { api, fetchAll } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { ErrorState, Pagination, Spinner, usePagination } from "@/components/ui";

type Product = { id: number; name: string; sku: string; barcode: string };

export default function BarcodesPage() {
  const { can, isOwner } = useAuth();
  const canManage = isOwner || can("manage_products");

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  // Assign form
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [newBarcode, setNewBarcode] = useState("");
  const [assigning, setAssigning] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setAllProducts(await fetchAll<Product>("/catalog/products/"));
    } catch (e: any) {
      setError(e?.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  // Products that already have a barcode
  const withBarcode = allProducts.filter((p) => p.barcode && p.barcode.trim() !== "");
  // Products without a barcode (for suggestions) - wait, now they can have multiple, so just all products are valid for suggestions
  // but to keep it simple, we let them search all products.
  const withoutBarcode = allProducts; // They can assign additional barcodes to ANY product now.

  // Filter shown list
  const shown = withBarcode.filter((p) => {
    const q = filter.trim().toLowerCase();
    return !q || `${p.name} ${p.sku} ${p.barcode}`.toLowerCase().includes(q);
  });
  const { paged, page, setPage, totalPages, total } = usePagination(shown, [filter]);

  // Search suggestions for assign form
  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) { setSuggestions([]); return; }
    setSuggestions(
      withoutBarcode
        .filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(q))
        .slice(0, 8)
    );
  }, [search, allProducts, withoutBarcode]);

  async function assignBarcode() {
    if (!selected || !newBarcode.trim()) return;
    const code = newBarcode.trim();
    // Check barcode not already used
    if (allProducts.some((p) => p.barcode.split(",").map(c=>c.trim()).includes(code))) {
      alert(`Barcode "${code}" is already assigned to a product.`);
      return;
    }
    setAssigning(true);
    try {
      const existingCodes = (selected.barcode || "").split(",").map(c => c.trim()).filter(Boolean);
      const newBarcodeStr = Array.from(new Set([...existingCodes, code])).join(", ");
      await api(`/catalog/products/${selected.id}/`, { method: "PATCH", body: { barcode: newBarcodeStr } });
      setAllProducts((prev) =>
        prev.map((p) => p.id === selected.id ? { ...p, barcode: newBarcodeStr } : p)
      );
      setSelected(null);
      setSearch("");
      setNewBarcode("");
    } catch (e: any) {
      alert(e?.message || "Could not assign barcode");
    } finally {
      setAssigning(false);
    }
  }

  async function saveBarcode(p: Product, index: number) {
    const editKey = `${p.id}-${index}`;
    let codes = (p.barcode || "").split(",").map(c => c.trim()).filter(Boolean);
    const value = (edits[editKey] ?? codes[index]).trim();
    
    if (!value) { await removeBarcode(p, index); return; }
    
    // Check if new value is used by ANOTHER product
    if (allProducts.some((x) => x.id !== p.id && x.barcode.split(",").map(c=>c.trim()).includes(value))) {
      alert(`Barcode "${value}" is already assigned to another product.`);
      return;
    }
    
    codes[index] = value;
    const newBarcodeStr = Array.from(new Set(codes)).join(", ");
    
    setSaving(editKey);
    try {
      await api(`/catalog/products/${p.id}/`, { method: "PATCH", body: { barcode: newBarcodeStr } });
      setAllProducts((prev) => prev.map((r) => r.id === p.id ? { ...r, barcode: newBarcodeStr } : r));
      setEdits((e) => { const n = { ...e }; delete n[editKey]; return n; });
    } catch (e: any) {
      alert(e?.message || "Could not save barcode");
    } finally {
      setSaving(null);
    }
  }

  async function removeBarcode(p: Product, index: number) {
    let codes = (p.barcode || "").split(",").map(c => c.trim()).filter(Boolean);
    const codeToRemove = codes[index];
    if (!confirm(`Remove barcode "${codeToRemove}" from "${p.name}"?`)) return;
    
    const editKey = `${p.id}-${index}`;
    codes.splice(index, 1);
    const newBarcodeStr = Array.from(new Set(codes)).join(", ");
    
    setSaving(editKey);
    try {
      await api(`/catalog/products/${p.id}/`, { method: "PATCH", body: { barcode: newBarcodeStr } });
      setAllProducts((prev) => prev.map((r) => r.id === p.id ? { ...r, barcode: newBarcodeStr } : r));
      setEdits((e) => { const n = { ...e }; delete n[editKey]; return n; });
    } catch (e: any) {
      alert(e?.message || "Could not remove barcode");
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <Spinner label="Loading barcodes…" />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="vstack gap-3">
      <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
        <div>
          <div className="fw-semibold">Barcode Management</div>
          <div className="text-secondary small">
            {withBarcode.length} product{withBarcode.length !== 1 ? "s" : ""} with barcode ·{" "}
            {withoutBarcode.length} without
          </div>
        </div>
      </div>

      {/* ── Assign barcode form ── */}
      {canManage && (
        <div className="card shadow-sm">
          <div className="card-body">
            <div className="fw-semibold small mb-2">Assign barcode to a product</div>
            <div className="row g-2 align-items-end">
              {/* Product search */}
              <div className="col-md-5 position-relative">
                <label className="small text-secondary">Search product (without barcode)</label>
                {selected ? (
                  <div className="input-group input-group-sm">
                    <span className="form-control bg-light text-truncate">{selected.name}</span>
                    <button className="btn btn-outline-secondary" onClick={() => { setSelected(null); setSearch(""); }}>✕</button>
                  </div>
                ) : (
                  <>
                    <input
                      className="form-control form-control-sm"
                      placeholder="Type name or SKU…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {suggestions.length > 0 && (
                      <div className="position-absolute w-100 bg-white border rounded shadow-sm mt-1" style={{ zIndex: 999, maxHeight: "14rem", overflowY: "auto" }}>
                        {suggestions.map((p) => (
                          <button
                            key={p.id}
                            className="d-block w-100 text-start px-3 py-2 border-0 bg-transparent hover-bg small"
                            style={{ borderBottom: "1px solid #f0f0f0" }}
                            onClick={() => {
                              setSelected(p);
                              setSearch(p.name);
                              setSuggestions([]);
                              setTimeout(() => barcodeInputRef.current?.focus(), 50);
                            }}
                          >
                            <span className="fw-medium">{p.name}</span>
                            {p.sku && <span className="text-secondary ms-2">{p.sku}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Barcode value */}
              <div className="col-md-5">
                <label className="small text-secondary">Barcode (scan or type)</label>
                <input
                  ref={barcodeInputRef}
                  className="form-control form-control-sm"
                  placeholder="Scan barcode or enter manually…"
                  value={newBarcode}
                  onChange={(e) => setNewBarcode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); assignBarcode(); } }}
                  disabled={!selected}
                />
              </div>

              {/* Assign button */}
              <div className="col-md-2">
                <button
                  className="btn btn-brand btn-sm w-100"
                  disabled={!selected || !newBarcode.trim() || assigning}
                  onClick={assignBarcode}
                >
                  {assigning ? "Saving…" : "Assign"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Products WITH barcodes ── */}
      <div className="d-flex align-items-center gap-2">
        <input
          placeholder="Filter by name, SKU, or barcode…"
          className="form-control form-control-sm"
          style={{ maxWidth: "22rem" }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {filter && (
          <button className="btn btn-sm btn-outline-secondary py-0" onClick={() => setFilter("")}>✕ Clear</button>
        )}
      </div>

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-striped table-sm align-middle mb-0">
            <thead className="thead-6">
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>SKU</th>
                <th>Barcode</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr data-empty="">
                  <td colSpan={canManage ? 5 : 4} className="text-center text-secondary py-5">
                    <div style={{ fontSize: "2rem" }}>▦</div>
                    <div className="fw-semibold mt-2">
                      {filter ? `No products match "${filter}"` : "No products have barcodes yet"}
                    </div>
                    {!filter && canManage && (
                      <div className="small mt-1">Use the form above to assign a barcode to a product.</div>
                    )}
                  </td>
                </tr>
              ) : (
                paged.flatMap((p, i) => {
                  const codes = (p.barcode || "").split(",").map(c => c.trim()).filter(Boolean);
                  if (codes.length === 0) return [];
                  
                  return codes.map((bc, codeIdx) => {
                    const editKey = `${p.id}-${codeIdx}`;
                    const editVal = edits[editKey] ?? bc;
                    const changed = editVal !== bc;
                    const rowNum = (page - 1) * 20 + i + 1;
                    return (
                      <tr key={editKey}>
                        <td className="text-secondary small">{codeIdx === 0 ? rowNum : ""}</td>
                        <td className="fw-medium">{codeIdx === 0 ? p.name : <span className="text-secondary">↳</span>}</td>
                        <td className="text-secondary">{codeIdx === 0 ? (p.sku || "—") : ""}</td>
                        <td>
                          {canManage ? (
                            <input
                              className="form-control form-control-sm"
                              style={{ maxWidth: "16rem", fontFamily: "monospace" }}
                              value={editVal}
                              onChange={(e) => setEdits({ ...edits, [editKey]: e.target.value })}
                              onKeyDown={(e) => { if (e.key === "Enter") saveBarcode(p, codeIdx); }}
                            />
                          ) : (
                            <span style={{ fontFamily: "monospace" }}>{bc}</span>
                          )}
                        </td>
                        {canManage && (
                          <td className="text-end text-nowrap pe-2">
                            {changed && (
                              <button
                                className="btn btn-sm btn-brand py-0 me-2"
                                disabled={saving === editKey}
                                onClick={() => saveBarcode(p, codeIdx)}
                              >
                                {saving === editKey ? "…" : "Save"}
                              </button>
                            )}
                            <button
                              className="btn btn-sm btn-outline-danger py-0"
                              disabled={saving === editKey}
                              onClick={() => removeBarcode(p, codeIdx)}
                            >
                              Remove
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  });
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} setPage={setPage} total={total} />
      </div>
    </div>
  );
}
