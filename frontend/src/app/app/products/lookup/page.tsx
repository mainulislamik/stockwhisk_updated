"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { api, unwrap } from "@/lib/api";
import { money } from "@/components/ui";

type Product = { id: number; name: string; sku: string; barcode: string; selling_price: string; cost_price: string; current_stock: string };

export default function ItemLookupPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Product[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);

  async function doSearch(query: string) {
    setBusy(true);
    try {
      setRows(unwrap<Product>(await api("/catalog/products/", { params: { search: query } })));
      setSearched(true);
    } catch (err: any) {
      alert(err?.message || "Lookup failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (q.trim()) {
        doSearch(q);
      } else {
        setRows([]);
        setSearched(false);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [q]);

  function search(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) doSearch(q);
  }

  return (
    <div className="vstack gap-3" style={{ maxWidth: "48rem" }}>
      <h1 className="h4 fw-bold text-brand mb-0">Item lookup</h1>
      <form onSubmit={search} className="input-group">
        <input className="form-control" placeholder="Scan or type barcode / SKU / name…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <button className="btn btn-brand" disabled={busy}>
          {busy ? "…" : "Look up"}
        </button>
      </form>

      {searched && (
        <div className="card shadow-sm">
          <div className="table-responsive">
            <table className="table table-striped table-sm align-middle mb-0">
              <thead className="thead-1">
                <tr>
                  <th>Name</th>
                  <th>SKU</th>
                  <th className="text-end">Price</th>
                  <th className="text-end">Stock</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr data-empty="">
                    <td colSpan={4} className="text-center text-secondary py-4">No item found.</td>
                  </tr>
                ) : (
                  rows.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/app/products/${p.id}`} className="text-decoration-none fw-medium">
                          {p.name}
                        </Link>
                      </td>
                      <td className="text-secondary">{p.sku || "—"}</td>
                      <td className="text-end">{money(p.selling_price)}</td>
                      <td className="text-end">{p.current_stock}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
