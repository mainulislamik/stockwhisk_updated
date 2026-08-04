"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, fetchAll } from "@/lib/api";
import { Spinner, money } from "@/components/ui";

type CartLine = { product: { id: number; name: string }; qty: number; price: number; discount: number };
type Customer = { id: number; name: string; phone?: string };

const PAY_METHODS = [
  { value: "cash", label: "💵 Cash" },
  { value: "card", label: "💳 Card" },
  { value: "bkash", label: "📱 bKash" },
  { value: "nagad", label: "📱 Nagad" },
  { value: "bank", label: "🏦 Bank transfer" },
];

export default function PosCustomerPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerMode, setCustomerMode] = useState<"walkin" | "existing">("walkin");
  const [customerId, setCustomerId] = useState("");
  const [walkName, setWalkName] = useState("");
  const [walkPhone, setWalkPhone] = useState("");
  const [walkAddress, setWalkAddress] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState("");
  const [method, setMethod] = useState("cash");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem("pos_cart");
    if (!saved) { router.replace("/app/pos"); return; }
    try { setCart(JSON.parse(saved)); } catch { router.replace("/app/pos"); }
    fetchAll<Customer>("/crm/customers/").then(setCustomers).catch(() => {});
  }, [router]);

  const subtotal = cart.reduce((s, l) => s + l.qty * l.price - l.discount, 0);
  const total = Math.max(0, subtotal - discount);
  const paidNum = Number(paid) || 0;
  const change = paidNum > total ? paidNum - total : 0;

  async function complete() {
    if (customerMode === "walkin" && !walkName.trim()) { setError("Customer name is required."); return; }
    if (customerMode === "walkin" && !walkPhone.trim()) { setError("Phone is required."); return; }
    setError("");
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
          discount,
          tax: 0,
          note: "",
          items: cart.map((l) => ({ product: l.product.id, quantity: l.qty, unit_price: l.price, discount: l.discount })),
          payments: paidNum > 0 ? [{ amount: paidNum, method }] : [{ amount: total, method }],
        },
      });

      sessionStorage.removeItem("pos_cart");
      router.push(`/invoice/${sale.id}`);
    } catch (e: any) {
      setError(e?.data?.detail || e?.message || "Checkout failed. Please try again.");
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
        <div className="card shadow-sm">
          <div className="card-header fw-semibold">Customer</div>
          <div className="card-body vstack gap-3">
            <div>
              <select
                className="form-select form-select-sm"
                value={customerMode === "existing" ? customerId || "existing" : "walkin"}
                onChange={(e) => {
                  if (e.target.value === "walkin") { setCustomerMode("walkin"); setCustomerId(""); }
                  else { setCustomerMode("existing"); setCustomerId(e.target.value); }
                }}
              >
                <option value="walkin">Walk-in customer</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</option>)}
              </select>
            </div>

            {customerMode === "walkin" && (
              <>
                <div>
                  <label className="small fw-medium">Customer name *</label>
                  <input className="form-control form-control-sm" value={walkName} onChange={(e) => setWalkName(e.target.value)} placeholder="Enter name…" />
                </div>
                <div>
                  <label className="small fw-medium">Phone *</label>
                  <input className="form-control form-control-sm" value={walkPhone} onChange={(e) => setWalkPhone(e.target.value)} placeholder="01XXXXXXXXX" />
                </div>
                <div>
                  <label className="small fw-medium">Address</label>
                  <input className="form-control form-control-sm" value={walkAddress} onChange={(e) => setWalkAddress(e.target.value)} placeholder="Optional…" />
                </div>
              </>
            )}

            <div className="row g-2">
              <div className="col-6">
                <label className="small fw-medium">Discount</label>
                <input type="number" min={0} className="form-control form-control-sm" value={discount} onChange={(e) => setDiscount(Number(e.target.value) || 0)} />
              </div>
              <div className="col-6">
                <label className="small fw-medium">Amount paid *</label>
                <input type="number" min={0} className="form-control form-control-sm" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder={String(total)} />
              </div>
            </div>

            <div>
              <label className="small fw-medium">Payment method</label>
              <select className="form-select form-select-sm" value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            <div className="border-top pt-3">
              <div className="d-flex justify-content-between small mb-1"><span className="text-secondary">Subtotal</span><span>{money(subtotal)}</span></div>
              {discount > 0 && <div className="d-flex justify-content-between small mb-1 text-success"><span>Discount</span><span>- {money(discount)}</span></div>}
              <div className="d-flex justify-content-between fw-bold mb-1"><span>Total</span><span>{money(total)}</span></div>
              {change > 0 && <div className="d-flex justify-content-between small text-success"><span>Change</span><span>{money(change)}</span></div>}
            </div>

            {error && <div className="alert alert-danger py-2 px-3 small mb-0">{error}</div>}

            <button className="btn btn-success w-100 fw-semibold" disabled={busy} onClick={complete} style={{ padding: "0.6rem" }}>
              {busy ? <span className="spinner-border spinner-border-sm me-2" /> : null}
              Complete sale &amp; print invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
