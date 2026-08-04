"use client";

import { useAuth } from "@/components/AuthProvider";
import { Card } from "@/components/ui";
import { fmtDate } from "@/components/ui";

export default function SettingsPage() {
  const { user, billing, isOwner } = useAuth();

  return (
    <div className="vstack gap-3" style={{ maxWidth: "48rem" }}>
      <h1 className="h4 fw-bold text-brand mb-0">Settings</h1>

      <div className="card shadow-sm">
        <div className="card-body">
          <div className="fw-semibold mb-3">Your account</div>
          <table className="table table-sm mb-0">
            <tbody>
              <tr>
                <td className="text-secondary" style={{ width: "12rem" }}>
                  Email
                </td>
                <td>{user?.email}</td>
              </tr>
              <tr>
                <td className="text-secondary">Name</td>
                <td>{[user?.first_name, user?.last_name].filter(Boolean).join(" ") || "—"}</td>
              </tr>
              <tr>
                <td className="text-secondary">Phone</td>
                <td>{user?.phone || "—"}</td>
              </tr>
              <tr>
                <td className="text-secondary">Role</td>
                <td className="text-capitalize">{user?.role}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-md-6">
          <Card>
            <div className="small text-secondary">Current plan</div>
            <div className="fs-5 fw-bold text-capitalize">{billing?.plan || "—"}</div>
          </Card>
        </div>
        <div className="col-md-6">
          <Card>
            <div className="small text-secondary">Subscription status</div>
            <div className="fs-5 fw-bold">
              {billing?.on_trial ? "Trial" : billing?.status || "—"}
              {billing?.trial_ends_at && <span className="small text-secondary ms-2">ends {fmtDate(billing.trial_ends_at)}</span>}
            </div>
          </Card>
        </div>
      </div>

      {isOwner && (
        <div className="alert alert-info mb-0">
          Shop-wide settings (name, currency, invoice options, tax) are managed by the shop owner. Advanced configuration is available in the Django admin on the backend.
        </div>
      )}
    </div>
  );
}
