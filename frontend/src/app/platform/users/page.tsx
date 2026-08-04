"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { EmptyRow, ErrorState, PageHeader, Spinner } from "@/components/ui";

type Row = {
  id: number;
  name: string | null;
  email: string;
  shop_name: string | null;
  is_staff: boolean;
  role: string;
  online: boolean;
  last_seen: string | null;
};

function fmtSeen(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function ActiveUsersPage() {
  const [data, setData] = useState<{ users: Row[]; online_count: number } | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async (params: { q?: string; all?: boolean }) => {
    setData(null);
    try {
      const d = await api<{ users: Row[]; online_count: number }>("/platform/active-users/", {
        params: { q: params.q || undefined, all: params.all ? "1" : undefined },
      });
      setData(d);
    } catch (e: any) {
      setError(e?.message || "Failed to load users.");
    }
  }, []);

  useEffect(() => { load({}); }, [load]);

  return (
    <>
      <PageHeader title="Active Users" />
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <span className="badge rounded-pill text-bg-success">● {data?.online_count ?? 0} online now</span>
        <form
          className="d-flex gap-2"
          onSubmit={(e) => { e.preventDefault(); load({ q, all: showAll }); }}
        >
          <input className="form-control form-control-sm" placeholder="Search email…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn btn-brand btn-sm" type="submit">Search</button>
          <button
            type="button"
            className={`btn btn-sm ${showAll ? "btn-brand" : "btn-outline-brand"}`}
            onClick={() => { const n = !showAll; setShowAll(n); load({ q, all: n }); }}
          >
            {showAll ? "Online only" : "Show all"}
          </button>
        </form>
      </div>

      {error ? <ErrorState error={error} /> : !data ? <Spinner /> : (
        <div className="card shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="thead-1">
                <tr><th></th><th>Name</th><th>Email</th><th>Shop</th><th>Role</th><th>Status</th><th>Last seen</th></tr>
              </thead>
              <tbody>
                {data.users.length === 0 && <EmptyRow cols={7} text="No users." />}
                {data.users.map((u) => (
                  <tr key={u.id}>
                    <td><span className={`d-inline-block rounded-circle ${u.online ? "bg-success" : "bg-secondary"}`} style={{ width: 10, height: 10 }} /></td>
                    <td>{u.name || "—"}</td>
                    <td>{u.email}</td>
                    <td className={u.shop_name ? "" : "text-secondary"}>{u.shop_name || "Platform staff"}</td>
                    <td className="text-capitalize">{u.role}</td>
                    <td>{u.online ? <span className="text-success">Online</span> : <span className="text-secondary">Offline</span>}</td>
                    <td className="text-nowrap">{fmtSeen(u.last_seen)}</td>
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
