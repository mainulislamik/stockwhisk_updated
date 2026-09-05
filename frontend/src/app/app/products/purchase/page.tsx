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
  full_pack_cost?: string | number;
  full_pack_sell?: string | number;
  warranty_months?: number;
  replacement_guarantee_days?: number;
  expiry_date?: string | null;
  lot_number?: string;
  mfg_date?: string | null;
  purchase_multiplier?: string | number;
  unit?: number | null;
  purchase_unit?: number | null;
  unit_detail?: { id: number; name: string; short_code?: string; measure_type?: string; allow_decimal?: boolean } | null;
  purchase_unit_detail?: { id: number; name: string; short_code?: string; measure_type?: string } | null;
  track_inventory: boolean;
};
type Supplier = { id: number; name: string };
type Branch = { id: number; name: string };
type ReceiveLine = { product: Product; quantity: number; unit_cost: number; barcodes: string[] };
type Named = { id: number; name: string; measure_type?: string; short_code?: string };

const PAY_METHODS: Record<string, string> = {
  cash: "💵 Cash",
  bkash: "📱 bKash",
  nagad: "📱 Nagad",
  bank: "🏦 Bank",
};

export default function PurchaseProductPage() {
  const { t, lang } = useLanguage();
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
  const isSpecialShop = user?.shop_business_type === "camical" || user?.shop_business_type === "supershop" || user?.shop_business_type === "cosmetics" || user?.shop_business_type === "beauty";
  const [fullPackCost, setFullPackCost] = useState("");
  const [fullPackSell, setFullPackSell] = useState("");
  const [pricingMode, setPricingMode] = useState<"regular" | "bulk">("regular");

  const { isConnected: scannerConnected } = useScannerWebSocket(user?.shop ?? undefined, (barcode) => {
    setBarcodeText((prev) => (prev ? `${prev}\n${barcode}` : barcode));
  });

  // Modal State for New Product Creation (Exact replica of Product List page)
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [categories, setCategories] = useState<Named[]>([]);
  const [brands, setBrands] = useState<Named[]>([]);
  const [units, setUnits] = useState<Named[]>([]);
  const [newCat, setNewCat] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newUnit, setNewUnit] = useState("");

  const [newProd, setNewProd] = useState({
    name: "",
    sku: "",
    barcode: "",
    category: "",
    brand: "",
    unit: "",
    purchase_unit: "",
    purchase_multiplier: "1",
    full_pack_cost: "",
    full_pack_sell: "",
    cost_price: "",
    selling_price: "",
    reorder_level: "5",
    warranty_months: "",
    replacement_guarantee_days: "",
    expiry_date: "",
    lot_number: "",
    mfg_date: "",
  });
  const [newPricingMode, setNewPricingMode] = useState<"regular" | "bulk">("regular");
  const [savingProd, setSavingProd] = useState(false);

  // Sidebar / payment
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [supplier, setSupplier] = useState("");
  const [branch, setBranch] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [promisedDate, setPromisedDate] = useState("");

  // Helper date functions for promised due date
  function addDays(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  }

  function getNextMonthFirstDay() {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 1);
    return d.toISOString().split("T")[0];
  }

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
      fetchAll<Named>("/catalog/units/").catch(() => []),
      fetchAll<Named>("/catalog/categories/").catch(() => []),
      fetchAll<Named>("/catalog/brands/").catch(() => []),
    ]).then(([s, b, u, c, br]) => {
      setSuppliers(s);
      setBranches(b);
      setUnits(u);
      setCategories(c);
      setBrands(br);
    });
  }, []);

  // Quick add category, brand or unit (Exact same as Product List page)
  async function quickAdd(kind: "category" | "brand" | "unit") {
    const name = kind === "category" ? newCat.trim() : kind === "brand" ? newBrand.trim() : newUnit.trim();
    if (!name) return;
    try {
      const endpoint = kind === "category" ? "categories" : kind === "brand" ? "brands" : "units";
      const created = await api<Named>(`/catalog/${endpoint}/`, { method: "POST", body: { name } });
      if (kind === "category") {
        setCategories((c) => [...c, created]);
        setNewCat("");
        setNewProd((f) => ({ ...f, category: String(created.id) }));
      } else if (kind === "brand") {
        setBrands((b) => [...b, created]);
        setNewBrand("");
        setNewProd((f) => ({ ...f, brand: String(created.id) }));
      } else {
        setUnits((u) => [...u, created]);
        setNewUnit("");
        setNewProd((f) => ({ ...f, unit: String(created.id) }));
      }
      toast.success(lang === "bn" ? "সফলভাবে যোগ করা হয়েছে" : "Added successfully");
    } catch (e: any) {
      toast.error(e?.message || (lang === "bn" ? "যোগ করতে ব্যর্থ হয়েছে" : "Failed to add"));
    }
  }

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
    setFullPackCost("");
    setFullPackSell("");
    setPricingMode("regular");
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

  // ─── New product creation modal submission ───────────────────────────────
  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!newProd.name.trim()) return;
    setSavingProd(true);
    try {
      const mult = newProd.purchase_multiplier !== "" ? Number(newProd.purchase_multiplier) : 1.0;
      const p = await api<Product>("/catalog/products/", {
        method: "POST",
        body: {
          name: newProd.name.trim(),
          sku: newProd.sku.trim() || "",
          barcode: newProd.barcode || "",
          category: newProd.category ? Number(newProd.category) : null,
          brand: newProd.brand ? Number(newProd.brand) : null,
          unit: newProd.unit ? Number(newProd.unit) : null,
          purchase_unit: newProd.purchase_unit ? Number(newProd.purchase_unit) : null,
          purchase_multiplier: mult,
          full_pack_cost: newProd.full_pack_cost !== "" ? Number(newProd.full_pack_cost) : 0,
          full_pack_sell: newProd.full_pack_sell !== "" ? Number(newProd.full_pack_sell) : 0,
          cost_price: newProd.cost_price ? Number(newProd.cost_price) : 0,
          selling_price: newProd.selling_price ? Number(newProd.selling_price) : 0,
          reorder_level:
            newProd.reorder_level === ""
              ? 5
              : Math.max(0, Math.round(Number(newProd.reorder_level) || 0)),
          warranty_months: !isSpecialShop && newProd.warranty_months ? Number(newProd.warranty_months) : 0,
          replacement_guarantee_days: !isSpecialShop && newProd.replacement_guarantee_days ? Number(newProd.replacement_guarantee_days) : 0,
          expiry_date: newProd.expiry_date || null,
          lot_number: newProd.lot_number || "",
          mfg_date: newProd.mfg_date || null,
          track_inventory: true,
        },
      });

      setShowNewProduct(false);
      setNewProd({
        name: "",
        sku: "",
        barcode: "",
        category: "",
        brand: "",
        unit: "",
        purchase_unit: "",
        purchase_multiplier: "1",
        full_pack_cost: "",
        full_pack_sell: "",
        cost_price: "",
        selling_price: "",
        reorder_level: "5",
        warranty_months: "",
        replacement_guarantee_days: "",
        expiry_date: "",
        lot_number: "",
        mfg_date: "",
      });

      selectProduct(p);
      setLines((prev) => [
        ...prev,
        { product: p, quantity: 1, unit_cost: drumCostFor(p), barcodes: autoGenerateBarcodes ? generateBarcodesHelper(p, 1) : [] },
      ]);
      toast.success(t("pp_success_create_prod") || (lang === "bn" ? "পণ্য সফলভাবে তৈরি হয়েছে!" : "Product created successfully"));
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
      toast.success(lang === "bn" ? "সরবরাহকারী সফলভাবে যুক্ত হয়েছে!" : "Vendor added successfully");
    } catch (e: any) {
      toast.error(e?.message || (lang === "bn" ? "সরবরাহকারী যুক্ত করতে ব্যর্থ হয়েছে।" : "Could not add vendor"));
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
    toast.success(lang === "bn" ? `${count} টি বারকোড তৈরি হয়েছে` : `Generated ${count} barcodes`);
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
            unit_cost: drumCostFor(selected),
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
              unit_cost: drumCostFor(match),
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
          unit_cost: drumCostFor(selected),
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
  function drumCostFor(p: Product): number {
    const m = Number(p.purchase_multiplier) || 1;
    if (m > 1) {
      const fpc = Number(p.full_pack_cost) || 0;
      if (fpc > 0) return fpc;
      const perUnit = Number(p.cost_price) || 0;
      return perUnit > 0 ? Number((perUnit * m).toFixed(2)) : 0;
    }
    return Number(p.cost_price) || 0;
  }
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
      setError(lang === "bn" ? "রিসিভ করার জন্য অন্তত একটি পণ্য তালিকায় যুক্ত করুন।" : "Add at least one product to receive.");
      return;
    }
    if (!supplier) {
      setError(lang === "bn" ? "অনুগ্রহ করে এই চালানের জন্য একজন সরবরাহকারী (Vendor) নির্বাচন করুন।" : "Please select a vendor (supplier) for this purchase.");
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

      // Update product selling prices, warranties, expiry dates, and lot numbers FIRST
      for (const l of lines) {
        const patchData: Record<string, any> = {};
        if (l.product.selling_price) patchData.selling_price = l.product.selling_price;
        if (l.product.warranty_months !== undefined && l.product.warranty_months !== null) {
          patchData.warranty_months = l.product.warranty_months;
        }
        if (l.product.replacement_guarantee_days !== undefined && l.product.replacement_guarantee_days !== null) {
          patchData.replacement_guarantee_days = l.product.replacement_guarantee_days;
        }
        if (l.product.expiry_date !== undefined) {
          patchData.expiry_date = l.product.expiry_date || null;
        }
        if (l.product.lot_number !== undefined) {
          patchData.lot_number = l.product.lot_number || "";
        }
        if (l.product.mfg_date !== undefined) {
          patchData.mfg_date = l.product.mfg_date || null;
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
        body: { 
          paid, 
          method: payMethod,
          due_date: supplierDue > 0 ? (promisedDate || null) : null,
        },
      });

      toast.success(t("pp_success_receive") || (lang === "bn" ? "পণ্য সফলভাবে স্টকে যুক্ত হয়েছে!" : "Products received successfully"));
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
      <div className="col-12 col-lg-8">
        {/* Header */}
        <div className="card shadow-sm mb-3">
          <div className="card-body p-3 p-sm-4">
            <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2.5">
              <div>
                <h1 className="h5 fw-bold mb-0 text-brand d-flex align-items-center gap-2">
                  <i className="bi bi-box-arrow-in-down"></i>
                  {t("pp_title") || (lang === "bn" ? "নতুন প্রোডাক্ট পার্চেজ করুন" : "Purchase New Product")}
                </h1>
                <div className="text-secondary small mt-0.5">{t("pp_subtitle") || (lang === "bn" ? "নতুন ইনভেন্টরি যুক্ত করুন এবং স্টক আপডেট করুন।" : "Ingest new inventory and update stock levels.")}</div>
              </div>
              <div className="d-flex flex-wrap align-items-center gap-2 mt-2 mt-sm-0">
                <div className="small fw-semibold d-none d-md-flex align-items-center gap-1.5 bg-light px-2.5 py-1 rounded border">
                  <span
                    className={`d-inline-block rounded-circle ${scannerConnected ? "bg-success" : "bg-secondary"}`}
                    style={{ width: 8, height: 8 }}
                  ></span>
                  <span className={scannerConnected ? "text-success" : "text-secondary"} style={{ fontSize: "0.75rem" }}>
                    {scannerConnected ? "Scanner Connected" : "Scanner Disconnected"}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-brand btn-sm rounded-pill px-3 shadow-sm text-nowrap fw-semibold"
                  onClick={() => {
                    setShowNewProduct(true);
                    setSearchResults(null);
                  }}
                >
                  <i className="bi bi-plus-circle me-1"></i>
                  + New Product Record
                </button>
                <button className="btn btn-outline-secondary btn-sm rounded-pill px-3 text-nowrap" onClick={() => router.back()}>
                  {t("pp_btn_cancel") || (lang === "bn" ? "বাতিল" : "Cancel")}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Product Search */}
        <div className="card shadow-sm mb-3">
          <div className="card-body p-3 p-sm-4">
            <h2 className="h6 fw-bold mb-3 text-brand d-flex align-items-center gap-1.5">
              <i className="bi bi-search text-primary"></i>
              {t("pp_search_title") || (lang === "bn" ? "অ্যাডভান্সড প্রোডাক্ট সার্চ" : "Advanced Product Search")}
            </h2>
            <div className="row g-2.5 mb-2">
              <div className="col-12 col-md-6">
                <label className="small fw-medium">{t("pp_lbl_search_name") || (lang === "bn" ? "প্রোডাক্টের নাম" : "Product Name")}</label>
                <input
                  className="form-control form-control-sm"
                  placeholder={lang === "bn" ? "যেমন: ওয়্যারলেস মাউস / ডিভিআর / শ্যাম্পু" : "e.g. Wireless Mouse / DVR"}
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="small fw-medium">{t("pp_lbl_search_sku") || (lang === "bn" ? "বারকোড / এসকিউ (SKU)" : "Barcode / SKU")}</label>
                <input
                  className="form-control form-control-sm"
                  placeholder={lang === "bn" ? "বারকোড স্ক্যান বা SKU লিখুন…" : "Scan or type SKU…"}
                  value={searchBarcode}
                  onChange={(e) => setSearchBarcode(e.target.value)}
                />
              </div>
            </div>

            {searching && <Spinner label={t("pp_searching") || (lang === "bn" ? "খোঁজা হচ্ছে..." : "Searching...")} />}

            {searchResults && searchResults.length > 0 && (
              <div className="border rounded-3 p-2 mt-2 bg-light shadow-sm" style={{ maxHeight: "220px", overflowY: "auto" }}>
                <div className="small fw-bold text-secondary mb-1.5 px-1">{t("pp_search_results") || (lang === "bn" ? "খুঁজে পাওয়া পণ্যসমূহ" : "Matching Products")}</div>
                <div className="d-flex flex-column gap-1.5">
                  {searchResults.map((p) => (
                    <div
                      key={p.id}
                      className="d-flex flex-wrap justify-content-between align-items-center p-2 rounded-2 bg-white border hover-shadow gap-2"
                      style={{ cursor: "pointer" }}
                      onClick={() => selectProduct(p)}
                    >
                      <div>
                        <span className="fw-semibold text-dark">{p.name}</span>
                        {p.sku && <span className="badge bg-secondary ms-2">{p.sku}</span>}
                        {p.barcode && <span className="badge bg-light text-dark ms-1 border">BC: {p.barcode}</span>}
                        <div className="text-secondary small mt-0.5">
                          {t("pp_stock") || (lang === "bn" ? "স্টক" : "Stock")}: <strong className="text-success">{p.current_stock} {p.unit_detail?.name || ""}</strong> · {t("pp_cost") || (lang === "bn" ? "ক্রয়" : "Cost")}: {money(p.cost_price)} · {t("pp_sell") || (lang === "bn" ? "বিক্রয়" : "Sell")}: {money(p.selling_price)}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-brand btn-sm px-3 rounded-pill"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectProduct(p);
                        }}
                      >
                        {t("pp_btn_select") || (lang === "bn" ? "বাছাই করুন" : "Select")}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searchResults && searchResults.length === 0 && !searching && (
              <div className="text-secondary small mt-2 alert alert-light border py-2">{t("pp_no_results") || (lang === "bn" ? "কোনো পণ্য পাওয়া যায়নি।" : "No matching products found.")}</div>
            )}

            {selected && (
              <div className="mt-3 p-3 bg-light rounded-3 border border-primary border-opacity-25 shadow-sm">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="badge bg-primary me-2">{t("pp_badge_selected") || (lang === "bn" ? "নির্বাচিত" : "SELECTED")}</span>
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 text-secondary"
                    onClick={() => setSelected(null)}
                  >
                    {t("pp_btn_clear") || (lang === "bn" ? "মুছুন" : "Clear")}
                  </button>
                </div>
                <div className="fw-bold fs-6 text-dark">{selected.name}</div>
                <div className="text-secondary small mb-2">
                  SKU: {selected.sku || "N/A"} · Barcode: {selected.barcode || "N/A"} · {t("pp_stock") || (lang === "bn" ? "স্টক" : "Stock")}: {selected.current_stock} {selected.unit_detail?.name || "Unit"}
                </div>
                <div className="d-flex flex-wrap gap-2">
                  <span className="badge rounded-pill text-bg-secondary bg-opacity-75">
                    🏷️ Cost: ৳{Number(selected.cost_price || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                  <span className="badge rounded-pill text-bg-primary bg-opacity-75">
                    💰 Selling: ৳{Number(selected.selling_price || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                  {Number(selected.cost_price || 0) > 0 && Number(selected.selling_price || 0) > 0 && (
                    <span className="badge rounded-pill text-bg-info bg-opacity-75">
                      📈 Margin: {(((Number(selected.selling_price) - Number(selected.cost_price)) / Number(selected.cost_price)) * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pricing Information */}
        <div className="card shadow-sm mb-3">
          <div className="card-body p-3 p-sm-4">
            <h2 className="h6 fw-bold mb-3 text-brand">💰 {lang === "bn" ? "মূল্যের তথ্য" : "Pricing Information"}</h2>
            <div className="row g-2.5 g-sm-3">

              {/* Added Pricing Method Dropdown */}
              {isSpecialShop && selected && Number(selected.purchase_multiplier) > 1 && selected.unit_detail?.measure_type !== "count" && (
                <div className="col-12 mb-1 p-2 rounded" style={{ backgroundColor: "rgba(13,110,253,0.05)", border: "1px solid rgba(13,110,253,0.1)" }}>
                  <label className="small text-primary fw-bold mb-1">{lang === "bn" ? "দাম নির্ধারণ পদ্ধতি" : "Pricing Entry Method"}</label>
                  <select className="form-select form-select-sm" value={pricingMode} onChange={(e) => setPricingMode(e.target.value as any)}>
                    <option value="regular">{lang === "bn" ? "সাধারণ পদ্ধতি (প্রতি ইউনিটের মূল্য ম্যানুয়াল)" : "Regular Option (Manual Per-Unit Price)"}</option>
                    <option value="bulk">{lang === "bn" ? "বাল্ক অটো-ক্যালকুলেট পদ্ধতি (সম্পূর্ণ ড্রাম মূল্য)" : "Bulk Auto-Calculate Option (Enter Full Drum Price)"}</option>
                  </select>
                </div>
              )}

              {(isSpecialShop && pricingMode === "bulk") && (
                <>
                  <div className="col-12 col-md-6">
                    <label className="small fw-medium text-primary">{lang === "bn" ? "পুরো ড্রাম/বক্স ক্রয়মূল্য (৳)" : "Full Drum/Box Cost (৳)"}</label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">৳</span>
                      <input
                        className="form-control"
                        type="number"
                        step="0.01"
                        placeholder="e.g. 5000"
                        value={selected ? fullPackCost : ""}
                        disabled={!selected}
                        onChange={(e) => {
                          const packVal = e.target.value;
                          setFullPackCost(packVal);
                          if (!selected) return;
                          const mult = Number(selected.purchase_multiplier) || 1;
                          const perUnitCost = (Number(packVal) / mult).toFixed(2);
                          
                          setSelected({ ...selected, cost_price: perUnitCost, full_pack_cost: packVal });
                          setLines((prev) =>
                            prev.map((l) =>
                              l.product.id === selected.id ? { ...l, unit_cost: Number(packVal) || 0 } : l
                            )
                          );
                        }}
                      />
                    </div>
                  </div>
                  
                  <div className="col-12 col-md-6">
                    <label className="small fw-medium text-primary">Full Drum/Box Sell (৳)</label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">৳</span>
                      <input
                        className="form-control"
                        type="number"
                        step="0.01"
                        placeholder="e.g. 6000"
                        value={selected ? fullPackSell : ""}
                        disabled={!selected}
                        onChange={(e) => {
                          const packVal = e.target.value;
                          setFullPackSell(packVal);
                          if (!selected) return;
                          const mult = Number(selected.purchase_multiplier) || 1;
                          const perUnitSell = (Number(packVal) / mult).toFixed(2);
                          
                          setSelected({ ...selected, selling_price: perUnitSell });
                          setLines((prev) =>
                            prev.map((l) =>
                              l.product.id === selected.id ? { ...l, product: {...l.product, selling_price: perUnitSell} } : l
                            )
                          );
                        }}
                      />
                    </div>
                  </div>
                  <div className="col-12 mt-0">
                     <div className="small text-muted">
                       Auto-calculates Cost and Selling Price per Base Unit based on Multiplier: <strong>{selected?.purchase_multiplier || 1}</strong>
                     </div>
                  </div>
                </>
              )}

              <div className="col-12 col-md-6">
                <label className="small fw-medium">{(isSpecialShop && pricingMode === "bulk") ? (lang === "bn" ? "অটো ক্রয় মূল্য (বেস ইউনিট)" : "Auto Calculated Cost (Base Unit)") : (t("pp_lbl_cost_bdt") || (lang === "bn" ? "ক্রয় মূল্য (টাকা)" : "Cost Price (BDT)"))}</label>
                <div className="input-group input-group-sm">
                  <span className="input-group-text">৳</span>
                  <input
                    className="form-control"
                    type="number"
                    step="0.01"
                    value={selected ? cost : ""}
                    placeholder="0"
                    disabled={!selected || (isSpecialShop && pricingMode === "bulk")}
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
              </div>

              <div className="col-12 col-md-6">
                <label className="small fw-medium">{(isSpecialShop && pricingMode === "bulk") ? (lang === "bn" ? "অটো বিক্রয় মূল্য (বেস ইউনিট)" : "Auto Calculated Selling Price (Base Unit)") : (t("pp_lbl_sell_bdt") || (lang === "bn" ? "বিক্রয় মূল্য (টাকা)" : "Selling Price (BDT)"))}</label>
                <div className="input-group input-group-sm">
                  <span className="input-group-text">৳</span>
                  <input
                    className="form-control"
                    type="number"
                    step="0.01"
                    value={selected ? sell : ""}
                    placeholder="0"
                    disabled={!selected || (isSpecialShop && pricingMode === "bulk")}
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
                </div>
                <div className="small text-muted mt-1">
                  {t("pp_lbl_margin") || (lang === "bn" ? "মার্জিন" : "Margin")}: <strong>{margin}%</strong> · {t("pp_lbl_profit") || (lang === "bn" ? "লাভ" : "Profit")}:{" "}
                  <strong>
                    {t("pp_bdt") || "৳"} {profit}/{t("pp_unit") || (lang === "bn" ? "ইউনিট" : "unit")}
                  </strong>
                </div>
              </div>

              {/* Chemical Expiry / Batch vs Hardware Warranty */}
              {(() => {
                const selectedUnit = selected?.unit_detail;
                const isCountUnit = !selectedUnit || selectedUnit.measure_type === "count" || selectedUnit.name?.toLowerCase().includes("piece") || selectedUnit.name?.toLowerCase().includes("pcs") || selectedUnit.short_code?.toLowerCase() === "pcs";
                const isChemicalBulk = isSpecialShop && !isCountUnit;

                if (isChemicalBulk) {
                  return (
                    <>
                      <div className="col-12 col-md-4">
                        <label className="small fw-semibold text-danger">{lang === "bn" ? "মেয়াদোত্তীর্ণের তারিখ (Expiry Date)" : "Expiry Date"}</label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={selected?.expiry_date || ""}
                          disabled={!selected}
                          onChange={(e) => {
                            if (!selected) return;
                            const val = e.target.value;
                            setSelected({ ...selected, expiry_date: val });
                            setLines((prev) =>
                              prev.map((l) =>
                                l.product.id === selected.id ? { ...l, product: { ...l.product, expiry_date: val } } : l
                              )
                            );
                          }}
                        />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="small fw-medium">{lang === "bn" ? "লট / ব্যাচ নম্বর" : "Lot / Batch No"}</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="e.g. LOT-2026-09"
                          value={selected?.lot_number || ""}
                          disabled={!selected}
                          onChange={(e) => {
                            if (!selected) return;
                            const val = e.target.value;
                            setSelected({ ...selected, lot_number: val });
                            setLines((prev) =>
                              prev.map((l) =>
                                l.product.id === selected.id ? { ...l, product: { ...l.product, lot_number: val } } : l
                              )
                            );
                          }}
                        />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="small fw-medium">{lang === "bn" ? "উৎপাদন তারিখ (ঐচ্ছিক)" : "Mfg Date"}</label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={selected?.mfg_date || ""}
                          disabled={!selected}
                          onChange={(e) => {
                            if (!selected) return;
                            const val = e.target.value;
                            setSelected({ ...selected, mfg_date: val });
                            setLines((prev) =>
                              prev.map((l) =>
                                l.product.id === selected.id ? { ...l, product: { ...l.product, mfg_date: val } } : l
                              )
                            );
                          }}
                        />
                      </div>
                    </>
                  );
                }

                return (
                  <div className="col-12 col-md-6">
                    <label className="small fw-medium">{t("pp_lbl_warranty") || (lang === "bn" ? "ওয়ারেন্টির সময়কাল (মাস)" : "Warranty duration (months)")}</label>
                    <input
                      className="form-control form-control-sm"
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
                    <div className="small text-muted mt-1">{t("pp_lbl_warranty_hint") || (lang === "bn" ? "এই ব্যাচের প্রতিটি ইউনিটে প্রযোজ্য হবে।" : "Applied to every unit received in this batch.")}</div>
                  </div>
                );
              })()}

              <div className="col-12 col-md-6">
                <label className="small fw-medium">{t("pp_lbl_qty") || (lang === "bn" ? "পরিমাণ (কত ইউনিট রিসিভ করবেন)" : "Quantity (units to receive)")}</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className={`form-control form-control-sm ${tooManyBarcodes ? "is-invalid" : ""}`}
                  placeholder={selected ? (lang === "bn" ? "যেমন: ১০" : "e.g. 10") : (lang === "bn" ? "আগে পণ্য নির্বাচন করুন" : "Select a product first")}
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
          <div className="card-body p-3 p-sm-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2.5 mb-3 border-bottom pb-2.5">
              <div className="d-flex flex-wrap align-items-center gap-2">
                <h2 className="h6 fw-bold mb-0 text-brand text-nowrap">▦ {lang === "bn" ? "বাল্ক বারকোড স্ক্যান ও স্টক ইনজেকশন" : "Bulk Barcode Scan & Ingestion"}</h2>
                
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
                  className={`d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill border user-select-none ${
                    autoGenerateBarcodes
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-white text-dark border-secondary-subtle"
                  }`}
                  style={{ cursor: "pointer", transition: "all 0.2s ease" }}
                  role="button"
                >
                  <span className="small fw-bold" style={{ fontSize: "0.78rem" }}>⚡ অটো-বারকোড তৈরি</span>
                  <div
                    style={{
                      width: "30px",
                      height: "16px",
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
                        width: "12px",
                        height: "12px",
                        backgroundColor: autoGenerateBarcodes ? "#ffffff" : "#64748b",
                        borderRadius: "50%",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                      }}
                    />
                  </div>
                  <span className={`badge ${autoGenerateBarcodes ? "bg-white text-primary" : "bg-secondary"}`} style={{ fontSize: "0.62rem" }}>
                    {autoGenerateBarcodes ? "ON" : "OFF"}
                  </span>
                </div>
              </div>

              <div className="d-flex flex-wrap gap-2 align-items-center">
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
              <div className="col-12 col-md-7">
                <label className="form-label small fw-medium">{lang === "bn" ? "বারকোড স্ক্যান বা পেস্ট করুন (প্রতি লাইনে একটি):" : "Scan or paste barcodes (one per line):"}</label>
                <textarea
                  className="form-control font-monospace"
                  rows={6}
                  placeholder={lang === "bn" ? "বারকোড স্ক্যান বা পেস্ট করুন — প্রতি লাইনে একটি।" : "Scan or paste barcodes — each code separates automatically. One code per line."}
                  value={barcodeText}
                  onChange={handleBarcodeInput}
                />
              </div>
              <div className="col-12 col-md-5">
                <div className="border rounded p-3 text-center h-100 d-flex flex-column align-items-center justify-content-center gap-2 bg-light">
                  <div className="fs-3">🖨️</div>
                  <div className="fw-semibold small">{t("pp_scan_mode") || (lang === "bn" ? "কন্টিনিউয়াস স্ক্যান মোড" : "Continuous Scan Mode")}</div>
                  <div className="text-secondary small">{t("pp_scan_hint") || (lang === "bn" ? "স্ক্যান শুরু করার জন্য এই ফিল্ডে ক্লিক করুন" : "Focus the cursor in the field to start scanning")}</div>
                  <div className="d-flex align-items-center gap-2 mt-1">
                    <span className="small text-secondary">{t("pp_digits_code") || (lang === "bn" ? "ডিজিট/কোড" : "Digits/code")}:</span>
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
                    📷 {lang === "bn" ? "ক্যামেরা দিয়ে স্ক্যান করুন" : "Scan with Camera"}
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
                    {t("pp_btn_clear_list") || (lang === "bn" ? "তালিকা মুছুন" : "Clear List")}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3">
              <button
                type="button"
                className="btn btn-brand btn-lg w-100 shadow-sm py-2.5"
                disabled={busy || tooManyBarcodes || (!selected && parsedBarcodes.length === 0)}
                onClick={addScannedUnits}
              >
                {busy ? (
                  <span className="spinner-border spinner-border-sm me-2" />
                ) : (
                  <i className="bi bi-cart-plus me-1.5"></i>
                )}
                {lang === "bn" ? `+ ${effQty} ইউনিট তালিকায় যুক্ত করুন` : `+ Add ${effQty} unit(s) to receive`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel ───────────────────────────────────────────────────── */}
      <div className="col-12 col-lg-4">
        <div className="card shadow-sm sticky-lg-top" style={{ top: "1rem" }}>
          <div className="card-header text-white fw-semibold" style={{ background: "var(--brand-900, #1a2433)" }}>
            <div>📦 {lang === "bn" ? "গ্রহণের তালিকা" : "To Receive"}</div>
            <div className="small fw-normal opacity-75">{t("pp_pending_inject") || (lang === "bn" ? "পেন্ডিং স্টক যুক্তকরণ" : "Pending Stock Injection")}</div>
          </div>
          <div className="card-body p-0">
            {lines.length === 0 ? (
              <div className="text-center text-secondary py-4 px-3">
                <div className="fs-2 mb-2">📦</div>
                <div className="small">{t("pp_pending_empty") || (lang === "bn" ? "স্টক যুক্ত করার জন্য প্রোডাক্ট যোগ করুন।" : "Add products to see them queued for stock injection.")}</div>
              </div>
            ) : (
              <div className="table-responsive" style={{ maxHeight: "300px", overflowY: "auto" }}>
                <table className="table table-sm align-middle mb-0">
                  <tbody>
                    {lines.map((l) => {
                      const mult = Number(l.product.purchase_multiplier) || 1;
                      const isBulk = mult > 1;
                      const baseUnit = l.product.unit_detail?.short_code || l.product.unit_detail?.name || "Unit";
                      const bulkUnit = l.product.purchase_unit_detail?.name || "Pack";
                      return (
                        <tr key={l.product.id}>
                          <td className="ps-3">
                            <div className="fw-semibold small text-dark">{l.product.name}</div>
                            {isBulk && (
                              <div className="text-primary small" style={{ fontSize: "0.68rem" }}>
                                📦 {l.quantity} {bulkUnit} = {l.quantity * mult} {baseUnit} (@ ৳{mult > 0 ? (l.unit_cost / mult).toFixed(2) : l.unit_cost}/{baseUnit})
                              </div>
                            )}
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
                              className="form-control form-control-sm text-center"
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
                              className="form-control form-control-sm text-end"
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="border-top px-3 py-2">
              <div className="d-flex justify-content-between small mb-1">
                <span className="text-secondary">{t("pp_subtotal") || (lang === "bn" ? "সাবটোটাল" : "Subtotal")}</span>
                <span>{money(subtotal)}</span>
              </div>
              <div className="d-flex justify-content-between fw-bold mb-3">
                <span>{t("pp_total_val") || (lang === "bn" ? "মোট মূল্য" : "Total Value")}</span>
                <span>{money(subtotal)}</span>
              </div>

              <label className="form-label small fw-medium">{t("pp_lbl_paid_now") || (lang === "bn" ? "সাপ্লায়ারকে এখন পরিশোধ করা হলো" : "Paid to supplier now")}</label>
              <div className="input-group input-group-sm mb-1">
                <span className="input-group-text">{t("pp_bdt") || (lang === "bn" ? "টাকা" : "BDT")}</span>
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
                  {t("pp_btn_pay_full") || (lang === "bn" ? "সম্পূর্ণ পরিশোধ করুন" : "Pay full")}
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
                <span className="text-secondary">{t("pp_due_after") || (lang === "bn" ? "পরিশোধের পর সাপ্লায়ারের বকেয়া" : "Supplier due after payment")}</span>
                <span className={`fw-semibold ${supplierDue > 0 ? "text-danger" : "text-success"}`}>{money(supplierDue)}</span>
              </div>

              {supplierDue > 0 && (
                <div className="mt-2 p-2 bg-warning-subtle rounded border border-warning-subtle">
                  <label className="form-label small fw-semibold text-warning mb-1 d-flex align-items-center gap-1">
                    📅 {lang === "bn" ? "পরিশোধের প্রতিশ্রুত তারিখ (Promised Due Date)" : "Promised Payment Date"}
                  </label>
                  <input
                    type="date"
                    className="form-control form-control-sm font-monospace"
                    value={promisedDate}
                    onChange={(e) => setPromisedDate(e.target.value)}
                  />
                  <div className="d-flex flex-wrap gap-1 mt-1">
                    <button type="button" className="btn btn-outline-warning btn-xs py-0 px-1" style={{ fontSize: "0.68rem" }} onClick={() => setPromisedDate(addDays(7))}>+7d</button>
                    <button type="button" className="btn btn-outline-warning btn-xs py-0 px-1" style={{ fontSize: "0.68rem" }} onClick={() => setPromisedDate(addDays(15))}>+15d</button>
                    <button type="button" className="btn btn-outline-warning btn-xs py-0 px-1" style={{ fontSize: "0.68rem" }} onClick={() => setPromisedDate(addDays(30))}>+30d</button>
                    <button type="button" className="btn btn-outline-warning btn-xs py-0 px-1" style={{ fontSize: "0.68rem" }} onClick={() => setPromisedDate(getNextMonthFirstDay())}>{lang === "bn" ? "পরের মাসের ১ তারিখ" : "1st Next Mth"}</button>
                  </div>
                </div>
              )}
            </div>

            {/* Purchase Summary */}
            <div className="border-top px-3 py-3">
              <div className="fw-bold small mb-2">{t("pp_summary_title") || (lang === "bn" ? "পার্চেজ সামারি" : "PURCHASE SUMMARY")}</div>
              <div className="mb-2">
                <label className="small fw-medium">{t("pp_lbl_vendor") || (lang === "bn" ? "ভেন্ডর" : "Vendor")}</label>
                <div className="d-flex gap-2 align-items-center">
                  <select
                    className="form-select form-select-sm"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                  >
                    <option value="">{lang === "bn" ? "— কোনোটি নয় —" : "— none —"}</option>
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
                  <div className="small fw-bold text-brand mb-2">✨ {lang === "bn" ? "দ্রুত সাপ্লায়ার যুক্ত করুন" : "Quick Add Vendor"}</div>
                  <input
                    required
                    className="form-control form-control-sm mb-2"
                    placeholder={lang === "bn" ? "সাপ্লায়ারের নাম *" : "Vendor Name *"}
                    value={newVendor.name}
                    onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                  />
                  <input
                    className="form-control form-control-sm mb-2"
                    placeholder={lang === "bn" ? "মোবাইল নম্বর" : "Phone Number"}
                    value={newVendor.phone}
                    onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                  />
                  <input
                    className="form-control form-control-sm mb-3"
                    placeholder={lang === "bn" ? "ঠিকানা / ওয়্যারহাউজ" : "Warehouse / Address"}
                    value={newVendor.address}
                    onChange={(e) => setNewVendor({ ...newVendor, address: e.target.value })}
                  />
                  <div className="d-flex gap-2 justify-content-end">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setShowNewVendor(false)}
                    >
                      {t("pp_btn_cancel") || (lang === "bn" ? "বাতিল" : "Cancel")}
                    </button>
                    <button className="btn btn-brand btn-sm" disabled={savingVendor}>
                      {savingVendor ? (lang === "bn" ? "যোগ হচ্ছে…" : "Adding…") : (lang === "bn" ? "সাপ্লায়ার সংরক্ষণ" : "Add Vendor")}
                    </button>
                  </div>
                </form>
              )}

              {branches.length > 0 && (
                <div>
                  <label className="small fw-medium">{t("pp_lbl_warehouse") || (lang === "bn" ? "গুদাম (Warehouse)" : "Warehouse")}</label>
                  <select
                    className="form-select form-select-sm"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                  >
                    <option value="">{lang === "bn" ? "— ডিফল্ট —" : "— default —"}</option>
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
                className="btn btn-brand btn-lg w-100 mb-1 shadow-sm py-2.5"
                disabled={busy || lines.length === 0}
                onClick={pushToStock}
              >
                {busy ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    {t("pp_pushing") || (lang === "bn" ? "স্টকে যুক্ত হচ্ছে…" : "Pushing to Stock…")}
                  </>
                ) : (
                  <>
                    <i className="bi bi-box-arrow-in-down me-1.5"></i>
                    {t("pp_btn_push_stock") || "Push to Stock"}
                  </>
                )}
              </button>
              <div className="text-center text-secondary small mb-1" style={{ fontSize: "0.75rem" }}>
                ⓘ Updates ledger &amp; inventory levels
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOOTSTRAP MODAL WINDOW: EXACT REPLICA OF PRODUCT LIST "ADD PRODUCT" FORM ── */}
      {showNewProduct && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1050 }} onClick={() => setShowNewProduct(false)} />
          <div className="modal fade show d-block" tabIndex={-1} style={{ zIndex: 1055 }}>
            <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl modal-fullscreen-lg-down">
              <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
                {/* Modal Header */}
                <div className="modal-header bg-primary bg-opacity-10 border-bottom border-primary border-opacity-25 py-3 px-4 d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-2">
                    <div className="p-2 rounded-circle bg-primary bg-opacity-25 text-primary fs-5">
                      <i className="bi bi-box-seam-fill"></i>
                    </div>
                    <div>
                      <h5 className="modal-title fw-bold text-primary mb-0">
                        {lang === "bn" ? "নতুন পণ্য ক্যাটালগে যুক্ত করুন (Add New Product)" : "Add New Product Record"}
                      </h5>
                      <span className="small text-secondary">
                        {isSpecialShop ? (lang === "bn" ? "কেমিক্যাল / স্পেশাল শপ মোড" : "Special Shop Mode") : (lang === "bn" ? "স্ট্যান্ডার্ড রিটেইল মোড" : "Standard Retail Mode")}
                      </span>
                    </div>
                  </div>
                  <button type="button" className="btn-close" onClick={() => setShowNewProduct(false)}></button>
                </div>

                {/* Modal Body: The Exact Product List Add Form (Image 2) */}
                <div className="modal-body p-3 p-md-4">
                  <form id="purchaseNewProductForm" onSubmit={createProduct} className="row g-3">
                    {/* 1. Product Name */}
                    <div className="col-12 col-md-4">
                      <label className="small fw-semibold">{t("prod_list_name") || (lang === "bn" ? "পণ্যের নাম *" : "Product Name *")}</label>
                      <input
                        required
                        className="form-control form-control-sm"
                        value={newProd.name}
                        onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
                        placeholder={lang === "bn" ? "যেমন: ক্যাস্টর অয়েল / শ্যাম্পু" : "e.g. Castor Oil / Shampoo"}
                        autoFocus
                      />
                    </div>

                    {/* 2. SKU */}
                    <div className="col-12 col-md-4">
                      <label className="small fw-medium">
                        {t("prod_list_sku") || "SKU"} <span className="text-secondary small">({lang === "bn" ? "স্বয়ংক্রিয়" : "Auto"})</span>
                      </label>
                      <input
                        placeholder={t("prod_list_auto_gen") || (lang === "bn" ? "স্বয়ংক্রিয় তৈরি হবে" : "auto-generated")}
                        className="form-control form-control-sm"
                        value={newProd.sku}
                        onChange={(e) => setNewProd({ ...newProd, sku: e.target.value })}
                      />
                    </div>

                    {/* 3. Category with Quick Add */}
                    <div className="col-12 col-md-4">
                      <label className="small fw-medium">{t("prod_list_category") || (lang === "bn" ? "ক্যাটাগরি" : "Category")}</label>
                      <select
                        className="form-select form-select-sm mb-1"
                        value={newProd.category}
                        onChange={(e) => setNewProd({ ...newProd, category: e.target.value })}
                      >
                        <option value="">{t("prod_list_none") || (lang === "bn" ? "-- কোনোটি নয় --" : "-- None --")}</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <div className="input-group input-group-sm">
                        <input
                          className="form-control"
                          placeholder={t("prod_list_new_cat") || (lang === "bn" ? "নতুন ক্যাটাগরি..." : "+ New category...")}
                          value={newCat}
                          onChange={(e) => setNewCat(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), quickAdd("category"))}
                        />
                        <button type="button" className="btn btn-outline-brand" onClick={() => quickAdd("category")}>
                          {t("prod_list_add") || (lang === "bn" ? "যোগ" : "Add")}
                        </button>
                      </div>
                    </div>

                    {/* 4. Brand with Quick Add */}
                    <div className="col-12 col-md-3">
                      <label className="small fw-medium">{t("prod_list_brand") || (lang === "bn" ? "ব্র্যান্ড" : "Brand")}</label>
                      <select
                        className="form-select form-select-sm mb-1"
                        value={newProd.brand}
                        onChange={(e) => setNewProd({ ...newProd, brand: e.target.value })}
                      >
                        <option value="">{t("prod_list_none") || (lang === "bn" ? "-- কোনোটি নয় --" : "-- None --")}</option>
                        {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                      <div className="input-group input-group-sm">
                        <input
                          className="form-control"
                          placeholder={t("prod_list_new_brand") || (lang === "bn" ? "নতুন ব্র্যান্ড..." : "+ New brand...")}
                          value={newBrand}
                          onChange={(e) => setNewBrand(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), quickAdd("brand"))}
                        />
                        <button type="button" className="btn btn-outline-brand" onClick={() => quickAdd("brand")}>
                          {t("prod_list_add") || (lang === "bn" ? "যোগ" : "Add")}
                        </button>
                      </div>
                    </div>

                    {/* 5. Sale Unit with Quick Add */}
                    {isSpecialShop ? (
                      <div className="col-12 col-md-3">
                        <label className="small fw-medium text-primary">{lang === "bn" ? "বিক্রয় ইউনিট (Unit)" : "Sale Unit"}</label>
                        <select
                          className="form-select form-select-sm mb-1"
                          value={newProd.unit}
                          onChange={(e) => setNewProd({ ...newProd, unit: e.target.value })}
                        >
                          <option value="">{lang === "bn" ? "-- ইউনিট সিলেক্ট করুন --" : "-- Select Unit --"}</option>
                          {units.map((u) => <option key={u.id} value={u.id}>{u.name} {u.short_code ? `(${u.short_code})` : ""}</option>)}
                        </select>
                        <div className="input-group input-group-sm">
                          <input
                            className="form-control"
                            placeholder={lang === "bn" ? "নতুন ইউনিট (যেমন: Kg, Liter)" : "+ New unit"}
                            value={newUnit}
                            onChange={(e) => setNewUnit(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), quickAdd("unit"))}
                          />
                          <button type="button" className="btn btn-outline-brand" onClick={() => quickAdd("unit")}>
                            {t("prod_list_add") || (lang === "bn" ? "যোগ" : "Add")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="col-12 col-md-2">
                        <label className="small fw-medium">{t("prod_list_unit") || "Unit"}</label>
                        <select
                          className="form-select form-select-sm mb-1"
                          value={newProd.unit}
                          onChange={(e) => setNewProd({ ...newProd, unit: e.target.value })}
                        >
                          {units.length === 0 && <option value="">{lang === "bn" ? "পিস (Piece / Pcs)" : "Piece / Pcs"}</option>}
                          {units.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} {u.short_code ? `(${u.short_code})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* 6. Bulk Purchase Unit & Multiplier (for Special / Chemical Shops) */}
                    {isSpecialShop && (
                      <>
                        <div className="col-12 col-md-3">
                          <label className="small fw-medium text-primary">{lang === "bn" ? "পাইকারি/ড্রাম ইউনিট (Purchase Unit)" : "Bulk/Purchase Unit"}</label>
                          <select
                            className="form-select form-select-sm mb-1"
                            value={newProd.purchase_unit}
                            onChange={(e) => setNewProd({ ...newProd, purchase_unit: e.target.value })}
                          >
                            <option value="">{lang === "bn" ? "-- ড্রাম/বক্স ইউনিট (ঐচ্ছিক) --" : "-- Select Bulk Unit (Optional) --"}</option>
                            {units.map((u) => <option key={u.id} value={u.id}>{u.name} {u.short_code ? `(${u.short_code})` : ""}</option>)}
                          </select>
                        </div>
                        <div className="col-12 col-md-3">
                          <label className="small fw-semibold text-primary" title="Conversion Multiplier">
                            {lang === "bn" ? "প্রতি ড্রাম/বক্সে পরিমাণ" : "Qty per Drum/Box"}
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="1"
                            className="form-control form-control-sm mb-1"
                            value={newProd.purchase_multiplier}
                            placeholder="e.g. 50"
                            onChange={(e) => {
                              const newMult = e.target.value;
                              const multiplierVal = Number(newMult) || 1;
                              const packCost = Number(newProd.full_pack_cost) || 0;
                              const packSell = Number(newProd.full_pack_sell) || 0;
                              const perUnitCost = packCost > 0 ? (packCost / multiplierVal).toFixed(2) : newProd.cost_price;
                              const perUnitSell = packSell > 0 ? (packSell / multiplierVal).toFixed(2) : newProd.selling_price;
                              setNewProd({ ...newProd, purchase_multiplier: newMult, cost_price: perUnitCost, selling_price: perUnitSell });
                            }}
                            title="Example: 1 Drum = 50 Liters, place 50 here."
                          />
                        </div>
                      </>
                    )}

                    {/* 7. Pricing Mode Toggle */}
                    {isSpecialShop && Number(newProd.purchase_multiplier) > 1 && (
                      <div className="col-12 mb-2 p-2 rounded" style={{ backgroundColor: "rgba(13,110,253,0.05)", border: "1px solid rgba(13,110,253,0.1)" }}>
                        <label className="small text-primary fw-bold mb-1">{lang === "bn" ? "দাম নির্ধারণ পদ্ধতি" : "Pricing Entry Method"}</label>
                        <select className="form-select form-select-sm" value={newPricingMode} onChange={(e) => setNewPricingMode(e.target.value as any)}>
                          <option value="regular">{lang === "bn" ? `সাধারণ (প্রতি ${units.find(u => String(u.id) === String(newProd.unit))?.name || "লিটার/কেজি"} আলাদা ইনপুট)` : `Regular (Per ${units.find(u => String(u.id) === String(newProd.unit))?.name || "Unit"} manually)`}</option>
                          <option value="bulk">{lang === "bn" ? `বাল্ক অটো-ক্যালকুলেট (সম্পূর্ণ ${units.find(u => String(u.id) === String(newProd.purchase_unit))?.name || "ড্রাম/বক্স"} এর দাম)` : `Bulk Auto-Calculate (Full ${units.find(u => String(u.id) === String(newProd.purchase_unit))?.name || "Drum/Pack"} Price)`}</option>
                        </select>
                      </div>
                    )}

                    {/* 8. Full Pack Pricing when Bulk mode */}
                    {(isSpecialShop && newPricingMode === "bulk" && Number(newProd.purchase_multiplier) > 1) && (
                      <>
                        <div className="col-12 col-md-3">
                          <label className="small text-primary fw-medium">Full {units.find(u => String(u.id) === String(newProd.purchase_unit))?.name || "Drum/Box"} Cost</label>
                          <div className="input-group input-group-sm mb-1">
                            <span className="input-group-text">৳</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="form-control"
                              value={newProd.full_pack_cost}
                              placeholder="e.g. 20000"
                              onChange={(e) => {
                                const packCost = Number(e.target.value) || 0;
                                const multiplier = Number(newProd.purchase_multiplier) || 1;
                                const perUnitCost = (packCost / multiplier).toFixed(2);
                                setNewProd({ ...newProd, full_pack_cost: e.target.value, cost_price: perUnitCost });
                              }}
                              title="Enter full drum cost. Per unit cost will be auto calculated."
                            />
                          </div>
                        </div>
                        <div className="col-12 col-md-3">
                          <label className="small text-primary fw-medium">Full {units.find(u => String(u.id) === String(newProd.purchase_unit))?.name || "Drum/Box"} Sell</label>
                          <div className="input-group input-group-sm mb-1">
                            <span className="input-group-text">৳</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="form-control"
                              value={newProd.full_pack_sell}
                              placeholder="e.g. 24000"
                              onChange={(e) => {
                                const packSell = Number(e.target.value) || 0;
                                const multiplier = Number(newProd.purchase_multiplier) || 1;
                                const perUnitSell = (packSell / multiplier).toFixed(2);
                                setNewProd({ ...newProd, full_pack_sell: e.target.value, selling_price: perUnitSell });
                              }}
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* 9. Unit Cost */}
                    <div className="col-12 col-md-3">
                      <label className="small text-primary fw-medium">
                        {(isSpecialShop && newPricingMode === "bulk" && Number(newProd.purchase_multiplier) > 1) ? `Cost per ${units.find(u => String(u.id) === String(newProd.unit))?.name || "Unit"}` : (t("prod_list_cost") || "Cost Price")}
                      </label>
                      <div className="input-group input-group-sm mb-1">
                        <span className="input-group-text">৳</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-control"
                          value={newProd.cost_price}
                          onChange={(e) => setNewProd({ ...newProd, cost_price: e.target.value })}
                          title={(isSpecialShop && newPricingMode === "bulk" && Number(newProd.purchase_multiplier) > 1) ? "Auto calculated from Pack Cost / Multiplier" : ""}
                        />
                      </div>
                    </div>

                    {/* 10. Selling Price & Margin Indicator */}
                    <div className="col-12 col-md-3">
                      <label className="small text-primary fw-medium">
                        {(isSpecialShop && newPricingMode === "bulk" && Number(newProd.purchase_multiplier) > 1) ? `Selling Price per ${units.find(u => String(u.id) === String(newProd.unit))?.name || "Unit"}` : (t("prod_list_selling_price") || "Selling Price")}
                      </label>
                      <div className="input-group input-group-sm mb-1">
                        <span className="input-group-text">৳</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-control"
                          value={newProd.selling_price}
                          onChange={(e) => setNewProd({ ...newProd, selling_price: e.target.value })}
                        />
                      </div>
                      {(isSpecialShop && newPricingMode === "bulk" && Number(newProd.purchase_multiplier) > 1) && Number(newProd.selling_price) > 0 && Number(newProd.cost_price) > 0 && (
                        <div className="text-success fw-bold" style={{ fontSize: "0.75rem", marginTop: "-2px" }}>
                          ✅ Margin: ৳{(Number(newProd.selling_price) - Number(newProd.cost_price)).toFixed(2)} per {units.find(u => String(u.id) === String(newProd.unit))?.short_code || "Unit"}
                        </div>
                      )}
                    </div>

                    {/* 11. Reorder Level */}
                    <div className="col-12 col-md-3">
                      <label className="small">{t("prod_list_reorder_level") || (lang === "bn" ? "রিঅর্ডার লেভেল" : "Reorder Level")}</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        className="form-control form-control-sm"
                        value={newProd.reorder_level}
                        onChange={(e) => setNewProd({ ...newProd, reorder_level: e.target.value })}
                        placeholder="5"
                      />
                    </div>

                    {/* 12. Barcode */}
                    <div className="col-12 col-md-3">
                      <label className="small">{lang === "bn" ? "বারকোড (ঐচ্ছিক)" : "Barcode (Optional)"}</label>
                      <input
                        className="form-control form-control-sm"
                        value={newProd.barcode}
                        onChange={(e) => setNewProd({ ...newProd, barcode: e.target.value })}
                        placeholder={lang === "bn" ? "ঐচ্ছিক বারকোড" : "optional"}
                      />
                    </div>

                    {/* 13. Warranty / Replacement (Hardware / Non-special shops) */}
                    {!isSpecialShop && (
                      <>
                        <div className="col-12 col-md-2">
                          <label className="small">{t("prod_list_warranty_months") || (lang === "bn" ? "ওয়ারেন্টি (মাস)" : "Warranty (Months)")}</label>
                          <input
                            type="number"
                            min="0"
                            className="form-control form-control-sm"
                            value={newProd.warranty_months}
                            onChange={(e) => setNewProd({ ...newProd, warranty_months: e.target.value })}
                            placeholder="0"
                          />
                        </div>
                        <div className="col-12 col-md-2">
                          <label className="small" title="Replacement Guarantee (Days)">{t("prod_list_replacement_days") || (lang === "bn" ? "রিপ্লেসমেন্ট (দিন)" : "Replacement (Days)")}</label>
                          <input
                            type="number"
                            min="0"
                            className="form-control form-control-sm"
                            value={newProd.replacement_guarantee_days}
                            onChange={(e) => setNewProd({ ...newProd, replacement_guarantee_days: e.target.value })}
                            placeholder="0"
                          />
                        </div>
                      </>
                    )}
                  </form>
                </div>

                {/* Modal Footer */}
                <div className="modal-footer bg-light p-3 d-flex align-items-center justify-content-between">
                  <button type="button" className="btn btn-secondary btn-sm px-4 rounded-pill" onClick={() => setShowNewProduct(false)}>
                    {t("pp_btn_cancel") || (lang === "bn" ? "বাতিল" : "Cancel")}
                  </button>
                  <button
                    type="submit"
                    form="purchaseNewProductForm"
                    className="btn btn-brand btn-sm px-4 rounded-pill shadow-sm fw-bold"
                    disabled={savingProd}
                  >
                    {savingProd ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1.5" />
                        {t("prod_list_saving") || (lang === "bn" ? "সংরক্ষণ হচ্ছে…" : "Saving…")}
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle-fill me-1.5"></i>
                        {t("prod_list_save") || (lang === "bn" ? "পণ্য সংরক্ষণ করুন" : "Save product")}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

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
