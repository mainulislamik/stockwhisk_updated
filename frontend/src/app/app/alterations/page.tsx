"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import { ModuleRouteGuard } from "@/components/ModuleRouteGuard";

interface AlterationItem {
  id: number;
  product_id: number;
  product_name: string;
  variation_id: number | null;
  variation_name: string;
  quantity: number;
  unit_price: number;
}

interface AlterationSale {
  id: number;
  invoice_no: string;
  sale_date: string;
  customer_name: string;
  customer_phone: string;
  total: string | number;
  alteration_notes: string;
  alteration_status: string;
  alteration_due_date: string | null;
  tailor_name: string;
  alteration_charge: string | number;
  items: AlterationItem[];
  created_at: string;
}

export default function AlterationsPage() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const [alterations, setAlterations] = useState<AlterationSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [editingSale, setEditingSale] = useState<AlterationSale | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editTailor, setEditTailor] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [printSale, setPrintSale] = useState<AlterationSale | null>(null);

  async function loadAlterations() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      const data = await api<AlterationSale[]>(`/sales/alterations/?${params.toString()}`);
      setAlterations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load alterations:", err);
      setAlterations([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAlterations();
  }, [statusFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return alterations;
    const q = search.toLowerCase();
    return alterations.filter(
      (a) =>
        (a.invoice_no && a.invoice_no.toLowerCase().includes(q)) ||
        (a.customer_name && a.customer_name.toLowerCase().includes(q)) ||
        (a.customer_phone && a.customer_phone.includes(q)) ||
        (a.tailor_name && a.tailor_name.toLowerCase().includes(q)) ||
        (a.alteration_notes && a.alteration_notes.toLowerCase().includes(q))
    );
  }, [alterations, search]);

  const counts = useMemo(() => {
    return {
      all: alterations.length,
      pending: alterations.filter((a) => a.alteration_status === "pending").length,
      in_progress: alterations.filter((a) => a.alteration_status === "in_progress").length,
      ready: alterations.filter((a) => a.alteration_status === "ready").length,
      delivered: alterations.filter((a) => a.alteration_status === "delivered").length,
    };
  }, [alterations]);

  async function updateStatus(saleId: number, newStatus: string) {
    try {
      const updated = await api<AlterationSale>(`/sales/alterations/${saleId}/update_status/`, {
        method: "POST",
        body: { status: newStatus },
      });
      setAlterations((prev) => prev.map((a) => (a.id === saleId ? { ...a, ...updated } : a)));
    } catch (err) {
      alert(lang === "bn" ? "স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে।" : "Failed to update status.");
    }
  }

  async function handleSaveEdit() {
    if (!editingSale) return;
    setSavingEdit(true);
    try {
      const updated = await api<AlterationSale>(`/sales/alterations/${editingSale.id}/update_status/`, {
        method: "POST",
        body: {
          status: editStatus,
          tailor_name: editTailor,
          due_date: editDueDate || null,
          notes: editNotes,
        },
      });
      setAlterations((prev) => prev.map((a) => (a.id === editingSale.id ? { ...a, ...updated } : a)));
      setEditingSale(null);
    } catch (err) {
      alert(lang === "bn" ? "সংরক্ষণ ব্যর্থ হয়েছে।" : "Failed to save changes.");
    } finally {
      setSavingEdit(false);
    }
  }

  function sendWhatsAppAlert(sale: AlterationSale) {
    if (!sale.customer_phone) {
      alert(lang === "bn" ? "কাস্টমারের ফোন নম্বর নেই।" : "No phone number available.");
      return;
    }
    const cleanPhone = sale.customer_phone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.startsWith("88") ? cleanPhone : `88${cleanPhone}`;
    const shopName = user?.shop_name || "আমাদের আউটলেট";
    const msg = `আসসালামু আলাইকুম ${sale.customer_name || "সম্মানিত গ্রাহক"}, ${shopName} থেকে জানানো যাচ্ছে যে আপনার ইনভয়েস #${sale.invoice_no} এর পোশাকের অল্টারেশন / ফিটিং সম্পন্ন হয়েছে। অনুগ্রহ করে আউটলেট থেকে পোশাকটি সংগ্রহ করার অনুরোধ করা হলো। ধন্যবাদ!`;
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "pending":
        return <span className="badge bg-warning text-dark px-2 py-1">🕒 {lang === "bn" ? "অপেক্ষমান" : "Pending"}</span>;
      case "in_progress":
        return <span className="badge bg-primary px-2 py-1">✂️ {lang === "bn" ? "কাজ চলছে" : "In Progress"}</span>;
      case "ready":
        return <span className="badge bg-success px-2 py-1">🛍️ {lang === "bn" ? "প্রস্তুত (Ready)" : "Ready"}</span>;
      case "delivered":
        return <span className="badge bg-secondary px-2 py-1">📦 {lang === "bn" ? "ডেলিভার্ড" : "Delivered"}</span>;
      default:
        return <span className="badge bg-light text-dark border px-2 py-1">{status || "—"}</span>;
    }
  }

  function isOverdue(dueDateStr: string | null, status: string) {
    if (!dueDateStr || status === "delivered") return false;
    const due = new Date(dueDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  }

  return (
    <ModuleRouteGuard module="apparel_alterations,core_pos" name={lang === "bn" ? "পোশাক অল্টারেশন ও ফিটিং" : "Garment Alterations"}>
      <div className="container-fluid py-3 px-3">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <h1 className="h4 fw-bold text-dark mb-1 d-flex align-items-center gap-2">
              <span>✂️</span>
              <span>{lang === "bn" ? "পোশাক অল্টারেশন ও টেইলারিং জব বোর্ড" : "Garment Alterations & Fitting Board"}</span>
            </h1>
            <p className="text-secondary small mb-0">
              {lang === "bn"
                ? "গ্রাহকের পোশাকের ঝুল কাটা, হাতা ছোট করা, কোমর ফিটিং ও টেইলার ডেলিভারি ট্র্যাকিং।"
                : "Track tailoring requests, sleeve cuts, waist alterations and customer pickup notifications."}
            </p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className={`btn btn-sm ${viewMode === "kanban" ? "btn-primary" : "btn-outline-secondary"}`}
              onClick={() => setViewMode("kanban")}
            >
              <i className="bi bi-kanban me-1" />
              {lang === "bn" ? "কানবান বোর্ড" : "Kanban"}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${viewMode === "table" ? "btn-primary" : "btn-outline-secondary"}`}
              onClick={() => setViewMode("table")}
            >
              <i className="bi bi-table me-1" />
              {lang === "bn" ? "তালিকা ভিউ" : "Table"}
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={loadAlterations}>
              <i className="bi bi-arrow-clockwise me-1" />
              {lang === "bn" ? "রিফ্রেশ" : "Refresh"}
            </button>
          </div>
        </div>

        {/* KPI Counter Cards */}
        <div className="row g-2 mb-3">
          <div className="col-6 col-md-3">
            <div
              className={`card border-0 shadow-sm p-3 rounded-3 cursor-pointer ${statusFilter === "pending" ? "border-start border-4 border-warning bg-warning-subtle" : "bg-white"}`}
              onClick={() => setStatusFilter(statusFilter === "pending" ? "all" : "pending")}
              style={{ cursor: "pointer" }}
            >
              <div className="text-secondary small fw-semibold">🕒 {lang === "bn" ? "অপেক্ষমান" : "Pending"}</div>
              <div className="fs-3 fw-bold text-warning-emphasis">{counts.pending}</div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div
              className={`card border-0 shadow-sm p-3 rounded-3 cursor-pointer ${statusFilter === "in_progress" ? "border-start border-4 border-primary bg-primary-subtle" : "bg-white"}`}
              onClick={() => setStatusFilter(statusFilter === "in_progress" ? "all" : "in_progress")}
              style={{ cursor: "pointer" }}
            >
              <div className="text-secondary small fw-semibold">✂️ {lang === "bn" ? "কাজ চলছে" : "In Progress"}</div>
              <div className="fs-3 fw-bold text-primary">{counts.in_progress}</div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div
              className={`card border-0 shadow-sm p-3 rounded-3 cursor-pointer ${statusFilter === "ready" ? "border-start border-4 border-success bg-success-subtle" : "bg-white"}`}
              onClick={() => setStatusFilter(statusFilter === "ready" ? "all" : "ready")}
              style={{ cursor: "pointer" }}
            >
              <div className="text-secondary small fw-semibold">🛍️ {lang === "bn" ? "প্রস্তুত (Ready)" : "Ready"}</div>
              <div className="fs-3 fw-bold text-success">{counts.ready}</div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div
              className={`card border-0 shadow-sm p-3 rounded-3 cursor-pointer ${statusFilter === "delivered" ? "border-start border-4 border-secondary bg-secondary-subtle" : "bg-white"}`}
              onClick={() => setStatusFilter(statusFilter === "delivered" ? "all" : "delivered")}
              style={{ cursor: "pointer" }}
            >
              <div className="text-secondary small fw-semibold">📦 {lang === "bn" ? "ডেলিভার্ড" : "Delivered"}</div>
              <div className="fs-3 fw-bold text-secondary">{counts.delivered}</div>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="card border-0 shadow-sm p-2.5 mb-3 bg-white rounded-3">
          <div className="row g-2 align-items-center">
            <div className="col-md-6">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-light border-end-0">🔍</span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder={lang === "bn" ? "ইনভয়েস #, কাস্টমার নাম, মোবাইল বা দর্জির নাম দিয়ে খুঁজুন..." : "Search by invoice, customer, phone, tailor..."}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button className="btn btn-outline-secondary" type="button" onClick={() => setSearch("")}>
                    ✕
                  </button>
                )}
              </div>
            </div>
            <div className="col-md-6 d-flex align-items-center justify-content-md-end gap-2">
              <div className="btn-group btn-group-sm" role="group">
                <button
                  type="button"
                  className={`btn ${statusFilter === "all" ? "btn-dark" : "btn-outline-secondary"}`}
                  onClick={() => setStatusFilter("all")}
                >
                  {lang === "bn" ? "সবগুলো" : "All"} ({counts.all})
                </button>
                <button
                  type="button"
                  className={`btn ${statusFilter === "pending" ? "btn-warning text-dark" : "btn-outline-secondary"}`}
                  onClick={() => setStatusFilter("pending")}
                >
                  {lang === "bn" ? "অপেক্ষমান" : "Pending"} ({counts.pending})
                </button>
                <button
                  type="button"
                  className={`btn ${statusFilter === "in_progress" ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => setStatusFilter("in_progress")}
                >
                  {lang === "bn" ? "চলমান" : "In Progress"} ({counts.in_progress})
                </button>
                <button
                  type="button"
                  className={`btn ${statusFilter === "ready" ? "btn-success" : "btn-outline-secondary"}`}
                  onClick={() => setStatusFilter("ready")}
                >
                  {lang === "bn" ? "রেডি" : "Ready"} ({counts.ready})
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <div className="text-secondary small mt-2">{lang === "bn" ? "অল্টারেশন তালিকা লোড হচ্ছে..." : "Loading alterations..."}</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card border-0 shadow-sm p-5 text-center bg-white rounded-3">
            <div style={{ fontSize: "2.5rem" }}>✂️</div>
            <h5 className="fw-bold mt-2">{lang === "bn" ? "কোনো অল্টারেশন রেকর্ড পাওয়া যায়নি" : "No Alteration Records Found"}</h5>
            <p className="text-secondary small mb-0">
              {lang === "bn"
                ? "পিওএস টার্মিনালে বিক্রয় করার সময় '✂️ অল্টারেশন' বাটনে ক্লিক করে ফিটিং নোট যুক্ত করুন।"
                : "Attach alteration notes via the '✂️ Alteration' button during checkout in the POS terminal."}
            </p>
          </div>
        ) : viewMode === "kanban" ? (
          /* Kanban Board */
          <div className="row g-3">
            {[
              { id: "pending", title: lang === "bn" ? "🕒 অপেক্ষমান (Pending)" : "Pending", color: "warning" },
              { id: "in_progress", title: lang === "bn" ? "✂️ কাজ চলছে (In Progress)" : "In Progress", color: "primary" },
              { id: "ready", title: lang === "bn" ? "🛍️ ডেলিভারির জন্য প্রস্তুত (Ready)" : "Ready for Pickup", color: "success" },
              { id: "delivered", title: lang === "bn" ? "📦 ডেলিভার্ড (Delivered)" : "Delivered", color: "secondary" },
            ].map((col) => {
              const colItems = filtered.filter((a) => a.alteration_status === col.id);
              return (
                <div key={col.id} className="col-12 col-md-6 col-xl-3">
                  <div className="card border-0 shadow-sm bg-light h-100 rounded-3">
                    <div className={`card-header bg-white border-bottom border-2 border-${col.color} d-flex justify-content-between align-items-center py-2 px-3`}>
                      <span className="fw-bold text-dark small">{col.title}</span>
                      <span className={`badge bg-${col.color} ${col.color === "warning" ? "text-dark" : "text-white"}`}>{colItems.length}</span>
                    </div>
                    <div className="card-body p-2 d-flex flex-column gap-2" style={{ maxHeight: "72vh", overflowY: "auto" }}>
                      {colItems.length === 0 ? (
                        <div className="text-secondary small text-center py-4">{lang === "bn" ? "কোনো কাজ নেই" : "No jobs"}</div>
                      ) : (
                        colItems.map((sale) => {
                          const overdue = isOverdue(sale.alteration_due_date, sale.alteration_status);
                          return (
                            <div key={sale.id} className="card border-0 shadow-sm p-3 bg-white rounded-3">
                              <div className="d-flex justify-content-between align-items-start mb-1.5">
                                <span className="fw-bold text-primary font-monospace small">#{sale.invoice_no}</span>
                                {overdue && <span className="badge bg-danger text-white small">⚠️ {lang === "bn" ? "বিলম্বিত" : "Overdue"}</span>}
                              </div>

                              <div className="small fw-semibold text-dark mb-1">
                                👤 {sale.customer_name || (lang === "bn" ? "সাধারণ ক্রেতা" : "Walk-in Customer")}
                                {sale.customer_phone && <span className="text-secondary ms-1">({sale.customer_phone})</span>}
                              </div>

                              {/* Garments in this sale */}
                              {sale.items && sale.items.length > 0 && (
                                <div className="mb-2 p-1.5 bg-light rounded small text-secondary">
                                  <div className="fw-semibold text-dark" style={{ fontSize: "0.72rem" }}>
                                    {lang === "bn" ? "পোশাক আইটেম:" : "Garments:"}
                                  </div>
                                  {sale.items.slice(0, 2).map((it) => (
                                    <div key={it.id} className="text-truncate" style={{ fontSize: "0.75rem" }}>
                                      • {it.product_name} {it.variation_name ? `(${it.variation_name})` : ""}
                                    </div>
                                  ))}
                                  {sale.items.length > 2 && (
                                    <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                                      +{sale.items.length - 2} {lang === "bn" ? "আরও আইটেম" : "more"}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Fitting Instructions */}
                              <div className="p-2 rounded bg-info-subtle border border-info-subtle text-info-emphasis small mb-2">
                                <div className="fw-bold d-flex align-items-center gap-1" style={{ fontSize: "0.72rem" }}>
                                  <span>✂️</span>
                                  <span>{lang === "bn" ? "ফিটিং নোট:" : "Instructions:"}</span>
                                </div>
                                <div className="text-dark mt-0.5" style={{ fontSize: "0.8rem", whiteSpace: "pre-wrap" }}>
                                  {sale.alteration_notes || "—"}
                                </div>
                              </div>

                              {/* Meta Info */}
                              <div className="d-flex justify-content-between align-items-center text-secondary small mb-2" style={{ fontSize: "0.75rem" }}>
                                <span>
                                  {sale.tailor_name ? (
                                    <span>
                                      🧵 <strong className="text-dark">{sale.tailor_name}</strong>
                                    </span>
                                  ) : (
                                    <span className="text-muted">দর্জি: অনির্দিষ্ট</span>
                                  )}
                                </span>
                                <span>
                                  {sale.alteration_due_date ? (
                                    <span className={overdue ? "text-danger fw-bold" : ""}>
                                      📅 {sale.alteration_due_date}
                                    </span>
                                  ) : (
                                    <span className="text-muted">তারিখ নেই</span>
                                  )}
                                </span>
                              </div>

                              {Number(sale.alteration_charge) > 0 && (
                                <div className="text-success small fw-bold mb-2" style={{ fontSize: "0.75rem" }}>
                                  ফিটিং চার্জ: ৳{sale.alteration_charge}
                                </div>
                              )}

                              {/* Quick Action Footer */}
                              <div className="d-flex gap-1 pt-2 border-top">
                                {col.id === "pending" && (
                                  <button
                                    type="button"
                                    className="btn btn-xs btn-outline-primary flex-grow-1"
                                    style={{ fontSize: "0.75rem" }}
                                    onClick={() => updateStatus(sale.id, "in_progress")}
                                  >
                                    ✂️ {lang === "bn" ? "কাজ শুরু" : "Start"}
                                  </button>
                                )}
                                {col.id === "in_progress" && (
                                  <button
                                    type="button"
                                    className="btn btn-xs btn-success flex-grow-1 text-white"
                                    style={{ fontSize: "0.75rem" }}
                                    onClick={() => updateStatus(sale.id, "ready")}
                                  >
                                    🛍️ {lang === "bn" ? "রেডি মার্ক করুন" : "Mark Ready"}
                                  </button>
                                )}
                                {col.id === "ready" && (
                                  <>
                                    <button
                                      type="button"
                                      className="btn btn-xs btn-outline-success flex-grow-1"
                                      style={{ fontSize: "0.75rem" }}
                                      onClick={() => sendWhatsAppAlert(sale)}
                                      title="WhatsApp মেসেজ পাঠান"
                                    >
                                      💬 WA
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-xs btn-secondary flex-grow-1 text-white"
                                      style={{ fontSize: "0.75rem" }}
                                      onClick={() => updateStatus(sale.id, "delivered")}
                                    >
                                      📦 {lang === "bn" ? "ডেলিভার্ড" : "Deliver"}
                                    </button>
                                  </>
                                )}

                                <button
                                  type="button"
                                  className="btn btn-xs btn-light border px-2"
                                  style={{ fontSize: "0.75rem" }}
                                  title="টোকেন প্রিন্ট"
                                  onClick={() => setPrintSale(sale)}
                                >
                                  🖨️
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-xs btn-light border px-2"
                                  style={{ fontSize: "0.75rem" }}
                                  title="এডিট"
                                  onClick={() => {
                                    setEditingSale(sale);
                                    setEditStatus(sale.alteration_status);
                                    setEditTailor(sale.tailor_name || "");
                                    setEditDueDate(sale.alteration_due_date || "");
                                    setEditNotes(sale.alteration_notes || "");
                                  }}
                                >
                                  ✏️
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="card border-0 shadow-sm bg-white rounded-3 overflow-hidden">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light small text-secondary">
                  <tr>
                    <th>{lang === "bn" ? "চালান #" : "Invoice #"}</th>
                    <th>{lang === "bn" ? "গ্রাহক" : "Customer"}</th>
                    <th>{lang === "bn" ? "পোশাক ও ফিটিং নির্দেশনা" : "Garments & Fitting Note"}</th>
                    <th>{lang === "bn" ? "দর্জি / মাস্টার" : "Tailor"}</th>
                    <th>{lang === "bn" ? "ডেলিভারি তারিখ" : "Due Date"}</th>
                    <th>{lang === "bn" ? "চার্জ" : "Fee"}</th>
                    <th>{lang === "bn" ? "স্ট্যাটাস" : "Status"}</th>
                    <th className="text-end">{lang === "bn" ? "অ্যাকশন" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((sale) => {
                    const overdue = isOverdue(sale.alteration_due_date, sale.alteration_status);
                    return (
                      <tr key={sale.id}>
                        <td className="fw-bold font-monospace text-primary">#{sale.invoice_no}</td>
                        <td>
                          <div className="fw-semibold text-dark small">{sale.customer_name || "—"}</div>
                          {sale.customer_phone && <div className="text-secondary small">{sale.customer_phone}</div>}
                        </td>
                        <td>
                          <div className="fw-semibold text-dark small">{sale.alteration_notes}</div>
                          {sale.items && sale.items.length > 0 && (
                            <div className="text-muted small mt-0.5">
                              {sale.items.map((i) => i.product_name + (i.variation_name ? ` (${i.variation_name})` : "")).join(", ")}
                            </div>
                          )}
                        </td>
                        <td>{sale.tailor_name || "—"}</td>
                        <td>
                          {sale.alteration_due_date ? (
                            <span className={overdue ? "text-danger fw-bold small" : "small"}>
                              {sale.alteration_due_date} {overdue && "⚠️"}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="small">{Number(sale.alteration_charge) > 0 ? `৳${sale.alteration_charge}` : "—"}</td>
                        <td>{getStatusBadge(sale.alteration_status)}</td>
                        <td className="text-end">
                          <div className="d-flex justify-content-end gap-1">
                            {sale.alteration_status === "ready" && (
                              <button
                                type="button"
                                className="btn btn-xs btn-outline-success"
                                title="WhatsApp মেসেজ"
                                onClick={() => sendWhatsAppAlert(sale)}
                              >
                                💬 WA
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-xs btn-outline-secondary"
                              title="টোকেন প্রিন্ট"
                              onClick={() => setPrintSale(sale)}
                            >
                              🖨️
                            </button>
                            <button
                              type="button"
                              className="btn btn-xs btn-outline-primary"
                              title="এডিট"
                              onClick={() => {
                                setEditingSale(sale);
                                setEditStatus(sale.alteration_status);
                                setEditTailor(sale.tailor_name || "");
                                setEditDueDate(sale.alteration_due_date || "");
                                setEditNotes(sale.alteration_notes || "");
                              }}
                            >
                              ✏️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingSale && (
          <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1055 }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow-lg">
                <div className="modal-header py-2.5 bg-light border-0">
                  <h5 className="modal-title fs-6 fw-bold text-dark">
                    ✂️ {lang === "bn" ? `অল্টারেশন আপডেট (চালান #${editingSale.invoice_no})` : `Update Alteration (#${editingSale.invoice_no})`}
                  </h5>
                  <button type="button" className="btn-close" onClick={() => setEditingSale(null)} />
                </div>
                <div className="modal-body p-3">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-secondary mb-1">
                      {lang === "bn" ? "কাজের স্ট্যাটাস:" : "Alteration Status:"}
                    </label>
                    <select className="form-select form-select-sm" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                      <option value="pending">{lang === "bn" ? "অপেক্ষমান (Pending)" : "Pending"}</option>
                      <option value="in_progress">{lang === "bn" ? "চলমান (In Progress)" : "In Progress"}</option>
                      <option value="ready">{lang === "bn" ? "প্রস্তুত (Ready for Pickup)" : "Ready for Pickup"}</option>
                      <option value="delivered">{lang === "bn" ? "ডেলিভার্ড (Delivered)" : "Delivered"}</option>
                    </select>
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold text-secondary mb-1">
                        {lang === "bn" ? "দর্জি / মাস্টারের নাম:" : "Tailor / Master:"}
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={editTailor}
                        onChange={(e) => setEditTailor(e.target.value)}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold text-secondary mb-1">
                        {lang === "bn" ? "ডেলিভারির তারিখ:" : "Due Date:"}
                      </label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-secondary mb-1">
                      {lang === "bn" ? "ফিটিং নোট ও নির্দেশনা:" : "Fitting Instructions:"}
                    </label>
                    <textarea
                      rows={3}
                      className="form-control form-control-sm"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                    />
                  </div>
                </div>
                <div className="modal-footer py-2 border-0">
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEditingSale(null)}>
                    {lang === "bn" ? "বাতিল" : "Cancel"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary px-3"
                    disabled={savingEdit}
                    onClick={handleSaveEdit}
                  >
                    {savingEdit ? <span className="spinner-border spinner-border-sm" /> : lang === "bn" ? "সংরক্ষণ করুন" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Print Tailor Token Modal */}
        {printSale && (
          <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1055 }}>
            <div className="modal-dialog modal-sm modal-dialog-centered">
              <div className="modal-content border-0 shadow-lg">
                <div className="modal-header py-2 bg-light border-0">
                  <h6 className="modal-title fw-bold text-dark">✂️ {lang === "bn" ? "টেইলার টোকেন স্লিপ" : "Tailor Token Slip"}</h6>
                  <button type="button" className="btn-close" onClick={() => setPrintSale(null)} />
                </div>
                <div className="modal-body p-3 text-center" id="tailor-slip-print">
                  <div className="border border-dark p-2.5 rounded bg-white text-start" style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                    <div className="text-center fw-bold fs-6 mb-1">{user?.shop_name || "StockWhisk Fashion"}</div>
                    <div className="text-center small border-bottom pb-1 mb-2">✂️ টেইলারিং ও অল্টারেশন স্লিপ ✂️</div>
                    <div className="mb-1"><strong>চালান #:</strong> {printSale.invoice_no}</div>
                    <div className="mb-1"><strong>তারিখ:</strong> {printSale.sale_date ? new Date(printSale.sale_date).toLocaleDateString() : new Date().toLocaleDateString()}</div>
                    <div className="mb-1"><strong>গ্রাহক:</strong> {printSale.customer_name || "ওয়াক-ইন"}</div>
                    <div className="mb-1"><strong>ফোন:</strong> {printSale.customer_phone || "—"}</div>
                    <div className="mb-1"><strong>দর্জি / মাস্টার:</strong> {printSale.tailor_name || "অনির্দিষ্ট"}</div>
                    <div className="mb-2"><strong>ডেলিভারি তারিখ:</strong> {printSale.alteration_due_date || "—"}</div>
                    
                    <div className="border-top border-bottom py-1.5 my-1.5">
                      <div className="fw-bold mb-1">পোশাক বিবরণ:</div>
                      {printSale.items && printSale.items.map((it) => (
                        <div key={it.id}>• {it.product_name} {it.variation_name ? `(${it.variation_name})` : ""}</div>
                      ))}
                    </div>

                    <div className="bg-light p-2 rounded border my-2">
                      <div className="fw-bold">ফিটিং নির্দেশনা:</div>
                      <div className="mt-0.5">{printSale.alteration_notes}</div>
                    </div>

                    {Number(printSale.alteration_charge) > 0 && (
                      <div className="d-flex justify-content-between fw-bold mt-1">
                        <span>ফিটিং চার্জ:</span>
                        <span>৳{printSale.alteration_charge}</span>
                      </div>
                    )}
                    <div className="text-center mt-3 pt-1 border-top text-muted" style={{ fontSize: "0.7rem" }}>
                      StockWhisk Apparel Engine • কাস্টমার কপি বা কাপড়ে পিন করে রাখুন
                    </div>
                  </div>
                </div>
                <div className="modal-footer py-2 border-0">
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setPrintSale(null)}>
                    {lang === "bn" ? "বন্ধ করুন" : "Close"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      const printContents = document.getElementById("tailor-slip-print")?.innerHTML;
                      const win = window.open("", "_blank");
                      if (win && printContents) {
                        win.document.write(`<html><head><title>Tailor Slip #${printSale.invoice_no}</title><style>body{margin:10px;font-family:monospace;}</style></head><body>${printContents}</body></html>`);
                        win.document.close();
                        win.focus();
                        win.print();
                        win.close();
                      }
                    }}
                  >
                    🖨️ {lang === "bn" ? "প্রিন্ট করুন" : "Print"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModuleRouteGuard>
  );
}
