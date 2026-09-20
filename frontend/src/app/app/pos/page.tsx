"use client";
import { formatProductName } from "@/lib/formatters";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, useApi, Paginated } from "@/lib/api";
import { ErrorState, Spinner, money } from "@/components/ui";
import { ScannerModal } from "@/components/ScannerModal";
import toast from "react-hot-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useScannerWebSocket } from "@/hooks/useScannerWebSocket";
import { useAuth } from "@/components/AuthProvider";

type ProductUnit = { id: number; barcode: string; effective_selling_price?: string; effective_cost_price?: string; effective_warranty_months?: number };
type ProductVariation = {
  id: number;
  name: string;
  sku: string;
  barcode: string;
  attributes: { size?: string; color?: string; [key: string]: any };
  cost_price: string;
  selling_price: string;
  current_stock: string;
};
type Product = {
  id: number; name: string; sku: string; barcode?: string;
  selling_price: string; cost_price: string; current_stock: string; track_inventory?: boolean;
  warranty_months?: number;
  expiry_date?: string | null;
  lot_number?: string;
  size_variants?: Array<{size: string; color: string; stock: number}>;
  variations?: ProductVariation[];
  scanned_variation?: ProductVariation;
  replacement_guarantee_days?: number;
  fabric_material?: string;
  gender_target?: string;
  season?: string;
  style_type?: string;
  _selectedVariant?: {size: string; color: string} | null;
  purchase_multiplier?: string | number;
  full_pack_cost?: string | number;
  full_pack_sell?: string | number;
  units?: ProductUnit[];
  scanned_unit?: ProductUnit;
  unit_detail?: { id: number; name: string; short_code: string; measure_type: string; allow_decimal: boolean } | null;
  purchase_unit_detail?: { id: number; name: string; short_code: string; measure_type: string } | null;
};
type CartLine = { 
  lineId?: string;
  product: Product; 
  qty: number; 
  price: number; 
  discount: number; 
  selectedUnits: ProductUnit[];
  selectedVariation?: ProductVariation | null;
  sellMode?: "base" | "bulk";
};
type ScanMsg = { text: string; ok: boolean } | null;

