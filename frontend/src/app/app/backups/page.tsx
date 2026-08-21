"use client";

import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";

export default function BackupsPage() {
  const { t } = useLanguage();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const res = await api<Response>("/backup/download/", { raw: true });
      if (!res.ok) throw new Error("Failed to download");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `shop_backup_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error("Backup download failed", err);
      alert("Failed to download backup");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="vstack gap-3" style={{ maxWidth: "48rem" }}>
      <h1 className="h4 fw-bold text-brand mb-0">{t("bku_title")}</h1>
      <div className="card shadow-sm">
        <div className="card-body">
          <p className="mb-3">{t("bku_desc")}</p>
          <div className="d-flex gap-2">
            <button 
              onClick={handleDownload} 
              disabled={downloading} 
              className="btn btn-brand btn-sm"
            >
              <i className="bi bi-download me-1"></i> 
              {downloading ? "Downloading..." : "Download backup"}
            </button>
          </div>
          <div className="alert alert-warning mt-3 mb-0 small">
            {t("bku_alert")}
          </div>
        </div>
      </div>
    </div>
  );
}
