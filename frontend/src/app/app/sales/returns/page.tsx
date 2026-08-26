"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { money, fmtDate } from "@/components/ui";
import toast from "react-hot-toast";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/components/AuthProvider";
import { useScannerWebSocket } from "@/hooks/useScannerWebSocket";
import Swal from "sweetalert2";

export default function ReturnsPage() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"return" | "replace">("return");
  
  // Return State
  const [barcode, setBarcode] = useState("");
  const [scanResult, setScanResult] = useState<any>(null);
  const [action, setAction] = useState("restock");
  const [refundMethod, setRefundMethod] = useState("cash");
  
  // Replace State
  const [oldBarcode, setOldBarcode] = useState("");
  const [newBarcode, setNewBarcode] = useState("");
  const [oldScanResult, setOldScanResult] = useState<any>(null);
  const [newScanResult, setNewScanResult] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  const returnInputRef = useRef<HTMLInputElement>(null);
  const oldBarcodeRef = useRef<HTMLInputElement>(null);
  const newBarcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeTab === "return") {
      returnInputRef.current?.focus();
    } else {
      oldBarcodeRef.current?.focus();
    }
  }, [activeTab]);

  const showUnitNotSoldAlert = (errData: any, scannedBarcode: string) => {
    const isBangla = lang === "bn";
    const prodName = errData?.product_name || (isBangla ? "পণ্য" : "Product");
    const code = errData?.barcode || scannedBarcode;
    const statusDisp = errData?.status_display || (errData?.unit_status === "in_stock" ? (isBangla ? "স্টকে বিদ্যমান" : "In Stock") : errData?.unit_status || "In Stock");

    Swal.fire({
      icon: "info",
      title: isBangla ? "পণ্যটি বর্তমানে স্টকে রয়েছে (বিক্রয় হয়নি)" : "Item is Currently In Stock (Not Sold)",
      html: `
        <div class="text-start mt-2">
          <div class="alert alert-warning mb-3 py-2 px-3 small border-0 bg-warning-subtle text-warning-emphasis rounded">
            <i class="bi bi-exclamation-triangle-fill me-1"></i>
            ${isBangla 
              ? "<strong>রিটার্ন করা সম্ভব নয়:</strong> এই বারকোডের পণ্যটি এখনও কোনো কাস্টমারের কাছে বিক্রয় করা হয়নি। এটি আপনার দোকানে বিক্রির জন্য প্রস্তুত রয়েছে।" 
              : "<strong>Cannot Process Return:</strong> This item has not been sold yet and is currently available in your shop inventory for sale."}
          </div>
          <div class="list-group list-group-flush border rounded mb-3 small">
            <div class="list-group-item d-flex justify-content-between py-2">
              <span class="text-secondary">${isBangla ? "পণ্যের নাম:" : "Product Name:"}</span>
              <span class="fw-semibold text-end">${prodName}</span>
            </div>
            <div class="list-group-item d-flex justify-content-between py-2">
              <span class="text-secondary">${isBangla ? "বারকোড:" : "Barcode:"}</span>
              <span class="font-monospace fw-bold text-primary">${code}</span>
            </div>
            <div class="list-group-item d-flex justify-content-between py-2">
              <span class="text-secondary">${isBangla ? "বর্তমান স্ট্যাটাস:" : "Current Status:"}</span>
              <span class="badge bg-success-subtle text-success border">${statusDisp}</span>
            </div>
          </div>
          <p class="text-muted small mb-0">
            ${isBangla
              ? "💡 <em>শুধুমাত্র পূর্বে বিক্রয় হওয়া ইনভয়েসের পণ্যসমূহ রিটার্ন বা এক্সচেঞ্জ করা যায়।</em>"
              : "💡 <em>Only items that were previously sold with an invoice can be returned or exchanged.</em>"}
          </p>
        </div>
      `,
      confirmButtonText: isBangla ? "ঠিক আছে, বুঝেছি" : "OK, Understood",
      confirmButtonColor: "#2563eb",
    });
  };

  // Core Return scan executor (used by form submit & scanner app websocket)
  const executeReturnScan = useCallback(async (codeVal: string) => {
    const scannedVal = codeVal.trim();
    if (!scannedVal) return;
    
    setLoading(true);
    setScanResult(null);
    try {
      const res = await api<any>(`/sales/sales/scan-return/?barcode=${encodeURIComponent(scannedVal)}`);
      setScanResult(res);
      toast.success(t("ret_barcode_found"));
    } catch (err: any) {
      if (err?.data?.error_code === "UNIT_NOT_SOLD" || err?.data?.unit_status === "in_stock" || (err?.message && err.message.toLowerCase().includes("in stock"))) {
        showUnitNotSoldAlert(err?.data, scannedVal);
      } else {
        toast.error(err?.data?.detail || err?.message || t("ret_invalid_barcode"));
      }
    } finally {
      setLoading(false);
      setBarcode("");
      returnInputRef.current?.focus();
    }
  }, [t, lang]);

  // Handle standard Return scan from UI form
  const handleReturnScan = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeReturnScan(barcode);
  };

  const processReturn = async () => {
    if (!scanResult) return;
    setProcessing(true);
    try {
      await api<any>("/sales/sales/process-scan-return/", {
        method: "POST",
        body: {
          barcode: scanResult.unit.barcode,
          action: action,
          refund_method: refundMethod
        }
      });
      toast.success(t("ret_success"));
      setScanResult(null);
      returnInputRef.current?.focus();
    } catch (err: any) {
      toast.error(err?.message || t("ret_failed"));
    } finally {
      setProcessing(false);
    }
  };

  // Core Replace scan executor (used by form submit & scanner app websocket)
  const executeReplaceScan = useCallback(async (codeVal: string, type: "old" | "new") => {
    const val = codeVal.trim();
    if (!val) return;
    
    setLoading(true);
    try {
      if (type === "old") {
        const res = await api<any>(`/sales/sales/scan-return/?barcode=${encodeURIComponent(val)}`);
        setOldScanResult(res);
        toast.success(t("ret_orig_found"));
        setOldBarcode("");
        newBarcodeRef.current?.focus();
      } else {
        // Fetch the physical unit by barcode (response may be paginated).
        const res = await api<any>(`/catalog/product-units/?barcode=${encodeURIComponent(val)}`);
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        const unit = list[0];
        if (!unit) {
          throw new Error(t("ret_new_not_found"));
        }
        if (String(unit.status).toLowerCase() !== "in_stock") {
          throw new Error(t("ret_new_not_in_stock"));
        }
        setNewScanResult(unit);
        toast.success(t("ret_new_found"));
        setNewBarcode("");
      }
    } catch (err: any) {
      if (type === "old" && (err?.data?.error_code === "UNIT_NOT_SOLD" || err?.data?.unit_status === "in_stock" || (err?.message && err.message.toLowerCase().includes("in stock")))) {
        showUnitNotSoldAlert(err?.data, val);
      } else {
        toast.error(err?.data?.detail || err?.message || t("ret_invalid_barcode_gen"));
      }
    } finally {
      setLoading(false);
    }
  }, [t, lang]);

  // Handle Replace scan from UI form
  const handleReplaceScan = async (e: React.FormEvent, type: "old" | "new") => {
    e.preventDefault();
    const val = type === "old" ? oldBarcode : newBarcode;
    await executeReplaceScan(val, type);
  };

  // Connect Mobile StockWhisk Barcode Scanner via WebSocket
  const { isConnected: scannerConnected } = useScannerWebSocket(user?.shop, (scannedCode) => {
    if (!scannedCode || !scannedCode.trim()) return;
    const cleanCode = scannedCode.trim();

    if (activeTab === "return") {
      setBarcode(cleanCode);
      executeReturnScan(cleanCode);
    } else {
      if (!oldScanResult) {
        setOldBarcode(cleanCode);
        executeReplaceScan(cleanCode, "old");
      } else {
        setNewBarcode(cleanCode);
        executeReplaceScan(cleanCode, "new");
      }
    }
  });

  const processReplace = async () => {
    if (!oldScanResult || !newScanResult) return;
    setProcessing(true);
    try {
      await api<any>("/sales/sales/replace-unit/", {
        method: "POST",
        body: {
          old_barcode: oldScanResult.unit.barcode,
          new_barcode: newScanResult.barcode
        }
      });
      toast.success(t("ret_replace_success"));
      setOldScanResult(null);
      setNewScanResult(null);
      oldBarcodeRef.current?.focus();
    } catch (err: any) {
      toast.error(err?.message || t("ret_replace_failed"));
    } finally {
      setProcessing(false);
    }
  };

  const clearReplace = () => {
    setOldScanResult(null);
    setNewScanResult(null);
    oldBarcodeRef.current?.focus();
  };

  return (
    <div className="vstack gap-4" style={{ maxWidth: "800px", margin: "0 auto" }}>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h4 className="fw-bold m-0">{t("ret_title")}</h4>
        <div className="d-flex align-items-center gap-2 small fw-medium">
          <span className={`d-inline-block rounded-circle ${scannerConnected ? 'bg-success' : 'bg-secondary'}`} style={{ width: 8, height: 8 }}></span>
          <span className={scannerConnected ? 'text-success' : 'text-secondary'}>
            {scannerConnected 
              ? (lang === "bn" ? "স্ক্যানার অ্যাপ কানেক্টেড" : "Scanner App Connected")
              : (lang === "bn" ? "স্ক্যানার অ্যাপ ডিসকানেক্টেড" : "Scanner App Disconnected")}
          </span>
        </div>
      </div>

      <ul className="nav nav-pills gap-2 mb-2">
        <li className="nav-item">
          <button 
            className={`nav-link fw-medium ${activeTab === "return" ? "active" : "bg-secondary bg-opacity-10 text-body border shadow-sm"}`}
            onClick={() => setActiveTab("return")}
          >
            <i className="bi bi-arrow-return-left me-2"></i> {t("ret_tab_return")}
          </button>
        </li>
        <li className="nav-item flex-fill text-center">
          <button 
            className={`nav-link fw-medium ${activeTab === "replace" ? "active" : "bg-secondary bg-opacity-10 text-body border shadow-sm"}`}
            onClick={() => setActiveTab("replace")}
          >
            <i className="bi bi-arrow-left-right me-2"></i> {t("ret_tab_replace")}
          </button>
        </li>
      </ul>

      {activeTab === "return" ? (
        <>
          <div className="card shadow-sm border-0">
            <div className="card-body p-4">
              <form onSubmit={handleReturnScan} className="d-flex gap-2">
                <div className="flex-grow-1 position-relative">
                  <i className="bi bi-upc-scan position-absolute top-50 start-0 translate-middle-y ms-3 text-secondary"></i>
                  <input
                    ref={returnInputRef}
                    type="text"
                    className="form-control form-control-lg ps-5"
                    placeholder={t("ret_scan_return_ph")}
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    disabled={loading || processing}
                  />
                </div>
                <button type="submit" className="btn btn-brand btn-lg px-4" disabled={!barcode.trim() || loading || processing}>
                  {loading ? <span className="spinner-border spinner-border-sm"></span> : t("ret_scan_btn")}
                </button>
              </form>
            </div>
          </div>

          {scanResult && (
            <div className="card shadow-sm border-0 border-top border-brand border-4">
              <div className="card-body p-4 vstack gap-4">
                <div>
                  <h5 className="fw-bold mb-3 border-bottom pb-2">{t("ret_item_details")}</h5>
                  <div className="row g-3">
                    <div className="col-sm-6">
                      <div className="text-secondary small mb-1">{t("ret_product")}</div>
                      <div className="fw-medium">{scanResult.unit.product_name}</div>
                      {scanResult.unit.variation_name && (
                        <div className="small text-muted">{scanResult.unit.variation_name}</div>
                      )}
                    </div>
                    <div className="col-sm-3">
                      <div className="text-secondary small mb-1">{t("ret_barcode")}</div>
                      <div className="fw-medium font-monospace">{scanResult.unit.barcode}</div>
                    </div>
                    <div className="col-sm-3">
                      <div className="text-secondary small mb-1">{t("ret_selling_price")}</div>
                      <div className="fw-bold text-success">{money(scanResult.unit.selling_price || 0)}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-secondary bg-opacity-10 border rounded p-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="fw-bold">{t("ret_orig_invoice")}</div>
                    <Link href={`/app/sales/${scanResult.sale.id}`} target="_blank" className="btn btn-sm btn-outline-secondary">
                      {t("ret_view_invoice")} <i className="bi bi-box-arrow-up-right ms-1"></i>
                    </Link>
                  </div>
                  <div className="row g-3">
                    <div className="col-sm-4">
                      <div className="text-secondary small">{t("ret_invoice_no")}</div>
                      <div>{scanResult.sale.invoice_no || `#${scanResult.sale.id}`}</div>
                    </div>
                    <div className="col-sm-4">
                      <div className="text-secondary small">{t("ret_date")}</div>
                      <div>{fmtDate(scanResult.sale.sale_date)}</div>
                    </div>
                    <div className="col-sm-4">
                      <div className="text-secondary small">Customer</div>
                      <div>{scanResult.sale.customer_name || "Walk-in"}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h5 className="fw-bold mb-3 border-bottom pb-2">{t("ret_action_title")}</h5>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label fw-medium">{t("ret_cond_title")}</label>
                      <select 
                        className="form-select" 
                        value={action} 
                        onChange={e => setAction(e.target.value)}
                        disabled={processing}
                      >
                        <option value="restock">{t("ret_cond_restock")}</option>
                        <option value="defective">{t("ret_cond_defective")}</option>
                        <option value="return_supplier">{t("ret_cond_supplier")}</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-medium">{t("ret_refund_title")}</label>
                      <select 
                        className="form-select" 
                        value={refundMethod} 
                        onChange={e => setRefundMethod(e.target.value)}
                        disabled={processing}
                      >
                        <option value="cash">{t("ret_ref_cash")}</option>
                        <option value="bkash">{t("ret_ref_bkash")}</option>
                        <option value="card">{t("ret_ref_card")}</option>
                        <option value="wallet">{t("ret_ref_wallet")}</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="d-flex justify-content-end gap-2 mt-2 border-top pt-3">
                  <button 
                    type="button" 
                    className="btn btn-light" 
                    onClick={() => setScanResult(null)}
                    disabled={processing}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-danger px-4" 
                    onClick={processReturn}
                    disabled={processing}
                  >
                    {processing ? <span className="spinner-border spinner-border-sm"></span> : t("ret_btn_process")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="row g-3">
            <div className="col-md-6">
              <div className="card shadow-sm border-0 h-100">
                <div className="card-header bg-secondary bg-opacity-10 fw-bold text-danger border-bottom-0 pt-3">
                  {t("ret_rep_step1")}
                </div>
                <div className="card-body p-4">
                  {!oldScanResult ? (
                    <form onSubmit={e => handleReplaceScan(e, "old")} className="d-flex gap-2">
                      <div className="flex-grow-1 position-relative">
                        <i className="bi bi-upc-scan position-absolute top-50 start-0 translate-middle-y ms-3 text-secondary"></i>
                        <input
                          ref={oldBarcodeRef}
                          type="text"
                          className="form-control"
                          placeholder={t("ret_rep_scan_old_ph")}
                          value={oldBarcode}
                          onChange={(e) => setOldBarcode(e.target.value)}
                          disabled={loading || processing}
                        />
                      </div>
                      <button type="submit" className="btn btn-danger" disabled={!oldBarcode.trim() || loading || processing}>
                        Scan
                      </button>
                    </form>
                  ) : (
                    <div className="alert alert-danger mb-0 d-flex justify-content-between align-items-center">
                      <div>
                        <strong>{oldScanResult.unit.product_name}</strong>
                        <div className="small font-monospace">{oldScanResult.unit.barcode}</div>
                      </div>
                      <div className="text-end">
                        <div className="fw-bold">{money(oldScanResult.unit.selling_price)}</div>
                        <div className="small">{t("ret_rep_inv")} {oldScanResult.sale.invoice_no}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="card shadow-sm border-0 h-100">
                <div className="card-header bg-secondary bg-opacity-10 fw-bold text-success border-bottom-0 pt-3">
                  {t("ret_rep_step2")}
                </div>
                <div className="card-body p-4">
                  {!newScanResult ? (
                    <form onSubmit={e => handleReplaceScan(e, "new")} className="d-flex gap-2">
                      <div className="flex-grow-1 position-relative">
                        <i className="bi bi-upc-scan position-absolute top-50 start-0 translate-middle-y ms-3 text-secondary"></i>
                        <input
                          ref={newBarcodeRef}
                          type="text"
                          className="form-control"
                          placeholder={t("ret_rep_scan_new_ph")}
                          value={newBarcode}
                          onChange={(e) => setNewBarcode(e.target.value)}
                          disabled={loading || processing || !oldScanResult}
                        />
                      </div>
                      <button type="submit" className="btn btn-success" disabled={!newBarcode.trim() || loading || processing || !oldScanResult}>
                        Scan
                      </button>
                    </form>
                  ) : (
                    <div className="alert alert-success mb-0 d-flex justify-content-between align-items-center">
                      <div>
                        <strong>{newScanResult.product_name}</strong>
                        <div className="small font-monospace">{newScanResult.barcode}</div>
                      </div>
                      <div className="text-end">
                        <div className="fw-bold">{money(newScanResult.selling_price)}</div>
                        <div className="small">{t("ret_rep_in_stock")}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {(oldScanResult || newScanResult) && (
            <div className="card shadow-sm border-0 mt-2">
              <div className="card-body d-flex justify-content-between align-items-center p-3">
                <div>
                  {oldScanResult && newScanResult && (
                    <div className="fw-medium">
                      {t("ret_rep_diff")} 
                      <span className={Number(newScanResult.selling_price) > Number(oldScanResult.unit.selling_price) ? "text-danger fw-bold ms-2" : "text-success fw-bold ms-2"}>
                        {money(Number(newScanResult.selling_price) - Number(oldScanResult.unit.selling_price))}
                      </span>
                    </div>
                  )}
                </div>
                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-light px-4" onClick={clearReplace} disabled={processing}>
                    Clear
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-brand px-4" 
                    onClick={processReplace} 
                    disabled={!oldScanResult || !newScanResult || processing}
                  >
                    {processing ? <span className="spinner-border spinner-border-sm"></span> : t("ret_btn_exchange")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
