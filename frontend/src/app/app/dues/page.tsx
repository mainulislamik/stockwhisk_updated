"use client";

import { useEffect, useState } from "react";
import { api, fetchAll } from "@/lib/api";
import { ErrorState, Pagination, Spinner, money, fmtDate, usePagination } from "@/components/ui";
import Swal from "sweetalert2";
import { showSuccess, showError } from "@/lib/dialogs";

type Customer = {
  id: number;
  name: string;
  phone: string;
  due_balance: string;
  last_purchase_at: string | null;
};

export default function DuesPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDues = async () => {
    try {
      setRows(await fetchAll<Customer>("/crm/customers/", { with_due: 1 }));
    } catch (e: any) {
      setError(e?.message || "Failed to load dues");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDues();
  }, []);

  const receivePayment = async (customer: Customer) => {
    const { value: formValues, isConfirmed } = await Swal.fire({
      title: 'Receive Payment',
      html: `
        <div class="mb-3 text-start">
          <label class="form-label fw-bold">Amount to Pay</label>
          <div class="input-group">
            <span class="input-group-text">৳</span>
            <input id="swal-amount" type="number" step="0.01" class="form-control" value="${customer.due_balance}" max="${customer.due_balance}" min="0.01">
          </div>
        </div>
        <div class="mb-3 text-start">
          <label class="form-label fw-bold">Payment Method</label>
          <select id="swal-method" class="form-select">
            <option value="cash">Cash</option>
            <option value="bank">Bank / Card</option>
            <option value="mobile">Mobile Banking (bKash/Nagad)</option>
          </select>
        </div>
        <div class="mb-3 text-start">
          <label class="form-label fw-bold">Note (Optional)</label>
          <textarea id="swal-note" class="form-control" placeholder="Enter any transaction notes..."></textarea>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Settle Payment',
      confirmButtonColor: '#28a745',
      preConfirm: () => {
        const amount = (document.getElementById('swal-amount') as HTMLInputElement).value;
        const method = (document.getElementById('swal-method') as HTMLSelectElement).value;
        const note = (document.getElementById('swal-note') as HTMLTextAreaElement).value;
        if (!amount || Number(amount) <= 0) {
          Swal.showValidationMessage('Please enter a valid amount');
        }
        if (Number(amount) > Number(customer.due_balance)) {
          Swal.showValidationMessage('Amount cannot exceed the total due balance');
        }
        return { amount, method, note };
      }
    });

    if (isConfirmed && formValues) {
      try {
        await api(`/crm/customers/${customer.id}/pay-due/`, {
          method: "POST",
          body: formValues
        });
        await showSuccess("Payment Received", `Successfully collected ৳${formValues.amount} from ${customer.name}.`);
        await loadDues();
      } catch (e: any) {
        await showError("Payment Failed", e.data?.detail || e.message || "An error occurred");
      }
    }
  };

  const { paged, page, setPage, totalPages, total: rowCount } = usePagination(rows);

  if (loading) return <Spinner label="Loading dues…" />;
  if (error) return <ErrorState error={error} />;

  const total = rows.reduce((s, c) => s + Number(c.due_balance || 0), 0);

  return (
    <div className="vstack gap-3">
      <div className="card shadow-sm">
        <div className="card-body d-flex justify-content-between align-items-center">
          <span className="fw-semibold">Total receivables</span>
          <span className="fs-4 fw-bold text-danger">{money(total)}</span>
        </div>
      </div>
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-striped table-sm align-middle mb-0">
            <thead className="thead-5">
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Last purchase</th>
                <th className="text-end">Due</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr data-empty="">
                  <td colSpan={5} className="text-center text-secondary py-5">
                    <div style={{ fontSize: "2.5rem" }}>💰</div>
                    No outstanding dues.
                  </td>
                </tr>
              ) : (
                paged.map((c) => (
                  <tr key={c.id}>
                    <td className="fw-medium">{c.name}</td>
                    <td className="text-secondary">{c.phone || "—"}</td>
                    <td className="text-secondary">{fmtDate(c.last_purchase_at)}</td>
                    <td className="text-end text-danger fw-semibold">{money(c.due_balance)}</td>
                    <td className="text-end">
                      <button 
                        className="btn btn-sm btn-outline-success fw-semibold rounded-pill px-3"
                        onClick={() => receivePayment(c)}
                      >
                        Receive Payment
                      </button>
                    </td>
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
