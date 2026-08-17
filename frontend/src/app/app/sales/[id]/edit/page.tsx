"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, Paginated } from "@/lib/api";
import { ErrorState, Spinner, money } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import toast from "react-hot-toast";
import Link from "next/link";

type Product = { id: number; name: string; selling_price: string; current_stock: string; };
type SaleItem = { id: number; product_id: number; product_name: string; quantity: string; unit_price: string; discount: string; subtotal: string; };
type Sale = { id: number; invoice_no: string; sale_date: string; discount: string; tax: string; delivery_charge: string; paid: string; bill_name: string; bill_phone: string; bill_address: string; items: SaleItem[]; status: string; returns?: any[] };

type CartItem = {
    product_id: number;
    name: string;
    quantity: number;
    unit_price: number;
    discount: number;
};

export default function EditInvoicePage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { user } = useAuth();
    const [sale, setSale] = useState<Sale | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    
    const [cart, setCart] = useState<CartItem[]>([]);
    const [saleDiscount, setSaleDiscount] = useState(0);
    const [saleTax, setSaleTax] = useState(0);
    const [saleDelivery, setSaleDelivery] = useState(0);
    
    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [customerAddress, setCustomerAddress] = useState("");
    
    const [reason, setReason] = useState("");
    const [submitting, setSubmitting] = useState(false);
    
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Product[]>([]);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        if (!user) return;
        if (user.role !== "owner") {
            setError("Only Shop Owners can correct invoices.");
            setLoading(false);
            return;
        }

        (async () => {
            try {
                const data = await api<Sale>(`/sales/sales/${id}/`);
                
                if (data.returns && data.returns.length > 0) {
                    setError("Invoices with returns cannot be corrected.");
                    setLoading(false);
                    return;
                }
                
                const saleDate = new Date(data.sale_date).toLocaleDateString();
                const today = new Date().toLocaleDateString();
                if (saleDate !== today) {
                    setError("Invoice locked: correction is only available on the day of creation.");
                    setLoading(false);
                    return;
                }
                
                setSale(data);
                setSaleDiscount(Number(data.discount));
                setSaleTax(Number(data.tax || 0));
                setSaleDelivery(Number(data.delivery_charge || 0));
                setCustomerName(data.bill_name && data.bill_name !== "Walk-in customer" ? data.bill_name : "");
                setCustomerPhone(data.bill_phone || "");
                setCustomerAddress(data.bill_address || "");
                
                const initialCart: CartItem[] = data.items.map(item => ({
                    product_id: item.product_id,
                    name: item.product_name,
                    quantity: Number(item.quantity),
                    unit_price: Number(item.unit_price),
                    discount: Number(item.discount),
                }));
                setCart(initialCart);
                
            } catch (e: any) {
                setError(e?.message || "Failed to load invoice");
            } finally {
                setLoading(false);
            }
        })();
    }, [id, user]);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (!searchQuery.trim()) {
                setSearchResults([]);
                return;
            }
            setSearching(true);
            try {
                const qs = new URLSearchParams({ search: searchQuery, page_size: "5" });
                const res = await api<Paginated<Product>>(`/catalog/products/?${qs.toString()}`);
                setSearchResults(res.results);
            } catch (e) {
                console.error(e);
            } finally {
                setSearching(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleAddProduct = (p: Product) => {
        setCart(prev => {
            const existing = prev.find(x => x.product_id === p.id);
            if (existing) {
                return prev.map(x => x.product_id === p.id ? { ...x, quantity: x.quantity + 1 } : x);
            }
            return [...prev, {
                product_id: p.id,
                name: p.name,
                quantity: 1,
                unit_price: Number(p.selling_price),
                discount: 0
            }];
        });
        setSearchQuery("");
        setSearchResults([]);
    };

    const handleUpdateCart = (idx: number, field: keyof CartItem, val: number) => {
        const newCart = [...cart];
        newCart[idx] = { ...newCart[idx], [field]: val };
        setCart(newCart);
    };

    const handleRemoveCart = (idx: number) => {
        setCart(cart.filter((_, i) => i !== idx));
    };

    const subtotal = cart.reduce((sum, item) => sum + (item.unit_price * item.quantity) - item.discount, 0);
    const total = subtotal - saleDiscount + saleTax + saleDelivery;
    const previouslyPaid = sale ? Number(sale.paid) : 0;
    const newDue = total - previouslyPaid;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (cart.length === 0) {
            toast.error("Cart is empty");
            return;
        }
        if (!reason.trim()) {
            toast.error("Correction reason is required");
            return;
        }
        
        if (!confirm("Are you sure you want to correct this invoice? This will recalculate stock and payments.")) {
            return;
        }

        setSubmitting(true);
        try {
            await api(`/sales/sales/${id}/correct/`, {
                method: "POST",
                body: JSON.stringify({
                    items: cart.map(c => ({
                        product_id: c.product_id,
                        quantity: c.quantity,
                        unit_price: c.unit_price,
                        discount: c.discount
                    })),
                    discount: saleDiscount,
                    tax: saleTax,
                    delivery_charge: saleDelivery,
                    customer_name: customerName,
                    customer_phone: customerPhone,
                    customer_address: customerAddress,
                    correction_reason: reason.trim()
                })
            });
            toast.success("Invoice corrected successfully");
            router.push(`/app/sales/${id}`);
        } catch (err: any) {
            toast.error(err.message || "Failed to correct invoice");
            setSubmitting(false);
        }
    };

    if (loading) return <Spinner label="Loading invoice for editing…" />;
    if (error) return (
        <div className="container py-5">
            <ErrorState error={error} />
            <div className="mt-3 text-center">
                <Link href={`/app/sales/${id}`} className="btn btn-secondary">Go Back</Link>
            </div>
        </div>
    );
    if (!sale) return null;

    return (
        <div className="container py-4" style={{ maxWidth: "800px" }}>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h1 className="h4 fw-bold text-brand mb-0">Correct Invoice: {sale.invoice_no}</h1>
                <Link href={`/app/sales/${id}`} className="btn btn-outline-secondary btn-sm">Cancel</Link>
            </div>

            <div className="card shadow-sm mb-4">
                <div className="card-header bg-light fw-bold">Customer Information</div>
                <div className="card-body">
                    <div className="row g-3">
                        <div className="col-md-4">
                            <label className="form-label small text-muted">Name</label>
                            <input type="text" className="form-control form-control-sm" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Walk-in Customer" />
                        </div>
                        <div className="col-md-4">
                            <label className="form-label small text-muted">Phone</label>
                            <input type="text" className="form-control form-control-sm" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
                        </div>
                        <div className="col-md-4">
                            <label className="form-label small text-muted">Address</label>
                            <input type="text" className="form-control form-control-sm" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="card shadow-sm mb-4">
                <div className="card-body">
                    <div className="d-flex gap-2 mb-3">
                        <div className="position-relative flex-grow-1">
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Search products to add..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searching && <div className="position-absolute end-0 top-50 translate-middle-y me-3"><Spinner /></div>}
                            {searchResults.length > 0 && (
                                <ul className="list-group position-absolute w-100 mt-1 shadow-sm" style={{ zIndex: 1000, maxHeight: "200px", overflowY: "auto" }}>
                                    {searchResults.map(p => (
                                        <button 
                                            key={p.id} 
                                            type="button"
                                            className="list-group-item list-group-item-action d-flex justify-content-between"
                                            onClick={() => handleAddProduct(p)}
                                        >
                                            <span>{p.name}</span>
                                            <span className="text-muted">{money(p.selling_price)}</span>
                                        </button>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <Link href="/app/products" target="_blank" className="btn btn-outline-primary d-flex align-items-center gap-2">
                            <i className="bi bi-plus-lg"></i>
                            <span className="d-none d-md-inline">New Product</span>
                        </Link>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="table-responsive mb-3">
                            <table className="table table-sm align-middle">
                                <thead className="table-light">
                                    <tr>
                                        <th>Product</th>
                                        <th style={{ width: "100px" }}>Qty</th>
                                        <th style={{ width: "120px" }}>Unit Price</th>
                                        <th style={{ width: "100px" }}>Discount</th>
                                        <th className="text-end">Line Total</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cart.map((item, idx) => {
                                        const lineTotal = (item.quantity * item.unit_price) - item.discount;
                                        return (
                                            <tr key={idx}>
                                                <td>{item.name}</td>
                                                <td>
                                                    <input 
                                                        type="number" className="form-control form-control-sm" 
                                                        value={item.quantity || ""} min="0.01" step="any"
                                                        onChange={(e) => handleUpdateCart(idx, "quantity", Number(e.target.value))}
                                                    />
                                                </td>
                                                <td>
                                                    <input 
                                                        type="number" className="form-control form-control-sm" 
                                                        value={item.unit_price || ""} min="0" step="any"
                                                        onChange={(e) => handleUpdateCart(idx, "unit_price", Number(e.target.value))}
                                                    />
                                                </td>
                                                <td>
                                                    <input 
                                                        type="number" className="form-control form-control-sm" 
                                                        value={item.discount || ""} min="0" step="any"
                                                        onChange={(e) => handleUpdateCart(idx, "discount", Number(e.target.value))}
                                                    />
                                                </td>
                                                <td className="text-end">{money(lineTotal)}</td>
                                                <td className="text-end">
                                                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleRemoveCart(idx)}>
                                                        <i className="bi bi-trash"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {cart.length === 0 && (
                                        <tr><td colSpan={6} className="text-center text-muted py-3">Cart is empty</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="row justify-content-end mb-4">
                            <div className="col-md-5">
                                <table className="table table-sm table-borderless">
                                    <tbody>
                                        <tr>
                                            <td>Subtotal</td>
                                            <td className="text-end">{money(subtotal)}</td>
                                        </tr>
                                        <tr>
                                            <td className="align-middle">Sale Discount</td>
                                            <td className="text-end">
                                                <input 
                                                    type="number" className="form-control form-control-sm text-end"
                                                    value={saleDiscount || ""} min="0" step="any"
                                                    onChange={(e) => setSaleDiscount(Number(e.target.value))}
                                                />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="align-middle">Tax / VAT</td>
                                            <td className="text-end">
                                                <input 
                                                    type="number" className="form-control form-control-sm text-end"
                                                    value={saleTax || ""} min="0" step="any"
                                                    onChange={(e) => setSaleTax(Number(e.target.value))}
                                                />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="align-middle">Delivery Charge</td>
                                            <td className="text-end">
                                                <input 
                                                    type="number" className="form-control form-control-sm text-end"
                                                    value={saleDelivery || ""} min="0" step="any"
                                                    onChange={(e) => setSaleDelivery(Number(e.target.value))}
                                                />
                                            </td>
                                        </tr>
                                        <tr className="border-top border-dark fw-bold">
                                            <td>New Total</td>
                                            <td className="text-end text-brand">{money(total)}</td>
                                        </tr>
                                        <tr className="text-secondary">
                                            <td>Previously Paid</td>
                                            <td className="text-end">{money(previouslyPaid)}</td>
                                        </tr>
                                        <tr className={`fw-bold ${newDue < 0 ? 'text-warning' : (newDue > 0 ? 'text-danger' : 'text-success')}`}>
                                            <td>{newDue < 0 ? 'Refund Owed' : 'New Due'}</td>
                                            <td className="text-end">{money(Math.abs(newDue))}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="form-label fw-bold">Correction Reason <span className="text-danger">*</span></label>
                            <textarea 
                                className="form-control" 
                                rows={2} 
                                value={reason} 
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Why is this invoice being corrected? (e.g., Wrong quantity entered, wrong product selected)"
                                required
                            />
                            <div className="form-text text-warning">
                                <i className="bi bi-exclamation-triangle"></i> This action will securely reverse stock from the original invoice and deduct stock for the new items.
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            className="btn btn-warning w-100 fw-bold" 
                            disabled={submitting || cart.length === 0 || !reason.trim()}
                        >
                            {submitting ? <Spinner /> : "💾 Submit Correction"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
