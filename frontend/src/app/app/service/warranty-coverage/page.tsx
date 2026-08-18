"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, ErrorState, Spinner } from "@/components/ui";
import { useLanguage } from "@/contexts/LanguageContext";

type Dash = {
  open_by_status: { status: string; n: number }[];
  overdue_tickets: number;
  technician_workload: { technician__email: string; n: number }[];
  warranties_expiring_soon: number;
};

export default function WarrantyCoveragePage() {
  const { t } = useLanguage();
  const [data, setData] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setData(await api<Dash>("/service/dashboard/"));
      } catch (e: any) {
        setError(e?.message || t("wcov_err_load"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Spinner label={t("wcov_loading")} />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  const openTotal = data.open_by_status.reduce((s, r) => s + r.n, 0);

  return (
    <div className="vstack gap-3">
      <div className="row g-3">
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">{t("wcov_open_tickets")}</div>
            <div className="fs-4 fw-bold">{openTotal}</div>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">{t("wcov_overdue")}</div>
            <div className="fs-4 fw-bold text-danger">{data.overdue_tickets}</div>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">{t("wcov_expiring")}</div>
            <div className="fs-4 fw-bold text-warning">{data.warranties_expiring_soon}</div>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card>
            <div className="small text-secondary">{t("wcov_techs")}</div>
            <div className="fs-4 fw-bold">{data.technician_workload.length}</div>
          </Card>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card shadow-sm">
            <div className="card-body">
              <div className="fw-semibold mb-3">{t("wcov_open_status")}</div>
              <table className="table table-sm mb-0">
                <tbody>
                  {data.open_by_status.length === 0 ? (
                    <tr>
                      <td className="text-secondary">{t("wcov_no_open")}</td>
                    </tr>
                  ) : (
                    data.open_by_status.map((r) => (
                      <tr key={r.status}>
                        <td className="text-capitalize">{r.status.replace(/_/g, " ")}</td>
                        <td className="text-end">{r.n}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card shadow-sm">
            <div className="card-body">
              <div className="fw-semibold mb-3">{t("wcov_workload")}</div>
              <table className="table table-sm mb-0">
                <tbody>
                  {data.technician_workload.length === 0 ? (
                    <tr>
                      <td className="text-secondary">{t("wcov_no_techs")}</td>
                    </tr>
                  ) : (
                    data.technician_workload.map((r, i) => (
                      <tr key={i}>
                        <td>{r.technician__email}</td>
                        <td className="text-end">{r.n}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
