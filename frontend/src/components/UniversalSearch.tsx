"use client";

import { useEffect, useRef, useState } from "react";
import { api, unwrap } from "@/lib/api";

type Row = { url: string; label: string; sub: string };
type Results = { sales: Row[]; products: Row[]; customers: Row[]; suppliers: Row[] };

const GROUPS: [keyof Results, string][] = [
  ["sales", "🧾 Invoices & Sales"],
  ["products", "📦 Products"],
  ["customers", "👥 Customers"],
  ["suppliers", "🚚 Suppliers"],
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
            sub: `${s.bill_name || "Walk-in"} · ${s.bill_phone || ""} · ৳${s.total}`,
          })),
          products: unwrap<any>(prod).slice(0, 4).map((p: any) => ({
            url: `/app/products/${p.id}`,
            label: p.name,
            sub: `SKU ${p.sku || "—"} · Barcode ${p.barcode || "—"} · Stock ${p.current_stock ?? 0}`,
          })),
          customers: unwrap<any>(cust).slice(0, 4).map((c: any) => ({
            url: `/app/customers`,
            label: c.name,
            sub: c.phone || c.email || "",
          })),
          suppliers: unwrap<any>(supp).slice(0, 4).map((s: any) => ({
            url: `/app/suppliers`,
            label: s.name,
            sub: s.phone || s.email || "",
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
          className="form-control border-0 shadow-none"
          style={{
            borderRadius: "30px",
            paddingLeft: "2.8rem",
            backgroundColor: "rgba(255, 255, 255, 0.15)",
            color: "#fff",
            height: "40px",
            backdropFilter: "blur(4px)",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={(e) => {
            e.target.style.backgroundColor = "#fff";
            e.target.style.color = "#333";
            e.target.style.boxShadow = "0 4px 15px rgba(0,0,0,0.1)";
            if (q.trim()) setOpen(true);
          }}
          onBlur={(e) => {
            if (!q) {
              e.target.style.backgroundColor = "rgba(255, 255, 255, 0.15)";
              e.target.style.color = "#fff";
              e.target.style.boxShadow = "none";
            } else {
              // keep it white if there is text
              e.target.style.backgroundColor = "#fff";
              e.target.style.color = "#333";
            }
          }}
        />
        <div
          className="position-absolute d-flex align-items-center justify-content-center"
          style={{ 
            left: "1rem", 
            top: "50%", 
            transform: "translateY(-50%)", 
            pointerEvents: "none",
            fontSize: "1.1rem"
          }}
        >
          🔍
        </div>
      </div>
      {open && (
        <div
          className="position-absolute bg-white mt-2"
          style={{
            zIndex: 1080,
            maxHeight: "75vh",
            overflow: "auto",
            boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
            borderRadius: "16px",
            border: "1px solid rgba(0,0,0,0.05)",
            ...(mobile ? { left: 0, right: 0 } : { width: "100%" }),
          }}
        >
          {loading ? (
            <div className="px-4 py-5 text-center small text-secondary">
              <span className="spinner-border spinner-border-sm me-2 align-middle"></span>
              <span className="align-middle">Searching everywhere...</span>
            </div>
          ) : !any ? (
            <div className="px-4 py-5 text-center small text-secondary">
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem", opacity: 0.5 }}>👀</div>
              No results found for "{q}"
            </div>
          ) : (
            <div className="py-3">
              {GROUPS.map(([key, label]) => {
                const rows = data[key];
                if (!rows.length) return null;
                return (
                  <div key={key} className="mb-3">
                    <div
                      className="px-4 py-1 small fw-bold text-uppercase"
                      style={{ color: "#95a5a6", letterSpacing: "0.08em", fontSize: "0.7rem", marginBottom: "4px" }}
                    >
                      {label}
                    </div>
                    {rows.map((r, i) => (
                      <a
                        key={i}
                        href={r.url}
                        className="d-flex flex-column px-4 py-2 text-decoration-none"
                        style={{
                          transition: "background-color 0.2s, padding-left 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#f8f9fa";
                          e.currentTarget.style.paddingLeft = "2rem";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                          e.currentTarget.style.paddingLeft = "1.5rem"; // 1.5rem is px-4 padding
                        }}
                      >
                        <span className="fw-semibold text-dark" style={{ fontSize: "0.95rem" }}>
                          {r.label}
                        </span>
                        <span className="text-secondary mt-1" style={{ fontSize: "0.8rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {r.sub}
                        </span>
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
