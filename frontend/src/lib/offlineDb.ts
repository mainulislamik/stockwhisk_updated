/**
 * StockWhisk Offline-First IndexedDB Engine
 * Handles client-side catalog caching, offline checkout queuing, 
 * atomic local stock deductions, and cart crash recovery for power outages.
 */

const DB_NAME = "stockwhisk_pos_offline";
const DB_VERSION = 1;

export interface OfflineSaleItem {
  product: number;
  quantity: number;
  unit_price: number;
  discount?: number;
  unit_ids?: number[];
  variation?: number;
  size_variant?: any;
  product_name?: string;
  barcode?: string;
}

export interface OfflineSale {
  client_offline_id: string;
  offline_invoice_no: string;
  sale_date: string;
  customer?: number;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
  items: OfflineSaleItem[];
  payments: Array<{ method: string; amount: number }>;
  paid: number;
  discount: number;
  tax: number;
  note?: string;
  created_at: number;
  status: "pending" | "synced" | "failed";
  error_message?: string;
  synced_invoice_no?: string;
  synced_sale_id?: number;
}

export interface CartBackup {
  cart: any[];
  customerId?: string;
  walkinName?: string;
  walkinPhone?: string;
  savedAt: number;
}

let dbInstance: IDBDatabase | null = null;

export function isIndexedDBAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

