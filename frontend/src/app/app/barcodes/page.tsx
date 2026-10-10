"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import Barcode from "react-barcode";
import { api, Paginated } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/contexts/LanguageContext";
import { Spinner, ErrorState, money } from "@/components/ui";
import toast from "react-hot-toast";

type ProductUnit = {
  id: number;
  barcode: string;
  status: string;
  selling_price?: string;
  warranty_months?: number;
};

type Product = {
  id: number;
  name: string;
  sku: string;
  barcode: string;
  selling_price: string;
  warranty_months?: number;
  current_stock: string | number;
  category?: any;
  brand?: any;
  fabric_material?: string;
  gender_target?: string;
  season?: string;
  style_type?: string;
  fit_type?: string;
  collection_name?: string;
  care_instructions?: string;
  size_variants?: { size: string; color?: string; stock?: number }[];
  units?: ProductUnit[];
};

type PrintLabelItem = {
  id: string;
  productId: number;
  productName: string;
  barcode: string;
  sku: string;
  price: string;
  warrantyMonths?: number;
  shopName: string;
  isUnit?: boolean;
  fabric?: string;
  fit?: string;
  collection?: string;
  care?: string;
  size?: string;
  color?: string;
};

export default function BarcodesGeneratorPage() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const shopPrefix = (user?.shop_barcode_prefix || "").toUpperCase();
  const shopName = user?.shop_name || "StockWhisk";

  // Tab State: "products" (Table), "all_barcodes" (Visual Hub), "generator" (Blank)
  const [activeTab, setActiveTab] = useState<"products" | "all_barcodes" | "generator">("all_barcodes");

  // Visual Hub View Mode: "grid" or "list"
  const [visualViewMode, setVisualViewMode] = useState<"grid" | "list">("grid");

  // Server-side Products Data & Pagination
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [totalCount, setTotalCount] = useState(0);

  // Label Customization Settings
  const [labelSize, setLabelSize] = useState<"38x25" | "50x30" | "fashion_tag" | "a4">("38x25");
  const [includeShopName, setIncludeShopName] = useState(true);
  const [includePrice, setIncludePrice] = useState(true);
  const [includeWarranty, setIncludeWarranty] = useState(true);
  const [includeSku, setIncludeSku] = useState(true);

  // Selected Products for Bulk Printing
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);

  // Modal: Single Product Barcode Modal
  const [singleModalOpen, setSingleModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [singlePrintMode, setSinglePrintMode] = useState<"main" | "units">("main");
  const [singleCopies, setSingleCopies] = useState<number>(1);
  const [loadingProductDetails, setLoadingProductDetails] = useState(false);
  const [detailedProduct, setDetailedProduct] = useState<Product | null>(null);

  // Modal: Bulk Print Modal
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkCopiesMode, setBulkCopiesMode] = useState<"1_per_product" | "stock_quantity" | "custom">("1_per_product");
  const [bulkCustomCopies, setBulkCustomCopies] = useState<number>(1);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Blank Barcode Generator State
  const [barcodeCount, setBarcodeCount] = useState<number>(10);
  const [codeLength, setCodeLength] = useState<number>(8);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [generatorCopies, setGeneratorCopies] = useState<number>(1);

  // Active Print Queue & State
  const [printQueue, setPrintQueue] = useState<PrintLabelItem[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch Products with Server-Side Pagination
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, any> = {
        light: 1,
        page: page,
        page_size: pageSize,
      };
      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }

      const res = await api<Paginated<Product>>("/catalog/products/", { params });
      if (res && res.results) {
        setProducts(res.results);
        setTotalCount(res.count || res.results.length);
      } else if (Array.isArray(res)) {
        setProducts(res);
        setTotalCount(res.length);
      } else {
        setProducts([]);
        setTotalCount(0);
      }
    } catch (err: any) {
      console.error("Failed to load products:", err);
      setError(err?.message || "Failed to load product catalog");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Helper: Get Primary Barcode for a Product
  function getPrimaryBarcode(p: Product): string {
    if (p.barcode && p.barcode.trim()) return p.barcode.trim();
    if (p.sku && p.sku.trim()) return p.sku.trim();
    return `${shopPrefix}${String(p.id).padStart(6, "0")}`;
  }

  // Selection Handlers
  const toggleSelectAll = () => {
    if (selectedProductIds.length === products.length && products.length > 0) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(products.map((p) => p.id));
    }
  };

  const toggleSelectProduct = (id: number) => {
    if (selectedProductIds.includes(id)) {
      setSelectedProductIds(selectedProductIds.filter((pId) => pId !== id));
    } else {
      setSelectedProductIds([...selectedProductIds, id]);
    }
  };

  // Open Single Product Modal
  async function openSingleModal(product: Product) {
    setSelectedProduct(product);
    setDetailedProduct(product);
    setSingleCopies(1);
    setSinglePrintMode("main");
    setSingleModalOpen(true);

    // Fetch full product details (with units) in background if needed
    setLoadingProductDetails(true);
    try {
      const full = await api<Product>(`/catalog/products/${product.id}/`);
      if (full) {
        setDetailedProduct(full);
      }
    } catch (e) {
      console.error("Failed to load full product details:", e);
    } finally {
      setLoadingProductDetails(false);
    }
  }

  // Core Unified Print Dispatcher
  const executePrint = useCallback((queue: PrintLabelItem[]) => {
    if (queue.length === 0) {
      toast.error(lang === "bn" ? "প্রিন্ট করার জন্য কোনো বৈধ বারকোড নেই।" : "No valid barcode to print.");
      return;
    }
    setPrintQueue(queue);
    setIsPrinting(true);

    const onAfterPrint = () => {
      setIsPrinting(false);
      window.removeEventListener("afterprint", onAfterPrint);
    };
    window.addEventListener("afterprint", onAfterPrint);

    // Give React sufficient time to render the portal DOM tree
    setTimeout(() => {
      window.print();
    }, 200);
  }, [lang]);

  // Direct 1-Click Instant Print (Prints exactly 1 single barcode sticker on 1 page)
  function instantPrintSingle(product: Product, copies: number = 1) {
    const mainCode = getPrimaryBarcode(product);
    const queue: PrintLabelItem[] = [];
    for (let i = 0; i < copies; i++) {
      queue.push({
        id: `instant-${product.id}-${i}`,
        productId: product.id,
        productName: product.name,
        barcode: mainCode,
        sku: product.sku || "",
        price: product.selling_price || "0",
        warrantyMonths: product.warranty_months,
        shopName,
        isUnit: false,
        fabric: product.fabric_material,
        fit: product.fit_type,
        collection: product.collection_name,
        care: product.care_instructions,
      });
    }
    executePrint(queue);
  }

  // 1-Click Print All Barcodes in Current List / Selection
  function instantPrintAllBarcodes() {
    let targetProducts = products;
    if (selectedProductIds.length > 0) {
      targetProducts = products.filter((p) => selectedProductIds.includes(p.id));
    }
    if (targetProducts.length === 0) {
      toast.error(lang === "bn" ? "প্রিন্ট করার জন্য কোনো পণ্য পাওয়া যায়নি।" : "No products to print.");
      return;
    }
    const queue: PrintLabelItem[] = [];
    targetProducts.forEach((p) => {
      const mainCode = getPrimaryBarcode(p);
      queue.push({
        id: `all-${p.id}`,
        productId: p.id,
        productName: p.name,
        barcode: mainCode,
        sku: p.sku || "",
        price: p.selling_price || "0",
        warrantyMonths: p.warranty_months,
        shopName,
        isUnit: false,
        fabric: p.fabric_material,
        fit: p.fit_type,
        collection: p.collection_name,
        care: p.care_instructions,
      });
    });
    executePrint(queue);
  }

  // Execute Single Product Modal Print
  function triggerSinglePrint() {
    if (!selectedProduct) return;
    const queue: PrintLabelItem[] = [];
    const mainCode = getPrimaryBarcode(selectedProduct);
    const prod = detailedProduct || selectedProduct;

    if (singlePrintMode === "main") {
      if (prod.size_variants && Array.isArray(prod.size_variants) && prod.size_variants.length > 0) {
        prod.size_variants.forEach((sv: any, svIdx: number) => {
          const vCode = sv.barcode || sv.sku || mainCode;
          for (let i = 0; i < singleCopies; i++) {
            queue.push({
              id: `single-${selectedProduct.id}-sv-${svIdx}-${i}`,
              productId: selectedProduct.id,
              productName: selectedProduct.name,
              barcode: vCode,
              sku: sv.sku || selectedProduct.sku || "",
              price: sv.price ? String(sv.price) : (selectedProduct.selling_price || "0"),
              warrantyMonths: selectedProduct.warranty_months,
              shopName,
              isUnit: false,
              fabric: selectedProduct.fabric_material,
              fit: selectedProduct.fit_type,
              collection: selectedProduct.collection_name,
              care: selectedProduct.care_instructions,
              size: sv.size,
              color: sv.color,
            });
          }
        });
      } else {
        for (let i = 0; i < singleCopies; i++) {
          queue.push({
            id: `single-${selectedProduct.id}-${i}`,
            productId: selectedProduct.id,
            productName: selectedProduct.name,
            barcode: mainCode,
            sku: selectedProduct.sku || "",
            price: selectedProduct.selling_price || "0",
            warrantyMonths: selectedProduct.warranty_months,
            shopName,
            isUnit: false,
            fabric: selectedProduct.fabric_material,
            fit: selectedProduct.fit_type,
            collection: selectedProduct.collection_name,
            care: selectedProduct.care_instructions,
          });
        }
      }
    } else {
      // Unit-level barcodes
      const availableUnits = (prod.units || []).filter((u) => u.status === "in_stock" || u.status === "available");
      const targetUnits = availableUnits.length > 0 ? availableUnits : (prod.units || []);

      if (targetUnits.length === 0) {
        toast.error(lang === "bn" ? "এই পণ্যের কোনো সিরিয়াল ইউনিট পাওয়া যায়নি। প্রধান বারকোড প্রিন্ট হচ্ছে।" : "No serial units found. Falling back to primary barcode.");
        for (let i = 0; i < singleCopies; i++) {
          queue.push({
            id: `single-${selectedProduct.id}-${i}`,
            productId: selectedProduct.id,
            productName: selectedProduct.name,
            barcode: mainCode,
            sku: selectedProduct.sku || "",
            price: selectedProduct.selling_price || "0",
            warrantyMonths: selectedProduct.warranty_months,
            shopName,
            isUnit: false,
          });
        }
      } else {
        targetUnits.forEach((u) => {
          queue.push({
            id: `unit-${u.id}`,
            productId: selectedProduct.id,
            productName: selectedProduct.name,
            barcode: u.barcode,
            sku: selectedProduct.sku || "",
            price: u.selling_price || selectedProduct.selling_price || "0",
            warrantyMonths: u.warranty_months || selectedProduct.warranty_months,
            shopName,
            isUnit: true,
          });
        });
      }
    }

    if (queue.length === 0) {
      toast.error(lang === "bn" ? "প্রিন্ট করার জন্য কোনো বৈধ বারকোড নেই।" : "No valid barcode to print.");
      return;
    }

    setSingleModalOpen(false);
    executePrint(queue);
  }

  // Open Bulk Modal
  function openBulkModal() {
    setBulkCopiesMode("1_per_product");
    setBulkModalOpen(true);
  }

  // Execute Bulk Print
  async function triggerBulkPrint(printAllPages: boolean = false) {
    setBulkLoading(true);
    try {
      let targetProducts: Product[] = [];

      if (printAllPages) {
        // Fetch up to 250 items for batch printing
        const res = await api<Paginated<Product>>("/catalog/products/", {
          params: { light: 1, page_size: 250, search: debouncedSearch.trim() || undefined },
        });
        targetProducts = res.results || [];
      } else {
        if (selectedProductIds.length > 0) {
          targetProducts = products.filter((p) => selectedProductIds.includes(p.id));
        } else {
          targetProducts = products;
        }
      }

      if (targetProducts.length === 0) {
        toast.error(lang === "bn" ? "প্রিন্ট করার জন্য কোনো পণ্য পাওয়া যায়নি।" : "No products to print.");
        return;
      }

      const queue: PrintLabelItem[] = [];

      targetProducts.forEach((p) => {
        if (p.size_variants && Array.isArray(p.size_variants) && p.size_variants.length > 0) {
          p.size_variants.forEach((sv: any, svIdx: number) => {
            const vCode = sv.barcode || sv.sku || getPrimaryBarcode(p);
            let count = 1;
            if (bulkCopiesMode === "stock_quantity") {
              count = Math.max(1, Math.min(100, Math.floor(Number(sv.stock) || 1)));
            } else if (bulkCopiesMode === "custom") {
              count = Math.max(1, bulkCustomCopies);
            }
            for (let i = 0; i < count; i++) {
              queue.push({
                id: `bulk-${p.id}-sv-${svIdx}-${i}`,
                productId: p.id,
                productName: p.name,
                barcode: vCode,
                sku: sv.sku || p.sku || "",
                price: sv.price ? String(sv.price) : (p.selling_price || "0"),
                warrantyMonths: p.warranty_months,
                shopName,
                isUnit: false,
                fabric: p.fabric_material,
                fit: p.fit_type,
                collection: p.collection_name,
                care: p.care_instructions,
                size: sv.size,
                color: sv.color,
              });
            }
          });
        } else {
          const code = getPrimaryBarcode(p);
          let count = 1;

          if (bulkCopiesMode === "stock_quantity") {
            const st = Math.max(1, Math.min(100, Math.floor(Number(p.current_stock) || 1)));
            count = st;
          } else if (bulkCopiesMode === "custom") {
            count = Math.max(1, bulkCustomCopies);
          }

          for (let i = 0; i < count; i++) {
            queue.push({
              id: `bulk-${p.id}-${i}`,
              productId: p.id,
              productName: p.name,
              barcode: code,
              sku: p.sku || "",
              price: p.selling_price || "0",
              warrantyMonths: p.warranty_months,
              shopName,
              isUnit: false,
              fabric: p.fabric_material,
              fit: p.fit_type,
              collection: p.collection_name,
              care: p.care_instructions,
            });
          }
        }
      });

      if (queue.length === 0) {
        toast.error(lang === "bn" ? "প্রিন্ট করার মতো কোনো বারকোড পাওয়া যায়নি।" : "No barcodes to print.");
        return;
      }

      setBulkModalOpen(false);
      executePrint(queue);
    } catch (e) {
      toast.error(lang === "bn" ? "বারকোড তৈরি করতে সমস্যা হয়েছে।" : "Error preparing barcodes.");
    } finally {
      setBulkLoading(false);
    }
  }

  // Random Blank Barcode Generator
  function generateRandomBarcodes() {
    const codes: string[] = [];
    for (let i = 0; i < barcodeCount; i++) {
      let code = "";
      for (let j = 0; j < codeLength; j++) {
        code += Math.floor(Math.random() * 10).toString();
      }
      codes.push(shopPrefix ? `${shopPrefix}${code}` : code);
    }
    setGeneratedCodes(codes);
  }

  function printAllGenerated() {
    if (generatedCodes.length === 0) return;
    const queue: PrintLabelItem[] = [];
    generatedCodes.forEach((code, idx) => {
      for (let i = 0; i < generatorCopies; i++) {
        queue.push({
          id: `gen-${idx}-${i}`,
          productId: 0,
          productName: "",
          barcode: code,
          sku: "",
          price: "",
          shopName,
          isUnit: false,
        });
      }
    });
    executePrint(queue);
  }

  function printOneGenerated(index: number) {
    const code = generatedCodes[index];
    if (!code) return;
    const queue: PrintLabelItem[] = [{
      id: `gen-${index}`,
      productId: 0,
      productName: "",
      barcode: code,
      sku: "",
      price: "",
      shopName,
      isUnit: false,
    }];
    executePrint(queue);
  }

  const pageSizeStr = labelSize === "38x25" ? "38mm 25mm" : labelSize === "50x30" ? "50mm 30mm" : labelSize === "fashion_tag" ? "50mm 75mm" : "A4 portrait";
  const pageMarginStr = labelSize === "a4" ? "8mm" : "0";

  const printStyles = `
    @media print {
      @page {
        size: ${pageSizeStr};
        margin: ${pageMarginStr};
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        overflow: visible !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      /* CRITICAL: Completely hide every sibling of #barcode-print-portal from the layout */
      body > *:not(#barcode-print-portal) {
        display: none !important;
        height: 0 !important;
        max-height: 0 !important;
        overflow: hidden !important;
      }
      #barcode-print-portal {
        display: block !important;
        position: static !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }
      .no-print {
        display: none !important;
      }
      .page-break {
        page-break-after: always !important;
        break-after: page !important;
      }
      .page-break:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }
    }
  `;


  // Render Label Component (Pure Inline Styles for Cross-Platform / Printer Consistency)
  const renderBarcodeLabel = (item: PrintLabelItem, key: string, isPreview: boolean = false) => {
    const isFashion = labelSize === "fashion_tag";
    const isA4 = labelSize === "a4";
    const is50x30 = labelSize === "50x30";

    if (isFashion) {
      return (
        <div
          key={key}
          className={isPreview ? "border rounded-3 shadow-sm bg-white" : "page-break"}
          style={{
            width: isPreview ? "220px" : "50mm",
            height: isPreview ? "330px" : "75mm",
            padding: "4mm 3mm",
            boxSizing: "border-box",
            backgroundColor: "#ffffff",
            fontFamily: "system-ui, -apple-system, sans-serif",
            color: "#000000",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div style={{ width: "100%", overflow: "hidden" }}>
            {includeShopName && (
              <div style={{ fontWeight: 800, fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", borderBottom: "1px solid #000000", paddingBottom: "2px", marginBottom: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.shopName}
              </div>
            )}
            {item.productName && (
              <div style={{ fontWeight: 700, fontSize: "11px", lineHeight: "1.2", marginTop: "2px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {item.productName}
              </div>
            )}
            {(item.size || item.color) && (
              <div style={{ fontSize: "10px", fontWeight: 900, textTransform: "uppercase", color: "#000000", backgroundColor: "#f1f5f9", padding: "2px 8px", borderRadius: "4px", marginTop: "4px", display: "inline-block", border: "1px solid #cbd5e1" }}>
                {[item.size && ("SIZE: " + item.size), item.color && ("COLOR: " + item.color)].filter(Boolean).join(" | ")}
              </div>
            )}
            {(item.fabric || item.fit) && (
              <div style={{ fontSize: "8px", color: "#475569", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {[item.fabric, item.fit].filter(Boolean).join(" • ")}
              </div>
            )}
          </div>

          <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", margin: "auto 0" }}>
            <Barcode
              value={item.barcode || "00000000"}
              width={1.2}
              height={36}
              fontSize={10}
              margin={0}
              displayValue={true}
              format="CODE128"
            />
            {includeSku && item.sku && (
              <div style={{ fontSize: "9px", fontFamily: "monospace", marginTop: "2px", letterSpacing: "0.5px" }}>
                SKU: {item.sku}
              </div>
            )}
          </div>

          <div style={{ width: "100%", borderTop: "1px solid #000000", paddingTop: "4px" }}>
            {includePrice && (
              <div style={{ fontWeight: 900, fontSize: "14px", letterSpacing: "-0.5px" }}>
                ৳{money(item.price)}
              </div>
            )}
            {includeWarranty && item.warrantyMonths && item.warrantyMonths > 0 ? (
              <div style={{ fontSize: "9px", fontWeight: 600, color: "#1e293b" }}>
                {item.warrantyMonths} Months Warranty
              </div>
            ) : null}
            {item.care && (
              <div style={{ fontSize: "7px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "2px" }}>{item.care}</div>
            )}
          </div>
        </div>
      );
    }

    // Standard 38x25mm or 50x30mm or A4 Cell
    const containerWidth = isPreview ? (is50x30 ? "210px" : "180px") : isA4 ? "48mm" : is50x30 ? "50mm" : "38mm";
    const containerHeight = isPreview ? (is50x30 ? "130px" : "115px") : isA4 ? "25mm" : is50x30 ? "30mm" : "25mm";
    const barcodeHeight = is50x30 ? 22 : 16;
    const barcodeWidth = is50x30 ? 1.15 : 0.95;

    return (
      <div
        key={key}
        className={isPreview ? "border rounded-3 shadow-sm bg-white" : isA4 ? "border border-dashed border-gray-300" : "page-break"}
        style={{
          width: containerWidth,
          height: containerHeight,
          padding: is50x30 ? "2.5mm 2mm" : "1.8mm 1.2mm",
          boxSizing: "border-box",
          backgroundColor: "#ffffff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#000000",
          overflow: "hidden",
          margin: isA4 ? "1.5mm" : "0",
          display: "inline-flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        {/* Top: Shop & Product Name */}
        <div style={{ width: "100%", overflow: "hidden" }}>
          {includeShopName && (
            <div style={{ fontWeight: 800, fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.1, marginBottom: "1px" }}>
              {item.shopName}
            </div>
          )}
          {item.productName && (
            <div style={{ fontWeight: 700, fontSize: "8.5px", lineHeight: "1.15", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.productName}
            </div>
          )}
          {(item.size || item.color) && (
            <div style={{ fontSize: "7.5px", fontWeight: 700, textTransform: "uppercase" }}>
              {[item.size, item.color].filter(Boolean).join(" - ")}
            </div>
          )}
        </div>

        {/* Middle: Barcode & Code */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", margin: "1px 0" }}>
          <Barcode
            value={item.barcode || "00000000"}
            width={barcodeWidth}
            height={barcodeHeight}
            fontSize={8}
            margin={0}
            displayValue={true}
            format="CODE128"
          />
        </div>

        {/* Bottom: Price, Warranty, SKU */}
        <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "0.5px solid #cbd5e1", paddingTop: "2px", lineHeight: 1 }}>
          {includeSku && item.sku ? (
            <span style={{ fontSize: "7px", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "45%" }}>
              {item.sku}
            </span>
          ) : <span />}

          <div style={{ display: "flex", alignItems: "baseline", gap: "2px" }}>
            {includePrice && (
              <span style={{ fontWeight: 800, fontSize: is50x30 ? "10px" : "9px" }}>
                ৳{money(item.price)}
              </span>
            )}
            {includeWarranty && item.warrantyMonths && item.warrantyMonths > 0 ? (
              <span style={{ fontSize: "6.5px", color: "#475569" }}>
                ({item.warrantyMonths}m)
              </span>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="container-fluid p-3 p-md-4">
      {/* Hidden Print Container via React Portal */}
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />
      {mounted && isPrinting && typeof document !== "undefined" && createPortal(
        <div id="barcode-print-portal">
          {labelSize === "a4" ? (
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-start", width: "100%" }}>
              {printQueue.map((item, idx) => renderBarcodeLabel(item, `print-a4-${idx}`))}
            </div>
          ) : (
            printQueue.map((item, idx) => renderBarcodeLabel(item, `print-single-${idx}`))
          )}
        </div>,
        document.body
      )}

      {/* Page Header */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body p-3 p-md-4 d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-3">
            <div className="bg-primary-subtle text-primary p-3 rounded-circle d-flex align-items-center justify-content-center" style={{ width: 48, height: 48, fontSize: "1.5rem" }}>
              🏷️
            </div>
            <div>
              <h1 className="h4 fw-bold mb-1 text-dark">
                {lang === "bn" ? "বারকোড জেনারেটর ও প্রিন্টিং হাব" : "Barcode Generator & Printing Hub"}
              </h1>
              <p className="text-muted small mb-0">
                {lang === "bn"
                  ? "ইনস্ট্যান্ট সার্চ করুন, একক বা সব বারকোডের ভিজ্যুয়াল লিস্ট দেখুন এবং সরাসরি প্রিন্ট করুন"
                  : "Instant search, view all visual barcodes with live preview, and print individually or in bulk"}
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="btn-group p-1 bg-light rounded-pill border" role="group">
            <button
              type="button"
              onClick={() => setActiveTab("all_barcodes")}
              className={`btn btn-sm rounded-pill px-3 fw-bold ${
                activeTab === "all_barcodes" ? "btn-primary shadow-sm text-white" : "btn-light text-secondary"
              }`}
            >
              🏷️ {lang === "bn" ? "সব বারকোডের ভিজ্যুয়াল হাব" : "All Barcodes Hub"}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("products")}
              className={`btn btn-sm rounded-pill px-3 fw-bold ${
                activeTab === "products" ? "btn-primary shadow-sm text-white" : "btn-light text-secondary"
              }`}
            >
              📦 {lang === "bn" ? "পণ্য ও ক্যাটালগ টেবিল" : "Product Catalog"}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("generator")}
              className={`btn btn-sm rounded-pill px-3 fw-bold ${
                activeTab === "generator" ? "btn-primary shadow-sm text-white" : "btn-light text-secondary"
              }`}
            >
              🎲 {lang === "bn" ? "খালি বারকোড জেনারেটর" : "Blank Generator"}
            </button>
          </div>
        </div>
      </div>

      {/* Barcode Customization & Print Settings Toolbar */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body p-3 p-md-4">
          <div className="row g-3 align-items-center justify-content-between">
            {/* Label Size Selector */}
            <div className="col-12 col-xl-auto d-flex flex-wrap align-items-center gap-2">
              <span className="fw-bold text-uppercase small text-muted me-1">
                {lang === "bn" ? "লেবেল সাইজ:" : "Label Size:"}
              </span>
              <div className="btn-group btn-group-sm border rounded-3 p-1 bg-light flex-wrap" role="group">
                {[
                  { id: "38x25", label: "38mm × 25mm (Standard)" },
                  { id: "50x30", label: "50mm × 30mm (Medium)" },
                  { id: "fashion_tag", label: "50mm × 75mm (Hang Tag)" },
                  { id: "a4", label: "A4 Sheet (Portrait)" },
                ].map((sz) => (
                  <button
                    key={sz.id}
                    type="button"
                    onClick={() => setLabelSize(sz.id as any)}
                    className={`btn btn-sm rounded-2 fw-semibold px-2 py-1 ${
                      labelSize === sz.id ? "btn-primary shadow-sm text-white" : "btn-light text-dark"
                    }`}
                  >
                    {sz.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggle Switches */}
            <div className="col-12 col-xl-auto d-flex flex-wrap align-items-center gap-3">
              <div className="form-check form-switch mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="includeShopName"
                  checked={includeShopName}
                  onChange={(e) => setIncludeShopName(e.target.checked)}
                />
                <label className="form-check-label small fw-semibold text-secondary" htmlFor="includeShopName">
                  {lang === "bn" ? "দোকানের নাম" : "Shop Name"}
                </label>
              </div>
              <div className="form-check form-switch mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="includePrice"
                  checked={includePrice}
                  onChange={(e) => setIncludePrice(e.target.checked)}
                />
                <label className="form-check-label small fw-semibold text-secondary" htmlFor="includePrice">
                  {lang === "bn" ? "মূল্য (৳)" : "Price (৳)"}
                </label>
              </div>
              <div className="form-check form-switch mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="includeWarranty"
                  checked={includeWarranty}
                  onChange={(e) => setIncludeWarranty(e.target.checked)}
                />
                <label className="form-check-label small fw-semibold text-secondary" htmlFor="includeWarranty">
                  {lang === "bn" ? "ওয়ারেন্টি" : "Warranty"}
                </label>
              </div>
              <div className="form-check form-switch mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="includeSku"
                  checked={includeSku}
                  onChange={(e) => setIncludeSku(e.target.checked)}
                />
                <label className="form-check-label small fw-semibold text-secondary" htmlFor="includeSku">
                  SKU / কোড
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TAB 1: ALL BARCODES VISUAL HUB (Grid & List View of All Live Barcodes) */}
      {activeTab === "all_barcodes" && (
        <div className="mb-4">
          {/* Action & Filter Bar */}
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body p-3">
              <div className="row g-3 align-items-center justify-content-between">
                {/* Search Input */}
                <div className="col-12 col-md-5 col-lg-4">
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 text-muted">🔍</span>
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={lang === "bn" ? "পণ্যের নাম, SKU বা বারকোড দিয়ে খুঁজুন..." : "Search by product name, SKU or barcode..."}
                      className="form-control bg-light border-start-0 ps-0"
                    />
                    {search && (
                      <button
                        className="btn btn-light border border-start-0 text-muted"
                        type="button"
                        onClick={() => setSearch("")}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* View Switcher & Action Buttons */}
                <div className="col-12 col-md-auto d-flex flex-wrap align-items-center gap-2">
                  <div className="btn-group btn-group-sm border rounded-pill bg-light p-1" role="group">
                    <button
                      type="button"
                      onClick={() => setVisualViewMode("grid")}
                      className={`btn btn-sm rounded-pill px-3 fw-semibold ${
                        visualViewMode === "grid" ? "btn-white bg-white shadow-sm text-primary" : "btn-light text-muted"
                      }`}
                    >
                      🖼️ {lang === "bn" ? "কার্ড ভিউ" : "Cards"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisualViewMode("list")}
                      className={`btn btn-sm rounded-pill px-3 fw-semibold ${
                        visualViewMode === "list" ? "btn-white bg-white shadow-sm text-primary" : "btn-light text-muted"
                      }`}
                    >
                      📋 {lang === "bn" ? "লিস্ট ভিউ" : "List"}
                    </button>
                  </div>

                  {/* BUTTON 1: ALL BARCODES IN ONE BUTTON */}
                  <div className="btn-group shadow-sm">
                    <button
                      type="button"
                      onClick={instantPrintAllBarcodes}
                      className="btn btn-sm btn-dark fw-bold px-3 d-flex align-items-center gap-1 text-white"
                      title={lang === "bn" ? "বর্তমান তালিকার সব পণ্যের ১টি করে বারকোড সরাসরি প্রিন্ট করুন" : "Print 1 copy of all barcodes in one click"}
                    >
                      <span>📑</span>
                      <span>{lang === "bn" ? "সকল বারকোড প্রিন্ট" : "Print All Barcodes"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProductIds([]);
                        openBulkModal();
                      }}
                      className="btn btn-sm btn-dark dropdown-toggle dropdown-toggle-split text-white border-start border-secondary"
                      title={lang === "bn" ? "বাল্ক প্রিন্ট কাস্টমাইজেশন (কপি সংখ্যা / স্টক অনুযায়ী)" : "Bulk print customization"}
                    >
                      <span className="visually-hidden">Options</span>
                    </button>
                  </div>

                  {/* BUTTON 2: ONLY ONE BARCODE IN ANOTHER BUTTON */}
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedProductIds.length > 0) {
                        const prod = products.find((p) => p.id === selectedProductIds[0]);
                        if (prod) instantPrintSingle(prod, 1);
                      } else if (products.length > 0) {
                        instantPrintSingle(products[0], 1);
                      } else {
                        toast.error(lang === "bn" ? "প্রিন্ট করার মতো কোনো পণ্য পাওয়া যায়নি।" : "No product available to print.");
                      }
                    }}
                    className="btn btn-sm btn-success fw-bold px-3 shadow-sm d-flex align-items-center gap-1 text-white"
                    title={lang === "bn" ? "নির্বাচিত পণ্যের ঠিক ১টি বারকোড স্টিকার প্রিন্ট করুন (ঠিক ১ পৃষ্ঠা)" : "Print exactly 1 barcode sticker (1 page)"}
                  >
                    <span>🖨️</span>
                    <span>{lang === "bn" ? "১টি বারকোড প্রিন্ট" : "Print 1 Barcode"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Barcode Content */}
          {loading ? (
            <div className="card border-0 shadow-sm p-5 text-center">
              <div className="spinner-border text-primary mx-auto mb-2" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="text-muted small mb-0">
                {lang === "bn" ? "বারকোড ডাটা লোড হচ্ছে..." : "Loading barcode hub..."}
              </p>
            </div>
          ) : error ? (
            <ErrorState error={error} />
          ) : products.length === 0 ? (
            <div className="card border-0 shadow-sm p-5 text-center text-muted">
              <p className="display-4 mb-2">🏷️</p>
              <h5 className="fw-bold">{lang === "bn" ? "কোনো পণ্য পাওয়া যায়নি।" : "No products found."}</h5>
              <p className="small text-muted mb-0">
                {lang === "bn" ? "অন্য নাম বা SKU লিখে সার্চ করে দেখুন।" : "Try searching with a different keyword."}
              </p>
            </div>
          ) : visualViewMode === "grid" ? (
            /* GRID CARDS VIEW */
            <div className="row g-3">
              {products.map((p) => {
                const isSelected = selectedProductIds.includes(p.id);
                const code = getPrimaryBarcode(p);
                const labelItem: PrintLabelItem = {
                  id: `card-${p.id}`,
                  productId: p.id,
                  productName: p.name,
                  barcode: code,
                  sku: p.sku || "",
                  price: p.selling_price || "0",
                  warrantyMonths: p.warranty_months,
                  shopName,
                  isUnit: false,
                  fabric: p.fabric_material,
                  fit: p.fit_type,
                  collection: p.collection_name,
                  care: p.care_instructions,
                };

                return (
                  <div key={p.id} className="col-12 col-sm-6 col-lg-4 col-xl-3">
                    <div className={`card h-100 shadow-sm border transition-all ${isSelected ? "border-primary bg-primary-subtle" : "border-light-subtle"}`}>
                      <div className="card-body p-3 d-flex flex-column justify-content-between">
                        {/* Top: Checkbox, Name, SKU */}
                        <div>
                          <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                            <div className="form-check mb-0 d-flex align-items-start gap-2 flex-grow-1">
                              <input
                                className="form-check-input mt-1"
                                type="checkbox"
                                id={`chk-${p.id}`}
                                checked={isSelected}
                                onChange={() => toggleSelectProduct(p.id)}
                              />
                              <label className="form-check-label fw-bold text-dark small text-break mb-0 cursor-pointer" htmlFor={`chk-${p.id}`}>
                                {p.name}
                              </label>
                            </div>
                            <span className="badge bg-light text-secondary border font-monospace small px-2 py-1 flex-shrink-0">
                              {p.sku || `#${p.id}`}
                            </span>
                          </div>

                          {/* Live Barcode Label Preview Box */}
                          <div className="p-2 bg-light border rounded-3 d-flex align-items-center justify-content-center my-3" style={{ minHeight: "140px" }}>
                            {renderBarcodeLabel(labelItem, `preview-card-${p.id}`, true)}
                          </div>
                        </div>

                        {/* Bottom: Stock, Price & Actions */}
                        <div>
                          <div className="d-flex align-items-center justify-content-between pt-2 border-top small">
                            <div className="text-muted">
                              {lang === "bn" ? "স্টক:" : "Stock:"} <span className="fw-bold text-dark">{p.current_stock}</span>
                            </div>
                            <div className="fw-bold text-primary fs-6">
                              ৳{money(p.selling_price)}
                            </div>
                          </div>

                          {/* Action Buttons: 1 Barcode Print & Multiple Copies */}
                          <div className="row g-2 mt-2 pt-2 border-top">
                            <div className="col-7">
                              <button
                                type="button"
                                onClick={() => instantPrintSingle(p, 1)}
                                className="btn btn-sm btn-success w-100 fw-bold d-flex align-items-center justify-content-center gap-1 text-white shadow-sm"
                                title={lang === "bn" ? "এই পণ্যের ঠিক ১টি বারকোড স্টিকার প্রিন্ট করুন (ঠিক ১ পৃষ্ঠা)" : "Print exactly 1 barcode sticker (1 page)"}
                              >
                                <span>🖨️</span>
                                <span>{lang === "bn" ? "১টি বারকোড" : "1 Barcode"}</span>
                              </button>
                            </div>
                            <div className="col-5">
                              <button
                                type="button"
                                onClick={() => openSingleModal(p)}
                                className="btn btn-sm btn-outline-secondary w-100 fw-semibold d-flex align-items-center justify-content-center gap-1"
                                title={lang === "bn" ? "কপি সংখ্যা নির্ধারণ ও প্রিন্ট মোডাল" : "Open print customization modal"}
                              >
                                <span>⚙️</span>
                                <span>{lang === "bn" ? "কপি..." : "Copies..."}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* LIST TABLE VIEW WITH LIVE BARCODES */
            <div className="card border-0 shadow-sm overflow-hidden">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0 text-sm">
                  <thead className="table-light fw-bold">
                    <tr>
                      <th className="p-3 text-center" style={{ width: "40px" }}>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={selectedProductIds.length === products.length && products.length > 0}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th className="p-3">{lang === "bn" ? "পণ্যের নাম ও তথ্য" : "Product & Info"}</th>
                      <th className="p-3 text-center">{lang === "bn" ? "বারকোড প্রিভিউ" : "Barcode Preview"}</th>
                      <th className="p-3 text-end">{lang === "bn" ? "মূল্য" : "Price"}</th>
                      <th className="p-3 text-center">{lang === "bn" ? "স্টক" : "Stock"}</th>
                      <th className="p-3 text-end">{lang === "bn" ? "অ্যাকশন" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => {
                      const isSelected = selectedProductIds.includes(p.id);
                      const code = getPrimaryBarcode(p);
                      const labelItem: PrintLabelItem = {
                        id: `list-${p.id}`,
                        productId: p.id,
                        productName: p.name,
                        barcode: code,
                        sku: p.sku || "",
                        price: p.selling_price || "0",
                        warrantyMonths: p.warranty_months,
                        shopName,
                        isUnit: false,
                      };

                      return (
                        <tr
                          key={p.id}
                          className={isSelected ? "table-primary" : ""}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={isSelected}
                              onChange={() => toggleSelectProduct(p.id)}
                            />
                          </td>
                          <td className="p-3">
                            <div className="fw-bold text-dark">{p.name}</div>
                            <div className="d-flex align-items-center gap-2 small text-muted mt-1">
                              <span>SKU: {p.sku || "—"}</span>
                              <span>•</span>
                              <span className="font-monospace text-primary fw-semibold">{code}</span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <div className="d-inline-block">
                              {renderBarcodeLabel(labelItem, `preview-table-${p.id}`, true)}
                            </div>
                          </td>
                          <td className="p-3 text-end fw-bold text-primary">
                            ৳{money(p.selling_price)}
                          </td>
                          <td className="p-3 text-center fw-semibold text-secondary">
                            {p.current_stock}
                          </td>
                          <td className="p-3 text-end">
                            <div className="d-flex align-items-center justify-content-end gap-1">
                              <button
                                type="button"
                                onClick={() => instantPrintSingle(p, 1)}
                                title={lang === "bn" ? "এই পণ্যের ঠিক ১টি বারকোড স্টিকার প্রিন্ট করুন (ঠিক ১ পৃষ্ঠা)" : "Print exactly 1 barcode sticker (1 page)"}
                                className="btn btn-sm btn-success fw-bold d-flex align-items-center gap-1 text-white shadow-sm"
                              >
                                <span>🖨️</span>
                                <span>{lang === "bn" ? "১টি বারকোড" : "1 Barcode"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openSingleModal(p)}
                                title={lang === "bn" ? "একাধিক কপি বা ভ্যারিয়েন্ট নির্ধারণ" : "Multiple copies & options"}
                                className="btn btn-sm btn-outline-secondary fw-semibold d-flex align-items-center gap-1"
                              >
                                <span>⚙️</span>
                                <span>{lang === "bn" ? "কপি..." : "Copies..."}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination Controls */}
          <div className="card border-0 shadow-sm mt-4 p-3 d-flex flex-column flex-sm-row align-items-center justify-content-between gap-3 text-muted small">
            <div>
              {lang === "bn"
                ? `মোট ${totalCount} টি পণ্যের মধ্যে ${(page - 1) * pageSize + 1} - ${Math.min(
                    page * pageSize,
                    totalCount
                  )} দেখানো হচ্ছে`
                : `Showing ${(page - 1) * pageSize + 1} - ${Math.min(
                    page * pageSize,
                    totalCount
                  )} of ${totalCount} products`}
            </div>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn btn-sm btn-light border fw-bold"
              >
                {lang === "bn" ? "← পূর্ববর্তী" : "← Previous"}
              </button>
              <span className="fw-bold text-dark px-2">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="btn btn-sm btn-light border fw-bold"
              >
                {lang === "bn" ? "পরবর্তী →" : "Next →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STANDARD PRODUCT CATALOG TABLE */}
      {activeTab === "products" && (
        <div className="mb-4">
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body p-3">
              <div className="row g-3 align-items-center justify-content-between">
                <div className="col-12 col-md-5 col-lg-4">
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 text-muted">🔍</span>
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={lang === "bn" ? "পণ্যের নাম বা SKU লিখুন..." : "Filter products by name or SKU..."}
                      className="form-control bg-light border-start-0 ps-0"
                    />
                  </div>
                </div>
                {selectedProductIds.length > 0 && (
                  <div className="col-12 col-md-auto">
                    <button
                      type="button"
                      onClick={openBulkModal}
                      className="btn btn-sm btn-primary fw-bold shadow-sm d-flex align-items-center gap-1 text-white"
                    >
                      🖨️ {lang === "bn" ? `প্রিন্ট (${selectedProductIds.length})` : `Print (${selectedProductIds.length})`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm overflow-hidden">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 text-sm">
                <thead className="table-light fw-bold">
                  <tr>
                    <th className="p-3 text-center" style={{ width: "40px" }}>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={selectedProductIds.length === products.length && products.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="p-3">{lang === "bn" ? "পণ্য" : "Product"}</th>
                    <th className="p-3">SKU</th>
                    <th className="p-3">{lang === "bn" ? "বারকোড" : "Barcode"}</th>
                    <th className="p-3 text-end">{lang === "bn" ? "মূল্য" : "Price"}</th>
                    <th className="p-3 text-center">{lang === "bn" ? "স্টক" : "Stock"}</th>
                    <th className="p-3 text-end">{lang === "bn" ? "অ্যাকশন" : "Action"}</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const isSelected = selectedProductIds.includes(p.id);
                    return (
                      <tr key={p.id}>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={isSelected}
                            onChange={() => toggleSelectProduct(p.id)}
                          />
                        </td>
                        <td className="p-3 fw-bold text-dark">{p.name}</td>
                        <td className="p-3 font-monospace text-muted">{p.sku || "—"}</td>
                        <td className="p-3 font-monospace text-primary fw-semibold">{getPrimaryBarcode(p)}</td>
                        <td className="p-3 text-end fw-bold text-primary">৳{money(p.selling_price)}</td>
                        <td className="p-3 text-center fw-semibold text-secondary">{p.current_stock}</td>
                        <td className="p-3 text-end">
                          <div className="d-flex align-items-center justify-content-end gap-1">
                            <button
                              type="button"
                              onClick={() => instantPrintSingle(p, 1)}
                              title={lang === "bn" ? "এই পণ্যের ঠিক ১টি বারকোড স্টিকার প্রিন্ট করুন (ঠিক ১ পৃষ্ঠা)" : "Print exactly 1 barcode sticker (1 page)"}
                              className="btn btn-sm btn-success fw-bold d-flex align-items-center gap-1 text-white shadow-sm"
                            >
                              🖨️ {lang === "bn" ? "১টি বারকোড" : "1 Barcode"}
                            </button>
                            <button
                              type="button"
                              onClick={() => openSingleModal(p)}
                              title={lang === "bn" ? "একাধিক কপি বা ভ্যারিয়েন্ট নির্ধারণ" : "Multiple copies & options"}
                              className="btn btn-sm btn-outline-secondary fw-semibold"
                            >
                              ⚙️ {lang === "bn" ? "কপি..." : "Copies..."}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BLANK BARCODE GENERATOR */}
      {activeTab === "generator" && (
        <div className="row g-4 mb-4">
          <div className="col-12 col-lg-4">
            <div className="card border-0 shadow-sm p-4">
              <h2 className="h5 fw-bold text-dark d-flex align-items-center gap-2 mb-3">
                <span>🎲</span>
                <span>{lang === "bn" ? "খালি বারকোড কনফিগারেশন" : "Generate Custom Barcodes"}</span>
              </h2>
              <div className="d-flex flex-column gap-3 small">
                <div>
                  <label className="form-label fw-bold text-secondary mb-1">
                    {lang === "bn" ? "কতটি বারকোড তৈরি করবেন?" : "Number of Barcodes:"}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={barcodeCount}
                    onChange={(e) => setBarcodeCount(Number(e.target.value) || 1)}
                    className="form-control"
                  />
                </div>
                <div>
                  <label className="form-label fw-bold text-secondary mb-1">
                    {lang === "bn" ? "কোডের দৈর্ঘ্য (ডিজিট):" : "Code Length (Digits):"}
                  </label>
                  <input
                    type="number"
                    min="4"
                    max="14"
                    value={codeLength}
                    onChange={(e) => setCodeLength(Number(e.target.value) || 8)}
                    className="form-control"
                  />
                </div>
                <button
                  type="button"
                  onClick={generateRandomBarcodes}
                  className="btn btn-primary fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2 mt-2 text-white"
                >
                  <span>✨</span>
                  <span>{lang === "bn" ? "বারকোড তৈরি করুন" : "Generate Barcodes"}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-8">
            <div className="card border-0 shadow-sm p-4">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h3 className="h6 fw-bold text-dark mb-0">
                  {lang === "bn" ? `উৎপন্ন বারকোড তালিকা (${generatedCodes.length})` : `Generated Barcodes (${generatedCodes.length})`}
                </h3>
                {generatedCodes.length > 0 && (
                  <button
                    type="button"
                    onClick={printAllGenerated}
                    className="btn btn-sm btn-primary fw-bold shadow-sm d-flex align-items-center gap-1 text-white"
                  >
                    <span>🖨️</span>
                    <span>{lang === "bn" ? "সবগুলো প্রিন্ট করুন" : "Print All Generated"}</span>
                  </button>
                )}
              </div>

              {generatedCodes.length === 0 ? (
                <div className="p-5 text-center text-muted small">
                  {lang === "bn" ? "বারকোড তৈরি করতে বাম পাশের বাটনে ক্লিক করুন।" : "Click 'Generate Barcodes' to generate blank labels."}
                </div>
              ) : (
                <div className="row g-2 overflow-auto" style={{ maxHeight: "480px" }}>
                  {generatedCodes.map((code, idx) => (
                    <div key={idx} className="col-6 col-sm-4">
                      <div className="p-3 border rounded-3 text-center bg-light d-flex flex-column align-items-center">
                        <Barcode value={code} width={1} height={26} fontSize={9} margin={0} />
                        <button
                          type="button"
                          onClick={() => printOneGenerated(idx)}
                          className="btn btn-link btn-sm text-primary fw-bold text-decoration-none p-0 mt-2"
                        >
                          🖨️ {lang === "bn" ? "এটি প্রিন্ট করুন" : "Print This"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SINGLE PRODUCT PRINT MODAL */}
      {singleModalOpen && selectedProduct && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 p-3">
              <div className="modal-header border-bottom-0 pb-0">
                <div>
                  <h3 className="h5 fw-bold text-dark mb-1">
                    {lang === "bn" ? "প্রোডাক্ট বারকোড প্রিন্টার" : "Print Product Barcode"}
                  </h3>
                  <p className="text-muted small mb-0">{selectedProduct.name}</p>
                </div>
                <button type="button" onClick={() => setSingleModalOpen(false)} className="btn-close" />
              </div>

              <div className="modal-body py-3">
                {/* Live Preview */}
                <div className="d-flex justify-content-center p-3 bg-light rounded-3 border mb-3">
                  {renderBarcodeLabel(
                    {
                      id: "modal-preview",
                      productId: selectedProduct.id,
                      productName: selectedProduct.name,
                      barcode: getPrimaryBarcode(selectedProduct),
                      sku: selectedProduct.sku || "",
                      price: selectedProduct.selling_price || "0",
                      warrantyMonths: selectedProduct.warranty_months,
                      shopName,
                      isUnit: singlePrintMode === "units",
                    },
                    "modal-preview",
                    true
                  )}
                </div>

                {/* Print Configuration */}
                <div className="d-flex flex-column gap-3 small">
                  <div className="d-flex align-items-center justify-content-between">
                    <span className="fw-bold text-secondary">
                      {lang === "bn" ? "কপি সংখ্যা:" : "Number of Copies:"}
                    </span>
                    <div className="d-flex align-items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSingleCopies((c) => Math.max(1, c - 1))}
                        className="btn btn-sm btn-light border fw-bold"
                        style={{ width: "32px", height: "32px" }}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={singleCopies}
                        onChange={(e) => setSingleCopies(Math.max(1, Number(e.target.value) || 1))}
                        className="form-control form-control-sm text-center fw-bold"
                        style={{ width: "60px" }}
                      >
                      </input>
                      <button
                        type="button"
                        onClick={() => setSingleCopies((c) => c + 1)}
                        className="btn btn-sm btn-light border fw-bold"
                        style={{ width: "32px", height: "32px" }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {detailedProduct?.units && detailedProduct.units.length > 0 && (
                    <div className="d-flex align-items-center gap-3 pt-2 border-top">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="singleMode"
                          id="modeMain"
                          checked={singlePrintMode === "main"}
                          onChange={() => setSinglePrintMode("main")}
                        />
                        <label className="form-check-label fw-semibold text-secondary" htmlFor="modeMain">
                          {lang === "bn" ? "প্রধান বারকোড" : "Primary Barcode"}
                        </label>
                      </div>
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="singleMode"
                          id="modeUnits"
                          checked={singlePrintMode === "units"}
                          onChange={() => setSinglePrintMode("units")}
                        />
                        <label className="form-check-label fw-semibold text-secondary" htmlFor="modeUnits">
                          {lang === "bn" ? `সিরিয়াল ইউনিট (${detailedProduct.units.length})` : `Serial Units (${detailedProduct.units.length})`}
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer border-top-0 pt-0 d-flex gap-2">
                <button
                  type="button"
                  onClick={() => setSingleModalOpen(false)}
                  className="btn btn-light fw-bold flex-fill"
                >
                  {lang === "bn" ? "বাতিল" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={triggerSinglePrint}
                  className="btn btn-primary fw-bold flex-fill shadow-sm d-flex align-items-center justify-content-center gap-1 text-white"
                >
                  <span>🖨️</span>
                  <span>{lang === "bn" ? "প্রিন্ট করুন" : "Print Now"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BULK PRINT MODAL */}
      {bulkModalOpen && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 p-3">
              <div className="modal-header border-bottom-0 pb-0">
                <h3 className="h5 fw-bold text-dark mb-0">
                  {lang === "bn" ? "একসাথে বারকোড প্রিন্ট" : "Bulk Barcode Print"}
                </h3>
                <button type="button" onClick={() => setBulkModalOpen(false)} className="btn-close" />
              </div>

              <div className="modal-body py-3">
                <div className="d-flex flex-column gap-2 small">
                  <div className="form-check p-2 border rounded-3 bg-light">
                    <input
                      className="form-check-input ms-0 me-2"
                      type="radio"
                      name="bulkMode"
                      id="bulk1"
                      checked={bulkCopiesMode === "1_per_product"}
                      onChange={() => setBulkCopiesMode("1_per_product")}
                    />
                    <label className="form-check-label fw-semibold text-dark" htmlFor="bulk1">
                      {lang === "bn" ? "প্রতিটি প্রোডাক্টের ১টি করে স্টিকার" : "1 sticker per product"}
                    </label>
                  </div>

                  <div className="form-check p-2 border rounded-3 bg-light">
                    <input
                      className="form-check-input ms-0 me-2"
                      type="radio"
                      name="bulkMode"
                      id="bulkStock"
                      checked={bulkCopiesMode === "stock_quantity"}
                      onChange={() => setBulkCopiesMode("stock_quantity")}
                    />
                    <label className="form-check-label fw-semibold text-dark" htmlFor="bulkStock">
                      {lang === "bn" ? "বর্তমান স্টকের পরিমাণ অনুযায়ী" : "According to current stock quantity"}
                    </label>
                  </div>

                  <div className="form-check p-2 border rounded-3 bg-light">
                    <input
                      className="form-check-input ms-0 me-2"
                      type="radio"
                      name="bulkMode"
                      id="bulkCustom"
                      checked={bulkCopiesMode === "custom"}
                      onChange={() => setBulkCopiesMode("custom")}
                    />
                    <label className="form-check-label fw-semibold text-dark d-flex align-items-center gap-2" htmlFor="bulkCustom">
                      <span>{lang === "bn" ? "নির্দিষ্ট কপি:" : "Custom copies:"}</span>
                      {bulkCopiesMode === "custom" && (
                        <input
                          type="number"
                          min="1"
                          value={bulkCustomCopies}
                          onChange={(e) => setBulkCustomCopies(Math.max(1, Number(e.target.value) || 1))}
                          className="form-control form-control-sm text-center fw-bold"
                          style={{ width: "70px" }}
                        />
                      )}
                    </label>
                  </div>
                </div>
              </div>

              <div className="modal-footer border-top-0 pt-0 d-flex gap-2">
                <button
                  type="button"
                  onClick={() => setBulkModalOpen(false)}
                  className="btn btn-light fw-bold flex-fill"
                >
                  {lang === "bn" ? "বাতিল" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={() => triggerBulkPrint(selectedProductIds.length === 0)}
                  disabled={bulkLoading}
                  className="btn btn-primary fw-bold flex-fill shadow-sm d-flex align-items-center justify-content-center gap-1 text-white"
                >
                  {bulkLoading ? (
                    <span className="spinner-border spinner-border-sm me-1" />
                  ) : (
                    <span>🖨️</span>
                  )}
                  <span>{lang === "bn" ? "প্রিন্ট শুরু করুন" : "Start Printing"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
