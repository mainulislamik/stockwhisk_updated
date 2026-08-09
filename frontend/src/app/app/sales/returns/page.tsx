"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { money, fmtDate } from "@/components/ui";
import toast from "react-hot-toast";
import Link from "next/link";

export default function ReturnsPage() {
  const [barcode, setBarcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  
  const [action, setAction] = useState("restock");
  const [refundMethod, setRefundMethod] = useState("cash");
  const [processing, setProcessing] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus barcode input
    inputRef.current?.focus();
  }, []);

  const handleScan = async (e: React.FormEvent) => {
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
      inputRef.current?.focus();
    }
  };

  const processReturn = async () => {
    if (!scanResult) return;
    setProcessing(true);
    try {
      const res = await api<any>("/sales/sales/process-scan-return/", {
        method: "POST",
        body: JSON.stringify({
          barcode: scanResult.unit.barcode,
          action: action,
          refund_method: refundMethod
        })
      });
      toast.success("Product returned successfully!");
      setScanResult(null);
      inputRef.current?.focus();
    } catch (err: any) {
      toast.error(err?.message || "Failed to process return");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="vstack gap-4" style={{ maxWidth: "800px", margin: "0 auto" }}>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h4 className="fw-bold m-0">Process Return</h4>
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-body p-4">
          <form onSubmit={handleScan} className="d-flex gap-2">
            <div className="flex-grow-1 position-relative">
              <i className="bi bi-upc-scan position-absolute top-50 start-0 translate-middle-y ms-3 text-secondary"></i>
              <input
                ref={inputRef}
                type="text"
                className="form-control form-control-lg ps-5"
                placeholder="Scan product barcode..."
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
            
            {/* Scanned Item Info */}
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

            {/* Sale Info */}
            <div className="bg-light rounded p-3">
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

            {/* Return Action */}
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
    </div>
  );
}
