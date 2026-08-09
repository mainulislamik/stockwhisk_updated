"use client";
import toast from "react-hot-toast";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Card, ErrorState, PageHeader, Spinner } from "@/components/ui";

type Field = { name: string; label: string; required: boolean; kind: string };
type Column = { index: number; header: string };
type Job = {
  id: string;
  shop_name: string;
  import_type_display: string;
  status: string;
  status_display: string;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  created_count: number;
  updated_count: number;
  error_summary: string;
  fields: Field[];
  columns: Column[];
  mapping: Record<string, number>;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export default function ImportWizardPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try { setJob(await api<Job>(`/platform/imports/jobs/${id}/`)); }
    catch (e: any) { setError(e?.message || "Failed to load job."); }
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  if (error) return <ErrorState error={error} />;
  if (!job) return <Spinner />;

  const mappingStep = ["uploaded", "mapping", "failed"].includes(job.status);

  return (
    <>
      <PageHeader
        title={`Import — ${job.import_type_display} → ${job.shop_name}`}
        subtitle={`Status: ${job.status_display}`}
        actions={<Link href="/platform/imports" className="btn btn-outline-brand btn-sm">← All imports</Link>}
      />
      {job.status === "failed" && job.error_summary && (
        <div className="alert alert-danger">Import failed: {job.error_summary}</div>
      )}
      {mappingStep && <MappingStep job={job} onDone={reload} />}
      {job.status === "preview_ready" && <PreviewStep job={job} onDone={reload} />}
      {job.status === "committed" && <CommittedStep job={job} onDone={reload} />}
      {job.status === "rolled_back" && (
        <Card><div className="text-secondary">This import was rolled back. No live data remains from it.</div></Card>
      )}
    </>
  );
}

