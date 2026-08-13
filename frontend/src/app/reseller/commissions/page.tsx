"use client";

import { useEffect, useState } from "react";
import ResellerShell from "@/components/ResellerShell";
import { api } from "@/lib/api";

type Commission = { id: number; period: string; shop_name: string; gross_profit: string; commission_rate: string; commission_amount: string; status: string; paid_at: string | null };

const tk = (n: any) => "৳" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const badge: Record<string, string> = { pending: "text-bg-secondary", approved: "text-bg-info", paid: "text-bg-success", cancelled: "text-bg-dark" };

export default function ResellerCommissionsPage() {
  const [rows, setRows] = useState<Commission[] | null>(null);
  useEffect(() => { api<Commission[]>("/reseller/commissions/").then(setRows).catch(() => setRows([])); }, []);

  return (
    <ResellerShell>
      <h3 className="fw-bold mb-4">Commissions</h3>
      <div className="card shadow-sm border-0">
        <div className="table-responsive">
          <table className="table table-striped align-middle mb-0">
            <thead className="table-light"><tr>
              <th>Period</th><th>Shop</th><th className="text-end">Gross profit</th><th className="text-end">Rate</th><th className="text-end">Commission</th><th>Status</th>
            </tr></thead>
            <tbody>
              {!rows ? (<tr><td colSpan={6} className="text-center py-4"><span className="spinner-border spinner-border-sm" /></td></tr>)
                : rows.length === 0 ? (<tr><td colSpan={6} className="text-center text-secondary py-5">No commissions yet. They’re generated monthly per connected shop.</td></tr>)
                : rows.map((c) => (
                  <tr key={c.id}>
                    <td className="fw-medium">{c.period}</td>
                    <td>{c.shop_name}</td>
                    <td className="text-end">{tk(c.gross_profit)}</td>
                    <td className="text-end">{c.commission_rate}%</td>
                    <td className="text-end fw-semibold">{tk(c.commission_amount)}</td>
                    <td><span className={`badge ${badge[c.status] || "text-bg-light"}`}>{c.status}</span></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </ResellerShell>
  );
}
