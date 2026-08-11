"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { money, fmtDate } from "@/components/ui";
import toast from "react-hot-toast";
import Link from "next/link";

export default function ReturnsPage() {
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

  // Handle standard Return scan
  const handleReturnScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) return;
    
    setLoading(true);
    setScanResult(null);
    try {
      const res = await api<any>(`/sales/sales/scan-return/?barcode=${encodeURIComponent(barcode.trim())}`);
      setScanResult(res);
      toast.success("Barcode found");
    } catch (err: any) {
      toast.error(err?.message || "Invalid or unsold barcode");
    } finally {
      setLoading(false);
      setBarcode("");
      returnInputRef.current?.focus();
    }
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
      toast.success("Product returned successfully!");
      setScanResult(null);
      returnInputRef.current?.focus();
    } catch (err: any) {
      toast.error(err?.message || "Failed to process return");
    } finally {
      setProcessing(false);
    }
  };

  // Handle Replace scan
  const handleReplaceScan = async (e: React.FormEvent, type: "old" | "new") => {
    e.preventDefault();
    const val = type === "old" ? oldBarcode.trim() : newBarcode.trim();
    if (!val) return;
    
    setLoading(true);
    try {
      // Re-use scan-return endpoint to just fetch unit details (we can bypass the SOLD check for new units on the backend later or fetch from inventory)
      // Actually, scan-return enforces SOLD status. We need to fetch IN_STOCK units differently.
      // Let's use the standard product unit lookup if it's new.
      if (type === "old") {
        const res = await api<any>(`/sales/sales/scan-return/?barcode=${encodeURIComponent(val)}`);
        setOldScanResult(res);
        toast.success("Original unit found");
        setOldBarcode("");
        newBarcodeRef.current?.focus();
      } else {
        // Fetch the physical unit by barcode (response may be paginated).
        const res = await api<any>(`/catalog/product-units/?barcode=${encodeURIComponent(val)}`);
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        const unit = list[0];
        if (!unit) {
          throw new Error("New barcode not found in stock.");
        }
        if (String(unit.status).toLowerCase() !== "in_stock") {
          throw new Error(`Replacement unit isn't in stock (status: ${unit.status}). Pick an unsold unit.`);
        }
        setNewScanResult(unit);
        toast.success("Replacement unit found");
        setNewBarcode("");
      }
    } catch (err: any) {
      toast.error(err?.message || "Invalid barcode");
    } finally {
      setLoading(false);
    }
  };

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
      toast.success("Product replaced successfully!");
      setOldScanResult(null);
      setNewScanResult(null);
      oldBarcodeRef.current?.focus();
    } catch (err: any) {
      toast.error(err?.message || "Failed to process replacement");
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
        <h4 className="fw-bold m-0">Returns & Replacements</h4>
      </div>

      <ul className="nav nav-pills gap-2 mb-2">
        <li className="nav-item">
          <button 
            className={`nav-link fw-medium ${activeTab === "return" ? "active" : "bg-secondary bg-opacity-10 text-body border shadow-sm"}`}
            onClick={() => setActiveTab("return")}
          >
            <i className="bi bi-arrow-return-left me-2"></i> Return & Refund
          </button>
        </li>
        <li className="nav-item flex-fill text-center">
          <button 
            className={`nav-link fw-medium ${activeTab === "replace" ? "active" : "bg-secondary bg-opacity-10 text-body border shadow-sm"}`}
            onClick={() => setActiveTab("replace")}
          >
            <i className="bi bi-arrow-left-right me-2"></i> Replace / Exchange
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
                    placeholder="Scan product barcode to return..."
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    disabled={loading || processing}
                  />
                </div>
                <button type="submit" className="btn btn-brand btn-lg px-4" disabled={!barcode.trim() || loading || processing}>
                  {loading ? <span className="spinner-border spinner-border-sm"></span> : "Scan"}
                </button>
              </form>
            </div>
          </div>

          {scanResult && (
            <div className="card shadow-sm border-0 border-top border-brand border-4">
              <div className="card-body p-4 vstack gap-4">
                <div>
                  <h5 className="fw-bold mb-3 border-bottom pb-2">Item Details</h5>
                  <div className="row g-3">
                    <div className="col-sm-6">
                      <div className="text-secondary small mb-1">Product</div>
                      <div className="fw-medium">{scanResult.unit.product_name}</div>
                      {scanResult.unit.variation_name && (
                        <div className="small text-muted">{scanResult.unit.variation_name}</div>
                      )}
                    </div>
                    <div className="col-sm-3">
                      <div className="text-secondary small mb-1">Barcode</div>
                      <div className="fw-medium font-monospace">{scanResult.unit.barcode}</div>
                    </div>
                    <div className="col-sm-3">
                      <div className="text-secondary small mb-1">Selling Price</div>
                      <div className="fw-bold text-success">{money(scanResult.unit.selling_price || 0)}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-secondary bg-opacity-10 border rounded p-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="fw-bold">Original Sale Invoice</div>
                    <Link href={`/app/sales/${scanResult.sale.id}`} target="_blank" className="btn btn-sm btn-outline-secondary">
                      View Invoice <i className="bi bi-box-arrow-up-right ms-1"></i>
                    </Link>
                  </div>
                  <div className="row g-3">
                    <div className="col-sm-4">
                      <div className="text-secondary small">Invoice No</div>
                      <div>{scanResult.sale.invoice_no || `#${scanResult.sale.id}`}</div>
                    </div>
                    <div className="col-sm-4">
                      <div className="text-secondary small">Date</div>
                      <div>{fmtDate(scanResult.sale.sale_date)}</div>
                    </div>
                    <div className="col-sm-4">
                      <div className="text-secondary small">Customer</div>
                      <div>{scanResult.sale.customer_name || "Walk-in"}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h5 className="fw-bold mb-3 border-bottom pb-2">Return Action</h5>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label fw-medium">Unit Condition</label>
                      <select 
                        className="form-select" 
                        value={action} 
                        onChange={e => setAction(e.target.value)}
                        disabled={processing}
                      >
                        <option value="restock">Good - Restock to Inventory</option>
                        <option value="defective">Defective / Damaged</option>
                        <option value="return_supplier">Return to Supplier</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-medium">Refund Method</label>
                      <select 
                        className="form-select" 
                        value={refundMethod} 
                        onChange={e => setRefundMethod(e.target.value)}
                        disabled={processing}
                      >
                        <option value="cash">Cash</option>
                        <option value="bkash">bKash</option>
                        <option value="card">Card / Bank</option>
                        <option value="wallet">Customer Wallet</option>
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
                    {processing ? <span className="spinner-border spinner-border-sm"></span> : "Process Return & Refund"}
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
                  1. Scan Original Unit
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
                          placeholder="Scan sold barcode..."
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
                        <div className="small">Invoice {oldScanResult.sale.invoice_no}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="card shadow-sm border-0 h-100">
                <div className="card-header bg-secondary bg-opacity-10 fw-bold text-success border-bottom-0 pt-3">
                  2. Scan Replacement Unit
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
                          placeholder="Scan new barcode..."
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
                        <div className="small">IN STOCK</div>
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
                      Difference: 
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
                    {processing ? <span className="spinner-border spinner-border-sm"></span> : "Process Exchange"}
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
