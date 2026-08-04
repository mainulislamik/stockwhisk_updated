"use client";

import { ReactNode, useEffect, useState } from "react";

const PAGE_SIZE = 20;

export function usePagination<T>(items: T[], deps: any[] = []) {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, deps); // reset on filter/data change
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  return { paged, page: safePage, setPage, totalPages, total: items.length };
}

export function Pagination({
  page, totalPages, setPage, total,
}: { page: number; totalPages: number; setPage: (p: number) => void; total: number }) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  // Compute visible page numbers (max 5)
  const pages: number[] = [];
  let start = Math.max(1, page - 2);
  let end = Math.min(totalPages, start + 4);
  start = Math.max(1, end - 4);
  for (let i = start; i <= end; i++) pages.push(i);
  return (
    <div className="d-flex align-items-center justify-content-between px-3 py-2 border-top small text-secondary">
      <span>{from}–{to} of {total} items</span>
      <div className="d-flex gap-1">
        <button className="btn btn-sm btn-outline-secondary py-0 px-2" disabled={page === 1} onClick={() => setPage(1)}>«</button>
        <button className="btn btn-sm btn-outline-secondary py-0 px-2" disabled={page === 1} onClick={() => setPage(page - 1)}>‹</button>
        {pages.map((p) => (
          <button key={p} className={`btn btn-sm py-0 px-2 ${p === page ? "btn-brand" : "btn-outline-secondary"}`} onClick={() => setPage(p)}>{p}</button>
        ))}
        <button className="btn btn-sm btn-outline-secondary py-0 px-2" disabled={page === totalPages} onClick={() => setPage(page + 1)}>›</button>
        <button className="btn btn-sm btn-outline-secondary py-0 px-2" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div>
        <h1 className="h4 fw-bold text-brand mb-0">{title}</h1>
        {subtitle && <div className="text-secondary small">{subtitle}</div>}
      </div>
      {actions && <div className="d-flex align-items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "", body = true }: { children: ReactNode; className?: string; body?: boolean }) {
  return <div className={`card shadow-sm ${className}`}>{body ? <div className="card-body">{children}</div> : children}</div>;
}

export function StatCard({ label, value, icon, tone = "brand" }: { label: string; value: ReactNode; icon?: string; tone?: string }) {
  return (
    <div className="card shadow-sm h-100">
      <div className="card-body d-flex align-items-center gap-3">
        {icon && (
          <div className={`d-flex align-items-center justify-content-center rounded-3 bg-${tone} bg-opacity-10 text-${tone}`} style={{ width: 46, height: 46 }}>
            <i className={`bi ${icon} fs-4`}></i>
          </div>
        )}
        <div className="min-vw-0">
          <div className="text-secondary small text-truncate">{label}</div>
          <div className="fs-4 fw-bold">{value}</div>
        </div>
      </div>
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="text-center text-secondary py-5">
      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
      {label}
    </div>
  );
}

export function ErrorState({ error }: { error: string }) {
  return (
    <div className="alert alert-danger d-flex align-items-center gap-2">
      <i className="bi bi-exclamation-triangle"></i>
      <span>{error}</span>
    </div>
  );
}

export function EmptyRow({ cols, icon = "bi-inbox", text = "Nothing here yet." }: { cols: number; icon?: string; text?: string }) {
  return (
    <tr data-empty="">
      <td colSpan={cols} className="text-center text-secondary py-5">
        <div className="fs-1">
          <i className={`bi ${icon}`}></i>
        </div>
        {text}
      </td>
    </tr>
  );
}

export function money(v: any): string {
  const n = Number(v ?? 0);
  return "৳" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(v: any): string {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
