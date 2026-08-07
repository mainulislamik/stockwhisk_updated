"use client";

import { useEffect, useRef, useState } from "react";
import { api, unwrap } from "@/lib/api";

type Row = { url: string; label: string; sub: string; meta?: string; icon?: React.ReactNode };
type Results = { sales: Row[]; products: Row[]; customers: Row[]; suppliers: Row[] };

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-secondary opacity-75">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const ReceiptIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/></svg>
);

const PackageIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-success"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
);

const UsersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-info"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);

const TruckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"/><path d="M14 17h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
);

const GROUPS: [keyof Results, string][] = [
  ["sales", "Invoices & Sales"],
  ["products", "Products"],
  ["customers", "Customers"],
  ["suppliers", "Suppliers"],
];

export default function UniversalSearch({ mobile = false }: { mobile?: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Results>({ sales: [], products: [], customers: [], suppliers: [] });
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q.trim()) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const [sale, prod, cust, supp] = await Promise.all([
          api("/sales/sales/", { params: { search: q } }).catch(() => []),
          api("/catalog/products/", { params: { search: q } }).catch(() => []),
          api("/crm/customers/", { params: { search: q } }).catch(() => []),
          api("/purchasing/suppliers/", { params: { search: q } }).catch(() => []),
        ]);
        setData({
          sales: unwrap<any>(sale).slice(0, 4).map((s: any) => ({
            url: `/app/sales/${s.id}`,
            label: `Invoice #${s.invoice_no || s.id}`,
            sub: `${s.bill_name || "Walk-in"} • ${s.bill_phone || "No phone"}`,
            meta: `৳${s.total}`,
            icon: <ReceiptIcon />
          })),
          products: unwrap<any>(prod).slice(0, 4).map((p: any) => ({
            url: `/app/products/${p.id}`,
            label: p.name,
            sub: `SKU: ${p.sku || "—"} • Barcode: ${p.barcode || "—"}`,
            meta: `Stock: ${p.current_stock ?? 0}`,
            icon: <PackageIcon />
          })),
          customers: unwrap<any>(cust).slice(0, 4).map((c: any) => ({
            url: `/app/customers`,
            label: c.name,
            sub: c.phone || c.email || "No contact info",
            icon: <UsersIcon />
          })),
          suppliers: unwrap<any>(supp).slice(0, 4).map((s: any) => ({
            url: `/app/suppliers`,
            label: s.name,
            sub: s.phone || s.email || "No contact info",
            icon: <TruckIcon />
          })),
        });
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const any = GROUPS.some(([k]) => data[k].length > 0);

  return (
    <div
      ref={boxRef}
      className={`position-relative ${mobile ? "" : "flex-grow-1 d-none d-sm-block px-3"}`}
      style={mobile ? undefined : { maxWidth: "42rem" }}
    >
      <div className="position-relative">
        <input
          aria-label="Universal search"
          autoComplete="off"
          placeholder="Search invoices, products, barcode, customers, suppliers..."
          className="form-control"
          style={{
            borderRadius: "30px",
            paddingLeft: "2.8rem",
            height: "44px",
            transition: "all 0.2s ease",
            backgroundColor: "var(--bs-tertiary-bg)", 
            color: "var(--bs-body-color)",
            border: "1px solid var(--bs-border-color)",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.05)",
          }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={(e) => {
            e.target.style.boxShadow = "0 0 0 4px rgba(var(--bs-primary-rgb), 0.15)";
            e.target.style.borderColor = "var(--bs-primary)";
            e.target.style.backgroundColor = "var(--bs-body-bg)";
            if (q.trim()) setOpen(true);
          }}
          onBlur={(e) => {
            e.target.style.boxShadow = "inset 0 1px 3px rgba(0,0,0,0.05)";
            e.target.style.borderColor = "var(--bs-border-color)";
            e.target.style.backgroundColor = "var(--bs-tertiary-bg)";
          }}
        />
        <div
          className="position-absolute d-flex align-items-center justify-content-center"
          style={{ 
            left: "1rem", 
            top: "50%", 
            transform: "translateY(-50%)", 
            pointerEvents: "none",
          }}
        >
          <SearchIcon />
        </div>
      </div>
      {open && (
        <div
          className="position-absolute mt-2"
          style={{
            zIndex: 1080,
            maxHeight: "80vh",
            overflow: "auto",
            boxShadow: "0 20px 40px -10px rgba(0,0,0,0.25)",
            borderRadius: "16px",
            border: "1px solid var(--bs-border-color)",
            backgroundColor: "var(--bs-body-bg)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            ...(mobile ? { left: 0, right: 0 } : { width: "100%" }),
          }}
        >
          {loading ? (
            <div className="px-4 py-5 text-center text-secondary d-flex flex-column align-items-center justify-content-center">
              <div className="spinner-border spinner-border-sm text-primary mb-2" role="status"></div>
              <span className="small fw-medium">Searching across all records...</span>
            </div>
          ) : !any ? (
            <div className="px-4 py-5 text-center text-secondary d-flex flex-column align-items-center justify-content-center">
              <div style={{ opacity: 0.2, marginBottom: "1rem" }}>
                <SearchIcon />
              </div>
              <span className="fw-medium">No results found for "{q}"</span>
              <small className="text-body-tertiary mt-1">Try checking for typos or using different keywords</small>
            </div>
          ) : (
            <div className="py-2">
              {GROUPS.map(([key, label]) => {
                const rows = data[key];
                if (!rows.length) return null;
                return (
                  <div key={key} className="mb-2">
                    <div
                      className="px-3 py-2 small fw-bold text-uppercase text-secondary d-flex align-items-center"
                      style={{ letterSpacing: "0.05em", fontSize: "0.7rem" }}
                    >
                      {label}
                    </div>
                    {rows.map((r, i) => (
                      <a
                         key={i}
                         href={r.url}
                         className="d-flex align-items-center px-3 py-2 text-decoration-none border-bottom"
                         style={{
                           transition: "all 0.2s",
                           borderColor: "var(--bs-border-color-translucent)",
                         }}
                         onMouseEnter={(e) => {
                           e.currentTarget.style.backgroundColor = "var(--bs-tertiary-bg)";
                           e.currentTarget.style.paddingLeft = "1.5rem";
                         }}
                         onMouseLeave={(e) => {
                           e.currentTarget.style.backgroundColor = "transparent";
                           e.currentTarget.style.paddingLeft = "1rem"; // matches px-3
                         }}
                      >
                         <div className="me-3 d-flex align-items-center justify-content-center rounded bg-body-tertiary" style={{ width: "36px", height: "36px" }}>
                           {r.icon}
                         </div>
                         <div className="flex-grow-1 min-w-0">
                           <div className="fw-semibold text-body text-truncate" style={{ fontSize: "0.95rem" }}>
                             {r.label}
                           </div>
                           <div className="text-secondary text-truncate mt-1" style={{ fontSize: "0.8rem" }}>
                             {r.sub}
                           </div>
                         </div>
                         {r.meta && (
                           <div className="ms-3 text-end">
                             <span className="badge bg-secondary-subtle text-secondary-emphasis fw-medium rounded-pill px-2 py-1">
                               {r.meta}
                             </span>
                           </div>
                         )}
                      </a>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
