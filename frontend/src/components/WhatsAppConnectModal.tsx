"use client";

import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

interface WhatsAppConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected: (phone?: string) => void;
}

export default function WhatsAppConnectModal({
  isOpen,
  onClose,
  onConnected,
}: WhatsAppConnectModalProps) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("initializing");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchQR = async () => {
    try {
      const data = await api<{
        qr: string | null;
        status: string;
        connected: boolean;
        phone: string | null;
      }>("/notifications/whatsapp/qr/");

      setStatus(data.status);
      if (data.connected) {
        toast.success(
          data.phone
            ? `WhatsApp কানেক্টেড হয়েছে: ${data.phone}`
            : "WhatsApp সফলভাবে কানেক্টেড হয়েছে!"
        );
        onConnected(data.phone || undefined);
        onClose();
        return;
      }

      if (data.qr) {
        setQrCode(data.qr);
        setLoading(false);
        setError(null);
      } else {
        // QR not ready yet, keep loading
        setLoading(true);
      }
    } catch (err: any) {
      console.error("Failed to load WhatsApp QR:", err);
      setError(err?.message || "QR কোড লোড হতে সমস্যা হচ্ছে। পুনরায় চেষ্টা করুন।");
    }
  };

  useEffect(() => {
    if (!isOpen) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      setQrCode(null);
      setLoading(true);
      setError(null);
      return;
    }

    // Initial fetch
    fetchQR();

    // Poll every 3.5 seconds
    pollTimerRef.current = setInterval(fetchQR, 3500);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="modal fade show d-block"
      tabIndex={-1}
      style={{
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(8px)",
        zIndex: 1060,
      }}
    >
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 440 }}>
        <div
          className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden"
          style={{
            background: "rgba(255, 255, 255, 0.98)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          }}
        >
          {/* Header */}
          <div
            className="modal-header border-0 pb-0 pt-4 px-4 d-flex justify-content-between align-items-center"
          >
            <div className="d-flex align-items-center gap-2">
              <div
                className="d-flex align-items-center justify-content-center rounded-circle"
                style={{
                  width: 42,
                  height: 42,
                  background: "linear-gradient(135deg, #25D366, #128C7E)",
                  color: "#fff",
                  fontSize: 22,
                  boxShadow: "0 4px 12px rgba(37, 211, 102, 0.3)",
                }}
              >
                💬
              </div>
              <div>
                <h5 className="modal-title fw-bold mb-0 text-slate-900" style={{ fontSize: "1.15rem" }}>
                  Connect WhatsApp
                </h5>
                <p className="text-muted small mb-0" style={{ fontSize: "0.8rem" }}>
                  আপনার শপের নিজস্ব WhatsApp কানেক্ট করুন
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={onClose}
              style={{ fontSize: "0.85rem" }}
            />
          </div>

          {/* Body */}
          <div className="modal-body p-4 text-center">
            {error ? (
              <div className="alert alert-danger rounded-3 py-3 small text-start mb-3">
                <div className="fw-semibold mb-1">⚠️ ত্রুটি:</div>
                <div>{error}</div>
                <button
                  className="btn btn-sm btn-outline-danger mt-2 w-100"
                  onClick={() => {
                    setError(null);
                    setLoading(true);
                    fetchQR();
                  }}
                >
                  পুনরায় চেষ্টা করুন
                </button>
              </div>
            ) : qrCode ? (
              <div className="d-flex flex-column align-items-center">
                <div
                  className="p-3 bg-white rounded-3 shadow-sm border mb-3 position-relative"
                  style={{ width: 260, height: 260 }}
                >
                  <img
                    src={qrCode}
                    alt="WhatsApp QR Code"
                    className="w-100 h-100 object-contain rounded"
                  />
                </div>
                <div className="d-flex align-items-center gap-2 text-success small fw-medium mb-3">
                  <span
                    className="spinner-grow spinner-grow-sm text-success"
                    role="status"
                    style={{ width: 10, height: 10 }}
                  />
                  <span>স্ক্যান করার জন্য অপেক্ষা করা হচ্ছে...</span>
                </div>
              </div>
            ) : (
              <div
                className="d-flex flex-column align-items-center justify-content-center py-5"
                style={{ minHeight: 260 }}
              >
                <div
                  className="spinner-border text-success mb-3"
                  style={{ width: "2.75rem", height: "2.75rem" }}
                  role="status"
                />
                <div className="fw-semibold text-slate-800">QR কোড তৈরি হচ্ছে...</div>
                <div className="text-muted small">কয়েক সেকেন্ড অপেক্ষা করুন</div>
              </div>
            )}

            {/* Instruction Steps */}
            <div
              className="rounded-3 p-3 text-start"
              style={{
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                fontSize: "0.825rem",
              }}
            >
              <div className="fw-semibold text-slate-800 mb-2">
                📱 কিভাবে লিংক করবেন:
              </div>
              <ol className="ps-3 mb-0 text-slate-600 d-flex flex-column gap-1">
                <li>আপনার মোবাইলে WhatsApp অ্যাপ খুলুন।</li>
                <li>
                  মেনু (<strong>⋮</strong> বা <strong>সেটিংস</strong>) থেকে{" "}
                  <strong>Linked Devices</strong> সিলেক্ট করুন।
                </li>
                <li>
                  <strong>Link a Device</strong> এ চাপ দিয়ে স্ক্রিনের QR কোডটি স্ক্যান করুন।
                </li>
              </ol>
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer border-0 pt-0 px-4 pb-4">
            <button
              type="button"
              className="btn btn-light w-100 py-2 fw-medium rounded-3 border text-slate-700"
              onClick={onClose}
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
