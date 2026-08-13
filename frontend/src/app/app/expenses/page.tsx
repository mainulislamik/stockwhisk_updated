"use client";

import { useState } from "react";
import { api, useApi, useApiAll, Paginated } from "@/lib/api";
import { ErrorState, Pagination, Spinner, money, fmtDate } from "@/components/ui";
import toast from "react-hot-toast";

type Expense = { id: number; category: number | null; category_name: string | null; amount: string; spent_on: string; payment_method: string; note: string };
type Cat = { id: number; name: string };

const PAGE_SIZE = 20;

export default function ExpensesPage() {
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ category: "", amount: "", spent_on: new Date().toISOString().slice(0, 10), payment_method: "CASH", note: "" });
  const [saving, setSaving] = useState(false);

  // Only the current page is fetched; the total is a separate O(1) sum.
  const { data, loading, error, mutate } = useApi<Paginated<Expense>>("/accounting/expenses/", { page, page_size: PAGE_SIZE });
  const { data: totalData, mutate: mutateTotal } = useApi<{ total: string }>("/accounting/expenses/total/");
  const { data: cats } = useApiAll<Cat>("/accounting/expense-categories/");
  const rows = data?.results || [];
  const rowCount = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(rowCount / PAGE_SIZE));
  const total = Number(totalData?.total || 0);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/accounting/expenses/", {
        method: "POST",
        body: { category: form.category || null, amount: form.amount, spent_on: form.spent_on, payment_method: form.payment_method, note: form.note },
      });
      setForm({ category: "", amount: "", spent_on: new Date().toISOString().slice(0, 10), payment_method: "CASH", note: "" });
      setPage(1);
      mutate();
      mutateTotal();
    } catch (err: any) {
      toast.error(err?.message || "Could not save expense");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner label="Loading expenses…" />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="vstack gap-3">
      <div className="card shadow-sm">
        <div className="card-body">
          <div className="fw-semibold mb-3">Record expense</div>
          <form onSubmit={save} className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="small">Category</label>
              <select className="form-select form-select-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">— none —</option>
                {(cats || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="small">Amount</label>
              <input required type="number" step="0.01" className="form-control form-control-sm" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="col-md-2">
              <label className="small">Date</label>
              <input type="date" className="form-control form-control-sm" value={form.spent_on} onChange={(e) => setForm({ ...form, spent_on: e.target.value })} />
            </div>
            <div className="col-md-2">
              <label className="small">Method</label>
              <select className="form-select form-select-sm" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                <option value="CASH">Cash</option>
                <option value="BANK">Bank</option>
                <option value="MOBILE">Mobile</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="small">Note</label>
              <input className="form-control form-control-sm" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <div className="col-md-1">
              <button className="btn btn-brand btn-sm w-100" disabled={saving}>
                {saving ? "…" : "Add"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-body d-flex justify-content-between align-items-center">
          <span className="fw-semibold">Total expenses</span>
          <span className="fs-4 fw-bold text-danger">{money(total)}</span>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-striped table-sm mb-0">
            <thead className="thead-5">
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Method</th>
                <th>Note</th>
                <th className="text-end">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr data-empty="">
                  <td colSpan={5} className="text-center text-secondary py-5">No expenses recorded.</td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="text-secondary">{fmtDate(r.spent_on)}</td>
                    <td>{r.category_name || "—"}</td>
                    <td className="text-secondary">{r.payment_method}</td>
                    <td className="text-secondary">{r.note || "—"}</td>
                    <td className="text-end">{money(r.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} setPage={setPage} total={rowCount} />
      </div>
    </div>
  );
}
