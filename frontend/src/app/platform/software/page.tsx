"use client";

import { confirmAction } from "@/lib/dialogs";
import { useEffect, useState } from "react";
import { api, unwrap } from "@/lib/api";
import { Card, EmptyRow, ErrorState, PageHeader, Spinner } from "@/components/ui";
import toast from "react-hot-toast";

type SoftwareRelease = {
  id: number;
  platform: "android" | "windows" | "mac";
  version: string;
  release_notes: string;
  file: string;
  is_active: boolean;
  created_at: string;
};

export default function SoftwareAdminPage() {
  const [releases, setReleases] = useState<SoftwareRelease[] | null>(null);
  const [error, setError] = useState("");
  
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({ platform: "android", version: "", release_notes: "" });
  const [file, setFile] = useState<File | null>(null);

  const fetchReleases = () => {
    api<any>("/platform/software/")
      .then((data) => setReleases(unwrap(data)))
      .catch((e) => setError(e?.message || "Failed to load software releases."));
  };

  useEffect(() => {
    fetchReleases();
  }, []);

  const deleteRelease = async (id: number, version: string) => {
    if (!(await confirmAction(`Are you sure you want to delete version ${version}?`))) return;
    try {
      await api(`/platform/software/${id}/`, { method: "DELETE" });
      fetchReleases();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete software.");
    }
  };

  const toggleActive = async (id: number, current: boolean) => {
    try {
      await api(`/platform/software/${id}/`, { method: "PATCH", body: { is_active: !current } });
      fetchReleases();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update status.");
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error("Please select a file to upload.");
    if (!formData.version) return toast.error("Please enter a version number.");

    setUploading(true);
    try {
      const data = new FormData();
      data.append("platform", formData.platform);
      data.append("version", formData.version);
      data.append("release_notes", formData.release_notes);
      data.append("file", file);
      
      await api("/platform/software/", { method: "POST", body: data });
      
      toast.success("Software uploaded successfully!");
      setShowModal(false);
      setFile(null);
      setFormData({ platform: "android", version: "", release_notes: "" });
      fetchReleases();
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload software.");
    } finally {
      setUploading(false);
    }
  };

  if (error) return <ErrorState error={error} />;
  if (!releases) return <Spinner />;

  return (
    <>
      <PageHeader 
        title="Software Releases" 
        actions={
          <button className="btn btn-brand" onClick={() => setShowModal(true)}>
            + Upload Software
          </button>
        }
      />

      <Card body={false}>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="thead-1">
              <tr>
                <th>Platform</th>
                <th>Version</th>
                <th>Status</th>
                <th>Uploaded At</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {releases.length === 0 && <EmptyRow cols={5} />}
              {releases.map((r) => (
                <tr key={r.id}>
                  <td className="fw-semibold text-capitalize">{r.platform}</td>
                  <td>{r.version}</td>
                  <td>
                    <button 
                      onClick={() => toggleActive(r.id, r.is_active)}
                      className={`badge border-0 ${r.is_active ? 'bg-success' : 'bg-secondary'}`}
                    >
                      {r.is_active ? "Active" : "Hidden"}
                    </button>
                  </td>
                  <td>{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="text-end">
                    <a href={r.file} target="_blank" rel="noreferrer" className="btn btn-sm btn-link text-decoration-none p-0 me-3">
                      Download
                    </a>
                    <button 
                      className="btn btn-sm btn-link text-danger text-decoration-none p-0"
                      onClick={() => deleteRelease(r.id, r.version)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Upload Modal */}
      {showModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={() => setShowModal(false)} />
          <div className="modal fade show d-block" style={{ zIndex: 1050 }}>
            <div className="modal-dialog modal-dialog-centered">
              <form className="modal-content" onSubmit={handleUpload}>
                <div className="modal-header border-0 pb-0">
                  <h5 className="modal-title fw-bold">Upload Software</h5>
                  <button type="button" className="btn-close" onClick={() => setShowModal(false)} />
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Platform</label>
                    <select 
                      className="form-select" 
                      value={formData.platform}
                      onChange={(e) => setFormData({...formData, platform: e.target.value})}
                    >
                      <option value="android">Android</option>
                      <option value="windows">Windows</option>
                      <option value="mac">macOS</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Version</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. v1.2.0" 
                      value={formData.version}
                      onChange={(e) => setFormData({...formData, version: e.target.value})}
                      required 
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">File</label>
                    <input 
                      type="file" 
                      className="form-control" 
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      required 
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Release Notes (Optional)</label>
                    <textarea 
                      className="form-control" 
                      rows={3} 
                      value={formData.release_notes}
                      onChange={(e) => setFormData({...formData, release_notes: e.target.value})}
                    />
                  </div>
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button type="button" className="btn btn-light rounded-pill px-4" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-brand rounded-pill px-4" disabled={uploading}>
                    {uploading ? "Uploading..." : "Upload"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
}
