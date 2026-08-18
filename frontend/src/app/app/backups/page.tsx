"use client";

export default function BackupsPage() {
  const { t } = useLanguage();
  return (
    <div className="vstack gap-3" style={{ maxWidth: "48rem" }}>
      <h1 className="h4 fw-bold text-brand mb-0">{t("bku_title")}</h1>
      <div className="card shadow-sm">
        <div className="card-body">
          <p className="mb-3">{t("bku_desc")}</p>
          <div className="d-flex gap-2">
            <a href={`${process.env.NEXT_PUBLIC_API_BASE || ""}/backup/download/`} className="btn btn-brand btn-sm">
              <i className="bi bi-download me-1"></i> Download backup
            </a>
          </div>
          <div className="alert alert-warning mt-3 mb-0 small">
            {t("bku_alert")}
          </div>
        </div>
      </div>
    </div>
  );
}
