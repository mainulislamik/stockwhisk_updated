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
  const { user } = useAuth();
  const isSpecialShop = user?.shop_business_type === "camical" || user?.shop_business_type === "supershop" || user?.shop_business_type === "cosmetics" || user?.shop_business_type === "beauty";

  // Intake Mode: 'search' (Search Existing) or 'create' (Create New Master)
  const [intakeMode, setIntakeMode] = useState<"search" | "create">("search");

  // Product search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Selected product for pricing/inward panel
  const [selected, setSelected] = useState<Product | null>(null);
  const [fullPackCost, setFullPackCost] = useState("");
  const [fullPackSell, setFullPackSell] = useState("");
  const [pricingMode, setPricingMode] = useState<"regular" | "bulk">("regular");

  // Lines in "To Receive" cart
  const [lines, setLines] = useState<ReceiveLine[]>([]);

  // Bulk barcode scan
  const [barcodeText, setBarcodeText] = useState("");
  const [digitsPerCode, setDigitsPerCode] = useState(13);
  const [showScanner, setShowScanner] = useState(false);
  const [bulkQty, setBulkQty] = useState("");
  const [qtyTouched, setQtyTouched] = useState(false);
  const [autoGenerateBarcodes, setAutoGenerateBarcodes] = useState(false);

  const { isConnected: scannerConnected } = useScannerWebSocket(user?.shop ?? undefined, (barcode) => {
    setBarcodeText((prev) => (prev ? `${prev}\n${barcode}` : barcode));
  });

  // Master definitions & Quick add states (Exact replica of Product List page)
  const [categories, setCategories] = useState<Named[]>([]);
  const [brands, setBrands] = useState<Named[]>([]);
  const [units, setUnits] = useState<Named[]>([]);
  const [newCat, setNewCat] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newUnit, setNewUnit] = useState("");

  // Create New Product Form State (Exact same as Product List page)
  const [form, setForm] = useState({
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
  const [formPricingMode, setFormPricingMode] = useState<"regular" | "bulk">("regular");
  const [savingProduct, setSavingProduct] = useState(false);

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
        setForm((f) => ({ ...f, category: String(created.id) }));
      } else if (kind === "brand") {
        setBrands((b) => [...b, created]);
        setNewBrand("");
        setForm((f) => ({ ...f, brand: String(created.id) }));
      } else {
        setUnits((u) => [...u, created]);
        setNewUnit("");
        setForm((f) => ({ ...f, unit: String(created.id) }));
      }
      toast.success(lang === "bn" ? "সফলভাবে যোগ করা হয়েছে" : "Added successfully");
    } catch (e: any) {
      toast.error(e?.message || (lang === "bn" ? "যোগ করতে ব্যর্থ হয়েছে" : "Failed to add"));
    }
  }

  // ─── Search ──────────────────────────────────────────────────────────────
  const doSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const params: Record<string, string> = { search: q };
      const r = await api<any>("/catalog/products/", { params });
      const list: Product[] = Array.isArray(r) ? r : r?.results ?? [];
      setSearchResults(list);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(doSearch, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, doSearch]);

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

  function generateBarcodesForSelected() {
    if (!selected) return;
    const cnt = hasBulkQty ? effQty : (parsedBarcodes.length || 1);
    const generated = generateBarcodesHelper(selected, cnt);
    setBarcodeText(generated.join("\n") + "\n");
    toast.success(lang === "bn" ? `${cnt} টি বারকোড তৈরি হয়েছে` : `Generated ${cnt} barcodes`);
  }

  function selectProduct(p: Product) {
    setSelected(p);
    setFullPackCost("");
    setFullPackSell("");
    setPricingMode("regular");
    setSearchResults(null);
    setSearchQuery("");
    setBulkQty("");
    setQtyTouched(false);
    if (autoGenerateBarcodes) {
      const generated = generateBarcodesHelper(p, 1);
      setBarcodeText(generated.join("\n") + "\n");
    } else {
      setBarcodeText("");
    }
  }

  // ─── Save & Inward New Product (Exact functionality as Product List) ──────
  async function saveProductAndInward(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSavingProduct(true);
    try {
      const mult = form.purchase_multiplier !== "" ? Number(form.purchase_multiplier) : 1.0;
      const p = await api<Product>("/catalog/products/", {
        method: "POST",
        body: {
          name: form.name.trim(),
          sku: form.sku.trim() || "",
          barcode: form.barcode || "",
          category: form.category ? Number(form.category) : null,
          brand: form.brand ? Number(form.brand) : null,
          unit: form.unit ? Number(form.unit) : null,
          purchase_unit: form.purchase_unit ? Number(form.purchase_unit) : null,
          purchase_multiplier: mult,
          full_pack_cost: form.full_pack_cost !== "" ? Number(form.full_pack_cost) : 0,
          full_pack_sell: form.full_pack_sell !== "" ? Number(form.full_pack_sell) : 0,
          cost_price: form.cost_price ? Number(form.cost_price) : 0,
          selling_price: form.selling_price ? Number(form.selling_price) : 0,
          reorder_level:
            form.reorder_level === ""
              ? 5
              : Math.max(0, Math.round(Number(form.reorder_level) || 0)),
          warranty_months: !isSpecialShop && form.warranty_months ? Number(form.warranty_months) : 0,
          replacement_guarantee_days: !isSpecialShop && form.replacement_guarantee_days ? Number(form.replacement_guarantee_days) : 0,
          expiry_date: form.expiry_date || null,
          lot_number: form.lot_number || "",
          mfg_date: form.mfg_date || null,
          track_inventory: true,
        },
      });

      // Reset form
      setForm({
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

      // Switch to search/existing mode with newly created product selected
      setIntakeMode("search");
      selectProduct(p);
      setLines((prev) => [
        ...prev,
        { product: p, quantity: 1, unit_cost: drumCostFor(p), barcodes: autoGenerateBarcodes ? generateBarcodesHelper(p, 1) : [] },
      ]);
      toast.success(lang === "bn" ? `"${p.name}" তৈরি হয়েছে এবং রিসিভ তালিকায় যুক্ত হয়েছে!` : `"${p.name}" created and added to receive list!`);
    } catch (e: any) {
      toast.error(e?.message || (lang === "bn" ? "পণ্য তৈরি করতে ব্যর্থ হয়েছে।" : "Failed to create product."));
    } finally {
      setSavingProduct(false);
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

  // ─── Cart / Line mutations ─────────────────────────────────────────────────
  const parsedBarcodes = barcodeText
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const numInput = Number(bulkQty);
  const hasBulkQty = qtyTouched && !isNaN(numInput) && numInput > 0;
  const effQty = hasBulkQty ? Math.max(1, Math.round(numInput)) : (parsedBarcodes.length || 1);
  const qtyDisplay = hasBulkQty ? String(effQty) : (parsedBarcodes.length > 0 ? String(parsedBarcodes.length) : "");
  const tooManyBarcodes = hasBulkQty && parsedBarcodes.length > effQty;

  async function addScannedUnits() {
    if (!selected && parsedBarcodes.length === 0) {
      setError(lang === "bn" ? "অনুগ্রহ করে উপরে পণ্য নির্বাচন করুন অথবা বারকোড স্ক্যান করুন।" : "Please search or select a product above, or scan recognized product barcodes.");
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
      setError(e?.data?.detail || e?.message || "Failed to parse barcodes.");
    } finally {
      setBusy(false);
    }
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
      {/* ── Left Main Panel ────────────────────────────────────────────────── */}
      <div className="col-lg-8">
        {/* Top Header Bar */}
        <div className="card shadow-sm mb-3">
          <div className="card-body">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
              <div>
                <h1 className="h5 fw-bold mb-0 text-brand d-flex align-items-center gap-2">
                  <i className="bi bi-box-arrow-in-down"></i>
                  {t("pp_title") || (lang === "bn" ? "পণ্য ক্রয় ও স্টক ইনজেকশন" : "Purchase & Stock Inward")}
                </h1>
                <div className="text-secondary small">{t("pp_subtitle") || (lang === "bn" ? "সরবরাহকারী থেকে নতুন পণ্য তৈরি বা বিদ্যমান পণ্যের চালান সরাসরি স্টকে গ্রহণ করুন।" : "Receive stock from suppliers.")}</div>
              </div>
              <div className="d-flex gap-2 align-items-center">
                <div className="small fw-semibold d-none d-sm-flex align-items-center gap-1 bg-light px-2.5 py-1 rounded border">
                  <span
                    className={`d-inline-block rounded-circle ${scannerConnected ? "bg-success" : "bg-secondary"}`}
                    style={{ width: 8, height: 8 }}
                  ></span>
                  <span className={scannerConnected ? "text-success" : "text-secondary"} style={{ fontSize: "0.75rem" }}>
                    {scannerConnected ? "Scanner Online" : "Scanner Offline"}
                  </span>
                </div>
                <button className="btn btn-outline-secondary btn-sm" onClick={() => router.back()}>
                  {t("pp_btn_cancel") || (lang === "bn" ? "ফিরে যান" : "Back")}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── MERGED UNIFIED INWARD CARD (Search Existing OR Create New) ──────── */}
        <div className="card shadow-sm mb-3 border-brand">
          <div className="card-header bg-light border-bottom p-2 d-flex flex-wrap align-items-center justify-content-between gap-2">
            {/* Mode Switcher Tabs */}
            <div className="nav nav-pills gap-1">
              <button
                type="button"
                className={`btn btn-sm rounded-pill px-3 fw-bold ${intakeMode === "search" ? "btn-primary shadow-sm" : "btn-light text-secondary"}`}
                onClick={() => setIntakeMode("search")}
              >
                <i className="bi bi-search me-1.5"></i>
                {lang === "bn" ? "১. বিদ্যমান পণ্য বাছাই করুন" : "1. Select Existing Product"}
              </button>
              <button
                type="button"
                className={`btn btn-sm rounded-pill px-3 fw-bold ${intakeMode === "create" ? "btn-brand shadow-sm" : "btn-light text-secondary"}`}
                onClick={() => setIntakeMode("create")}
              >
                <i className="bi bi-plus-circle me-1.5"></i>
                {lang === "bn" ? "২. নতুন পণ্য তৈরি করুন" : "2. Create New Product"}
              </button>
            </div>

            <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 font-monospace" style={{ fontSize: "0.7rem" }}>
              {isSpecialShop ? (lang === "bn" ? "কেমিক্যাল / স্পেশাল শপ" : "Special Shop") : (lang === "bn" ? "স্ট্যান্ডার্ড রিটেইল" : "Standard Retail")}
            </span>
          </div>

          <div className="card-body p-3 p-md-4">
            {/* ── TAB 1: Search & Pick Existing Catalog Product ── */}
            {intakeMode === "search" && (
              <div className="animate-fade-in">
                {/* Search Bar */}
                <div className="mb-3">
                  <label className="small fw-bold text-dark mb-1">
                    🔍 {lang === "bn" ? "পণ্য খুঁজুন (নাম, SKU বা বারকোড দিয়ে):" : "Search Product (by Name, SKU or Barcode):"}
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-white"><i className="bi bi-search text-secondary"></i></span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder={lang === "bn" ? "যেমন: ক্যাস্টর অয়েল, শ্যাম্পু, SKU বা বারকোড টাইপ করুন…" : "Type product name, SKU or barcode to search…"}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                    />
                    {searchQuery && (
                      <button className="btn btn-outline-secondary" type="button" onClick={() => setSearchQuery("")}>
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {searching && <Spinner label={t("pp_searching") || (lang === "bn" ? "অনুসন্ধান চলছে…" : "Searching…")} />}

                {/* Dropdown / Search Results List */}
                {searchResults && searchResults.length > 0 && (
                  <div className="border rounded-3 p-2 mb-3 bg-light shadow-sm" style={{ maxHeight: "240px", overflowY: "auto" }}>
                    <div className="small fw-bold text-secondary mb-1.5 px-1">{t("pp_search_results") || (lang === "bn" ? "খুঁজে পাওয়া পণ্যসমূহ:" : "Matching Products:")}</div>
                    <div className="d-flex flex-column gap-1.5">
                      {searchResults.map((p) => (
                        <div
                          key={p.id}
                          className="d-flex justify-content-between align-items-center p-2 rounded-2 bg-white border hover-shadow"
                          style={{ cursor: "pointer" }}
                          onClick={() => selectProduct(p)}
                        >
                          <div>
                            <span className="fw-bold text-dark">{p.name}</span>
                            {p.sku && <span className="badge bg-secondary ms-2">{p.sku}</span>}
                            {p.barcode && <span className="badge bg-light text-dark ms-1">BC: {p.barcode}</span>}
                            <div className="text-secondary small mt-0.5">
                              {t("pp_stock") || (lang === "bn" ? "বর্তমান স্টক" : "Stock")}: <strong className="text-success">{p.current_stock} {p.unit_detail?.name || ""}</strong> · {t("pp_cost") || "ক্রয়"}: {money(p.cost_price)} · {t("pp_sell") || "বিক্রয়"}: {money(p.selling_price)}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-brand btn-sm px-3 rounded-pill shadow-sm"
                            onClick={(e) => { e.stopPropagation(); selectProduct(p); }}
                          >
                            <i className="bi bi-check2 me-1"></i>
                            {t("pp_btn_select") || (lang === "bn" ? "বাছাই" : "Select")}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {searchResults && searchResults.length === 0 && !searching && (
                  <div className="alert alert-warning py-2 small mb-3 d-flex align-items-center justify-content-between">
                    <span>{lang === "bn" ? "এই নামে কোনো পণ্য পাওয়া যায়নি।" : "No matching product found."}</span>
                    <button type="button" className="btn btn-brand btn-sm" onClick={() => { setIntakeMode("create"); setForm({ ...form, name: searchQuery }); }}>
                      + {lang === "bn" ? "নতুন পণ্য তৈরি করুন" : "Create as New Product"}
                    </button>
                  </div>
                )}

                {/* Selected Product Card */}
                {selected ? (
                  <div className="card shadow-sm border-primary mb-3 bg-primary bg-opacity-10">
                    <div className="card-body p-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <div>
                          <span className="badge bg-primary me-2">{t("pp_badge_selected") || (lang === "bn" ? "নির্বাচিত পণ্য" : "SELECTED")}</span>
                          <strong className="fs-6 text-dark">{selected.name}</strong>
                          {selected.sku && <span className="badge bg-secondary ms-2">{selected.sku}</span>}
                          {selected.barcode && <span className="badge bg-light text-dark ms-1 border">BC: {selected.barcode}</span>}
                          <div className="text-secondary small mt-1">
                            {t("pp_current_stock") || (lang === "bn" ? "বর্তমান স্টক" : "In Stock")}: <strong className="text-success">{selected.current_stock} {selected.unit_detail?.name || "Unit"}</strong>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm bg-white"
                          onClick={() => setSelected(null)}
                        >
                          ✕ {t("pp_btn_clear") || (lang === "bn" ? "মুছুন" : "Clear")}
                        </button>
                      </div>

                      {/* Pricing & Shipment Details for selected product */}
                      <div className="bg-white p-3 rounded-3 border mt-2">
                        <h6 className="fw-bold small text-brand mb-2.5">💰 {lang === "bn" ? "এই চালানের ক্রয় ও বিক্রয় মূল্য নির্ধারণ:" : "Set Purchase Cost & Batch Details:"}</h6>
                        <div className="row g-2.5">
                          {/* Bulk Mode Selector if applicable */}
                          {isSpecialShop && Number(selected.purchase_multiplier) > 1 && selected.unit_detail?.measure_type !== "count" && (
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
                              <div className="col-md-6">
                                <label className="small fw-medium text-primary">{lang === "bn" ? "পুরো ড্রাম/বক্স ক্রয়মূল্য (৳)" : "Full Drum/Box Cost (৳)"}</label>
                                <div className="input-group input-group-sm">
                                  <span className="input-group-text">৳</span>
                                  <input
                                    className="form-control"
                                    type="number"
                                    step="0.01"
                                    placeholder="e.g. 5000"
                                    value={fullPackCost}
                                    onChange={(e) => {
                                      const packVal = e.target.value;
                                      setFullPackCost(packVal);
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
                              <div className="col-md-6">
                                <label className="small fw-medium text-primary">Full Drum/Box Sell (৳)</label>
                                <div className="input-group input-group-sm">
                                  <span className="input-group-text">৳</span>
                                  <input
                                    className="form-control"
                                    type="number"
                                    step="0.01"
                                    placeholder="e.g. 6000"
                                    value={fullPackSell}
                                    onChange={(e) => {
                                      const packVal = e.target.value;
                                      setFullPackSell(packVal);
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
                            </>
                          )}

                          <div className="col-md-6">
                            <label className="small fw-medium">{(isSpecialShop && pricingMode === "bulk") ? "Auto Cost (Base Unit)" : (t("pp_lbl_cost_bdt") || "Cost Price (BDT)")}</label>
                            <div className="input-group input-group-sm">
                              <span className="input-group-text">৳</span>
                              <input
                                className="form-control"
                                type="number"
                                step="0.01"
                                value={cost}
                                disabled={isSpecialShop && pricingMode === "bulk"}
                                onChange={(e) => {
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

                          <div className="col-md-6">
                            <label className="small fw-medium">{(isSpecialShop && pricingMode === "bulk") ? "Auto Selling (Base Unit)" : (t("pp_lbl_sell_bdt") || "Selling Price (BDT)")}</label>
                            <div className="input-group input-group-sm">
                              <span className="input-group-text">৳</span>
                              <input
                                className="form-control"
                                type="number"
                                step="0.01"
                                value={sell}
                                disabled={isSpecialShop && pricingMode === "bulk"}
                                onChange={(e) => {
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
                            <div className="small text-muted mt-0.5">
                              {t("pp_lbl_margin") || "Margin"}: <strong>{margin}%</strong> · {t("pp_lbl_profit") || "Profit"}: <strong>৳{profit}</strong>
                            </div>
                          </div>

                          {/* Chemical Expiry / Batch vs Hardware Warranty */}
                          {(() => {
                            const selectedUnit = selected.unit_detail;
                            const isCountUnit = !selectedUnit || selectedUnit.measure_type === "count" || selectedUnit.name?.toLowerCase().includes("piece") || selectedUnit.name?.toLowerCase().includes("pcs") || selectedUnit.short_code?.toLowerCase() === "pcs";
                            const isChemicalBulk = isSpecialShop && !isCountUnit;

                            if (isChemicalBulk) {
                              return (
                                <>
                                  <div className="col-md-4">
                                    <label className="small fw-semibold text-danger">{lang === "bn" ? "মেয়াদোত্তীর্ণের তারিখ (Expiry Date)" : "Expiry Date"}</label>
                                    <input
                                      type="date"
                                      className="form-control form-control-sm"
                                      value={selected.expiry_date || ""}
                                      onChange={(e) => {
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
                                  <div className="col-md-4">
                                    <label className="small fw-medium">{lang === "bn" ? "লট / ব্যাচ নম্বর" : "Lot / Batch No"}</label>
                                    <input
                                      type="text"
                                      className="form-control form-control-sm"
                                      placeholder="e.g. LOT-2026-09"
                                      value={selected.lot_number || ""}
                                      onChange={(e) => {
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
                                  <div className="col-md-4">
                                    <label className="small fw-medium">{lang === "bn" ? "উৎপাদন তারিখ (ঐচ্ছিক)" : "Mfg Date"}</label>
                                    <input
                                      type="date"
                                      className="form-control form-control-sm"
                                      value={selected.mfg_date || ""}
                                      onChange={(e) => {
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
                              <div className="col-md-6">
                                <label className="small fw-medium">{t("pp_lbl_warranty") || (lang === "bn" ? "ওয়ারেন্টি (মাস)" : "Warranty (Months)")}</label>
                                <input
                                  className="form-control form-control-sm"
                                  type="number"
                                  min="0"
                                  value={selected.warranty_months ?? ""}
                                  placeholder="0"
                                  onChange={(e) => {
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
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-light border py-2.5 small mb-3 text-secondary d-flex align-items-center gap-2">
                    <i className="bi bi-info-circle text-primary fs-6"></i>
                    <span>{lang === "bn" ? "উপরে সার্চ বক্সে পণ্যের নাম লিখে সার্চ করে বাছাই করুন, অথবা নিচে সরাসরি বারকোড স্ক্যান করুন।" : "Search and pick an existing catalog product to purchase."}</span>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 2: EXACT REPLICA OF PRODUCT LIST'S "ADD PRODUCT" FORM ── */}
            {intakeMode === "create" && (
              <div className="animate-fade-in">
                <form onSubmit={saveProductAndInward} className="row g-3">
                  {/* 1. Product Name */}
                  <div className="col-md-4">
                    <label className="small fw-semibold">{t("prod_list_name") || (lang === "bn" ? "পণ্যের নাম *" : "Product Name *")}</label>
                    <input
                      required
                      className="form-control form-control-sm"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder={lang === "bn" ? "যেমন: ক্যাস্টর অয়েল / শ্যাম্পু" : "e.g. Castor Oil / Shampoo"}
                    />
                  </div>

                  {/* 2. SKU */}
                  <div className="col-md-4">
                    <label className="small fw-medium">
                      {t("prod_list_sku") || "SKU"} <span className="text-secondary small">({lang === "bn" ? "স্বয়ংক্রিয়" : "Auto"})</span>
                    </label>
                    <input
                      placeholder={lang === "bn" ? "স্বয়ংক্রিয় তৈরি হবে" : "auto-generated"}
                      className="form-control form-control-sm"
                      value={form.sku}
                      onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    />
                  </div>

                  {/* 3. Category with Quick Add */}
                  <div className="col-md-4">
                    <label className="small fw-medium">{t("prod_list_category") || (lang === "bn" ? "ক্যাটাগরি" : "Category")}</label>
                    <select
                      className="form-select form-select-sm mb-1"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                    >
                      <option value="">{lang === "bn" ? "-- কোনোটি নয় --" : "-- None --"}</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <div className="input-group input-group-sm">
                      <input
                        className="form-control"
                        placeholder={lang === "bn" ? "নতুন ক্যাটাগরি..." : "+ New category..."}
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
                  <div className="col-md-3">
                    <label className="small fw-medium">{t("prod_list_brand") || (lang === "bn" ? "ব্র্যান্ড" : "Brand")}</label>
                    <select
                      className="form-select form-select-sm mb-1"
                      value={form.brand}
                      onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    >
                      <option value="">{lang === "bn" ? "-- কোনোটি নয় --" : "-- None --"}</option>
                      {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <div className="input-group input-group-sm">
                      <input
                        className="form-control"
                        placeholder={lang === "bn" ? "নতুন ব্র্যান্ড..." : "+ New brand..."}
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
                    <div className="col-md-3">
                      <label className="small fw-medium text-primary">{lang === "bn" ? "বিক্রয় ইউনিট (Sale Unit)" : "Sale Unit"}</label>
                      <select
                        className="form-select form-select-sm mb-1"
                        value={form.unit}
                        onChange={(e) => setForm({ ...form, unit: e.target.value })}
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
                    <div className="col-md-3">
                      <label className="small fw-medium">{t("prod_list_unit") || (lang === "bn" ? "ইউনিট" : "Unit")}</label>
                      <select
                        className="form-select form-select-sm mb-1"
                        value={form.unit}
                        onChange={(e) => setForm({ ...form, unit: e.target.value })}
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
                      <div className="col-md-3">
                        <label className="small fw-medium text-primary">{lang === "bn" ? "পাইকারি/ড্রাম ইউনিট (Purchase Unit)" : "Bulk/Purchase Unit"}</label>
                        <select
                          className="form-select form-select-sm mb-1"
                          value={form.purchase_unit}
                          onChange={(e) => setForm({ ...form, purchase_unit: e.target.value })}
                        >
                          <option value="">{lang === "bn" ? "-- ড্রাম/বক্স ইউনিট (ঐচ্ছিক) --" : "-- Select Bulk Unit (Optional) --"}</option>
                          {units.map((u) => <option key={u.id} value={u.id}>{u.name} {u.short_code ? `(${u.short_code})` : ""}</option>)}
                        </select>
                      </div>
                      <div className="col-md-3">
                        <label className="small fw-semibold text-primary" title="Conversion Multiplier">
                          {lang === "bn" ? "প্রতি ড্রাম/বক্সে পরিমাণ" : "Qty per Drum/Box"}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="1"
                          className="form-control form-control-sm mb-1"
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
                          title="Example: 1 Drum = 50 Liters, place 50 here."
                        />
                      </div>
                    </>
                  )}

                  {/* 7. Pricing Mode Toggle */}
                  {isSpecialShop && Number(form.purchase_multiplier) > 1 && (
                    <div className="col-12 mb-1 p-2 rounded" style={{ backgroundColor: "rgba(13,110,253,0.05)", border: "1px solid rgba(13,110,253,0.1)" }}>
                      <label className="small text-primary fw-bold mb-1">{lang === "bn" ? "দাম নির্ধারণ পদ্ধতি" : "Pricing Entry Method"}</label>
                      <select className="form-select form-select-sm" value={formPricingMode} onChange={(e) => setFormPricingMode(e.target.value as any)}>
                        <option value="regular">{lang === "bn" ? `সাধারণ (প্রতি ${units.find(u => String(u.id) === String(form.unit))?.name || "লিটার/কেজি"} আলাদা ইনপুট)` : `Regular (Per ${units.find(u => String(u.id) === String(form.unit))?.name || "Unit"} manually)`}</option>
                        <option value="bulk">{lang === "bn" ? `বাল্ক অটো-ক্যালকুলেট (সম্পূর্ণ ${units.find(u => String(u.id) === String(form.purchase_unit))?.name || "ড্রাম/বক্স"} এর দাম)` : `Bulk Auto-Calculate (Full ${units.find(u => String(u.id) === String(form.purchase_unit))?.name || "Drum/Pack"} Price)`}</option>
                      </select>
                    </div>
                  )}

                  {/* 8. Full Pack Pricing when Bulk mode */}
                  {(isSpecialShop && formPricingMode === "bulk" && Number(form.purchase_multiplier) > 1) && (
                    <>
                      <div className="col-md-3">
                        <label className="small text-primary fw-medium">Full {units.find(u => String(u.id) === String(form.purchase_unit))?.name || "Drum/Box"} Cost</label>
                        <div className="input-group input-group-sm mb-1">
                          <span className="input-group-text">৳</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-control"
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
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-control"
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

                  {/* 9. Unit Cost */}
                  <div className="col-md-3">
                    <label className="small text-primary fw-medium">
                      {(isSpecialShop && formPricingMode === "bulk" && Number(form.purchase_multiplier) > 1) ? `Cost per ${units.find(u => String(u.id) === String(form.unit))?.name || "Unit"}` : (t("prod_list_cost") || "Cost Price")}
                    </label>
                    <div className="input-group input-group-sm mb-1">
                      <span className="input-group-text">৳</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-control"
                        value={form.cost_price}
                        onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                        title={(isSpecialShop && formPricingMode === "bulk" && Number(form.purchase_multiplier) > 1) ? "Auto calculated from Pack Cost / Multiplier" : ""}
                      />
                    </div>
                  </div>

                  {/* 10. Selling Price & Margin Indicator */}
                  <div className="col-md-3">
                    <label className="small text-primary fw-medium">
                      {(isSpecialShop && formPricingMode === "bulk" && Number(form.purchase_multiplier) > 1) ? `Selling per ${units.find(u => String(u.id) === String(form.unit))?.name || "Unit"}` : (t("prod_list_selling_price") || "Selling Price")}
                    </label>
                    <div className="input-group input-group-sm mb-1">
                      <span className="input-group-text">৳</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-control"
                        value={form.selling_price}
                        onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
                      />
                    </div>
                    {Number(form.selling_price) > 0 && Number(form.cost_price) > 0 && (
                      <div className="text-success fw-bold" style={{ fontSize: "0.75rem", marginTop: "-2px" }}>
                        ✅ Margin: ৳{(Number(form.selling_price) - Number(form.cost_price)).toFixed(2)} / {units.find(u => String(u.id) === String(form.unit))?.short_code || "Unit"}
                      </div>
                    )}
                  </div>

                  {/* 11. Reorder Level */}
                  <div className="col-md-3">
                    <label className="small">{t("prod_list_reorder_level") || (lang === "bn" ? "রিঅর্ডার লেভেল" : "Reorder Level")}</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      className="form-control form-control-sm"
                      value={form.reorder_level}
                      onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
                      placeholder="5"
                    />
                  </div>

                  {/* 12. Barcode */}
                  <div className="col-md-3">
                    <label className="small">{lang === "bn" ? "বারকোড (ঐচ্ছিক)" : "Barcode (Optional)"}</label>
                    <input
                      className="form-control form-control-sm"
                      value={form.barcode}
                      onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                      placeholder={lang === "bn" ? "ঐচ্ছিক বারকোড" : "optional"}
                    />
                  </div>

                  {/* 13. Warranty / Replacement (Hardware / Non-special shops) */}
                  {!isSpecialShop && (
                    <>
                      <div className="col-md-2">
                        <label className="small">{t("prod_list_warranty_months") || (lang === "bn" ? "ওয়ারেন্টি (মাস)" : "Warranty (Months)")}</label>
                        <input
                          type="number"
                          min="0"
                          className="form-control form-control-sm"
                          value={form.warranty_months}
                          onChange={(e) => setForm({ ...form, warranty_months: e.target.value })}
                          placeholder="0"
                        />
                      </div>
                      <div className="col-md-2">
                        <label className="small" title="Replacement Guarantee (Days)">{t("prod_list_replacement_days") || (lang === "bn" ? "রিপ্লেসমেন্ট (দিন)" : "Replacement (Days)")}</label>
                        <input
                          type="number"
                          min="0"
                          className="form-control form-control-sm"
                          value={form.replacement_guarantee_days}
                          onChange={(e) => setForm({ ...form, replacement_guarantee_days: e.target.value })}
                          placeholder="0"
                        />
                      </div>
                    </>
                  )}

                  {/* Submit Action */}
                  <div className="col-12 d-flex align-items-center gap-2 pt-2 border-top">
                    <button className="btn btn-brand btn-sm px-4 shadow-sm" disabled={savingProduct}>
                      {savingProduct ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-1" />
                          {lang === "bn" ? "তৈরি হচ্ছে…" : "Creating…"}
                        </>
                      ) : (
                        <>
                          <i className="bi bi-plus-lg me-1"></i>
                          {lang === "bn" ? "পণ্য তৈরি করুন ও রিসিভ তালিকায় যোগ করুন" : "Save Product & Add to Inward List"}
                        </>
                      )}
                    </button>
                    <button type="button" className="btn btn-outline-secondary btn-sm px-3" onClick={() => setIntakeMode("search")}>
                      {lang === "bn" ? "সার্চে ফিরে যান" : "Cancel & Return to Search"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* ── Bulk Barcode Scan Card ───────────────────────────────────────── */}
        <div className="card shadow-sm mb-3">
          <div className="card-body">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3 border-bottom pb-2">
              <div className="d-flex flex-wrap align-items-center gap-3">
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
                <label className="form-label small fw-medium">{lang === "bn" ? "বারকোড স্ক্যান বা পেস্ট করুন (প্রতি লাইনে একটি):" : "Scan or paste barcodes (one per line):"}</label>
                <textarea
                  className="form-control font-monospace"
                  rows={6}
                  placeholder={lang === "bn" ? "বারকোড স্ক্যান বা পেস্ট করুন — প্রতি লাইনে একটি।" : "Scan or paste barcodes — each code separates automatically. One code per line."}
                  value={barcodeText}
                  onChange={handleBarcodeInput}
                />
              </div>
              <div className="col-md-5">
                <div className="border rounded p-3 text-center h-100 d-flex flex-column align-items-center justify-content-center gap-2 bg-light">
                  <div className="fs-3">🖨️</div>
                  <div className="fw-semibold small">{t("pp_scan_mode") || (lang === "bn" ? "স্ক্যান মোড" : "Scan Mode")}</div>
                  <div className="text-secondary small">{t("pp_scan_hint") || (lang === "bn" ? "ক্যামেরা দিয়ে বারকোড স্ক্যান করুন" : "Scan barcodes with camera")}</div>
                  <div className="d-flex align-items-center gap-2 mt-1">
                    <span className="small text-secondary">{t("pp_digits_code") || "Digits"}:</span>
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
                    {t("pp_btn_clear_list") || (lang === "bn" ? "তালিকা পরিষ্কার করুন" : "Clear List")}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3">
              <button
                type="button"
                className="btn btn-brand btn-lg w-100 shadow-sm"
                disabled={busy || tooManyBarcodes || (!selected && parsedBarcodes.length === 0)}
                onClick={addScannedUnits}
              >
                {busy ? (
                  <span className="spinner-border spinner-border-sm me-2" />
                ) : (
                  <i className="bi bi-cart-plus me-2"></i>
                )}
                {lang === "bn" ? `+ ${effQty} ইউনিট তালিকায় যুক্ত করুন` : `+ Add ${effQty} unit(s) to receive`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Summary Panel ────────────────────────────────────────────── */}
      <div className="col-lg-4">
        <div className="card shadow-sm" style={{ position: "sticky", top: "1rem" }}>
          <div className="card-header text-white fw-semibold" style={{ background: "var(--brand-900, #1a2433)" }}>
            <div>📦 {lang === "bn" ? "গ্রহণের তালিকা" : "To Receive"}</div>
            <div className="small fw-normal opacity-75">{t("pp_pending_inject") || (lang === "bn" ? "স্টকে যুক্ত হওয়ার অপেক্ষায়" : "Pending injection")}</div>
          </div>

          <div className="card-body p-0">
            {lines.length === 0 ? (
              <div className="p-3 text-secondary small text-center">{t("pp_no_prods_added") || (lang === "bn" ? "গ্রহণের তালিকায় কোনো পণ্য যুক্ত করা হয়নি।" : "No products added to receive yet.")}</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th className="ps-3">{t("pp_col_prod") || (lang === "bn" ? "পণ্য" : "Product")}</th>
                      <th style={{ width: "4rem" }}>{t("pp_col_qty") || (lang === "bn" ? "পরিমাণ" : "Qty")}</th>
                      <th className="text-end" style={{ width: "5.5rem" }}>
                        {t("pp_col_cost") || (lang === "bn" ? "ক্রয়মূল্য" : "Cost")}
                      </th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => {
                      const isPack = isSpecialShop && Number(l.product.purchase_multiplier) > 1 && l.product.unit_detail?.measure_type !== "count";
                      const unitName = l.product.unit_detail?.name || (isSpecialShop ? "L/Kg" : "Unit");
                      const packName = l.product.purchase_unit_detail?.name || "Drum/Box";

                      return (
                        <tr key={l.product.id}>
                          <td className="ps-3">
                            <div className="fw-medium small">{l.product.name}</div>
                            {isPack ? (
                              <div className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25" style={{ fontSize: "0.68rem" }}>
                                1 {packName} = {l.product.purchase_multiplier} {unitName}
                              </div>
                            ) : null}
                            <div className="text-secondary" style={{ fontSize: "0.7rem" }}>
                              {l.barcodes.length > 0 ? `${l.barcodes.length} BC` : "No barcode"}
                            </div>
                          </td>
                          <td style={{ width: "4rem" }}>
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
                <span>{t("pp_total_val") || (lang === "bn" ? "সর্বমোট" : "Total")}</span>
                <span>{money(subtotal)}</span>
              </div>

              <label className="form-label small fw-medium">{t("pp_lbl_paid_now") || (lang === "bn" ? "পরিশোধের পরিমাণ" : "Paid Amount")}</label>
              <div className="input-group input-group-sm mb-1">
                <span className="input-group-text">{t("pp_bdt") || "৳"}</span>
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
                  {t("pp_btn_full") || (lang === "bn" ? "সম্পূর্ণ" : "Full")}
                </button>
              </div>

              <div className="d-flex justify-content-between small text-secondary mb-3">
                <span>{t("pp_supplier_due") || (lang === "bn" ? "সাপ্লায়ার বকেয়া" : "Supplier Due")}:</span>
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
              <div className="fw-bold small mb-2">{t("pp_summary_title") || (lang === "bn" ? "চালান ও পেমেন্ট বিবরণ" : "Purchase Summary")}</div>
              <div className="mb-2">
                <label className="small fw-medium">{t("pp_lbl_vendor") || (lang === "bn" ? "সরবরাহকারী (Vendor)" : "Vendor")}</label>
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
                    {lang === "bn" ? "+ যোগ করুন" : "+ add"}
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
                  <label className="small fw-medium">{t("pp_lbl_warehouse") || (lang === "bn" ? "ওয়্যারহাউজ / ব্রাঞ্চ" : "Warehouse")}</label>
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

              <div className="mt-2">
                <label className="small fw-medium">{t("pp_lbl_pay_method") || (lang === "bn" ? "পেমেন্ট মাধ্যম" : "Payment Method")}</label>
                <select
                  className="form-select form-select-sm"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                >
                  {Object.entries(PAY_METHODS).map(([val, lbl]) => (
                    <option key={val} value={val}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </div>

              {error && <div className="alert alert-danger py-1 small mt-2 mb-0">{error}</div>}

              <button
                type="button"
                className="btn btn-success btn-lg w-100 mt-3 shadow-sm"
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
                    <i className="bi bi-box-arrow-in-down me-1" />
                    {t("pp_btn_push_stock") || (lang === "bn" ? "স্টকে যুক্ত করুন (ক্রয় সম্পন্ন)" : "Push to Stock (Confirm Purchase)")}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showScanner && (
        <ScannerModal
          onClose={() => setShowScanner(false)}
          onScan={(code) => {
            setBarcodeText((prev) => (prev ? `${prev}\n${code}` : code));
            toast.success(`Scanned: ${code}`);
          }}
        />
      )}
    </div>
  );
}