export default function PosPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const isSpecialShop = user?.shop_business_type === "camical" || user?.shop_business_type === "supershop" || user?.shop_business_type === "cosmetics" || user?.shop_business_type === "beauty";
  const isSupershop = user?.shop_business_type === "supershop" || user?.shop_business_type === "food" || user?.shop_business_type === "grocery";
  const isFashionShop = user?.shop_business_type === "fashion" || user?.shop_business_type === "footwear" || user?.shop_business_type === "handcrafts" || user?.shop_business_type === "jewelry" || user?.shop_business_type === "apparel";
  const isRepairShop = !!user?.shop_mobile_repair_enabled;
  const isElectronicsShop = user?.shop_business_type === "electronics" || user?.shop_business_type === "computer";
  const isPrintingShop = user?.shop_business_type === "printing";
  const [cart, setCart] = useState<CartLine[]>([]);
  type HeldCart = {
    id: string;
    heldAt: string;
    items: CartLine[];
    totalAmount: number;
    itemCount: number;
  };

  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);
  const [showHeldModal, setShowHeldModal] = useState(false);
  const [fastCheckingOut, setFastCheckingOut] = useState(false);
  const [variantModalProduct, setVariantModalProduct] = useState<Product | null>(null);
  const [selectedFashionProduct, setSelectedFashionProduct] = useState<Product | null>(null);
  const [selectedFashionSize, setSelectedFashionSize] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`stockwhisk_held_carts_${user?.shop || 'default'}`);
      if (stored) setHeldCarts(JSON.parse(stored));
    } catch {}
  }, [user?.shop]);

  function holdCurrentCart() {
    if (cart.length === 0) {
      flash(lang === "bn" ? "কার্ট খালি! হোল্ড করার মতো কোনো পণ্য নেই।" : "Cart is empty!", false);
      return;
    }
    const newHeld: HeldCart = {
      id: "HOLD-" + Date.now().toString().slice(-4),
      heldAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      items: [...cart],
      totalAmount: cart.reduce((s, l) => s + l.qty * l.price - l.discount, 0),
      itemCount: cart.reduce((s, l) => s + l.qty, 0),
    };
    const updated = [newHeld, ...heldCarts];
    setHeldCarts(updated);
    try {
      localStorage.setItem(`stockwhisk_held_carts_${user?.shop || 'default'}`, JSON.stringify(updated));
    } catch {}
    setCart([]);
    sessionStorage.removeItem("pos_cart");
    flash(lang === "bn" ? `⏸️ কার্ট হোল্ড করা হয়েছে (${newHeld.id})` : `⏸️ Cart held (${newHeld.id})`, true);
  }

  function recallHeldCart(heldId: string) {
    const target = heldCarts.find(h => h.id === heldId);
    if (!target) return;
    setCart(target.items);
    const updated = heldCarts.filter(h => h.id !== heldId);
    setHeldCarts(updated);
    try {
      localStorage.setItem(`stockwhisk_held_carts_${user?.shop || 'default'}`, JSON.stringify(updated));
    } catch {}
    setShowHeldModal(false);
    flash(lang === "bn" ? `▶️ কার্ট রিকল করা হয়েছে (${target.id})` : `▶️ Cart recalled (${target.id})`, true);
  }

  function discardHeldCart(heldId: string) {
    const updated = heldCarts.filter(h => h.id !== heldId);
    setHeldCarts(updated);
    try {
      localStorage.setItem(`stockwhisk_held_carts_${user?.shop || 'default'}`, JSON.stringify(updated));
    } catch {}
  }

  // Keyboard Shortcuts (F2 search, F8 hold cart, F9 held list)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "F8" && isSupershop) {
        e.preventDefault();
        holdCurrentCart();
      } else if (e.key === "F9" && isSupershop) {
        e.preventDefault();
        setShowHeldModal(s => !s);
      } else if (e.key === "F12" && !isElectronicsShop) {
        e.preventDefault();
        doFastCashCheckout();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, heldCarts, isSupershop]);

  const [brands, setBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch Brands and Categories on mount for Repair Drill-down
  useEffect(() => {
    api<any>("/catalog/brands/?page_size=100").then((r) => setBrands(r.results || r || [])).catch(() => {});
    api<any>("/catalog/categories/?page_size=100").then((r) => setCategories(r.results || r || [])).catch(() => {});
  }, []);

  // Main POS product grid: load the first 20 fast (light = no embedded units),
  // then append more on scroll (infinite scroll). Units are fetched on click.
  const GRID_PAGE_SIZE = 20;
  const [shown, setShown] = useState<Product[]>([]);
  const [gridPage, setGridPage] = useState(1);
  const [gridHasMore, setGridHasMore] = useState(false);
  const [gridLoading, setGridLoading] = useState(true);
  const [unitLoadingId, setUnitLoadingId] = useState<number | null>(null);

  async function fetchGrid(page: number, replace: boolean) {
    setGridLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), page_size: String(GRID_PAGE_SIZE), in_stock: "1", light: "1" });
      if (debouncedQuery) qs.set("search", debouncedQuery);
      if (selectedBrand) qs.set("brand", String(selectedBrand));
      if (selectedCategory) qs.set("category", String(selectedCategory));
      const d = await api<Paginated<Product>>(`/catalog/products/?${qs.toString()}`);
      setShown((prev) => (replace ? d.results : [...prev, ...d.results]));
      setGridPage(page);
      setGridHasMore(!!d.next);
    } catch {
      if (replace) setShown([]);
      setGridHasMore(false);
    } finally {
      setGridLoading(false);
    }
  }

  // Reset to page 1 whenever the search changes.
  useEffect(() => { fetchGrid(1, true); /* eslint-disable-next-line */ }, [debouncedQuery, selectedBrand, selectedCategory]);

  function onGridScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (!gridLoading && gridHasMore && el.scrollHeight - el.scrollTop - el.clientHeight < 140) {
      fetchGrid(gridPage + 1, false);
    }
  }

  // Grid cards are loaded light (no units); fetch this product's units on click,
  // then run the normal add / unit-selection flow.
  async function pickFromGrid(p: Product) {
    if (p.track_inventory === false) { tryAdd(p); return; }
    setUnitLoadingId(p.id);
    try {
      const full = await api<Product>(`/catalog/products/${p.id}/`);
      tryAdd({
        ...p,
        variations: full.variations || p.variations,
        units: full.units,
        unit_detail: full.unit_detail,
        purchase_unit_detail: full.purchase_unit_detail,
      });
    } catch {
      tryAdd(p);
    } finally {
      setUnitLoadingId(null);
    }
  }
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
  const [fashionPickProduct, setFashionPickProduct] = useState<Product | null>(null);
  const [fashionPickVariant, setFashionPickVariant] = useState<{size:string,color:string}|null>(null);

  // Product picker modal — shown when one scanned barcode matches several products
  const [pickProducts, setPickProducts] = useState<Product[] | null>(null);
  const [pickCode, setPickCode] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem("pos_cart");
    if (saved) { try { setCart(JSON.parse(saved)); } catch {} }
  }, []);

  // ── Cart helpers ────────────────────────────────────────────────────────
  function addToCart(p: Product, specificUnit?: ProductUnit, explicitQty?: number, variation?: ProductVariation | null, sizeVariant?: any) {
    const addAmount = explicitQty !== undefined ? explicitQty : 1;
    const selectedV = sizeVariant || (p as any)._selectedVariant;
    const itemPrice = selectedV?.price 
      ? Number(selectedV.price) 
      : (variation ? Number(variation.selling_price || p.selling_price) : Number(specificUnit?.effective_selling_price || p.selling_price) || 0);

    const lineKey = selectedV
      ? `${p.id}-sv-${selectedV.size || ""}-${selectedV.color || ""}`
      : (variation ? `${p.id}-var-${variation.id}` : String(p.id));

    setCart((c) => {
      const exIndex = c.findIndex((l) => (l.lineId || String(l.product.id)) === lineKey);
      if (exIndex >= 0) {
        const ex = c[exIndex];
        if (specificUnit) {
          if (ex.selectedUnits.some((u) => u.id === specificUnit.id)) {
            return c; // already added
          }
          const newC = [...c];
          newC[exIndex] = { ...ex, qty: ex.qty + addAmount, selectedUnits: [...ex.selectedUnits, specificUnit] };
          return newC;
        }
        const newC = [...c];
        newC[exIndex] = { ...ex, qty: Math.round((ex.qty + addAmount) * 1000) / 1000 };
        return newC;
      }
      return [...c, { 
        lineId: lineKey,
        product: selectedV ? ({ ...p, _selectedVariant: selectedV } as any) : p, 
        qty: addAmount, 
        price: itemPrice, 
        discount: 0, 
        selectedUnits: specificUnit ? [specificUnit] : [],
        selectedVariation: variation || null,
        sellMode: "base",
      }];
    });
  }

  function toggleSellMode(keyOrId: string | number, mode: "base" | "bulk") {
    setCart((c) => c.map((l) => {
      if ((l.lineId || l.product.id) !== keyOrId && l.product.id !== keyOrId) return l;
      const mult = Number(l.product.purchase_multiplier) || 1;
      const baseSell = Number(l.product.selling_price) || 0;
      const packSell = Number(l.product.full_pack_sell) || (mult > 1 ? Number((baseSell * mult).toFixed(2)) : baseSell);
      
      if (mode === "bulk") {
        return {
          ...l,
          sellMode: "bulk",
          price: packSell,
          qty: Math.max(1, Math.round(l.qty)),
        };
      } else {
        return {
          ...l,
          sellMode: "base",
          price: baseSell,
          qty: 1,
        };
      }
    }));
  }

  function setQty(keyOrId: string | number, qty: number) {
    setCart((c) => c.map((l) => {
      if ((l.lineId || l.product.id) !== keyOrId && l.product.id !== keyOrId) return l;
      const v = Number.isFinite(qty) ? qty : 0;
      return { ...l, qty: Math.max(0, Math.round(v * 1000) / 1000) };
    }));
  }

  function clampQty(keyOrId: string | number) {
    setCart((c) => c.map((l) => {
      if ((l.lineId || l.product.id) !== keyOrId && l.product.id !== keyOrId) return l;
      const isBulk = l.sellMode === "bulk";
      const allowDec = !isBulk && !!l.product.unit_detail?.allow_decimal;
      const min = allowDec ? 0.01 : 1;
      if (l.qty > 0 && l.qty < min) return { ...l, qty: min };
      return l;
    }));
  }

  function removeLine(keyOrId: string | number) { setCart((c) => c.filter((l) => (l.lineId || l.product.id) !== keyOrId && l.product.id !== keyOrId)); }
  function clearCart() { setCart([]); sessionStorage.removeItem("pos_cart"); }

  function flash(text: string, ok: boolean) {
    setScanMsg({ text, ok });
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setScanMsg(null), 3000);
  }

  function tryAdd(p: Product, forceQty?: number) {
    if (p.track_inventory !== false && Number(p.current_stock) <= 0) {
      flash(t("pos_out_of_stock_alert", { name: p.name }), false);
      return;
    }
    const scaleWeight = (p as any).scanned_scale_weight ? Number((p as any).scanned_scale_weight) : undefined;
    const finalQty = forceQty !== undefined ? forceQty : scaleWeight;
    if (p.scanned_unit) {
      const unit = p.scanned_unit;
      const already = cart.some((l) => l.product.id === p.id && l.selectedUnits.some((u) => u.id === unit.id));
      if (already) {
        flash(t("pos_already_in_cart_alert", { barcode: unit.barcode }), false);
      } else {
        addToCart(p, unit);
        flash(t("pos_added_unit_alert", { barcode: unit.barcode }), true);
      }
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }
    if ((p as any).scanned_variation) {
      const v = (p as any).scanned_variation;
      addToCart(p, undefined, finalQty, v, {
        size: v.attributes?.size || v.name,
        color: v.attributes?.color || "",
        price: v.selling_price || p.selling_price,
        sku: v.sku || p.sku,
        barcode: v.barcode || ""
      });
      flash(t("pos_added_alert", { name: `${p.name} (${v.name})` }), true);
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }
    if (p.units && p.units.length > 0) {
      setUnitSelectProduct(p);
      return;
    }
    // Size & Color Variations picker (ProductVariation or size_variants)
    if (p.variations && p.variations.length > 0) {
      setVariantModalProduct(p);
      return;
    }
    if (p.size_variants && p.size_variants.length > 0) {
      setFashionPickProduct(p);
      return;
    }
    addToCart(p, undefined, finalQty);
    flash(scaleWeight ? (lang === "bn" ? `⚖️ ওজনের পণ্য যোগ হয়েছে: ${p.name} (${finalQty} কেজি)` : `⚖️ Weighed item: ${p.name} (${finalQty} kg)`) : t("pos_added_alert", { name: p.name }), true);
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  // ── Process code ────────────────────────────────────────────────────────
  const processCode = useCallback(async (rawInput: string) => {
    if (!rawInput) return;
    
    let multiplier = 1;
    let code = rawInput.trim();
    if (code.includes("*")) {
      const parts = code.split("*");
      if (parts.length === 2 && !isNaN(Number(parts[0])) && Number(parts[0]) > 0 && parts[1].trim()) {
        multiplier = Number(parts[0]);
        code = parts[1].trim();
      }
    }

    // 0. Supershop EAN-13 Weight Scale In-Store Barcode auto-detection (e.g. 20XXXXXWWWWWC)
    // Scale format: 2-digit prefix (02 or 20-29) + 5-digit PLU/SKU + 5-digit Weight in grams + 1 checksum
    if (isSupershop && /^(02|2[0-9])(\d{5})(\d{5})\d$/.test(code)) {
      const match = code.match(/^(02|2[0-9])(\d{5})(\d{5})\d$/);
      if (match) {
        const pluCode = match[2];
        const weightGrams = parseInt(match[3], 10);
        const weightKg = Math.round((weightGrams / 1000) * 1000) / 1000;
        
        // Find product matching PLU code
        const matchedPlu = shown.find(p => 
          (p.sku && p.sku.toLowerCase() === pluCode.toLowerCase()) ||
          (p.sku && p.sku.endsWith(pluCode)) ||
          (p.barcode && p.barcode.includes(pluCode)) ||
          String(p.id) === String(parseInt(pluCode, 10))
        );
        if (matchedPlu) {
          addToCart(matchedPlu, undefined, weightKg);
          flash(lang === "bn" ? `⚖️ ওজনের পণ্য যোগ হয়েছে: ${matchedPlu.name} (${weightKg} কেজি)` : `⚖️ Weighed item added: ${matchedPlu.name} (${weightKg} kg)`, true);
          setQuery("");
          setTimeout(() => inputRef.current?.focus(), 50);
          return;
        }
      }
    }

    // 1. Exact barcode match from current search results. A barcode may be
    // shared by several products → let the user pick which one.
    const barcodeMatches = shown.filter(
      (p) => !!p.barcode && p.barcode.split(",").map((s) => s.trim()).includes(code)
    );
    if (barcodeMatches.length > 1) { setPickCode(code); setPickProducts(barcodeMatches); return; }
    if (barcodeMatches.length === 1) { tryAdd(barcodeMatches[0], multiplier); return; }

    const bySku = shown.find((p) => p.sku && p.sku.toLowerCase() === code.toLowerCase());
    if (bySku) { tryAdd(bySku, multiplier); return; }

    // 2b. Exact match on a specific UNIT barcode → add that exact unit directly
    // (skip the unit-picker modal). Unit barcodes are unique, so never add twice.
    for (const p of shown) {
      const unit = p.units?.find((u) => u.barcode === code);
      if (unit) {
        if (p.track_inventory !== false && Number(p.current_stock) <= 0) {
          flash(t("pos_out_of_stock_alert", { name: p.name }), false); return;
        }
        const already = cart.some((l) => l.product.id === p.id && l.selectedUnits.some((u) => u.id === unit.id));
        if (already) {
          flash(t("pos_already_in_cart_alert", { barcode: unit.barcode }), false);
        } else {
          addToCart(p, unit);
          flash(t("pos_added_unit_alert", { barcode: unit.barcode }), true);
        }
        setQuery("");
        setTimeout(() => inputRef.current?.focus(), 50);
        return;
      }
    }

    // 2c. Exact match on a specific VARIATION barcode or SKU -> add directly without modal
    for (const p of shown) {
      const v = p.variations?.find((varItem) => varItem.barcode === code || (varItem.sku && varItem.sku.toLowerCase() === code.toLowerCase()));
      if (v) {
        if (p.track_inventory !== false && Number(v.current_stock || p.current_stock) <= 0) {
          flash(t("pos_out_of_stock_alert", { name: `${p.name} (${v.name})` }), false);
          return;
        }
        addToCart(p, undefined, multiplier, v, {
          size: v.attributes?.size || v.name,
          color: v.attributes?.color || "",
          price: v.selling_price || p.selling_price,
          sku: v.sku || p.sku,
          barcode: v.barcode || ""
        });
        flash(t("pos_added_alert", { name: `${p.name} (${v.name})` }), true);
        setQuery("");
        setTimeout(() => inputRef.current?.focus(), 50);
        return;
      }
      if (p.size_variants && Array.isArray(p.size_variants)) {
        const sv = p.size_variants.find((item: any) => item.barcode === code || (item.sku && item.sku.toLowerCase() === code.toLowerCase()));
        if (sv) {
          addToCart(p, undefined, multiplier, null, sv);
          flash(t("pos_added_alert", { name: `${p.name} (${sv.size}${sv.color ? ` / ${sv.color}` : ""})` }), true);
          setQuery("");
          setTimeout(() => inputRef.current?.focus(), 50);
          return;
        }
      }
    }

    const gridReflectsCode = debouncedQuery === code && !gridLoading;

    // 3. Exactly one filtered result → auto-add
    if (gridReflectsCode && shown.length === 1 && query === code) { tryAdd(shown[0], multiplier); return; }

    // 4. Multiple results → keep showing (let the user click one)
    if (gridReflectsCode && shown.length > 1 && query === code) return;

    // 5. No local match → backend lookup
    setScanning(true);
    try {
      const res = await api<any>("/pos/lookup/", { params: { barcode: code } });
      if (res?.multiple && Array.isArray(res.products)) {
        setPickCode(code);
        setPickProducts(res.products as Product[]);
      } else {
        tryAdd(res as Product, multiplier);
      }
    } catch (e: any) {
      if (e?.status === 409 || e?.data?.sold_unit) {
        flash(e?.data?.detail || t("pos_unit_sold_alert", { code }), false);
        setQuery("");
        setTimeout(() => inputRef.current?.focus(), 50);
      } else {
        flash(t("pos_product_not_found"), false);
        setQuery("");
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } finally {
      setScanning(false);
    }
  }, [shown, query, tryAdd, cart, debouncedQuery, gridLoading]);

  const { isConnected: scannerConnected } = useScannerWebSocket(user?.shop, (barcode) => {
    processCode(barcode);
  });

  const handleEnter = useCallback(async () => {
    await processCode(query.trim());
  }, [query, processCode]);

  async function doAssign() {
    if (!assignSelected || !assignBarcode) return;
    setAssignSaving(true);
    try {
      await api(`/catalog/products/${assignSelected.id}/`, {
        method: "PATCH",
        body: { barcode: assignBarcode },
      });
      setShowAssign(false);
      setQuery("");
      flash(t("pos_barcode_assigned_alert", { name: assignSelected.name }), true);
    } catch (e: any) {
      toast.error(e?.message || t("pos_barcode_assign_error"));
    } finally {
      setAssignSaving(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  const subtotal = cart.reduce((s, l) => s + l.qty * l.price - l.discount, 0);
  const itemCount = cart.reduce((s, l) => s + l.qty, 0);

    async function doFastCashCheckout() {
    if (cart.length === 0 || fastCheckingOut) return;
    setFastCheckingOut(true);
    try {
      const curSubtotal = cart.reduce((s, l) => s + l.qty * l.price - l.discount, 0);
      const isVatOn = !!user?.shop_emi_enabled || false; // or shop settings
      const taxAmt = 0;
      const totalAmt = curSubtotal + taxAmt;

      const itemsPayload = cart.map((l) => ({
        product: l.product.id,
        quantity: l.qty,
        unit_price: l.price,
        discount: l.discount,
        unit_ids: l.selectedUnits.map((u) => u.id),
        variation: l.selectedVariation?.id || undefined,
        size_variant: (l.product as any)._selectedVariant || undefined,
      }));

      const res = await api<any>("/pos/checkout/", {
        method: "POST",
        body: {
          items: itemsPayload,
          sale_date: new Date().toISOString(),
          tax: taxAmt,
          discount: 0,
          payments: [{ method: "cash", amount: totalAmt }],
        },
      });

      setCart([]);
      setQuery("");
      flash(
        lang === "bn"
          ? `⚡ নগদ বিক্রয় সম্পন্ন! চালান #${res.invoice_no || res.id} (৳${totalAmt.toFixed(2)})`
          : `⚡ Fast Cash Sale Complete! #${res.invoice_no || res.id} (৳${totalAmt.toFixed(2)})`,
        true
      );
      if (res.id) {
        window.open(`/invoice/${res.id}`, "_blank", "width=420,height=650");
      }
    } catch (err: any) {
      toast.error(err?.message || "Fast cash checkout failed.");
    } finally {
      setFastCheckingOut(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function goToCheckout() {
    sessionStorage.setItem("pos_cart", JSON.stringify(cart));
    router.push("/app/pos/customer");
  }

  return (
    <>
      <div className="row g-3">
        {/* ── Left panel ── */}
        <div className="col-lg-7 d-flex flex-column gap-3">
          <div className="d-flex align-items-center justify-content-between">
            <div className="text-secondary small fw-semibold">{t("pos_step1")}</div>
            <div className="small fw-semibold d-flex align-items-center gap-1">
              <span className={`d-inline-block rounded-circle ${scannerConnected ? 'bg-success' : 'bg-secondary'}`} style={{ width: 8, height: 8 }}></span>
              <span className={scannerConnected ? 'text-success' : 'text-secondary'}>
                {scannerConnected ? "Scanner App Connected" : "Scanner App Disconnected"}
              </span>
            </div>
          </div>

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
                  placeholder={t("pos_scan_placeholder")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleEnter(); } }}
                />
                <button 
                  className="btn btn-outline-secondary d-md-none" 
                  onClick={() => setShowScanner(true)}
                  title={t("pos_scan_camera")}
                >
                  📷
                </button>
                {query && (
                  <button className="btn btn-outline-secondary" onClick={() => { setQuery(""); inputRef.current?.focus(); }}>✕</button>
                )}
              </div>

              {scanMsg && (
                <div className={`mt-2 px-3 py-2 rounded small fw-semibold ${
                  scanMsg.ok ? "text-success bg-success bg-opacity-10" : "text-danger bg-danger bg-opacity-10"
                }`}>
                  {scanMsg.text}
                </div>
              )}

              <div className="mt-2 small text-secondary">
                {query
                  ? shown.length > 0
                    ? shown.length > 1 ? t("pos_products_found_plural", { count: shown.length }) : t("pos_products_found_singular")
                    : t("pos_no_match")
                  : t("pos_ready")
                }
              </div>
            </div>
          </div>

          

          {/* ── Printing & Cyber Cafe Quick Hub Banner ── */}
          {isPrintingShop && (
            <div className="card shadow-sm border-0 mb-3" style={{ backgroundColor: "#f0fdf4", borderRadius: "12px", borderLeft: "5px solid #16a34a" }}>
              <div className="card-body p-2 px-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-success text-white px-2.5 py-1.5 fs-6">🖨️ ডিজিটাল সেবা হাব</span>
                  <span className="small text-dark fw-medium">পাসপোর্ট, পুলিশ ক্লিয়ারেন্স, ব্যানার ও টোকেন মেমো সরাসরি ইস্যু করুন:</span>
                </div>
                <Link href="/app/service/jobs" className="btn btn-sm btn-success fw-bold d-flex align-items-center gap-1 shadow-sm">
                  <i className="bi bi-file-earmark-plus"></i> সেবা জব শিট ও টোকেন কাউন্টার
                </Link>
              </div>
            </div>
          )}

          {/* ── Quick Category Filter Pills (General POS - hidden for Electronics, Fashion, Repair) ── */}
          {!isRepairShop && !isFashionShop && !isElectronicsShop && categories.length > 0 && (
            <div className="d-flex align-items-center gap-2 mb-3 overflow-auto pb-2" style={{ whiteSpace: "nowrap", scrollbarWidth: "thin" }}>
              <button
                type="button"
                style={{ flexShrink: 0 }}
                className={`btn btn-sm px-3.5 py-1.5 rounded-pill fw-bold shadow-sm ${selectedCategory === null ? "btn-dark text-white" : "btn-light text-dark border bg-white"}`}
                onClick={() => setSelectedCategory(null)}
              >
                {lang === "bn" ? "✨ সকল পণ্য" : "All Items"}
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  style={{ flexShrink: 0 }}
                  className={`btn btn-sm px-3.5 py-1.5 rounded-pill fw-bold shadow-sm ${selectedCategory === c.id ? "btn-primary text-white" : "btn-light text-dark border bg-white"}`}
                  onClick={() => setSelectedCategory(selectedCategory === c.id ? null : c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

                    {/* ══════════════════════════════════════════════════════════════════════
              REPAIR SHOP MODE: STRICT 3-STEP HIERARCHY DRILL-DOWN
              Step 1: Big Brand Cards -> Step 2: Category Cards -> Step 3: Products
              ══════════════════════════════════════════════════════════════════════ */}
          {/* ══════════════════════════════════════════════════════════════════════
              FASHION & APPAREL: 3-STEP HIERARCHICAL DRILL-DOWN (Category ➜ Size ➜ Color)
              ══════════════════════════════════════════════════════════════════════ */}
          {isFashionShop ? (
            <div className="d-flex flex-column gap-3">
              {/* Breadcrumb Navigation Bar */}
              <div className="card shadow-sm border-0 mb-1" style={{ backgroundColor: "#ffffff", borderRadius: "14px" }}>
                <div className="card-body p-2 px-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div className="d-flex align-items-center gap-2 small flex-wrap">
                    <button
                      type="button"
                      className={`btn btn-sm py-1 px-3 fw-bold rounded-pill ${!selectedCategory ? "btn-primary shadow-sm" : "btn-outline-primary bg-white"}`}
                      onClick={() => { setSelectedCategory(null); setSelectedFashionProduct(null); setSelectedFashionSize(null); setQuery(""); }}
                    >
                      <span>👗 ১. ক্যাটাগরি</span>
                    </button>

                    {selectedCategory && (
                      <>
                        <span className="text-secondary fw-bold">›</span>
                        <button
                          type="button"
                          className={`btn btn-sm py-1 px-3 fw-bold rounded-pill ${!selectedFashionProduct ? "text-white shadow-sm" : "bg-white"}`}
                          style={{
                            backgroundColor: !selectedFashionProduct ? "#7c3aed" : undefined,
                            borderColor: "#7c3aed",
                            color: !selectedFashionProduct ? "#ffffff" : "#7c3aed"
                          }}
                          onClick={() => { setSelectedFashionProduct(null); setSelectedFashionSize(null); }}
                        >
                          <span>২. {categories.find(c => c.id === selectedCategory)?.name || "ডিজাইন ও সাইজ"}</span>
                        </button>
                      </>
                    )}

                    {selectedFashionProduct && (
                      <>
                        <span className="text-secondary fw-bold">›</span>
                        <button
                          type="button"
                          className={`btn btn-sm py-1 px-3 fw-bold rounded-pill ${!selectedFashionSize ? "btn-warning text-dark shadow-sm" : "btn-outline-warning text-dark bg-white"}`}
                          onClick={() => setSelectedFashionSize(null)}
                        >
                          <span>{selectedFashionProduct.name}</span>
                        </button>
                      </>
                    )}

                    {selectedFashionSize && (
                      <>
                        <span className="text-secondary fw-bold">›</span>
                        <span className="badge bg-success py-1.5 px-3 fw-bold rounded-pill shadow-sm" style={{ fontSize: "0.82rem" }}>
                          <span>৩. সাইজ: {selectedFashionSize}</span>
                        </span>
                      </>
                    )}
                  </div>

                  {selectedCategory && (
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm py-1 px-3 fw-bold rounded-pill"
                      style={{ fontSize: "11px" }}
                      onClick={() => { setSelectedCategory(null); setSelectedFashionProduct(null); setSelectedFashionSize(null); setQuery(""); }}
                    >
                      <i className="bi bi-arrow-counterclockwise me-1"></i>রিসেট
                    </button>
                  )}
                </div>
              </div>

              {/* ── STEP 1: CATEGORY CARDS ── */}
              {!selectedCategory && (
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                      <span>👗</span>
                      <span>১. পোশাকের ক্যাটাগরি বেছে নিন:</span>
                    </h6>
                    <span className="badge bg-light text-secondary border">মোট {categories.length}টি ক্যাটাগরি</span>
                  </div>

                  <div className="row g-3">
                    {categories.map((c) => (
                      <div className="col-6 col-md-4" key={c.id}>
                        <button
                          type="button"
                          className="btn btn-outline-light text-start p-3.5 w-100 rounded-4 border shadow-sm d-flex flex-column justify-content-between text-dark"
                          style={{ minHeight: "115px", backgroundColor: "#ffffff", borderColor: "#e2e8f0", transition: "all 0.2s ease" }}
                          onClick={() => { setSelectedCategory(c.id); setSelectedFashionProduct(null); setSelectedFashionSize(null); }}
                        >
                          <div className="d-flex align-items-center justify-content-between w-100">
                            <span className="fs-3">{c.icon || "👗"}</span>
                            <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill">
                              ব্রাউজ করুন →
                            </span>
                          </div>
                          <div className="mt-2">
                            <div className="fw-bold fs-6 text-dark">{c.name}</div>
                            <div className="text-secondary small mt-0.5">ক্লিক করে সাইজ ও ডিজাইন দেখুন</div>
                          </div>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── STEP 2: PRODUCTS IN CATEGORY & SIZE PILLS ── */}
              {selectedCategory && !selectedFashionProduct && (
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <h6 className="fw-bold text-dark mb-0">
                      <span>{categories.find(c => c.id === selectedCategory)?.name} — ডিজাইন ও সাইজ তালিকা:</span>
                    </h6>
                    <button type="button" className="btn btn-outline-secondary btn-sm py-1 px-3 rounded-pill" onClick={() => setSelectedCategory(null)}>
                      ← ক্যাটাগরি পরিবর্তন
                    </button>
                  </div>

                  <div className="row g-3">
                    {shown.map((p) => {
                      const hasVars = p.variations && p.variations.length > 0;
                      const sizeMap = new Map<string, { count: number; stock: number; colors: string[] }>();
                      if (hasVars) {
                        p.variations?.forEach((v) => {
                          const size = v.attributes?.size || v.name.split('/')[1]?.split('(')[0]?.trim() || v.name;
                          const color = v.attributes?.color || v.name.split('/')[0]?.trim() || "";
                          const cur = sizeMap.get(size) || { count: 0, stock: 0, colors: [] };
                          cur.count += 1;
                          cur.stock += Number(v.current_stock || 0);
                          if (color && !cur.colors.includes(color)) cur.colors.push(color);
                          sizeMap.set(size, cur);
                        });
                      }

                      return (
                        <div className="col-12 col-md-6" key={p.id}>
                          <div className="card shadow-sm border rounded-4 overflow-hidden h-100 p-3 bg-white">
                            <div className="d-flex justify-content-between align-items-start mb-2">
                              <div>
                                <h6 className="fw-bold text-dark mb-1">{p.name}</h6>
                                <span className="text-secondary small font-monospace">{p.sku || p.barcode}</span>
                              </div>
                              <div className="text-end">
                                <span className="fw-bold text-primary fs-6">{money(p.selling_price)}</span>
                                <div>
                                  <span className="badge bg-light text-secondary border">
                                    মোট স্টক: {p.current_stock} পিস
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Size Pills Grid */}
                            {hasVars ? (
                              <div className="mt-2 pt-2 border-top">
                                <div className="text-secondary small fw-bold mb-1.5">
                                  <span>📏 সাইজ নির্বাচন করুন:</span>
                                </div>
                                <div className="d-flex flex-wrap gap-1.5">
                                  {Array.from(sizeMap.entries()).map(([sizeKey, sizeData]) => {
                                    const outOfStock = sizeData.stock <= 0;
                                    return (
                                      <button
                                        key={sizeKey}
                                        type="button"
                                        className={`btn btn-sm py-1 px-2.5 rounded-pill fw-bold border text-start d-flex align-items-center gap-1.5 ${outOfStock ? "btn-light text-muted opacity-50" : "btn-outline-purple bg-purple-subtle"}`}
                                        style={{ backgroundColor: outOfStock ? "#f1f5f9" : "#f5f3ff", color: outOfStock ? "#94a3b8" : "#7c3aed", borderColor: "#ddd6fe" }}
                                        onClick={() => {
                                          setSelectedFashionProduct(p);
                                          setSelectedFashionSize(sizeKey);
                                        }}
                                      >
                                        <span>👗 {sizeKey}</span>
                                        <span className="badge bg-white text-purple border" style={{ color: "#7c3aed", fontSize: "10px" }}>
                                          {sizeData.stock} পিস
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              <div className="mt-auto pt-2">
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm w-100 rounded-pill fw-bold"
                                  onClick={() => addToCart(p)}
                                >
                                  + কার্টে যোগ করুন
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── STEP 3: COLOR VARIANTS OF SELECTED SIZE ── */}
              {selectedFashionProduct && selectedFashionSize && (
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div>
                      <h6 className="fw-bold text-dark mb-0">
                        <span>{selectedFashionProduct.name} ➜ সাইজ: {selectedFashionSize}</span>
                      </h6>
                      <div className="text-secondary small">কাস্টমারের পছন্দ অনুযায়ী রঙে ক্লিক করলেই কার্টে যোগ হবে:</div>
                    </div>
                    <button type="button" className="btn btn-outline-secondary btn-sm py-1 px-3 rounded-pill" onClick={() => setSelectedFashionSize(null)}>
                      ← অন্য সাইজ বেছে নিন
                    </button>
                  </div>

                  <div className="row g-3">
                    {selectedFashionProduct.variations
                      ?.filter((v) => {
                        const size = v.attributes?.size || v.name.split('/')[1]?.split('(')[0]?.trim() || v.name;
                        return size === selectedFashionSize || v.name.includes(selectedFashionSize);
                      })
                      .map((v) => {
                        const colorName = v.attributes?.color || v.name.split('/')[0]?.trim() || v.name;
                        const outOfStock = Number(v.current_stock) <= 0;
                        return (
                          <div className="col-12 col-md-4" key={v.id}>
                            <button
                              type="button"
                              className="btn btn-outline-light text-start p-3 w-100 rounded-4 border shadow-sm d-flex flex-column justify-content-between text-dark"
                              style={{ minHeight: "110px", backgroundColor: "#ffffff", borderColor: "#e2e8f0" }}
                              onClick={() => {
                                addToCart(selectedFashionProduct, undefined, 1, v);
                                flash(`✔ কার্টে যোগ হয়েছে: ${selectedFashionProduct.name} (${v.name})`, true);
                              }}
                            >
                              <div className="d-flex align-items-center justify-content-between w-100">
                                <div className="fw-bold fs-6 text-dark d-flex align-items-center gap-2">
                                  <span className="p-1 rounded-circle bg-primary" style={{ width: 10, height: 10, display: "inline-block" }}></span>
                                  <span>{colorName}</span>
                                </div>
                                <span className={`badge ${outOfStock ? "bg-danger-subtle text-danger" : "bg-success-subtle text-success"} border`}>
                                  {outOfStock ? "স্টক নেই" : `স্টক: ${v.current_stock} পিস`}
                                </span>
                              </div>
                              <div className="d-flex align-items-center justify-content-between w-100 mt-2">
                                <span className="text-secondary small font-monospace">হ্যাংট্যাগ: {v.barcode || v.sku}</span>
                                <span className="fw-bold text-success fs-6">{money(v.selling_price || selectedFashionProduct.selling_price)}</span>
                              </div>
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          ) : isRepairShop ? (
            <div className="d-flex flex-column gap-3">
              {/* Breadcrumb / Navigation Bar */}
              <div className="card shadow-sm border-0 mb-2">
                <div className="card-body p-2 px-3 d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-2 small">
                    <button
                      type="button"
                      className={`btn btn-sm py-1 px-3 fw-bold rounded-3 ${!selectedBrand ? "btn-primary shadow-sm" : "btn-outline-primary"}`}
                      onClick={() => { setSelectedBrand(null); setSelectedCategory(null); setQuery(""); }}
                    >
                      <i className="bi bi-phone me-1"></i>১. ব্র্যান্ড (Brands)
                    </button>
                    {selectedBrand && (
                      <>
                        <span className="text-secondary fw-bold">›</span>
                        <button
                          type="button"
                          className={`btn btn-sm py-1 px-3 fw-bold rounded-3 ${!selectedCategory ? "btn-warning text-dark shadow-sm" : "btn-outline-warning text-dark"}`}
                          onClick={() => { setSelectedCategory(null); setQuery(""); }}
                        >
                          <i className="bi bi-cpu me-1"></i>{brands.find(b => b.id === selectedBrand)?.name || "ক্যাটাগরি"}
                        </button>
                      </>
                    )}
                    {selectedBrand && selectedCategory && (
                      <>
                        <span className="text-secondary fw-bold">›</span>
                        <span className="badge bg-success py-2 px-3 fw-bold rounded-3" style={{ fontSize: "0.8rem" }}>
                          <i className="bi bi-box-seam me-1"></i>{categories.find(c => c.id === selectedCategory)?.name || "পার্টস"}
                        </span>
                      </>
                    )}
                  </div>
                  {selectedBrand && (
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm py-1 px-3 fw-bold rounded-3"
                      style={{ fontSize: "12px" }}
                      onClick={() => { setSelectedBrand(null); setSelectedCategory(null); setQuery(""); }}
                    >
                      শুরুতে ফিরুন ↺
                    </button>
                  )}
                </div>
              </div>

              {/* ── STEP 1: Select Brand (Big Touch Cards) ── */}
              {!selectedBrand && (
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
                          <div className="small">Product List পেজ থেকে নতুন ব্র্যান্ড তৈরি করুন।</div>
                        </div>
                      ) : (
                        brands.map((b) => (
                          <div className="col-6 col-md-4" key={b.id}>
                            <button
                              type="button"
                              className="btn btn-light w-100 p-4 rounded-4 text-center border shadow-sm d-flex flex-column align-items-center justify-content-center gap-2 brand-card-btn"
                              style={{ minHeight: "120px", transition: "all 0.2s" }}
                              onClick={() => { setSelectedBrand(b.id); setQuery(""); }}
                            >
                              <div className="p-3 rounded-circle bg-primary bg-opacity-10 text-primary fs-3">
                                <i className="bi bi-phone"></i>
                              </div>
                              <div className="fw-bold fs-6 text-dark">{b.name}</div>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── STEP 2: Select Category (Component Cards) ── */}
              {selectedBrand && !selectedCategory && (
                <div className="card shadow-sm border-0">
                  <div className="card-body p-4">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <h6 className="fw-bold text-warning text-dark mb-0">
                        <i className="bi bi-tools me-2 text-warning"></i><strong>{brands.find(b => b.id === selectedBrand)?.name}</strong> এর ক্যাটাগরি / পার্টস বেছে নিন:
                      </h6>
                      <button type="button" className="btn btn-outline-secondary btn-sm py-1 px-3" onClick={() => setSelectedBrand(null)}>
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
                        categories.map((c) => (
                          <div className="col-6 col-md-4" key={c.id}>
                            <button
                              type="button"
                              className="btn btn-light w-100 p-3 rounded-4 text-center border shadow-sm d-flex flex-column align-items-center justify-content-center gap-2 category-card-btn"
                              style={{ minHeight: "110px", transition: "all 0.2s" }}
                              onClick={() => { setSelectedCategory(c.id); setQuery(""); }}
                            >
                              <div className="p-2 rounded-circle bg-warning bg-opacity-10 text-warning fs-3">
                                <i className="bi bi-cpu"></i>
                              </div>
                              <div className="fw-bold fs-6 text-dark">{c.name}</div>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── STEP 3: Products / Model Cards ── */}
              {selectedBrand && selectedCategory && (
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <h6 className="fw-bold text-success mb-0">
                      <i className="bi bi-box-seam me-2"></i>{brands.find(b => b.id === selectedBrand)?.name} · {categories.find(c => c.id === selectedCategory)?.name} এর পার্টস তালিকা:
                    </h6>
                    <button type="button" className="btn btn-outline-secondary btn-sm py-1 px-3" onClick={() => setSelectedCategory(null)}>
                      ← ক্যাটাগরি পরিবর্তন
                    </button>
                  </div>

                  {shown.length === 0 && !gridLoading ? (
                    <div className="card shadow-sm border-0">
                      <div className="card-body text-center py-5 text-secondary">
                        <div style={{ fontSize: "2.5rem" }}>📦</div>
                        <div className="fw-bold mt-2">এই ক্যাটাগরিতে কোনো প্রোডাক্ট পাওয়া যায়নি</div>
                        <div className="small mt-1">দয়া করে অন্য ক্যাটাগরি বেছে নিন অথবা নতুন প্রোডাক্ট যোগ করুন।</div>
                      </div>
                    </div>
                  ) : (
                    <div className="row g-2" style={{ maxHeight: "52vh", overflowY: "auto" }} onScroll={onGridScroll}>
                      {shown.map((p) => {
                        const mult = Number(p.purchase_multiplier) || 1;
                        const isBulk = mult > 1;
                        const baseUnit = p.unit_detail?.short_code || p.unit_detail?.name || "";
                        const out = Number(p.current_stock) <= 0;
                        const inCart = cart.some((l) => l.product.id === p.id);
                        const busy = unitLoadingId === p.id;
                        return (
                          <div className="col-6 col-md-4" key={p.id}>
                            <button
                              type="button"
                              className={`pos-item w-100 p-3 text-start rounded-3 shadow-sm ${inCart ? "pos-item-active" : ""}`}
                              disabled={out || busy}
                              onClick={() => pickFromGrid(p)}
                            >
                              <div className="fw-bold text-truncate" style={{ fontSize: "0.95rem" }}>{formatProductName(p, isRepairShop)}</div>
                              <div style={{ fontSize: ".72rem", fontFamily: "monospace", color: "var(--text-muted, #64748b)" }}>
                                {p.sku || p.barcode}
                              </div>
                              <div className="d-flex justify-content-between align-items-center mt-2">
                                <div>
                                  <span className="fw-bold text-primary" style={{ fontSize: "1rem" }}>{money(p.selling_price)}</span>
                                  {baseUnit ? <span className="text-secondary" style={{ fontSize: "0.7rem" }}>/{baseUnit}</span> : null}
                                </div>
                                <span className={`small ${out ? "text-danger fw-semibold" : inCart ? "text-success fw-semibold" : "text-secondary"}`}
                                      style={{ fontSize: ".72rem" }}>
                                  {busy ? <span className="spinner-border spinner-border-sm" role="status" /> : out ? t("pos_out") : inCart ? `✓ ×${cart.find(l => l.product.id === p.id)?.qty}` : t("pos_stock", { count: p.current_stock })}
                                </span>
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              {shown.length === 0 && query && !gridLoading ? (
                <div className="card shadow-sm">
                  <div className="card-body text-center py-4 text-secondary small">
                    {t("pos_no_barcode_match")} "<strong>{query}</strong>"
                    <div className="mt-2">
                      {t("pos_press_enter")}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="row g-2" style={{ maxHeight: "52vh", overflowY: "auto" }} onScroll={onGridScroll}>
                  {shown.map((p) => {
                    const mult = Number(p.purchase_multiplier) || 1;
                    const isBulk = mult > 1;
                    const baseUnit = p.unit_detail?.short_code || p.unit_detail?.name || "";
                    const bulkUnit = p.purchase_unit_detail?.name || "Pack";
                    const out = Number(p.current_stock) <= 0;
                    const inCart = cart.some((l) => l.product.id === p.id);

                    const exactMatch = query.trim() !== "" && p.barcode === query.trim();
                    const busy = unitLoadingId === p.id;
                    return (
                      <div className="col-6 col-md-4" key={p.id}>
                        <button
                          type="button"
                          className={`pos-item w-100 p-2 text-start ${inCart ? "pos-item-active" : ""} ${exactMatch ? "pos-item-exact" : ""}`}
                          disabled={out || busy}
                          onClick={() => pickFromGrid(p)}
                        >
                          <div className="small fw-semibold text-truncate">{p.name}</div>
                          <div style={{ fontSize: ".7rem", fontFamily: "monospace", color: exactMatch ? "var(--brand-700,#1a73e8)" : "#94a3b8" }}>
                            {p.barcode || p.sku}
                          </div>
                          {p.variations && p.variations.length > 0 && (
                            <div className="mt-1">
                              <span className="badge rounded-pill" style={{ backgroundColor: "#f3e8ff", color: "#7c3aed", border: "1px solid #d8b4fe", fontSize: "10px", padding: "2px 7px" }}>
                                👗 {p.variations.length}টি সাইজ উপলব্ধ
                              </span>
                            </div>
                          )}
                          <div className="d-flex justify-content-between align-items-center mt-1">
                            <div>
                              <span className="small fw-bold">{money(p.selling_price)}</span>
                              {baseUnit ? <span className="text-secondary" style={{ fontSize: "0.68rem" }}>/{baseUnit}</span> : null}
                            </div>
                            <span className={`small ${out ? "text-danger fw-semibold" : inCart ? "text-success fw-semibold" : "text-secondary"}`}
                                  style={{ fontSize: ".68rem" }}>
                              {busy ? <span className="spinner-border spinner-border-sm" role="status" /> : out ? t("pos_out") : inCart ? `✓ ×${cart.find(l => l.product.id === p.id)?.qty}` : t("pos_stock", { count: p.current_stock })}
                            </span>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Cart ── */}
        <div className="col-lg-5">
          <div className="card shadow-sm" style={{ position: "sticky", top: "1rem" }}>
            <div className="card-header d-flex justify-content-between align-items-center">
              <span className="fw-semibold">
                🛒 {t("pos_cart")}
                {itemCount > 0 && <span className="badge text-bg-secondary ms-2">{itemCount}</span>}
              </span>
              <div className="d-flex align-items-center gap-2">
                {isSupershop && heldCarts.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-warning btn-xs py-0 px-2 fw-bold rounded-pill text-dark shadow-sm"
                    style={{ fontSize: "0.75rem" }}
                    onClick={() => setShowHeldModal(true)}
                  >
                    📋 Held ({heldCarts.length}) [F9]
                  </button>
                )}
                {isSupershop && cart.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-outline-warning btn-xs py-0 px-2 fw-semibold rounded-pill"
                    style={{ fontSize: "0.75rem" }}
                    onClick={holdCurrentCart}
                    title="হোল্ড কার্ট (F8)"
                  >
                    ⏸️ Hold (F8)
                  </button>
                )}
                {cart.length > 0 && (
                  <button className="btn btn-link btn-sm text-danger p-0 ms-1" onClick={clearCart}>{t("pos_clear")}</button>
                )}
              </div>
            </div>
            <div className="card-body p-0">
              <div style={{ maxHeight: "52vh", overflowY: "auto" }}>
                <table className="table table-sm align-middle mb-0">
                  <tbody>
                    {cart.length === 0 ? (
                      <tr>
                        <td className="text-secondary text-center py-5 px-3">
                          <div style={{ fontSize: "2rem" }}>▦</div>
                          <div className="small mt-1">{t("pos_scan_to_add")}</div>
                        </td>
                      </tr>
                    ) : cart.map((l) => {
                      const mult = Number(l.product.purchase_multiplier) || 1;
                      const isBulk = mult > 1;
                      const baseUnit = l.product.unit_detail?.short_code || l.product.unit_detail?.name || (isSpecialShop ? "Unit" : "");
                      const bulkUnit = l.product.purchase_unit_detail?.name || "Pack";
                      const packSell = Number(l.product.full_pack_sell) || (isBulk ? Number((Number(l.product.selling_price) * mult).toFixed(2)) : Number(l.product.selling_price));
                      
                      return (
                        <tr key={l.lineId || String(l.product.id)}>
                          <td className="ps-3">
                            <div className="small fw-semibold">{l.product.name}</div>
                            {((l.product as any)._selectedVariant || l.selectedVariation) && (
                              <div className="d-flex align-items-center gap-1 my-0.5">
                                <span className="badge border" style={{ fontSize: "0.72rem", background: "#f3e8ff", color: "#6b21a8", borderColor: "#d8b4fe" }}>
                                  👗 {(l.product as any)._selectedVariant?.size || l.selectedVariation?.attributes?.size || l.selectedVariation?.name}
                                  {((l.product as any)._selectedVariant?.color || l.selectedVariation?.attributes?.color) ? (" / " + ((l.product as any)._selectedVariant?.color || l.selectedVariation?.attributes?.color)) : ""}
                                </span>
                              </div>
                            )}
                            
                            {/* Dual unit switcher pill buttons if product has purchase_multiplier > 1 */}
                            {isBulk ? (
                              <div className="d-flex flex-wrap align-items-center gap-1 my-1">
                                <div className="btn-group btn-group-sm" role="group">
                                  <button
                                    type="button"
                                    className={`btn btn-xs py-0 px-2 ${l.sellMode !== "bulk" ? "btn-brand text-white fw-bold" : "btn-outline-secondary"}`}
                                    style={{ fontSize: "0.68rem" }}
                                    onClick={() => toggleSellMode(l.lineId || l.product.id, "base")}
                                  >
                                    🟢 {baseUnit || "খুচরা / Loose"} (৳{Number(l.product.selling_price).toFixed(2)})
                                  </button>
                                  <button
                                    type="button"
                                    className={`btn btn-xs py-0 px-2 ${l.sellMode === "bulk" ? "btn-primary text-white fw-bold" : "btn-outline-secondary"}`}
                                    style={{ fontSize: "0.68rem" }}
                                    onClick={() => toggleSellMode(l.lineId || l.product.id, "bulk")}
                                  >
                                    📦 {bulkUnit || "ড্রাম / Drum"} ({mult} {baseUnit} @ ৳{packSell.toFixed(0)})
                                  </button>
                                </div>
                              </div>
                            ) : (
                              !!l.product.unit_detail && (
                                <div className="text-secondary small fw-normal">
                                  Rate: ৳{l.price} / {l.product.unit_detail.short_code || l.product.unit_detail.name}
                                </div>
                              )
                            )}

                            {l.sellMode === "bulk" ? (
                              <div className="text-primary fw-medium" style={{ fontSize: ".72rem" }}>
                                ৳{money(l.price)} / {bulkUnit} ({mult} {baseUnit})
                              </div>
                            ) : (
                              <div className="text-secondary" style={{ fontSize: ".72rem" }}>
                                {money(l.price)} {t("pos_each")}
                              </div>
                            )}

                            {!isFashionShop && !!l.product.warranty_months && l.selectedUnits.length === 0 && (
                              <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill ms-1 fw-normal" style={{ fontSize: '.6rem' }}>
                                <i className="bi bi-shield-check me-1"></i>
                                {t("pos_months_warranty", { months: l.product.warranty_months })}
                              </span>
                            )}
                            {isFashionShop && !!l.product.replacement_guarantee_days && Number(l.product.replacement_guarantee_days) > 0 && (
                              <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill ms-1 fw-normal" style={{ fontSize: '.6rem' }}>
                                🔄 {l.product.replacement_guarantee_days} {lang === "bn" ? "দিন এক্সচেঞ্জ" : "d exchange"}
                              </span>
                            )}
                            {!!l.product.expiry_date && (
                              <span className="badge bg-success-subtle text-success-emphasis border border-success-subtle rounded-pill ms-1 fw-normal" style={{ fontSize: '.6rem' }}>
                                📅 {lang === "bn" ? `মেয়াদ: ${l.product.expiry_date}` : `Exp: ${l.product.expiry_date}`}
                              </span>
                            )}
                            
                            {l.selectedUnits.length > 0 && (
                              <div className="mt-1 d-flex flex-wrap gap-1">
                                {l.selectedUnits.map(u => (
                                  <span key={u.id} className="badge bg-body-secondary text-secondary border fw-normal d-inline-flex align-items-center" style={{ fontSize: ".65rem" }}>
                                    <span>{u.barcode}</span>
                                    {!!u.effective_warranty_months && (
                                      <span className="text-warning-emphasis ms-1">
                                        <i className="bi bi-shield-check"></i> {t("pos_months_warranty_short", { months: u.effective_warranty_months })}
                                      </span>
                                    )}
                                    <i 
                                      className="bi bi-trash text-danger ms-2 hover-opacity" 
                                      style={{ cursor: "pointer" }}
                                      onClick={() => {
                                        setCart(c => {
                                          const newC = [...c];
                                          const idx = newC.findIndex(line => line.product.id === l.product.id);
                                          if (idx >= 0) {
                                            const ex = newC[idx];
                                            const updatedUnits = ex.selectedUnits.filter(su => su.id !== u.id);
                                            if (updatedUnits.length === 0 && ex.qty === 1) {
                                              return newC.filter(line => line.product.id !== l.product.id);
                                            }
                                            newC[idx] = { ...ex, qty: ex.qty - 1, selectedUnits: updatedUnits };
                                          }
                                          return newC;
                                        });
                                      }}
                                    ></i>
                                  </span>
                                ))}
                                <button 
                                  className="btn btn-link btn-sm text-brand p-0 ms-1" 
                                  style={{ fontSize: ".65rem" }}
                                  onClick={() => setUnitSelectProduct(l.product)}
                                >
                                  {t("pos_edit_units")}
                                </button>
                              </div>
                            )}
                          </td>
                          <td style={{ width: "5.5rem" }}>
                            {l.selectedUnits.length > 0 ? (
                              <div className="text-center fw-semibold small bg-body-secondary border rounded px-2 py-1">
                                {l.qty}
                              </div>
                            ) : (
                              <div>
                                <input
                                  type="number"
                                  min={l.sellMode === "bulk" ? 1 : (l.product.unit_detail?.allow_decimal ? 0.01 : 1)}
                                  step={l.sellMode === "bulk" ? 1 : (l.product.unit_detail?.allow_decimal ? 0.01 : 1)}
                                  className="form-control form-control-sm text-center"
                                  value={l.qty === 0 ? "" : l.qty}
                                  onChange={(e) => setQty(l.lineId || l.product.id, e.target.value === "" ? 0 : Number(e.target.value))}
                                  onBlur={() => clampQty(l.lineId || l.product.id)}
                                />
                                <div className="text-center text-secondary small" style={{ fontSize: "0.65rem" }}>
                                  {l.sellMode === "bulk" ? bulkUnit : (l.product.unit_detail?.short_code || l.product.unit_detail?.name || "")}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="text-end small fw-bold">{money(l.qty * l.price - l.discount)}</td>
                          <td className="text-end pe-2">
                            <button className="btn btn-link btn-sm text-danger p-0" onClick={() => removeLine(l.lineId || l.product.id)}>✕</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="px-3 py-3 border-top">
                <div className="d-flex justify-content-between small mb-1">
                  <span className="text-secondary">{t("pos_subtotal")}</span>
                  <span>{money(subtotal)}</span>
                </div>
                <div className="d-flex justify-content-between fw-bold mb-3">
                  <span>{t("pos_total")}</span>
                  <span>{money(subtotal)}</span>
                </div>
                {isElectronicsShop ? (
                  <button
                    type="button"
                    className="btn btn-brand w-100 py-2.5 fw-semibold shadow-sm"
                    disabled={cart.length === 0}
                    onClick={goToCheckout}
                  >
                    {t("pos_continue")} →
                  </button>
                ) : (
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-success flex-grow-1 py-2 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-1"
                      disabled={cart.length === 0 || fastCheckingOut}
                      onClick={doFastCashCheckout}
                      title="Press F12 for instant 1-key cash checkout"
                    >
                      {fastCheckingOut ? (
                        <span className="spinner-border spinner-border-sm me-1" />
                      ) : (
                        <span>⚡ {lang === "bn" ? "ক্যাশ পে (F12)" : "Fast Cash (F12)"}</span>
                      )}
                    </button>

                    <button
                      type="button"
                      className="btn btn-brand flex-grow-1 py-2 fw-semibold shadow-sm"
                      disabled={cart.length === 0 || fastCheckingOut}
                      onClick={goToCheckout}
                    >
                      {t("pos_continue")} →
                    </button>
                  </div>
                )}
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
                <h5 className="modal-title">{t("pos_assign_title")}</h5>
                <button className="btn-close" onClick={() => { setShowAssign(false); setTimeout(() => inputRef.current?.focus(), 50); }} />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <div className="small text-secondary mb-1">{t("pos_assign_scanned")}</div>
                  <div className="px-3 py-2 bg-body-secondary rounded fw-bold" style={{ fontFamily: "monospace", letterSpacing: ".05em" }}>
                    {assignBarcode}
                  </div>
                </div>

                <div className="mb-3 position-relative">
                  <label className="form-label small">{t("pos_assign_which")}</label>
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
                        placeholder={t("pos_assign_search")}
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
                              {p.barcode && <span className="text-warning ms-2 small">{t("pos_assign_has_barcode", { barcode: p.barcode })}</span>}
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
                  {t("pos_assign_cancel")}
                </button>
                <button
                  className="btn btn-brand btn-sm"
                  disabled={!assignSelected || assignSaving}
                  onClick={doAssign}
                >
                  {assignSaving ? t("pos_assign_saving") : t("pos_assign_btn", { name: assignSelected?.name ?? "…" })}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── Select units modal ── */}
      {/* ── Size & Color Variant Selection Modal ── */}
      {variantModalProduct && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 2050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden">
              <div className="modal-header py-3 text-white" style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}>
                <h5 className="modal-title h6 fw-bold d-flex align-items-center gap-2 mb-0">
                  <span>👗</span>
                  <span>সাইজ ও কালার নির্বাচন করুন (Select Size & Color)</span>
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setVariantModalProduct(null)} />
              </div>
              <div className="modal-body p-4">
                <div className="mb-3">
                  <h6 className="fw-bold text-dark mb-1">{variantModalProduct.name}</h6>
                  <div className="text-secondary small">কাস্টমারের পছন্দ অনুযায়ী সাইজে ক্লিক করলেই কার্টে যোগ হবে:</div>
                </div>

                <div className="d-grid gap-2" style={{ maxHeight: "380px", overflowY: "auto" }}>
                  {variantModalProduct.variations?.map((v) => {
                    const outOfStock = Number(v.current_stock) <= 0;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        className="btn btn-outline-light text-start p-3 rounded-3 border d-flex align-items-center justify-content-between text-dark shadow-sm"
                        style={{ transition: "all 0.15s ease", backgroundColor: "#f8fafc" }}
                        onClick={() => {
                          addToCart(variantModalProduct, undefined, 1, v);
                          setVariantModalProduct(null);
                          flash(`✔ কার্টে যোগ হয়েছে: ${variantModalProduct.name} (${v.name})`, true);
                        }}
                      >
                        <div>
                          <div className="fw-bold fs-6 text-primary d-flex align-items-center gap-2">
                            <span>👗 {v.name}</span>
                          </div>
                          <div className="text-secondary small mt-0.5">
                            বারকোড হ্যাংট্যাগ: <code>{v.barcode || v.sku}</code>
                          </div>
                        </div>
                        <div className="text-end">
                          <div className="fw-bold text-success fs-6">{money(v.selling_price || variantModalProduct.selling_price)}</div>
                          <span className={`badge ${outOfStock ? "bg-danger-subtle text-danger" : "bg-success-subtle text-success"} border`}>
                            {outOfStock ? "স্টক শেষ" : `স্টক: ${v.current_stock} পিস`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="modal-footer bg-light py-2">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setVariantModalProduct(null)}>
                  বাতিল
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {unitSelectProduct && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.45)" }}>
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{t("pos_unit_title")}</h5>
                <button className="btn-close" onClick={() => { setUnitSelectProduct(null); setTimeout(() => inputRef.current?.focus(), 50); }} />
              </div>
              <div className="modal-body">
                <div className="mb-3 small text-secondary">
                  <strong>{unitSelectProduct.name}</strong> {t("pos_unit_desc")}
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
                              {t("pos_unit_warranty", { months: u.effective_warranty_months })}
                            </span>
                          )}
                          <span className="text-secondary">{t("pos_unit_cost", { amount: money(u.effective_cost_price || unitSelectProduct.cost_price || 0) })}</span>
                          <span className="ms-2 fw-semibold text-body">{t("pos_unit_price", { amount: money(u.effective_selling_price || unitSelectProduct.selling_price || 0) })}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="modal-footer d-flex justify-content-between">
                <div className="small fw-semibold text-brand">
                  {t("pos_unit_selected", { count: cart.find(l => l.product.id === unitSelectProduct.id)?.selectedUnits.length || 0 })}
                </div>
                <button className="btn btn-brand btn-sm" onClick={() => { setUnitSelectProduct(null); setTimeout(() => inputRef.current?.focus(), 50); }}>
                  {t("pos_unit_done")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Product picker (one barcode → several products) ── */}
      {pickProducts && pickProducts.length > 0 && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.45)" }}>
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <div>
                  <h5 className="modal-title">{t("pos_pick_title")}</h5>
                  <div className="small text-secondary">
                    {t("pos_pick_desc", { count: pickProducts.length })} (Barcode: <span className="font-monospace fw-semibold">{pickCode}</span>)
                  </div>
                </div>
                <button className="btn-close" onClick={() => { setPickProducts(null); setTimeout(() => inputRef.current?.focus(), 50); }} />
              </div>
              <div className="modal-body">
                <div className="d-flex flex-column gap-2">
                  {pickProducts.map((p) => {
                    const oos = p.track_inventory !== false && Number(p.current_stock) <= 0;
                    return (
                      <button
                        key={p.id}
                        className="d-flex justify-content-between align-items-center p-2 border rounded text-start btn btn-light"
                        disabled={oos}
                        onClick={() => {
                          setPickProducts(null);
                          tryAdd(p);
                        }}
                      >
                        <div>
                          <div className="fw-semibold">{p.name}</div>
                          <div className="small text-secondary">
                            {p.sku ? t("pos_pick_sku", { sku: p.sku }) : t("pos_pick_barcode", { barcode: pickCode })}
                          </div>
                        </div>
                        <div className="text-end">
                          <div className="fw-semibold">{money(p.selling_price || 0)}</div>
                          <div className={`small ${oos ? "text-danger" : "text-secondary"}`}>
                            {oos ? t("pos_pick_out_of_stock") : t("pos_stock", { count: p.current_stock })}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Fashion Size & Color Picker Modal ── */}
      {fashionPickProduct && (
        <div className="modal d-flex align-items-center justify-content-center" style={{display:"flex",position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:2000}}>
          <div className="modal-dialog modal-sm m-0" style={{minWidth:320}}>
            <div className="modal-content">
              <div className="modal-header py-2" style={{background:"#7c3aed",color:"#fff"}}>
                <h6 className="modal-title mb-0">👗 {fashionPickProduct.name}</h6>
                <button className="btn-close btn-close-white" onClick={()=>{setFashionPickProduct(null);setFashionPickVariant(null);setTimeout(()=>inputRef.current?.focus(),50);}}/>
              </div>
              <div className="modal-body">
                <p className="small text-muted mb-2">{lang==="bn"?"সাইজ ও রঙ বেছুন":"Select Size & Color"}</p>
                <div className="d-flex flex-wrap gap-2">
                  {(fashionPickProduct.size_variants||[]).map((v:any,i:number)=>(
                    <button key={i} type="button"
                      className={"btn btn-sm " + (fashionPickVariant?.size===v.size && fashionPickVariant?.color===v.color ? "btn-purple" : "btn-outline-secondary")}
                      style={fashionPickVariant?.size===v.size && fashionPickVariant?.color===v.color ? {background:"#7c3aed",color:"#fff",borderColor:"#7c3aed"} : {}}
                      onClick={()=>setFashionPickVariant({size:v.size,color:v.color})}
                    >
                      {v.size}{v.color ? ` / ${v.color}` : ""} <span className="badge bg-light text-dark ms-1">{v.stock}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="modal-footer py-2">
                <button className="btn btn-sm btn-outline-secondary" onClick={()=>{setFashionPickProduct(null);setFashionPickVariant(null);setTimeout(()=>inputRef.current?.focus(),50);}}>
                  {lang==="bn"?"বাতিল":"Cancel"}
                </button>
                <button className="btn btn-sm" style={{background:"#7c3aed",color:"#fff"}}
                  disabled={!fashionPickVariant}
                  onClick={()=>{
                    if(fashionPickProduct){
                      addToCart({...fashionPickProduct,_selectedVariant:fashionPickVariant} as any);
                      flash(t("pos_added_alert",{name:fashionPickProduct.name + (fashionPickVariant ? ` (${fashionPickVariant.size}/${fashionPickVariant.color})` : "")}),true);
                      setFashionPickProduct(null);setFashionPickVariant(null);
                      setQuery("");setTimeout(()=>inputRef.current?.focus(),50);
                    }
                  }}
                >
                  + {lang==="bn"?"কার্টে যোগ করুন":"Add to Cart"}
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
