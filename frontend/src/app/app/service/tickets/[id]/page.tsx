"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { ErrorState, Spinner, money, fmtDate } from "@/components/ui";
import toast from "react-hot-toast";

type Part = { id: number; product_name: string; quantity: string; unit_cost: string };
type History = { id: number; from_status: string; to_status: string; note: string; created_at: string };
type Ticket = {
  id: number;
  ticket_no: string;
  device_description: string;
  complaint: string;
  status: string;
  service_charge: string;
  received_at: string;
  estimated_delivery: string | null;
  is_overdue: boolean;
  parts: Part[];
  history: History[];
};

const STATUSES = ["received", "diagnosing", "awaiting_parts", "in_repair", "ready_for_pickup", "delivered", "cancelled"];

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function load() {
    try {
      const t = await api<Ticket>(`/service/tickets/${id}/`);
      setTicket(t);
      setStatus(t.status);
    } catch (e: any) {
      setError(e?.message || "Failed to load ticket");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [id]);

  async function changeStatus() {
    try {
      await api(`/service/tickets/${id}/change_status/`, { method: "POST", body: { status } });
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Could not change status");
    }
  }

  if (loading) return <Spinner label="Loading ticket…" />;
  if (error) return <ErrorState error={error} />;
  if (!ticket) return null;

  return (
    <div className="vstack gap-3">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div>
          <h1 className="h4 fw-bold text-brand mb-0">Ticket {ticket.ticket_no || `#${ticket.id}`}</h1>
          <div className="text-secondary small">
            {ticket.device_description} · received {fmtDate(ticket.received_at)}
          </div>
        </div>
        <Link href="/app/service/tickets" className="btn btn-light btn-sm">
          Back
        </Link>
      </div>

      <div className="row g-3">
        <div className="col-lg-7">
          <div className="card shadow-sm">
            <div className="card-body">
              <div className="fw-semibold mb-2">Complaint</div>
              <p className="mb-3">{ticket.complaint}</p>
              <div className="fw-semibold mb-2">Parts used</div>
              {ticket.parts.length === 0 ? (
                <div className="text-secondary small">No parts.</div>
              ) : (
                <table className="table table-sm mb-0">
                  <tbody>
                    {ticket.parts.map((p) => (
                      <tr key={p.id}>
                        <td>{p.product_name}</td>
                        <td className="text-end">{p.quantity}</td>
                        <td className="text-end">{money(p.unit_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="card shadow-sm">
            <div className="card-body">
              <div className="fw-semibold mb-2">Status</div>
              <div className="input-group input-group-sm mb-3">
                <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <button className="btn btn-brand" onClick={changeStatus}>
                  Update
                </button>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-secondary">Service charge</span>
                <span>{money(ticket.service_charge)}</span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-secondary">Est. delivery</span>
                <span>{fmtDate(ticket.estimated_delivery)}</span>
              </div>

              <div className="fw-semibold mt-3 mb-2">History</div>
              {ticket.history.length === 0 ? (
                <div className="text-secondary small">No status changes.</div>
              ) : (
                <ul className="list-unstyled small mb-0">
                  {ticket.history.map((h) => (
                    <li key={h.id} className="border-bottom py-1">
                      <span className="text-secondary">{fmtDate(h.created_at)}</span> — {h.from_status || "—"} → <b>{h.to_status}</b>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
