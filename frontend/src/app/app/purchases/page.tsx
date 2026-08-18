"use client";

import { useEffect, useState } from "react";
import { api, fetchAll } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { ErrorState, Pagination, Spinner, money, fmtDate, usePagination } from "@/components/ui";
import toast from "react-hot-toast";
import { useLanguage } from "@/contexts/LanguageContext";

type PO = {
  id: number;
  po_number: string;
  supplier_name: string;
  status: string;
  order_date: string;
  total: string;
  paid: string;
  due: string;
};

const statusBadge: Record<string, string> = {
  RECEIVED: "text-bg-success",
  PARTIAL: "text-bg-warning",
  DRAFT: "text-bg-secondary",
  ORDERED: "text-bg-info",
};

export default function PurchasesPage() {
  const { t } = useLanguage();
  const { can, isOwner } = useAuth();
  const canManage = isOwner || can("manage_purchasing");
  const [rows, setRows] = useState<PO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      setRows(await fetchAll<PO>("/purchasing/purchase-orders/"));
    } catch (e: any) {
      setError(e?.message || t("po_err_load"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function receive(po: PO) {
    const paid = prompt(t("po_prompt_receive", { po: po.po_number }), po.total);
    if (paid === null) return;
    try {
      await api(`/purchasing/purchase-orders/${po.id}/receive/`, { method: "POST", body: { paid: Number(paid) || 0 } });
      await load();
    } catch (e: any) {
      toast.error(e?.message || t("po_err_receive"));
    }
  }

  const { paged, page, setPage, totalPages, total } = usePagination(rows);

  if (loading) return <Spinner label={t("po_loading")} />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="vstack gap-3">
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-striped table-sm align-middle mb-0">
            <thead className="thead-4">
              <tr>
                <th>{t("po_col_po")}</th>
                <th>{t("po_col_supplier")}</th>
                <th>{t("po_col_date")}</th>
                <th className="text-end">{t("po_col_total")}</th>
                <th className="text-end">{t("po_col_paid")}</th>
                <th className="text-end">{t("po_col_due")}</th>
                <th>{t("po_col_status")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr data-empty="">
                  <td colSpan={8} className="text-center text-secondary py-5">
                    <div style={{ fontSize: "2.5rem" }}>📥</div>
                    {t("po_no_orders")}
                  </td>
                </tr>
              ) : (
                paged.map((po) => (
                  <tr key={po.id}>
                    <td className="fw-medium">{po.po_number || `#${po.id}`}</td>
                    <td className="text-secondary">{po.supplier_name}</td>
                    <td className="text-secondary">{fmtDate(po.order_date)}</td>
                    <td className="text-end">{money(po.total)}</td>
                    <td className="text-end">{money(po.paid)}</td>
                    <td className={`text-end ${Number(po.due) > 0 ? "text-danger fw-semibold" : ""}`}>{money(po.due)}</td>
                    <td>
                      <span className={`badge ${statusBadge[po.status] || "text-bg-light"}`}>{po.status}</span>
                    </td>
                    <td className="text-end">
                      {canManage && po.status !== "RECEIVED" && (
                        <button className="btn btn-sm btn-outline-brand py-0" onClick={() => receive(po)}>
                          {t("po_btn_receive")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} setPage={setPage} total={total} />
      </div>
    </div>
  );
}
