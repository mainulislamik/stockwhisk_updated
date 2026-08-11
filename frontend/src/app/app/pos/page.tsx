"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, useApi, Paginated } from "@/lib/api";
import { ErrorState, Spinner, money } from "@/components/ui";
import { ScannerModal } from "@/components/ScannerModal";
import toast from "react-hot-toast";

type ProductUnit = { id: number; barcode: string; effective_selling_price?: string; effective_cost_price?: string; effective_warranty_months?: number };
type Product = {
  id: number; name: string; sku: string; barcode?: string;
  selling_price: string; cost_price: string; current_stock: string; track_inventory?: boolean;
  warranty_months?: number;
  units?: ProductUnit[];
  scanned_unit?: ProductUnit;
};
type CartLine = { product: Product; qty: number; price: number; discount: number; selectedUnits: ProductUnit[] };
type ScanMsg = { text: string; ok: boolean } | null;

export default function PosPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartLine[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Server-side fetching for the main POS search
  const { data: posData } = useApi<Paginated<Product>>("/catalog/products/", { search: debouncedQuery, page_size: 20 });
  const shown = posData?.results || [];
  const [scanning, setScanning] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanMsg, setScanMsg] = useState<ScanMsg>(null);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Assign-barcode modal state
  const [showAssign, setShowAssign] = useState(false);
  const [assignBarcode, setAssignBarcode] = useState("");
  const [assignSearch, setAssignSearch] = useState("");
  const [debouncedAssignSearch, setDebouncedAssignSearch] = useState("");
  const [assignSelected, setAssignSelected] = useState<Product | null>(null);
  const [assignSaving, setAssignSaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedAssignSearch(assignSearch), 300);
    return () => clearTimeout(timer);
  }, [assignSearch]);

  const { data: assignData } = useApi<Paginated<Product>>("/catalog/products/", { search: debouncedAssignSearch, page_size: 8 });
  const assignSuggestions = assignData?.results || [];

  // Unit selection modal
  const [unitSelectProduct, setUnitSelectProduct] = useState<Product | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("pos_cart");
    if (saved) { try { setCart(JSON.parse(saved)); } catch {} }
  }, []);

  // ── Cart helpers ────────────────────────────────────────────────────────
  function addToCart(p: Product, specificUnit?: ProductUnit) {
    setCart((c) => {
      const exIndex = c.findIndex((l) => l.product.id === p.id);
      if (exIndex >= 0) {
        const ex = c[exIndex];
        if (specificUnit) {
          if (ex.selectedUnits.some((u) => u.id === specificUnit.id)) {
            return c; // already added
          }
          const newC = [...c];
          newC[exIndex] = { ...ex, qty: ex.qty + 1, selectedUnits: [...ex.selectedUnits, specificUnit] };
          return newC;
        }
        const newC = [...c];
        newC[exIndex] = { ...ex, qty: ex.qty + 1 };
        return newC;
      }
      return [...c, { 
        product: p, 
        qty: 1, 
        price: Number(specificUnit?.effective_selling_price || p.selling_price), 
        discount: 0, 
        selectedUnits: specificUnit ? [specificUnit] : [] 
      }];
    });
  }
  function setQty(id: number, qty: number) {
    setCart((c) => c.map((l) => l.product.id === id ? { ...l, qty: Math.max(1, qty) } : l));
  }
  function removeLine(id: number) { setCart((c) => c.filter((l) => l.product.id !== id)); }
  function clearCart() { setCart([]); sessionStorage.removeItem("pos_cart"); }

  function flash(text: string, ok: boolean) {
    setScanMsg({ text, ok });
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setScanMsg(null), 3000);
  }

  function tryAdd(p: Product) {
    if (p.track_inventory !== false && Number(p.current_stock) <= 0) {
      flash(`✗ Out of stock: ${p.name}`, false);
      return;
    }
    if (p.scanned_unit) {
      addToCart(p, p.scanned_unit);
      flash(`✓ Added unit: ${p.scanned_unit.barcode}`, true);
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }
    if (p.units && p.units.length > 0) {
      setUnitSelectProduct(p);
      return;
    }
    addToCart(p);
    flash(`✓ Added: ${p.name}`, true);
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  // ── Process code ────────────────────────────────────────────────────────
  const processCode = useCallback(async (code: string) => {
    if (!code) return;

    // 1. Exact local match from current search results
    const byBarcode = shown.find((p) => p.barcode && p.barcode === code);
    if (byBarcode) { tryAdd(byBarcode); return; }

    const bySku = shown.find((p) => p.sku && p.sku.toLowerCase() === code.toLowerCase());
    if (bySku) { tryAdd(bySku); return; }

    // 2b. Exact match on a specific UNIT barcode → add that exact unit directly
    // (skip the unit-picker modal). Unit barcodes are unique, so never add twice.
    for (const p of shown) {
      const unit = p.units?.find((u) => u.barcode === code);
      if (unit) {
        if (p.track_inventory !== false && Number(p.current_stock) <= 0) {
          flash(`✗ Out of stock: ${p.name}`, false); return;
        }
        const already = cart.some((l) => l.product.id === p.id && l.selectedUnits.some((u) => u.id === unit.id));
        if (already) {
          flash(`Already in cart: ${unit.barcode}`, false);
        } else {
          addToCart(p, unit);
          flash(`✓ Added unit: ${unit.barcode}`, true);
        }
        setQuery("");
        setTimeout(() => inputRef.current?.focus(), 50);
        return;
      }
    }

    // 2c. A full numeric code that found a product (matched via its unit index)
    // but is NOT one of its in-stock units → it's a sold/returned unit. Show a
    // clear message instead of opening the unit picker.
    if (query === code && /^\d{6,}$/.test(code)) {
      const soldHit = shown.find((p) =>
        !(p.sku && p.sku === code) &&
        !(p.barcode && p.barcode.split(",").map((s) => s.trim()).includes(code)) &&
        !p.units?.some((u) => u.barcode === code)
      );
      if (soldHit) {
        flash(`✗ Unit "${code}" is already sold or not in stock.`, false);
        setQuery("");
        setTimeout(() => inputRef.current?.focus(), 50);
        return;
      }
    }

    // 3. Exactly one filtered result → auto-add
    if (shown.length === 1 && query === code) { tryAdd(shown[0]); return; }

    // 4. Multiple results → keep showing
    if (shown.length > 1 && query === code) return;

    // 5. No local match → backend lookup
    setScanning(true);
    try {
      const product = await api<Product>("/pos/lookup/", { params: { barcode: code } });
      tryAdd(product);
    } catch {
      // Not found → offer to assign
      setScanMsg(null);
      setAssignBarcode(code);
      setAssignSearch("");
      setAssignSelected(null);
      setShowAssign(true);
    } finally {
      setScanning(false);
    }
  }, [shown, query, tryAdd, cart]);

  // ── Enter / scan handler ────────────────────────────────────────────────
  const handleEnter = useCallback(async () => {
    await processCode(query.trim());
  }, [query, processCode]);

  // ── Assign barcode from within POS ─────────────────────────────────────
  async function doAssign() {
    if (!assignSelected || !assignBarcode) return;
    setAssignSaving(true);
    try {
      await api(`/catalog/products/${assignSelected.id}/`, {
        method: "PATCH",
        body: { barcode: assignBarcode },
      });
      // Refresh shown list is automatic due to SWR mutate or next search
      setShowAssign(false);
      setQuery("");
      flash(`✓ Barcode assigned to "${assignSelected.name}" — scan again to add`, true);
    } catch (e: any) {
      toast.error(e?.message || "Could not assign barcode");
    } finally {
      setAssignSaving(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  const subtotal = cart.reduce((s, l) => s + l.qty * l.price - l.discount, 0);
  const itemCount = cart.reduce((s, l) => s + l.qty, 0);

  function goToCheckout() {
    sessionStorage.setItem("pos_cart", JSON.stringify(cart));
    router.push("/app/pos/customer");
  }

  return (
    <>
      <div className="row g-3">
        {/* ── Left panel ── */}
        <div className="col-lg-7 d-flex flex-column gap-3">
          <div className="text-secondary small fw-semibold">Point of Sale · Step 1: Scan or search products</div>

          {/* ── Scan / search input ── */}
          <div className="card shadow-sm border-brand">
            <div className="card-body py-3">
              <div className="input-group input-group-lg">
                <span className="input-group-text bg-white">
                  {scanning
                    ? <span className="spinner-border spinner-border-sm text-brand" />
                    : <span>▦</span>}
                </span>
                <input
                  ref={inputRef}
                  autoFocus
                  className="form-control"
                  placeholder="Scan barcode or type product name / SKU…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleEnter(); } }}
                />
                <button 
                  className="btn btn-outline-secondary d-md-none" 
                  onClick={() => setShowScanner(true)}
                  title="Scan with Mobile Camera"
                >
                  📷
                </button>
                {query && (
                  <button className="btn btn-outline-secondary" onClick={() => { setQuery(""); inputRef.current?.focus(); }}>✕</button>
                )}
              </div>

              {/* Feedback flash */}
              {scanMsg && (
                <div className={`mt-2 px-3 py-2 rounded small fw-semibold ${
                  scanMsg.ok ? "text-success bg-success bg-opacity-10" : "text-danger bg-danger bg-opacity-10"
                }`}>
                  {scanMsg.text}
                </div>
              )}

              {/* Status line */}
              <div className="mt-2 small text-secondary">
                {query
                  ? shown.length > 0
                    ? `${shown.length} product${shown.length > 1 ? "s" : ""} found — click to add, or press Enter${shown.length === 1 ? " to add" : ""}`
                    : "No match — press Enter to search backend or assign this barcode to a product"
                  : "Ready for scan or search..."
                }
              </div>
            </div>
          </div>

          {/* ── Product grid ── */}
          {shown.length === 0 && query ? (
            <div className="card shadow-sm">
              <div className="card-body text-center py-4 text-secondary small">
                No barcoded products match "<strong>{query}</strong>"
                <div className="mt-2">
                  Press <kbd>Enter</kbd> to search backend — if still not found, you can assign this barcode to a product.
                </div>
              </div>
            </div>
          ) : (
            <div className="row g-2" style={{ maxHeight: "52vh", overflowY: "auto" }}>
              {shown.map((p) => {
                const out = p.track_inventory !== false && Number(p.current_stock) <= 0;
                const inCart = cart.some((l) => l.product.id === p.id);
                const exactMatch = query.trim() !== "" && p.barcode === query.trim();
                return (
                  <div className="col-6 col-md-4" key={p.id}>
                    <button
                      className={`pos-item w-100 p-2 text-start ${inCart ? "pos-item-active" : ""} ${exactMatch ? "pos-item-exact" : ""}`}
                      disabled={out}
                      onClick={() => tryAdd(p)}
                    >
                      <div className="small fw-semibold text-truncate">{p.name}</div>
                      <div style={{ fontSize: ".7rem", fontFamily: "monospace", color: exactMatch ? "var(--brand-700,#1a73e8)" : "#94a3b8" }}>
                        {p.barcode}
                      </div>
                      <div className="d-flex justify-content-between align-items-center mt-1">
                        <span className="small fw-bold">{money(p.selling_price)}</span>
                        <span className={`small ${out ? "text-danger fw-semibold" : inCart ? "text-success fw-semibold" : "text-secondary"}`}
                              style={{ fontSize: ".68rem" }}>
                          {out ? "OUT" : inCart ? `✓ ×${cart.find(l => l.product.id === p.id)?.qty}` : `stock ${p.current_stock}`}
                        </span>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Cart ── */}
        <div className="col-lg-5">
          <div className="card shadow-sm" style={{ position: "sticky", top: "1rem" }}>
            <div className="card-header d-flex justify-content-between align-items-center">
              <span className="fw-semibold">
                🛒 Cart
                {itemCount > 0 && <span className="badge text-bg-secondary ms-2">{itemCount}</span>}
              </span>
              {cart.length > 0 && (
                <button className="btn btn-link btn-sm text-danger p-0" onClick={clearCart}>Clear</button>
              )}
            </div>
            <div className="card-body p-0">
              <div style={{ maxHeight: "52vh", overflowY: "auto" }}>
                <table className="table table-sm align-middle mb-0">
                  <tbody>
                    {cart.length === 0 ? (
                      <tr>
                        <td className="text-secondary text-center py-5 px-3">
                          <div style={{ fontSize: "2rem" }}>▦</div>
                          <div className="small mt-1">Scan a barcode or click a product to add</div>
                        </td>
                      </tr>
                    ) : cart.map((l) => (
                      <tr key={l.product.id}>
                        <td className="ps-3">
                          <div className="small fw-semibold">
                            {l.product.name}
                            {!!l.product.warranty_months && l.selectedUnits.length === 0 && (
                              <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill ms-2 fw-normal" style={{ fontSize: '.6rem' }}>
                                <i className="bi bi-shield-check me-1"></i>
                                {l.product.warranty_months} Mo
                              </span>
                            )}
                          </div>
                          <div className="text-secondary" style={{ fontSize: ".72rem" }}>{money(l.price)} each</div>
                          {l.selectedUnits.length > 0 && (
                            <div className="mt-1 d-flex flex-wrap gap-1">
                              {l.selectedUnits.map(u => (
                                <span key={u.id} className="badge bg-body-secondary text-secondary border fw-normal" style={{ fontSize: ".65rem" }}>
                                  {u.barcode}
                                  {!!u.effective_warranty_months && (
                                    <span className="text-warning-emphasis ms-1">
                                      <i className="bi bi-shield-check"></i> {u.effective_warranty_months}M
                                    </span>
                                  )}
                                </span>
                              ))}
                              <button 
                                className="btn btn-link btn-sm text-brand p-0 ms-1" 
                                style={{ fontSize: ".65rem" }}
                                onClick={() => setUnitSelectProduct(l.product)}
                              >
                                Edit units
                              </button>
                            </div>
                          )}
                        </td>
                        <td style={{ width: "5rem" }}>
                          {l.selectedUnits.length > 0 ? (
                            <div className="text-center fw-semibold small bg-body-secondary border rounded px-2 py-1">
                              {l.qty}
                            </div>
                          ) : (
                            <input
                              type="number" min={1}
                              className="form-control form-control-sm"
                              value={l.qty}
                              onChange={(e) => setQty(l.product.id, Number(e.target.value))}
                            />
                          )}
                        </td>
                        <td className="text-end small fw-bold">{money(l.qty * l.price - l.discount)}</td>
                        <td className="text-end pe-2">
                          <button className="btn btn-link btn-sm text-danger p-0" onClick={() => removeLine(l.product.id)}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-3 py-3 border-top">
                <div className="d-flex justify-content-between small mb-1">
                  <span className="text-secondary">Subtotal</span>
                  <span>{money(subtotal)}</span>
                </div>
                <div className="d-flex justify-content-between fw-bold mb-3">
                  <span>Total</span>
                  <span>{money(subtotal)}</span>
                </div>
                <button
                  className="btn btn-brand w-100 py-2 fw-semibold"
                  disabled={cart.length === 0}
                  onClick={goToCheckout}
                >
                  Continue to customer &amp; payment →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Assign-barcode modal ── */}
      {showAssign && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.45)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Barcode not found — assign it?</h5>
                <button className="btn-close" onClick={() => { setShowAssign(false); setTimeout(() => inputRef.current?.focus(), 50); }} />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <div className="small text-secondary mb-1">Scanned barcode</div>
                  <div className="px-3 py-2 bg-body-secondary rounded fw-bold" style={{ fontFamily: "monospace", letterSpacing: ".05em" }}>
                    {assignBarcode}
                  </div>
                </div>

                <div className="mb-3 position-relative">
                  <label className="form-label small">Which product does this barcode belong to?</label>
                  {assignSelected ? (
                    <div className="input-group input-group-sm">
                      <span className="form-control bg-body-secondary fw-medium text-truncate">{assignSelected.name}</span>
                      <button className="btn btn-outline-secondary" onClick={() => { setAssignSelected(null); setAssignSearch(""); }}>✕</button>
                    </div>
                  ) : (
                    <>
                      <input
                        autoFocus
                        className="form-control"
                        placeholder="Type product name or SKU to search…"
                        value={assignSearch}
                        onChange={(e) => setAssignSearch(e.target.value)}
                      />
                      {assignSuggestions.length > 0 && (
                        <div className="position-absolute w-100 bg-body border rounded shadow-sm mt-1" style={{ zIndex: 1060, maxHeight: "14rem", overflowY: "auto" }}>
                          {assignSuggestions.map((p) => (
                            <button
                              key={p.id}
                              className="d-block w-100 text-start px-3 py-2 border-0 border-bottom bg-transparent small text-body"
                              onClick={() => { setAssignSelected(p); setAssignSearch(p.name); }}
                            >
                              <span className="fw-medium">{p.name}</span>
                              {p.sku && <span className="text-secondary ms-2 small">{p.sku}</span>}
                              {p.barcode && <span className="text-warning ms-2 small">(has barcode: {p.barcode})</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary btn-sm" onClick={() => { setShowAssign(false); setTimeout(() => inputRef.current?.focus(), 50); }}>
                  Cancel
                </button>
                <button
                  className="btn btn-brand btn-sm"
                  disabled={!assignSelected || assignSaving}
                  onClick={doAssign}
                >
                  {assignSaving ? "Saving…" : `Assign barcode to "${assignSelected?.name ?? "…"}"`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── Select units modal ── */}
      {unitSelectProduct && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.45)" }}>
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Select Units to Sell</h5>
                <button className="btn-close" onClick={() => { setUnitSelectProduct(null); setTimeout(() => inputRef.current?.focus(), 50); }} />
              </div>
              <div className="modal-body">
                <div className="mb-3 small text-secondary">
                  <strong>{unitSelectProduct.name}</strong> has individual units. Select the exact units you are selling.
                </div>
                <div className="d-flex flex-column gap-2">
                  {unitSelectProduct.units?.map((u) => {
                    const line = cart.find(l => l.product.id === unitSelectProduct.id);
                    const isSelected = line?.selectedUnits.some(su => su.id === u.id);
                    return (
                      <label key={u.id} className={`d-flex justify-content-between align-items-center p-2 border rounded cursor-pointer ${isSelected ? 'border-brand bg-brand bg-opacity-10' : ''}`}>
                        <div className="d-flex align-items-center">
                          <input 
                            type="checkbox" 
                            className="form-check-input mt-0 me-2" 
                            checked={!!isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                addToCart(unitSelectProduct, u);
                              } else {
                                // Remove unit
                                setCart(c => {
                                  const newC = [...c];
                                  const idx = newC.findIndex(l => l.product.id === unitSelectProduct.id);
                                  if (idx >= 0) {
                                    const ex = newC[idx];
                                    const updatedUnits = ex.selectedUnits.filter(su => su.id !== u.id);
                                    if (updatedUnits.length === 0 && ex.qty === 1) {
                                      return newC.filter(l => l.product.id !== unitSelectProduct.id);
                                    }
                                    newC[idx] = { ...ex, qty: ex.qty - 1, selectedUnits: updatedUnits };
                                  }
                                  return newC;
                                });
                              }
                            }}
                          />
                          <div className="font-monospace small fw-medium">{u.barcode}</div>
                        </div>
                        <div className="text-end" style={{ fontSize: '.7rem' }}>
                          {!!u.effective_warranty_months && (
                            <span className="badge bg-warning-subtle text-warning-emphasis rounded-pill me-2 border border-warning-subtle">
                              <i className="bi bi-shield-check me-1"></i>
                              {u.effective_warranty_months} Mo Warranty
                            </span>
                          )}
                          <span className="text-secondary">Cost: {money(u.effective_cost_price || unitSelectProduct.cost_price || 0)}</span>
                          <span className="ms-2 fw-semibold text-body">Price: {money(u.effective_selling_price || unitSelectProduct.selling_price || 0)}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="modal-footer d-flex justify-content-between">
                <div className="small fw-semibold text-brand">
                  {cart.find(l => l.product.id === unitSelectProduct.id)?.selectedUnits.length || 0} selected
                </div>
                <button className="btn btn-brand btn-sm" onClick={() => { setUnitSelectProduct(null); setTimeout(() => inputRef.current?.focus(), 50); }}>
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Camera Scanner Modal ── */}
      {showScanner && (
        <ScannerModal
          onScan={(code) => {
            setShowScanner(false);
            setQuery(code);
            processCode(code);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </>
  );
}
