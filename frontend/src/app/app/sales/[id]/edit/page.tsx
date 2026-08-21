"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ErrorState, Spinner, money } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import toast from "react-hot-toast";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

type ProductUnit = {
  id: number;
  barcode: string;
  effective_selling_price?: string;
  effective_cost_price?: string;
  effective_warranty_months?: number;
  status?: string;
};

type Product = {
  id: number;
  name: string;
  sku?: string;
  barcode?: string;
  selling_price: string;
  cost_price?: string;
  current_stock: string;
  warranty_months?: number;
  units?: ProductUnit[];
};

type SaleItem = {
  id: number;
  product: number;
  product_id?: number;
  product_name: string;
  product_sku?: string;
  product_barcode?: string;
  product_warranty_months?: number;
  unit_barcodes?: string[];
  unit_warranties?: number[];
  quantity: string;
  unit_price: string;
  discount: string;
  subtotal: string;
};

type Sale = {
  id: number;
  invoice_no: string;
  customer?: number | null;
  sale_date: string;
  discount: string;
  tax: string;
  delivery_charge: string;
  paid: string;
  customer_name?: string;
  bill_name: string;
  bill_phone: string;
  bill_address: string;
  items: SaleItem[];
  status: string;
  returns?: any[];
};

type CartItem = {
  product_id: number;
  name: string;
  product_sku?: string;
  quantity: number;
  unit_price: number;
  discount: number;
  cost_price?: number;
  warranty_months?: number;
  has_units?: boolean;
  selectedUnits: ProductUnit[];
  availableUnits?: ProductUnit[];
};

type CustomerHit = { id: number; name: string; phone: string; address?: string };

