"use client";

export default function BackupsPage() {
  return (
    <div className="vstack gap-3" style={{ maxWidth: "48rem" }}>
      <h1 className="h4 fw-bold text-brand mb-0">System Backups</h1>
      <div className="card shadow-sm">
        <div className="card-body">
          <p className="mb-3">Download a full backup of your shop data, or restore from a previous backup file.</p>
          <div className="d-flex gap-2">
            <a href={`${process.env.NEXT_PUBLIC_API_BASE || ""}/backup/download/`} className="btn btn-brand btn-sm">
              <i className="bi bi-download me-1"></i> Download backup
            </a>
          </div>
          <div className="alert alert-warning mt-3 mb-0 small">
            Backup download and restore are served directly by the Django backend (owner-only, session-authenticated). Restoring a backup overwrites current data — proceed with care.
          </div>
        </div>
      </div>
    </div>
  );
}
