"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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

  // Direct 1-Click Instant Print (Prints 1 single barcode sticker immediately)
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

    if (queue.length === 0) {
      toast.error(lang === "bn" ? "প্রিন্ট করার জন্য কোনো বৈধ বারকোড নেই।" : "No valid barcode to print.");
      return;
    }

    setPrintQueue(queue);
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 150);
  }

  // Execute Single Product Modal Print
  function triggerSinglePrint() {
    if (!selectedProduct) return;
    const queue: PrintLabelItem[] = [];
    const mainCode = getPrimaryBarcode(selectedProduct);
    const prod = detailedProduct || selectedProduct;

    if (singlePrintMode === "main") {
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
    setPrintQueue(queue);
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 150);
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
      });

      if (queue.length === 0) {
        toast.error(lang === "bn" ? "প্রিন্ট করার মতো কোনো বারকোড পাওয়া যায়নি।" : "No barcodes to print.");
        return;
      }

      setBulkModalOpen(false);
      setPrintQueue(queue);
      setIsPrinting(true);
      setTimeout(() => {
        window.print();
        setIsPrinting(false);
      }, 150);
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
    setPrintQueue(queue);
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 150);
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
    setPrintQueue(queue);
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 150);
  }

  const pageSizeStr = labelSize === "38x25" ? "38mm 25mm" : labelSize === "50x30" ? "50mm 30mm" : labelSize === "fashion_tag" ? "50mm 75mm" : "A4 portrait";
  const pageMarginStr = labelSize === "a4" ? "8mm" : "0";

  const printStyles = `
    @media print {
      @page {
        size: ${pageSizeStr};
        margin: ${pageMarginStr};
      }
      body {
        margin: 0;
        padding: 0;
        background: #ffffff !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      body * {
        visibility: hidden;
      }
      #print-area, #print-area * {
        visibility: visible;
      }
      #print-area {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        margin: 0;
        padding: 0;
        background: white;
      }
      .no-print {
        display: none !important;
      }
      .page-break {
        page-break-after: always;
        break-after: page;
      }
    }
  `;

  // Render Label Component
  const renderBarcodeLabel = (item: PrintLabelItem, key: string, isPreview: boolean = false) => {
    const isFashion = labelSize === "fashion_tag";
    const isA4 = labelSize === "a4";
    const is50x30 = labelSize === "50x30";

    if (isFashion) {
      return (
        <div
          key={key}
          className={`${isPreview ? "border rounded shadow-sm bg-white" : "page-break"} flex flex-col justify-between items-center text-center`}
          style={{
            width: isPreview ? "220px" : "50mm",
            height: isPreview ? "330px" : "75mm",
            padding: "3.5mm 2.5mm",
            boxSizing: "border-box",
            backgroundColor: "#fff",
            fontFamily: "system-ui, -apple-system, sans-serif",
            color: "#000",
            overflow: "hidden",
          }}
        >
          <div className="w-full">
            {includeShopName && (
              <div className="font-extrabold text-[12px] uppercase tracking-wider border-b border-black pb-1 mb-1 truncate">
                {item.shopName}
              </div>
            )}
            {item.productName && (
              <div className="font-bold text-[10px] line-clamp-2 leading-tight mt-0.5">
                {item.productName}
              </div>
            )}
            {(item.fabric || item.fit) && (
              <div className="text-[8px] text-gray-700 mt-0.5 truncate">
                {[item.fabric, item.fit].filter(Boolean).join(" • ")}
              </div>
            )}
          </div>

          <div className="w-full flex flex-col items-center justify-center my-auto">
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
              <div className="text-[8px] font-mono mt-0.5 tracking-wider truncate">
                SKU: {item.sku}
              </div>
            )}
          </div>

          <div className="w-full border-t border-black pt-1">
            {includePrice && (
              <div className="font-black text-[13px] tracking-tight">
                ৳{money(item.price)}
              </div>
            )}
            {includeWarranty && item.warrantyMonths && item.warrantyMonths > 0 ? (
              <div className="text-[8px] font-semibold text-gray-800">
                {item.warrantyMonths} Months Warranty
              </div>
            ) : null}
            {item.care && (
              <div className="text-[7px] text-gray-600 truncate mt-0.5">{item.care}</div>
            )}
          </div>
        </div>
      );
    }

    // Standard 38x25mm or 50x30mm or A4 Cell
    const containerWidth = isPreview ? (is50x30 ? "200px" : "160px") : isA4 ? "48mm" : is50x30 ? "50mm" : "38mm";
    const containerHeight = isPreview ? (is50x30 ? "120px" : "105px") : isA4 ? "25mm" : is50x30 ? "30mm" : "25mm";
    const barcodeHeight = is50x30 ? 24 : 18;
    const barcodeWidth = is50x30 ? 1.2 : 0.95;

    return (
      <div
        key={key}
        className={`${isPreview ? "border rounded shadow-sm bg-white" : isA4 ? "border border-dashed border-gray-300" : "page-break"} flex flex-col justify-between items-center text-center`}
        style={{
          width: containerWidth,
          height: containerHeight,
          padding: is50x30 ? "2mm" : "1.2mm 1mm",
          boxSizing: "border-box",
          backgroundColor: "#fff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#000",
          overflow: "hidden",
          margin: isA4 ? "1.5mm" : "0",
          display: "inline-flex",
        }}
      >
        {/* Top: Shop & Product Name */}
        <div className="w-full">
          {includeShopName && (
            <div className="font-black text-[8px] uppercase tracking-wider truncate leading-none mb-0.5">
              {item.shopName}
            </div>
          )}
          {item.productName && (
            <div className="font-bold text-[7.5px] truncate leading-tight">
              {item.productName}
            </div>
          )}
        </div>

        {/* Middle: Live Barcode */}
        <div className="w-full flex flex-col items-center justify-center my-auto scale-95">
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

        {/* Bottom: SKU & Price & Warranty */}
        <div className="w-full flex items-center justify-between text-[7px] font-semibold leading-none border-t border-gray-300 pt-0.5">
          <span className="truncate max-w-[50%]">
            {includeSku && item.sku ? item.sku : item.isUnit ? "UNIT" : ""}
          </span>
          <div className="flex items-center gap-1">
            {includeWarranty && item.warrantyMonths && item.warrantyMonths > 0 ? (
              <span className="text-[6.5px] font-bold text-gray-700">{item.warrantyMonths}M Wty</span>
            ) : null}
            {includePrice && (
              <span className="font-extrabold text-[8px]">৳{money(item.price)}</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      <style>{printStyles}</style>

      {/* Hidden Print Container */}
      <div id="print-area" className="hidden">
        {labelSize === "a4" ? (
          <div className="flex flex-wrap items-start justify-start p-2">
            {printQueue.map((item, idx) => renderBarcodeLabel(item, `print-a4-${idx}`))}
          </div>
        ) : (
          printQueue.map((item, idx) => renderBarcodeLabel(item, `print-single-${idx}`))
        )}
      </div>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏷️</span>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
                {lang === "bn" ? "বারকোড জেনারেটর ও প্রিন্টিং হাব" : "Barcode Generator & Printing Hub"}
              </h1>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === "bn"
                  ? "ইনস্ট্যান্ট সার্চ করুন, একক বা সব বারকোডের ভিজ্যুয়াল লিস্ট দেখুন এবং সরাসরি প্রিন্ট করুন"
                  : "Instant search, view all visual barcodes with live preview, and print individually or in bulk"}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab("all_barcodes")}
            className={`px-4 py-2 text-xs md:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "all_barcodes"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50"
            }`}
          >
            <span>🏷️</span>
            <span>{lang === "bn" ? "সব বারকোডের ভিজ্যুয়াল হাব" : "All Barcodes Hub"}</span>
          </button>
          <button
            onClick={() => setActiveTab("products")}
            className={`px-4 py-2 text-xs md:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "products"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50"
            }`}
          >
            <span>📦</span>
            <span>{lang === "bn" ? "পণ্য ও ক্যাটালগ টেবিল" : "Product Catalog"}</span>
          </button>
          <button
            onClick={() => setActiveTab("generator")}
            className={`px-4 py-2 text-xs md:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "generator"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50"
            }`}
          >
            <span>🎲</span>
            <span>{lang === "bn" ? "খালি বারকোড জেনারেটর" : "Blank Generator"}</span>
          </button>
        </div>
      </div>

      {/* Barcode Customization & Print Settings Toolbar */}
      <div className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Label Size Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {lang === "bn" ? "লেবেল সাইজ:" : "Label Size:"}
            </span>
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
              {[
                { id: "38x25", label: "38mm × 25mm (Standard)" },
                { id: "50x30", label: "50mm × 30mm (Medium)" },
                { id: "fashion_tag", label: "50mm × 75mm (Hang Tag)" },
                { id: "a4", label: "A4 Sheet (Portrait)" },
              ].map((sz) => (
                <button
                  key={sz.id}
                  onClick={() => setLabelSize(sz.id as any)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    labelSize === sz.id
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800"
                  }`}
                >
                  {sz.label}
                </button>
              ))}
            </div>
          </div>

          {/* Toggle Switches */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-700 dark:text-slate-300">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeShopName}
                onChange={(e) => setIncludeShopName(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>{lang === "bn" ? "দোকানের নাম" : "Shop Name"}</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includePrice}
                onChange={(e) => setIncludePrice(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>{lang === "bn" ? "মূল্য (৳)" : "Price (৳)"}</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeWarranty}
                onChange={(e) => setIncludeWarranty(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>{lang === "bn" ? "ওয়ারেন্টি" : "Warranty"}</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeSku}
                onChange={(e) => setIncludeSku(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>SKU</span>
            </label>
          </div>
        </div>
      </div>

      {/* TAB 1: ALL BARCODES VISUAL HUB (Grid & List View of All Live Barcodes) */}
      {activeTab === "all_barcodes" && (
        <div className="space-y-4">
          {/* Action & Filter Bar */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={lang === "bn" ? "প্রোডাক্টের নাম, SKU বা বারকোড দিয়ে খুঁজুন..." : "Search by product name, SKU or barcode..."}
                className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* View Switcher & Bulk Print Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Grid / List Mode */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setVisualViewMode("grid")}
                  title={lang === "bn" ? "গ্রিড কার্ড ভিউ" : "Grid Card View"}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                    visualViewMode === "grid"
                      ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <span>🖼️</span>
                  <span>{lang === "bn" ? "কার্ড ভিউ" : "Cards"}</span>
                </button>
                <button
                  onClick={() => setVisualViewMode("list")}
                  title={lang === "bn" ? "লিস্ট টেবিল ভিউ" : "List Table View"}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                    visualViewMode === "list"
                      ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <span>📋</span>
                  <span>{lang === "bn" ? "লিস্ট ভিউ" : "List"}</span>
                </button>
              </div>

              {/* Print Selected Button */}
              {selectedProductIds.length > 0 && (
                <button
                  onClick={openBulkModal}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs md:text-sm font-bold shadow-sm transition-all flex items-center gap-2"
                >
                  <span>🖨️</span>
                  <span>
                    {lang === "bn"
                      ? `সিলেক্টেড প্রিন্ট করুন (${selectedProductIds.length})`
                      : `Print Selected (${selectedProductIds.length})`}
                  </span>
                </button>
              )}

              {/* Print All Button */}
              <button
                onClick={() => {
                  setSelectedProductIds([]);
                  openBulkModal();
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-black dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs md:text-sm font-bold shadow-sm transition-all flex items-center gap-2"
              >
                <span>📑</span>
                <span>{lang === "bn" ? "এক ক্লিকে সব প্রিন্ট" : "Print All Barcodes"}</span>
              </button>
            </div>
          </div>

          {/* Barcode Cards Grid or List */}
          {loading ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center">
              <span className="spinner-border spinner-border-sm me-2 text-indigo-600 inline-block w-6 h-6 border-2 rounded-full animate-spin" />
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">
                {lang === "bn" ? "বারকোড ডাটা লোড হচ্ছে..." : "Loading barcode hub..."}
              </p>
            </div>
          ) : error ? (
            <ErrorState error={error} />
          ) : products.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500">
              <p className="text-4xl mb-2">🏷️</p>
              <p className="font-bold text-base">{lang === "bn" ? "কোনো পণ্য পাওয়া যায়নি।" : "No products found."}</p>
              <p className="text-xs text-slate-400 mt-1">
                {lang === "bn" ? "অন্য নাম বা SKU লিখে সার্চ করে দেখুন।" : "Try searching with a different keyword."}
              </p>
            </div>
          ) : visualViewMode === "grid" ? (
            /* GRID CARDS VIEW */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                  <div
                    key={p.id}
                    className={`bg-white dark:bg-slate-800 rounded-2xl border transition-all p-4 flex flex-col justify-between hover:shadow-md ${
                      isSelected
                        ? "border-indigo-600 ring-2 ring-indigo-500/20 shadow-sm"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {/* Top: Checkbox & Product Name */}
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <label className="flex items-start gap-2 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectProduct(p.id)}
                            className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="font-bold text-xs md:text-sm text-slate-900 dark:text-white line-clamp-2 leading-tight">
                            {p.name}
                          </span>
                        </label>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {p.sku || `#${p.id}`}
                        </span>
                      </div>

                      {/* Barcode Visual Preview Box */}
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/60 flex items-center justify-center my-2">
                        {renderBarcodeLabel(labelItem, `preview-card-${p.id}`, true)}
                      </div>

                      {/* Stock & Price Details */}
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2 px-1">
                        <span>
                          {lang === "bn" ? "স্টক:" : "Stock:"}{" "}
                          <strong className="text-slate-800 dark:text-slate-200">{p.current_stock}</strong>
                        </span>
                        <span>
                          {lang === "bn" ? "মূল্য:" : "Price:"}{" "}
                          <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                            ৳{money(p.selling_price)}
                          </strong>
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons: 1-Click Print & Custom Print */}
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                      <button
                        onClick={() => instantPrintSingle(p, 1)}
                        title={lang === "bn" ? "সরাসরি ১টি বারকোড প্রিন্ট করুন" : "Print 1 copy immediately"}
                        className="w-full py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1 border border-emerald-200 dark:border-emerald-800/60"
                      >
                        <span>⚡</span>
                        <span>{lang === "bn" ? "১-ক্লিক প্রিন্ট" : "1-Click"}</span>
                      </button>

                      <button
                        onClick={() => openSingleModal(p)}
                        title={lang === "bn" ? "কপি সংখ্যা নির্ধারণ ও প্রিন্ট মোডাল" : "Open print customization modal"}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1 shadow-sm"
                      >
                        <span>🖨️</span>
                        <span>{lang === "bn" ? "প্রিন্ট মোডাল" : "Print"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* LIST TABLE VIEW WITH LIVE BARCODES */
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs md:text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.length === products.length && products.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                      <th className="p-3">{lang === "bn" ? "পণ্যের নাম ও তথ্য" : "Product & Info"}</th>
                      <th className="p-3 text-center">{lang === "bn" ? "বারকোড প্রিভিউ" : "Barcode Preview"}</th>
                      <th className="p-3 text-right">{lang === "bn" ? "মূল্য" : "Price"}</th>
                      <th className="p-3 text-center">{lang === "bn" ? "স্টক" : "Stock"}</th>
                      <th className="p-3 text-right">{lang === "bn" ? "অ্যাকশন" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
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
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-all ${
                            isSelected ? "bg-indigo-50/40 dark:bg-indigo-950/20" : ""
                          }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectProduct(p.id)}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900 dark:text-white line-clamp-1">{p.name}</div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                              <span>SKU: {p.sku || "—"}</span>
                              <span>•</span>
                              <span className="font-mono text-indigo-600 dark:text-indigo-400">{code}</span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <div className="inline-block transform scale-90">
                              {renderBarcodeLabel(labelItem, `preview-table-${p.id}`, true)}
                            </div>
                          </td>
                          <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            ৳{money(p.selling_price)}
                          </td>
                          <td className="p-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                            {p.current_stock}
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => instantPrintSingle(p, 1)}
                                title={lang === "bn" ? "সরাসরি ১টি বারকোড প্রিন্ট করুন" : "Print 1 copy immediately"}
                                className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 font-bold text-xs rounded-lg transition-all border border-emerald-200 dark:border-emerald-800 flex items-center gap-1"
                              >
                                <span>⚡</span>
                                <span>{lang === "bn" ? "১-ক্লিক" : "1-Click"}</span>
                              </button>
                              <button
                                onClick={() => openSingleModal(p)}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1 shadow-sm"
                              >
                                <span>🖨️</span>
                                <span>{lang === "bn" ? "প্রিন্ট" : "Print"}</span>
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs md:text-sm text-slate-500">
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold"
              >
                {lang === "bn" ? "← পূর্ববর্তী" : "← Previous"}
              </button>
              <span className="font-bold text-slate-900 dark:text-white px-2">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold"
              >
                {lang === "bn" ? "পরবর্তী →" : "Next →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STANDARD PRODUCT CATALOG TABLE */}
      {activeTab === "products" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={lang === "bn" ? "পণ্যের নাম বা SKU লিখুন..." : "Filter products by name or SKU..."}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
              />
            </div>
            {selectedProductIds.length > 0 && (
              <button
                onClick={openBulkModal}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs md:text-sm font-bold shadow-sm flex items-center gap-2"
              >
                <span>🖨️</span>
                <span>{lang === "bn" ? `প্রিন্ট (${selectedProductIds.length})` : `Print (${selectedProductIds.length})`}</span>
              </button>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedProductIds.length === products.length && products.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded text-indigo-600"
                      />
                    </th>
                    <th className="p-3">{lang === "bn" ? "পণ্য" : "Product"}</th>
                    <th className="p-3">SKU</th>
                    <th className="p-3">{lang === "bn" ? "বারকোড" : "Barcode"}</th>
                    <th className="p-3 text-right">{lang === "bn" ? "মূল্য" : "Price"}</th>
                    <th className="p-3 text-center">{lang === "bn" ? "স্টক" : "Stock"}</th>
                    <th className="p-3 text-right">{lang === "bn" ? "অ্যাকশন" : "Action"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {products.map((p) => {
                    const isSelected = selectedProductIds.includes(p.id);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectProduct(p.id)}
                            className="w-4 h-4 rounded text-indigo-600"
                          />
                        </td>
                        <td className="p-3 font-bold text-slate-900 dark:text-white">{p.name}</td>
                        <td className="p-3 font-mono text-slate-500">{p.sku || "—"}</td>
                        <td className="p-3 font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{getPrimaryBarcode(p)}</td>
                        <td className="p-3 text-right font-bold text-emerald-600">৳{money(p.selling_price)}</td>
                        <td className="p-3 text-center font-semibold">{p.current_stock}</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => instantPrintSingle(p, 1)}
                              className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold rounded-lg border border-emerald-200"
                            >
                              ⚡ {lang === "bn" ? "১-ক্লিক" : "1-Click"}
                            </button>
                            <button
                              onClick={() => openSingleModal(p)}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg"
                            >
                              🖨️ {lang === "bn" ? "প্রিন্ট" : "Print"}
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>🎲</span>
              <span>{lang === "bn" ? "খালি বারকোড কনফিগারেশন" : "Generate Custom Barcodes"}</span>
            </h2>
            <div className="space-y-3 text-xs md:text-sm">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === "bn" ? "কতটি বারকোড তৈরি করবেন?" : "Number of Barcodes:"}
                </label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={barcodeCount}
                  onChange={(e) => setBarcodeCount(Number(e.target.value) || 1)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === "bn" ? "কোডের দৈর্ঘ্য (ডিজিট):" : "Code Length (Digits):"}
                </label>
                <input
                  type="number"
                  min="4"
                  max="14"
                  value={codeLength}
                  onChange={(e) => setCodeLength(Number(e.target.value) || 8)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <button
                onClick={generateRandomBarcodes}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <span>✨</span>
                <span>{lang === "bn" ? "বারকোড তৈরি করুন" : "Generate Barcodes"}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white">
                {lang === "bn" ? `উৎপন্ন বারকোড তালিকা (${generatedCodes.length})` : `Generated Barcodes (${generatedCodes.length})`}
              </h3>
              {generatedCodes.length > 0 && (
                <button
                  onClick={printAllGenerated}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5"
                >
                  <span>🖨️</span>
                  <span>{lang === "bn" ? "সবগুলো প্রিন্ট করুন" : "Print All Generated"}</span>
                </button>
              )}
            </div>

            {generatedCodes.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                {lang === "bn" ? "বারকোড তৈরি করতে বাম পাশের বাটনে ক্লিক করুন।" : "Click 'Generate Barcodes' to generate blank labels."}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto p-1">
                {generatedCodes.map((code, idx) => (
                  <div key={idx} className="p-3 border rounded-xl flex flex-col items-center bg-slate-50 dark:bg-slate-900/50">
                    <Barcode value={code} width={1} height={26} fontSize={9} margin={0} />
                    <button
                      onClick={() => printOneGenerated(idx)}
                      className="mt-2 text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      🖨️ {lang === "bn" ? "এটি প্রিন্ট করুন" : "Print This"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SINGLE PRODUCT PRINT MODAL */}
      {singleModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-black text-lg text-slate-900 dark:text-white">
                  {lang === "bn" ? "প্রোডাক্ট বারকোড প্রিন্টার" : "Print Product Barcode"}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-1">{selectedProduct.name}</p>
              </div>
              <button onClick={() => setSingleModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">
                ✕
              </button>
            </div>

            {/* Live Preview */}
            <div className="flex justify-center p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border">
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
            <div className="space-y-3 text-xs md:text-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {lang === "bn" ? "কপি সংখ্যা:" : "Number of Copies:"}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSingleCopies((c) => Math.max(1, c - 1))}
                    className="w-8 h-8 rounded-lg border font-bold bg-slate-100 hover:bg-slate-200"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={singleCopies}
                    onChange={(e) => setSingleCopies(Math.max(1, Number(e.target.value) || 1))}
                    className="w-16 text-center font-bold p-1 border rounded-lg"
                  />
                  <button
                    onClick={() => setSingleCopies((c) => c + 1)}
                    className="w-8 h-8 rounded-lg border font-bold bg-slate-100 hover:bg-slate-200"
                  >
                    +
                  </button>
                </div>
              </div>

              {detailedProduct?.units && detailedProduct.units.length > 0 && (
                <div className="flex items-center gap-4 pt-2">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="singleMode"
                      checked={singlePrintMode === "main"}
                      onChange={() => setSinglePrintMode("main")}
                    />
                    <span>{lang === "bn" ? "প্রধান বারকোড" : "Primary Barcode"}</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="singleMode"
                      checked={singlePrintMode === "units"}
                      onChange={() => setSinglePrintMode("units")}
                    />
                    <span>{lang === "bn" ? `সিরিয়াল ইউনিট (${detailedProduct.units.length})` : `Serial Units (${detailedProduct.units.length})`}</span>
                  </label>
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-3 pt-3">
              <button
                onClick={() => setSingleModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                {lang === "bn" ? "বাতিল" : "Cancel"}
              </button>
              <button
                onClick={triggerSinglePrint}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm flex items-center justify-center gap-1.5"
              >
                <span>🖨️</span>
                <span>{lang === "bn" ? "প্রিন্ট করুন" : "Print Now"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK PRINT MODAL */}
      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <h3 className="font-black text-lg text-slate-900 dark:text-white">
              {lang === "bn" ? "একসাথে বারকোড প্রিন্ট" : "Bulk Barcode Print"}
            </h3>

            <div className="space-y-3 text-xs md:text-sm">
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <input
                  type="radio"
                  name="bulkMode"
                  checked={bulkCopiesMode === "1_per_product"}
                  onChange={() => setBulkCopiesMode("1_per_product")}
                />
                <span>{lang === "bn" ? "প্রতিটি প্রোডাক্টের ১টি করে স্টিকার" : "1 sticker per product"}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <input
                  type="radio"
                  name="bulkMode"
                  checked={bulkCopiesMode === "stock_quantity"}
                  onChange={() => setBulkCopiesMode("stock_quantity")}
                />
                <span>{lang === "bn" ? "বর্তমান স্টকের পরিমাণ অনুযায়ী" : "According to current stock quantity"}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <input
                  type="radio"
                  name="bulkMode"
                  checked={bulkCopiesMode === "custom"}
                  onChange={() => setBulkCopiesMode("custom")}
                />
                <span className="flex items-center gap-2">
                  <span>{lang === "bn" ? "নির্দিষ্ট কপি:" : "Custom copies:"}</span>
                  {bulkCopiesMode === "custom" && (
                    <input
                      type="number"
                      min="1"
                      value={bulkCustomCopies}
                      onChange={(e) => setBulkCustomCopies(Math.max(1, Number(e.target.value) || 1))}
                      className="w-16 p-1 border rounded text-center"
                    />
                  )}
                </span>
              </label>
            </div>

            <div className="flex items-center gap-3 pt-3">
              <button
                onClick={() => setBulkModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                {lang === "bn" ? "বাতিল" : "Cancel"}
              </button>
              <button
                onClick={() => triggerBulkPrint(selectedProductIds.length === 0)}
                disabled={bulkLoading}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm flex items-center justify-center gap-1.5"
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
      )}
    </div>
  );
}