export function openOfflineDb(): Promise<IDBDatabase> {
  if (!isIndexedDBAvailable()) {
    return Promise.reject(new Error("IndexedDB is not available in this environment"));
  }

  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Catalog Store
      if (!db.objectStoreNames.contains("catalog")) {
        const catalogStore = db.createObjectStore("catalog", { keyPath: "id" });
        catalogStore.createIndex("barcode", "barcode", { unique: false });
        catalogStore.createIndex("sku", "sku", { unique: false });
        catalogStore.createIndex("category_id", "category_id", { unique: false });
        catalogStore.createIndex("brand_id", "brand_id", { unique: false });
      }

      // 2. Offline Sales Queue Store
      if (!db.objectStoreNames.contains("offline_sales")) {
        const salesStore = db.createObjectStore("offline_sales", { keyPath: "client_offline_id" });
        salesStore.createIndex("status", "status", { unique: false });
        salesStore.createIndex("created_at", "created_at", { unique: false });
      }

      // 3. Crash Recovery Store (Power outage recovery)
      if (!db.objectStoreNames.contains("crash_recovery")) {
        db.createObjectStore("crash_recovery", { keyPath: "key" });
      }

      // 4. Metadata Store
      if (!db.objectStoreNames.contains("metadata")) {
        db.createObjectStore("metadata", { keyPath: "key" });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

/**
 * Cache full catalog in IndexedDB for instant offline search & scanning
 */
export async function cacheCatalog(products: any[], shopId?: number | null): Promise<void> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["catalog", "metadata"], "readwrite");
    const catalogStore = tx.objectStore("catalog");
    const metaStore = tx.objectStore("metadata");

    // Clear existing cached products
    catalogStore.clear();

    // Batch insert fresh products
    for (const p of products) {
      catalogStore.put(p);
    }

    metaStore.put({
      key: "catalog_sync_info",
      shopId,
      lastSyncedAt: Date.now(),
      count: products.length,
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Retrieve cached catalog products from IndexedDB
 */
export async function getCachedCatalog(): Promise<any[]> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("catalog", "readonly");
    const store = tx.objectStore("catalog");
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieve a single cached product by ID from IndexedDB
 */
export async function getCachedProduct(id: number): Promise<any | null> {
  const db = await openOfflineDb();
  return new Promise((resolve) => {
    const tx = db.transaction("catalog", "readonly");
    const store = tx.objectStore("catalog");
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

/**
 * Instant local search in cached catalog
 */
export async function searchCachedCatalog(
  query: string = "",
  categoryId?: number | null,
  brandId?: number | null
): Promise<any[]> {
  const all = await getCachedCatalog();
  const q = query.trim().toLowerCase();

  return all.filter((p) => {
    // Inventory filter: only show in-stock products
    if (p.track_inventory && Number(p.current_stock) <= 0) {
      return false;
    }

    // Category filter
    if (categoryId && p.category_id !== categoryId) {
      return false;
    }

    // Brand filter
    if (brandId && p.brand_id !== brandId) {
      return false;
    }

    if (!q) return true;

    // Search matches
    const nameMatch = (p.name || "").toLowerCase().includes(q);
    const skuMatch = (p.sku || "").toLowerCase().includes(q);
    const barcodeMatch = (p.barcode || "").toLowerCase().includes(q);
    const unitMatch = (p.units || []).some((u: any) => (u.barcode || "").toLowerCase().includes(q));
    const varMatch = (p.variations || []).some(
      (v: any) => (v.name || "").toLowerCase().includes(q) || (v.barcode || "").toLowerCase().includes(q)
    );

    return nameMatch || skuMatch || barcodeMatch || unitMatch || varMatch;
  });
}

/**
 * Instant local barcode lookup for offline scanning
 */
export async function lookupCachedBarcode(
  code: string
): Promise<{ product?: any; unit?: any; variation?: any } | null> {
  const all = await getCachedCatalog();
  const cleanCode = code.trim().toLowerCase();

  for (const p of all) {
    // 1. Check direct product barcode or SKU
    if (
      (p.barcode && p.barcode.toLowerCase() === cleanCode) ||
      (p.sku && p.sku.toLowerCase() === cleanCode)
    ) {
      return { product: p };
    }

    // 2. Check serialized units (ProductUnit)
    if (p.units && Array.isArray(p.units)) {
      const matchedUnit = p.units.find((u: any) => (u.barcode || "").toLowerCase() === cleanCode);
      if (matchedUnit) {
        return { product: p, unit: matchedUnit };
      }
    }

    // 3. Check variations
    if (p.variations && Array.isArray(p.variations)) {
      const matchedVar = p.variations.find((v: any) => (v.barcode || "").toLowerCase() === cleanCode);
      if (matchedVar) {
        return { product: p, variation: matchedVar };
      }
    }
  }

  return null;
}

/**
 * Deduct stock locally in IndexedDB cache to prevent overselling while offline
 */
export async function deductCachedStock(items: OfflineSaleItem[]): Promise<void> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("catalog", "readwrite");
    const store = tx.objectStore("catalog");

    for (const item of items) {
      const req = store.get(item.product);
      req.onsuccess = () => {
        const prod = req.result;
        if (prod) {
          if (prod.track_inventory) {
            const cur = Number(prod.current_stock || 0);
            prod.current_stock = String(Math.max(0, cur - item.quantity));
          }
          // If serialized units were sold, remove them from available units
          if (item.unit_ids && item.unit_ids.length > 0 && Array.isArray(prod.units)) {
            prod.units = prod.units.filter((u: any) => !item.unit_ids?.includes(u.id));
            prod.in_stock_units_count = prod.units.length;
          }
          store.put(prod);
        }
      };
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Queue a new sale made during offline mode
 */
export async function saveOfflineSale(sale: OfflineSale): Promise<void> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline_sales", "readwrite");
    const store = tx.objectStore("offline_sales");
    store.put(sale);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get all pending offline sales that need to be synced to cloud
 */
export async function getPendingOfflineSales(): Promise<OfflineSale[]> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline_sales", "readonly");
    const store = tx.objectStore("offline_sales");
    const request = store.getAll();

    request.onsuccess = () => {
      const all: OfflineSale[] = request.result || [];
      const pending = all.filter((s) => s.status === "pending");
      resolve(pending);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Count total pending offline sales
 */
export async function getPendingOfflineSaleCount(): Promise<number> {
  const pending = await getPendingOfflineSales();
  return pending.length;
}

/**
 * Mark offline sales as successfully synced to backend
 */
export async function markOfflineSalesSynced(
  syncedList: Array<{ client_offline_id: string; invoice_no?: string; id?: number }>
): Promise<void> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline_sales", "readwrite");
    const store = tx.objectStore("offline_sales");

    for (const syn of syncedList) {
      const req = store.get(syn.client_offline_id);
      req.onsuccess = () => {
        const item: OfflineSale = req.result;
        if (item) {
          item.status = "synced";
          item.synced_invoice_no = syn.invoice_no;
          item.synced_sale_id = syn.id;
          store.put(item);
        }
      };
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Power Cut & Crash Protection: save active cart state in IndexedDB and LocalStorage
 */
export async function saveCartCrashBackup(backup: CartBackup): Promise<void> {
  try {
    localStorage.setItem("stockwhisk_pos_cart_backup", JSON.stringify(backup));
  } catch {}

  try {
    const db = await openOfflineDb();
    const tx = db.transaction("crash_recovery", "readwrite");
    const store = tx.objectStore("crash_recovery");
    store.put({ key: "active_cart_backup", ...backup });
  } catch {}
}

/**
 * Retrieve saved cart backup after power outage / browser crash
 */
export async function getCartCrashBackup(): Promise<CartBackup | null> {
  // Try localStorage first (immediate sync)
  try {
    const local = localStorage.getItem("stockwhisk_pos_cart_backup");
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && Array.isArray(parsed.cart) && parsed.cart.length > 0) {
        return parsed;
      }
    }
  } catch {}

  // Fallback to IndexedDB
  try {
    const db = await openOfflineDb();
    return new Promise((resolve) => {
      const tx = db.transaction("crash_recovery", "readonly");
      const store = tx.objectStore("crash_recovery");
      const req = store.get("active_cart_backup");
      req.onsuccess = () => {
        if (req.result && Array.isArray(req.result.cart) && req.result.cart.length > 0) {
          resolve(req.result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Clear cart crash backup once sale is completed or user discards it
 */
export async function clearCartCrashBackup(): Promise<void> {
  try {
    localStorage.removeItem("stockwhisk_pos_cart_backup");
  } catch {}

  try {
    const db = await openOfflineDb();
    const tx = db.transaction("crash_recovery", "readwrite");
    tx.objectStore("crash_recovery").delete("active_cart_backup");
  } catch {}
}
