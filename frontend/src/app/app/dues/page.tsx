"use client";

import React, { useEffect, useState, useMemo } from "react";
import { api, fetchAll } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { ErrorState, Pagination, Spinner, money, fmtDate, usePagination } from "@/components/ui";
import { useLanguage } from "@/contexts/LanguageContext";
import Link from "next/link";
import toast from "react-hot-toast";

type DueItem = {
  id: number;
  type: "customer" | "purchase";
  ref_no: string;
  party_id?: number | null;
  party_name: string;
  phone?: string;
  date: string;
  total: string;
  paid: string;
  due: string;
  due_date?: string | null;
  href: string;
  raw: any;
};

const PAY_METHODS = [
  { value: "cash", label: "💵 Cash" },
  { value: "card", label: "💳 Card" },
  { value: "bkash", label: "📱 bKash" },
  { value: "nagad", label: "🔴 Nagad" },
  { value: "bank", label: "🏦 Bank Transfer" },
  { value: "settlement", label: "⚖️ Settlement / Adjustment" },
];

export default function DuesPage() {
  const { t, lang } = useLanguage();
  const { isOwner, can } = useAuth();
  const canManageCustomers = isOwner || can("manage_customers");
  const canManagePurchases = isOwner || can("manage_purchasing");

  const [activeTab, setActiveTab] = useState<"all" | "customer" | "purchase">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [customerDues, setCustomerDues] = useState<DueItem[]>([]);
  const [purchaseDues, setPurchaseDues] = useState<DueItem[]>([]);
  const [totalReceivable, setTotalReceivable] = useState<number>(0);
  const [totalPayable, setTotalPayable] = useState<number>(0);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"settle" | "edit_date">("settle");
  const [selectedItem, setSelectedItem] = useState<DueItem | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [promisedDate, setPromisedDate] = useState("");
  const [payNote, setPayNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Date helper functions
  function addDays(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  }

  function getNextMonthFirstDay() {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 1);
    return d.toISOString().split("T")[0];
  }

  function isOverdue(dueDateStr?: string | null) {
    if (!dueDateStr) return false;
    const today = new Date().toISOString().split("T")[0];
    return dueDateStr < today;
  }

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      // 1. Fetch Sales with dues
      const salesReq = fetchAll<any>("/sales/sales/?with_due=1").catch(() => []);
      // 2. Fetch Purchase Orders with dues
      const poReq = fetchAll<any>("/purchasing/purchase-orders/?with_due=1").catch(() => []);
      // 3. Totals
      const custTotReq = api<{ total: string }>("/crm/customers/dues-total/").catch(() => ({ total: "0" }));
      const suppTotReq = api<{ total: string }>("/purchasing/suppliers/dues-total/").catch(() => ({ total: "0" }));

      const [salesData, poData, custTot, suppTot] = await Promise.all([
        salesReq,
        poReq,
        custTotReq,
        suppTotReq,
      ]);

      const custItems: DueItem[] = (salesData || []).map((s: any) => ({
        id: s.id,
        type: "customer",
        ref_no: s.invoice_no,
        party_id: s.customer ? (typeof s.customer === "object" ? s.customer.id : s.customer) : null,
        party_name: s.customer_name || (typeof s.customer === "object" ? s.customer?.name : "") || s.bill_name || "Walk-in Customer",
        phone: s.bill_phone || s.customer_phone || (typeof s.customer === "object" ? s.customer?.phone : "") || "",
        date: s.sale_date,
        total: String(s.total || 0),
        paid: String(s.paid || 0),
        due: String(s.due || (Number(s.total) - Number(s.paid))),
        due_date: s.due_date || null,
        href: `/app/sales/${s.id}`,
        raw: s,
      }));

      const purchItems: DueItem[] = (poData || []).map((po: any) => ({
        id: po.id,
        type: "purchase",
        ref_no: po.po_number || `PO#${po.id}`,
        party_id: po.supplier ? (typeof po.supplier === "object" ? po.supplier.id : po.supplier) : null,
        party_name: po.supplier_name || (typeof po.supplier === "object" ? po.supplier?.name : "") || "Supplier",
        phone: typeof po.supplier === "object" ? po.supplier?.phone : "",
        date: po.order_date || po.created_at,
        total: String(po.total || 0),
        paid: String(po.paid || 0),
        due: String(po.due || (Number(po.total) - Number(po.paid))),
        due_date: po.due_date || null,
        href: `/app/purchases`,
        raw: po,
      }));

      setCustomerDues(custItems);
      setPurchaseDues(purchItems);

      // Compute or set summary totals
      const custSum = Number(custTot?.total || 0) || custItems.reduce((acc, it) => acc + Number(it.due || 0), 0);
      const suppSum = Number(suppTot?.total || 0) || purchItems.reduce((acc, it) => acc + Number(it.due || 0), 0);
      setTotalReceivable(custSum);
      setTotalPayable(suppSum);
    } catch (err: any) {
      setError(err?.message || "Failed to load due records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Filtered & Combined list
  const combinedList = useMemo(() => {
    let list: DueItem[] = [];
    if (activeTab === "all") {
      list = [...customerDues, ...purchaseDues];
    } else if (activeTab === "customer") {
      list = customerDues;
    } else {
      list = purchaseDues;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (it) =>
          it.ref_no.toLowerCase().includes(q) ||
          it.party_name.toLowerCase().includes(q) ||
          (it.phone && it.phone.includes(q))
      );
    }

    // Sort: overdue first, then recent date
    return list.sort((a, b) => {
      const aOverdue = isOverdue(a.due_date);
      const bOverdue = isOverdue(b.due_date);
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [activeTab, customerDues, purchaseDues, search]);

  const { paged, page, setPage, totalPages, total } = usePagination(combinedList, 20);

  // Open Settle Modal
  function handleOpenSettle(item: DueItem) {
    setSelectedItem(item);
    setModalMode("settle");
    setPayAmount(String(Number(item.due) > 0 ? item.due : ""));
    setPayMethod("cash");
    setPromisedDate(item.due_date || "");
    setPayNote("");
    setModalOpen(true);
  }

  // Open Edit Date Only Modal
  function handleOpenEditDate(item: DueItem) {
    setSelectedItem(item);
    setModalMode("edit_date");
    setPayAmount("");
    setPromisedDate(item.due_date || "");
    setPayNote("");
    setModalOpen(true);
  }

  // Submit Settlement / Date update
  async function handleSubmitModal(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItem) return;
    setSubmitting(true);

    try {
      if (modalMode === "settle") {
        const amtNum = Number(payAmount) || 0;
        if (amtNum <= 0 && !promisedDate) {
          toast.error(lang === "bn" ? "অনুগ্রহ করে পেমেন্টের পরিমাণ বা প্রতিশ্রুত তারিখ প্রদান করুন।" : "Please provide either a payment amount or a promised date.");
          setSubmitting(false);
          return;
        }

        // 1. If payment amount > 0, record payment
        if (amtNum > 0) {
          if (selectedItem.type === "customer") {
            await api(`/sales/sales/${selectedItem.id}/add_payment/`, {
              method: "POST",
              body: {
                amount: amtNum,
                method: payMethod,
                note: payNote,
              },
            });
          } else {
            await api(`/purchasing/purchase-orders/${selectedItem.id}/pay-due/`, {
              method: "POST",
              body: {
                amount: amtNum,
                method: payMethod,
                note: payNote,
              },
            });
          }
        }

        // 2. If promised date changed/provided, update due_date
        if (promisedDate !== (selectedItem.due_date || "")) {
          if (selectedItem.type === "customer") {
            await api(`/sales/sales/${selectedItem.id}/set-due-date/`, {
              method: "POST",
              body: { due_date: promisedDate || null },
            });
          } else {
            await api(`/purchasing/purchase-orders/${selectedItem.id}/set-due-date/`, {
              method: "POST",
              body: { due_date: promisedDate || null },
            });
          }
        }

        toast.success(
          lang === "bn"
            ? `বকেয়া নিষ্পত্তি ও পেমেন্ট সফলভাবে সম্পন্ন হয়েছে!`
            : `Due settlement and payment recorded successfully!`
        );
      } else {
        // Edit Date only
        if (selectedItem.type === "customer") {
          await api(`/sales/sales/${selectedItem.id}/set-due-date/`, {
            method: "POST",
            body: { due_date: promisedDate || null },
          });
        } else {
          await api(`/purchasing/purchase-orders/${selectedItem.id}/set-due-date/`, {
            method: "POST",
            body: { due_date: promisedDate || null },
          });
        }

        toast.success(
          lang === "bn"
            ? `পরিশোধের প্রতিশ্রুত তারিখ আপডেট হয়েছে!`
            : `Promised payment date updated successfully!`
        );
      }

      setModalOpen(false);
      setSelectedItem(null);
      await loadData();
    } catch (err: any) {
      toast.error(err?.data?.detail || err?.message || "Operation failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !customerDues.length && !purchaseDues.length) {
    return <Spinner label={t("due_loading")} />;
  }

  if (error) return <ErrorState error={error} />;

  return (
    <div className="vstack gap-3 pb-5">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h4 className="fw-bold mb-1 text-dark">
            💰 {t("due_title") || "Due Management Hub"}
          </h4>
          <p className="text-secondary small mb-0">
            {t("due_subtitle") || "Track, collect, settle, and manage promised due dates for customers and suppliers"}
          </p>
        </div>
        <button className="btn btn-outline-secondary btn-sm" onClick={loadData}>
          🔄 {lang === "bn" ? "রিফ্রেশ" : "Refresh"}
        </button>
      </div>

      {/* Summary Metric Cards */}
      <div className="row g-3">
        <div className="col-12 col-md-4">
          <div className="card shadow-sm border-0 border-start border-4 border-success rounded-3 bg-white h-100">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <span className="text-secondary small fw-semibold">
                    {t("due_tot_recv") || "Customer Receivables (দোকানের পাওনা)"}
                  </span>
                  <h3 className="fw-bold text-success mt-1 mb-0">
                    {money(totalReceivable)}
                  </h3>
                </div>
                <div className="rounded-circle bg-success bg-opacity-10 p-3 text-success fs-3">
                  🛒
                </div>
              </div>
              <div className="small text-secondary mt-2">
                {customerDues.length} {lang === "bn" ? "টি বাকি চালান" : "due sales"}
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="card shadow-sm border-0 border-start border-4 border-danger rounded-3 bg-white h-100">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <span className="text-secondary small fw-semibold">
                    {t("due_tot_payable") || "Supplier Payables (দোকানের দেনা)"}
                  </span>
                  <h3 className="fw-bold text-danger mt-1 mb-0">
                    {money(totalPayable)}
                  </h3>
                </div>
                <div className="rounded-circle bg-danger bg-opacity-10 p-3 text-danger fs-3">
                  📦
                </div>
              </div>
              <div className="small text-secondary mt-2">
                {purchaseDues.length} {lang === "bn" ? "টি ক্রয় দেনা" : "due purchases"}
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="card shadow-sm border-0 border-start border-4 border-primary rounded-3 bg-white h-100">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <span className="text-secondary small fw-semibold">
                    {t("due_net_pos") || "Net Due Position"}
                  </span>
                  <h3 className={`fw-bold mt-1 mb-0 ${totalReceivable >= totalPayable ? "text-primary" : "text-warning"}`}>
                    {money(totalReceivable - totalPayable)}
                  </h3>
                </div>
                <div className="rounded-circle bg-primary bg-opacity-10 p-3 text-primary fs-3">
                  ⚖️
                </div>
              </div>
              <div className="small text-secondary mt-2">
                {totalReceivable >= totalPayable
                  ? (lang === "bn" ? "পাওনা বেশি (Net Asset)" : "Net Positive Position")
                  : (lang === "bn" ? "দেনা বেশি (Net Liability)" : "Net Payable Position")}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-2">
        <div className="btn-group shadow-sm" role="group">
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "all" ? "btn-brand fw-bold" : "btn-light border"}`}
            onClick={() => setActiveTab("all")}
          >
            📋 {t("due_tab_all") || "All Dues"} ({customerDues.length + purchaseDues.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "customer" ? "btn-brand fw-bold" : "btn-light border"}`}
            onClick={() => setActiveTab("customer")}
          >
            🛒 {t("due_tab_customer") || "Customer Dues"} ({customerDues.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "purchase" ? "btn-brand fw-bold" : "btn-light border"}`}
            onClick={() => setActiveTab("purchase")}
          >
            📦 {t("due_tab_purchase") || "Purchase Dues"} ({purchaseDues.length})
          </button>
        </div>

        <div className="d-flex gap-2">
          <input
            type="search"
            className="form-control form-control-sm"
            style={{ width: "240px" }}
            placeholder={lang === "bn" ? "চালান / নাম / ফোন দিয়ে খুঁজুন..." : "Search ref, name, phone..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Dues Table Card */}
      <div className="card shadow-sm border-0 rounded-3">
        <div className="table-responsive">
          <table className="table table-striped table-hover table-sm align-middle mb-0">
            <thead className="thead-4">
              <tr>
                <th>{t("due_col_type") || "Type"}</th>
                <th>{t("due_col_ref") || "Reference"}</th>
                <th>{t("due_col_party") || "Customer / Supplier"}</th>
                <th>{t("due_col_phone") || "Contact"}</th>
                <th>{t("due_col_date") || "Date"}</th>
                <th className="text-end">{t("due_col_total") || "Total"}</th>
                <th className="text-end">{t("due_col_paid") || "Paid"}</th>
                <th className="text-end">{t("due_col_due") || "Due Balance"}</th>
                <th>{t("due_col_promised_date") || "Promised Date"}</th>
                <th className="text-end pe-3">{t("due_col_actions") || "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr data-empty="">
                  <td colSpan={10} className="text-center text-secondary py-5">
                    <div style={{ fontSize: "2.5rem" }}>🎉</div>
                    <div className="fw-semibold mt-2">{t("due_no_dues") || "No outstanding dues found."}</div>
                  </td>
                </tr>
              ) : (
                paged.map((it) => {
                  const overdue = isOverdue(it.due_date);
                  const canAct = it.type === "customer" ? canManageCustomers : canManagePurchases;

                  return (
                    <tr key={`${it.type}-${it.id}`} className={overdue ? "table-danger bg-opacity-25" : ""}>
                      {/* Type */}
                      <td>
                        {it.type === "customer" ? (
                          <span className="badge text-white" style={{ background: "#2563eb" }}>
                            🛒 {t("due_badge_customer") || "Sale"}
                          </span>
                        ) : (
                          <span className="badge text-white" style={{ background: "#d97706" }}>
                            📦 {t("due_badge_purchase") || "Purchase"}
                          </span>
                        )}
                      </td>

                      {/* Reference */}
                      <td>
                        <Link href={it.href} className="fw-semibold text-brand text-decoration-none">
                          {it.ref_no}
                        </Link>
                      </td>

                      {/* Party */}
                      <td>
                        {it.party_id && it.type === "customer" ? (
                          <Link href={`/app/customers/${it.party_id}`} className="text-decoration-none fw-medium text-dark">
                            {it.party_name}
                          </Link>
                        ) : (
                          <span className="fw-medium text-dark">{it.party_name}</span>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="text-secondary small">{it.phone || "—"}</td>

                      {/* Date */}
                      <td className="text-secondary small">{fmtDate(it.date)}</td>

                      {/* Total, Paid, Due */}
                      <td className="text-end fw-semibold">{money(it.total)}</td>
                      <td className="text-end text-success">{money(it.paid)}</td>
                      <td className="text-end text-danger fw-bold">{money(it.due)}</td>

                      {/* Promised Date */}
                      <td>
                        <div className="d-flex align-items-center gap-1">
                          {it.due_date ? (
                            <span
                              className={`badge rounded-pill px-2 py-1 ${
                                overdue ? "bg-danger text-white" : "bg-light text-dark border"
                              }`}
                            >
                              📅 {fmtDate(it.due_date)} {overdue && `(${t("due_badge_overdue") || "OVERDUE"})`}
                            </span>
                          ) : (
                            <span className="text-muted small">—</span>
                          )}

                          {canAct && (
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-0 text-secondary text-decoration-none"
                              title={t("due_btn_edit_date") || "Change Date"}
                              onClick={() => handleOpenEditDate(it)}
                            >
                              ✏️
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="text-end pe-3">
                        <div className="d-inline-flex gap-1">
                          {canAct && (
                            <>
                              <button
                                type="button"
                                className="btn btn-sm btn-success py-0 px-2 fw-semibold"
                                style={{ fontSize: "0.78rem" }}
                                onClick={() => handleOpenSettle(it)}
                              >
                                💵 {t("due_btn_settle") || "Settle / Pay"}
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary py-0 px-2"
                                style={{ fontSize: "0.78rem" }}
                                onClick={() => handleOpenEditDate(it)}
                              >
                                📅 {t("due_btn_edit_date") || "Date"}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} setPage={setPage} total={total} />
      </div>

      {/* Settle / Edit Promised Date Modal */}
      {modalOpen && selectedItem && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1060 }}
          tabIndex={-1}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden">
              <form onSubmit={handleSubmitModal}>
                <div className="modal-header bg-light py-3 px-4">
                  <h5 className="modal-title fw-bold text-dark mb-0">
                    {modalMode === "settle"
                      ? (t("due_modal_settle_title") || "Due Settlement & Payment")
                      : (t("due_modal_date_title") || "Update Promised Payment Date")}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setModalOpen(false)}
                    disabled={submitting}
                  ></button>
                </div>

                <div className="modal-body p-4 vstack gap-3">
                  {/* Summary of target item */}
                  <div className="p-3 bg-light rounded-3 border d-flex justify-content-between align-items-center">
                    <div>
                      <div className="fw-bold text-dark">{selectedItem.ref_no}</div>
                      <div className="small text-secondary">{selectedItem.party_name}</div>
                    </div>
                    <div className="text-end">
                      <div className="small text-secondary">{lang === "bn" ? "মোট বকেয়া" : "Outstanding Due"}</div>
                      <div className="fs-5 fw-bold text-danger">{money(selectedItem.due)}</div>
                    </div>
                  </div>

                  {modalMode === "settle" && (
                    <>
                      {/* Amount to Pay */}
                      <div>
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <label className="form-label small fw-bold text-dark mb-0">
                            {lang === "bn" ? "পরিশোধের পরিমাণ (Amount to Pay ৳)" : "Payment Amount (৳)"}
                          </label>
                          <button
                            type="button"
                            className="btn btn-xs btn-outline-primary py-0 px-2"
                            style={{ fontSize: "0.72rem" }}
                            onClick={() => setPayAmount(selectedItem.due)}
                          >
                            {lang === "bn" ? "সম্পূর্ণ বকেয়া (Full Due)" : "Full Due"}
                          </button>
                        </div>
                        <div className="input-group">
                          <span className="input-group-text bg-white fw-bold">৳</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            max={selectedItem.due}
                            className="form-control fw-bold fs-5 text-success"
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            placeholder={selectedItem.due}
                          />
                        </div>
                      </div>

                      {/* Payment Method */}
                      <div>
                        <label className="form-label small fw-bold text-dark mb-1">
                          {lang === "bn" ? "পেমেন্ট মাধ্যম (Payment Method)" : "Payment Method"}
                        </label>
                        <div className="d-flex flex-wrap gap-2">
                          {PAY_METHODS.map((pm) => (
                            <button
                              key={pm.value}
                              type="button"
                              className={`btn btn-sm ${
                                payMethod === pm.value ? "btn-brand fw-bold shadow-sm" : "btn-outline-secondary bg-white"
                              }`}
                              onClick={() => setPayMethod(pm.value)}
                            >
                              {pm.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Promised Payment Date Section */}
                  <div className="p-3 bg-danger bg-opacity-10 rounded-3 border border-danger-subtle vstack gap-2">
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="text-danger fw-bold small">
                        <i className="bi bi-calendar-event-fill me-1"></i>
                        {lang === "bn" ? "পরিশোধের প্রতিশ্রুত তারিখ (Promised Due Date)" : "Promised Due Date"}
                      </span>
                      {promisedDate && (
                        <button
                          type="button"
                          className="btn btn-xs btn-link text-danger p-0 small text-decoration-none"
                          onClick={() => setPromisedDate("")}
                        >
                          ✕ {lang === "bn" ? "তারিখ মুছুন" : "Clear"}
                        </button>
                      )}
                    </div>

                    {/* Quick Shortcut Buttons */}
                    <div className="d-flex flex-wrap gap-1">
                      <button
                        type="button"
                        className={`btn btn-xs rounded-pill px-2 py-0 ${
                          promisedDate === addDays(7) ? "btn-danger text-white fw-bold" : "btn-outline-danger bg-white"
                        }`}
                        style={{ fontSize: "0.72rem" }}
                        onClick={() => setPromisedDate(addDays(7))}
                      >
                        {lang === "bn" ? "+৭ দিন" : "+7 Days"}
                      </button>
                      <button
                        type="button"
                        className={`btn btn-xs rounded-pill px-2 py-0 ${
                          promisedDate === addDays(15) ? "btn-danger text-white fw-bold" : "btn-outline-danger bg-white"
                        }`}
                        style={{ fontSize: "0.72rem" }}
                        onClick={() => setPromisedDate(addDays(15))}
                      >
                        {lang === "bn" ? "+১৫ দিন" : "+15 Days"}
                      </button>
                      <button
                        type="button"
                        className={`btn btn-xs rounded-pill px-2 py-0 ${
                          promisedDate === addDays(30) ? "btn-danger text-white fw-bold" : "btn-outline-danger bg-white"
                        }`}
                        style={{ fontSize: "0.72rem" }}
                        onClick={() => setPromisedDate(addDays(30))}
                      >
                        {lang === "bn" ? "+৩০ দিন" : "+30 Days"}
                      </button>
                      <button
                        type="button"
                        className={`btn btn-xs rounded-pill px-2 py-0 ${
                          promisedDate === getNextMonthFirstDay() ? "btn-danger text-white fw-bold" : "btn-outline-danger bg-white"
                        }`}
                        style={{ fontSize: "0.72rem" }}
                        onClick={() => setPromisedDate(getNextMonthFirstDay())}
                      >
                        {lang === "bn" ? "পরবর্তী মাসের ১ তারিখ" : "Next Month 1st"}
                      </button>
                    </div>

                    <input
                      type="date"
                      className="form-control bg-white shadow-sm border-danger-subtle form-control-sm"
                      value={promisedDate}
                      onChange={(e) => setPromisedDate(e.target.value)}
                    />
                  </div>

                  {modalMode === "settle" && (
                    <div>
                      <label className="form-label small fw-bold text-dark mb-1">
                        {lang === "bn" ? "নোট / বিবরণ (ঐচ্ছিক)" : "Note (Optional)"}
                      </label>
                      <textarea
                        className="form-control form-control-sm"
                        rows={2}
                        placeholder={lang === "bn" ? "লেনদেনের নোট লিখুন..." : "Enter transaction note..."}
                        value={payNote}
                        onChange={(e) => setPayNote(e.target.value)}
                      ></textarea>
                    </div>
                  )}
                </div>

                <div className="modal-footer bg-light p-3 d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-outline-secondary px-4"
                    onClick={() => setModalOpen(false)}
                    disabled={submitting}
                  >
                    {lang === "bn" ? "বাতিল" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-success px-4 fw-bold"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <span className="spinner-border spinner-border-sm me-1"></span>
                    ) : (
                      "✓ "
                    )}
                    {modalMode === "settle"
                      ? (lang === "bn" ? "পেমেন্ট ও নিষ্পত্তি সংরক্ষণ করুন" : "Save Settlement")
                      : (lang === "bn" ? "তারিখ আপডেট করুন" : "Update Promised Date")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

