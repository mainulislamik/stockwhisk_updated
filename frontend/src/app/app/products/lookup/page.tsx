"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { api, unwrap } from "@/lib/api";
import { money, Spinner } from "@/components/ui";
import toast from "react-hot-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/components/AuthProvider";
import { useScannerWebSocket } from "@/hooks/useScannerWebSocket";

type Product = {
  id: number;
  name: string;
  sku: string;
  barcode: string;
  selling_price: string;
  cost_price: string;
  current_stock: string | number;
  category?: { id: number; name: string };
  brand?: { id: number; name: string };
  warranty_months?: number;
};

export default function ItemLookupPage() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Product[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = useCallback(async (query: string) => {
    const term = query.trim();
    if (!term) return;
    setBusy(true);
    try {
      const data = await api("/catalog/products/", { params: { search: term } });
      const list = unwrap<Product>(data);
      setRows(Array.isArray(list) ? list : []);
      setSearched(true);
    } catch (err: any) {
      toast.error(err?.message || t("lkp_err_failed"));
    } finally {
      setBusy(false);
    }
  }, [t]);

  // Handle Mobile StockWhisk Barcode Scanner via WebSocket
  const { isConnected: scannerConnected } = useScannerWebSocket(user?.shop, (scannedCode) => {
    if (!scannedCode || !scannedCode.trim()) return;
    const cleanCode = scannedCode.trim();
    setQ(cleanCode);
    doSearch(cleanCode);
    toast.success(lang === "bn" ? `স্ক্যান করা হয়েছে: ${cleanCode}` : `Scanned: ${cleanCode}`, { id: "scanner-toast" });
  });

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (q.trim()) {
        doSearch(q);
      } else {
        setRows([]);
        setSearched(false);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [q, doSearch]);

  function search(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) doSearch(q);
  }

  function clearSearch() {
    setQ("");
    setRows([]);
    setSearched(false);
    inputRef.current?.focus();
  }

  return (
    <div className="vstack gap-4" style={{ maxWidth: "56rem" }}>
      {/* Header with Title & Scanner App Status */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
        <h4 className="fw-bold m-0 text-dark">
          🔍 {t("lkp_title") || "আইটেম লুকআপ"}
        </h4>
        <div className="d-flex align-items-center gap-2 small fw-medium">
          <span
            className={`d-inline-block rounded-circle ${scannerConnected ? "bg-success" : "bg-secondary"}`}
            style={{ width: 8, height: 8 }}
          ></span>
          <span className={scannerConnected ? "text-success" : "text-secondary"}>
            {scannerConnected
              ? (lang === "bn" ? "স্ক্যানার অ্যাপ কানেক্টেড" : "Scanner App Connected")
              : (lang === "bn" ? "স্ক্যানার অ্যাপ ডিসকানেক্টেড" : "Scanner App Disconnected")}
          </span>
        </div>
      </div>

      {/* Search Card */}
      <div className="card shadow-sm border-0 rounded-3 bg-white">
        <div className="card-body p-3">
          <form onSubmit={search} className="d-flex gap-2">
            <div className="flex-grow-1 position-relative">
              <span className="position-absolute top-50 start-0 translate-middle-y ms-3 text-secondary">
                🔍
              </span>
              <input
                ref={inputRef}
                className="form-control form-control-lg ps-5 pe-5"
                placeholder={t("lkp_search_ph") || "বারকোড / এসকিউ (SKU) / নাম স্ক্যান বা টাইপ করুন..."}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
              />
              {q && (
                <button
                  type="button"
                  className="btn btn-link position-absolute top-50 end-0 translate-middle-y me-2 text-secondary text-decoration-none p-0"
                  onClick={clearSearch}
                  title="Clear"
                >
                  ✕
                </button>
              )}
            </div>
            <button className="btn btn-brand btn-lg px-4 fw-semibold" disabled={busy || !q.trim()}>
              {busy ? (
                <span className="spinner-border spinner-border-sm me-1"></span>
              ) : (
                t("lkp_btn_lookup") || "খুঁজুন"
              )}
            </button>
          </form>

          <div className="small text-muted mt-2 d-flex align-items-center gap-2">
            <span>💡</span>
            <span>
              {lang === "bn"
                ? "মোবাইল স্ক্যানার অ্যাপ দিয়ে পণ্যের বারকোড স্ক্যান করলেই সরাসরি এখানে লাইভ তথ্য দেখতে পাবেন।"
                : "Scan a product barcode using your mobile scanner app to instantly view live stock & details."}
            </span>
          </div>
        </div>
      </div>

      {/* Search Results Table */}
      {searched && (
        <div className="card shadow-sm border-0 rounded-3 bg-white overflow-hidden">
          <div className="card-header bg-light py-2.5 px-3 d-flex justify-content-between align-items-center">
            <span className="small fw-semibold text-secondary">
              {lang === "bn" ? `ফলাফল পাওয়া গেছে: ${rows.length}টি` : `Found: ${rows.length} product(s)`}
            </span>
            {rows.length > 0 && (
              <button type="button" className="btn btn-link btn-sm text-secondary p-0 text-decoration-none" onClick={clearSearch}>
                {lang === "bn" ? "মুছুন" : "Clear"}
              </button>
            )}
          </div>

          {busy ? (
            <div className="p-5 text-center">
              <Spinner label={lang === "bn" ? "তথ্য লোড হচ্ছে..." : "Loading..."} />
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr className="small text-secondary text-uppercase">
                    <th>{t("lkp_col_name") || "নাম ও ক্যাটাগরি"}</th>
                    <th>{lang === "bn" ? "বারকোড ও SKU" : "Barcode & SKU"}</th>
                    <th className="text-end">{t("lkp_col_price") || "বিক্রয় মূল্য"}</th>
                    <th className="text-center">{t("lkp_col_stock") || "বর্তমান স্টক"}</th>
                    <th className="text-end pe-3">{lang === "bn" ? "অ্যাকশন" : "Action"}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr data-empty="">
                      <td colSpan={5} className="text-center text-secondary py-5">
                        <div style={{ fontSize: "2rem" }}>🔍</div>
                        <div className="fw-semibold mt-2">{t("lkp_no_item") || "কোনো আইটেম পাওয়া যায়নি।"}</div>
                        <div className="small text-muted">
                          {lang === "bn" ? "সঠিক বারকোড, SKU বা নাম দিয়ে পুনরায় চেষ্টা করুন।" : "Try searching with a valid barcode, SKU or name."}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows.map((p) => {
                      const stockNum = Number(p.current_stock) || 0;
                      return (
                        <tr key={p.id}>
                          <td>
                            <Link href={`/app/products/${p.id}`} className="text-decoration-none fw-bold text-dark d-block">
                              {p.name}
                            </Link>
                            <div className="small text-secondary d-flex align-items-center gap-1.5 mt-0.5">
                              {p.category?.name && (
                                <span className="badge bg-light text-secondary border">{p.category.name}</span>
                              )}
                              {p.brand?.name && (
                                <span className="badge bg-light text-secondary border">{p.brand.name}</span>
                              )}
                              {p.warranty_months ? (
                                <span className="badge bg-info-subtle text-info border border-info-subtle">
                                  🛡️ {p.warranty_months}m
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td>
                            <div className="vstack gap-0.5">
                              {p.barcode ? (
                                <div className="font-monospace small fw-bold text-dark d-flex align-items-center gap-1">
                                  <span>🏷️</span> {p.barcode}
                                </div>
                              ) : null}
                              <div className="small text-muted">SKU: {p.sku || "—"}</div>
                            </div>
                          </td>
                          <td className="text-end fw-bold text-dark">
                            {money(p.selling_price)}
                          </td>
                          <td className="text-center">
                            <span
                              className={`badge rounded-pill ${
                                stockNum > 0
                                  ? "bg-success-subtle text-success border border-success-subtle"
                                  : "bg-danger-subtle text-danger border border-danger-subtle"
                              }`}
                            >
                              {stockNum > 0 ? `${stockNum} in stock` : "Out of stock"}
                            </span>
                          </td>
                          <td className="text-end pe-3">
                            <div className="d-inline-flex gap-1.5">
                              <Link
                                href={`/app/products/${p.id}`}
                                className="btn btn-sm btn-outline-secondary py-1 px-2.5 fw-medium"
                                style={{ fontSize: "0.8rem" }}
                              >
                                👁️ {lang === "bn" ? "প্রোফাইল" : "Profile"}
                              </Link>
                              <Link
                                href="/app/pos"
                                className="btn btn-sm btn-brand py-1 px-2.5 fw-semibold shadow-2xs"
                                style={{ fontSize: "0.8rem" }}
                              >
                                🛒 POS
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

