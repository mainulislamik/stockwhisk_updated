"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, fetchAll } from "@/lib/api";
import { EmptyRow, ErrorState, PageHeader, Spinner, fmtDate, money } from "@/components/ui";
import toast from "react-hot-toast";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

type Payment = {
  id: number;
  shop_name: string;
  amount: string | number;
  method: string;
  payer_reference: string;
  proof: string | null;
  status: string;
  submitted_at: string;
};

const STATUS_BADGE: Record<string, string> = {
  pending_review: "text-bg-warning",
  approved: "text-bg-success",
  rejected: "text-bg-danger",
};

export default function PaymentsPage() {
  const [rows, setRows] = useState<Payment[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await fetchAll<Payment>("/platform/manual-payments/"));
    } catch (e: any) {
      setError(e?.message || "Failed to load payments.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const s = q.trim().toLowerCase();
    return s ? rows.filter((r) => `${r.shop_name} ${r.method} ${r.payer_reference}`.toLowerCase().includes(s)) : rows;
  }, [rows, q]);

  async function review(p: Payment, decision: "approve" | "reject") {
    let reason = "";
    if (decision === "reject") {
      reason = window.prompt("Reason for rejection:", "Not verified") || "";
      if (reason === "") return;
    }
    setBusy(p.id);
    try {
      await api(`/platform/manual-payments/${p.id}/${decision}/`, { method: "POST", body: decision === "reject" ? { reason } : undefined });
      await load();
    } catch (e: any) {
      toast.error(e?.data?.detail || e?.message || "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  if (error) return <ErrorState error={error} />;
  if (!rows) return <Spinner />;

  return (
    <>
      <PageHeader title="Manual Payment Review" />
      <input className="form-control mb-3" placeholder="Filter payments…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="thead-2">
              <tr><th>Shop</th><th>Amount</th><th>Method</th><th>Reference</th><th>Proof</th><th>Status</th><th>Submitted</th><th className="text-end">Action</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <EmptyRow cols={8} text="No payments." />}
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td className="fw-semibold">{p.shop_name}</td>
                  <td>{money(p.amount)}</td>
                  <td className="text-capitalize">{p.method}</td>
                  <td className="text-secondary">{p.payer_reference || "—"}</td>
                  <td>{p.proof ? <a href={`${API_BASE}${p.proof}`} target="_blank" rel="noreferrer">view</a> : "—"}</td>
                  <td><span className={`badge ${STATUS_BADGE[p.status] || "text-bg-secondary"}`}>{p.status.replace("_", " ")}</span></td>
                  <td className="text-nowrap">{fmtDate(p.submitted_at)}</td>
                  <td className="text-end">
                    {p.status === "pending_review" ? (
                      <div className="d-flex gap-1 justify-content-end">
                        <button className="btn btn-outline-success btn-sm py-0" disabled={busy === p.id} onClick={() => review(p, "approve")}>Approve</button>
                        <button className="btn btn-outline-danger btn-sm py-0" disabled={busy === p.id} onClick={() => review(p, "reject")}>Reject</button>
                      </div>
                    ) : <span className="text-secondary small">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