function MappingStep({ job, onDone }: { job: Job; onDone: () => void }) {
  const [map, setMap] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    job.fields.forEach((f) => { m[f.name] = job.mapping[f.name] != null ? String(job.mapping[f.name]) : ""; });
    return m;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setErr("");
    setBusy(true);
    try {
      const mapping: Record<string, number> = {};
      Object.entries(map).forEach(([k, v]) => { if (v !== "") mapping[k] = Number(v); });
      await api(`/platform/imports/jobs/${job.id}/map/`, { method: "POST", body: { mapping } });
      onDone();
    } catch (e: any) {
      setErr(e?.data?.detail || e?.message || "Validation failed.");
      setBusy(false);
    }
  }

  return (
    <Card>
      <p className="text-secondary small">Step 2 — match each platform field to a column in your file. Only mapped columns are read.</p>
      {err && <ErrorState error={err} />}
      <div className="table-responsive">
        <table className="table align-middle">
          <thead className="thead-2"><tr><th>Platform field</th><th>Source column</th></tr></thead>
          <tbody>
            {job.fields.map((f) => (
              <tr key={f.name}>
                <td>{f.label} {f.required ? <span className="text-danger">*</span> : <span className="text-secondary small">(optional)</span>}</td>
                <td>
                  <select className="form-select" value={map[f.name] ?? ""} onChange={(e) => setMap((m) => ({ ...m, [f.name]: e.target.value }))}>
                    <option value="">— skip —</option>
                    {job.columns.map((c) => <option key={c.index} value={c.index}>{c.header} (Column {c.index + 1})</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="d-flex justify-content-end">
        <button className="btn btn-brand" disabled={busy} onClick={submit}>Validate &amp; preview →</button>
      </div>
      <div className="text-danger small mt-2">* required fields must be mapped before you can continue.</div>
    </Card>
  );
}

type Row = { row_number: number; status: string; errors: string[]; cleaned: Record<string, any> };

function PreviewStep({ job, onDone }: { job: Job; onDone: () => void }) {
  const [only, setOnly] = useState<string>("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [skipErrors, setSkipErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const loadRows = useCallback(async (o: string) => {
    setRows(null);
    const d = await api<{ rows: Row[] }>(`/platform/imports/jobs/${job.id}/rows/`, { params: { only: o || undefined } });
    setRows(d.rows);
  }, [job.id]);

  useEffect(() => { loadRows(only); }, [loadRows, only]);

  async function commit() {
    setErr("");
    setBusy(true);
    try {
      await api(`/platform/imports/jobs/${job.id}/commit/`, { method: "POST", body: { skip_errors: skipErrors } });
      onDone();
    } catch (e: any) {
      setErr(e?.data?.detail || e?.message || "Commit failed.");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="row g-3 mb-3">
        <div className="col-4"><Card><div className="text-secondary small">Total rows</div><div className="fs-4 fw-bold">{job.total_rows}</div></Card></div>
        <div className="col-4"><Card><div className="text-secondary small">Valid</div><div className="fs-4 fw-bold text-success">{job.valid_rows}</div></Card></div>
        <div className="col-4"><Card><div className="text-secondary small">Errors</div><div className="fs-4 fw-bold text-danger">{job.error_rows}</div></Card></div>
      </div>

      {err && <ErrorState error={err} />}

      <Card className="mb-3">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div className="btn-group btn-group-sm">
            {[["", "All"], ["errors", "Errors"], ["warnings", "Warnings"]].map(([v, l]) => (
              <button key={v} className={`btn ${only === v ? "btn-brand" : "btn-outline-brand"}`} onClick={() => setOnly(v)}>{l}</button>
            ))}
          </div>
          <div className="d-flex align-items-center gap-3">
            {job.error_rows > 0 && (
              <label className="form-check-label small">
                <input type="checkbox" className="form-check-input me-1" checked={skipErrors} onChange={(e) => setSkipErrors(e.target.checked)} />
                skip {job.error_rows} error row(s)
              </label>
            )}
            <button className="btn btn-brand btn-sm" disabled={busy || (job.error_rows > 0 && !skipErrors)} onClick={commit}>Commit import</button>
          </div>
        </div>
      </Card>

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead className="thead-3">
              <tr><th>#</th><th>Status</th>{job.fields.map((f) => <th key={f.name}>{f.label}</th>)}<th>Messages</th></tr>
            </thead>
            <tbody>
              {!rows && <tr><td colSpan={job.fields.length + 3}><Spinner /></td></tr>}
              {rows && rows.length === 0 && <tr><td colSpan={job.fields.length + 3} className="text-center text-secondary py-4">No rows.</td></tr>}
              {rows && rows.map((r) => (
                <tr key={r.row_number} className={r.status === "error" ? "table-danger" : ""}>
                  <td>{r.row_number}</td>
                  <td className="small">{r.status}</td>
                  {job.fields.map((f) => <td key={f.name} className="small">{String(r.cleaned[f.name] ?? "")}</td>)}
                  <td className="small text-danger">{(r.errors || []).join("; ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function CommittedStep({ job, onDone }: { job: Job; onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  async function downloadReport() {
    const res = await api<Response>(`/platform/imports/jobs/${job.id}/report/`, { raw: true });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `import_${job.id}_report.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function rollback() {
    if (!confirm("Roll back this import? Created records are deleted and updated records restored.")) return;
    setBusy(true);
    try {
      await api(`/platform/imports/jobs/${job.id}/rollback/`, { method: "POST" });
      onDone();
    } catch (e: any) {
      toast.error(e?.data?.detail || e?.message || "Rollback failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="alert alert-success">
        Import committed — <strong>{job.created_count}</strong> created, <strong>{job.updated_count}</strong> updated.
      </div>
      <div className="d-flex gap-2">
        <button className="btn btn-outline-brand" onClick={downloadReport}>⬇ Download report (CSV)</button>
        <button className="btn btn-outline-danger" disabled={busy} onClick={rollback}>Roll back import</button>
      </div>
    </Card>
  );
}