export default function EditInvoicePage() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isOwner, can } = useAuth();
  const canEdit = isOwner || can("edit_sales") || can("manage_sales");

  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [saleDiscount, setSaleDiscount] = useState(0);
  const [saleTax, setSaleTax] = useState(0);
  const [saleDelivery, setSaleDelivery] = useState(0);
  
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [unitLoadingId, setUnitLoadingId] = useState<number | null>(null);

  // Unit Selection Modal state
  const [unitSelectProduct, setUnitSelectProduct] = useState<Product | null>(null);

  // Customer search
  const [custSearch, setCustSearch] = useState("");
  const [custHits, setCustHits] = useState<CustomerHit[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    if (!canEdit) {
      setError(t("edit_err_owner_only"));
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const data = await api<Sale>(`/sales/sales/${id}/`);
        
        if (data.returns && data.returns.length > 0) {
          setError(t("edit_err_has_returns"));
          setLoading(false);
          return;
        }
        
        setSale(data);
        setCustomerId(data.customer || null);
        setSaleDiscount(Number(data.discount) || 0);
        setSaleTax(Number(data.tax) || 0);
        setSaleDelivery(Number(data.delivery_charge) || 0);
        setCustomerName(data.customer_name || (data.bill_name && data.bill_name !== "Walk-in customer" ? data.bill_name : ""));
        setCustomerPhone(data.bill_phone || "");
        setCustomerAddress(data.bill_address || "");
        
        // Populate cart items
        const initialCart: CartItem[] = [];
        for (const item of data.items) {
          const prodId = item.product_id || (typeof item.product === 'object' ? (item.product as any).id : item.product);
          let fullProd: Product | null = null;
          try {
            fullProd = await api<Product>(`/catalog/products/${prodId}/`);
          } catch {
            fullProd = null;
          }

          const hasUnits = !!(fullProd?.units && fullProd.units.length > 0);
          const availableUnits = fullProd?.units || [];
          
          // Match previously sold units from item.unit_barcodes
          const selectedUnits: ProductUnit[] = [];
          if (item.unit_barcodes && item.unit_barcodes.length > 0) {
            for (const bc of item.unit_barcodes) {
              const matched = availableUnits.find(u => u.barcode === bc);
              if (matched) {
                selectedUnits.push(matched);
              } else {
                selectedUnits.push({
                  id: 0,
                  barcode: bc,
                  effective_warranty_months: item.product_warranty_months,
                  effective_selling_price: item.unit_price
                });
              }
            }
          }

          initialCart.push({
            product_id: prodId,
            name: item.product_name,
            product_sku: item.product_sku,
            quantity: Number(item.quantity) || 1,
            unit_price: Number(item.unit_price) || 0,
            discount: Number(item.discount) || 0,
            cost_price: Number(fullProd?.cost_price) || 0,
            warranty_months: item.product_warranty_months || fullProd?.warranty_months || 0,
            has_units: hasUnits || selectedUnits.length > 0,
            selectedUnits: selectedUnits,
            availableUnits: availableUnits,
          });
        }
        setCart(initialCart);
        
      } catch (e: any) {
        setError(e?.message || t("edit_err_load"));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, user, canEdit]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const res = await api<any>("/catalog/products/", {
          params: { search: searchQuery.trim(), page_size: 8, light: 1 },
        });
        const list = Array.isArray(res) ? res : res?.results || [];
        setSearchResults(list);
      } catch (e) {
        console.error(e);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!custSearch.trim()) {
      setCustHits([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api<any>("/crm/customers/", {
          params: { search: custSearch.trim(), page_size: 5 },
        });
        const list = Array.isArray(res) ? res : res?.results || [];
        setCustHits(list);
      } catch {
        setCustHits([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [custSearch]);

  // Click on product from search dropdown
  const handleProductSelect = async (p: Product) => {
    setUnitLoadingId(p.id);
    try {
      // Fetch full product with units
      const full = await api<Product>(`/catalog/products/${p.id}/`);
      const units = full.units || [];

      if (units.length > 0) {
        // Product has individual units -> Open Unit Selection Modal!
        setUnitSelectProduct(full);
        setSearchQuery("");
        setSearchResults([]);
      } else {
        // Generic product -> add directly
        addProductToCart(full);
        setSearchQuery("");
        setSearchResults([]);
      }
    } catch (e) {
      console.error(e);
      addProductToCart(p);
      setSearchQuery("");
      setSearchResults([]);
    } finally {
      setUnitLoadingId(null);
    }
  };

  const addProductToCart = (p: Product, specificUnit?: ProductUnit) => {
    setCart(prev => {
      const existingIndex = prev.findIndex(x => x.product_id === p.id);
      if (existingIndex >= 0) {
        const ex = prev[existingIndex];
        if (specificUnit) {
          if (ex.selectedUnits.some(u => u.id === specificUnit.id)) {
            toast.error(t("pos_already_in_cart_alert", { barcode: specificUnit.barcode }));
            return prev;
          }
          const updatedUnits = [...ex.selectedUnits, specificUnit];
          const newCart = [...prev];
          newCart[existingIndex] = {
            ...ex,
            quantity: updatedUnits.length,
            selectedUnits: updatedUnits,
            availableUnits: p.units || ex.availableUnits || [],
          };
          return newCart;
        } else {
          const newCart = [...prev];
          newCart[existingIndex] = {
            ...ex,
            quantity: ex.quantity + 1,
          };
          return newCart;
        }
      }

      // New line
      return [...prev, {
        product_id: p.id,
        name: p.name,
        product_sku: p.sku,
        quantity: specificUnit ? 1 : 1,
        unit_price: Number(specificUnit?.effective_selling_price || p.selling_price) || 0,
        discount: 0,
        cost_price: Number(specificUnit?.effective_cost_price || p.cost_price) || 0,
        warranty_months: specificUnit?.effective_warranty_months || p.warranty_months || 0,
        has_units: !!(p.units && p.units.length > 0) || !!specificUnit,
        selectedUnits: specificUnit ? [specificUnit] : [],
        availableUnits: p.units || [],
      }];
    });
  };

  const handleToggleUnit = (prod: Product, unit: ProductUnit, isChecked: boolean) => {
    setCart(prev => {
      const idx = prev.findIndex(x => x.product_id === prod.id);
      if (isChecked) {
        if (idx >= 0) {
          const ex = prev[idx];
          if (ex.selectedUnits.some(u => u.id === unit.id)) return prev;
          const updatedUnits = [...ex.selectedUnits, unit];
          const newCart = [...prev];
          newCart[idx] = {
            ...ex,
            quantity: updatedUnits.length,
            selectedUnits: updatedUnits,
            availableUnits: prod.units || ex.availableUnits || [],
          };
          return newCart;
        } else {
          return [...prev, {
            product_id: prod.id,
            name: prod.name,
            product_sku: prod.sku,
            quantity: 1,
            unit_price: Number(unit.effective_selling_price || prod.selling_price) || 0,
            discount: 0,
            cost_price: Number(unit.effective_cost_price || prod.cost_price) || 0,
            warranty_months: unit.effective_warranty_months || prod.warranty_months || 0,
            has_units: true,
            selectedUnits: [unit],
            availableUnits: prod.units || [],
          }];
        }
      } else {
        // Unchecked
        if (idx >= 0) {
          const ex = prev[idx];
          const updatedUnits = ex.selectedUnits.filter(u => u.id !== unit.id);
          if (updatedUnits.length === 0) {
            return prev.filter(x => x.product_id !== prod.id);
          }
          const newCart = [...prev];
          newCart[idx] = {
            ...ex,
            quantity: updatedUnits.length,
            selectedUnits: updatedUnits,
          };
          return newCart;
        }
        return prev;
      }
    });
  };

  const handleOpenUnitModalForCartItem = async (item: CartItem) => {
    setUnitLoadingId(item.product_id);
    try {
      const full = await api<Product>(`/catalog/products/${item.product_id}/`);
      setUnitSelectProduct(full);
    } catch {
      if (item.availableUnits && item.availableUnits.length > 0) {
        setUnitSelectProduct({
          id: item.product_id,
          name: item.name,
          sku: item.product_sku,
          selling_price: String(item.unit_price),
          cost_price: String(item.cost_price || 0),
          current_stock: String(item.quantity),
          warranty_months: item.warranty_months,
          units: item.availableUnits,
        });
      }
    } finally {
      setUnitLoadingId(null);
    }
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
  const total = Math.max(0, subtotal - saleDiscount + saleTax + saleDelivery);
  const previouslyPaid = sale ? Number(sale.paid) || 0 : 0;
  const newDue = total - previouslyPaid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      toast.error(t("edit_err_cart_empty"));
      return;
    }
    if (!reason.trim()) {
      toast.error(t("edit_err_reason_req"));
      return;
    }

    setSubmitting(true);
    try {
      await api(`/sales/sales/${id}/correct/`, {
        method: "POST",
        body: {
          items: cart.map(c => ({
            product_id: c.product_id,
            quantity: c.quantity,
            unit_price: c.unit_price,
            discount: c.discount,
            unit_ids: c.selectedUnits ? c.selectedUnits.filter(u => u.id > 0).map(u => u.id) : [],
          })),
          discount: saleDiscount,
          tax: saleTax,
          delivery_charge: saleDelivery,
          customer_id: customerId,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          customer_address: customerAddress.trim(),
          correction_reason: reason.trim()
        }
      });
      toast.success(t("edit_success"));
      router.push(`/app/sales/${id}`);
    } catch (err: any) {
      toast.error(err?.data?.detail || err?.message || t("edit_failed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner label={t("edit_loading")} />;
  if (error) return (
    <div className="container py-5">
      <ErrorState error={error} />
      <div className="mt-3 text-center">
        <Link href={`/app/sales/${id}`} className="btn btn-secondary">{t("edit_btn_back")}</Link>
      </div>
    </div>
  );
  if (!sale) return null;

  const currentModalLine = unitSelectProduct ? cart.find(l => l.product_id === unitSelectProduct.id) : null;
  const selectedUnitsInModal = currentModalLine?.selectedUnits || [];

  return (
    <div className="container py-4" style={{ maxWidth: "900px" }}>
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <Link href={`/app/sales/${id}`} className="btn btn-outline-secondary btn-sm">&larr; {t("edit_btn_back")}</Link>
            <h1 className="h4 fw-bold text-brand mb-0">{t("edit_title")} {sale.invoice_no}</h1>
          </div>
          <span className="badge bg-primary fs-6 font-monospace">#{sale.invoice_no}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Customer Details Card */}
        <div className="card shadow-sm border-0 mb-4">
          <div className="card-header bg-white fw-bold py-3">
            <i className="bi bi-person me-2 text-brand"></i>{t("edit_cust_info")}
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4 position-relative">
                <label className="form-label small text-muted">{t("edit_cust_name")}</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={customerName}
                  onChange={e => {
                    setCustomerName(e.target.value);
                    setCustSearch(e.target.value);
                  }}
                  placeholder={t("edit_cust_ph_name")}
                />
                {custHits.length > 0 && (
                  <div className="position-absolute w-100 bg-white border rounded shadow-lg mt-1 p-0 z-3" style={{ maxHeight: "180px", overflowY: "auto" }}>
                    {custHits.map((c) => (
                      <div
                        key={c.id}
                        className="p-2 border-bottom cursor-pointer hover-bg-light small d-flex justify-content-between"
                        onClick={() => {
                          setCustomerId(c.id);
                          setCustomerName(c.name);
                          setCustomerPhone(c.phone || "");
                          setCustomerAddress(c.address || "");
                          setCustHits([]);
                          setCustSearch("");
                        }}
                      >
                        <strong>{c.name}</strong>
                        <span className="text-secondary">{c.phone}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="col-md-4">
                <label className="form-label small text-muted">{t("edit_cust_phone")}</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  placeholder="017xxxxxxxx"
                />
              </div>
              <div className="col-md-4">
                <label className="form-label small text-muted">{t("edit_cust_address")}</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={customerAddress}
                  onChange={e => setCustomerAddress(e.target.value)}
                  placeholder="ঠিকানা..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Products & Items Card */}
        <div className="card shadow-sm border-0 mb-4">
          <div className="card-header bg-white fw-bold py-3 d-flex justify-content-between align-items-center">
            <span><i className="bi bi-cart3 me-2 text-brand"></i>ইনভয়েস আইটেম তালিকা (Items List)</span>
            <span className="badge bg-secondary">{cart.length} টি আইটেম</span>
          </div>
          <div className="card-body">
            <div className="d-flex gap-2 mb-3">
              <div className="position-relative flex-grow-1">
                <input
                  ref={searchInputRef}
                  type="text"
                  className="form-control form-control-sm"
                  placeholder={t("edit_search_ph")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searching && <div className="position-absolute end-0 top-50 translate-middle-y me-3"><Spinner /></div>}
                {searchResults.length > 0 && (
                  <ul className="list-group position-absolute w-100 mt-1 shadow-lg" style={{ zIndex: 1000, maxHeight: "240px", overflowY: "auto" }}>
                    {searchResults.map(p => (
                      <button 
                        key={p.id} 
                        type="button"
                        className="list-group-item list-group-item-action d-flex justify-content-between align-items-center p-2"
                        onClick={() => handleProductSelect(p)}
                        disabled={unitLoadingId === p.id}
                      >
                        <div>
                          <div className="fw-semibold small">
                            {p.name}
                            {unitLoadingId === p.id && <span className="spinner-border spinner-border-sm ms-2 text-primary"></span>}
                          </div>
                          <div className="text-muted" style={{ fontSize: "0.75rem" }}>স্টক: {p.current_stock}</div>
                        </div>
                        <span className="text-primary fw-bold small">{money(p.selling_price)}</span>
                      </button>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="table-responsive mb-3">
              <table className="table table-sm align-middle">
                <thead className="table-light">
                  <tr>
                    <th>{t("edit_col_product")}</th>
                    <th style={{ width: "110px" }}>{t("edit_col_qty")}</th>
                    <th style={{ width: "130px" }}>{t("edit_col_unit_price")}</th>
                    <th style={{ width: "110px" }}>{t("edit_col_discount")}</th>
                    <th className="text-end" style={{ width: "130px" }}>{t("edit_col_line_total")}</th>
                    <th style={{ width: "40px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, idx) => {
                    const lineTotal = (item.quantity * item.unit_price) - item.discount;
                    const hasSelectedUnits = item.selectedUnits && item.selectedUnits.length > 0;
                    return (
                      <tr key={idx}>
                        <td className="fw-medium">
                          <div>{item.name}</div>
                          {item.has_units && (
                            <div className="mt-1">
                              {hasSelectedUnits ? (
                                <div className="d-flex flex-wrap gap-1 align-items-center mb-1">
                                  {item.selectedUnits.map((u, uIdx) => (
                                    <span key={uIdx} className="badge bg-light text-dark border font-monospace" style={{ fontSize: "0.7rem" }}>
                                      <i className="bi bi-upc-scan me-1 text-primary"></i>{u.barcode}
                                      {!!u.effective_warranty_months && (
                                        <span className="ms-1 text-warning-emphasis fw-bold">({u.effective_warranty_months}m)</span>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-warning small" style={{ fontSize: "0.75rem" }}>
                                  <i className="bi bi-exclamation-triangle me-1"></i>কোনো ইউনিট সিলেক্ট করা হয়নি (FIFO দ্বারা এসাইন হবে)
                                </div>
                              )}
                              <button
                                type="button"
                                className="btn btn-outline-primary btn-sm py-0 px-2 mt-1"
                                style={{ fontSize: "0.72rem" }}
                                onClick={() => handleOpenUnitModalForCartItem(item)}
                                disabled={unitLoadingId === item.product_id}
                              >
                                <i className="bi bi-qr-code me-1"></i>
                                {hasSelectedUnits ? "ইউনিট পরিবর্তন (Edit Units)" : "ইউনিট নির্বাচন (Select Units)"}
                              </button>
                            </div>
                          )}
                        </td>
                        <td>
                          <input 
                            type="number" 
                            className="form-control form-control-sm" 
                            value={item.quantity || ""} 
                            min="0.01" 
                            step="any"
                            disabled={item.has_units && item.selectedUnits.length > 0}
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
                        <td className="text-end fw-bold">{money(lineTotal)}</td>
                        <td className="text-end">
                          <button type="button" className="btn btn-link text-danger p-0" onClick={() => handleRemoveCart(idx)}>
                            <i className="bi bi-trash"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {cart.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-3">{t("edit_err_cart_empty")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Calculations & Discounts */}
            <div className="row g-3 justify-content-end">
              <div className="col-md-6">
                <div className="p-3 bg-light rounded-3 border">
                  <div className="d-flex justify-content-between mb-2 small">
                    <span className="text-muted">{t("edit_lbl_subtotal")}:</span>
                    <span className="fw-bold">{money(subtotal)}</span>
                  </div>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <label className="small text-muted mb-0">{t("edit_lbl_discount")}:</label>
                    <input 
                      type="number" className="form-control form-control-sm text-end" style={{ width: "120px" }} 
                      value={saleDiscount || ""} min="0" step="any"
                      onChange={(e) => setSaleDiscount(Number(e.target.value))}
                    />
                  </div>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <label className="small text-muted mb-0">{t("edit_lbl_delivery")}:</label>
                    <input 
                      type="number" className="form-control form-control-sm text-end" style={{ width: "120px" }} 
                      value={saleDelivery || ""} min="0" step="any"
                      onChange={(e) => setSaleDelivery(Number(e.target.value))}
                    />
                  </div>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <label className="small text-muted mb-0">{t("edit_lbl_tax")}:</label>
                    <input 
                      type="number" className="form-control form-control-sm text-end" style={{ width: "120px" }} 
                      value={saleTax || ""} min="0" step="any"
                      onChange={(e) => setSaleTax(Number(e.target.value))}
                    />
                  </div>
                  <div className="d-flex justify-content-between mb-2 pt-2 border-top">
                    <span className="fw-bold">{t("edit_lbl_total")}:</span>
                    <span className="fw-bold text-brand fs-5">{money(total)}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-2 small text-muted">
                    <span>{t("edit_lbl_paid")}:</span>
                    <span>{money(previouslyPaid)}</span>
                  </div>
                  <div className="d-flex justify-content-between small fw-bold pt-2 border-top">
                    <span>{t("edit_lbl_due")}:</span>
                    <span className={newDue > 0 ? "text-danger" : "text-success"}>{money(newDue)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Correction Reason */}
            <div className="mt-4 pt-3 border-top">
              <label className="form-label small fw-bold text-danger">{t("edit_lbl_reason")} *</label>
              <textarea 
                className="form-control form-control-sm" 
                rows={2} 
                placeholder={t("edit_reason_ph")}
                value={reason} 
                onChange={e => setReason(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="d-flex justify-content-end gap-2">
          <Link href={`/app/sales/${id}`} className="btn btn-outline-secondary btn-sm">{t("edit_btn_cancel")}</Link>
          <button type="submit" className="btn btn-brand btn-sm px-4" disabled={submitting}>
            {submitting ? (
              <><span className="spinner-border spinner-border-sm me-2"></span>{t("edit_btn_submitting")}</>
            ) : (
              t("edit_btn_submit")
            )}
          </button>
        </div>
      </form>

      {/* ── Select units modal (Matches POS UX) ── */}
      {unitSelectProduct && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.55)", backdropFilter: "blur(2px)", zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-light">
                <h5 className="modal-title fw-bold text-dark fs-6">
                  <i className="bi bi-qr-code me-2 text-primary"></i>{t("pos_unit_title")}
                </h5>
                <button 
                  className="btn-close" 
                  onClick={() => {
                    setUnitSelectProduct(null);
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  }} 
                />
              </div>
              <div className="modal-body p-3">
                <div className="mb-3 small text-secondary">
                  <strong>{unitSelectProduct.name}</strong> {t("pos_unit_desc")}
                </div>
                <div className="d-flex flex-column gap-2">
                  {unitSelectProduct.units && unitSelectProduct.units.length > 0 ? (
                    unitSelectProduct.units.map((u) => {
                      const isSelected = selectedUnitsInModal.some(su => su.id === u.id || su.barcode === u.barcode);
                      return (
                        <label 
                          key={u.id} 
                          className={`d-flex justify-content-between align-items-center p-2 border rounded cursor-pointer transition-all ${isSelected ? 'border-primary bg-primary bg-opacity-10' : 'hover-bg-light'}`}
                          style={{ cursor: "pointer" }}
                        >
                          <div className="d-flex align-items-center">
                            <input 
                              type="checkbox" 
                              className="form-check-input mt-0 me-2" 
                              checked={!!isSelected}
                              onChange={(e) => handleToggleUnit(unitSelectProduct, u, e.target.checked)}
                            />
                            <div className="font-monospace small fw-bold text-dark">{u.barcode}</div>
                          </div>
                          <div className="text-end" style={{ fontSize: '.75rem' }}>
                            {!!u.effective_warranty_months && (
                              <span className="badge bg-warning-subtle text-warning-emphasis rounded-pill me-2 border border-warning-subtle">
                                <i className="bi bi-shield-check me-1"></i>
                                {t("pos_unit_warranty", { months: u.effective_warranty_months })}
                              </span>
                            )}
                            <span className="text-secondary">{t("pos_unit_cost", { amount: money(u.effective_cost_price || unitSelectProduct.cost_price || 0) })}</span>
                            <span className="ms-2 fw-bold text-primary">{t("pos_unit_price", { amount: money(u.effective_selling_price || unitSelectProduct.selling_price || 0) })}</span>
                          </div>
                        </label>
                      );
                    })
                  ) : (
                    <div className="text-center text-muted py-4 small">
                      কোনো ইন-স্টক ইউনিট পাওয়া যায়নি।
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer bg-light d-flex justify-content-between">
                <div className="small fw-bold text-primary">
                  {t("pos_unit_selected", { count: selectedUnitsInModal.length })}
                </div>
                <button 
                  className="btn btn-primary btn-sm px-4" 
                  onClick={() => {
                    setUnitSelectProduct(null);
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  }}
                >
                  {t("pos_unit_done")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
