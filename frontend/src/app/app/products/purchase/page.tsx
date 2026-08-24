"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, fetchAll } from "@/lib/api";
import { ErrorState, Spinner, money } from "@/components/ui";
import { ScannerModal } from "@/components/ScannerModal";
import toast from "react-hot-toast";
import { useAuth } from "@/components/AuthProvider";
import { useScannerWebSocket } from "@/hooks/useScannerWebSocket";
import { useLanguage } from "@/contexts/LanguageContext";

type Product = {
  id: number;
  name: string;
  sku: string;
  barcode: string;
  cost_price: string;
  selling_price: string;
  current_stock: string;
  warranty_months: number;
  track_inventory: boolean;
};
type Supplier = { id: number; name: string };
type Branch = { id: number; name: string };
type ReceiveLine = { product: Product; quantity: number; unit_cost: number; barcodes: string[] };

const PAY_METHODS: Record<string, string> = {
  cash: "💵 Cash",
  bkash: "📱 bKash",
  nagad: "📱 Nagad",
  bank: "🏦 Bank",
};

export default function PurchaseProductPage() {
  const { t } = useLanguage();
  const router = useRouter();

  // Product search
  const [searchName, setSearchName] = useState("");
  const [searchBarcode, setSearchBarcode] = useState("");
  const [searchResults, setSearchResults] = useState<Product[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Selected product for pricing panel
  const [selected, setSelected] = useState<Product | null>(null);

  // Lines in "To Receive" cart
  const [lines, setLines] = useState<ReceiveLine[]>([]);

  // Bulk barcode scan
  const [barcodeText, setBarcodeText] = useState("");
  const [digitsPerCode, setDigitsPerCode] = useState(13);
  const [showScanner, setShowScanner] = useState(false);
  const [bulkQty, setBulkQty] = useState("");
  const [qtyTouched, setQtyTouched] = useState(false);
  const [autoGenerateBarcodes, setAutoGenerateBarcodes] = useState(false);

  const { user } = useAuth();
  const { isConnected: scannerConnected } = useScannerWebSocket(user?.shop ?? undefined, (barcode) => {
    setBarcodeText((prev) => (prev ? `${prev}\n${barcode}` : barcode));
  });

  // New product modal
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProd, setNewProd] = useState({ name: "", sku: "", cost_price: "", selling_price: "", reorder_level: "5" });
  const [savingProd, setSavingProd] = useState(false);

  // Sidebar / payment
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [supplier, setSupplier] = useState("");
  const [branch, setBranch] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");

  // New vendor quick-add
  const [showNewVendor, setShowNewVendor] = useState(false);
  const [newVendor, setNewVendor] = useState({ name: "", phone: "", address: "" });
  const [savingVendor, setSavingVendor] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetchAll<Supplier>("/purchasing/suppliers/").catch(() => []),
      fetchAll<Branch>("/tenants/branches/").catch(() => []),
    ]).then(([s, b]) => {
      setSuppliers(s);
      setBranches(b);
    });
  }, []);

  // ─── Search ──────────────────────────────────────────────────────────────
  const doSearch = useCallback(async () => {
    const q = searchName.trim();
    const bc = searchBarcode.trim();
    if (!q && !bc) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const params: Record<string, string> = {};
      if (q) params.search = q;
      if (bc) params.barcode = bc;
      const r = await api<any>("/catalog/products/", { params });
      const list: Product[] = Array.isArray(r) ? r : r?.results ?? [];
      setSearchResults(list);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchName, searchBarcode]);

  useEffect(() => {
    const timer = setTimeout(doSearch, 350);
    return () => clearTimeout(timer);
  }, [searchName, searchBarcode, doSearch]);

  function generateBarcodesHelper(p: Product, count: number): string[] {
    const prefix = p.sku ? p.sku.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase() : "BC";
    const timestamp = Date.now().toString().slice(-5);
    const generated: string[] = [];
    for (let i = 1; i <= count; i++) {
      const rand = Math.floor(100 + Math.random() * 900);
      generated.push(`${prefix}${timestamp}${i.toString().padStart(2, "0")}${rand}`);
    }
    return generated;
  }

  function selectProduct(p: Product) {
    setSelected(p);
    setSearchResults(null);
    setSearchName("");
    setSearchBarcode("");
    setBulkQty("");
    setQtyTouched(false);
    if (autoGenerateBarcodes) {
      const generated = generateBarcodesHelper(p, 1);
      setBarcodeText(generated.join("\n") + "\n");
    } else {
      setBarcodeText("");
    }
  }

  // ─── New product creation ────────────────────────────────────────────────
  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!newProd.name.trim()) return;
    setSavingProd(true);
    try {
      const p = await api<Product>("/catalog/products/", {
        method: "POST",
        body: {
          name: newProd.name.trim(),
          sku: newProd.sku.trim() || "",
          cost_price: newProd.cost_price || 0,
          selling_price: newProd.selling_price || 0,
          reorder_level:
            newProd.reorder_level === ""
              ? 5
              : Math.max(0, Math.round(Number(newProd.reorder_level) || 0)),
          track_inventory: true,
        },
      });
      setShowNewProduct(false);
      setNewProd({ name: "", sku: "", cost_price: "", selling_price: "", reorder_level: "5" });
      selectProduct(p);
      setLines((prev) => [
        ...prev,
        { product: p, quantity: 1, unit_cost: Number(p.cost_price) || 0, barcodes: autoGenerateBarcodes ? generateBarcodesHelper(p, 1) : [] },
      ]);
      toast.success(t("pp_success_create_prod") || "Product created successfully");
    } catch (e: any) {
      toast.error(e?.message || t("pp_err_create_prod"));
    } finally {
      setSavingProd(false);
    }
  }

  // ─── New vendor quick-add ─────────────────────────────────────────────────
  async function createVendor(e: React.FormEvent) {
    e.preventDefault();
    if (!newVendor.name.trim()) return;
    setSavingVendor(true);
    try {
      const s = await api<Supplier>("/purchasing/suppliers/", { method: "POST", body: newVendor });
      setSuppliers((prev) => [...prev, s]);
      setSupplier(String(s.id));
      setShowNewVendor(false);
      setNewVendor({ name: "", phone: "", address: "" });
      toast.success("Vendor added successfully");
    } catch (e: any) {
      toast.error(e?.message || "Could not add vendor");
    } finally {
      setSavingVendor(false);
    }
  }

  // ─── Bulk barcode scan helpers ────────────────────────────────────────────
  const parsedBarcodes = barcodeText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const hasBulkQty = !!selected && qtyTouched && bulkQty.trim() !== "";
  const effQty = hasBulkQty ? Math.max(1, Math.round(Number(bulkQty) || 0)) : (parsedBarcodes.length || 1);
  const tooManyBarcodes = hasBulkQty && parsedBarcodes.length > effQty;
  const qtyDisplay = qtyTouched ? bulkQty : (parsedBarcodes.length ? String(parsedBarcodes.length) : "");

  // Auto-generate barcodes for batch
  function generateBarcodesForSelected(overrideCount?: number) {
    if (!selected) {
      toast.error("Please select a product first");
      return;
    }
    const count = overrideCount ?? (Number(bulkQty) || (parsedBarcodes.length > 0 ? parsedBarcodes.length : 1));
    const generated = generateBarcodesHelper(selected, count);
    setBarcodeText(generated.join("\n") + "\n");
    if (!qtyTouched) {
      setBulkQty(String(count));
      setQtyTouched(true);
    }
    toast.success(`${count} টি বারকোড তৈরি হয়েছে`);
  }

  async function addScannedUnits() {
    if (!selected && parsedBarcodes.length === 0) return;
    if (tooManyBarcodes) {
      setError(`You scanned ${parsedBarcodes.length} barcodes but quantity is ${effQty}.`);
      return;
    }
    setBusy(true);
    setError("");

    try {
      const counts: Record<string, number> = {};
      for (const b of parsedBarcodes) {
        counts[b] = (counts[b] || 0) + 1;
      }

      const newLines = [...lines];
      const notFound: string[] = [];

      if (selected) {
        const qty = hasBulkQty ? effQty : (parsedBarcodes.length || 1);
        let finalBarcodes = [...parsedBarcodes];
        if (autoGenerateBarcodes && finalBarcodes.length < qty) {
          const needed = qty - finalBarcodes.length;
          const extra = generateBarcodesHelper(selected, needed);
          finalBarcodes = [...finalBarcodes, ...extra];
        }
        const existing = newLines.find((l) => l.product.id === selected.id);

        if (existing) {
          existing.quantity += qty;
          existing.barcodes = [...existing.barcodes, ...finalBarcodes];
        } else {
          newLines.push({
            product: selected,
            quantity: qty,
            unit_cost: Number(selected.cost_price) || 0,
            barcodes: finalBarcodes,
          });
        }
      } else {
        const uniqueBarcodes = Object.keys(counts);
        const results = await Promise.all(
          uniqueBarcodes.map(async (bc) => {
            const res = await api<any>("/catalog/products/", { params: { search: bc } });
            const list: Product[] = Array.isArray(res) ? res : res?.results ?? [];
            return {
              bc,
              match:
                list.find((p) => p.barcode === bc || p.sku === bc) ||
                list.find((p) => p.name?.toLowerCase().includes(bc.toLowerCase())) ||
                list[0],
            };
          })
        );

        for (const { bc, match } of results) {
          if (!match) {
            notFound.push(bc);
            continue;
          }

          const qty = counts[bc];
          const existing = newLines.find((l) => l.product.id === match.id);

          if (existing) {
            existing.quantity += qty;
            existing.barcodes = [...existing.barcodes, ...Array(qty).fill(bc)];
          } else {
            newLines.push({
              product: match,
              quantity: qty,
              unit_cost: Number(match.cost_price) || 0,
              barcodes: Array(qty).fill(bc),
            });
          }
        }
      }

      setLines(newLines);

      if (notFound.length > 0) {
        setError(`Could not find products for barcodes: ${notFound.join(", ")}`);
        const remainingText = parsedBarcodes.filter((b) => notFound.includes(b)).join("\n") + "\n";
        setBarcodeText(remainingText);
      } else {
        setBarcodeText("");
        setBulkQty("");
        setQtyTouched(false);
      }
    } catch (e: any) {
      setError(e?.message || "Error looking up barcodes");
    } finally {
      setBusy(false);
    }
  }

  function addManualLine() {
    if (!selected) return;
    const qty = hasBulkQty ? effQty : (parsedBarcodes.length || 1);
    let finalBarcodes = [...parsedBarcodes];
    if (autoGenerateBarcodes && finalBarcodes.length < qty) {
      const needed = qty - finalBarcodes.length;
      const extra = generateBarcodesHelper(selected, needed);
      finalBarcodes = [...finalBarcodes, ...extra];
    }
    setLines((prev) => {
      const existing = prev.find((l) => l.product.id === selected.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === selected.id
            ? { ...l, quantity: l.quantity + qty, barcodes: [...l.barcodes, ...finalBarcodes] }
            : l
        );
      }
      return [
        ...prev,
        {
          product: selected,
          quantity: qty,
          unit_cost: Number(selected.cost_price) || 0,
          barcodes: finalBarcodes,
        },
      ];
    });
    setBarcodeText("");
    setBulkQty("");
    setQtyTouched(false);
    toast.success(`"${selected.name}" (${qty} টি) রিসিভ তালিকায় যুক্ত হয়েছে`);
  }

  function updateLine(id: number, field: "quantity" | "unit_cost", val: number) {
    setLines((prev) => prev.map((l) => (l.product.id === id ? { ...l, [field]: val } : l)));
  }
  function removeLine(id: number) {
    setLines((prev) => prev.filter((l) => l.product.id !== id));
  }

  // ─── Totals ───────────────────────────────────────────────────────────────
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_cost, 0);
  const paid = Number(payAmount) || 0;
  const supplierDue = Math.max(0, subtotal - paid);

  // Pricing panel values
  const cost = selected ? Number(selected.cost_price) || 0 : 0;
  const sell = selected ? Number(selected.selling_price) || 0 : 0;
  const margin = sell > 0 ? (((sell - cost) / sell) * 100).toFixed(1) : "0.0";
  const profit = (sell - cost).toFixed(2);

  // Continuous scan
  function handleBarcodeInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    const parts = val.split("\n");
    const last = parts[parts.length - 1];
    if (last.length >= digitsPerCode) {
      setBarcodeText(val.trimEnd() + "\n");
    } else {
      setBarcodeText(val);
    }
  }

  // ─── Push to Stock ─────────────────────────────────────────────────────────
  async function pushToStock() {
    if (lines.length === 0) {
      setError("Add at least one product to receive.");
      return;
    }
    if (!supplier) {
      setError("Please select a vendor (supplier) for this purchase.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const poData: Record<string, any> = {
        items: lines.map((l) => {
          let bcs = [...l.barcodes];
          if (autoGenerateBarcodes && bcs.length < l.quantity) {
            const needed = l.quantity - bcs.length;
            bcs = [...bcs, ...generateBarcodesHelper(l.product, needed)];
          }
          return {
            product: l.product.id,
            quantity: l.quantity,
            unit_cost: l.unit_cost,
            barcodes: bcs,
          };
        }),
      };
      if (supplier) poData.supplier = Number(supplier);
      if (branch) poData.branch = Number(branch);

      // Update product selling prices and warranties FIRST
      for (const l of lines) {
        const patchData: Record<string, any> = {};
        if (l.product.selling_price) patchData.selling_price = l.product.selling_price;
        if (l.product.warranty_months !== undefined && l.product.warranty_months !== null) {
          patchData.warranty_months = l.product.warranty_months;
        }
        if (Object.keys(patchData).length > 0) {
          await api(`/catalog/products/${l.product.id}/`, { method: "PATCH", body: patchData });
        }
      }

      const po = await api<{ id: number }>("/purchasing/purchase-orders/", {
        method: "POST",
        body: poData,
      });
      await api(`/purchasing/purchase-orders/${po.id}/receive/`, {
        method: "POST",
        body: { paid },
      });

      toast.success(t("pp_success_receive") || "Products received successfully");
      router.push("/app/products");
    } catch (e: any) {
      setError(e?.data?.detail || e?.message || "Failed to push to stock.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row g-3 align-items-start">
      {/* ── Left panel ────────────────────────────────────────────────────── */}
      <div className="col-lg-8">
        {/* Header */}
        <div className="card shadow-sm mb-3">
          <div className="card-body">
            <div className="d-flex align-items-start justify-content-between mb-1">
              <div>
                <h1 className="h5 fw-bold mb-0">{t("pp_title")}</h1>
                <div className="text-secondary small">{t("pp_subtitle")}</div>
              </div>
              <div className="small fw-semibold d-flex align-items-center gap-1 bg-white px-3 py-1 rounded shadow-sm border border-light">
                <span
                  className={`d-inline-block rounded-circle ${scannerConnected ? "bg-success" : "bg-secondary"}`}
                  style={{ width: 8, height: 8 }}
                ></span>
                <span className={scannerConnected ? "text-success" : "text-secondary"}>
                  {scannerConnected ? "Scanner Connected" : "Scanner Disconnected"}
                </span>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary btn-sm" onClick={() => router.back()}>
                  {t("pp_btn_cancel")}
                </button>
                <button
                  className="btn btn-outline-brand btn-sm"
                  onClick={() => {
                    setShowNewProduct(true);
                    setSearchResults(null);
                  }}
                >
                  + New Product Record
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* New product modal card */}
        {showNewProduct && (
          <div className="card shadow-sm border-brand mb-3">
            <div className="card-header fw-semibold small text-brand">{t("pp_new_prod_title")}</div>
            <div className="card-body">
              <form onSubmit={createProduct} className="row g-2">
                <div className="col-md-6">
                  <label className="small fw-medium">{t("pp_lbl_prod_name")}</label>
                  <input
                    required
                    className="form-control form-control-sm"
                    value={newProd.name}
                    onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
                    placeholder="e.g. DVR High Resolution"
                  />
                </div>
                <div className="col-md-6">
                  <label className="small fw-medium">{t("pp_lbl_sku_auto")}</label>
                  <input
                    className="form-control form-control-sm"
                    value={newProd.sku}
                    onChange={(e) => setNewProd({ ...newProd, sku: e.target.value })}
                    placeholder="auto-generated"
                  />
                </div>
                <div className="col-md-3">
                  <label className="small fw-medium">{t("pp_lbl_cost")}</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control form-control-sm"
                    value={newProd.cost_price}
                    onChange={(e) => setNewProd({ ...newProd, cost_price: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="col-md-3">
                  <label className="small fw-medium">{t("pp_lbl_selling")}</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control form-control-sm"
                    value={newProd.selling_price}
                    onChange={(e) => setNewProd({ ...newProd, selling_price: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="col-md-3">
                  <label className="small fw-medium">{t("pp_lbl_reorder")}</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    className="form-control form-control-sm"
                    value={newProd.reorder_level}
                    onChange={(e) => setNewProd({ ...newProd, reorder_level: e.target.value })}
                  />
                </div>
                <div className="col-md-3 d-flex align-items-end gap-2">
                  <button className="btn btn-brand btn-sm" disabled={savingProd}>
                    {savingProd ? "Creating…" : "Create & add"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setShowNewProduct(false)}
                  >
                    {t("pp_btn_cancel")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Advanced Product Search */}
        <div className="card shadow-sm mb-3">
          <div className="card-body">
            <h2 className="h6 fw-bold mb-3 text-brand">🔍 Advanced Product Search</h2>
            <div className="row g-2 mb-2">
              <div className="col-md-6">
                <label className="small fw-medium">{t("pp_lbl_prod_name_search")}</label>
                <input
                  className="form-control form-control-sm"
                  placeholder="e.g. DVR High Resolution"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                />
              </div>
              <div className="col-md-6">
                <label className="small fw-medium">{t("pp_sku")}</label>
                <input
                  className="form-control form-control-sm"
                  placeholder="Scan or type SKU…"
                  value={searchBarcode}
                  onChange={(e) => setSearchBarcode(e.target.value)}
                />
              </div>
            </div>

            {searching && <div className="text-secondary small py-2">{t("pp_searching")}</div>}

            {searchResults !== null && !searching && (
              <div className="border rounded mb-2">
                <div className="px-3 py-2 bg-secondary bg-opacity-10 border-bottom small fw-semibold text-secondary">
                  SEARCH RESULTS ({searchResults.length})
                </div>
                {searchResults.length === 0 ? (
                  <div className="px-3 py-3 text-secondary small">
                    No products found.{" "}
                    <button className="btn btn-link btn-sm p-0" onClick={() => setShowNewProduct(true)}>
                      Create a new product?
                    </button>
                  </div>
                ) : (
                  searchResults.map((p) => (
                    <label
                      key={p.id}
                      className={`d-flex align-items-center gap-3 px-3 py-2 border-bottom ${selected?.id === p.id ? "bg-secondary bg-opacity-10" : ""}`}
                      style={{ cursor: "pointer" }}
                      onClick={() => selectProduct(p)}
                    >
                      <input
                        type="checkbox"
                        className="form-check-input mt-0"
                        readOnly
                        checked={selected?.id === p.id}
                      />
                      <div>
                        <div className="fw-semibold">{p.name}</div>
                        <div className="small text-secondary">
                          {t("pp_sku")}: {p.sku || "—"} &bull; {t("pp_stock")}: {Math.max(0, Number(p.current_stock || 0))}
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            )}

            {selected && (
              <div className="mt-2 p-2 border rounded bg-secondary bg-opacity-10 d-flex align-items-center justify-content-between">
                <div>
                  <span className="fw-semibold">✓ {selected.name}</span>
                  <span className="text-secondary small ms-2">
                    {t("pp_sku")}: {selected.sku || "—"} · {t("pp_stock")}: {Math.max(0, Number(selected.current_stock || 0))}
                  </span>
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-brand btn-sm" onClick={addManualLine}>
                    + Add to receive
                  </button>
                  <button className="btn btn-outline-secondary btn-sm" onClick={() => setSelected(null)}>
                    ✕ Clear
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pricing Information */}
        <div className="card shadow-sm mb-3">
          <div className="card-body">
            <h2 className="h6 fw-bold mb-3 text-brand">💰 Pricing Information</h2>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="small fw-medium">{t("pp_lbl_cost_bdt")}</label>
                <input
                  className="form-control"
                  type="number"
                  step="0.01"
                  value={selected ? cost : ""}
                  placeholder="0"
                  disabled={!selected}
                  onChange={(e) => {
                    if (!selected) return;
                    setSelected({ ...selected, cost_price: e.target.value });
                    setLines((prev) =>
                      prev.map((l) =>
                        l.product.id === selected.id ? { ...l, unit_cost: Number(e.target.value) || 0 } : l
                      )
                    );
                  }}
                />
              </div>
              <div className="col-md-6">
                <label className="small fw-medium">{t("pp_lbl_sell_bdt")}</label>
                <input
                  className="form-control"
                  type="number"
                  step="0.01"
                  value={selected ? sell : ""}
                  placeholder="0"
                  disabled={!selected}
                  onChange={(e) => {
                    if (!selected) return;
                    setSelected({ ...selected, selling_price: e.target.value });
                    setLines((prev) =>
                      prev.map((l) =>
                        l.product.id === selected.id
                          ? { ...l, product: { ...l.product, selling_price: e.target.value } }
                          : l
                      )
                    );
                  }}
                />
                <div className="small text-muted mt-1">
                  {t("pp_lbl_margin")}: <strong>{margin}%</strong> · {t("pp_lbl_profit")}:{" "}
                  <strong>
                    {t("pp_bdt")} {profit}/{t("pp_unit")}
                  </strong>
                </div>
              </div>
              <div className="col-md-6">
                <label className="small fw-medium">{t("pp_lbl_warranty")}</label>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  value={selected?.warranty_months ?? ""}
                  placeholder="0"
                  disabled={!selected}
                  onChange={(e) => {
                    if (!selected) return;
                    const val = Number(e.target.value);
                    setSelected({ ...selected, warranty_months: val });
                    setLines((prev) =>
                      prev.map((l) =>
                        l.product.id === selected.id
                          ? { ...l, product: { ...l.product, warranty_months: val } }
                          : l
                      )
                    );
                  }}
                />
                <div className="small text-muted mt-1">{t("pp_lbl_warranty_hint")}</div>
              </div>
              <div className="col-md-6">
                <label className="small fw-medium">{t("pp_lbl_qty")}</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className={`form-control ${tooManyBarcodes ? "is-invalid" : ""}`}
                  placeholder={selected ? "e.g. 10" : "Select a product first"}
                  value={qtyDisplay}
                  disabled={!selected}
                  onChange={(e) => {
                    const v = e.target.value;
                    setBulkQty(v);
                    setQtyTouched(v.trim() !== "");
                    if (autoGenerateBarcodes && selected && v.trim() !== "") {
                      const cnt = Math.max(1, Math.round(Number(v) || 0));
                      const generated = generateBarcodesHelper(selected, cnt);
                      setBarcodeText(generated.join("\n") + "\n");
                    }
                  }}
                />
                <div className={`small mt-1 ${tooManyBarcodes ? "text-danger" : "text-muted"}`}>
                  {selected
                    ? hasBulkQty
                      ? `${parsedBarcodes.length} / ${effQty} barcodes scanned` +
                        (tooManyBarcodes
                          ? " — too many!"
                          : parsedBarcodes.length < effQty
                          ? ` · ${effQty - parsedBarcodes.length} without barcode`
                          : "")
                      : parsedBarcodes.length > 0
                      ? `Auto: ${parsedBarcodes.length} unit(s) from scanned barcodes.`
                      : "Auto-counts scanned barcodes. Type a number to receive units without barcodes."
                    : "Pick a product above to set a quantity."}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bulk Barcode Scan Card ───────────────────────────────────────── */}
        <div className="card shadow-sm mb-3">
          <div className="card-body">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3 border-bottom pb-2">
              <div className="d-flex flex-wrap align-items-center gap-3">
                <h2 className="h6 fw-bold mb-0 text-brand text-nowrap">▦ Bulk Barcode Scan &amp; Ingestion</h2>
                
                {/* Modern Self-Contained Auto-Barcode Toggle Pill */}
                <div
                  onClick={() => {
                    const next = !autoGenerateBarcodes;
                    setAutoGenerateBarcodes(next);
                    if (next && selected) {
                      const cnt = Number(bulkQty) || (parsedBarcodes.length > 0 ? parsedBarcodes.length : 1);
                      const generated = generateBarcodesHelper(selected, cnt);
                      setBarcodeText(generated.join("\n") + "\n");
                      toast.success(`${cnt} টি অটো বারকোড তৈরি হয়েছে`);
                    }
                  }}
                  className={`d-inline-flex align-items-center gap-2 px-3 py-1.5 rounded-pill border user-select-none ${
                    autoGenerateBarcodes
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-white text-dark border-secondary-subtle"
                  }`}
                  style={{ cursor: "pointer", transition: "all 0.2s ease" }}
                  role="button"
                >
                  <span className="small fw-bold">⚡ অটো-বারকোড তৈরি (Auto Barcode)</span>
                  <div
                    style={{
                      width: "34px",
                      height: "18px",
                      backgroundColor: autoGenerateBarcodes ? "rgba(255,255,255,0.3)" : "#cbd5e1",
                      borderRadius: "10px",
                      padding: "2px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: autoGenerateBarcodes ? "flex-end" : "flex-start",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div
                      style={{
                        width: "14px",
                        height: "14px",
                        backgroundColor: autoGenerateBarcodes ? "#ffffff" : "#64748b",
                        borderRadius: "50%",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                      }}
                    />
                  </div>
                  <span className={`badge ${autoGenerateBarcodes ? "bg-white text-primary" : "bg-secondary"}`} style={{ fontSize: "0.65rem" }}>
                    {autoGenerateBarcodes ? "ON" : "OFF"}
                  </span>
                </div>
              </div>

              <div className="d-flex gap-2 align-items-center">
                <span className="badge text-bg-primary">{parsedBarcodes.length} BARCODES</span>
                {selected && (
                  <button
                    type="button"
                    className="btn btn-outline-brand btn-sm"
                    onClick={() => generateBarcodesForSelected()}
                  >
                    ⚡ রিফ্রেশ বারকোড ({effQty})
                  </button>
                )}
              </div>
            </div>
            <div className="row g-3">
              <div className="col-md-7">
                <label className="form-label small fw-medium">বারকোড স্ক্যান বা পেস্ট করুন (প্রতি লাইনে একটি):</label>
                <textarea
                  className="form-control font-monospace"
                  rows={6}
                  placeholder="Scan or paste barcodes — each code separates automatically. One code per line."
                  value={barcodeText}
                  onChange={handleBarcodeInput}
                />
              </div>
              <div className="col-md-5">
                <div className="border rounded p-3 text-center h-100 d-flex flex-column align-items-center justify-content-center gap-2 bg-light">
                  <div className="fs-3">🖨️</div>
                  <div className="fw-semibold small">{t("pp_scan_mode")}</div>
                  <div className="text-secondary small">{t("pp_scan_hint")}</div>
                  <div className="d-flex align-items-center gap-2 mt-1">
                    <span className="small text-secondary">{t("pp_digits_code")}:</span>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      style={{ width: "4.5rem" }}
                      value={digitsPerCode}
                      min={4}
                      max={30}
                      onChange={(e) => setDigitsPerCode(Number(e.target.value) || 13)}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm w-100 mt-1"
                    onClick={() => setShowScanner(true)}
                  >
                    📷 Scan with Camera
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm w-100 mt-1"
                    onClick={() => {
                      setBarcodeText("");
                      setBulkQty("");
                      setQtyTouched(false);
                    }}
                  >
                    {t("pp_btn_clear_list")}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3">
              <button
                type="button"
                className="btn btn-brand btn-lg w-100"
                disabled={busy || tooManyBarcodes || (!selected && parsedBarcodes.length === 0)}
                onClick={addScannedUnits}
              >
                {busy ? (
                  <span className="spinner-border spinner-border-sm me-2" />
                ) : (
                  "+ "
                )}
                Add {effQty} unit(s) to receive
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel ───────────────────────────────────────────────────── */}
      <div className="col-lg-4">
        <div className="card shadow-sm" style={{ position: "sticky", top: "1rem" }}>
          <div className="card-header text-white fw-semibold" style={{ background: "var(--brand-900, #1a2433)" }}>
            <div>📦 To Receive</div>
            <div className="small fw-normal opacity-75">{t("pp_pending_inject")}</div>
          </div>
          <div className="card-body p-0">
            {lines.length === 0 ? (
              <div className="text-center text-secondary py-4 px-3">
                <div className="fs-2 mb-2">📦</div>
                <div className="small">{t("pp_pending_empty")}</div>
              </div>
            ) : (
              <div className="table-responsive" style={{ maxHeight: "300px", overflowY: "auto" }}>
                <table className="table table-sm align-middle mb-0">
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.product.id}>
                        <td className="ps-3">
                          <div className="fw-semibold small">{l.product.name}</div>
                          {l.barcodes.length > 0 && (
                            <div className="text-muted" style={{ fontSize: "0.7rem", fontFamily: "monospace" }}>
                              ▦ {l.barcodes[0]}
                              {l.barcodes.length > 1 ? ` +${l.barcodes.length - 1} more` : ""}
                            </div>
                          )}
                        </td>
                        <td style={{ width: "4.5rem" }}>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            className="form-control form-control-sm"
                            value={l.quantity}
                            onChange={(e) =>
                              updateLine(
                                l.product.id,
                                "quantity",
                                Math.max(1, Math.round(Number(e.target.value) || 1))
                              )
                            }
                          />
                        </td>
                        <td style={{ width: "5.5rem" }}>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="form-control form-control-sm"
                            value={l.unit_cost}
                            onChange={(e) =>
                              updateLine(l.product.id, "unit_cost", Number(e.target.value) || 0)
                            }
                          />
                        </td>
                        <td className="text-end pe-2">
                          <button
                            className="btn btn-link btn-sm p-0 text-danger"
                            onClick={() => removeLine(l.product.id)}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="border-top px-3 py-2">
              <div className="d-flex justify-content-between small mb-1">
                <span className="text-secondary">{t("pp_subtotal")}</span>
                <span>{money(subtotal)}</span>
              </div>
              <div className="d-flex justify-content-between fw-bold mb-3">
                <span>{t("pp_total_val")}</span>
                <span>{money(subtotal)}</span>
              </div>

              <label className="form-label small fw-medium">{t("pp_lbl_paid_now")}</label>
              <div className="input-group input-group-sm mb-1">
                <span className="input-group-text">{t("pp_bdt")}</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="form-control"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="0"
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setPayAmount(String(subtotal))}
                >
                  {t("pp_btn_pay_full")}
                </button>
              </div>
              <select
                className="form-select form-select-sm mb-3"
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
              >
                {Object.entries(PAY_METHODS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>

              <div className="d-flex justify-content-between small mb-1">
                <span className="text-secondary">{t("pp_due_after")}</span>
                <span className={`fw-semibold ${supplierDue > 0 ? "text-danger" : "text-success"}`}>{money(supplierDue)}</span>
              </div>
            </div>

            {/* Purchase Summary */}
            <div className="border-top px-3 py-3">
              <div className="fw-bold small mb-2">{t("pp_summary_title")}</div>
              <div className="mb-2">
                <label className="small fw-medium">{t("pp_lbl_vendor")}</label>
                <div className="d-flex gap-2 align-items-center">
                  <select
                    className="form-select form-select-sm"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                  >
                    <option value="">— none —</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-outline-brand btn-sm text-nowrap"
                    onClick={() => setShowNewVendor((v) => !v)}
                  >
                    + add
                  </button>
                </div>
              </div>

              {showNewVendor && (
                <form
                  onSubmit={createVendor}
                  className="border rounded p-3 mt-2 mb-3 bg-light"
                >
                  <div className="small fw-bold text-brand mb-2">✨ Quick Add Vendor</div>
                  <input
                    required
                    className="form-control form-control-sm mb-2"
                    placeholder="Vendor Name *"
                    value={newVendor.name}
                    onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                  />
                  <input
                    className="form-control form-control-sm mb-2"
                    placeholder="Phone Number"
                    value={newVendor.phone}
                    onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                  />
                  <input
                    className="form-control form-control-sm mb-3"
                    placeholder="Warehouse / Address"
                    value={newVendor.address}
                    onChange={(e) => setNewVendor({ ...newVendor, address: e.target.value })}
                  />
                  <div className="d-flex gap-2 justify-content-end">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setShowNewVendor(false)}
                    >
                      {t("pp_btn_cancel")}
                    </button>
                    <button className="btn btn-brand btn-sm" disabled={savingVendor}>
                      {savingVendor ? "Adding…" : "Add Vendor"}
                    </button>
                  </div>
                </form>
              )}

              {branches.length > 0 && (
                <div>
                  <label className="small fw-medium">{t("pp_lbl_warehouse")}</label>
                  <select
                    className="form-select form-select-sm"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                  >
                    <option value="">— default —</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="px-3 pb-3">
              {error && <div className="alert alert-danger py-2 px-3 small mb-2">{error}</div>}

              <button
                className="btn btn-brand w-100 mb-1"
                disabled={busy || lines.length === 0}
                onClick={pushToStock}
              >
                {busy ? <span className="spinner-border spinner-border-sm me-2" /> : "↑ "}
                Push to Stock
              </button>
              <div className="text-center text-secondary small mb-1">
                ⓘ Updates ledger &amp; inventory levels
              </div>
            </div>
          </div>
        </div>
      </div>

      {showScanner && (
        <ScannerModal
          onScan={(code) => {
            setShowScanner(false);
            const clean = code.trim();
            if (clean) {
              setBarcodeText((prev) => (prev.trimEnd() ? prev.trimEnd() + "\n" : "") + clean + "\n");
            }
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
