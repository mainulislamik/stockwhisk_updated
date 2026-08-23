"use client";

import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { money } from "@/components/ui";
import { useLanguage } from "@/contexts/LanguageContext";
import toast from "react-hot-toast";

type ProductUnit = {
  id: number;
  barcode: string;
  warranty_months?: number;
  selling_price?: string;
  status: string;
};

type SaleItem = {
  id: number;
  product?: any;
  product_id?: number;
  product_name: string;
  product_sku?: string;
  quantity: string | number;
  unit_price: string | number;
  subtotal: string | number;
};

type Sale = {
  id: number;
  invoice_no: string;
  customer_name?: string | null;
  bill_name?: string | null;
  bill_phone?: string | null;
  total: string | number;
  items: any[];
  [key: string]: any;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  onSuccess: (convertedSale: any) => void;
};

export default function ConvertQuotationModal({
  isOpen,
  onClose,
  sale,
  onSuccess,
}: Props) {
  const { t, lang } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [productUnitsMap, setProductUnitsMap] = useState<Record<number, ProductUnit[]>>({});
  const [selectedUnitsMap, setSelectedUnitsMap] = useState<Record<number, number[]>>({}); // sale_item_id -> array of unit_id
  const [scanInputs, setScanInputs] = useState<Record<number, string>>({}); // sale_item_id -> current typed/scanned string

  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paidAmount, setPaidAmount] = useState<string>("");

  useEffect(() => {
    if (!isOpen || !sale) return;

    setPaidAmount(String(sale.total || "0"));
    setPaymentMethod("cash");
    setSelectedUnitsMap({});
    setScanInputs({});

    // Fetch in-stock units for each product in the quotation
    (async () => {
      setLoading(true);
      try {
        const unitsMap: Record<number, ProductUnit[]> = {};
        const prods = sale.items || [];
        
        await Promise.all(
          prods.map(async (item) => {
            const prodId = typeof item.product === "object" ? (item.product as any).id : Number(item.product);
            try {
              const res = await api<any>(`/catalog/products/${prodId}/`);
              if (res && res.units && Array.isArray(res.units)) {
                unitsMap[item.id] = res.units.filter((u: any) => u.status === "in_stock");
              } else {
                unitsMap[item.id] = [];
              }
            } catch {
              unitsMap[item.id] = [];
            }
          })
        );
        setProductUnitsMap(unitsMap);
      } catch (err: any) {
        toast.error(err?.message || "Failed to load product barcodes");
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, sale]);

  if (!isOpen || !sale) return null;

  const totalNum = Number(sale.total) || 0;
  const paidNum = Number(paidAmount) || 0;
  const dueNum = Math.max(0, totalNum - paidNum);

  // Check if all items that require barcodes have the exact required number of barcodes selected
  const validationErrors: string[] = [];
  for (const item of sale.items) {
    const availableUnits = productUnitsMap[item.id] || [];
    const need = Number(item.quantity) || 1;
    const selected = selectedUnitsMap[item.id] || [];

    if (availableUnits.length > 0) {
      if (selected.length < need) {
        validationErrors.push(
          `${item.product_name}: ${selected.length}/${need} ${lang === "bn" ? "বারকোড নির্বাচন করা হয়েছে" : "barcodes selected"}`
        );
      }
    }
  }

  const isFormValid = validationErrors.length === 0;

  const toggleUnitSelection = (itemId: number, unitId: number, maxQty: number) => {
    const current = selectedUnitsMap[itemId] || [];
    if (current.includes(unitId)) {
      setSelectedUnitsMap({
        ...selectedUnitsMap,
        [itemId]: current.filter((id) => id !== unitId),
      });
    } else {
      if (current.length >= maxQty) {
        toast.error(
          lang === "bn"
            ? `এই পণ্যের জন্য সর্বোচ্চ ${maxQty}টি বারকোড নির্বাচন করা যাবে।`
            : `Maximum ${maxQty} barcode(s) allowed for this product.`
        );
        return;
      }
      setSelectedUnitsMap({
        ...selectedUnitsMap,
        [itemId]: [...current, unitId],
      });
    }
  };

  const handleBarcodeScan = (itemId: number, barcode: string, maxQty: number) => {
    const cleanBc = barcode.trim();
    if (!cleanBc) return;

    const available = productUnitsMap[itemId] || [];
    const matched = available.find(
      (u) => u.barcode.toLowerCase() === cleanBc.toLowerCase()
    );

    if (!matched) {
      toast.error(
        lang === "bn"
          ? `বারকোড "${cleanBc}" ইন-স্টকে পাওয়া যায়নি!`
          : `Barcode "${cleanBc}" not found in stock!`
      );
      return;
    }

    const current = selectedUnitsMap[itemId] || [];
    if (current.includes(matched.id)) {
      toast(lang === "bn" ? "এই বারকোডটি ইতোমধ্যে নির্বাচিত হয়েছে。" : "Barcode already selected.");
      setScanInputs({ ...scanInputs, [itemId]: "" });
      return;
    }

    if (current.length >= maxQty) {
      toast.error(
        lang === "bn"
          ? `সর্বোচ্চ ${maxQty}টি বারকোড নির্বাচন সম্পন্ন হয়েছে!`
          : `Already selected ${maxQty} barcodes!`
      );
      setScanInputs({ ...scanInputs, [itemId]: "" });
      return;
    }

    setSelectedUnitsMap({
      ...selectedUnitsMap,
      [itemId]: [...current, matched.id],
    });
    setScanInputs({ ...scanInputs, [itemId]: "" });
    toast.success(`✓ ${matched.barcode}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) {
      toast.error(
        lang === "bn"
          ? "অনুগ্রহ করে সকল পণ্যের প্রয়োজনীয় বারকোড নির্বাচন করুন।"
          : "Please assign all required barcodes before completing the sale."
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        paid_amount: paidNum,
        payment_method: paymentMethod,
        items: sale.items.map((item) => {
          const prodId = typeof item.product === "object" ? (item.product as any).id : Number(item.product);
          return {
            sale_item_id: item.id,
            product_id: prodId,
            unit_ids: selectedUnitsMap[item.id] || [],
          };
        }),
      };

      const res = await api(`/sales/sales/${sale.id}/convert-quotation/`, {
        method: "POST",
        body: payload,
      });

      toast.success(
        lang === "bn"
          ? `কোটেশন #${sale.invoice_no} সফলভাবে বিক্রয়ে রূপান্তরিত হয়েছে!`
          : `Quotation #${sale.invoice_no} successfully converted to sale!`
      );
      onSuccess(res);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to convert quotation to sale.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal fade show d-block"
      tabIndex={-1}
      style={{ backgroundColor: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(4px)", zIndex: 1060 }}
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-dialog-centered modal-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
          {/* Header */}
          <div
            className="p-4 text-white d-flex align-items-center justify-content-between"
            style={{
              background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
            }}
          >
            <div className="d-flex align-items-center gap-3">
              <div
                className="d-flex align-items-center justify-content-center rounded-circle bg-white bg-opacity-20 text-white"
                style={{ width: "48px", height: "48px", fontSize: "1.5rem" }}
              >
                <i className="bi bi-cart-check-fill"></i>
              </div>
              <div>
                <h5 className="modal-title fw-bold mb-0 text-white">
                  {lang === "bn" ? "কোটেশন বিক্রয়ে রূপান্তর করুন" : "Convert Quotation to Sale"}
                </h5>
                <div className="text-white-50 small">
                  {lang === "bn" ? "কোটেশন নম্বর:" : "Quotation:"}{" "}
                  <strong className="text-white font-monospace">#{sale.invoice_no}</strong> ·{" "}
                  {sale.customer_name || sale.bill_name || (lang === "bn" ? "খুচরা ক্রেতা" : "Walk-in")}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
            ></button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4" style={{ maxHeight: "70vh", overflowY: "auto" }}>
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status"></div>
                  <div className="text-secondary small mt-2">
                    {lang === "bn" ? "পণ্যের ইন-স্টক বারকোড লোড হচ্ছে..." : "Loading product barcodes..."}
                  </div>
                </div>
              ) : (
                <div className="vstack gap-4">
                  {/* Notice Banner */}
                  <div className="alert alert-info py-2 px-3 mb-0 small d-flex align-items-center gap-2">
                    <i className="bi bi-info-circle-fill fs-5"></i>
                    <div>
                      {lang === "bn"
                        ? "কোটেশন সেভ করার সময় কোনো বারকোড সংরক্ষিত হয় না। বিক্রয়ে রূপান্তরের সময় পণ্য অনুযায়ী পরিমাণ ভিত্তিক সঠিক বারকোড স্ক্যান বা নির্বাচন করুন।"
                        : "Quotations do not bind barcodes when saved. Please scan or assign the required barcodes for each unit-tracked product to complete the sale."}
                    </div>
                  </div>

                  {/* Product Items Barcode Selection */}
                  <div>
                    <h6 className="fw-bold mb-2 text-dark">
                      <i className="bi bi-upc-scan me-2 text-primary"></i>
                      {lang === "bn" ? "পণ্য ও বারকোড তালিকা (পরিমাণ অনুযায়ী)" : "Products & Barcodes (Quantity-wise)"}
                    </h6>

                    <div className="vstack gap-3">
                      {sale.items.map((item) => {
                        const availableUnits = productUnitsMap[item.id] || [];
                        const hasUnits = availableUnits.length > 0;
                        const need = Number(item.quantity) || 1;
                        const selected = selectedUnitsMap[item.id] || [];
                        const isComplete = selected.length === need;

                        return (
                          <div
                            key={item.id}
                            className={`border rounded-3 p-3 ${
                              hasUnits
                                ? isComplete
                                  ? "border-success bg-success bg-opacity-10"
                                  : "border-warning bg-warning bg-opacity-10"
                                : "bg-light"
                            }`}
                          >
                            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                              <div>
                                <span className="fw-bold text-dark">{item.product_name}</span>
                                {item.product_sku && (
                                  <span className="text-secondary font-monospace small ms-2">
                                    [{item.product_sku}]
                                  </span>
                                )}
                              </div>
                              <div className="d-flex align-items-center gap-2">
                                <span className="badge bg-secondary">
                                  {lang === "bn" ? `পরিমাণ: ${need}` : `Qty: ${need}`}
                                </span>
                                <span className="fw-semibold text-brand">
                                  {money(item.subtotal)}
                                </span>
                              </div>
                            </div>

                            {hasUnits ? (
                              <div>
                                <div className="d-flex flex-wrap justify-content-between align-items-center mb-2">
                                  <div className="small fw-semibold">
                                    {lang === "bn" ? "বারকোড নির্বাচন:" : "Barcodes:"}{" "}
                                    <span
                                      className={`badge ${
                                        isComplete ? "bg-success" : "bg-warning text-dark"
                                      }`}
                                    >
                                      {selected.length} / {need}{" "}
                                      {isComplete
                                        ? lang === "bn"
                                          ? "সম্পন্ন"
                                          : "Ready"
                                        : lang === "bn"
                                        ? `(আরও ${need - selected.length}টি আবশ্যক)`
                                        : `(${need - selected.length} required)`}
                                    </span>
                                  </div>

                                  {/* Barcode Quick Scan Input */}
                                  <div className="input-group input-group-sm" style={{ maxWidth: "240px" }}>
                                    <input
                                      type="text"
                                      className="form-control font-monospace"
                                      placeholder={lang === "bn" ? "বারকোড স্ক্যান/টাইপ..." : "Scan barcode..."}
                                      value={scanInputs[item.id] || ""}
                                      onChange={(e) =>
                                        setScanInputs({
                                          ...scanInputs,
                                          [item.id]: e.target.value,
                                        })
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          handleBarcodeScan(
                                            item.id,
                                            scanInputs[item.id] || "",
                                            need
                                          );
                                        }
                                      }}
                                    />
                                    <button
                                      type="button"
                                      className="btn btn-outline-primary"
                                      onClick={() =>
                                        handleBarcodeScan(
                                          item.id,
                                          scanInputs[item.id] || "",
                                          need
                                        )
                                      }
                                    >
                                      <i className="bi bi-plus"></i>
                                    </button>
                                  </div>
                                </div>

                                {/* Available In-Stock Barcode Chips */}
                                <div className="d-flex flex-wrap gap-1">
                                  {availableUnits.map((u) => {
                                    const isSel = selected.includes(u.id);
                                    return (
                                      <button
                                        key={u.id}
                                        type="button"
                                        className={`btn btn-sm py-0 px-2 font-monospace ${
                                          isSel
                                            ? "btn-success fw-bold"
                                            : "btn-outline-secondary bg-white"
                                        }`}
                                        style={{ fontSize: "0.8rem" }}
                                        onClick={() =>
                                          toggleUnitSelection(item.id, u.id, need)
                                        }
                                      >
                                        {isSel && <i className="bi bi-check me-1"></i>}
                                        {u.barcode}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              <div className="small text-muted fst-italic">
                                <i className="bi bi-box me-1"></i>
                                {lang === "bn"
                                  ? "নন-সিরিয়ালাইজড সাধারণ পণ্য (আলাদা ইউনিট বারকোড প্রয়োজন নেই)"
                                  : "Standard inventory item (No serial barcodes required)"}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Payment & Settlement Details */}
                  <div className="card card-body bg-light border p-3">
                    <h6 className="fw-bold mb-3 text-dark">
                      <i className="bi bi-cash-stack me-2 text-success"></i>
                      {lang === "bn" ? "পেমেন্ট ও বিক্রয় নিষ্পত্তি" : "Payment & Settlement"}
                    </h6>

                    <div className="row g-3">
                      {/* Payment Method */}
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold text-secondary mb-1">
                          {lang === "bn" ? "পেমেন্ট মাধ্যম" : "Payment Method"}
                        </label>
                        <div className="d-flex flex-wrap gap-2">
                          {[
                            { id: "cash", label: lang === "bn" ? "💵 ক্যাশ" : "💵 Cash" },
                            { id: "bkash", label: "📱 bKash" },
                            { id: "nagad", label: "🔴 Nagad" },
                            { id: "card", label: "💳 Card" },
                            { id: "bank", label: "🏦 Bank" },
                          ].map((pm) => (
                            <button
                              key={pm.id}
                              type="button"
                              className={`btn btn-sm ${
                                paymentMethod === pm.id
                                  ? "btn-brand fw-bold shadow-sm"
                                  : "btn-outline-secondary bg-white"
                              }`}
                              onClick={() => setPaymentMethod(pm.id)}
                            >
                              {pm.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Paid Amount */}
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold text-secondary mb-1">
                          {lang === "bn" ? "প্রদত্ত টাকা (Paid Amount)" : "Paid Amount (৳)"}
                        </label>
                        <div className="input-group">
                          <span className="input-group-text">৳</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-control fw-bold"
                            value={paidAmount}
                            onChange={(e) => setPaidAmount(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Summary Row */}
                    <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
                      <div>
                        <span className="small text-secondary">{lang === "bn" ? "মোট বিল:" : "Total:"}</span>{" "}
                        <strong className="fs-6">{money(totalNum)}</strong>
                      </div>
                      <div>
                        <span className="small text-secondary">{lang === "bn" ? "পরিশোধিত:" : "Paid:"}</span>{" "}
                        <strong className="fs-6 text-success">{money(paidNum)}</strong>
                      </div>
                      <div>
                        <span className="small text-secondary">{lang === "bn" ? "বকেয়া:" : "Due:"}</span>{" "}
                        <strong className={`fs-6 ${dueNum > 0 ? "text-danger" : "text-muted"}`}>
                          {money(dueNum)}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="modal-footer bg-light p-3 d-flex justify-content-between align-items-center">
              <button
                type="button"
                className="btn btn-outline-secondary px-4"
                onClick={onClose}
                disabled={submitting}
              >
                {lang === "bn" ? "বাতিল" : "Cancel"}
              </button>

              <button
                type="submit"
                className="btn btn-success btn-lg px-4 d-flex align-items-center gap-2 fw-bold"
                disabled={submitting || loading || !isFormValid}
              >
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                    <span>{lang === "bn" ? "বিক্রয় সম্পন্ন হচ্ছে..." : "Converting..."}</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-circle-fill"></i>
                    <span>
                      {lang === "bn"
                        ? "বিক্রয় নিশ্চিত করুন (Complete Sale)"
                        : "Confirm & Complete Sale"}
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
