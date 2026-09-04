"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { showError, formatApiErrorMessage } from "@/lib/dialogs";
import { useRouter } from "next/navigation";
import { api, fetchAll } from "@/lib/api";
import { Spinner, money } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/contexts/LanguageContext";
import PrintFormatModal from "@/components/PrintFormatModal";

type ProductUnit = { id: number; barcode: string; effective_selling_price?: string };
type CartLine = { 
  product: { 
    id: number; 
    name: string; 
    purchase_multiplier?: string | number; 
    unit_detail?: { id: number; name: string; short_code: string } | null;
    purchase_unit_detail?: { id: number; name: string; short_code: string } | null;
  }; 
  qty: number; 
  price: number; 
  discount: number; 
  selectedUnits: ProductUnit[];
  sellMode?: "base" | "bulk";
};
type Customer = { id: number; name: string; phone?: string; email?: string; address?: string; };

const PAY_METHODS = [
  { value: "cash", label: "💵 Cash" },
  { value: "card", label: "💳 Card" },
  { value: "bkash", label: "📱 bKash" },
  { value: "nagad", label: "📱 Nagad" },
  { value: "bank", label: "🏦 Bank transfer" },
];

export default function PosCustomerPage() {
  const router = useRouter();
  const { user, reload } = useAuth();
  const { t, lang } = useLanguage();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerMode, setCustomerMode] = useState<"walkin" | "existing">("walkin");
  const [customerId, setCustomerId] = useState("");
  const [walkName, setWalkName] = useState("");
  const [walkPhone, setWalkPhone] = useState("");
  const [walkEmail, setWalkEmail] = useState("");
  const [walkAddress, setWalkAddress] = useState("");
  const [matchedId, setMatchedId] = useState<number | null>(null);
  const [existingEmail, setExistingEmail] = useState("");
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Sync existing email when customer changes
  useEffect(() => {
    if (customerMode === "existing" && customerId) {
      const c = customers.find(c => c.id === Number(customerId));
      setExistingEmail(c?.email || "");
    }
  }, [customerMode, customerId, customers]);

  // Typing a phone that matches an existing customer auto-fills their details
  // (and links the sale to that customer instead of creating a duplicate).
  function onWalkPhoneChange(value: string) {
    setWalkPhone(value);
    const norm = (p?: string | null) => (p || "").replace(/\D/g, "");
    const key = norm(value);
    const found = key.length >= 6 ? customers.find((c) => norm(c.phone) === key) : undefined;
    if (found) {
      setMatchedId(found.id);
      setWalkName(found.name || "");
      setWalkEmail(found.email || "");
      setWalkAddress((found as any).address || "");
    } else if (matchedId) {
      // They edited away from a matched number — unlink.
      setMatchedId(null);
    }
  }
  const [discount, setDiscount] = useState("");
  const [saleDate, setSaleDate] = useState("");
  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [paid, setPaid] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [method, setMethod] = useState("cash");
  const [isEmi, setIsEmi] = useState(false);
  const [emiMonths, setEmiMonths] = useState(3);
  const [emiInterestPercent, setEmiInterestPercent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saleResult, setSaleResult] = useState<{ id: number; invoice_no: string; phone: string; name: string; total: number; pdfUrl: string } | null>(null);

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

  useEffect(() => {
    const saved = sessionStorage.getItem("pos_cart");
    if (!saved) { router.replace("/app/pos"); return; }
    try { setCart(JSON.parse(saved)); } catch { router.replace("/app/pos"); }
    fetchAll<Customer>("/crm/customers/").then(setCustomers).catch(() => {});
    // Reload user so EMI/delivery/offline settings are always fresh
    reload().catch(() => {});
  }, [router]);

  const discountNum = Number(discount) || 0;
  const subtotal = cart.reduce((s, l) => s + l.qty * l.price - l.discount, 0);
  const total = Math.max(0, subtotal - discountNum + deliveryCharge);
  const paidNum = Number(paid) || 0;
  const change = paidNum > total ? paidNum - total : 0;

  async function complete(asQuotation = false) {
    if (!asQuotation && discount === "" && paid === "") {
      await showError("Validation Error", t("pos_err_discount_paid"));
      return;
    }
    const finalPaid = asQuotation ? 0 : (paid === "" ? total : Number(paid));
    if (!asQuotation && customerMode === "walkin" && !walkName.trim()) { await showError("Validation Error", t("pos_err_req_name")); return; }
    if (!asQuotation && customerMode === "walkin" && !walkPhone.trim()) { await showError("Validation Error", t("pos_err_req_phone")); return; }
    if (isEmi && !asQuotation) {
      // EMI requires email — validate for both modes
      const selectedCustomer = customers.find(c => c.id === Number(customerId));
      const finalEmail = customerMode === "existing" ? existingEmail.trim() : walkEmail.trim();
      const finalPhone = customerMode === "existing" ? selectedCustomer?.phone : walkPhone.trim();
      if (!finalEmail) {
        await showError("Validation Error", "EMI সেলের জন্য কাস্টমারের Email আবশ্যক। অনুগ্রহ করে Email দিন।");
        return;
      }
      if (!finalPhone) {
        await showError("Validation Error", t("pos_err_emi_req_contact"));
        return;
      }
      if (paidNum >= total) {
        await showError("Validation Error", t("pos_err_emi_down_full"));
        return;
      }
    }
    
    setBusy(true);
    try {
      let customerId2: number | null = customerMode === "existing" && customerId ? Number(customerId) : null;

      // Walk-in with a phone match: link to the existing customer record
      if (customerMode === "walkin" && matchedId) {
        customerId2 = matchedId;
      }

      const sale = await api<{ id: number; invoice_no: string; public_invoice_url?: string }>("/pos/checkout/", {
        method: "POST",
        body: {
          customer: customerId2,
          customer_name: customerMode === "walkin" ? walkName.trim() : "",
          customer_phone: customerMode === "walkin" ? walkPhone.trim() : "",
          customer_email: customerMode === "existing" ? existingEmail.trim() : walkEmail.trim(),
          customer_address: customerMode === "walkin" ? walkAddress.trim() : "",
          discount: discountNum,
          delivery_charge: deliveryCharge,
          tax: 0,
          note: asQuotation ? "Quotation / প্রাক-বিক্রয় কোটেশন" : "",
          items: cart.map((l) => {
            const mult = Number((l.product as any)?.purchase_multiplier) || 1;
            const isBulk = l.sellMode === "bulk" && mult > 1;
            const effQty = isBulk ? Number((l.qty * mult).toFixed(3)) : l.qty;
            const effPrice = isBulk ? Number((l.price / mult).toFixed(4)) : l.price;
            return { 
              product: l.product.id, 
              quantity: effQty, 
              unit_price: effPrice, 
              discount: l.discount,
              unit_ids: asQuotation ? [] : (l.selectedUnits ? l.selectedUnits.map(u => u.id) : [])
            };
          }),
          payments: asQuotation ? [] : (finalPaid > 0 ? [{ amount: finalPaid, method }] : []),
          sale_date: user?.shop_offline_sale_mode && saleDate ? new Date(saleDate).toISOString() : undefined,
          due_date: (!asQuotation && !isEmi && paid !== "" && paidNum < total && dueDate) ? dueDate : undefined,
          is_emi: asQuotation ? false : isEmi,
          emi_months: (isEmi && !asQuotation) ? emiMonths : 0,
          down_payment: (isEmi && !asQuotation) ? finalPaid : 0,
          emi_interest_percent: (isEmi && !asQuotation) ? emiInterestPercent : 0,
          is_quotation: asQuotation,
        },
      });

      sessionStorage.removeItem("pos_cart");
      const custPhone = customerMode === "walkin"
        ? walkPhone.trim()
        : (customers.find(c => c.id === Number(customerId))?.phone || "");
      const custName = customerMode === "walkin"
        ? walkName.trim()
        : (customers.find(c => c.id === Number(customerId))?.name || "Customer");
      const pdfUrl = sale.public_invoice_url
        ? (sale.public_invoice_url.startsWith("http") ? sale.public_invoice_url : window.location.origin + sale.public_invoice_url)
        : "";
      setSaleResult({ id: sale.id, invoice_no: sale.invoice_no, phone: custPhone, name: custName, total, pdfUrl });
    } catch (e: any) {
      const msg = formatApiErrorMessage(e) || t("pos_err_checkout_failed");
      await showError("Transaction Failed", msg);
    } finally {
      setBusy(false);
    }

  }

  if (cart.length === 0 && !sessionStorage.getItem("pos_cart")) return <Spinner label="Loading…" />;

  return (
    <div className="row g-3">
      {/* Order summary */}
      <div className="col-lg-7">
        <div className="fw-semibold mb-2 text-secondary small">{t("pos_checkout_step2")}</div>
        <div className="card shadow-sm">
          <div className="card-header fw-semibold">{t("pos_checkout_order_summary")}</div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead className="thead-4">
                  <tr><th className="ps-3">{t("pos_checkout_product")}</th><th className="text-center">{t("pos_checkout_qty")}</th><th className="text-end">{t("pos_checkout_price")}</th><th className="text-end pe-3">{t("pos_checkout_total")}</th></tr>
                </thead>
                <tbody>
                  {cart.map((l) => {
                    const mult = Number((l.product as any)?.purchase_multiplier) || 1;
                    const isBulk = l.sellMode === "bulk" && mult > 1;
                    const unitLabel = isBulk ? ((l.product as any)?.purchase_unit_detail?.name || "Drum/Pack") : ((l.product as any)?.unit_detail?.short_code || "");
                    return (
                      <tr key={l.product.id}>
                        <td className="ps-3">
                          <div className="fw-medium">{l.product.name}</div>
                          {isBulk && (
                            <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25" style={{ fontSize: "0.68rem" }}>
                              📦 Full {unitLabel} ({mult} {(l.product as any)?.unit_detail?.short_code || "Unit"})
                            </span>
                          )}
                        </td>
                        <td className="text-center">{l.qty} {unitLabel}</td>
                        <td className="text-end">{money(l.price)}</td>
                        <td className="text-end pe-3 fw-semibold">{money(l.qty * l.price - l.discount)}</td>
                      </tr>
                    );
                  })}
                  <tr className="table-light">
                    <td colSpan={3} className="ps-3 fw-bold">{t("pos_checkout_total")}</td>
                    <td className="text-end pe-3 fw-bold">{money(subtotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="card-footer">
            <button className="btn btn-outline-secondary btn-sm" onClick={() => router.push("/app/pos")}>
              {t("pos_checkout_back_cart")}
            </button>
          </div>
        </div>
      </div>

      {/* Customer + payment */}
      <div className="col-lg-5">
        <div className="card shadow border-0 rounded-4">
          <div className="card-header bg-transparent border-0 pt-4 pb-2 px-4 fw-bold fs-5">
            {t("pos_checkout_cust_pay")}
          </div>
          <div className="card-body vstack gap-3 px-4 pb-4">
            <div className="form-floating">
              <select
                className="form-select form-select-lg shadow-sm" id="customerMode"
                value={customerMode === "existing" ? customerId || "existing" : "walkin"}
                onChange={(e) => {
                  if (e.target.value === "walkin") { setCustomerMode("walkin"); setCustomerId(""); }
                  else { setCustomerMode("existing"); setCustomerId(e.target.value); }
                }}
              >
                <option value="walkin">{t("pos_checkout_walkin")}</option>
                {customers.map((c) => <option key={c.id} value={c.id}>👤 {c.name}{c.phone ? ` · ${c.phone}` : ""}</option>)}
              </select>
              <label htmlFor="customerMode">{t("pos_checkout_select_cust")}</label>
            </div>

            {customerMode === "existing" && customerId && (
              <div className="p-3 bg-light rounded-3 border vstack gap-2">
                 <div className="form-floating">
                   <input id="existingEmail" type="email"
                     className={`form-control shadow-sm${isEmi && !existingEmail ? " is-invalid" : ""}`}
                     value={existingEmail} onChange={(e) => setExistingEmail(e.target.value)}
                     placeholder={lang === "bn" ? "ইমেইল লিখুন…" : "Enter email…"} required={isEmi} />
                   <label htmlFor="existingEmail">
                     {isEmi ? "📧 Email (Required for EMI)" : t("pos_checkout_email_opt")}
                   </label>
                 </div>
                 {!existingEmail && isEmi && (
                   <div className="text-danger small mt-n1 fw-medium">
                     <i className="bi bi-exclamation-triangle-fill me-1"></i> EMI-র জন্য Email আবশ্যক
                   </div>
                 )}
              </div>
            )}

            {customerMode === "walkin" && (
              <div className="p-3 bg-light rounded-3 border vstack gap-3">
                <div className="form-floating">
                  <input id="walkPhone" className="form-control shadow-sm" value={walkPhone} onChange={(e) => onWalkPhoneChange(e.target.value)} placeholder="01XXXXXXXXX" autoFocus />
                  <label htmlFor="walkPhone">{t("pos_checkout_phone")}</label>
                </div>
                {matchedId && (
                  <div className="text-success small fw-semibold mt-n1">
                    <i className="bi bi-check-circle-fill me-1"></i> {t("pos_checkout_auto_filled")}
                  </div>
                )}
                <div className="form-floating">
                  <input id="walkName" className="form-control shadow-sm" value={walkName} onChange={(e) => setWalkName(e.target.value)} placeholder={lang === "bn" ? "নাম লিখুন…" : "Enter name…"} />
                  <label htmlFor="walkName">{t("pos_checkout_cust_name")}</label>
                </div>
                <div className="form-floating">
                  <input id="walkEmail" type="email"
                    className={`form-control shadow-sm${isEmi && !walkEmail ? " is-invalid" : ""}`}
                    value={walkEmail} onChange={(e) => setWalkEmail(e.target.value)}
                    placeholder={lang === "bn" ? "ইমেইল লিখুন…" : "Enter email…"} required={isEmi} />
                  <label htmlFor="walkEmail">
                    {isEmi ? "📧 Email (Required for EMI)" : t("pos_checkout_email_opt")}
                  </label>
                  {isEmi && !walkEmail && (
                    <div className="text-danger small mt-1 fw-medium">
                      <i className="bi bi-exclamation-triangle-fill me-1"></i> EMI-র জন্য Email আবশ্যক
                    </div>
                  )}
                </div>
                <div className="form-floating">
                  <input id="walkAddress" className="form-control shadow-sm" value={walkAddress} onChange={(e) => setWalkAddress(e.target.value)} placeholder={lang === "bn" ? "ঐচ্ছিক…" : "Optional…"} />
                  <label htmlFor="walkAddress">{t("pos_checkout_address_opt")}</label>
                </div>
              </div>
            )}

            {user?.shop_offline_sale_mode && (
              <div className="p-3 bg-warning bg-opacity-10 border border-warning rounded-3 vstack gap-2 mb-3 shadow-sm">
                <div className="fw-bold text-warning-emphasis small">
                  <i className="bi bi-exclamation-triangle-fill me-1"></i> Offline Sale Entry Mode Active
                </div>
                <div className="form-text mt-0 mb-1" style={{ fontSize: "0.75rem" }}>
                  Stock validation is relaxed. You can optionally backdate this sale if recovering from an outage.
                </div>
                <div className="form-floating">
                  <input
                    type="datetime-local"
                    className="form-control border-warning bg-white shadow-sm"
                    id="saleDate"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                  />
                  <label htmlFor="saleDate">{lang === "bn" ? "পূর্ববর্তী বিক্রয় সময় (ঐচ্ছিক)" : "Backdated Sale Time (Optional)"}</label>
                </div>
              </div>
            )}

            <div className="row g-3">
              <div className={user?.shop_delivery_enabled !== false ? "col-4" : "col-6"}>
                <div className="form-floating">
                  <input id="discountInput" type="number" min={0} className="form-control fw-bold text-success shadow-sm" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
                  <label htmlFor="discountInput">{t("pos_checkout_discount")}</label>
                </div>
              </div>
              {user?.shop_delivery_enabled !== false && (
                <div className="col-4">
                  <div className="form-floating">
                    <input id="deliveryChargeInput" type="number" min={0} className="form-control fw-bold text-info shadow-sm" value={deliveryCharge} onChange={(e) => setDeliveryCharge(Number(e.target.value) || 0)} />
                    <label htmlFor="deliveryChargeInput" style={{ fontSize: "0.8rem" }}>{t("pos_checkout_delivery")}</label>
                  </div>
                </div>
              )}
              <div className={user?.shop_delivery_enabled !== false ? "col-4" : "col-6"}>
                <div className="form-floating">
                  <input id="paidInput" type="number" min={0} className="form-control fw-bold text-primary shadow-sm" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder={String(total)} />
                  <label htmlFor="paidInput">{isEmi ? t("pos_checkout_down_payment") : t("pos_checkout_amount_paid")}</label>
                </div>
              </div>
            </div>

            {user?.shop_emi_enabled && (
              <div className="form-check form-switch fs-5 mt-2 mb-1">
                <input className="form-check-input" type="checkbox" role="switch" id="emiSwitch" checked={isEmi} onChange={(e) => setIsEmi(e.target.checked)} />
                <label className="form-check-label ms-2 fw-semibold text-primary" htmlFor="emiSwitch">{t("pos_checkout_emi_enable")}</label>
              </div>
            )}

            {isEmi && (
              <div className="p-3 bg-primary bg-opacity-10 rounded-3 border border-primary vstack gap-2 shadow-sm">
                <div className="row g-2 mb-2">
                  <div className="col-8">
                    <div className="form-floating">
                      <select id="emiMonths" className="form-select" value={emiMonths} onChange={(e) => setEmiMonths(Number(e.target.value))}>
                        <option value={3}>{t("pos_checkout_emi_months", { months: 3 })}</option>
                        <option value={6}>{t("pos_checkout_emi_months", { months: 6 })}</option>
                        <option value={9}>{t("pos_checkout_emi_months", { months: 9 })}</option>
                        <option value={12}>{t("pos_checkout_emi_months", { months: 12 })}</option>
                        <option value={18}>{t("pos_checkout_emi_months", { months: 18 })}</option>
                        <option value={24}>{t("pos_checkout_emi_months", { months: 24 })}</option>
                      </select>
                      <label htmlFor="emiMonths">{t("pos_checkout_emi_duration")}</label>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="form-floating">
                      <input id="emiInterest" type="number" min={0} max={100} step="0.1" className="form-control" value={emiInterestPercent} onChange={(e) => setEmiInterestPercent(Number(e.target.value) || 0)} />
                      <label htmlFor="emiInterest">{t("pos_checkout_emi_interest")}</label>
                    </div>
                  </div>
                </div>
                
                <div className="d-flex justify-content-between fs-6 text-secondary">
                  <span>{t("pos_checkout_emi_principal")}</span>
                  <span className="fw-bold">{money(Math.max(0, total - paidNum))}</span>
                </div>
                {emiInterestPercent > 0 && (
                  <div className="d-flex justify-content-between fs-6 text-secondary">
                    <span>{t("pos_checkout_emi_interest_label", { percent: emiInterestPercent })}</span>
                    <span className="fw-bold">{money(Math.max(0, total - paidNum) * (emiInterestPercent / 100))}</span>
                  </div>
                )}
                <div className="d-flex justify-content-between fs-5 text-primary fw-bold">
                  <span>{t("pos_checkout_emi_per_month")}</span>
                  <span>{money((Math.max(0, total - paidNum) * (1 + (emiInterestPercent / 100))) / emiMonths)} {t("pos_checkout_mo")}</span>
                </div>
              </div>
            )}

            {!isEmi && paid !== "" && paidNum < total && (
              <div className="p-3 bg-danger bg-opacity-10 rounded-3 border border-danger-subtle vstack gap-2 shadow-sm">
                <div className="d-flex align-items-center justify-content-between">
                  <div className="fw-bold text-danger small d-flex align-items-center gap-1">
                    <i className="bi bi-calendar-event-fill"></i>
                    <span>{t("pos_checkout_due_date_title")}</span>
                  </div>
                  <span className="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill">
                    {t("sales_list_col_due") || "Due"}: {money(total - paidNum)}
                  </span>
                </div>
                <div className="text-secondary small" style={{ fontSize: "0.78rem" }}>
                  {t("pos_checkout_due_date_desc")}
                </div>

                <div className="d-flex flex-wrap gap-1 my-1">
                  <button
                    type="button"
                    className={`btn btn-xs rounded-pill px-2 py-1 ${dueDate === addDays(7) ? "btn-danger text-white fw-bold" : "btn-outline-danger bg-white"}`}
                    style={{ fontSize: "0.75rem" }}
                    onClick={() => setDueDate(addDays(7))}
                  >
                    {t("pos_checkout_quick_7d")}
                  </button>
                  <button
                    type="button"
                    className={`btn btn-xs rounded-pill px-2 py-1 ${dueDate === addDays(15) ? "btn-danger text-white fw-bold" : "btn-outline-danger bg-white"}`}
                    style={{ fontSize: "0.75rem" }}
                    onClick={() => setDueDate(addDays(15))}
                  >
                    {t("pos_checkout_quick_15d")}
                  </button>
                  <button
                    type="button"
                    className={`btn btn-xs rounded-pill px-2 py-1 ${dueDate === addDays(30) ? "btn-danger text-white fw-bold" : "btn-outline-danger bg-white"}`}
                    style={{ fontSize: "0.75rem" }}
                    onClick={() => setDueDate(addDays(30))}
                  >
                    {t("pos_checkout_quick_30d")}
                  </button>
                  <button
                    type="button"
                    className={`btn btn-xs rounded-pill px-2 py-1 ${dueDate === getNextMonthFirstDay() ? "btn-danger text-white fw-bold" : "btn-outline-danger bg-white"}`}
                    style={{ fontSize: "0.75rem" }}
                    onClick={() => setDueDate(getNextMonthFirstDay())}
                  >
                    {t("pos_checkout_quick_next_month")}
                  </button>
                </div>

                <div className="form-floating">
                  <input
                    type="date"
                    className="form-control bg-white shadow-sm border-danger-subtle"
                    id="dueDateInput"
                    min={new Date().toISOString().split("T")[0]}
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                  <label htmlFor="dueDateInput" className="text-danger fw-medium">
                    📅 {t("pos_checkout_due_date_placeholder")}
                  </label>
                </div>
              </div>
            )}

            <div className="form-floating">
              <select id="payMethod" className="form-select shadow-sm" value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <label htmlFor="payMethod">{isEmi ? t("pos_checkout_down_pay_method") : t("pos_checkout_pay_method")}</label>
            </div>

            <div className="border-top border-bottom py-3 my-2 bg-body-tertiary rounded-3 px-3 shadow-sm">
              <div className="d-flex justify-content-between text-secondary mb-2"><span>{t("pos_checkout_subtotal")}</span><span>{money(subtotal)}</span></div>
              {discountNum > 0 && <div className="d-flex justify-content-between text-success mb-2"><span>{t("pos_checkout_discount").replace(" (৳) *", "")}</span><span>- {money(discountNum)}</span></div>}
              {deliveryCharge > 0 && <div className="d-flex justify-content-between text-info mb-2"><span>{t("pos_checkout_delivery").replace(" (৳)", "")}</span><span>+ {money(deliveryCharge)}</span></div>}
              <div className="d-flex justify-content-between fw-bold fs-5 mb-2"><span>{t("pos_checkout_total")}</span><span>{money(total)}</span></div>
              {change > 0 && <div className="d-flex justify-content-between text-info fw-semibold border-top pt-2 mt-2"><span>{t("pos_checkout_change_due")}</span><span>{money(change)}</span></div>}
              {paid !== "" && paidNum < total && <div className="d-flex justify-content-between text-danger fw-semibold border-top pt-2 mt-2"><span>{t("sales_list_col_due") || "Due"}</span><span>{money(total - paidNum)}</span></div>}
            </div>

            <div className="d-grid gap-2 mt-4">
              <button className="btn btn-primary btn-lg fw-semibold rounded-3 shadow" disabled={busy} onClick={() => complete(false)} style={{ padding: "0.9rem" }}>
                {busy ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-check2-circle me-2"></i>}
                {t("pos_checkout_complete")}
              </button>

              <button className="btn btn-outline-primary fw-semibold rounded-3 shadow-sm" disabled={busy} onClick={() => complete(true)} style={{ padding: "0.65rem" }}>
                <i className="bi bi-file-earmark-text me-2"></i>
                {lang === "bn" ? "📑 কোটেশন সেভ করুন (Save Quotation)" : "📑 Save as Quotation"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── After-sale: choose Print or WhatsApp ── */}
      {saleResult && (() => {
        const digits = (saleResult.phone || "").replace(/\D/g, "");
        const intl = digits.startsWith("880") ? digits
          : digits.startsWith("0") ? "880" + digits.slice(1)
          : digits.length === 10 ? "880" + digits : digits;
        const shop = user?.shop_name || "our shop";
        const msg = t("pos_wa_hello", { name: saleResult.name || "", shop: shop })
          + t("pos_wa_invoice", { invoice: saleResult.invoice_no })
          + t("pos_wa_total", { total: saleResult.total.toFixed(2) })
          + (saleResult.pdfUrl ? t("pos_wa_pdf", { url: saleResult.pdfUrl }) : "")
          + t("pos_wa_thanks");
        const waUrl = `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`;
        const hasPhone = digits.length >= 10;
        const waEnabled = user?.shop_whatsapp_enabled !== false;
        return (
          <div className="modal d-block" style={{ background: "rgba(15,23,42,.55)" }} onClick={() => router.push("/app/pos")}>
            <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
                <div className="p-4 text-center text-white" style={{ background: "linear-gradient(135deg,#1d4ed8,#2563eb)" }}>
                  <div className="fs-1 mb-1">✅</div>
                  <h5 className="fw-bold mb-1">{t("pos_checkout_sale_completed")}</h5>
                  <div className="opacity-75 small">{t("pos_checkout_invoice", { invoice: saleResult.invoice_no })} · {money(saleResult.total)}</div>
                </div>
                <div className="p-4">
                  <p className="text-secondary small text-center mb-3">
                    {waEnabled ? t("pos_checkout_share_q") : t("pos_checkout_print_q")}
                  </p>
                  <div className="d-grid gap-2">
                    <button
                      className="btn btn-primary btn-lg rounded-3 fw-semibold"
                      onClick={() => {
                        const mode = user?.shop_pos_print_mode || "ask";
                        if (mode === "pos") {
                          router.push(`/invoice/${saleResult.id}?format=pos`);
                        } else if (mode === "regular") {
                          router.push(`/invoice/${saleResult.id}?format=regular`);
                        } else {
                          setShowPrintModal(true);
                        }
                      }}
                    >
                      <i className="bi bi-printer me-2"></i> {t("pos_checkout_print_btn")}
                    </button>
                    {waEnabled && hasPhone && (
                      <a
                        className="btn btn-lg rounded-3 fw-semibold text-white"
                        style={{ background: "#25D366" }}
                        href={waUrl}
                        target="_blank" rel="noreferrer"
                      >
                        <i className="bi bi-whatsapp me-2"></i> {t("pos_checkout_wa_btn")}
                      </a>
                    )}
                  </div>
                </div>
                <div className="px-4 pb-4 d-flex gap-2">
                  <button className="btn btn-outline-secondary flex-grow-1 rounded-3" onClick={() => router.push("/app/pos")}>
                    {t("pos_checkout_close_new")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {saleResult && (
        <PrintFormatModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          invoiceId={saleResult.id}
        />
      )}
    </div>
  );
}
