"use client";

import { useEffect, useState } from "react";
import { api, fetchAll } from "@/lib/api";
import { money } from "@/components/ui";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

type ProductUnit = {
  id: number;
  barcode: string;
  warranty_months?: number;
  selling_price?: string;
  status: string;
};

type Customer = {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
};

type Sale = {
  id: number;
  invoice_no: string;
  customer?: any;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_address?: string | null;
  bill_name?: string | null;
  bill_phone?: string | null;
  subtotal?: string | number;
  discount?: string | number;
  delivery_charge?: string | number;
  tax?: string | number;
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

const PAY_METHODS = [
  { value: "cash", label: "💵 Cash" },
  { value: "card", label: "💳 Card" },
  { value: "bkash", label: "📱 bKash" },
  { value: "nagad", label: "🔴 Nagad" },
  { value: "bank", label: "🏦 Bank transfer" },
];

export default function ConvertQuotationModal({
  isOpen,
  onClose,
  sale,
  onSuccess,
}: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { lang } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Products & Barcodes
  const [productUnitsMap, setProductUnitsMap] = useState<Record<number, ProductUnit[]>>({});
  const [selectedUnitsMap, setSelectedUnitsMap] = useState<Record<number, number[]>>({});
  const [scanInputs, setScanInputs] = useState<Record<number, string>>({});

  // Customers
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerMode, setCustomerMode] = useState<"existing" | "walkin">("walkin");
  const [customerId, setCustomerId] = useState<string>("");
  const [walkName, setWalkName] = useState("");
  const [walkPhone, setWalkPhone] = useState("");
  const [walkEmail, setWalkEmail] = useState("");
  const [walkAddress, setWalkAddress] = useState("");
  const [matchedId, setMatchedId] = useState<number | null>(null);

  // Financials
  const [discount, setDiscount] = useState<string>("0");
  const [deliveryCharge, setDeliveryCharge] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [dueDate, setDueDate] = useState("");
  const [saleDate, setSaleDate] = useState("");

  function addDays(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  }

  function getNextMonthFirstDay() {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 1);
    return d.toISOString().split("T")[0];
  }

  // EMI Options
  const [isEmi, setIsEmi] = useState(false);
  const [emiMonths, setEmiMonths] = useState(3);
  const [emiInterestPercent, setEmiInterestPercent] = useState(0);

  // Success Result
  const [convertedResult, setConvertedResult] = useState<{
    id: number;
    invoice_no: string;
    phone: string;
    name: string;
    total: number;
    pdfUrl: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen || !sale) return;

    // Load customers
    fetchAll<Customer>("/crm/customers/").then(setCustomers).catch(() => {});

    // Initial customer prefill from quotation
    const existingCustId = typeof sale.customer === "object" ? sale.customer?.id : sale.customer;
    if (existingCustId) {
      setCustomerMode("existing");
      setCustomerId(String(existingCustId));
      setWalkName("");
      setWalkPhone("");
      setWalkEmail(sale.customer_email || sale.customer?.email || "");
      setWalkAddress(sale.customer_address || sale.customer?.address || "");
    } else {
      setCustomerMode("walkin");
      setCustomerId("");
      setWalkName(sale.customer_name || sale.bill_name || "");
      setWalkPhone(sale.customer_phone || sale.bill_phone || "");
      setWalkEmail(sale.customer_email || "");
      setWalkAddress(sale.customer_address || "");
    }

    // Financials prefill
    const initDiscount = Number(sale.discount || 0);
    const initDelivery = Number(sale.delivery_charge || 0);
    setDiscount(String(initDiscount));
    setDeliveryCharge(initDelivery);

    const sub = Number(sale.subtotal || sale.total || 0);
    const tot = Math.max(0, sub - initDiscount + initDelivery);
    setPaidAmount(String(tot));

    setPaymentMethod("cash");
    setIsEmi(false);
    setEmiMonths(3);
    setEmiInterestPercent(0);
    setSelectedUnitsMap({});
    setScanInputs({});
    setConvertedResult(null);

    // Fetch in-stock units for each item
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

  // Phone auto-match
  function onWalkPhoneChange(value: string) {
    setWalkPhone(value);
    const norm = (p?: string | null) => (p || "").replace(/\D/g, "");
    const key = norm(value);
    const found = key.length >= 6 ? customers.find((c) => norm(c.phone) === key) : undefined;
    if (found) {
      setMatchedId(found.id);
      setWalkName(found.name || "");
      setWalkEmail(found.email || "");
      setWalkAddress(found.address || "");
    } else if (matchedId) {
      setMatchedId(null);
    }
  }

  // Calculations
  const subtotal = sale.items.reduce((s: number, it: any) => s + (Number(it.subtotal) || 0), 0);
  const discountNum = Number(discount) || 0;
  const total = Math.max(0, subtotal - discountNum + deliveryCharge);
  const paidNum = Number(paidAmount) || 0;
  const change = paidNum > total ? paidNum - total : 0;
  const due = Math.max(0, total - paidNum);

  // Validation
  const barcodeErrors: string[] = [];
  for (const item of sale.items) {
    const availableUnits = productUnitsMap[item.id] || [];
    const need = Number(item.quantity) || 1;
    const selected = selectedUnitsMap[item.id] || [];

    if (availableUnits.length > 0 && selected.length < need) {
      barcodeErrors.push(
        `${item.product_name}: ${selected.length}/${need} ${lang === "bn" ? "বারকোড নির্বাচন করা হয়েছে" : "barcodes selected"}`
      );
    }
  }

  const isFormValid = barcodeErrors.length === 0;

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
      toast(lang === "bn" ? "এই বারকোডটি ইতোমধ্যে নির্বাচিত হয়েছে।" : "Barcode already selected.");
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

    // Customer / EMI validations
    const selectedCust = customers.find((c) => c.id === Number(customerId));
    const finalEmail = customerMode === "existing" ? (selectedCust?.email || walkEmail) : walkEmail;
    const finalPhone = customerMode === "existing" ? selectedCust?.phone : walkPhone;

    if (isEmi) {
      if (!finalEmail?.trim()) {
        toast.error(lang === "bn" ? "EMI সেলের জন্য কাস্টমারের Email আবশ্যক।" : "Customer email is required for EMI.");
        return;
      }
      if (!finalPhone?.trim()) {
        toast.error(lang === "bn" ? "EMI সেলের জন্য কাস্টমারের ফোন নম্বর আবশ্যক।" : "Customer phone is required for EMI.");
        return;
      }
      if (paidNum >= total) {
        toast.error(lang === "bn" ? "ডাউন পেমেন্ট পুরো বিলের সমান বা বেশি হতে পারে না।" : "Down payment cannot cover total bill for EMI.");
        return;
      }
    }

    setSubmitting(true);
    try {
      let custIdToSend = customerMode === "existing" && customerId ? Number(customerId) : null;
      if (customerMode === "walkin" && matchedId) {
        custIdToSend = matchedId;
      }

      const payload: any = {
        customer: custIdToSend,
        customer_name: customerMode === "walkin" ? walkName.trim() : (selectedCust?.name || ""),
        customer_phone: customerMode === "walkin" ? walkPhone.trim() : (selectedCust?.phone || ""),
        customer_email: finalEmail?.trim() || "",
        customer_address: customerMode === "walkin" ? walkAddress.trim() : (selectedCust?.address || ""),
        discount: discountNum,
        delivery_charge: deliveryCharge,
        tax: 0,
        paid_amount: paidNum,
        payment_method: paymentMethod,
        due_date: (!isEmi && paidNum < total && dueDate) ? dueDate : undefined,
        sale_date: saleDate ? new Date(saleDate).toISOString() : undefined,
        is_emi: isEmi,
        emi_months: isEmi ? emiMonths : 0,
        emi_interest_percent: isEmi ? emiInterestPercent : 0,
        items: sale.items.map((item) => {
          const prodId = typeof item.product === "object" ? (item.product as any).id : Number(item.product);
          return {
            sale_item_id: item.id,
            product_id: prodId,
            unit_ids: selectedUnitsMap[item.id] || [],
          };
        }),
      };

      const res: any = await api(`/sales/sales/${sale.id}/convert-quotation/`, {
        method: "POST",
        body: payload,
      });

      toast.success(
        lang === "bn"
          ? `কোটেশন #${sale.invoice_no} সফলভাবে বিক্রয়ে রূপান্তরিত হয়েছে!`
          : `Quotation #${sale.invoice_no} successfully converted to sale!`
      );

      const custPhone = customerMode === "walkin" ? walkPhone.trim() : (selectedCust?.phone || "");
      const custName = customerMode === "walkin" ? walkName.trim() : (selectedCust?.name || "Customer");
      const pdfUrl = res.public_invoice_url
        ? (res.public_invoice_url.startsWith("http") ? res.public_invoice_url : window.location.origin + res.public_invoice_url)
        : "";

      setConvertedResult({
        id: res.id,
        invoice_no: res.invoice_no,
        phone: custPhone,
        name: custName,
        total,
        pdfUrl,
      });

      onSuccess(res);
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
        className="modal-dialog modal-dialog-centered modal-xl"
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
                  {lang === "bn" ? "কোটেশন বিক্রয়ে রূপান্তর ও পিওএস অপশন" : "Convert Quotation to Sale (Full POS Options)"}
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
          {convertedResult ? (
            <div className="p-5 text-center vstack gap-3">
              <div className="fs-1">🎉</div>
              <h4 className="fw-bold text-success">
                {lang === "bn" ? "বিক্রয় সফলভাবে সম্পন্ন হয়েছে!" : "Sale Completed Successfully!"}
              </h4>
              <p className="text-secondary mb-3">
                {lang === "bn" ? "ইনভয়েস নম্বর:" : "Invoice:"}{" "}
                <strong className="font-monospace text-dark">#{convertedResult.invoice_no}</strong> ·{" "}
                {money(convertedResult.total)}
              </p>

              <div className="d-flex justify-content-center gap-3 mt-2">
                <button
                  className="btn btn-primary btn-lg px-4 rounded-3 fw-semibold shadow-sm"
                  onClick={() => router.push(`/invoice/${convertedResult.id}`)}
                >
                  <i className="bi bi-printer me-2"></i>
                  {lang === "bn" ? "ইনভয়েস / রসিদ প্রিন্ট" : "Print Invoice"}
                </button>

                {convertedResult.phone && (
                  <a
                    className="btn btn-success btn-lg px-4 rounded-3 fw-semibold text-white shadow-sm"
                    style={{ background: "#25D366", borderColor: "#25D366" }}
                    href={`https://wa.me/${(convertedResult.phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(
                      `Hello ${convertedResult.name || ""}, Thank you for your purchase from ${user?.shop_name || "our shop"}! Invoice: #${convertedResult.invoice_no}, Total: ${convertedResult.total} BDT.${convertedResult.pdfUrl ? ` PDF Invoice: ${convertedResult.pdfUrl}` : ""}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <i className="bi bi-whatsapp me-2"></i>
                    {lang === "bn" ? "হোয়াটসঅ্যাপে পাঠান" : "Share on WhatsApp"}
                  </a>
                )}

                <button
                  className="btn btn-outline-secondary btn-lg px-4 rounded-3"
                  onClick={onClose}
                >
                  {lang === "bn" ? "বন্ধ করুন" : "Close"}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="modal-body p-4" style={{ maxHeight: "75vh", overflowY: "auto" }}>
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
                    <div className="alert alert-info py-2 px-3 mb-0 small d-flex align-items-center gap-2 rounded-3">
                      <i className="bi bi-info-circle-fill fs-5"></i>
                      <div>
                        {lang === "bn"
                          ? "কোটেশন সেভ করার সময় কোনো বারকোড বা স্টক কাটা হয় না। চূড়ান্ত বিক্রয়ের সময় পণ্য অনুযায়ী সঠিক বারকোড স্ক্যান বা নির্বাচন করুন এবং প্রয়োজনীয় কাস্টমার, ডিসকাউন্ট, ডেলিভারি ও EMI অপশন সেট করুন।"
                          : "Quotations do not bind barcodes or reduce stock. Assign required serial barcodes and configure Customer, Discounts, Delivery, EMI and Payment options."}
                      </div>
                    </div>

                    <div className="row g-4">
                      {/* Left Column: Products & Barcode Assignment */}
                      <div className="col-lg-6">
                        <div className="card border shadow-sm rounded-3 h-100">
                          <div className="card-header bg-light py-3 px-4 border-bottom">
                            <h6 className="fw-bold mb-0 text-dark">
                              <i className="bi bi-upc-scan me-2 text-primary"></i>
                              {lang === "bn" ? "১. পণ্য ও বারকোড তালিকা" : "1. Products & Serial Barcodes"}
                            </h6>
                          </div>
                          <div className="card-body p-3 vstack gap-3" style={{ maxHeight: "480px", overflowY: "auto" }}>
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
                                        <div className="input-group input-group-sm" style={{ maxWidth: "200px" }}>
                                          <input
                                            type="text"
                                            className="form-control font-monospace"
                                            placeholder={lang === "bn" ? "বারকোড স্ক্যান..." : "Scan barcode..."}
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
                                        ? "সাধারণ পণ্য (আলাদা বারকোড প্রয়োজন নেই)"
                                        : "Standard item (No serial barcodes required)"}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Full POS Checkout Options */}
                      <div className="col-lg-6 vstack gap-3">
                        {/* Customer Information Section */}
                        <div className="card border shadow-sm rounded-3">
                          <div className="card-header bg-light py-2 px-3 d-flex justify-content-between align-items-center">
                            <h6 className="fw-bold mb-0 text-dark small">
                              <i className="bi bi-person-badge me-2 text-primary"></i>
                              {lang === "bn" ? "২. কাস্টমার নির্বাচন ও তথ্য" : "2. Customer Information"}
                            </h6>
                            <div className="btn-group btn-group-sm">
                              <button
                                type="button"
                                className={`btn ${customerMode === "walkin" ? "btn-primary" : "btn-outline-secondary"}`}
                                onClick={() => setCustomerMode("walkin")}
                              >
                                {lang === "bn" ? "খুচরা ক্রেতা" : "Walk-in"}
                              </button>
                              <button
                                type="button"
                                className={`btn ${customerMode === "existing" ? "btn-primary" : "btn-outline-secondary"}`}
                                onClick={() => setCustomerMode("existing")}
                              >
                                {lang === "bn" ? "সংরক্ষিত কাস্টমার" : "Existing"}
                              </button>
                            </div>
                          </div>

                          <div className="card-body p-3">
                            {customerMode === "existing" ? (
                              <div className="vstack gap-2">
                                <div className="form-floating">
                                  <select
                                    className="form-select"
                                    id="customerSelect"
                                    value={customerId}
                                    onChange={(e) => {
                                      setCustomerId(e.target.value);
                                      const found = customers.find((c) => c.id === Number(e.target.value));
                                      if (found) {
                                        setWalkEmail(found.email || "");
                                        setWalkAddress(found.address || "");
                                      }
                                    }}
                                  >
                                    <option value="">{lang === "bn" ? "-- কাস্টমার নির্বাচন করুন --" : "-- Select Customer --"}</option>
                                    {customers.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        👤 {c.name} {c.phone ? `(${c.phone})` : ""}
                                      </option>
                                    ))}
                                  </select>
                                  <label htmlFor="customerSelect">
                                    {lang === "bn" ? "কাস্টমার খুঁজুন/বাছাই করুন" : "Select Customer"}
                                  </label>
                                </div>

                                <div className="form-floating">
                                  <input
                                    type="email"
                                    className={`form-control ${isEmi && !walkEmail ? "is-invalid" : ""}`}
                                    id="existingEmail"
                                    value={walkEmail}
                                    onChange={(e) => setWalkEmail(e.target.value)}
                                    placeholder="email@example.com"
                                  />
                                  <label htmlFor="existingEmail">
                                    {isEmi ? "📧 Email (Required for EMI)" : lang === "bn" ? "📧 ইমেইল (ঐচ্ছিক)" : "📧 Email (Optional)"}
                                  </label>
                                </div>
                              </div>
                            ) : (
                              <div className="vstack gap-2">
                                <div className="row g-2">
                                  <div className="col-md-6">
                                    <div className="form-floating">
                                      <input
                                        type="tel"
                                        className="form-control"
                                        id="walkPhone"
                                        value={walkPhone}
                                        onChange={(e) => onWalkPhoneChange(e.target.value)}
                                        placeholder="017XXXXXXXX"
                                      />
                                      <label htmlFor="walkPhone">{lang === "bn" ? "মোবাইল নম্বর" : "Phone"}</label>
                                    </div>
                                  </div>
                                  <div className="col-md-6">
                                    <div className="form-floating">
                                      <input
                                        type="text"
                                        className="form-control"
                                        id="walkName"
                                        value={walkName}
                                        onChange={(e) => setWalkName(e.target.value)}
                                        placeholder="Name"
                                      />
                                      <label htmlFor="walkName">{lang === "bn" ? "কাস্টমারের নাম" : "Customer Name"}</label>
                                    </div>
                                  </div>
                                </div>
                                {matchedId && (
                                  <div className="text-success small fw-semibold">
                                    <i className="bi bi-check-circle-fill me-1"></i>
                                    {lang === "bn" ? "সংরক্ষিত কাস্টমার ডাটার সাথে মিলেছে" : "Matched with existing customer"}
                                  </div>
                                )}
                                <div className="row g-2">
                                  <div className="col-md-6">
                                    <div className="form-floating">
                                      <input
                                        type="email"
                                        className={`form-control ${isEmi && !walkEmail ? "is-invalid" : ""}`}
                                        id="walkEmail"
                                        value={walkEmail}
                                        onChange={(e) => setWalkEmail(e.target.value)}
                                        placeholder="Email"
                                      />
                                      <label htmlFor="walkEmail">
                                        {isEmi ? "📧 Email (Required for EMI)" : lang === "bn" ? "📧 ইমেইল (ঐচ্ছিক)" : "📧 Email (Optional)"}
                                      </label>
                                    </div>
                                  </div>
                                  <div className="col-md-6">
                                    <div className="form-floating">
                                      <input
                                        type="text"
                                        className="form-control"
                                        id="walkAddress"
                                        value={walkAddress}
                                        onChange={(e) => setWalkAddress(e.target.value)}
                                        placeholder="Address"
                                      />
                                      <label htmlFor="walkAddress">{lang === "bn" ? "ঠিকানা (ঐচ্ছিক)" : "Address (Optional)"}</label>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Financials & Adjustments Section */}
                        <div className="card border shadow-sm rounded-3">
                          <div className="card-header bg-light py-2 px-3">
                            <h6 className="fw-bold mb-0 text-dark small">
                              <i className="bi bi-calculator me-2 text-primary"></i>
                              {lang === "bn" ? "৩. আর্থিক হিসাব, ডিসকাউন্ট ও ডেলিভারি" : "3. Financials, Discounts & Adjustments"}
                            </h6>
                          </div>
                          <div className="card-body p-3">
                            <div className="row g-2">
                              <div className="col-4">
                                <div className="form-floating">
                                  <input
                                    type="text"
                                    className="form-control bg-light"
                                    id="subtotalDisplay"
                                    value={subtotal}
                                    disabled
                                  />
                                  <label htmlFor="subtotalDisplay">{lang === "bn" ? "সাবটোটাল (৳)" : "Subtotal (৳)"}</label>
                                </div>
                              </div>
                              <div className="col-4">
                                <div className="form-floating">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="form-control fw-bold text-success"
                                    id="discountInput"
                                    value={discount}
                                    onChange={(e) => {
                                      const d = e.target.value;
                                      setDiscount(d);
                                      const dNum = Number(d) || 0;
                                      const newTotal = Math.max(0, subtotal - dNum + deliveryCharge);
                                      setPaidAmount(String(newTotal));
                                    }}
                                    placeholder="0"
                                  />
                                  <label htmlFor="discountInput">{lang === "bn" ? "ডিসকাউন্ট (৳)" : "Discount (৳)"}</label>
                                </div>
                              </div>
                              <div className="col-4">
                                <div className="form-floating">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="form-control fw-bold text-info"
                                    id="deliveryInput"
                                    value={deliveryCharge}
                                    onChange={(e) => {
                                      const dc = Number(e.target.value) || 0;
                                      setDeliveryCharge(dc);
                                      const newTotal = Math.max(0, subtotal - discountNum + dc);
                                      setPaidAmount(String(newTotal));
                                    }}
                                    placeholder="0"
                                  />
                                  <label htmlFor="deliveryInput">{lang === "bn" ? "ডেলিভারি (৳)" : "Delivery (৳)"}</label>
                                </div>
                              </div>
                            </div>

                            {/* Offline / Backdated sale time if needed */}
                            {user?.shop_offline_sale_mode && (
                              <div className="form-floating mt-2">
                                <input
                                  type="datetime-local"
                                  className="form-control border-warning"
                                  id="backdatedDate"
                                  value={saleDate}
                                  onChange={(e) => setSaleDate(e.target.value)}
                                />
                                <label htmlFor="backdatedDate">
                                  {lang === "bn" ? "অফলাইন/পূর্ববর্তী বিক্রয় তারিখ (ঐচ্ছিক)" : "Backdated Sale Time (Optional)"}
                                </label>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* EMI & Installment Section */}
                        {user?.shop_emi_enabled && (
                          <div className="card border shadow-sm rounded-3">
                            <div className="card-header bg-light py-2 px-3 d-flex justify-content-between align-items-center">
                              <h6 className="fw-bold mb-0 text-dark small">
                                <i className="bi bi-clock-history me-2 text-primary"></i>
                                {lang === "bn" ? "৪. কিস্তি সুবিধা (EMI Option)" : "4. EMI & Installments"}
                              </h6>
                              <div className="form-check form-switch mb-0">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  role="switch"
                                  id="modalEmiSwitch"
                                  checked={isEmi}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setIsEmi(checked);
                                    if (checked && paidNum >= total) {
                                      setPaidAmount(String(Math.round(total * 0.2)));
                                    }
                                  }}
                                />
                                <label className="form-check-label small fw-semibold text-primary" htmlFor="modalEmiSwitch">
                                  {lang === "bn" ? "EMI চালু করুন" : "Enable EMI"}
                                </label>
                              </div>
                            </div>

                            {isEmi && (
                              <div className="card-body p-3 bg-primary bg-opacity-10">
                                <div className="row g-2 mb-2">
                                  <div className="col-6">
                                    <div className="form-floating">
                                      <select
                                        id="modalEmiMonths"
                                        className="form-select"
                                        value={emiMonths}
                                        onChange={(e) => setEmiMonths(Number(e.target.value))}
                                      >
                                        <option value={3}>{lang === "bn" ? "৩ মাস" : "3 Months"}</option>
                                        <option value={6}>{lang === "bn" ? "৬ মাস" : "6 Months"}</option>
                                        <option value={9}>{lang === "bn" ? "৯ মাস" : "9 Months"}</option>
                                        <option value={12}>{lang === "bn" ? "১২ মাস" : "12 Months"}</option>
                                        <option value={18}>{lang === "bn" ? "১৮ মাস" : "18 Months"}</option>
                                        <option value={24}>{lang === "bn" ? "২৪ মাস" : "24 Months"}</option>
                                      </select>
                                      <label htmlFor="modalEmiMonths">{lang === "bn" ? "কিস্তির মেয়াদ" : "Duration"}</label>
                                    </div>
                                  </div>
                                  <div className="col-6">
                                    <div className="form-floating">
                                      <input
                                        id="modalEmiInterest"
                                        type="number"
                                        min={0}
                                        max={100}
                                        step="0.1"
                                        className="form-control"
                                        value={emiInterestPercent}
                                        onChange={(e) => setEmiInterestPercent(Number(e.target.value) || 0)}
                                      />
                                      <label htmlFor="modalEmiInterest">{lang === "bn" ? "সুদ / মুনাফা %" : "Interest %"}</label>
                                    </div>
                                  </div>
                                </div>

                                <div className="d-flex justify-content-between fs-6 text-secondary small">
                                  <span>{lang === "bn" ? "মূল বকেয়া (Principal):" : "Principal Amount:"}</span>
                                  <span className="fw-bold">{money(Math.max(0, total - paidNum))}</span>
                                </div>
                                <div className="d-flex justify-content-between fs-6 text-primary fw-bold mt-1">
                                  <span>{lang === "bn" ? "প্রতি মাসে কিস্তি:" : "Monthly Installment:"}</span>
                                  <span>
                                    {money(
                                      (Math.max(0, total - paidNum) * (1 + emiInterestPercent / 100)) / emiMonths
                                    )} / {lang === "bn" ? "মাস" : "mo"}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Payment & Settlement Section */}
                        <div className="card border shadow-sm rounded-3">
                          <div className="card-header bg-light py-2 px-3">
                            <h6 className="fw-bold mb-0 text-dark small">
                              <i className="bi bi-cash-stack me-2 text-success"></i>
                              {lang === "bn" ? "৫. পেমেন্ট মাধ্যম ও নিষ্পত্তি" : "5. Payment Method & Settlement"}
                            </h6>
                          </div>
                          <div className="card-body p-3">
                            {/* Payment Method selector */}
                            <div className="mb-3">
                              <label className="form-label small fw-semibold text-secondary mb-1">
                                {isEmi
                                  ? lang === "bn"
                                    ? "ডাউন পেমেন্টের মাধ্যম"
                                    : "Down Payment Method"
                                  : lang === "bn"
                                  ? "পেমেন্ট মাধ্যম"
                                  : "Payment Method"}
                              </label>
                              <div className="d-flex flex-wrap gap-2">
                                {PAY_METHODS.map((pm) => (
                                  <button
                                    key={pm.value}
                                    type="button"
                                    className={`btn btn-sm ${
                                      paymentMethod === pm.value
                                        ? "btn-brand fw-bold shadow-sm"
                                        : "btn-outline-secondary bg-white"
                                    }`}
                                    onClick={() => setPaymentMethod(pm.value)}
                                  >
                                    {pm.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Paid Amount */}
                            <div className="form-floating mb-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="form-control fw-bold text-primary fs-5"
                                id="paidAmountInput"
                                value={paidAmount}
                                onChange={(e) => setPaidAmount(e.target.value)}
                                placeholder={String(total)}
                              />
                              <label htmlFor="paidAmountInput">
                                {isEmi
                                  ? lang === "bn"
                                    ? "ডাউন পেমেন্ট (Down Payment ৳)"
                                    : "Down Payment (৳)"
                                  : lang === "bn"
                                  ? "প্রদত্ত টাকা (Paid Amount ৳)"
                                  : "Paid Amount (৳)"}
                              </label>
                            </div>

                            {/* Promised Payment Date if due exists */}
                            {!isEmi && paidAmount !== "" && paidNum < total && (
                              <div className="p-2 mb-2 bg-danger bg-opacity-10 rounded-3 border border-danger-subtle vstack gap-1">
                                <div className="d-flex align-items-center justify-content-between">
                                  <span className="text-danger fw-bold small">
                                    <i className="bi bi-calendar-event-fill me-1"></i>
                                    {lang === "bn" ? "পরিশোধের প্রতিশ্রুত তারিখ (Promised Date)" : "Promised Payment Date"}
                                  </span>
                                  <span className="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill">
                                    {lang === "bn" ? "বকেয়া" : "Due"}: {money(total - paidNum)}
                                  </span>
                                </div>
                                <div className="d-flex flex-wrap gap-1 my-1">
                                  <button
                                    type="button"
                                    className={`btn btn-xs rounded-pill px-2 py-0 ${dueDate === addDays(7) ? "btn-danger text-white fw-bold" : "btn-outline-danger bg-white"}`}
                                    style={{ fontSize: "0.72rem" }}
                                    onClick={() => setDueDate(addDays(7))}
                                  >
                                    {lang === "bn" ? "+৭ দিন" : "+7 Days"}
                                  </button>
                                  <button
                                    type="button"
                                    className={`btn btn-xs rounded-pill px-2 py-0 ${dueDate === addDays(15) ? "btn-danger text-white fw-bold" : "btn-outline-danger bg-white"}`}
                                    style={{ fontSize: "0.72rem" }}
                                    onClick={() => setDueDate(addDays(15))}
                                  >
                                    {lang === "bn" ? "+১৫ দিন" : "+15 Days"}
                                  </button>
                                  <button
                                    type="button"
                                    className={`btn btn-xs rounded-pill px-2 py-0 ${dueDate === addDays(30) ? "btn-danger text-white fw-bold" : "btn-outline-danger bg-white"}`}
                                    style={{ fontSize: "0.72rem" }}
                                    onClick={() => setDueDate(addDays(30))}
                                  >
                                    {lang === "bn" ? "+৩০ দিন" : "+30 Days"}
                                  </button>
                                  <button
                                    type="button"
                                    className={`btn btn-xs rounded-pill px-2 py-0 ${dueDate === getNextMonthFirstDay() ? "btn-danger text-white fw-bold" : "btn-outline-danger bg-white"}`}
                                    style={{ fontSize: "0.72rem" }}
                                    onClick={() => setDueDate(getNextMonthFirstDay())}
                                  >
                                    {lang === "bn" ? "পরবর্তী মাসের ১ তারিখ" : "Next Month 1st"}
                                  </button>
                                </div>
                                <div className="form-floating">
                                  <input
                                    type="date"
                                    className="form-control bg-white shadow-sm border-danger-subtle form-control-sm"
                                    id="modalDueDateInput"
                                    min={new Date().toISOString().split("T")[0]}
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                  />
                                  <label htmlFor="modalDueDateInput" className="text-danger fw-medium small">
                                    📅 {lang === "bn" ? "প্রতিশ্রুত তারিখ নির্বাচন করুন" : "Select Promised Date"}
                                  </label>
                                </div>
                              </div>
                            )}

                            {/* Financial Summary */}
                            <div className="bg-light p-2 rounded-3 border">
                              <div className="d-flex justify-content-between small text-secondary">
                                <span>{lang === "bn" ? "চূড়ান্ত বিল (Total Bill):" : "Total Bill:"}</span>
                                <strong className="text-dark">{money(total)}</strong>
                              </div>
                              <div className="d-flex justify-content-between small text-secondary mt-1">
                                <span>{lang === "bn" ? "পরিশোধিত (Paid):" : "Paid Amount:"}</span>
                                <strong className="text-success">{money(paidNum)}</strong>
                              </div>
                              {change > 0 && (
                                <div className="d-flex justify-content-between small text-info fw-semibold mt-1">
                                  <span>{lang === "bn" ? "ফেরত (Change Due):" : "Change Due:"}</span>
                                  <strong>{money(change)}</strong>
                                </div>
                              )}
                              {due > 0 && !isEmi && (
                                <div className="d-flex justify-content-between small text-danger fw-semibold mt-1">
                                  <span>{lang === "bn" ? "বকেয়া (Due Amount):" : "Due Balance:"}</span>
                                  <strong>{money(due)}</strong>
                                </div>
                              )}
                            </div>
                          </div>
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
                          ? "বিক্রয় নিশ্চিত ও সম্পন্ন করুন"
                          : "Confirm & Complete Sale"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
