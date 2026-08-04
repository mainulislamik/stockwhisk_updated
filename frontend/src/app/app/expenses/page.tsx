"use client";

import { useEffect, useState } from "react";
import { api, fetchAll } from "@/lib/api";
import { ErrorState, Pagination, Spinner, money, fmtDate, usePagination } from "@/components/ui";

type Expense = { id: number; category: number | null; category_name: string | null; amount: string; spent_on: string; payment_method: string; note: string };
type Cat = { id: number; name: string };

export default function ExpensesPage() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ category: "", amount: "", spent_on: new Date().toISOString().slice(0, 10), payment_method: "CASH", note: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [e, c] = await Promise.all([fetchAll<Expense>("/accounting/expenses/"), fetchAll<Cat>("/accounting/expense-categories/").catch(() => [])]);
      setRows(e);
      setCats(c);
    } catch (err: any) {
      setError(err?.message || "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/accounting/expenses/", {
        method: "POST",
        body: { category: form.category || null, amount: form.amount, spent_on: form.spent_on, payment_method: form.payment_method, note: form.note },
      });
      setForm({ category: "", amount: "", spent_on: new Date().toISOString().slice(0, 10), payment_method: "CASH", note: "" });
      await load();
    } catch (err: any) {
      alert(err?.message || "Could not save expense");
    } finally {
      setSaving(false);
    }
  }

  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const { paged, page: pg, setPage, totalPages, total: rowCount } = usePagination(rows);

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
                {cats.map((c) => (
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
                paged.map((r) => (
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
        <Pagination page={pg} totalPages={totalPages} setPage={setPage} total={rowCount} />
      </div>
    </div>
  );
}
