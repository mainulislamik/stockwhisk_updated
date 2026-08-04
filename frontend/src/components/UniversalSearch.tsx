"use client";

import { useEffect, useRef, useState } from "react";
import { api, unwrap } from "@/lib/api";

type Row = { url: string; label: string; sub: string };
type Results = { products: Row[]; customers: Row[]; suppliers: Row[] };

const GROUPS: [keyof Results, string][] = [
  ["products", "📦 Products"],
  ["customers", "👥 Customers"],
  ["suppliers", "🚚 Suppliers"],
];

export default function UniversalSearch({ mobile = false }: { mobile?: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Results>({ products: [], customers: [], suppliers: [] });
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
        const [prod, cust, supp] = await Promise.all([
          api("/catalog/products/", { params: { search: q } }).catch(() => []),
          api("/crm/customers/", { params: { search: q } }).catch(() => []),
          api("/purchasing/suppliers/", { params: { search: q } }).catch(() => []),
        ]);
        setData({
          products: unwrap<any>(prod).slice(0, 6).map((p) => ({
            url: `/app/products/${p.id}`,
            label: p.name,
            sub: `SKU ${p.sku || "—"} · Stock ${p.current_stock ?? 0}`,
          })),
          customers: unwrap<any>(cust).slice(0, 6).map((c) => ({
            url: `/app/customers`,
            label: c.name,
            sub: c.phone || c.email || "",
          })),
          suppliers: unwrap<any>(supp).slice(0, 6).map((s) => ({
            url: `/app/suppliers`,
            label: s.name,
            sub: s.phone || s.email || "",
          })),
        });
      } finally {
        setLoading(false);
      }
    }, 200);
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
      style={mobile ? undefined : { maxWidth: "34rem" }}
    >
      <input
        aria-label="Search products, customers, suppliers"
        autoComplete="off"
        placeholder="🔎 Search invoice · product · customer · supplier…"
        className="form-control form-control-sm"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => q.trim() && setOpen(true)}
      />
      {open && (
        <div
          className="position-absolute bg-white border rounded shadow-sm mt-1"
          style={{ zIndex: 1080, maxHeight: "70vh", overflow: "auto", ...(mobile ? { left: 0, right: 0 } : { width: "100%" }) }}
        >
          {loading ? (
            <div className="px-3 py-2 small text-secondary">
              <span className="spinner-border spinner-border-sm me-1"></span>Searching…
            </div>
          ) : !any ? (
            <div className="px-3 py-2 small text-secondary">No matches.</div>
          ) : (
            GROUPS.map(([key, label]) => {
              const rows = data[key];
              if (!rows.length) return null;
              return (
                <div key={key}>
                  <div className="px-3 py-1 small fw-semibold text-secondary bg-light">{label}</div>
                  {rows.map((r, i) => (
                    <a key={i} href={r.url} className="d-block px-3 py-2 text-decoration-none border-top small">
                      <div className="fw-medium text-dark">{r.label}</div>
                      <div className="text-secondary">{r.sub}</div>
                    </a>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
