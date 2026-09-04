"use client";

import { useLanguage } from "@/contexts/LanguageContext";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";
import { EmptyRow, ErrorState, PageHeader, Spinner, money } from "@/components/ui";

type ResellerRow = {
  id: number;
  reseller_code: string | null;
  company_name: string | null;
  user_name: string;
  user_email: string;
  phone: string | null;
  status: string;
  commission_rate: string;
  created_at: string;
};

type ShopLine = { id: number; name: string; code: string; plan: string; is_active: boolean; attributed_at: string | null };
type Commission = {
  id: number; period: string; shop_name: string; gross_profit: string;
  commission_rate: string; commission_amount: string; status: string; paid_at: string | null;
};
type Detail = {
  id: number; reseller_code: string; referral_code: string; user_name: string; user_email: string;
  phone: string; company_name: string; address: string; country: string; commission_rate: string;
  status: string; notes: string; shops: ShopLine[]; commissions: Commission[];
  totals: { shops: number; total_earned: string; paid: string; unpaid: string };
  can_grant_free_shops: boolean; free_shop_quota: number;
};

function fmtDate(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

const STATUS_BADGE: Record<string, string> = {
  pending: "text-bg-warning", active: "text-bg-success",
  rejected: "text-bg-danger", suspended: "text-bg-secondary",
};
const COMM_BADGE: Record<string, string> = {
  pending: "text-bg-warning", approved: "text-bg-info",
  paid: "text-bg-success", cancelled: "text-bg-secondary",
};

export default function ResellersPage() {
  const { lang, t } = useLanguage();
  const [data, setData] = useState<{ resellers: ResellerRow[] } | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [busyAction, setBusyAction] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Detail / control modal
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rateInput, setRateInput] = useState("");
  const [savingRate, setSavingRate] = useState(false);
  const [freeEnabled, setFreeEnabled] = useState(false);
  const [freeQuota, setFreeQuota] = useState("0");
  const [savingFree, setSavingFree] = useState(false);
  const [busyComm, setBusyComm] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const load = useCallback(async () => {
    try {
      const d = await api<{ resellers: ResellerRow[] }>("/platform/resellers/");
      setData(d);
    } catch (e: any) {
      setError(e?.message || "Failed to load resellers.");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function openDetail(id: number) {
    setDetailLoading(true);
    setDetail(null);
    try {
      const d = await api<Detail>(`/platform/resellers/${id}/`);
      setDetail(d);
      setRateInput(String(d.commission_rate ?? ""));
      setFreeEnabled(!!d.can_grant_free_shops);
      setFreeQuota(String(d.free_shop_quota ?? 0));
    } catch (e: any) {
      alert(e?.message || "Failed to load reseller.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleAction(id: number, action: "approve" | "reject" | "suspend") {
    if (!confirm(`Are you sure you want to ${action} this reseller?`)) return;
    setBusyAction(id);
    try {
      const res = await api<{ status: string }>(`/platform/resellers/${id}/action/`, { method: "POST", body: { action } });
      setData(prev => prev ? { resellers: prev.resellers.map(r => r.id === id ? { ...r, status: res.status } : r) } : prev);
      setDetail(prev => prev && prev.id === id ? { ...prev, status: res.status } : prev);
    } catch (e: any) {
      alert(e?.message || `Failed to ${action} reseller.`);
    } finally {
      setBusyAction(null);
    }
  }

  async function saveRate() {
    if (!detail) return;
    const rate = Number(rateInput);
    if (isNaN(rate) || rate < 0 || rate > 100) { alert("Commission rate must be between 0 and 100."); return; }
    setSavingRate(true);
    try {
      const res = await api<{ commission_rate: string }>(`/platform/resellers/${detail.id}/`, {
        method: "PATCH", body: { commission_rate: rate },
      });
      setDetail(prev => prev ? { ...prev, commission_rate: res.commission_rate } : prev);
      setData(prev => prev ? { resellers: prev.resellers.map(r => r.id === detail.id ? { ...r, commission_rate: res.commission_rate } : r) } : prev);
    } catch (e: any) {
      alert(e?.message || "Failed to update rate.");
    } finally {
      setSavingRate(false);
    }
  }

  async function saveFreeShops() {
    if (!detail) return;
    const quota = Math.max(0, Math.round(Number(freeQuota) || 0));
    setSavingFree(true);
    try {
      const res = await api<{ can_grant_free_shops: boolean; free_shop_quota: number }>(`/platform/resellers/${detail.id}/`, {
        method: "PATCH", body: { can_grant_free_shops: freeEnabled, free_shop_quota: quota },
      });
      setDetail(prev => prev ? { ...prev, can_grant_free_shops: res.can_grant_free_shops, free_shop_quota: res.free_shop_quota } : prev);
      setFreeQuota(String(res.free_shop_quota));
    } catch (e: any) {
      alert(e?.message || "Failed to save free-shop settings.");
    } finally {
      setSavingFree(false);
    }
  }

  async function commissionAction(cid: number, action: "approve" | "paid" | "cancel") {
    let payment_reference = "";
    if (action === "paid") {
      const ref = prompt("Payment reference (optional):", "");
      if (ref === null) return; // cancelled
      payment_reference = ref;
    } else if (!confirm(`Mark this commission as ${action}?`)) return;
    setBusyComm(cid);
    try {
      const res = await api<{ status: string }>(`/platform/commissions/${cid}/action/`, {
        method: "POST", body: { action, payment_reference },
      });
      setDetail(prev => prev ? {
        ...prev,
        commissions: prev.commissions.map(c => c.id === cid ? { ...c, status: res.status } : c),
      } : prev);
    } catch (e: any) {
      alert(e?.message || "Failed to update commission.");
    } finally {
      setBusyComm(null);
    }
  }

  const filtered = data?.resellers.filter(r => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (q) {
      const s = q.toLowerCase();
      return r.user_email.toLowerCase().includes(s) || r.user_name.toLowerCase().includes(s) ||
             (r.company_name && r.company_name.toLowerCase().includes(s));
    }
    return true;
  });

  return (
    <>
      <PageHeader title="Reseller Management" />
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <input className="form-control form-control-sm" style={{ width: "250px" }}
          placeholder={lang === "bn" ? "নাম, ইমেইল বা কোম্পানি দিয়ে খুঁজুন…" : "Search name, email, or company…"} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="form-select form-select-sm" style={{ width: "auto" }}
          value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">setStatus</option>
          <option value="pending">{lang === "bn" ? "অপেক্ষমাণ (Pending)" : "Pending"}</option>
          <option value="active">{lang === "bn" ? "সক্রিয় (Active)" : "Active"}</option>
          <option value="rejected">{lang === "bn" ? "বাতিল (Rejected)" : "Rejected"}</option>
          <option value="suspended">{lang === "bn" ? "স্থগিত (Suspended)" : "Suspended"}</option>
        </select>
      </div>

      {error ? <ErrorState error={error} /> : !data ? <Spinner /> : (
        <div className="card shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="thead-1">
                <tr>
                  <th>{lang === "bn" ? "কোড" : "Code"}</th><th>Name & Contact</th><th>{lang === "bn" ? "কোম্পানি" : "Company"}</th><th>Rate</th>
                  <th>Registered</th><th>setStatus</th><th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered && filtered.length === 0 && <EmptyRow cols={7} text="No resellers found." />}
                {filtered && filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{r.reseller_code ? <span className="badge bg-light text-dark font-monospace">{r.reseller_code}</span> : "—"}</td>
                    <td>
                      <div className="fw-semibold">{r.user_name}</div>
                      <div className="small text-secondary">{r.user_email}</div>
                      {r.phone && <div className="small text-secondary">{r.phone}</div>}
                    </td>
                    <td>{r.company_name || "—"}</td>
                    <td>{r.commission_rate}%</td>
                    <td>{fmtDate(r.created_at)}</td>
                    <td><span className={`badge ${STATUS_BADGE[r.status] || "text-bg-light"}`}>{r.status}</span></td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        {r.status === "pending" && (
                          <>
                            <button className="btn btn-outline-success" disabled={busyAction === r.id} onClick={() => handleAction(r.id, "approve")}>✓ Approve</button>
                            <button className="btn btn-outline-danger" disabled={busyAction === r.id} onClick={() => handleAction(r.id, "reject")}>✗ Reject</button>
                          </>
                        )}
                        {r.status === "active" && (
                          <button className="btn btn-outline-secondary" disabled={busyAction === r.id} onClick={() => handleAction(r.id, "suspend")}>Suspend</button>
                        )}
                        {r.status === "suspended" && (
                          <button className="btn btn-outline-success" disabled={busyAction === r.id} onClick={() => handleAction(r.id, "approve")}>Activate</button>
                        )}
                        <button className="btn btn-primary" onClick={() => openDetail(r.id)}>Manage</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Detail / control modal ── */}
      {(detailLoading || detail) && mounted && createPortal(
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-start"
          style={{ zIndex: 100000, background: "rgba(0,0,0,.5)", overflowY: "auto", padding: "3vh 1rem" }}
          onClick={() => { setDetail(null); }}>
          <div className="bg-body rounded-4 shadow-lg w-100" style={{ maxWidth: 860 }} onClick={(e) => e.stopPropagation()}>
            {detailLoading || !detail ? (
              <div className="p-5 text-center"><Spinner /></div>
            ) : (
              <div className="p-4">
                {/* Header */}
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <div className="d-flex align-items-center gap-2">
                      <h4 className="fw-bold mb-0">{detail.user_name}</h4>
                      <span className={`badge ${STATUS_BADGE[detail.status] || "text-bg-light"}`}>{detail.status}</span>
                    </div>
                    <div className="small text-secondary">
                      <span className="font-monospace">{detail.reseller_code}</span> · {detail.user_email}{detail.phone ? ` · ${detail.phone}` : ""}
                    </div>
                    {detail.company_name && <div className="small text-secondary">{detail.company_name}{detail.country ? `, ${detail.country}` : ""}</div>}
                  </div>
                  <button className="btn-close" onClick={() => setDetail(null)} />
                </div>

                {/* Status controls */}
                <div className="d-flex flex-wrap gap-2 mb-3">
                  {detail.status === "pending" && (
                    <>
                      <button className="btn btn-sm btn-success" disabled={busyAction === detail.id} onClick={() => handleAction(detail.id, "approve")}>✓ Approve</button>
                      <button className="btn btn-sm btn-outline-danger" disabled={busyAction === detail.id} onClick={() => handleAction(detail.id, "reject")}>✗ Reject</button>
                    </>
                  )}
                  {detail.status === "active" && (
                    <button className="btn btn-sm btn-outline-secondary" disabled={busyAction === detail.id} onClick={() => handleAction(detail.id, "suspend")}>Suspend</button>
                  )}
                  {detail.status === "suspended" && (
                    <button className="btn btn-sm btn-success" disabled={busyAction === detail.id} onClick={() => handleAction(detail.id, "approve")}>Re-activate</button>
                  )}
                </div>

                {/* Commission rate + summary */}
                <div className="row g-3 mb-3">
                  <div className="col-md-4">
                    <label className="small text-secondary">Commission rate (%)</label>
                    <div className="input-group input-group-sm">
                      <input type="number" min={0} max={100} step="0.5" className="form-control"
                        value={rateInput} onChange={(e) => setRateInput(e.target.value)} />
                      <span className="input-group-text">%</span>
                      <button className="btn btn-primary" disabled={savingRate || rateInput === String(detail.commission_rate)} onClick={saveRate}>
                        {savingRate ? "…" : "Save"}
                      </button>
                    </div>
                    <div className="small text-secondary mt-1">Based on gross profit of paying shops.</div>
                  </div>
                  <div className="col-md-8">
                    <div className="row g-2 text-center">
                      <div className="col"><div className="border rounded p-2"><div className="fs-5 fw-bold">{detail.totals.shops}</div><div className="small text-secondary">Shops</div></div></div>
                      <div className="col"><div className="border rounded p-2"><div className="fs-6 fw-bold">{money(detail.totals.total_earned)}</div><div className="small text-secondary">Earned</div></div></div>
                      <div className="col"><div className="border rounded p-2"><div className="fs-6 fw-bold text-success">{money(detail.totals.paid)}</div><div className="small text-secondary">Paid</div></div></div>
                      <div className="col"><div className="border rounded p-2"><div className="fs-6 fw-bold text-warning">{money(detail.totals.unpaid)}</div><div className="small text-secondary">Unpaid</div></div></div>
                    </div>
                  </div>
                </div>

                {/* Free-shop grants (super-admin gated) */}
                <div className="border rounded-3 p-3 mb-3" style={{ background: "var(--sidebar-hover)" }}>
                  <div className="d-flex flex-wrap align-items-center gap-3">
                    <div className="form-check form-switch mb-0">
                      <input className="form-check-input" type="checkbox" role="switch" id="freeShopSwitch"
                        checked={freeEnabled} onChange={(e) => setFreeEnabled(e.target.checked)} />
                      <label className="form-check-label fw-semibold" htmlFor="freeShopSwitch">Allow lifetime-free shops</label>
                    </div>
                    <div className="input-group input-group-sm" style={{ width: 200 }}>
                      <span className="input-group-text">Quota</span>
                      <input type="number" min={0} step={1} className="form-control" value={freeQuota}
                        disabled={!freeEnabled} onChange={(e) => setFreeQuota(e.target.value)} />
                    </div>
                    <button className="btn btn-sm btn-primary"
                      disabled={savingFree || (freeEnabled === detail.can_grant_free_shops && String(freeQuota) === String(detail.free_shop_quota))}
                      onClick={saveFreeShops}>
                      {savingFree ? "…" : "Save"}
                    </button>
                  </div>
                  <div className="small text-secondary mt-1">
                    When enabled, this reseller can sign up up to <b>{freeQuota || 0}</b> shop(s) that are free for life. If the reseller is suspended or removed, those shops keep working but must start paying — they are never deleted.
                  </div>
                </div>

                {/* Referred shops */}
                <div className="fw-semibold mb-1">Referred shops ({detail.shops.length})</div>
                <div className="table-responsive mb-3" style={{ maxHeight: 180 }}>
                  <table className="table table-sm mb-0">
                    <thead><tr className="small text-secondary"><th>Shop</th><th>Plan</th><th>setStatus</th><th>Since</th></tr></thead>
                    <tbody>
                      {detail.shops.length === 0 ? <tr><td colSpan={4} className="text-secondary small">No referred shops yet.</td></tr> :
                        detail.shops.map(s => (
                          <tr key={s.id}>
                            <td className="fw-medium">{s.name}</td>
                            <td>{s.plan || "—"}</td>
                            <td><span className={`badge ${s.is_active ? "text-bg-success" : "text-bg-secondary"}`}>{s.is_active ? "active" : "suspended"}</span></td>
                            <td className="small text-secondary">{fmtDate(s.attributed_at)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Commissions / payouts */}
                <div className="fw-semibold mb-1">Commissions & payouts</div>
                <div className="table-responsive" style={{ maxHeight: 260 }}>
                  <table className="table table-sm align-middle mb-0">
                    <thead><tr className="small text-secondary"><th>Period</th><th>Shop</th><th className="text-end">Gross profit</th><th className="text-end">Amount</th><th>setStatus</th><th className="text-end">Action</th></tr></thead>
                    <tbody>
                      {detail.commissions.length === 0 ? <tr><td colSpan={6} className="text-secondary small">No commissions recorded.</td></tr> :
                        detail.commissions.map(c => (
                          <tr key={c.id}>
                            <td className="font-monospace small">{c.period}</td>
                            <td>{c.shop_name || "—"}</td>
                            <td className="text-end">{money(c.gross_profit)}</td>
                            <td className="text-end fw-semibold">{money(c.commission_amount)}</td>
                            <td><span className={`badge ${COMM_BADGE[c.status] || "text-bg-light"}`}>{c.status}</span></td>
                            <td className="text-end">
                              <div className="btn-group btn-group-sm">
                                {c.status === "pending" && (
                                  <button className="btn btn-outline-info" disabled={busyComm === c.id} onClick={() => commissionAction(c.id, "approve")}>Approve</button>
                                )}
                                {(c.status === "pending" || c.status === "approved") && (
                                  <>
                                    <button className="btn btn-outline-success" disabled={busyComm === c.id} onClick={() => commissionAction(c.id, "paid")}>Mark paid</button>
                                    <button className="btn btn-outline-danger" disabled={busyComm === c.id} onClick={() => commissionAction(c.id, "cancel")}>Cancel</button>
                                  </>
                                )}
                                {c.status === "paid" && <span className="small text-success">✓ paid</span>}
                                {c.status === "cancelled" && <span className="small text-secondary">—</span>}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
