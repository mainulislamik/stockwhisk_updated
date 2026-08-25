"use client";

import React, { useState, useEffect, useMemo } from "react";
import Barcode from "react-barcode";
import { fetchAll } from "@/lib/api";
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
};

export default function BarcodesGeneratorPage() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const shopPrefix = (user?.shop_barcode_prefix || "").toUpperCase();
  const shopName = user?.shop_name || "StockWhisk";

  // Tab State
  const [activeTab, setActiveTab] = useState<"products" | "generator">("products");

  // Products Data
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // Label Customization Settings
  const [labelSize, setLabelSize] = useState<"38x25" | "50x30" | "a4">("38x25");
  const [showShopName, setShowShopName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showWarranty, setShowWarranty] = useState(true);
  const [showCodeText, setShowCodeText] = useState(true);

  // Single Product Print Modal
  const [singleModalOpen, setSingleModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [singleCopies, setSingleCopies] = useState<number>(1);
  const [singleUnitMode, setSingleUnitMode] = useState<"main" | "units">("main");

  // Bulk Print All Modal
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<"1_per_product" | "all_stock_units">("1_per_product");

  // Print Queue State
  const [printQueue, setPrintQueue] = useState<PrintLabelItem[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);

  // Blank Random Generator State
  const [genQuantity, setGenQuantity] = useState<number>(10);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [printGenIndex, setPrintGenIndex] = useState<number | null>(null);

  // Load Products
  async function loadProducts() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAll<Product>("/catalog/products/");
      setProducts(data || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load products.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  // Filter products that have platform-generated / catalog barcodes
  const platformProducts = useMemo(() => {
    return products.filter((p) => {
      // Products with barcode, SKU, or serial units
      const hasBarcode = Boolean(p.barcode && p.barcode.trim());
      const hasSku = Boolean(p.sku && p.sku.trim());
      const hasUnits = Boolean(p.units && p.units.length > 0);
      return hasBarcode || hasSku || hasUnits;
    });
  }, [products]);

  // Search filtered products
  const filteredProducts = useMemo(() => {
    if (!search.trim()) return platformProducts;
    const q = search.toLowerCase();
    return platformProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.units && p.units.some((u) => u.barcode.toLowerCase().includes(q)))
    );
  }, [platformProducts, search]);

  // Handle Single Product Print Trigger
  function openSinglePrint(product: Product) {
    setSelectedProduct(product);
    const stockNum = Math.max(1, Math.floor(Number(product.current_stock) || 1));
    setSingleCopies(stockNum > 10 ? 1 : stockNum);
    setSingleUnitMode("main");
    setSingleModalOpen(true);
  }

  // Execute Single Product Print
  function triggerSinglePrint() {
    if (!selectedProduct) return;
    const queue: PrintLabelItem[] = [];
    const mainCode = selectedProduct.barcode || selectedProduct.sku || `PROD-${selectedProduct.id}`;

    if (singleUnitMode === "units" && selectedProduct.units && selectedProduct.units.length > 0) {
      // Print 1 for each in-stock unit
      selectedProduct.units.forEach((u) => {
        queue.push({
          id: `unit-${u.id}`,
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          barcode: u.barcode,
          sku: selectedProduct.sku,
          price: u.selling_price || selectedProduct.selling_price,
          warrantyMonths: u.warranty_months ?? selectedProduct.warranty_months,
          shopName,
          isUnit: true,
        });
      });
    } else {
      // Print N copies of main barcode
      const copies = Math.max(1, singleCopies);
      for (let i = 0; i < copies; i++) {
        queue.push({
          id: `single-${selectedProduct.id}-${i}`,
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          barcode: mainCode,
          sku: selectedProduct.sku,
          price: selectedProduct.selling_price,
          warrantyMonths: selectedProduct.warranty_months,
          shopName,
          isUnit: false,
        });
      }
    }

    setSingleModalOpen(false);
    setPrintQueue(queue);
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 150);
  }

  // Execute Bulk Print All Products
  function triggerBulkPrint() {
    const queue: PrintLabelItem[] = [];

    if (bulkMode === "all_stock_units") {
      // 1 sticker for every in-stock unit / quantity
      platformProducts.forEach((p) => {
        if (p.units && p.units.length > 0) {
          p.units.forEach((u) => {
            queue.push({
              id: `bulk-unit-${u.id}`,
              productId: p.id,
              productName: p.name,
              barcode: u.barcode,
              sku: p.sku,
              price: u.selling_price || p.selling_price,
              warrantyMonths: u.warranty_months ?? p.warranty_months,
              shopName,
              isUnit: true,
            });
          });
        } else {
          const count = Math.max(1, Math.floor(Number(p.current_stock) || 1));
          const code = p.barcode || p.sku || `PROD-${p.id}`;
          for (let i = 0; i < count; i++) {
            queue.push({
              id: `bulk-p-${p.id}-${i}`,
              productId: p.id,
              productName: p.name,
              barcode: code,
              sku: p.sku,
              price: p.selling_price,
              warrantyMonths: p.warranty_months,
              shopName,
              isUnit: false,
            });
          }
        }
      });
    } else {
      // 1 sticker per product
      platformProducts.forEach((p) => {
        const code = p.barcode || p.sku || `PROD-${p.id}`;
        queue.push({
          id: `bulk-1-${p.id}`,
          productId: p.id,
          productName: p.name,
          barcode: code,
          sku: p.sku,
          price: p.selling_price,
          warrantyMonths: p.warranty_months,
          shopName,
          isUnit: false,
        });
      });
    }

    if (queue.length === 0) {
      toast.error(lang === "bn" ? "প্রিন্ট করার মতো কোনো প্রোডাক্ট বারকোড পাওয়া যায়নি।" : "No product barcodes to print.");
      return;
    }

    setBulkModalOpen(false);
    setPrintQueue(queue);
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 150);
  }

  // Random Blank Barcode Generator Logic
  function generateRandomBarcodes() {
    const codes: string[] = [];
    const base = Date.now().toString().slice(-6);
    for (let i = 0; i < genQuantity; i++) {
      const randomStr = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
      codes.push(`${shopPrefix || "SW"}${base}${randomStr}${i}`);
    }
    setGeneratedCodes(codes);
  }

  function printAllGenerated() {
    setPrintGenIndex(null);
    const queue: PrintLabelItem[] = generatedCodes.map((code, idx) => ({
      id: `gen-${idx}`,
      productId: 0,
      productName: "",
      barcode: code,
      sku: "",
      price: "",
      shopName,
      isUnit: false,
    }));
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

  return (
    <>
      {/* ── PRINT STYLES ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: ${labelSize === "38x25" ? "38mm 25mm" : labelSize === "50x30" ? "50mm 30mm" : "A4 portrait"};
            margin: ${labelSize === "a4" ? "8mm" : "0"};
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            background: white !important;
          }
          body * {
            visibility: hidden !important;
          }
          #print-root, #print-root * {
            visibility: visible !important;
          }
          #print-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
          }
          .no-print {
            display: none !important;
          }

          /* Thermal 38x25mm Label */
          .label-38x25 {
            width: 38mm !important;
            height: 25mm !important;
            max-width: 38mm !important;
            max-height: 25mm !important;
            page-break-inside: avoid !important;
            page-break-after: always !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            align-items: center !important;
            box-sizing: border-box !important;
            padding: 1mm 1.5mm !important;
            text-align: center !important;
            background: #fff !important;
          }

          /* Thermal 50x30mm Label */
          .label-50x30 {
            width: 50mm !important;
            height: 30mm !important;
            max-width: 50mm !important;
            max-height: 30mm !important;
            page-break-inside: avoid !important;
            page-break-after: always !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            align-items: center !important;
            box-sizing: border-box !important;
            padding: 1.5mm 2mm !important;
            text-align: center !important;
            background: #fff !important;
          }

          /* A4 Sheet Grid */
          .label-a4-grid {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 2mm !important;
            width: 100% !important;
          }
          .label-a4-item {
            border: 1px dashed #cbd5e1 !important;
            height: 28mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            align-items: center !important;
            padding: 1.5mm !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
          }
        }
      `}} />

      {/* ── MAIN SCREEN UI ── */}
      <div className="vstack gap-4 no-print pb-5">
        {/* Header with Title and Tab Switcher */}
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h4 className="fw-bold mb-1 text-dark">
              🏷️ {t("bar_title") || "Barcode Generator & Printing Hub"}
            </h4>
            <div className="text-secondary small">
              {activeTab === "products"
                ? (t("bar_prod_desc") || "Print platform-generated barcode stickers for your products and inventory units")
                : (t("bar_desc1") || "Generate unique barcodes for printing on 38x25mm labels.")}
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="btn-group shadow-sm bg-white p-1 rounded-3 border" role="group">
            <button
              type="button"
              className={`btn btn-sm rounded-2 ${activeTab === "products" ? "btn-brand fw-bold shadow-sm" : "btn-light text-secondary"}`}
              onClick={() => setActiveTab("products")}
            >
              🏷️ {t("bar_tab_product") || "Print Product Barcodes"} ({platformProducts.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-2 ${activeTab === "generator" ? "btn-brand fw-bold shadow-sm" : "btn-light text-secondary"}`}
              onClick={() => setActiveTab("generator")}
            >
              ⚡ {t("bar_tab_generator") || "Blank Barcode Generator"}
            </button>
          </div>
        </div>

        {/* ── TAB 1: PRODUCT BARCODES PRINTING HUB ── */}
        {activeTab === "products" && (
          <div className="vstack gap-3">
            {/* Top Action Toolbar & Label Customizer Card */}
            <div className="card shadow-sm border-0 rounded-3 bg-white">
              <div className="card-body p-3">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                  {/* Search Bar */}
                  <div className="flex-grow-1" style={{ minWidth: "260px", maxWidth: "420px" }}>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text bg-light border-end-0">🔍</span>
                      <input
                        type="search"
                        className="form-control border-start-0 ps-0"
                        placeholder={t("bar_search_ph") || "Search product name, SKU, or barcode..."}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Label Settings Toggles & Size */}
                  <div className="d-flex flex-wrap align-items-center gap-3">
                    {/* Size Selector */}
                    <div className="d-flex align-items-center gap-1">
                      <span className="small text-secondary fw-semibold">📐 {t("bar_lbl_size") || "Size"}:</span>
                      <select
                        className="form-select form-select-sm"
                        style={{ width: "160px" }}
                        value={labelSize}
                        onChange={(e) => setLabelSize(e.target.value as any)}
                      >
                        <option value="38x25">38mm × 25mm (Thermal)</option>
                        <option value="50x30">50mm × 30mm (Thermal)</option>
                        <option value="a4">A4 Sheet Grid</option>
                      </select>
                    </div>

                    {/* Toggles */}
                    <div className="form-check form-check-inline form-switch mb-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="toggleShopName"
                        checked={showShopName}
                        onChange={(e) => setShowShopName(e.target.checked)}
                      />
                      <label className="form-check-label small" htmlFor="toggleShopName">
                        {t("bar_lbl_show_shop") || "Shop Name"}
                      </label>
                    </div>

                    <div className="form-check form-check-inline form-switch mb-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="togglePrice"
                        checked={showPrice}
                        onChange={(e) => setShowPrice(e.target.checked)}
                      />
                      <label className="form-check-label small" htmlFor="togglePrice">
                        {t("bar_lbl_show_price") || "Price"}
                      </label>
                    </div>

                    <div className="form-check form-check-inline form-switch mb-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="toggleWarranty"
                        checked={showWarranty}
                        onChange={(e) => setShowWarranty(e.target.checked)}
                      />
                      <label className="form-check-label small" htmlFor="toggleWarranty">
                        {t("bar_lbl_show_warranty") || "Warranty"}
                      </label>
                    </div>

                    {/* Bulk Print All Button */}
                    <button
                      type="button"
                      className="btn btn-brand btn-sm fw-bold px-3 shadow-sm"
                      onClick={() => setBulkModalOpen(true)}
                      disabled={platformProducts.length === 0}
                    >
                      🖨️ {t("bar_btn_print_all_products") || "Print All Products Barcodes"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Products Grid */}
            {loading ? (
              <Spinner label={t("bar_loading") || "Loading platform product barcodes..."} />
            ) : error ? (
              <ErrorState error={error} />
            ) : filteredProducts.length === 0 ? (
              <div className="card shadow-sm border-0 rounded-3 bg-white p-5 text-center text-secondary">
                <div style={{ fontSize: "3rem" }}>🏷️</div>
                <h5 className="mt-3 fw-bold">{t("bar_no_products") || "No products with platform-generated barcodes found."}</h5>
                <p className="small mb-0 text-muted">
                  {lang === "bn" ? "নতুন প্রোডাক্ট তৈরি বা পারচেজ করলে এখানে তাদের বারকোড দেখতে পাবেন।" : "Products with platform barcodes will appear here automatically."}
                </p>
              </div>
            ) : (
              <div className="row g-3">
                {filteredProducts.map((product) => {
                  const mainBarcode = product.barcode || product.sku || `PROD-${product.id}`;
                  const inStockCount = Number(product.current_stock) || 0;
                  const unitCount = product.units?.length || 0;

                  return (
                    <div key={product.id} className="col-12 col-md-6 col-lg-4 col-xl-3">
                      <div className="card h-100 shadow-sm border-0 rounded-3 bg-white overflow-hidden d-flex flex-column justify-content-between">
                        {/* Card Header & Details */}
                        <div className="p-3 border-bottom bg-light bg-opacity-50">
                          <div className="d-flex justify-content-between align-items-start gap-2">
                            <h6 className="fw-bold text-dark mb-1 text-truncate" title={product.name}>
                              {product.name}
                            </h6>
                            <span className="badge bg-primary bg-opacity-10 text-primary border border-primary-subtle rounded-pill">
                              {money(product.selling_price)}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between align-items-center small text-secondary mt-1">
                            <span>SKU: <strong className="text-dark">{product.sku || "—"}</strong></span>
                            <span>Stock: <strong className={inStockCount > 0 ? "text-success" : "text-danger"}>{inStockCount}</strong></span>
                          </div>
                          {product.warranty_months ? (
                            <div className="small text-info mt-1">
                              🛡️ {product.warranty_months} {lang === "bn" ? "মাস ওয়ারেন্টি" : "Mo Warranty"}
                            </div>
                          ) : null}
                        </div>

                        {/* Live Barcode Sticker Preview Box */}
                        <div className="p-3 d-flex flex-column align-items-center justify-content-center bg-white flex-grow-1">
                          <div
                            className="border rounded-2 p-2 w-100 d-flex flex-column align-items-center justify-content-center shadow-xs bg-white"
                            style={{ maxWidth: "220px" }}
                          >
                            {showShopName && (
                              <div style={{ fontSize: "10px", fontWeight: "700", color: "#1e293b", letterSpacing: "0.5px" }} className="text-truncate w-100 text-center">
                                {shopName}
                              </div>
                            )}
                            <div style={{ fontSize: "10px", fontWeight: "600", color: "#475569" }} className="text-truncate w-100 text-center mb-1">
                              {product.name}
                            </div>
                            <div className="d-flex justify-content-center w-100 overflow-hidden my-1">
                              <Barcode
                                value={mainBarcode}
                                width={1.2}
                                height={35}
                                fontSize={10}
                                margin={0}
                                displayValue={showCodeText}
                                background="transparent"
                              />
                            </div>
                            <div className="d-flex justify-content-between align-items-center w-100 small mt-1" style={{ fontSize: "10px" }}>
                              {showPrice && <span className="fw-bold text-dark">Price: {money(product.selling_price)}</span>}
                              {showWarranty && product.warranty_months ? (
                                <span className="text-muted">{product.warranty_months}m war.</span>
                              ) : null}
                            </div>
                          </div>

                          {unitCount > 0 && (
                            <div className="small text-muted mt-2">
                              🔢 {unitCount} {lang === "bn" ? "টি আলাদা সিরিয়াল বারকোড রয়েছে" : "individual serial barcodes"}
                            </div>
                          )}
                        </div>

                        {/* Card Action Footer */}
                        <div className="p-3 pt-0">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-brand w-100 fw-bold d-flex align-items-center justify-content-center gap-1"
                            onClick={() => openSinglePrint(product)}
                          >
                            🖨️ {t("bar_btn_print_single") || "Print Barcode"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: BLANK RANDOM BARCODE GENERATOR ── */}
        {activeTab === "generator" && (
          <div className="vstack gap-3">
            <div className="card shadow-sm border-0 bg-white rounded-3">
              <div className="card-body p-4">
                <div className="row g-3 align-items-end">
                  <div className="col-md-4">
                    <label className="form-label small fw-medium text-secondary">{t("bar_lbl_num")}</label>
                    <input
                      type="number"
                      className="form-control"
                      min={1}
                      max={500}
                      value={genQuantity}
                      onChange={(e) => setGenQuantity(Number(e.target.value))}
                    />
                  </div>
                  <div className="col-md-4">
                    <button className="btn btn-primary w-100 fw-medium" onClick={generateRandomBarcodes}>
                      {t("bar_btn_gen")}
                    </button>
                  </div>
                  <div className="col-md-4">
                    <div className="text-secondary small h-100 d-flex align-items-center">
                      {t("bar_lbl_note")}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {generatedCodes.length > 0 ? (
              <>
                <div className="d-flex justify-content-between align-items-center">
                  <h6 className="fw-bold mb-0">{generatedCodes.length} Barcodes Generated</h6>
                  <button className="btn btn-brand shadow-sm fw-medium btn-sm px-4" onClick={printAllGenerated}>
                    🖨️ {t("bar_btn_print_all", { count: generatedCodes.length })}
                  </button>
                </div>
                <div className="row g-3">
                  {generatedCodes.map((code, idx) => (
                    <div key={idx} className="col-6 col-md-4 col-lg-3 col-xl-2">
                      <div className="card shadow-sm text-center h-100 border-0 bg-white rounded-3">
                        <div className="card-body d-flex flex-column align-items-center justify-content-center p-3">
                          <div className="bg-light rounded p-2 mb-3 w-100 d-flex justify-content-center">
                            <Barcode value={code} width={1.2} height={40} fontSize={12} background="transparent" />
                          </div>
                          <button className="btn btn-sm btn-outline-secondary w-100" onClick={() => printOneGenerated(idx)}>
                            {t("bar_btn_print_target")}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="card shadow-sm border-0 bg-white rounded-3">
                <div className="card-body p-5 text-center text-secondary">
                  <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🖨️</div>
                  <h5>{t("bar_no_gen_title")}</h5>
                  <p className="mb-0">{t("bar_no_gen_desc")}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── SINGLE PRODUCT PRINT MODAL ── */}
      {singleModalOpen && selectedProduct && (
        <div
          className="modal show d-block no-print"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1060 }}
          tabIndex={-1}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden">
              <div className="modal-header bg-light py-3 px-4">
                <h5 className="modal-title fw-bold text-dark mb-0">
                  🖨️ {t("bar_single_modal_title") || "Print Product Barcode Sticker"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSingleModalOpen(false)}
                ></button>
              </div>

              <div className="modal-body p-4 vstack gap-3">
                {/* Product Summary Header */}
                <div className="p-3 bg-light rounded-3 border d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="fw-bold text-dark mb-0">{selectedProduct.name}</h6>
                    <div className="small text-secondary">SKU: {selectedProduct.sku || "—"} · Price: {money(selectedProduct.selling_price)}</div>
                  </div>
                  <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill">
                    Stock: {selectedProduct.current_stock}
                  </span>
                </div>

                {/* Print Options */}
                {selectedProduct.units && selectedProduct.units.length > 0 && (
                  <div>
                    <label className="form-label small fw-bold text-dark mb-1">
                      {lang === "bn" ? "প্রিন্ট মোড নির্বাচন করুন" : "Select Print Mode"}
                    </label>
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className={`btn btn-sm flex-fill ${singleUnitMode === "main" ? "btn-brand fw-bold" : "btn-outline-secondary bg-white"}`}
                        onClick={() => setSingleUnitMode("main")}
                      >
                        🏷️ {lang === "bn" ? "মেইন বারকোড কপি" : "Main Barcode Copies"}
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm flex-fill ${singleUnitMode === "units" ? "btn-brand fw-bold" : "btn-outline-secondary bg-white"}`}
                        onClick={() => setSingleUnitMode("units")}
                      >
                        🔢 {lang === "bn" ? `আলাদা সিরিয়াল (${selectedProduct.units.length}টি)` : `Serial Units (${selectedProduct.units.length})`}
                      </button>
                    </div>
                  </div>
                )}

                {singleUnitMode === "main" && (
                  <div>
                    <label className="form-label small fw-bold text-dark mb-1">
                      {t("bar_lbl_copies") || "Sticker Copies (কপি সংখ্যা)"}
                    </label>
                    <div className="d-flex align-items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={500}
                        className="form-control fw-bold text-primary"
                        value={singleCopies}
                        onChange={(e) => setSingleCopies(Math.max(1, Number(e.target.value)))}
                      />
                      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setSingleCopies(1)}>1</button>
                      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setSingleCopies(5)}>5</button>
                      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setSingleCopies(10)}>10</button>
                      {Number(selectedProduct.current_stock) > 0 && (
                        <button type="button" className="btn btn-outline-success btn-sm" onClick={() => setSingleCopies(Math.floor(Number(selectedProduct.current_stock)))}>
                          All Stock ({selectedProduct.current_stock})
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Sticker Live Preview */}
                <div className="p-3 bg-light rounded-3 border d-flex flex-column align-items-center">
                  <span className="small text-secondary fw-semibold mb-2">👁️ {lang === "bn" ? "লাইভ স্টিকার প্রিভিউ" : "Sticker Live Preview"}</span>
                  <div
                    className="border rounded-2 p-2 bg-white d-flex flex-column align-items-center shadow-sm"
                    style={{ width: "200px" }}
                  >
                    {showShopName && (
                      <div style={{ fontSize: "10px", fontWeight: "700", color: "#1e293b" }} className="text-truncate w-100 text-center">
                        {shopName}
                      </div>
                    )}
                    <div style={{ fontSize: "10px", fontWeight: "600", color: "#475569" }} className="text-truncate w-100 text-center mb-1">
                      {selectedProduct.name}
                    </div>
                    <Barcode
                      value={selectedProduct.barcode || selectedProduct.sku || `PROD-${selectedProduct.id}`}
                      width={1.2}
                      height={32}
                      fontSize={10}
                      margin={0}
                      displayValue={showCodeText}
                      background="transparent"
                    />
                    <div className="d-flex justify-content-between align-items-center w-100 small mt-1" style={{ fontSize: "10px" }}>
                      {showPrice && <span className="fw-bold text-dark">{money(selectedProduct.selling_price)}</span>}
                      {showWarranty && selectedProduct.warranty_months ? (
                        <span className="text-muted">{selectedProduct.warranty_months}m war.</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer bg-light p-3 d-flex justify-content-between">
                <button
                  type="button"
                  className="btn btn-outline-secondary px-4"
                  onClick={() => setSingleModalOpen(false)}
                >
                  {lang === "bn" ? "বাতিল" : "Cancel"}
                </button>
                <button
                  type="button"
                  className="btn btn-brand px-4 fw-bold"
                  onClick={triggerSinglePrint}
                >
                  🖨️ {lang === "bn" ? `প্রিন্ট করুন (${singleUnitMode === "units" ? selectedProduct.units?.length : singleCopies}টি)` : `Print Stickers (${singleUnitMode === "units" ? selectedProduct.units?.length : singleCopies})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── BULK ALL PRODUCTS PRINT MODAL ── */}
      {bulkModalOpen && (
        <div
          className="modal show d-block no-print"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1060 }}
          tabIndex={-1}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden">
              <div className="modal-header bg-light py-3 px-4">
                <h5 className="modal-title fw-bold text-dark mb-0">
                  🖨️ {t("bar_all_modal_title") || "Bulk Print All Product Barcodes"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setBulkModalOpen(false)}
                ></button>
              </div>

              <div className="modal-body p-4 vstack gap-3">
                <div className="alert alert-primary mb-0 small">
                  {lang === "bn"
                    ? `আপনার স্টোরের মোট ${platformProducts.length}টি বারকোডযুক্ত প্রোডাক্ট রয়েছে। আপনি নিচের অপশনগুলো থেকে প্রিন্ট মোড বাছাই করতে পারেন:`
                    : `You have ${platformProducts.length} products with barcodes in your store. Choose your bulk printing mode:`}
                </div>

                <div className="vstack gap-2">
                  <label
                    className={`card p-3 border rounded-3 cursor-pointer ${bulkMode === "1_per_product" ? "border-primary bg-primary bg-opacity-10" : "bg-white"}`}
                    onClick={() => setBulkMode("1_per_product")}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <input
                        type="radio"
                        className="form-check-input"
                        name="bulkPrintOption"
                        checked={bulkMode === "1_per_product"}
                        onChange={() => setBulkMode("1_per_product")}
                      />
                      <div>
                        <div className="fw-bold text-dark">{t("bar_print_mode_1per") || "1 sticker per product"}</div>
                        <div className="small text-secondary">
                          {lang === "bn" ? `প্রতিটি প্রোডাক্টের মেইন বারকোডের ১টি করে স্টিকার (${platformProducts.length}টি স্টিকার)` : `Prints 1 label per catalog item (${platformProducts.length} total labels)`}
                        </div>
                      </div>
                    </div>
                  </label>

                  <label
                    className={`card p-3 border rounded-3 cursor-pointer ${bulkMode === "all_stock_units" ? "border-primary bg-primary bg-opacity-10" : "bg-white"}`}
                    onClick={() => setBulkMode("all_stock_units")}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <input
                        type="radio"
                        className="form-check-input"
                        name="bulkPrintOption"
                        checked={bulkMode === "all_stock_units"}
                        onChange={() => setBulkMode("all_stock_units")}
                      />
                      <div>
                        <div className="fw-bold text-dark">{t("bar_print_mode_stock") || "1 sticker for each in-stock unit"}</div>
                        <div className="small text-secondary">
                          {lang === "bn" ? "স্টকে থাকা প্রতিটি পিস/সিরিয়াল পণ্যের জন্য আলাদা স্টিকার প্রিন্ট হবে" : "Prints 1 label for every available unit in inventory"}
                        </div>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="modal-footer bg-light p-3 d-flex justify-content-between">
                <button
                  type="button"
                  className="btn btn-outline-secondary px-4"
                  onClick={() => setBulkModalOpen(false)}
                >
                  {lang === "bn" ? "বাতিল" : "Cancel"}
                </button>
                <button
                  type="button"
                  className="btn btn-brand px-4 fw-bold"
                  onClick={triggerBulkPrint}
                >
                  🖨️ {lang === "bn" ? "সকল বারকোড প্রিন্ট শুরু করুন" : "Start Bulk Printing"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── HIDDEN PRINT ROOT (FOR THERMAL PRINTERS & A4 SHEETS) ── */}
      {isPrinting && printQueue.length > 0 && (
        <div id="print-root">
          {labelSize === "a4" ? (
            <div className="label-a4-grid">
              {printQueue.map((item, idx) => (
                <div key={`${item.id}-${idx}`} className="label-a4-item">
                  {showShopName && (
                    <div style={{ fontSize: "9px", fontWeight: "700", color: "#000" }} className="text-truncate w-100 text-center">
                      {item.shopName}
                    </div>
                  )}
                  <div style={{ fontSize: "9px", fontWeight: "600", color: "#000" }} className="text-truncate w-100 text-center">
                    {item.productName}
                  </div>
                  <Barcode
                    value={item.barcode}
                    width={1.2}
                    height={30}
                    fontSize={9}
                    margin={0}
                    displayValue={showCodeText}
                    background="transparent"
                  />
                  <div className="d-flex justify-content-between align-items-center w-100" style={{ fontSize: "8px" }}>
                    {showPrice && item.price ? <strong>{money(item.price)}</strong> : <span />}
                    {showWarranty && item.warrantyMonths ? <span>{item.warrantyMonths}m war.</span> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            printQueue.map((item, idx) => (
              <div
                key={`${item.id}-${idx}`}
                className={labelSize === "50x30" ? "label-50x30" : "label-38x25"}
              >
                {showShopName && (
                  <div style={{ fontSize: labelSize === "50x30" ? "10px" : "8px", fontWeight: "700", color: "#000" }} className="text-truncate w-100 text-center">
                    {item.shopName}
                  </div>
                )}
                <div style={{ fontSize: labelSize === "50x30" ? "9.5px" : "7.5px", fontWeight: "600", color: "#000" }} className="text-truncate w-100 text-center">
                  {item.productName}
                </div>
                <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
                  <Barcode
                    value={item.barcode}
                    width={labelSize === "50x30" ? 1.4 : 1.15}
                    height={labelSize === "50x30" ? 34 : 26}
                    fontSize={labelSize === "50x30" ? 9 : 7.5}
                    margin={0}
                    displayValue={showCodeText}
                    background="transparent"
                  />
                </div>
                <div className="d-flex justify-content-between align-items-center w-100" style={{ fontSize: labelSize === "50x30" ? "8.5px" : "7px" }}>
                  {showPrice && item.price ? <strong style={{ color: "#000" }}>Price: {money(item.price)}</strong> : <span />}
                  {showWarranty && item.warrantyMonths ? <span style={{ color: "#000" }}>{item.warrantyMonths}m war.</span> : null}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
}

