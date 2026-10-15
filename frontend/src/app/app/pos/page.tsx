"use client";
import { formatProductName } from "@/lib/formatters";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, useApi, Paginated, fastapiFetch, fetchAll } from "@/lib/api";
import { ErrorState, Spinner, money } from "@/components/ui";
import { ScannerModal } from "@/components/ScannerModal";
import toast from "react-hot-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useScannerWebSocket } from "@/hooks/useScannerWebSocket";
import { useAuth } from "@/components/AuthProvider";
import { ModuleRouteGuard } from "@/components/ModuleRouteGuard";
import {
  cacheCatalog,
  getCachedCatalog,
  getCachedProduct,
  searchCachedCatalog,
  lookupCachedBarcode,
  deductCachedStock,
  saveOfflineSale,
  getPendingOfflineSales,
  getPendingOfflineSaleCount,
  markOfflineSalesSynced,
  saveCartCrashBackup,
  getCartCrashBackup,
  clearCartCrashBackup,
  OfflineSale,
  CartBackup,
} from "@/lib/offlineDb";
import { printOfflineReceipt } from "@/lib/offlinePrint";

type ProductUnit = { 
  id: number; 
  barcode: string; 
  effective_selling_price?: string; 
  effective_cost_price?: string; 
  effective_warranty_months?: number;
  effective_replacement_guarantee_days?: number;
};
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
  category?: number | null; category_name?: string | null;
  brand?: number | null; brand_name?: string | null;
  image?: string | null; image_url?: string | null;
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
  size_chart?: {
    unit?: string;
    measurements?: Array<{
      size: string;
      chest?: number | string;
      length?: number | string;
      waist?: number | string;
      shoulder?: number | string;
      inseam?: number | string;
    }>;
  };
  _selectedVariant?: {size: string; color: string} | null;
  purchase_multiplier?: string | number;
  full_pack_cost?: string | number;
  full_pack_sell?: string | number;
  units?: ProductUnit[];
  in_stock_units_count?: number;
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
  const { user, hasModule } = useAuth();
  const hasPicturesModule = hasModule("product_pictures");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pos_view_mode") as "grid" | "table" | null;
      if (saved === "grid" || saved === "table") {
        setViewMode(saved);
      }
    }
  }, []);

  function toggleViewMode(mode: "grid" | "table") {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("pos_view_mode", mode);
    }
  }

  const isSpecialShop = user?.shop_business_type === "camical" || user?.shop_business_type === "supershop" || user?.shop_business_type === "cosmetics" || user?.shop_business_type === "beauty";
  const isSupershop = user?.shop_business_type === "supershop" || user?.shop_business_type === "food" || user?.shop_business_type === "grocery";
  const isFashionShop = user?.shop_business_type === "fashion" || user?.shop_business_type === "footwear" || user?.shop_business_type === "handcrafts" || user?.shop_business_type === "jewelry" || user?.shop_business_type === "apparel" || Boolean(user?.shop_modules?.apparel_catalog);
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
  const [customers, setCustomers] = useState<{ id: number; name: string; phone?: string }[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [walkinName, setWalkinName] = useState("");
  const [walkinPhone, setWalkinPhone] = useState("");
  const [variantModalProduct, setVariantModalProduct] = useState<Product | null>(null);
  const [selectedFashionProduct, setSelectedFashionProduct] = useState<Product | null>(null);
  const [selectedFashionSize, setSelectedFashionSize] = useState<string | null>(null);
  const [showSizeGuideModal, setShowSizeGuideModal] = useState(false);

  // ── Alteration / Fitting State ──
  const [showAlterationModal, setShowAlterationModal] = useState(false);
  const [alterationNotes, setAlterationNotes] = useState("");
  const [alterationStatus, setAlterationStatus] = useState("pending");
  const [alterationDueDate, setAlterationDueDate] = useState("");
  const [tailorName, setTailorName] = useState("");
  const [alterationCharge, setAlterationCharge] = useState<number>(0);

  // ── Offline & Power Outage / Network State ──
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [crashBackupFound, setCrashBackupFound] = useState<CartBackup | null>(null);

  const triggerAutoSync = useCallback(async () => {
    try {
      const pending = await getPendingOfflineSales();
      if (pending.length === 0) {
        setPendingSyncCount(0);
        return;
      }
      setIsSyncing(true);
      const res = await api<any>("/pos/offline-sync/", {
        method: "POST",
        body: { sales: pending },
      });
      if (res?.synced && Array.isArray(res.synced)) {
        await markOfflineSalesSynced(res.synced);
        const newCount = await getPendingOfflineSaleCount();
        setPendingSyncCount(newCount);
        toast.success(
          lang === "bn"
            ? `🎉 ${res.synced.length}টি অফলাইন বিক্রয় সার্ভারে সফলভাবে সিঙ্ক হয়েছে!`
            : `🎉 ${res.synced.length} offline sale(s) synced to server!`
        );
        fetchGrid(1, true); // Refresh catalog with fresh stock
      }
    } catch (err) {
      console.error("Auto sync failed", err);
    } finally {
      setIsSyncing(false);
    }
  }, [lang]);

  // Pre-cache catalog and listen for online/offline events
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOnline(navigator.onLine);

    // Refresh pending offline sale count
    getPendingOfflineSaleCount().then(setPendingSyncCount).catch(() => {});

    // Check for crash backup from power outage
    getCartCrashBackup().then((backup) => {
      if (backup && Array.isArray(backup.cart) && backup.cart.length > 0) {
        setCrashBackupFound(backup);
      }
    }).catch(() => {});

    // Pre-cache full catalog in IndexedDB if online
    if (navigator.onLine && user?.shop) {
      api<any>("/pos/catalog-cache/").then((data) => {
        if (data?.products && Array.isArray(data.products)) {
          cacheCatalog(data.products, user?.shop || 1);
        }
      }).catch(() => {});
    }

    const handleOnline = () => {
      setIsOnline(true);
      toast.success(lang === "bn" ? "🌐 ইন্টারনেট সংযোগ ফিরে এসেছে!" : "🌐 Internet connection restored!");
      triggerAutoSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.error(lang === "bn" ? "⚠️ ইন্টারনেট বিচ্ছিন্ন! অফলাইন মোড সক্রিয়।" : "⚠️ Internet disconnected! Offline mode active.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check for crash recovery backup on mount
    getCartCrashBackup().then((backup) => {
      if (backup && backup.cart && backup.cart.length > 0 && cart.length === 0) {
        setCrashBackupFound(backup);
      }
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [user?.shop, lang, triggerAutoSync]);

  const isInitialMount = useRef(true);

  // Power Outage / Crash Recovery: Auto-backup cart state whenever cart updates
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (cart.length > 0) {
      saveCartCrashBackup({
        cart,
        customerId: selectedCustomerId,
        walkinName,
        walkinPhone,
        savedAt: Date.now(),
      });
    }
  }, [cart, selectedCustomerId, walkinName, walkinPhone]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`stockwhisk_held_carts_${user?.shop || 'default'}`);
      if (stored) setHeldCarts(JSON.parse(stored));
    } catch {}
  }, [user?.shop]);

  useEffect(() => {
    fetchAll<{ id: number; name: string; phone?: string }>("/crm/customers/")
      .then((data) => setCustomers(data || []))
      .catch(() => {});
  }, []);

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

  // Keyboard Shortcuts (F2 search, F4 checkout, F8 hold cart, F9 held list, F12 fast cash)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "F4") {
        e.preventDefault();
        if (cart.length > 0) {
          goToCheckout();
        } else {
          toast.error(lang === "bn" ? "কার্ট খালি! প্রথমে পণ্য যোগ করুন।" : "Cart is empty!");
        }
      } else if (e.key === "F8" && isSupershop) {
        e.preventDefault();
        holdCurrentCart();
      } else if (e.key === "F9" && isSupershop) {
        e.preventDefault();
        setShowHeldModal(s => !s);
      } else if (e.key === "F12") {
        e.preventDefault();
        doFastCashCheckout();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, heldCarts, isSupershop, isElectronicsShop, lang]);

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

    // Offline fast-path: if browser is offline, query IndexedDB directly
    if (typeof window !== "undefined" && !navigator.onLine) {
      try {
        const cached = await searchCachedCatalog(debouncedQuery, selectedCategory, selectedBrand);
        setShown(cached as Product[]);
        setGridHasMore(false);
      } catch {
        if (replace) setShown([]);
      } finally {
        setGridLoading(false);
      }
      return;
    }

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
      // Fallback to IndexedDB cache on network error
      try {
        const cached = await searchCachedCatalog(debouncedQuery, selectedCategory, selectedBrand);
        setShown(cached as Product[]);
      } catch {
        if (replace) setShown([]);
      }
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
    if (p.track_inventory !== false && Number(p.current_stock) <= 0) {
      flash(t("pos_out_of_stock_alert", { name: p.name }), false);
      return;
    }
    if (p.track_inventory === false) { tryAdd(p); return; }
    setUnitLoadingId(p.id);
    try {
      let full: any = null;
      if (typeof window !== "undefined" && navigator.onLine) {
        full = await api<Product>(`/catalog/products/${p.id}/`).catch(() => null);
      }
      if (!full) {
        full = await getCachedProduct(p.id).catch(() => null);
      }
      const fullProduct: Product = {
        ...p,
        variations: full?.variations || p.variations || [],
        units: full?.units || p.units || [],
        unit_detail: full?.unit_detail || p.unit_detail,
        purchase_unit_detail: full?.purchase_unit_detail || p.purchase_unit_detail,
        warranty_months: full?.warranty_months !== undefined ? full.warranty_months : p.warranty_months,
        replacement_guarantee_days: full?.replacement_guarantee_days !== undefined ? full.replacement_guarantee_days : p.replacement_guarantee_days,
      };

      // 1. If product has serialized barcodes/units: open barcode & warranty selection modal
      if (fullProduct.units && fullProduct.units.length > 0) {
        setUnitSelectProduct(fullProduct);
        return;
      }

      // 2. If product has size variations: open variation picker
      if (fullProduct.variations && fullProduct.variations.length > 0) {
        setVariantModalProduct(fullProduct);
        return;
      }

      // 3. If NO serialized barcodes: directly add to cart!
      tryAdd(fullProduct);
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
  const [unitSearch, setUnitSearch] = useState("");
  const [fashionPickProduct, setFashionPickProduct] = useState<Product | null>(null);
  const [fashionPickVariant, setFashionPickVariant] = useState<{size:string,color:string}|null>(null);

  // POS UI layout mode ("standard" vs "visual_grid")
  const [posLayout, setPosLayout] = useState<"standard" | "visual_grid">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("stockwhisk_pos_layout");
      if (saved === "visual_grid" || saved === "standard") return saved;
    }
    return "standard";
  });

  useEffect(() => {
    const backendLayout = (user as any)?.shop_pos_ui_layout || (user as any)?.shop_invoice_settings?.pos_ui_layout;
    const local = typeof window !== "undefined" ? localStorage.getItem("stockwhisk_pos_layout") : null;
    if (!local && backendLayout && (backendLayout === "standard" || backendLayout === "visual_grid")) {
      setPosLayout(backendLayout);
    }
  }, [user]);

  const togglePosLayout = (newLayout: "standard" | "visual_grid") => {
    setPosLayout(newLayout);
    try { localStorage.setItem("stockwhisk_pos_layout", newLayout); } catch {}
  };

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

  function removeLine(keyOrId: string | number) { 
    setCart((c) => c.filter((l) => (l.lineId || l.product.id) !== keyOrId && l.product.id !== keyOrId)); 
  }
  function clearCart() { 
    setCart([]); 
    setAlterationNotes("");
    setAlterationStatus("pending");
    setAlterationDueDate("");
    setTailorName("");
    setAlterationCharge(0);
    sessionStorage.removeItem("pos_cart"); 
    sessionStorage.removeItem("pos_alteration_notes");
    sessionStorage.removeItem("pos_alteration_status");
    sessionStorage.removeItem("pos_alteration_due_date");
    sessionStorage.removeItem("pos_tailor_name");
    sessionStorage.removeItem("pos_alteration_charge");
    clearCartCrashBackup(); 
  }

  function playAudioBeep(ok: boolean) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      if (ok) {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else {
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.22);
      }
    } catch {}
  }

  function flash(text: string, ok: boolean) {
    playAudioBeep(ok);
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

    // 0. Supershop EAN-13 Weight Scale In-Store Barcode auto-detection (FastAPI Sub-millisecond Decoder)
    if ((isSupershop || code.startsWith("20") || code.startsWith("02")) && /^(02|2[0-9])(\d{4,5})(\d{5})\d$/.test(code) && user?.shop) {
      try {
        const decoded = await fastapiFetch<any>(`/fastapi/pos/scale-decode/${user.shop}/${code}`);
        if (decoded && decoded.product_id) {
          const matchedPlu: any = shown.find(p => p.id === decoded.product_id) || {
            id: decoded.product_id,
            name: decoded.name,
            barcode: decoded.barcode,
            sku: decoded.sku,
            price: String(decoded.unit_price),
            base_price: String(decoded.unit_price),
            current_stock: decoded.current_stock,
            track_inventory: true,
          };
          addToCart(matchedPlu as Product, undefined, decoded.quantity);
          flash(lang === "bn" ? `⚖️ ওজনের পণ্য যোগ হয়েছে: ${decoded.name} (${decoded.quantity} কেজি)` : `⚖️ Weighed item added: ${decoded.name} (${decoded.quantity} kg)`, true);
          setQuery("");
          setTimeout(() => inputRef.current?.focus(), 50);
          return;
        }
      } catch (err) {
        // Fall back to local regex decoding
      }
    }

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

    const gridReflectsCode = debouncedQuery === code && !gridLoading;

    // 3. Exactly one filtered result → auto-add
    if (gridReflectsCode && shown.length === 1 && query === code) { tryAdd(shown[0], multiplier); return; }

    // 4. Multiple results → keep showing (let the user click one)
    if (gridReflectsCode && shown.length > 1 && query === code) return;

    // 5. No local match in currently rendered view → FastAPI/Django Lookup, or IndexedDB Offline Lookup
    setScanning(true);
    try {
      if (typeof window !== "undefined" && navigator.onLine && user?.shop) {
        try {
          const fastResults = await fastapiFetch<any[]>(`/fastapi/pos/products/${user.shop}/search?q=${encodeURIComponent(code)}&limit=5`);
          if (fastResults && fastResults.length === 1) {
            const p = fastResults[0];
            tryAdd({
              ...p,
              price: String(p.base_price),
              track_inventory: true,
            } as Product, multiplier);
            return;
          } else if (fastResults && fastResults.length > 1) {
            setPickCode(code);
            setPickProducts(fastResults.map(p => ({ ...p, price: String(p.base_price), track_inventory: true } as Product)));
            return;
          }
        } catch {
          // Fall back to Django /pos/lookup/
        }

        try {
          const res = await api<any>("/pos/lookup/", { params: { barcode: code } });
          if (res?.multiple && Array.isArray(res.products)) {
            setPickCode(code);
            setPickProducts(res.products as Product[]);
            return;
          } else if (res?.id) {
            tryAdd(res as Product, multiplier);
            return;
          }
        } catch (e: any) {
          if (e?.status === 409 || e?.data?.sold_unit) {
            flash(e?.data?.detail || t("pos_unit_sold_alert", { code }), false);
            setQuery("");
            setTimeout(() => inputRef.current?.focus(), 50);
            return;
          }
        }
      }

      // 6. Offline IndexedDB Cache Fallback
      const cached = await lookupCachedBarcode(code);
      if (cached) {
        if (cached.unit) {
          addToCart(cached.product as Product, cached.unit);
          flash(t("pos_added_unit_alert", { barcode: cached.unit.barcode }), true);
          setQuery("");
          setTimeout(() => inputRef.current?.focus(), 50);
          return;
        }
        if (cached.variation) {
          addToCart(cached.product as Product, undefined, multiplier, cached.variation);
          flash(t("pos_added_alert", { name: `${cached.product.name} (${cached.variation.name})` }), true);
          setQuery("");
          setTimeout(() => inputRef.current?.focus(), 50);
          return;
        }
        if (cached.product) {
          tryAdd(cached.product as Product, multiplier);
          return;
        }
      }

      flash(t("pos_product_not_found"), false);
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
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

    const curSubtotal = cart.reduce((s, l) => s + l.qty * l.price - l.discount, 0);
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
      product_name: l.product.name,
      barcode: l.selectedUnits[0]?.barcode || l.product.barcode,
    }));

    const activeCust = selectedCustomerId ? customers.find((c) => c.id === Number(selectedCustomerId)) : null;
    const curCustName = activeCust?.name || walkinName.trim() || (lang === "bn" ? "সাধারণ ক্রেতা" : "Walk-in Customer");
    const curCustPhone = activeCust?.phone || walkinPhone.trim() || "01700000000";
    const curCustId = activeCust?.id || undefined;

    // Helper for executing offline sale
    const executeOfflineSale = async () => {
      const offlineId = `OFF-${user?.shop || 1}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const offlineInvoice = `OFF-INV-${Date.now().toString().slice(-6)}`;
      const offlineSaleObj: OfflineSale = {
        client_offline_id: offlineId,
        offline_invoice_no: offlineInvoice,
        sale_date: new Date().toISOString(),
        customer: curCustId,
        customer_name: curCustName,
        customer_phone: curCustPhone,
        items: itemsPayload,
        payments: [{ method: "cash", amount: totalAmt }],
        paid: totalAmt,
        discount: 0,
        tax: taxAmt,
        created_at: Date.now(),
        status: "pending",
      };

      await saveOfflineSale(offlineSaleObj);
      await deductCachedStock(offlineSaleObj.items);
      await clearCartCrashBackup();

      setCart([]);
      setQuery("");
      const newCount = await getPendingOfflineSaleCount();
      setPendingSyncCount(newCount);

      flash(
        lang === "bn"
          ? `⚡ অফলাইন নগদ বিক্রয় সম্পন্ন! চালান #${offlineInvoice} (৳${totalAmt.toFixed(2)})`
          : `⚡ Offline Cash Sale Complete! #${offlineInvoice} (৳${totalAmt.toFixed(2)})`,
        true
      );

      // Print offline thermal receipt
      printOfflineReceipt(offlineSaleObj, user?.shop_name || "StockWhisk Store", (user as any)?.shop_invoice_settings);
    };

    // If browser is explicitly offline
    if (typeof window !== "undefined" && !navigator.onLine) {
      try {
        await executeOfflineSale();
      } catch (err: any) {
        toast.error(err?.message || "Offline sale recording failed.");
      } finally {
        setFastCheckingOut(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      return;
    }

    try {
      const res = await api<any>("/pos/checkout/", {
        method: "POST",
        body: {
          items: itemsPayload,
          customer: curCustId,
          customer_name: curCustName,
          customer_phone: curCustPhone,
          sale_date: new Date().toISOString(),
          tax: taxAmt,
          discount: 0,
          paid: totalAmt,
          payments: [{ method: "cash", amount: totalAmt }],
          alteration_notes: alterationNotes.trim(),
          alteration_status: alterationNotes.trim() ? alterationStatus : "",
          alteration_due_date: alterationDueDate || null,
          tailor_name: tailorName.trim(),
          alteration_charge: alterationCharge,
        },
      });

      setCart([]);
      setQuery("");
      setAlterationNotes("");
      setAlterationStatus("pending");
      setAlterationDueDate("");
      setTailorName("");
      setAlterationCharge(0);
      fetchGrid(1, true);
      await clearCartCrashBackup();

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
      // Check if network failed or server unreachable (e.g. WiFi cut mid-sale)
      const isNetError = !navigator.onLine || !err?.status || err?.status === 0 || err?.status >= 502 || String(err?.message || "").includes("fetch");
      if (isNetError) {
        setIsOnline(false);
        toast.error(lang === "bn" ? "⚠️ সার্ভার সংযোগ বিচ্ছিন্ন! অফলাইন মোডে চালান তৈরি হচ্ছে..." : "Server connection lost! Completing offline sale...");
        await executeOfflineSale();
      } else {
        toast.error(err?.message || "Fast cash checkout failed.");
      }
    } finally {
      setFastCheckingOut(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function goToCheckout() {
    sessionStorage.setItem("pos_cart", JSON.stringify(cart));
    if (selectedCustomerId) {
      sessionStorage.setItem("pos_customer_id", selectedCustomerId);
    }
    if (walkinName) sessionStorage.setItem("pos_walkin_name", walkinName);
    if (walkinPhone) sessionStorage.setItem("pos_walkin_phone", walkinPhone);
    if (alterationNotes.trim()) {
      sessionStorage.setItem("pos_alteration_notes", alterationNotes.trim());
      sessionStorage.setItem("pos_alteration_status", alterationStatus);
      sessionStorage.setItem("pos_alteration_due_date", alterationDueDate);
      sessionStorage.setItem("pos_tailor_name", tailorName.trim());
      sessionStorage.setItem("pos_alteration_charge", String(alterationCharge));
    } else {
      sessionStorage.removeItem("pos_alteration_notes");
      sessionStorage.removeItem("pos_alteration_status");
      sessionStorage.removeItem("pos_alteration_due_date");
      sessionStorage.removeItem("pos_tailor_name");
      sessionStorage.removeItem("pos_alteration_charge");
    }
    router.push("/app/pos/customer");
  }

  return (
    <ModuleRouteGuard module="core_pos" name={lang === "bn" ? "পিওএস টার্মিনাল (POS)" : "POS Terminal"}>
      <div className="row g-3">
        {/* ── Left panel ── */}
        <div className={`${posLayout === "visual_grid" ? "col-lg-8" : "col-lg-7"} d-flex flex-column gap-3`}>
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <div className="text-secondary small fw-semibold">{t("pos_step1")}</div>
              <div className="d-none d-sm-flex align-items-center gap-1">
                <span className="badge bg-light text-secondary border"><kbd className="bg-secondary text-white px-1 rounded">F2</kbd> {lang === "bn" ? "সার্চ" : "Search"}</span>
                <span className="badge bg-light text-secondary border"><kbd className="bg-secondary text-white px-1 rounded">F4</kbd> {lang === "bn" ? "চেকআউট" : "Checkout"}</span>
                {!isElectronicsShop && (
                  <span className="badge bg-light text-secondary border"><kbd className="bg-secondary text-white px-1 rounded">F12</kbd> {lang === "bn" ? "নগদ বিক্রি" : "Fast Cash"}</span>
                )}
              </div>
            </div>

            {/* Layout Switcher & Scanner Status */}
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <div className="d-inline-flex align-items-center p-0.5 bg-white border rounded-pill shadow-xs">
                <button
                  type="button"
                  className={`btn btn-sm rounded-pill px-2.5 py-1 fw-bold transition-all ${
                    posLayout === "standard"
                      ? "btn-primary text-white shadow-xs"
                      : "btn-light text-secondary border-0 bg-transparent"
                  }`}
                  style={{ fontSize: "0.78rem" }}
                  onClick={() => togglePosLayout("standard")}
                  title={lang === "bn" ? "স্ট্যান্ডার্ড পিওএস মোড" : "Standard POS Mode"}
                >
                  📋 {lang === "bn" ? "স্ট্যান্ডার্ড" : "Standard"}
                </button>
                <button
                  type="button"
                  className={`btn btn-sm rounded-pill px-2.5 py-1 fw-bold transition-all ${
                    posLayout === "visual_grid"
                      ? "btn-primary text-white shadow-xs"
                      : "btn-light text-secondary border-0 bg-transparent"
                  }`}
                  style={{ fontSize: "0.78rem" }}
                  onClick={() => togglePosLayout("visual_grid")}
                  title={lang === "bn" ? "ভিজ্যুয়াল প্রোডাক্ট গ্রিড মোড" : "Visual Product Grid Mode"}
                >
                  🛍️ {lang === "bn" ? "ভিজ্যুয়াল গ্রিড" : "Visual Grid"}
                </button>
              </div>

              {/* Online / Offline Status Badge */}
              <div className="d-flex align-items-center gap-1.5">
                {isOnline ? (
                  <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 d-inline-flex align-items-center gap-1 px-2 py-1 rounded-pill" style={{ fontSize: "0.75rem" }}>
                    <span className="d-inline-block rounded-circle bg-success" style={{ width: 6, height: 6 }}></span>
                    {lang === "bn" ? "অনলাইন" : "Online"}
                  </span>
                ) : (
                  <span className="badge bg-warning bg-opacity-20 text-dark border border-warning d-inline-flex align-items-center gap-1 px-2 py-1 rounded-pill" style={{ fontSize: "0.75rem" }}>
                    <span className="d-inline-block rounded-circle bg-danger" style={{ width: 6, height: 6 }}></span>
                    {lang === "bn" ? "⚠️ অফলাইন মোড" : "⚠️ Offline"}
                  </span>
                )}

                {/* Pending Offline Sync Button */}
                {pendingSyncCount > 0 && (
                  <button
                    type="button"
                    className="btn btn-warning btn-sm py-0.5 px-2.5 rounded-pill fw-bold text-dark d-inline-flex align-items-center gap-1 shadow-xs"
                    disabled={isSyncing || !isOnline}
                    onClick={triggerAutoSync}
                    title={lang === "bn" ? "সার্ভারে সিঙ্ক করুন" : "Sync offline sales to server"}
                    style={{ fontSize: "0.75rem" }}
                  >
                    <span>🔄</span>
                    <span>{pendingSyncCount} {lang === "bn" ? "টি সিঙ্ক বাকি" : "Pending Sync"}</span>
                    {isSyncing && <span className="spinner-border spinner-border-sm" style={{ width: "0.7rem", height: "0.7rem" }} />}
                  </button>
                )}
              </div>

              <div className="small fw-semibold d-flex align-items-center gap-1 ms-1">
                <span className={`d-inline-block rounded-circle ${scannerConnected ? 'bg-success' : 'bg-secondary'}`} style={{ width: 8, height: 8 }}></span>
                <span className={scannerConnected ? 'text-success' : 'text-secondary'} style={{ fontSize: "0.78rem" }}>
                  {scannerConnected ? "Scanner" : "Ready"}
                </span>
              </div>
            </div>
          </div>

          {/* Sudden Power Outage / Interrupted Cart Recovery Banner */}
          {crashBackupFound && (
            <div className="alert alert-warning border border-warning d-flex align-items-center justify-content-between p-2.5 px-3 rounded-3 shadow-xs mb-1" style={{ backgroundColor: "#fefce8" }}>
              <div className="d-flex align-items-center gap-2">
                <span className="fs-5">⚡</span>
                <div>
                  <strong className="text-dark d-block" style={{ fontSize: "0.88rem" }}>
                    {lang === "bn" ? "বিদ্যুৎ চলে যাওয়ার পূর্বের অসমাপ্ত কার্ট পাওয়া গেছে!" : "Interrupted Cart Detected!"}
                  </strong>
                  <div className="text-secondary" style={{ fontSize: "0.78rem" }}>
                    {lang === "bn"
                      ? `${crashBackupFound.cart.length}টি পণ্য (৳${crashBackupFound.cart.reduce((s, l) => s + l.qty * l.price - l.discount, 0).toFixed(2)}) সংরক্ষিত রয়েছে।`
                      : `${crashBackupFound.cart.length} item(s) preserved from your previous session.`}
                  </div>
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-primary fw-bold px-3 py-1 rounded-pill shadow-xs"
                  style={{ fontSize: "0.8rem" }}
                  onClick={() => {
                    setCart(crashBackupFound.cart);
                    if (crashBackupFound.customerId) setSelectedCustomerId(crashBackupFound.customerId);
                    if (crashBackupFound.walkinName) setWalkinName(crashBackupFound.walkinName);
                    if (crashBackupFound.walkinPhone) setWalkinPhone(crashBackupFound.walkinPhone);
                    setCrashBackupFound(null);
                    toast.success(lang === "bn" ? "কার্ট সফলভাবে পুনরুদ্ধার করা হয়েছে!" : "Cart restored!");
                  }}
                >
                  {lang === "bn" ? "কার্ট রিস্টোর করুন" : "Restore Cart"}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary py-1 px-2.5 rounded-pill"
                  style={{ fontSize: "0.8rem" }}
                  onClick={async () => {
                    await clearCartCrashBackup();
                    setCrashBackupFound(null);
                  }}
                >
                  {lang === "bn" ? "বাতিল" : "Dismiss"}
                </button>
              </div>
            </div>
          )}

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

              {/* Instant Search Suggestions with Price & Available Stock */}
              {query.trim().length > 0 && shown.length > 0 && (
                <div className="mt-2.5 border rounded-3 p-2 bg-white shadow-sm" style={{ maxHeight: "290px", overflowY: "auto" }}>
                  <div className="d-flex justify-content-between align-items-center px-2 py-1 mb-1 border-bottom">
                    <span className="small fw-bold text-dark">
                      🔍 {lang === "bn" ? "অনুসন্ধান ফলাফল" : "Search Results"} ({shown.length})
                    </span>
                    <span className="small text-muted" style={{ fontSize: "0.72rem" }}>
                      {lang === "bn" ? "ক্লিক করে কার্টে যোগ করুন" : "Click item to add to cart"}
                    </span>
                  </div>
                  <div className="d-flex flex-column gap-1">
                    {shown.slice(0, 10).map((p) => {
                      const availStock = Number(p.current_stock || 0);
                      const baseUnit = p.unit_detail?.short_code || p.unit_detail?.name || (lang === "bn" ? "টি" : "pcs");
                      return (
                        <div
                          key={p.id}
                          className="d-flex align-items-center justify-content-between p-2 rounded-2 border"
                          style={{ cursor: "pointer", transition: "all 0.15s ease", backgroundColor: "#f8fafc" }}
                          onClick={() => pickFromGrid(p)}
                        >
                          <div className="d-flex align-items-center gap-2 overflow-hidden me-2">
                            {p.image_url || p.image ? (
                              <img src={p.image_url || p.image || ""} alt="" className="rounded border flex-shrink-0" style={{ width: 38, height: 38, objectFit: "cover" }} />
                            ) : (
                              <div className="rounded border bg-light text-secondary d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 38, height: 38, fontSize: "1.1rem" }}>
                                📦
                              </div>
                            )}
                            <div className="overflow-hidden">
                              <div className="fw-bold text-dark small text-truncate">{p.name}</div>
                              <div className="text-secondary small font-monospace" style={{ fontSize: "0.68rem" }}>
                                {p.barcode ? `🏷️ ${p.barcode}` : (p.sku ? `SKU: ${p.sku}` : "—")}
                              </div>
                            </div>
                          </div>

                          <div className="d-flex align-items-center gap-2 flex-shrink-0 text-end">
                            {/* Stock Quantity */}
                            <span
                              className={`badge rounded-pill fw-bold border px-2 py-1 ${availStock > 0 ? "bg-success-subtle text-success border-success-subtle" : "bg-danger-subtle text-danger border-danger-subtle"}`}
                              style={{ fontSize: "0.75rem" }}
                            >
                              {availStock > 0 ? `🟢 স্টক: ${availStock} ${baseUnit}` : "🔴 স্টক শেষ"}
                            </span>

                            {/* Product Selling Price */}
                            <span className="fw-bolder fs-6 text-primary px-1">
                              {money(p.selling_price)}
                            </span>

                            <button
                              type="button"
                              className="btn btn-primary btn-sm py-0.5 px-2.5 rounded-pill fw-semibold"
                              style={{ fontSize: "0.75rem" }}
                              onClick={(e) => { e.stopPropagation(); pickFromGrid(p); }}
                            >
                              + যোগ
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          

          {posLayout === "visual_grid" ? (
            /* ══════════════════════════════════════════════════════════════════════
               VISUAL PRODUCT GRID POS MODE
               Large visual product cards, in-stock badges, serialized barcode/warranty
               direct click flow.
               ══════════════════════════════════════════════════════════════════════ */
            <div className="d-flex flex-column gap-3">
              {/* Category Pills & Brand Selector */}
              <div className="card shadow-xs border-0 bg-white rounded-3 p-3">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2.5">
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <span className="badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1.5 rounded-pill fw-semibold" style={{ fontSize: "0.78rem" }}>
                      🟢 {lang === "bn" ? `স্টকে উপলব্ধ: ${shown.length} টি পণ্য` : `Available: ${shown.length} products`}
                    </span>
                    {selectedCategory && (
                      <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 rounded-pill d-flex align-items-center gap-1" style={{ fontSize: "0.76rem" }}>
                        <span>{categories.find(c => c.id === selectedCategory)?.name || "Category"}</span>
                        <button type="button" className="btn-close ms-1" style={{ fontSize: "0.55rem" }} onClick={() => setSelectedCategory(null)} />
                      </span>
                    )}
                  </div>

                  {brands.length > 0 && (
                    <div className="d-flex align-items-center gap-1">
                      <select
                        className="form-select form-select-sm rounded-pill"
                        style={{ fontSize: "0.8rem", maxWidth: 170 }}
                        value={selectedBrand || ""}
                        onChange={(e) => setSelectedBrand(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">{lang === "bn" ? "🏷️ সকল ব্র্যান্ড" : "All Brands"}</option>
                        {brands.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Horizontal Scrollable Category Pills */}
                {categories.length > 0 && (
                  <div className="d-flex align-items-center gap-1.5 overflow-auto pb-1" style={{ whiteSpace: "nowrap", scrollbarWidth: "thin" }}>
                    <button
                      type="button"
                      className={`btn btn-sm rounded-pill px-3 py-1 fw-bold transition-all ${selectedCategory === null ? "btn-dark text-white shadow-xs" : "btn-light text-secondary border bg-white"}`}
                      style={{ fontSize: "0.8rem", flexShrink: 0 }}
                      onClick={() => setSelectedCategory(null)}
                    >
                      ✨ {lang === "bn" ? "সকল পণ্য" : "All Items"}
                    </button>
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`btn btn-sm rounded-pill px-3 py-1 fw-bold transition-all ${selectedCategory === c.id ? "btn-primary text-white shadow-xs" : "btn-light text-secondary border bg-white"}`}
                        style={{ fontSize: "0.8rem", flexShrink: 0 }}
                        onClick={() => setSelectedCategory(selectedCategory === c.id ? null : c.id)}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Visual Product Grid */}
              {shown.length === 0 && !gridLoading ? (
                <div className="card shadow-xs border-0 bg-white rounded-3 py-5 text-center">
                  <div className="fs-1 mb-2">🔍</div>
                  <h6 className="fw-bold text-dark">{lang === "bn" ? "কোনো পণ্য পাওয়া যায়নি" : "No products found"}</h6>
                  <p className="text-secondary small mb-3">
                    {query ? `"${query}" এর সাথে মিলছে না।` : (lang === "bn" ? "বর্তমানে এই ক্যাটাগরিতে কোনো স্টক উপলব্ধ নেই।" : "No in-stock products available.")}
                  </p>
                  {(query || selectedCategory || selectedBrand) && (
                    <div>
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm rounded-pill px-3"
                        onClick={() => { setQuery(""); setSelectedCategory(null); setSelectedBrand(null); }}
                      >
                        {lang === "bn" ? "ফিল্টার রিসেট করুন" : "Reset Filters"}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div 
                  className="row g-3" 
                  style={{ maxHeight: "74vh", overflowY: "auto", paddingBottom: "2rem" }}
                  onScroll={onGridScroll}
                >
                  {shown.map((p) => {
                    const cartItem = cart.find(l => l.product.id === p.id);
                    const inCartQty = cartItem ? cartItem.qty : 0;
                    const hasSerializedUnits = (p.in_stock_units_count && p.in_stock_units_count > 0) || (p.units && p.units.length > 0);
                    const isLoadingThis = unitLoadingId === p.id;

                    return (
                      <div key={p.id} className="col-6 col-sm-4 col-md-4 col-xl-3">
                        <div
                          className={`card h-100 rounded-3 border transition-all position-relative overflow-hidden ${
                            inCartQty > 0 ? "border-primary shadow-sm" : "border-slate-200 bg-white hover:border-slate-400 hover:shadow-xs"
                          }`}
                          style={{ 
                            cursor: "pointer",
                            transition: "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
                          }}
                          onClick={() => pickFromGrid(p)}
                        >
                          {/* Cart Badge if in cart */}
                          {inCartQty > 0 && (
                            <div
                              className="position-absolute top-0 end-0 m-2 badge bg-primary text-white rounded-pill px-2 py-1 shadow-xs fw-bold"
                              style={{ zIndex: 3, fontSize: "0.72rem" }}
                            >
                              ✓ {inCartQty} {lang === "bn" ? "কার্টে" : "in cart"}
                            </div>
                          )}

                          {/* Stock & Serial Badge */}
                          <div className="position-absolute top-0 start-0 m-2 d-flex flex-column gap-1" style={{ zIndex: 3 }}>
                            <span 
                              className={`badge ${Number(p.current_stock) > 0 ? "bg-success text-white" : "bg-danger text-white"} rounded-pill shadow-xs fw-semibold`}
                              style={{ fontSize: "0.68rem" }}
                            >
                              {Number(p.current_stock) > 0 ? `🟢 ${p.current_stock} টি` : "🔴 স্টক শেষ"}
                            </span>
                            {hasSerializedUnits && (
                              <span 
                                className="badge bg-warning text-dark border border-warning-subtle rounded-pill shadow-xs fw-bold"
                                style={{ fontSize: "0.65rem" }}
                              >
                                🏷️ বারকোড
                              </span>
                            )}
                            {!!p.warranty_months && (
                              <span 
                                className="badge bg-dark bg-opacity-75 text-white rounded-pill shadow-xs fw-semibold"
                                style={{ fontSize: "0.65rem" }}
                              >
                                🛡️ {p.warranty_months}ম
                              </span>
                            )}
                          </div>

                          {/* Image Container */}
                          <div 
                            className="bg-light d-flex align-items-center justify-content-center position-relative"
                            style={{ height: 135, width: "100%", overflow: "hidden" }}
                          >
                            {isLoadingThis ? (
                              <div className="spinner-border spinner-border-sm text-primary" role="status" />
                            ) : p.image || p.image_url ? (
                              <img 
                                src={p.image_url || p.image || undefined} 
                                alt={p.name} 
                                className="w-100 h-100 object-cover transition-all"
                                style={{ transition: "transform 0.3s ease" }}
                                loading="lazy"
                              />
                            ) : (
                              <div className="text-secondary opacity-50 display-6">
                                📦
                              </div>
                            )}
                          </div>

                          {/* Card Content */}
                          <div className="card-body p-2.5 d-flex flex-column justify-content-between">
                            <div>
                              {p.category_name && (
                                <div className="text-secondary text-uppercase fw-semibold" style={{ fontSize: "0.65rem", letterSpacing: "0.5px" }}>
                                  {p.category_name}
                                </div>
                              )}
                              <h6 
                                className="fw-bold text-dark mb-1 text-truncate-2" 
                                style={{ 
                                  fontSize: "0.85rem", 
                                  lineHeight: "1.25", 
                                  minHeight: "2.4rem",
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden"
                                }}
                                title={p.name}
                              >
                                {p.name}
                              </h6>
                              <div className="font-monospace text-secondary" style={{ fontSize: "0.7rem" }}>
                                {p.barcode ? `🏷️ ${p.barcode}` : (p.sku ? `SKU: ${p.sku}` : "—")}
                              </div>
                            </div>

                            <div className="mt-2 pt-1 border-top d-flex align-items-center justify-content-between">
                              <div>
                                <div className="fw-bold text-primary fs-6" style={{ letterSpacing: "-0.3px" }}>
                                  {money(p.selling_price)}
                                </div>
                              </div>
                              <div>
                                {hasSerializedUnits ? (
                                  <span className="btn btn-outline-primary btn-sm py-0.5 px-2 rounded-pill fw-semibold" style={{ fontSize: "0.72rem" }}>
                                    🏷️ বাছুন
                                  </span>
                                ) : (
                                  <span className="btn btn-primary btn-sm py-0.5 px-2 rounded-pill fw-semibold" style={{ fontSize: "0.72rem" }}>
                                    + যোগ
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div>
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

                  <div className="d-flex align-items-center gap-1.5">
                    {selectedFashionProduct && (
                      <button
                        type="button"
                        className="btn btn-info text-white btn-sm py-1 px-2.5 fw-bold rounded-pill shadow-xs"
                        style={{ fontSize: "11px" }}
                        onClick={() => setShowSizeGuideModal(true)}
                        title="পোশাকের সাইজ চার্ট ও মেজারমেন্ট গাইড দেখুন"
                      >
                        📏 {lang === "bn" ? "সাইজ গাইড" : "Size Guide"}
                      </button>
                    )}

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
              </div>

              {/* ── STEP 1: CATEGORY CARDS ── */}
              {!selectedCategory && !query.trim() && (
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
              {((selectedCategory && !selectedFashionProduct) || (!selectedCategory && query.trim().length > 0)) && (
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <h6 className="fw-bold text-dark mb-0">
                      <span>{selectedCategory ? `${categories.find(c => c.id === selectedCategory)?.name} — ডিজাইন ও সাইজ তালিকা:` : `"${query.trim()}" এর ফলাফল — ডিজাইন ও সাইজ তালিকা:`}</span>
                    </h6>
                    {selectedCategory ? (
                      <button type="button" className="btn btn-outline-secondary btn-sm py-1 px-3 rounded-pill" onClick={() => setSelectedCategory(null)}>
                        ← ক্যাটাগরি পরিবর্তন
                      </button>
                    ) : (
                      <button type="button" className="btn btn-outline-secondary btn-sm py-1 px-3 rounded-pill" onClick={() => setQuery("")}>
                        ✕ ক্লিয়ার ফিল্টার
                      </button>
                    )}
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
                        const brandName = p.brand_name || brands.find((b) => b.id === p.brand)?.name || "";
                        const cartItem = cart.find((l) => l.product.id === p.id);
                        return (
                          <div className="col-6 col-md-4" key={p.id}>
                            <button
                              type="button"
                              className={`pos-item w-100 p-2.5 text-start rounded-3 ${inCart ? "pos-item-active" : ""}`}
                              disabled={out || busy}
                              onClick={() => pickFromGrid(p)}
                            >
                              {brandName && (
                                <div className="mb-1">
                                  <span
                                    className="badge px-1.5 py-0.5"
                                    style={{
                                      fontSize: "0.65rem",
                                      backgroundColor: "#eff6ff",
                                      color: "#1d4ed8",
                                      border: "1px solid #bfdbfe",
                                      fontWeight: 600,
                                    }}
                                  >
                                    🏷️ {brandName}
                                  </span>
                                </div>
                              )}
                              <div className="fw-bold text-truncate" style={{ fontSize: "0.88rem", color: "#0f172a" }}>
                                {formatProductName(p, isRepairShop)}
                              </div>
                              <div style={{ fontSize: ".72rem", fontFamily: "monospace", color: "#64748b" }}>
                                {p.sku || p.barcode || "—"}
                              </div>
                              <div className="d-flex justify-content-between align-items-center mt-2 pt-1 border-top" style={{ borderColor: inCart ? "#dbeafe" : "#f1f5f9" }}>
                                <div>
                                  <span className="fw-bolder" style={{ fontSize: "0.95rem", color: inCart ? "#1d4ed8" : "#0f172a" }}>
                                    {money(p.selling_price)}
                                  </span>
                                  {baseUnit ? <span className="text-secondary" style={{ fontSize: "0.7rem" }}>/{baseUnit}</span> : null}
                                </div>
                                <span
                                  className="badge border px-1.5 py-0.5 fw-bold"
                                  style={{
                                    fontSize: "0.68rem",
                                    backgroundColor: out ? "#fef2f2" : inCart ? "#eff6ff" : "#f0fdf4",
                                    color: out ? "#dc2626" : inCart ? "#1d4ed8" : "#166534",
                                    borderColor: out ? "#fecaca" : inCart ? "#bfdbfe" : "#bbf7d0",
                                  }}
                                >
                                  {busy ? (
                                    <span className="spinner-border spinner-border-sm" role="status" />
                                  ) : out ? (
                                    t("pos_out")
                                  ) : inCart ? (
                                    `✓ ×${cartItem?.qty}`
                                  ) : (
                                    `${lang === "bn" ? "স্টক:" : "Stock:"} ${Math.round(Number(p.current_stock) * 100) / 100} ${baseUnit || (lang === "bn" ? "পিস" : "pcs")}`
                                  )}
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
              {/* ── View Switcher Toolbar & Result Count ── */}
              <div className="d-flex align-items-center justify-content-between mb-2.5">
                <div className="small text-secondary fw-semibold">
                  {query ? (
                    shown.length > 0 ? (
                      shown.length > 1 ? t("pos_products_found_plural", { count: shown.length }) : t("pos_products_found_singular")
                    ) : (
                      t("pos_no_match")
                    )
                  ) : (
                    <span>
                      {shown.length} {lang === "bn" ? "পণ্য প্রদর্শিত" : "products listed"}
                    </span>
                  )}
                </div>

                <div className="btn-group btn-group-sm bg-white rounded-pill p-1 border shadow-xs" role="group">
                  <button
                    type="button"
                    className={`btn btn-sm rounded-pill px-2.5 py-1 fw-semibold d-flex align-items-center gap-1.5 ${
                      viewMode === "grid" ? "btn-primary text-white shadow-xs" : "btn-light text-secondary border-0"
                    }`}
                    onClick={() => toggleViewMode("grid")}
                    title={lang === "bn" ? "ছবিসহ বড় কার্ড ভিউ" : "Visual Picture Cards View"}
                  >
                    <span>🎴</span>
                    <span className="small">{lang === "bn" ? "ছবি কার্ড" : "Grid Cards"}</span>
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm rounded-pill px-2.5 py-1 fw-semibold d-flex align-items-center gap-1.5 ${
                      viewMode === "table" ? "btn-primary text-white shadow-xs" : "btn-light text-secondary border-0"
                    }`}
                    onClick={() => toggleViewMode("table")}
                    title={lang === "bn" ? "কম্প্যাক্ট তালিকা ভিউ" : "Compact Table View"}
                  >
                    <span>📋</span>
                    <span className="small">{lang === "bn" ? "তালিকা" : "Table"}</span>
                  </button>
                </div>
              </div>

              {shown.length === 0 && query && !gridLoading ? (
                <div className="card shadow-sm">
                  <div className="card-body text-center py-4 text-secondary small">
                    {t("pos_no_barcode_match")} "<strong>{query}</strong>"
                    <div className="mt-2">
                      {t("pos_press_enter")}
                    </div>
                  </div>
                </div>
              ) : viewMode === "grid" ? (
                /* ── Visual Picture Cards Grid ── */
                <div className="row g-2.5" style={{ maxHeight: "56vh", overflowY: "auto" }} onScroll={onGridScroll}>
                  {shown.map((p) => {
                    const baseUnit = p.unit_detail?.short_code || p.unit_detail?.name || "";
                    const out = Number(p.current_stock) <= 0;
                    const cartItem = cart.find((l) => l.product.id === p.id);
                    const inCart = !!cartItem;
                    const exactMatch = query.trim() !== "" && p.barcode === query.trim();
                    const busy = unitLoadingId === p.id;
                    const brandName = p.brand_name || brands.find((b) => b.id === p.brand)?.name || "";

                    return (
                      <div className="col-6 col-sm-4 col-md-4 col-xl-3" key={p.id}>
                        <div
                          onClick={() => { if (!out && !busy) pickFromGrid(p); }}
                          className={`card h-100 transition-all cursor-pointer user-select-none position-relative overflow-hidden ${
                            out ? "opacity-60 grayscale cursor-not-allowed" : ""
                          }`}
                          style={{
                            borderRadius: "14px",
                            backgroundColor: inCart ? "#f8faff" : "#ffffff",
                            borderColor: inCart ? "#2563eb" : exactMatch ? "#2563eb" : "#e2e8f0",
                            borderWidth: inCart || exactMatch ? "2px" : "1px",
                            borderStyle: "solid",
                            boxShadow: inCart
                              ? "0 4px 14px -1px rgba(37, 99, 235, 0.16), 0 2px 6px -1px rgba(37, 99, 235, 0.08)"
                              : exactMatch
                              ? "0 0 0 2px rgba(37, 99, 235, 0.25), 0 2px 6px rgba(0, 0, 0, 0.04)"
                              : "0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04)",
                            transition: "all 0.15s ease-in-out",
                          }}
                        >
                          {/* In-cart counter badge overlay */}
                          {inCart && (
                            <div
                              className="position-absolute top-2 end-2 d-flex align-items-center gap-1 shadow-sm"
                              style={{
                                zIndex: 4,
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                backgroundColor: "#0f172a",
                                color: "#ffffff",
                                borderRadius: "20px",
                                padding: "3px 9px",
                                letterSpacing: "0.2px",
                                boxShadow: "0 2px 8px rgba(15, 23, 42, 0.25)",
                                border: "1.5px solid #ffffff",
                              }}
                            >
                              <span style={{ color: "#38bdf8", fontSize: "0.75rem" }}>●</span>
                              <span>{cartItem?.qty} {lang === "bn" ? "কার্টে" : "in cart"}</span>
                            </div>
                          )}

                          {/* Product Picture Container */}
                          <div
                            className="w-100 d-flex align-items-center justify-content-center overflow-hidden position-relative border-bottom"
                            style={{
                              height: 110,
                              backgroundColor: inCart ? "#f0f6ff" : "#f8fafc",
                              borderColor: inCart ? "#dbeafe" : "#f1f5f9",
                            }}
                          >
                            {p.image || p.image_url ? (
                              <img
                                src={p.image_url || p.image || ""}
                                alt={p.name}
                                className="w-100 h-100 object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="d-flex flex-column align-items-center justify-content-center">
                                <svg
                                  width="34"
                                  height="34"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke={inCart ? "#3b82f6" : "#94a3b8"}
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                                </svg>
                              </div>
                            )}
                            {busy && (
                              <div className="position-absolute inset-0 bg-white bg-opacity-75 d-flex align-items-center justify-content-center">
                                <span className="spinner-border spinner-border-sm text-primary" role="status" />
                              </div>
                            )}
                          </div>

                          {/* Product Card Body */}
                          <div className="p-2.5 d-flex flex-column justify-content-between flex-grow-1" style={{ backgroundColor: inCart ? "#f8faff" : "#ffffff" }}>
                            <div>
                              {/* Brand Badge */}
                              {brandName && (
                                <div className="d-flex align-items-center justify-content-between gap-1 mb-1">
                                  <span
                                    className="badge px-1.5 py-0.5 text-truncate"
                                    style={{
                                      fontSize: "0.68rem",
                                      maxWidth: "100%",
                                      backgroundColor: "#eff6ff",
                                      color: "#1d4ed8",
                                      border: "1px solid #bfdbfe",
                                      fontWeight: 600,
                                    }}
                                    title={brandName}
                                  >
                                    🏷️ {brandName}
                                  </span>
                                  {p.category_name && (
                                    <span className="text-secondary text-truncate small" style={{ fontSize: "0.65rem", maxWidth: "45%" }}>
                                      {p.category_name}
                                    </span>
                                  )}
                                </div>
                              )}

                              <div
                                className="fw-bold"
                                style={{
                                  fontSize: "0.85rem",
                                  lineHeight: "1.25",
                                  minHeight: brandName ? "auto" : "2.1rem",
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                  color: "#0f172a",
                                }}
                                title={brandName ? `${brandName} - ${p.name}` : p.name}
                              >
                                {p.name}
                              </div>
                              <div className="d-flex align-items-center justify-content-between mt-1.5 pt-0.5" style={{ fontSize: "0.72rem" }}>
                                <span className="text-secondary font-monospace text-truncate" style={{ maxWidth: "52%" }}>
                                  {p.barcode || p.sku || "—"}
                                </span>
                                {out ? (
                                  <span
                                    className="badge border px-1.5 py-0.5 fw-bold"
                                    style={{
                                      fontSize: "0.72rem",
                                      backgroundColor: "#fef2f2",
                                      color: "#dc2626",
                                      borderColor: "#fecaca",
                                    }}
                                  >
                                    {t("pos_out")}
                                  </span>
                                ) : (
                                  <span
                                    className="badge border px-1.5 py-0.5 fw-bold"
                                    style={{
                                      fontSize: "0.72rem",
                                      backgroundColor: "#f0fdf4",
                                      color: "#166534",
                                      borderColor: "#bbf7d0",
                                    }}
                                    title={`স্টক: ${p.current_stock} ${baseUnit || "pcs"}`}
                                  >
                                    {lang === "bn"
                                      ? `স্টক: ${Math.round(Number(p.current_stock) * 100) / 100} ${baseUnit || "পিস"}`
                                      : `Stock: ${Math.round(Number(p.current_stock) * 100) / 100} ${baseUnit || "pcs"}`}
                                  </span>
                                )}
                              </div>
                              {p.variations && p.variations.length > 0 && (
                                <div className="mt-1">
                                  <span className="badge rounded-pill" style={{ backgroundColor: "#f3e8ff", color: "#7c3aed", border: "1px solid #d8b4fe", fontSize: "10px", padding: "2px 6px" }}>
                                    👗 {p.variations.length} ভেরিয়েন্ট
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="d-flex align-items-baseline justify-content-between mt-2 pt-1 border-top" style={{ borderColor: inCart ? "#dbeafe" : "#f1f5f9" }}>
                              <span className="fw-bolder fs-6" style={{ letterSpacing: "-0.3px", color: inCart ? "#1d4ed8" : "#0f172a" }}>
                                {money(p.selling_price)}
                              </span>
                              {inCart ? (
                                <span className="badge px-1.5 py-0.5 rounded-pill" style={{ fontSize: "0.68rem", backgroundColor: "#dbeafe", color: "#1d4ed8", fontWeight: 600 }}>
                                  + আরও যোগ করুন
                                </span>
                              ) : (
                                <span className="text-secondary small" style={{ fontSize: "0.68rem" }}>
                                  + যোগ করুন
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* ── Compact Table / List View ── */
                <div className="row g-2" style={{ maxHeight: "52vh", overflowY: "auto" }} onScroll={onGridScroll}>
                  {shown.map((p) => {
                    const baseUnit = p.unit_detail?.short_code || p.unit_detail?.name || "";
                    const out = Number(p.current_stock) <= 0;
                    const inCart = cart.some((l) => l.product.id === p.id);
                    const exactMatch = query.trim() !== "" && p.barcode === query.trim();
                    const busy = unitLoadingId === p.id;
                    const brandName = p.brand_name || brands.find((b) => b.id === p.brand)?.name || "";
                    const isSelectedInCart = inCart;
                    return (
                      <div className="col-6 col-md-4" key={p.id}>
                        <button
                          type="button"
                          className="pos-item w-100 p-2.5 text-start rounded-3 position-relative"
                          style={{
                            backgroundColor: isSelectedInCart ? "#f8faff" : "#ffffff",
                            borderColor: isSelectedInCart ? "#2563eb" : exactMatch ? "#2563eb" : "#e2e8f0",
                            borderWidth: isSelectedInCart || exactMatch ? "2px" : "1px",
                            boxShadow: isSelectedInCart
                              ? "0 4px 14px -1px rgba(37, 99, 235, 0.16), 0 2px 6px -1px rgba(37, 99, 235, 0.08)"
                              : exactMatch
                              ? "0 0 0 2px rgba(37, 99, 235, 0.25)"
                              : "0 1px 3px rgba(0,0,0,0.04)",
                          }}
                          disabled={out || busy}
                          onClick={() => pickFromGrid(p)}
                        >
                          {isSelectedInCart && (
                            <div
                              className="position-absolute top-2 end-2 d-flex align-items-center gap-1 shadow-sm"
                              style={{
                                zIndex: 3,
                                fontSize: "0.68rem",
                                fontWeight: 700,
                                backgroundColor: "#0f172a",
                                color: "#ffffff",
                                borderRadius: "20px",
                                padding: "2px 7px",
                                letterSpacing: "0.2px",
                              }}
                            >
                              <span style={{ color: "#38bdf8", fontSize: "0.7rem" }}>●</span>
                              <span>{cart.find((l) => l.product.id === p.id)?.qty} {lang === "bn" ? "কার্টে" : "in cart"}</span>
                            </div>
                          )}
                          <div className="d-flex align-items-center gap-2">
                            {p.image || p.image_url ? (
                              <img
                                src={p.image_url || p.image || ""}
                                alt={p.name}
                                className="rounded-2 border border-slate-200 object-cover flex-shrink-0"
                                style={{ width: 36, height: 36, objectFit: "cover" }}
                              />
                            ) : (
                              <div
                                className="rounded-2 border border-slate-200 bg-slate-100 text-slate-400 d-flex align-items-center justify-content-center flex-shrink-0"
                                style={{ width: 36, height: 36, fontSize: "1rem" }}
                              >
                                📦
                              </div>
                            )}
                            <div className="overflow-hidden flex-grow-1">
                              <div className="small fw-semibold text-truncate d-flex align-items-center gap-1">
                                {brandName && (
                                  <span
                                    className="badge px-1 py-0.5 flex-shrink-0"
                                    style={{
                                      fontSize: "0.65rem",
                                      backgroundColor: "#eff6ff",
                                      color: "#1d4ed8",
                                      border: "1px solid #bfdbfe",
                                      fontWeight: 600,
                                    }}
                                  >
                                    {brandName}
                                  </span>
                                )}
                                <span className="text-truncate" title={brandName ? `${brandName} - ${p.name}` : p.name}>
                                  {p.name}
                                </span>
                              </div>
                              <div style={{ fontSize: ".7rem", fontFamily: "monospace", color: exactMatch ? "var(--brand-700,#1a73e8)" : "#94a3b8" }}>
                                {p.barcode || p.sku}
                              </div>
                            </div>
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
                            <span
                              className="badge border px-1.5 py-0.5 fw-bold"
                              style={{
                                fontSize: "0.68rem",
                                backgroundColor: out ? "#fef2f2" : inCart ? "#eff6ff" : "#f0fdf4",
                                color: out ? "#dc2626" : inCart ? "#1d4ed8" : "#166534",
                                borderColor: out ? "#fecaca" : inCart ? "#bfdbfe" : "#bbf7d0",
                              }}
                            >
                              {busy ? (
                                <span className="spinner-border spinner-border-sm" role="status" />
                              ) : out ? (
                                t("pos_out")
                              ) : inCart ? (
                                `✓ ×${cart.find((l) => l.product.id === p.id)?.qty}`
                              ) : (
                                `${lang === "bn" ? "স্টক:" : "Stock:"} ${Math.round(Number(p.current_stock) * 100) / 100} ${baseUnit || (lang === "bn" ? "পিস" : "pcs")}`
                              )}
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
        )}
        </div>

        {/* ── Cart ── */}
        <div id="pos-cart-panel" className={`${posLayout === "visual_grid" ? "col-lg-4" : "col-lg-5"}`}>
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
                {isFashionShop && (
                  <>
                    <button
                      type="button"
                      className="btn btn-xs py-0 px-2 fw-semibold rounded-pill btn-outline-primary"
                      style={{ fontSize: "0.75rem" }}
                      onClick={() => setShowSizeGuideModal(true)}
                      title="সাইজ মেজারমেন্ট গাইড"
                    >
                      📏 {lang === "bn" ? "সাইজ গাইড" : "Size Guide"}
                    </button>
                    <button
                      type="button"
                      className={`btn btn-xs py-0 px-2 fw-semibold rounded-pill ${alterationNotes.trim() ? "btn-info text-white shadow-xs" : "btn-outline-info"}`}
                      style={{ fontSize: "0.75rem" }}
                      onClick={() => setShowAlterationModal(true)}
                      title="পোশাক অল্টারেশন / ফিটিং নোট"
                    >
                      ✂️ {alterationNotes.trim() ? (lang === "bn" ? "ফিটিং যুক্ত" : "Fitting Added") : (lang === "bn" ? "অল্টারেশন" : "Alteration")}
                    </button>
                  </>
                )}
                {cart.length > 0 && (
                  <button className="btn btn-link btn-sm text-danger p-0 ms-1" onClick={clearCart}>{t("pos_clear")}</button>
                )}
              </div>
            </div>
            <div className="card-body p-0">
              <div style={{ maxHeight: "52vh", overflowY: "auto" }}>
                <table className="table table-sm align-middle mb-0">
                  <thead className="table-light border-bottom sticky-top" style={{ zIndex: 2 }}>
                    <tr style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase" }}>
                      <th className="ps-3 py-2">{t("pos_cart_product") || "পণ্য ও স্টক"}</th>
                      <th className="text-center py-2" style={{ width: "5.5rem" }}>{lang === "bn" ? "মূল্য" : "Price"}</th>
                      <th className="text-center py-2" style={{ width: "5.5rem" }}>{t("pos_cart_qty") || "পরিমাণ"}</th>
                      <th className="text-end py-2" style={{ width: "5.5rem" }}>{t("pos_cart_total") || "মোট"}</th>
                      <th style={{ width: "1.8rem" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-secondary text-center py-5 px-3">
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
                        <tr key={l.lineId || l.product.id}>
                          <td className="ps-3">
                            {(() => {
                              const lineBrand = l.product.brand_name || brands.find((b) => b.id === l.product.brand)?.name || "";
                              return (
                                <div className="small fw-semibold d-flex align-items-center gap-1">
                                  {lineBrand && (
                                    <span
                                      className="badge px-1 py-0.5 flex-shrink-0"
                                      style={{
                                        fontSize: "0.65rem",
                                        backgroundColor: "#eff6ff",
                                        color: "#1d4ed8",
                                        border: "1px solid #bfdbfe",
                                      }}
                                    >
                                      {lineBrand}
                                    </span>
                                  )}
                                  <span>{l.product.name}</span>
                                </div>
                              );
                            })()}
                            
                            {((l.product as any)._selectedVariant || l.selectedVariation) && (
                              <div className="d-flex align-items-center gap-1 my-0.5">
                                <span className="badge border" style={{ fontSize: "0.72rem", background: "#f3e8ff", color: "#6b21a8", borderColor: "#d8b4fe" }}>
                                  👗 {(l.product as any)._selectedVariant?.size || l.selectedVariation?.attributes?.size || l.selectedVariation?.name}
                                  {((l.product as any)._selectedVariant?.color || l.selectedVariation?.attributes?.color) ? (" / " + ((l.product as any)._selectedVariant?.color || l.selectedVariation?.attributes?.color)) : ""}
                                </span>
                              </div>
                            )}

                            {/* Available Stock Indicator */}
                            {(() => {
                              const vInfo = (l.product as any)._selectedVariant || l.selectedVariation;
                              const availStock = vInfo ? Number(vInfo.current_stock ?? l.product.current_stock ?? 0) : Number(l.product.current_stock ?? 0);
                              const isOut = availStock <= 0;
                              const isOver = l.qty > availStock && availStock > 0;
                              return (
                                <div className="d-flex align-items-center gap-1.5 my-1 flex-wrap">
                                  <span
                                    className={`badge border px-2 py-0.5 fw-bold rounded-pill ${
                                      isOut
                                        ? "bg-danger-subtle text-danger border-danger-subtle"
                                        : isOver
                                        ? "bg-warning-subtle text-warning-emphasis border-warning-subtle"
                                        : "bg-success-subtle text-success border-success-subtle"
                                    }`}
                                    style={{ fontSize: "0.68rem" }}
                                    title={`বর্তমান স্টকে উপলব্ধ: ${availStock} ${baseUnit || "টি"}`}
                                  >
                                    {isOut ? "🔴 স্টক শেষ (০ টি)" : isOver ? `⚠️ স্টকে আছে ${availStock} ${baseUnit || "টি"} (কার্টে বেশি)` : `🟢 স্টকে আছে: ${availStock} ${baseUnit || "টি"}`}
                                  </span>
                                </div>
                              );
                            })()}

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
                          <td className="text-center" style={{ width: "5.5rem" }}>
                            <div className="fw-bolder text-dark" style={{ fontSize: "0.88rem", letterSpacing: "-0.2px" }}>
                              {money(l.price)}
                            </div>
                            <div className="text-secondary" style={{ fontSize: "0.65rem" }}>
                              {l.sellMode === "bulk" ? `/${bulkUnit}` : (baseUnit ? `/${baseUnit}` : (lang === "bn" ? "/টি" : "/pc"))}
                            </div>
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
                                  onWheel={(e) => e.currentTarget.blur()}
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
                {/* ── Customer Quick Selector ── */}
                <div className="mb-2.5 p-2 rounded-3 bg-light border border-slate-200 shadow-2xs">
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <span className="small fw-bold text-dark" style={{ fontSize: "0.75rem" }}>
                      👤 {lang === "bn" ? "ক্রেতা (Quick Customer)" : "Quick Customer"}
                    </span>
                    {selectedCustomerId && (
                      <button
                        type="button"
                        className="btn btn-link btn-xs p-0 text-danger text-decoration-none fw-semibold"
                        onClick={() => { setSelectedCustomerId(""); setWalkinName(""); setWalkinPhone(""); }}
                      >
                        ✕ রিসেট
                      </button>
                    )}
                  </div>
                  <select
                    className="form-select form-select-sm mb-1.5"
                    style={{ fontSize: "0.8rem" }}
                    value={selectedCustomerId}
                    onChange={(e) => {
                      setSelectedCustomerId(e.target.value);
                      if (e.target.value) {
                        const c = customers.find(item => item.id === Number(e.target.value));
                        if (c) {
                          setWalkinName(c.name);
                          setWalkinPhone(c.phone || "");
                        }
                      } else {
                        setWalkinName("");
                        setWalkinPhone("");
                      }
                    }}
                  >
                    <option value="">👤 {lang === "bn" ? "সাধারণ ওয়াক-ইন ক্রেতা (Walk-in)" : "Walk-in Customer"}</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ""}
                      </option>
                    ))}
                  </select>
                  {!selectedCustomerId && (
                    <div className="row g-1">
                      <div className="col-6">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          style={{ fontSize: "0.75rem" }}
                          placeholder={lang === "bn" ? "নাম (ঐচ্ছিক)" : "Name (opt)"}
                          value={walkinName}
                          onChange={(e) => setWalkinName(e.target.value)}
                        />
                      </div>
                      <div className="col-6">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          style={{ fontSize: "0.75rem" }}
                          placeholder={lang === "bn" ? "মোবাইল নম্বর" : "Phone number"}
                          value={walkinPhone}
                          onChange={(e) => setWalkinPhone(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {alterationNotes.trim() && (
                  <div className="alert alert-info py-2 px-3 mb-2 rounded border-info d-flex align-items-center justify-content-between" style={{ fontSize: "0.8rem" }}>
                    <div>
                      <div className="fw-bold text-info-emphasis d-flex align-items-center gap-1">
                        <span>✂️ {lang === "bn" ? "অল্টারেশন / ফিটিং নোট:" : "Alteration Note:"}</span>
                        <span className="badge bg-info text-dark ms-1">{alterationStatus}</span>
                      </div>
                      <div className="text-dark small mt-0.5">{alterationNotes}</div>
                      {(tailorName || alterationDueDate) && (
                        <div className="text-secondary small mt-0.5" style={{ fontSize: "0.72rem" }}>
                          {tailorName && <span>দর্জি: {tailorName} </span>}
                          {alterationDueDate && <span>| ডেলিভারি: {alterationDueDate}</span>}
                        </div>
                      )}
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      {alterationCharge > 0 && <span className="fw-bold text-success">+৳{alterationCharge}</span>}
                      <button
                        type="button"
                        className="btn btn-link btn-xs text-danger p-0"
                        title="রিমুভ করুন"
                        onClick={() => {
                          setAlterationNotes("");
                          setTailorName("");
                          setAlterationDueDate("");
                          setAlterationCharge(0);
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}

                <div className="d-flex justify-content-between small mb-1">
                  <span className="text-secondary">{t("pos_subtotal")}</span>
                  <span>{money(subtotal)}</span>
                </div>
                {alterationCharge > 0 && (
                  <div className="d-flex justify-content-between small mb-1 text-info-emphasis">
                    <span>✂️ {lang === "bn" ? "অল্টারেশন চার্জ" : "Alteration Fee"}</span>
                    <span>+{money(alterationCharge)}</span>
                  </div>
                )}
                <div className="d-flex justify-content-between fw-bold mb-3">
                  <span>{t("pos_total")}</span>
                  <span className="text-primary fs-6">{money(subtotal + (alterationCharge || 0))}</span>
                </div>

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
                      <span>⚡ {lang === "bn" ? "নগদ পে (F12)" : "Fast Cash (F12)"}</span>
                    )}
                  </button>

                  <button
                    type="button"
                    className="btn btn-brand flex-grow-1 py-2 fw-semibold shadow-sm"
                    disabled={cart.length === 0 || fastCheckingOut}
                    onClick={goToCheckout}
                    title="Press F4 for customer & details checkout"
                  >
                    {t("pos_continue")} (F4) →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile Floating Bottom Cart Bar (Thumb Zone UX) ── */}
      {cart.length > 0 && (
        <div
          className="d-lg-none position-fixed start-0 end-0 bottom-0 p-3 bg-white border-top shadow-lg"
          style={{ zIndex: 1040 }}
        >
          <div className="d-flex align-items-center justify-content-between gap-2">
            <div
              style={{ cursor: "pointer" }}
              onClick={() => {
                document.getElementById("pos-cart-panel")?.scrollIntoView({ behavior: "smooth" });
              }}
              title={lang === "bn" ? "কার্ট দেখতে ট্যাপ করুন" : "Tap to view cart"}
            >
              <div className="text-secondary small fw-medium">
                🛒 {cart.reduce((s, l) => s + l.qty, 0)} {lang === "bn" ? "টি পণ্য (কার্ট দেখুন)" : "items (view cart)"}
              </div>
              <div className="fs-5 fw-bold text-dark">
                {money(subtotal)}
              </div>
            </div>
            <div className="d-flex gap-2">
              {!isElectronicsShop && (
                <button
                  type="button"
                  className="btn btn-success fw-bold py-2 px-3 shadow-sm d-flex align-items-center gap-1"
                  disabled={fastCheckingOut}
                  onClick={doFastCashCheckout}
                >
                  {fastCheckingOut ? (
                    <span className="spinner-border spinner-border-sm" />
                  ) : (
                    <span>⚡ {lang === "bn" ? "ক্যাশ" : "Cash"}</span>
                  )}
                </button>
              )}
              <button
                type="button"
                className="btn btn-brand fw-bold py-2 px-3 shadow-sm d-flex align-items-center gap-1"
                onClick={goToCheckout}
              >
                <span>{lang === "bn" ? "চেকআউট" : "Checkout"} →</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
        <div className="modal d-block" style={{ background: "rgba(15,23,42,0.65)", zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
            <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden">
              <div className="modal-header bg-light py-3 px-4 border-bottom">
                <div className="d-flex align-items-center gap-3">
                  <div 
                    className="rounded-3 bg-white border d-flex align-items-center justify-content-center shadow-xs overflow-hidden"
                    style={{ width: 48, height: 48, flexShrink: 0 }}
                  >
                    {unitSelectProduct.image || unitSelectProduct.image_url ? (
                      <img src={unitSelectProduct.image_url || unitSelectProduct.image || undefined} alt="" className="w-100 h-100 object-cover" />
                    ) : (
                      <span className="fs-4">📦</span>
                    )}
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-dark mb-0">{unitSelectProduct.name}</h5>
                    <div className="d-flex align-items-center gap-2 mt-1 flex-wrap">
                      <span className="badge bg-primary-subtle text-primary border border-primary-subtle" style={{ fontSize: "0.72rem" }}>
                        {lang === "bn" ? "বারকোড ও সিরিয়াল নির্বাচন" : "Select Serial / Barcode"}
                      </span>
                      {!!unitSelectProduct.warranty_months && (
                        <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle" style={{ fontSize: "0.72rem" }}>
                          🛡️ {lang === "bn" ? `${unitSelectProduct.warranty_months} মাস অফিসিয়াল ওয়ারেন্টি` : `${unitSelectProduct.warranty_months} Mo Warranty`}
                        </span>
                      )}
                      {!!unitSelectProduct.replacement_guarantee_days && (
                        <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle" style={{ fontSize: "0.72rem" }}>
                          🔄 {lang === "bn" ? `${unitSelectProduct.replacement_guarantee_days} দিন রিপ্লেসমেন্ট গ্যারান্টি` : `${unitSelectProduct.replacement_guarantee_days}d Replacement`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button className="btn-close" onClick={() => { setUnitSelectProduct(null); setTimeout(() => inputRef.current?.focus(), 50); }} />
              </div>
              
              <div className="modal-body p-4">
                <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                  <div className="small text-secondary fw-semibold">
                    {lang === "bn"
                      ? `স্টকে উপলব্ধ বারকোড তালিকা (${unitSelectProduct.units?.length || 0} টি ইউনিট):`
                      : `Available Barcodes in Stock (${unitSelectProduct.units?.length || 0} units):`}
                  </div>
                  <div className="small fw-bold text-dark">
                    {lang === "bn" ? "মূল্য: " : "Price: "} 
                    <span className="text-primary">{money(unitSelectProduct.selling_price)}</span>
                  </div>
                </div>

                {/* Live Barcode Search Filter */}
                <div className="input-group input-group-sm mb-3">
                  <span className="input-group-text bg-white border-end-0">🔍</span>
                  <input
                    type="text"
                    className="form-control border-start-0"
                    placeholder={lang === "bn" ? "বারকোড নাম্বার দিয়ে খুঁজুন..." : "Filter barcode or serial number..."}
                    value={unitSearch}
                    onChange={(e) => setUnitSearch(e.target.value)}
                  />
                  {unitSearch && (
                    <button className="btn btn-outline-secondary" onClick={() => setUnitSearch("")}>✕</button>
                  )}
                </div>

                <div className="d-flex flex-column gap-2" style={{ maxHeight: "45vh", overflowY: "auto" }}>
                  {unitSelectProduct.units
                    ?.filter((u) => !unitSearch.trim() || u.barcode.toLowerCase().includes(unitSearch.trim().toLowerCase()))
                    .map((u) => {
                      const line = cart.find(l => l.product.id === unitSelectProduct.id);
                      const isSelected = line?.selectedUnits.some(su => su.id === u.id);
                      const warrantyMo = u.effective_warranty_months || unitSelectProduct.warranty_months;
                      const replaceDays = u.effective_replacement_guarantee_days || unitSelectProduct.replacement_guarantee_days;
                      const unitPrice = u.effective_selling_price || unitSelectProduct.selling_price || 0;

                      return (
                        <div
                          key={u.id}
                          className={`p-3 border rounded-3 transition-all d-flex align-items-center justify-content-between ${
                            isSelected ? "border-primary bg-primary bg-opacity-10 shadow-xs" : "border-slate-200 bg-white"
                          }`}
                          style={{ cursor: "pointer" }}
                          onClick={() => {
                            if (isSelected) {
                              setCart(c => {
                                const newC = [...c];
                                const idx = newC.findIndex(l => l.product.id === unitSelectProduct.id);
                                if (idx >= 0) {
                                  const ex = newC[idx];
                                  const updatedUnits = ex.selectedUnits.filter(su => su.id !== u.id);
                                  if (updatedUnits.length === 0 && ex.qty <= 1) {
                                    return newC.filter(l => l.product.id !== unitSelectProduct.id);
                                  }
                                  newC[idx] = { ...ex, qty: Math.max(1, ex.qty - 1), selectedUnits: updatedUnits };
                                }
                                return newC;
                              });
                            } else {
                              addToCart(unitSelectProduct, u);
                            }
                          }}
                        >
                          <div className="d-flex align-items-center gap-3">
                            <input
                              type="checkbox"
                              className="form-check-input m-0"
                              checked={!!isSelected}
                              readOnly
                              style={{ cursor: "pointer", width: 18, height: 18 }}
                            />
                            <div>
                              <div className="font-monospace fw-bold text-dark d-flex align-items-center gap-2">
                                <span>🏷️ {u.barcode}</span>
                                <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: "0.68rem" }}>
                                  {lang === "bn" ? "ইন-স্টক" : "In Stock"}
                                </span>
                              </div>
                              <div className="d-flex align-items-center gap-2 mt-1 flex-wrap">
                                {!!warrantyMo && (
                                  <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle" style={{ fontSize: "0.72rem" }}>
                                    🛡️ {warrantyMo} {lang === "bn" ? "মাস ওয়ারেন্টি" : "Mo Warranty"}
                                  </span>
                                )}
                                {!!replaceDays && (
                                  <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle" style={{ fontSize: "0.72rem" }}>
                                    🔄 {replaceDays} {lang === "bn" ? "দিন রিপ্লেসমেন্ট" : "d Replacement"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-end">
                            <div className="fw-bold text-dark fs-6">{money(unitPrice)}</div>
                            <div className="mt-1">
                              {isSelected ? (
                                <span className="badge bg-success text-white py-1 px-2.5 rounded-pill fw-semibold" style={{ fontSize: "0.75rem" }}>
                                  ✓ {lang === "bn" ? "কার্টে যুক্ত" : "In Cart"}
                                </span>
                              ) : (
                                <span className="badge bg-primary text-white py-1 px-2.5 rounded-pill fw-semibold" style={{ fontSize: "0.75rem" }}>
                                  + {lang === "bn" ? "যোগ করুন" : "Add"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="modal-footer bg-light py-2 px-4 d-flex align-items-center justify-content-between">
                <div className="small fw-bold text-primary">
                  {lang === "bn" ? "নির্বাচিত বারকোড সংখ্যা: " : "Selected Barcodes: "}
                  <span className="badge bg-primary text-white rounded-pill ms-1">
                    {cart.find(l => l.product.id === unitSelectProduct.id)?.selectedUnits.length || 0}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-primary px-4 fw-bold rounded-pill"
                  onClick={() => { setUnitSelectProduct(null); setTimeout(() => inputRef.current?.focus(), 50); }}
                >
                  ✓ {lang === "bn" ? "সম্পন্ন (Done)" : "Done"}
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
                          {(() => {
                            const pBrand = p.brand_name || brands.find((b) => b.id === p.brand)?.name || "";
                            return (
                              <div className="fw-semibold d-flex align-items-center gap-1">
                                {pBrand && (
                                  <span
                                    className="badge px-1 py-0.5"
                                    style={{
                                      fontSize: "0.65rem",
                                      backgroundColor: "#eff6ff",
                                      color: "#1d4ed8",
                                      border: "1px solid #bfdbfe",
                                    }}
                                  >
                                    {pBrand}
                                  </span>
                                )}
                                <span>{p.name}</span>
                              </div>
                            );
                          })()}
                          <div className="small text-secondary">
                            {p.sku ? t("pos_pick_sku", { sku: p.sku }) : t("pos_pick_barcode", { barcode: pickCode })}
                          </div>
                        </div>
                        <div className="text-end">
                          <div className="fw-semibold">{money(p.selling_price || 0)}</div>
                          <div className={`small ${oos ? "text-danger fw-bold" : "text-success fw-bold"}`}>
                            {oos ? t("pos_pick_out_of_stock") : `${lang === "bn" ? "স্টক:" : "Stock:"} ${p.current_stock}`}
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
      {/* ── Fashion Alteration Modal ── */}
      {showAlterationModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1055 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header bg-info-subtle border-0 py-2.5">
                <h5 className="modal-title fs-6 fw-bold text-info-emphasis d-flex align-items-center gap-2">
                  <span>✂️</span>
                  <span>{lang === "bn" ? "পোশাক অল্টারেশন ও ফিটিং নির্দেশনা" : "Garment Alteration & Fitting Instructions"}</span>
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowAlterationModal(false)} />
              </div>
              <div className="modal-body p-3">
                <div className="mb-2">
                  <label className="form-label small fw-semibold text-secondary mb-1">
                    {lang === "bn" ? "দ্রুত ফিটিং নির্দেশনাবলী (ট্যাপ করে যুক্ত করুন):" : "Quick Fitting Presets (tap to add):"}
                  </label>
                  <div className="d-flex flex-wrap gap-1">
                    {[
                      "হাতা ১ ইঞ্চি কাটা",
                      "হাতা ২ ইঞ্চি কাটা",
                      "ঝুল ১.৫ ইঞ্চি কাটা",
                      "কোমর ২ ইঞ্চি চাপা",
                      "হাতার মোহরা লুজ করা",
                      "বোতাম পরিবর্তন",
                      "কলার স্টিচিং",
                      "প্যান্টের বটম ন্যারো করা",
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className="btn btn-outline-secondary btn-xs py-1 px-2 rounded-pill"
                        style={{ fontSize: "0.75rem" }}
                        onClick={() => {
                          setAlterationNotes((prev) => (prev ? `${prev}, ${preset}` : preset));
                        }}
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold text-secondary mb-1">
                    {lang === "bn" ? "ফিটিং / অল্টারেশন নোট (বিস্তারিত):" : "Alteration Instructions (detailed):"}
                  </label>
                  <textarea
                    rows={3}
                    className="form-control form-control-sm"
                    placeholder={lang === "bn" ? "যেমন: হাতা ১ ইঞ্চি ছোট করতে হবে, কোমর ফিটিং..." : "e.g. shorten sleeves by 1 inch, waist fitting..."}
                    value={alterationNotes}
                    onChange={(e) => setAlterationNotes(e.target.value)}
                  />
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label small fw-semibold text-secondary mb-1">
                      {lang === "bn" ? "দর্জি / মাস্টারের নাম:" : "Tailor / Master Name:"}
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder={lang === "bn" ? "যেমন: রফিক টেইলার" : "e.g. Master Rafiq"}
                      value={tailorName}
                      onChange={(e) => setTailorName(e.target.value)}
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label small fw-semibold text-secondary mb-1">
                      {lang === "bn" ? "ডেলিভারির তারিখ:" : "Due Date / Ready By:"}
                    </label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={alterationDueDate}
                      onChange={(e) => setAlterationDueDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="row g-2">
                  <div className="col-6">
                    <label className="form-label small fw-semibold text-secondary mb-1">
                      {lang === "bn" ? "কাজের বর্তমান স্ট্যাটাস:" : "Alteration Status:"}
                    </label>
                    <select
                      className="form-select form-select-sm"
                      value={alterationStatus}
                      onChange={(e) => setAlterationStatus(e.target.value)}
                    >
                      <option value="pending">{lang === "bn" ? "অপেক্ষমান (Pending)" : "Pending"}</option>
                      <option value="in_progress">{lang === "bn" ? "চলমান (In Progress)" : "In Progress"}</option>
                      <option value="ready">{lang === "bn" ? "রেডি (Ready for Pickup)" : "Ready for Pickup"}</option>
                      <option value="delivered">{lang === "bn" ? "ডেলিভার্ড (Delivered)" : "Delivered"}</option>
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label small fw-semibold text-secondary mb-1">
                      {lang === "bn" ? "অল্টারেশন ফি / চার্জ (৳):" : "Fitting Fee (৳):"}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="form-control form-control-sm"
                      placeholder="0.00"
                      value={alterationCharge || ""}
                      onChange={(e) => setAlterationCharge(Number(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer border-0 py-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger me-auto"
                  onClick={() => {
                    setAlterationNotes("");
                    setTailorName("");
                    setAlterationDueDate("");
                    setAlterationCharge(0);
                    setShowAlterationModal(false);
                  }}
                >
                  {lang === "bn" ? "বাদ দিন (Remove)" : "Remove"}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-info text-white px-3"
                  onClick={() => setShowAlterationModal(false)}
                >
                  {lang === "bn" ? "সংরক্ষণ করুন (Save)" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Garment Size Chart / Measurement Guide Modal ── */}
      {showSizeGuideModal && selectedFashionProduct && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1056 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header bg-light border-0 py-2.5">
                <div>
                  <h5 className="modal-title fs-6 fw-bold text-dark d-flex align-items-center gap-2">
                    <span>📏</span>
                    <span>{lang === "bn" ? `সাইজ মেজারমেন্ট গাইড: ${selectedFashionProduct.name}` : `Size Guide: ${selectedFashionProduct.name}`}</span>
                  </h5>
                  <div className="text-secondary small">
                    {lang === "bn" ? "ইউনিট: ইঞ্চি (Inches) • পরিমাপ চার্ট ও গ্রাহকের ফিটিং সহায়িকা" : "Unit: Inches • Garment fitting measurement reference"}
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setShowSizeGuideModal(false)} />
              </div>
              <div className="modal-body p-3">
                {(() => {
                  const chart = selectedFashionProduct.size_chart;
                  const hasCustom = chart && chart.measurements && Array.isArray(chart.measurements) && chart.measurements.length > 0;
                  
                  const defaultChart = [
                    { size: "S / 38", chest: "38\"", length: "39\"", waist: "36\"", shoulder: "17.5\"" },
                    { size: "M / 40", chest: "40\"", length: "40\"", waist: "38\"", shoulder: "18\"" },
                    { size: "L / 42", chest: "42\"", length: "41\"", waist: "40\"", shoulder: "18.5\"" },
                    { size: "XL / 44", chest: "44\"", length: "42\"", waist: "42\"", shoulder: "19\"" },
                    { size: "XXL / 46", chest: "46\"", length: "43\"", waist: "44\"", shoulder: "19.5\"" },
                  ];

                  const rows = (hasCustom && chart?.measurements) ? chart.measurements : defaultChart;

                  return (
                    <div>
                      {!hasCustom && (
                        <div className="alert alert-secondary py-1.5 px-3 small mb-2 d-flex align-items-center gap-1.5" style={{ fontSize: "0.78rem" }}>
                          <span>ℹ️</span>
                          <span>{lang === "bn" ? "এই পণ্যের নির্দিষ্ট সাইজ চার্ট সংযুক্ত নেই। নিচে স্ট্যান্ডার্ড ফ্যাশন সাইজ গাইড প্রদর্শন করা হচ্ছে:" : "Displaying standard apparel reference guide:"}</span>
                        </div>
                      )}

                      <div className="table-responsive rounded border">
                        <table className="table table-sm table-bordered text-center align-middle mb-0">
                          <thead className="table-dark small">
                            <tr>
                              <th>সাইজ (Size)</th>
                              <th>বুক / চেস্ট (Chest)</th>
                              <th>ঝুল / দৈর্ঘ্য (Length)</th>
                              <th>কোমর (Waist)</th>
                              <th>কাঁধ (Shoulder)</th>
                              <th>উপযুক্ত শারীরিক পরিমাপ</th>
                            </tr>
                          </thead>
                          <tbody className="small">
                            {rows.map((r: any, idx: number) => {
                              const isCur = selectedFashionSize && (r.size.toLowerCase().includes(selectedFashionSize.toLowerCase()) || selectedFashionSize.toLowerCase().includes(r.size.toLowerCase()));
                              return (
                                <tr key={idx} className={isCur ? "table-warning fw-bold" : ""}>
                                  <td className="fw-bold font-monospace text-primary">
                                    {r.size} {isCur && <span className="badge bg-warning text-dark ms-1">নির্বাচিত</span>}
                                  </td>
                                  <td>{r.chest || "—"}</td>
                                  <td>{r.length || "—"}</td>
                                  <td>{r.waist || "—"}</td>
                                  <td>{r.shoulder || "—"}</td>
                                  <td className="text-secondary small">
                                    {isCur ? "★ গ্রাহকের জন্য পারফেক্ট সাইজ" : "রেগুলার ফিট"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-3 p-2 bg-light rounded text-secondary small d-flex align-items-start gap-2" style={{ fontSize: "0.75rem" }}>
                        <span className="fs-6">💡</span>
                        <div>
                          <strong>{lang === "bn" ? "ক্যাশিয়ার ফিটিং টিপস:" : "Cashier Fitting Tips:"}</strong>
                          <div className="mt-0.5">
                            {lang === "bn"
                              ? "পাঞ্জাবি ও শার্টের ক্ষেত্রে সঠিক ফিটিং নিশ্চিত করতে গ্রাহকের চেস্টের প্রকৃত মাপের সাথে অতিরিক্ত ২-৩ ইঞ্চি লুজ এলাউন্স (Ease Allowance) যোগ করতে হয়।"
                              : "Always allow 2-3 inches ease over exact body chest circumference for comfortable regular fit."}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="modal-footer py-2 border-0">
                <button type="button" className="btn btn-sm btn-secondary px-3" onClick={() => setShowSizeGuideModal(false)}>
                  {lang === "bn" ? "বন্ধ করুন" : "Close"}
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
    </ModuleRouteGuard>
  );
}
