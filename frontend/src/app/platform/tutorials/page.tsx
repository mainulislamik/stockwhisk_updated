"use client";

import { confirmAction, showError, showSuccess, showInfo } from "@/lib/dialogs";

import { useCallback, useEffect, useState } from "react";
import { api, fetchAll } from "@/lib/api";
import { Card, EmptyRow, ErrorState, PageHeader, Spinner } from "@/components/ui";
import toast from "react-hot-toast";

type Video = {
  id: number;
  title: string;
  youtube_url: string;
  sequence: number;
  is_active: boolean;
  target_audience: "both" | "shop" | "reseller";
  thumbnail_url: string;
  embed_url: string;
};

export default function TutorialsPage() {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", youtube_url: "", sequence: "", target_audience: "both" as "both" | "shop" | "reseller" });
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Video | null>(null);
  const [playing, setPlaying] = useState<Video | null>(null);

  const load = useCallback(async () => {
    try { setVideos(await fetchAll<Video>("/platform/tutorials/")); }
    catch (e: any) { setError(e?.message || "Failed to load tutorials."); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/platform/tutorials/", {
        method: "POST",
        body: { title: form.title, youtube_url: form.youtube_url, sequence: form.sequence ? Number(form.sequence) : 0, is_active: true, target_audience: form.target_audience },
      });
      setForm({ title: "", youtube_url: "", sequence: "", target_audience: "both" });
      await load();
    } catch (e: any) {
      toast.error(e?.data?.youtube_url || e?.data?.detail || e?.message || "Could not add video.");
    } finally { setBusy(false); }
  }

  async function saveEdit() {
    if (!editing) return;
    try {
      await api(`/platform/tutorials/${editing.id}/`, {
        method: "PATCH",
        body: { title: editing.title, youtube_url: editing.youtube_url, sequence: editing.sequence, is_active: editing.is_active, target_audience: editing.target_audience },
      });
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e?.data?.youtube_url || e?.data?.detail || e?.message || "Save failed.");
    }
  }

  async function del(v: Video) {
    if (!(await confirmAction(`Delete "${v.title}"?`))) return;
    try { await api(`/platform/tutorials/${v.id}/`, { method: "DELETE" }); await load(); }
    catch (e: any) { toast.error(e?.message || "Failed."); }
  }

  if (error) return <ErrorState error={error} />;
  if (!videos) return <Spinner />;

  return (
    <>
      <PageHeader title="Tutorial Videos" />

      {playing && (
        <div className="modal d-block bg-dark bg-opacity-75" tabIndex={-1} onClick={() => setPlaying(null)}>
          <div className="modal-dialog modal-xl modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content bg-transparent border-0">
              <div className="modal-header border-0 justify-content-end p-0 mb-2">
                <button type="button" className="btn-close btn-close-white" onClick={() => setPlaying(null)} aria-label="Close"></button>
              </div>
              <div className="modal-body p-0 shadow-lg rounded overflow-hidden bg-black" style={{ aspectRatio: '16/9' }}>
                <iframe 
                  width="100%" 
                  height="100%" 
                  src={playing.embed_url || playing.youtube_url.replace("youtu.be/", "www.youtube.com/embed/").replace("watch?v=", "embed/")} 
                  title={playing.title} 
                  frameBorder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                  allowFullScreen
                ></iframe>
              </div>
            </div>
          </div>
        </div>
      )}

      <Card className="mb-4">
        <h2 className="h6 fw-bold mb-3">Add a tutorial video</h2>
        <form className="row g-3 align-items-end" onSubmit={add}>
          <div className="col-md-5">
            <label className="form-label small fw-medium">Video title</label>
            <input className="form-control" required placeholder="e.g. How to make your first sale" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="col-md-4">
            <label className="form-label small fw-medium">YouTube link</label>
            <input className="form-control" required placeholder="https://youtu.be/…" value={form.youtube_url} onChange={(e) => setForm((f) => ({ ...f, youtube_url: e.target.value }))} />
          </div>
          <div className="col-md-2">
            <label className="form-label small fw-medium">Audience</label>
            <select className="form-select" value={form.target_audience} onChange={(e) => setForm(f => ({...f, target_audience: e.target.value as any}))}>
              <option value="both">Both</option>
              <option value="shop">Shop Only</option>
              <option value="reseller">Reseller Only</option>
            </select>
          </div>
          <div className="col-md-1">
            <label className="form-label small fw-medium">Seq #</label>
            <input className="form-control" placeholder="auto" value={form.sequence} onChange={(e) => setForm((f) => ({ ...f, sequence: e.target.value }))} />
          </div>
          <div className="col-md-1"><button className="btn btn-brand w-100" disabled={busy}>Add</button></div>
        </form>
        <div className="text-secondary small mt-2">Videos appear on every shop’s dashboard, ordered by sequence number (lowest first).</div>
      </Card>

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="thead-4">
              <tr><th>Seq</th><th>Preview</th><th>Title / Link</th><th>Audience</th><th>Active</th><th className="text-end">Actions</th></tr>
            </thead>
            <tbody>
              {videos.length === 0 && <EmptyRow cols={6} text="No tutorials yet." />}
              {videos.map((v) => (
                editing?.id === v.id ? (
                  <tr key={v.id} className="table-light">
                    <td><input className="form-control form-control-sm" style={{ width: 64 }} type="number" value={editing.sequence} onChange={(e) => setEditing({ ...editing, sequence: Number(e.target.value) })} /></td>
                    <td>—</td>
                    <td>
                      <input className="form-control form-control-sm mb-1" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                      <input className="form-control form-control-sm" value={editing.youtube_url} onChange={(e) => setEditing({ ...editing, youtube_url: e.target.value })} />
                    </td>
                    <td>
                      <select className="form-select form-select-sm" value={editing.target_audience} onChange={(e) => setEditing({ ...editing, target_audience: e.target.value as any})}>
                        <option value="both">Both</option>
                        <option value="shop">Shop Only</option>
                        <option value="reseller">Reseller Only</option>
                      </select>
                    </td>
                    <td><input type="checkbox" className="form-check-input" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /></td>
                    <td className="text-end">
                      <div className="d-flex gap-2 justify-content-end">
                        <button className="btn btn-brand btn-sm py-0" onClick={saveEdit}>Save</button>
                        <button className="btn btn-light btn-sm py-0" onClick={() => setEditing(null)}>Cancel</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={v.id}>
                    <td>{v.sequence}</td>
                    <td>{v.thumbnail_url ? <img src={v.thumbnail_url} alt="" style={{ width: 80, borderRadius: 4, cursor: "pointer" }} onClick={() => setPlaying(v)} /> : "—"}</td>
                    <td>
                      <div className="fw-semibold"><a href="#!" onClick={(e) => { e.preventDefault(); setPlaying(v); }} className="text-decoration-none text-dark">{v.title}</a></div>
                      <div className="small"><a href="#!" onClick={(e) => { e.preventDefault(); setPlaying(v); }} className="text-break">{v.youtube_url}</a></div>
                    </td>
                    <td>
                      {v.target_audience === 'both' && <span className="badge bg-success bg-opacity-10 text-success border border-success fw-semibold">Both</span>}
                      {v.target_audience === 'shop' && <span className="badge bg-primary bg-opacity-10 text-primary border border-primary fw-semibold">Shop Only</span>}
                      {v.target_audience === 'reseller' && <span className="badge bg-warning bg-opacity-10 text-warning border border-warning fw-semibold">Reseller Only</span>}
                    </td>
                    <td>{v.is_active ? <span className="badge text-bg-success">On</span> : <span className="badge text-bg-secondary">Off</span>}</td>
                    <td className="text-end">
                      <div className="d-flex gap-2 justify-content-end">
                        <button className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => setEditing(v)}>Edit</button>
                        <button className="btn btn-link btn-sm p-0 text-decoration-none text-danger" onClick={() => del(v)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
