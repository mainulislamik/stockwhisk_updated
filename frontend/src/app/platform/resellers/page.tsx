"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { EmptyRow, ErrorState, PageHeader, Spinner } from "@/components/ui";

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

function fmtDate(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

export default function ResellersPage() {
  const [data, setData] = useState<{ resellers: ResellerRow[] } | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [busyAction, setBusyAction] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const load = useCallback(async () => {
    try {
      const d = await api<{ resellers: ResellerRow[] }>("/platform/resellers/");
      setData(d);
    } catch (e: any) {
      setError(e?.message || "Failed to load resellers.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAction(id: number, action: "approve" | "reject" | "suspend") {
    if (!confirm(`Are you sure you want to ${action} this reseller?`)) return;
    setBusyAction(id);
    try {
      const res = await api<{ status: string }>(`/platform/resellers/${id}/action/`, {
        method: "POST",
        body: { action }
      });
      // Update local state
      setData(prev => {
        if (!prev) return prev;
        return {
          resellers: prev.resellers.map(r => r.id === id ? { ...r, status: res.status } : r)
        };
      });
    } catch (e: any) {
      alert(e?.message || `Failed to ${action} reseller.`);
    } finally {
      setBusyAction(null);
    }
  }

  const filtered = data?.resellers.filter(r => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (q) {
      const search = q.toLowerCase();
      return r.user_email.toLowerCase().includes(search) || 
             r.user_name.toLowerCase().includes(search) ||
             (r.company_name && r.company_name.toLowerCase().includes(search));
    }
    return true;
  });

  return (
    <>
      <PageHeader title="Reseller Management" />
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <input 
          className="form-control form-control-sm" 
          style={{ width: "250px" }}
          placeholder="Search name, email, or company…" 
          value={q} 
          onChange={(e) => setQ(e.target.value)} 
        />
        <select 
          className="form-select form-select-sm" 
          style={{ width: "auto" }}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="rejected">Rejected</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {error ? <ErrorState error={error} /> : !data ? <Spinner /> : (
        <div className="card shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="thead-1">
                <tr>
                  <th>Code</th>
                  <th>Name & Contact</th>
                  <th>Company</th>
                  <th>Rate</th>
                  <th>Registered</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered && filtered.length === 0 && <EmptyRow cols={7} text="No resellers found." />}
                {filtered && filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.reseller_code ? <span className="badge bg-light text-dark font-monospace">{r.reseller_code}</span> : "—"}
                    </td>
                    <td>
                      <div className="fw-semibold">{r.user_name}</div>
                      <div className="small text-secondary">{r.user_email}</div>
                      {r.phone && <div className="small text-secondary">{r.phone}</div>}
                    </td>
                    <td>{r.company_name || "—"}</td>
                    <td>{r.commission_rate}%</td>
                    <td>{fmtDate(r.created_at)}</td>
                    <td>
                      {r.status === "pending" && <span className="badge text-bg-warning">Pending</span>}
                      {r.status === "active" && <span className="badge text-bg-success">Active</span>}
                      {r.status === "rejected" && <span className="badge text-bg-danger">Rejected</span>}
                      {r.status === "suspended" && <span className="badge text-bg-secondary">Suspended</span>}
                    </td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        {r.status === "pending" && (
                          <>
                            <button 
                              className="btn btn-outline-success" 
                              disabled={busyAction === r.id}
                              onClick={() => handleAction(r.id, "approve")}
                              title="Approve"
                            >
                              ✓ Approve
                            </button>
                            <button 
                              className="btn btn-outline-danger" 
                              disabled={busyAction === r.id}
                              onClick={() => handleAction(r.id, "reject")}
                              title="Reject"
                            >
                              ✗ Reject
                            </button>
                          </>
                        )}
                        {r.status === "active" && (
                          <button 
                            className="btn btn-outline-secondary" 
                            disabled={busyAction === r.id}
                            onClick={() => handleAction(r.id, "suspend")}
                            title="Suspend"
                          >
                            Suspend
                          </button>
                        )}
                        {r.status === "suspended" && (
                          <button 
                            className="btn btn-outline-success" 
                            disabled={busyAction === r.id}
                            onClick={() => handleAction(r.id, "approve")}
                            title="Re-activate"
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
