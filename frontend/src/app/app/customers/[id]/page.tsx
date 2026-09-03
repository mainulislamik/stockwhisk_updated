"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ErrorState, Spinner, money, fmtDate } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/contexts/LanguageContext";
import toast from "react-hot-toast";

type CustomerDetail = {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  due_balance: string;
  total_purchased: string;
  last_purchase_at: string | null;
};

type Sale = {
  id: number;
  invoice_no?: string;
  invoice_number?: string;
  sale_date?: string;
  created_at: string;
  total: string;
  paid: string;
  due: string;
  status: string;
};

type ServiceTicketItem = {
  id: number;
  ticket_no: string;
  device_description: string;
  complaint: string;
  status: string;
  bill_total: string;
  paid: string;
  due: string;
  received_at: string;
};

export default function CustomerProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const { t } = useLanguage();
  const { isOwner, can } = useAuth();
  const canManage = isOwner || can("manage_customers");

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [tickets, setTickets] = useState<ServiceTicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [paying, setPaying] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payNote, setPayNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const [cust, salesData, ticketsData] = await Promise.all([
        api<CustomerDetail>(`/crm/customers/${id}/`),
        api<{ results: Sale[] }>(`/sales/sales/?customer=${id}&page_size=50`).catch(() => ({ results: [] })),
        api<{ results: ServiceTicketItem[] }>(`/service/tickets/?customer=${id}&page_size=50`).catch(() => ({ results: [] })),
      ]);
      setCustomer(cust);
      setSales(Array.isArray(salesData) ? salesData : (salesData as any)?.results || []);
      setTickets(Array.isArray(ticketsData) ? ticketsData : (ticketsData as any)?.results || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load customer");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payAmount || Number(payAmount) <= 0) { toast.error("Enter a valid amount"); return; }
    setSaving(true);
    try {
      await api(`/crm/customers/${id}/pay-due/`, {
        method: "POST",
        body: { amount: payAmount, method: payMethod, note: payNote },
      });
      toast.success(t("cust_pay_ok"));
      setPaying(false);
      setPayAmount("");
      setPayNote("");
      load();
    } catch (e: any) {
      toast.error(e?.message || t("cust_err_pay"));
    } finally {
      setSaving(false);
    }
  }

  const statusBadge: Record<string, string> = {
    paid: "text-bg-success",
    partial: "text-bg-warning",
    due: "text-bg-danger",
    cancelled: "text-bg-secondary",
    returned: "text-bg-info",
  };

  const ticketStatusBadge: Record<string, string> = {
    received: "text-bg-secondary",
    diagnosing: "text-bg-info",
    awaiting_parts: "text-bg-warning",
    in_repair: "text-bg-warning",
    ready_for_pickup: "text-bg-primary",
    delivered: "text-bg-success",
    cancelled: "text-bg-dark",
  };

  if (loading) return <Spinner label={t("cust_loading")} />;
  if (error || !customer) return <ErrorState error={error || "Customer not found"} />;

  const hasDue = Number(customer.due_balance) > 0;

  return (
    <div className="vstack gap-3">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div>
          <h1 className="h4 fw-bold text-brand mb-0">{customer.name}</h1>
          <div className="text-secondary small">
            {customer.phone && <span className="me-3">📞 {customer.phone}</span>}
            {customer.email && <span className="me-3">✉️ {customer.email}</span>}
            {customer.address && <span>📍 {customer.address}</span>}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              router.back();
            } else {
              router.push("/app/customers");
            }
          }}
        >
          &#8592; {t("nav_customers")}
        </button>
      </div>

      <div className="row g-3">
        <div className="col-sm-4">
          <div className="card shadow-sm h-100">
            <div className="card-body text-center">
              <div className="text-secondary small mb-1">{t("cust_col_total")}</div>
              <div className="fs-4 fw-bold text-brand">{money(customer.total_purchased)}</div>
            </div>
          </div>
        </div>
        <div className="col-sm-4">
          <div className="card shadow-sm h-100">
            <div className="card-body text-center">
              <div className="text-secondary small mb-1">{t("cust_col_due")}</div>
              <div className={`fs-4 fw-bold ${hasDue ? "text-danger" : "text-success"}`}>{money(customer.due_balance)}</div>
            </div>
          </div>
        </div>
        <div className="col-sm-4">
          <div className="card shadow-sm h-100">
            <div className="card-body text-center">
              <div className="text-secondary small mb-1">{t("cust_col_last")}</div>
              <div className="fs-5 fw-semibold">{fmtDate(customer.last_purchase_at) || "—"}</div>
            </div>
          </div>
        </div>
      </div>

      {canManage && hasDue && (
        <div className="card shadow-sm border-danger border-opacity-25">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center">
              <span className="fw-semibold text-danger">{t("cust_col_due")}: {money(customer.due_balance)}</span>
              <button className="btn btn-brand btn-sm" onClick={() => { setPaying(!paying); setPayAmount(customer.due_balance); }}>
                {t("cust_btn_pay")}
              </button>
            </div>
            {paying && (
              <form onSubmit={submitPayment} className="row g-3 mt-2">
                <div className="col-md-3">
                  <label className="small">{t("cust_amt")}</label>
                  <input type="number" step="0.01" min="0.01" className="form-control form-control-sm" value={payAmount} onChange={e => setPayAmount(e.target.value)} required />
                </div>
                <div className="col-md-3">
                  <label className="small">{t("cust_meth")}</label>
                  <select className="form-select form-select-sm" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                    <option value="cash">{t("cust_meth_cash")}</option>
                    <option value="bkash">{t("cust_meth_bkash")}</option>
                    <option value="nagad">{t("cust_meth_nagad")}</option>
                    <option value="bank">{t("cust_meth_bank")}</option>
                    <option value="settlement">{t("stl_drawer_cash") ? "সেটেলমেন্ট / বকেয়া মার্জনা (ক্যাশ ছাড়া)" : "Settlement / Forgive Due (No Cash)"}</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="small">{t("cust_note")}</label>
                  <input className="form-control form-control-sm" placeholder={t("cust_note_ph")} value={payNote} onChange={e => setPayNote(e.target.value)} />
                </div>
                <div className="col-md-2 d-flex align-items-end gap-2">
                  <button className="btn btn-brand btn-sm" disabled={saving}>{saving ? t("cust_proc") : t("cust_submit")}</button>
                  <button type="button" className="btn btn-light btn-sm border" onClick={() => setPaying(false)}>{t("cust_cancel")}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Sales Invoices */}
      <div className="card shadow-sm">
        <div className="card-header fw-semibold">🧾 {t("nav_invoices")}</div>
        <div className="table-responsive">
          <table className="table table-sm table-striped align-middle mb-0">
            <thead className="thead-2">
              <tr>
                <th>{t("sales_list_col_inv")}</th>
                <th>{t("sales_list_col_date")}</th>
                <th className="text-end">{t("sales_list_col_total")}</th>
                <th className="text-end">{t("sales_list_col_paid")}</th>
                <th className="text-end">{t("sales_list_col_due")}</th>
                <th>{t("sales_list_col_status")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-secondary py-4">{t("sales_list_empty")}</td></tr>
              ) : sales.map(s => (
                <tr key={s.id}>
                  <td className="fw-medium">{s.invoice_no || s.invoice_number || `#${s.id}`}</td>
                  <td className="text-secondary">{fmtDate(s.sale_date || s.created_at)}</td>
                  <td className="text-end">{money(s.total)}</td>
                  <td className="text-end">{money(s.paid)}</td>
                  <td className={`text-end ${Number(s.due) > 0 ? "text-danger fw-semibold" : ""}`}>{money(s.due)}</td>
                  <td>
                    <span className={`badge ${statusBadge[s.status?.toLowerCase()] || "text-bg-light"}`}>
                      {t(`sales_status_${s.status?.toLowerCase()}`) || s.status}
                    </span>
                  </td>
                  <td>
                    <Link href={`/app/sales/${s.id}`} className="btn btn-outline-secondary btn-sm py-0">
                      {t("sales_list_view")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Service & Repair Tickets */}
      <div className="card shadow-sm">
        <div className="card-header fw-semibold">🔧 {t("nav_repair_tickets")}</div>
        <div className="table-responsive">
          <table className="table table-sm table-striped align-middle mb-0">
            <thead className="thead-2">
              <tr>
                <th>{t("tkt_col_ticket")}</th>
                <th>{t("tkt_col_device")}</th>
                <th>{t("tkt_col_received")}</th>
                <th className="text-end">{t("tkt_col_charge")}</th>
                <th className="text-end">{t("col_paid")}</th>
                <th className="text-end">{t("col_due")}</th>
                <th>{t("tkt_col_status")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-secondary py-4">{t("tkt_no_tickets")}</td></tr>
              ) : tickets.map(tk => (
                <tr key={tk.id}>
                  <td className="fw-medium">
                    <Link href={`/app/service/tickets/${tk.id}`} className="text-decoration-none text-brand">
                      {tk.ticket_no}
                    </Link>
                  </td>
                  <td>{tk.device_description}</td>
                  <td className="text-secondary">{fmtDate(tk.received_at)}</td>
                  <td className="text-end">{money(tk.bill_total)}</td>
                  <td className="text-end">{money(tk.paid)}</td>
                  <td className={`text-end ${Number(tk.due) > 0 ? "text-danger fw-semibold" : ""}`}>{money(tk.due)}</td>
                  <td>
                    <span className={`badge ${ticketStatusBadge[tk.status?.toLowerCase()] || "text-bg-light"}`}>
                      {t(`tkt_status_${tk.status?.toLowerCase()}`) || tk.status}
                    </span>
                  </td>
                  <td>
                    <Link href={`/app/service/tickets/${tk.id}`} className="btn btn-outline-secondary btn-sm py-0">
                      {t("sales_list_view")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
