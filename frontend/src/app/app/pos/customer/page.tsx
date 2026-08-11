"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { showError } from "@/lib/dialogs";
import { useRouter } from "next/navigation";
import { api, fetchAll } from "@/lib/api";
import { Spinner, money } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";

type ProductUnit = { id: number; barcode: string; effective_selling_price?: string };
type CartLine = { product: { id: number; name: string }; qty: number; price: number; discount: number; selectedUnits: ProductUnit[] };
type Customer = { id: number; name: string; phone?: string; email?: string; };

const PAY_METHODS = [
  { value: "cash", label: "💵 Cash" },
  { value: "card", label: "💳 Card" },
  { value: "bkash", label: "📱 bKash" },
  { value: "nagad", label: "📱 Nagad" },
  { value: "bank", label: "🏦 Bank transfer" },
];

export default function PosCustomerPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerMode, setCustomerMode] = useState<"walkin" | "existing">("walkin");
  const [customerId, setCustomerId] = useState("");
  const [walkName, setWalkName] = useState("");
  const [walkPhone, setWalkPhone] = useState("");
  const [walkAddress, setWalkAddress] = useState("");
  const [discount, setDiscount] = useState("");
  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [paid, setPaid] = useState("");
  const [method, setMethod] = useState("cash");
  const [isEmi, setIsEmi] = useState(false);
  const [emiMonths, setEmiMonths] = useState(3);
  const [emiInterestPercent, setEmiInterestPercent] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem("pos_cart");
    if (!saved) { router.replace("/app/pos"); return; }
    try { setCart(JSON.parse(saved)); } catch { router.replace("/app/pos"); }
    fetchAll<Customer>("/crm/customers/").then(setCustomers).catch(() => {});
  }, [router]);

  const discountNum = Number(discount) || 0;
  const subtotal = cart.reduce((s, l) => s + l.qty * l.price - l.discount, 0);
  const total = Math.max(0, subtotal - discountNum + deliveryCharge);
  const paidNum = Number(paid) || 0;
  const change = paidNum > total ? paidNum - total : 0;

  async function complete() {
    if (discount === "" && paid === "") {
      await showError("Validation Error", "Please enter either Discount or Amount paid (enter 0 if none).");
      return;
    }
    const finalPaid = paid === "" ? total : Number(paid);
    if (customerMode === "walkin" && !walkName.trim()) { await showError("Validation Error", "Customer name is required."); return; }
    if (customerMode === "walkin" && !walkPhone.trim()) { await showError("Validation Error", "Phone is required."); return; }
    if (isEmi) {
      if (customerMode === "walkin") {
        await showError("Validation Error", "EMI sales require an existing registered customer.");
        return;
      }
      const selectedCustomer = customers.find(c => c.id === Number(customerId));
      if (!selectedCustomer?.email || !selectedCustomer?.phone) {
        await showError("Validation Error", "EMI sales require the customer to have a registered email and phone number.");
        return;
      }
      if (paidNum >= total) {
        await showError("Validation Error", "Down payment cannot cover the full amount for an EMI sale.");
        return;
      }
    }
    
    setBusy(true);
    try {
      let customerId2: number | null = customerMode === "existing" && customerId ? Number(customerId) : null;

      // Create walk-in customer if needed
      if (customerMode === "walkin") {
        const c = await api<{ id: number }>("/crm/customers/", {
          method: "POST",
          body: { name: walkName.trim(), phone: walkPhone.trim(), address: walkAddress.trim() },
        }).catch(() => null);
        if (c) customerId2 = c.id;
      }

      const sale = await api<{ id: number; invoice_no: string }>("/pos/checkout/", {
        method: "POST",
        body: {
          customer: customerId2,
          discount: discountNum,
          delivery_charge: deliveryCharge,
          tax: 0,
          note: "",
          items: cart.map((l) => ({ 
            product: l.product.id, 
            quantity: l.qty, 
            unit_price: l.price, 
            discount: l.discount,
            unit_ids: l.selectedUnits ? l.selectedUnits.map(u => u.id) : []
          })),
          payments: finalPaid > 0 ? [{ amount: finalPaid, method }] : [],
          is_emi: isEmi,
          emi_months: isEmi ? emiMonths : 0,
          down_payment: isEmi ? finalPaid : 0,
          emi_interest_percent: isEmi ? emiInterestPercent : 0,
        },
      });

      sessionStorage.removeItem("pos_cart");
      router.push(`/invoice/${sale.id}`);
    } catch (e: any) {
      const msg = e?.data?.detail || e?.message || "Checkout failed. Please try again.";
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
        <div className="fw-semibold mb-2 text-secondary small">Point of Sale · Step 2: Customer &amp; payment</div>
        <div className="card shadow-sm">
          <div className="card-header fw-semibold">Order summary</div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead className="thead-4">
                  <tr><th className="ps-3">Product</th><th className="text-center">Qty</th><th className="text-end">Price</th><th className="text-end pe-3">Total</th></tr>
                </thead>
                <tbody>
                  {cart.map((l) => (
                    <tr key={l.product.id}>
                      <td className="ps-3 fw-medium">{l.product.name}</td>
                      <td className="text-center">{l.qty}</td>
                      <td className="text-end">{l.price}</td>
                      <td className="text-end pe-3 fw-semibold">{money(l.qty * l.price - l.discount)}</td>
                    </tr>
                  ))}
                  <tr className="table-light">
                    <td colSpan={3} className="ps-3 fw-bold">Total</td>
                    <td className="text-end pe-3 fw-bold">{money(subtotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="card-footer">
            <button className="btn btn-outline-secondary btn-sm" onClick={() => router.push("/app/pos")}>
              ← Back to cart
            </button>
          </div>
        </div>
      </div>

      {/* Customer + payment */}
      <div className="col-lg-5">
        <div className="card shadow border-0 rounded-4">
          <div className="card-header bg-transparent border-0 pt-4 pb-2 px-4 fw-bold fs-5">
            Customer & Payment
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
                <option value="walkin">🚶 Walk-in customer</option>
                {customers.map((c) => <option key={c.id} value={c.id}>👤 {c.name}{c.phone ? ` · ${c.phone}` : ""}</option>)}
              </select>
              <label htmlFor="customerMode">Select Customer</label>
            </div>

            {customerMode === "walkin" && (
              <div className="p-3 bg-light rounded-3 border vstack gap-3">
                <div className="form-floating">
                  <input id="walkName" className="form-control shadow-sm" value={walkName} onChange={(e) => setWalkName(e.target.value)} placeholder="Enter name…" />
                  <label htmlFor="walkName">Customer name *</label>
                </div>
                <div className="form-floating">
                  <input id="walkPhone" className="form-control shadow-sm" value={walkPhone} onChange={(e) => setWalkPhone(e.target.value)} placeholder="01XXXXXXXXX" />
                  <label htmlFor="walkPhone">Phone *</label>
                </div>
                <div className="form-floating">
                  <input id="walkAddress" className="form-control shadow-sm" value={walkAddress} onChange={(e) => setWalkAddress(e.target.value)} placeholder="Optional…" />
                  <label htmlFor="walkAddress">Address (Optional)</label>
                </div>
              </div>
            )}

            <div className="row g-3">
              <div className={user?.shop_delivery_enabled !== false ? "col-4" : "col-6"}>
                <div className="form-floating">
                  <input id="discountInput" type="number" min={0} className="form-control fw-bold text-success shadow-sm" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
                  <label htmlFor="discountInput">Discount (৳) *</label>
                </div>
              </div>
              {user?.shop_delivery_enabled !== false && (
                <div className="col-4">
                  <div className="form-floating">
                    <input id="deliveryChargeInput" type="number" min={0} className="form-control fw-bold text-info shadow-sm" value={deliveryCharge} onChange={(e) => setDeliveryCharge(Number(e.target.value) || 0)} />
                    <label htmlFor="deliveryChargeInput" style={{ fontSize: "0.8rem" }}>Delivery (৳)</label>
                  </div>
                </div>
              )}
              <div className={user?.shop_delivery_enabled !== false ? "col-4" : "col-6"}>
                <div className="form-floating">
                  <input id="paidInput" type="number" min={0} className="form-control fw-bold text-primary shadow-sm" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder={String(total)} />
                  <label htmlFor="paidInput">{isEmi ? "Down payment *" : "Amount paid *"}</label>
                </div>
              </div>
            </div>

            {user?.shop_emi_enabled && (
              <div className="form-check form-switch fs-5 mt-2 mb-1">
                <input className="form-check-input" type="checkbox" role="switch" id="emiSwitch" checked={isEmi} onChange={(e) => setIsEmi(e.target.checked)} />
                <label className="form-check-label ms-2 fw-semibold text-primary" htmlFor="emiSwitch">Enable EMI (Installments)</label>
              </div>
            )}

            {isEmi && (
              <div className="p-3 bg-primary bg-opacity-10 rounded-3 border border-primary vstack gap-2 shadow-sm">
                <div className="row g-2 mb-2">
                  <div className="col-8">
                    <div className="form-floating">
                      <select id="emiMonths" className="form-select" value={emiMonths} onChange={(e) => setEmiMonths(Number(e.target.value))}>
                        <option value={3}>3 Months</option>
                        <option value={6}>6 Months</option>
                        <option value={9}>9 Months</option>
                        <option value={12}>12 Months</option>
                        <option value={18}>18 Months</option>
                        <option value={24}>24 Months</option>
                      </select>
                      <label htmlFor="emiMonths">EMI Duration</label>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="form-floating">
                      <input id="emiInterest" type="number" min={0} max={100} step="0.1" className="form-control" value={emiInterestPercent} onChange={(e) => setEmiInterestPercent(Number(e.target.value) || 0)} />
                      <label htmlFor="emiInterest">Interest %</label>
                    </div>
                  </div>
                </div>
                
                <div className="d-flex justify-content-between fs-6 text-secondary">
                  <span>EMI Principal:</span>
                  <span className="fw-bold">{money(Math.max(0, total - paidNum))}</span>
                </div>
                {emiInterestPercent > 0 && (
                  <div className="d-flex justify-content-between fs-6 text-secondary">
                    <span>Interest ({emiInterestPercent}%):</span>
                    <span className="fw-bold">{money(Math.max(0, total - paidNum) * (emiInterestPercent / 100))}</span>
                  </div>
                )}
                <div className="d-flex justify-content-between fs-5 text-primary fw-bold">
                  <span>Per Month EMI:</span>
                  <span>{money((Math.max(0, total - paidNum) * (1 + (emiInterestPercent / 100))) / emiMonths)} /mo</span>
                </div>
              </div>
            )}

            <div className="form-floating">
              <select id="payMethod" className="form-select shadow-sm" value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <label htmlFor="payMethod">{isEmi ? "Down payment method" : "Payment method"}</label>
            </div>

            <div className="border-top border-bottom py-3 my-2 bg-body-tertiary rounded-3 px-3 shadow-sm">
              <div className="d-flex justify-content-between text-secondary mb-2"><span>Subtotal</span><span>{money(subtotal)}</span></div>
              {discountNum > 0 && <div className="d-flex justify-content-between text-success mb-2"><span>Discount</span><span>- {money(discountNum)}</span></div>}
              {deliveryCharge > 0 && <div className="d-flex justify-content-between text-info mb-2"><span>Delivery Charge</span><span>+ {money(deliveryCharge)}</span></div>}
              <div className="d-flex justify-content-between fw-bold fs-5 mb-2"><span>Total</span><span>{money(total)}</span></div>
              {change > 0 && <div className="d-flex justify-content-between text-info fw-semibold border-top pt-2 mt-2"><span>Change due</span><span>{money(change)}</span></div>}
            </div>

            <div className="d-grid mt-4">
              <button className="btn btn-primary btn-lg fw-semibold rounded-3 shadow" disabled={busy} onClick={complete} style={{ padding: "1rem" }}>
                {busy ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-receipt me-2"></i>}
                Complete sale &amp; print invoice
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
