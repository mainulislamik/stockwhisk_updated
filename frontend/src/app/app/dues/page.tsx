"use client";

import { useState } from "react";
import { api, useApi, Paginated } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { ErrorState, Pagination, Spinner, money, fmtDate } from "@/components/ui";
import Swal from "sweetalert2";
import { showSuccess, showError } from "@/lib/dialogs";
import { useLanguage } from "@/contexts/LanguageContext";
import Link from "next/link";

type Customer = {
  id: number;
  name: string;
  phone: string;
  due_balance: string;
  last_purchase_at: string | null;
};

const PAGE_SIZE = 20;

export default function DuesPage() {
  const { t } = useLanguage();
  const { isOwner, can } = useAuth();
  const canCollect = isOwner || can("manage_customers");  // pay-due is a write
  const [page, setPage] = useState(1);
  // Only the current page of dues is fetched; the total is a separate O(1) sum.
  const { data, loading, error, mutate } = useApi<Paginated<Customer>>("/crm/customers/", { with_due: 1, page, page_size: PAGE_SIZE });
  const { data: totalData, mutate: mutateTotal } = useApi<{ total: string }>("/crm/customers/dues-total/");
  const rows = data?.results || [];
  const rowCount = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(rowCount / PAGE_SIZE));
  const total = Number(totalData?.total || 0);

  const loadDues = async () => { await mutate(); await mutateTotal(); };

  const receivePayment = async (customer: Customer) => {
    const { value: formValues, isConfirmed } = await Swal.fire({
      title: t("due_pay_title"),
      html: `
        <div class="mb-3 text-start">
          <label class="form-label fw-bold">${t("due_amt_to_pay")}</label>
          <div class="input-group">
            <span class="input-group-text">৳</span>
            <input id="swal-amount" type="number" step="0.01" class="form-control" value="${customer.due_balance}" max="${customer.due_balance}" min="0.01">
          </div>
        </div>
        <div class="mb-3 text-start">
          <label class="form-label fw-bold">${t("due_pay_method")}</label>
          <select id="swal-method" class="form-select">
            <option value="cash">${t("due_method_cash")}</option>
            <option value="bank">${t("due_method_bank")}</option>
            <option value="mobile">${t("due_method_mobile")}</option>
          </select>
        </div>
        <div class="mb-3 text-start">
          <label class="form-label fw-bold">${t("due_note_opt")}</label>
          <textarea id="swal-note" class="form-control" placeholder="${t("due_note_ph")}"></textarea>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: t("due_btn_settle"),
      confirmButtonColor: '#28a745',
      preConfirm: () => {
        const amount = (document.getElementById('swal-amount') as HTMLInputElement).value;
        const method = (document.getElementById('swal-method') as HTMLSelectElement).value;
        const note = (document.getElementById('swal-note') as HTMLTextAreaElement).value;
        if (!amount || Number(amount) <= 0) {
          Swal.showValidationMessage(t("due_err_valid_amt"));
        }
        if (Number(amount) > Number(customer.due_balance)) {
          Swal.showValidationMessage(t("due_err_exceed"));
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
        await showSuccess(t("due_pay_recv"), t("due_pay_succ", { amount: formValues.amount, name: customer.name }));
        await loadDues();
      } catch (e: any) {
        await showError(t("due_pay_fail"), e.data?.detail || e.message || t("due_err_occurred"));
      }
    }
  };

  if (loading) return <Spinner label={t("due_loading")} />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="vstack gap-3">
      <div className="card shadow-sm">
        <div className="card-body d-flex justify-content-between align-items-center">
          <span className="fw-semibold">{t("due_tot_recv")}</span>
          <span className="fs-4 fw-bold text-danger">{money(total)}</span>
        </div>
      </div>
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-striped table-sm align-middle mb-0">
            <thead className="thead-5">
              <tr>
                <th>{t("due_col_cust")}</th>
                <th>{t("due_col_phone")}</th>
                <th>{t("due_col_last_purch")}</th>
                <th className="text-end">{t("due_col_due")}</th>
                <th className="text-end">{t("due_col_actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr data-empty="">
                  <td colSpan={5} className="text-center text-secondary py-5">
                    <div style={{ fontSize: "2.5rem" }}>💰</div>
                    {t("due_no_dues")}
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr key={c.id}>
                    <td className="fw-medium"><Link href={`/app/customers/${c.id}`} className="text-decoration-none text-brand">{c.name}</Link></td>
                    <td className="text-secondary">{c.phone || "—"}</td>
                    <td className="text-secondary">{fmtDate(c.last_purchase_at)}</td>
                    <td className="text-end text-danger fw-semibold">{money(c.due_balance)}</td>
                    <td className="text-end">
                      {canCollect && (
                        <button
                          className="btn btn-sm btn-outline-success fw-semibold rounded-pill px-3"
                          onClick={() => receivePayment(c)}
                        >
                          {t("cust_btn_pay")}
                        </button>
                      )}
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
