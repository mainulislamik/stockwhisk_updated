"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";

interface PrintFormatModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: number | string;
  onSelectFormat?: (format: "pos" | "regular") => void;
  targetBlank?: boolean;
}

export default function PrintFormatModal({
  isOpen,
  onClose,
  invoiceId,
  onSelectFormat,
  targetBlank = false,
}: PrintFormatModalProps) {
  const router = useRouter();
  const { t } = useLanguage();

  if (!isOpen) return null;

  const handleSelect = (format: "pos" | "regular") => {
    if (onSelectFormat) {
      onSelectFormat(format);
    } else {
      const url = `/invoice/${invoiceId}?format=${format}`;
      if (targetBlank) {
        window.open(url, "_blank");
      } else {
        router.push(url);
      }
    }
    onClose();
  };

  return (
    <div
      className="modal d-block"
      style={{
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        zIndex: 1060,
      }}
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-dialog-centered"
        style={{ maxWidth: "520px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
          {/* Header */}
          <div
            className="p-4 text-white position-relative"
            style={{
              background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            }}
          >
            <button
              type="button"
              className="btn-close btn-close-white position-absolute top-0 end-0 m-3"
              aria-label="Close"
              onClick={onClose}
            />
            <div className="d-flex align-items-center gap-3">
              <div
                className="d-flex align-items-center justify-content-center rounded-3 bg-primary bg-opacity-25 text-white"
                style={{ width: 46, height: 46, fontSize: "1.4rem" }}
              >
                🖨️
              </div>
              <div>
                <h5 className="fw-bold mb-1">{t("print_modal_title")}</h5>
                <p className="mb-0 opacity-75 small">{t("print_modal_desc")}</p>
              </div>
            </div>
          </div>

          {/* Format Options */}
          <div className="p-4 bg-body">
            <div className="row g-3">
              {/* Option 1: Standard A4 */}
              <div className="col-12">
                <div
                  className="p-3 rounded-3 border h-100 cursor-pointer d-flex align-items-start gap-3 transition-all"
                  style={{
                    backgroundColor: "var(--bs-tertiary-bg)",
                    borderColor: "var(--bs-border-color)",
                    cursor: "pointer",
                    transition: "all 0.2s ease-in-out",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#2563eb";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(37,99,235,0.12)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--bs-border-color)";
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                  onClick={() => handleSelect("regular")}
                >
                  <div
                    className="d-flex align-items-center justify-content-center rounded-3 bg-primary bg-opacity-10 text-primary flex-shrink-0"
                    style={{ width: 44, height: 44, fontSize: "1.3rem" }}
                  >
                    📄
                  </div>
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <span className="fw-bold text-body" style={{ fontSize: "1rem" }}>
                        {t("print_format_regular_title")}
                      </span>
                      <span className="badge bg-primary bg-opacity-10 text-primary px-2 py-1 small">
                        {t("print_format_regular_badge")}
                      </span>
                    </div>
                    <div className="text-secondary small" style={{ lineHeight: "1.4" }}>
                      {t("print_format_regular_desc")}
                    </div>
                  </div>
                </div>
              </div>

              {/* Option 2: POS Thermal Receipt */}
              <div className="col-12">
                <div
                  className="p-3 rounded-3 border h-100 cursor-pointer d-flex align-items-start gap-3 transition-all"
                  style={{
                    backgroundColor: "var(--bs-tertiary-bg)",
                    borderColor: "var(--bs-border-color)",
                    cursor: "pointer",
                    transition: "all 0.2s ease-in-out",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#16a34a";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(22,163,74,0.12)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--bs-border-color)";
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                  onClick={() => handleSelect("pos")}
                >
                  <div
                    className="d-flex align-items-center justify-content-center rounded-3 bg-success bg-opacity-10 text-success flex-shrink-0"
                    style={{ width: 44, height: 44, fontSize: "1.3rem" }}
                  >
                    🧾
                  </div>
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <span className="fw-bold text-body" style={{ fontSize: "1rem" }}>
                        {t("print_format_pos_title")}
                      </span>
                      <span className="badge bg-success bg-opacity-10 text-success px-2 py-1 small">
                        {t("print_format_pos_badge")}
                      </span>
                    </div>
                    <div className="text-secondary small" style={{ lineHeight: "1.4" }}>
                      {t("print_format_pos_desc")}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-body-tertiary border-top d-flex justify-content-end gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm px-3 rounded-3"
              onClick={onClose}
            >
              {t("print_modal_cancel")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
