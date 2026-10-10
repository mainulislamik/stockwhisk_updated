"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import WhatsAppConnectModal from "@/components/WhatsAppConnectModal";

interface WhatsAppInvoiceSenderProps {
  saleId: number;
  invoiceNo: string;
  phone?: string | null;
  customerName?: string | null;
  total?: string | number;
  publicInvoiceUrl?: string;
  variant?: "button" | "modal-card" | "pos-action";
  className?: string;
  onSuccess?: () => void;
}

export default function WhatsAppInvoiceSender({
  saleId,
  invoiceNo,
  phone,
  customerName,
  total,
  publicInvoiceUrl,
  variant = "button",
  className = "",
  onSuccess,
}: WhatsAppInvoiceSenderProps) {
  const [loading, setLoading] = useState(false);
  const [waStatus, setWaStatus] = useState<{
    connected: boolean;
    phone: string;
    default_mode: string;
  }>({
    connected: false,
    phone: "",
    default_mode: "direct",
  });
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [fallbackWaUrl, setFallbackWaUrl] = useState<string | null>(null);

  // Normalize phone digits
  const rawDigits = (phone || "").replace(/\D/g, "");
  const intlPhone = rawDigits.startsWith("880")
    ? rawDigits
    : rawDigits.startsWith("0")
    ? "880" + rawDigits.slice(1)
    : rawDigits.length === 10
    ? "880" + rawDigits
    : rawDigits;
  const hasPhone = rawDigits.length >= 10;

  useEffect(() => {
    let isMounted = true;
    api<any>("/notifications/whatsapp/status/")
      .then((data) => {
        if (isMounted) {
          setWaStatus({
            connected: Boolean(data.connected),
            phone: data.phone || "",
            default_mode: data.default_mode || "direct",
          });
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSend = async (mode: "direct" | "browser") => {
    if (!hasPhone) {
      toast.error("কাস্টমারের বৈধ ফোন নম্বর নেই");
      return;
    }

    setLoading(true);
    try {
      const res = await api<any>("/notifications/whatsapp/send-invoice/", {
        method: "POST",
        body: {
          sale_id: saleId,
          mode: mode,
          phone: intlPhone,
        },
      });

      if (mode === "browser" || res.mode === "browser") {
        if (res.wa_url) {
          window.open(res.wa_url, "_blank");
          toast.success("WhatsApp Web ব্রাউজারে খোলা হয়েছে");
        }
      } else if (res.success && res.mode === "direct") {
        toast.success(`⚡ চালান #${invoiceNo} সরাসরি হোয়াটসঅ্যাপে পাঠানো হয়েছে!`, {
          duration: 4000,
          icon: "🚀",
        });
        if (onSuccess) onSuccess();
      } else if (res.fallback_mode === "browser" && res.wa_url) {
        // Fallback gracefully
        window.open(res.wa_url, "_blank");
        toast("শপের WhatsApp অফলাইন — ব্রাউজারে খোলা হয়েছে", { icon: "ℹ️" });
      }
    } catch (err: any) {
      // If API error, generate client fallback wa.me URL
      console.error("WhatsApp dispatch error", err);
      const invoiceLink = publicInvoiceUrl
        ? publicInvoiceUrl.startsWith("http")
          ? publicInvoiceUrl
          : typeof window !== "undefined"
          ? window.location.origin + publicInvoiceUrl
          : ""
        : "";
      const text = `🧾 চালান #${invoiceNo} মোট: ৳${Number(total || 0).toFixed(2)}${
        invoiceLink ? `\nঅনলাইন রশিদ: ${invoiceLink}` : ""
      }`;
      const fallbackUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(text)}`;
      window.open(fallbackUrl, "_blank");
      toast("ব্রাউজারে WhatsApp খোলা হয়েছে", { icon: "🌐" });
    } finally {
      setLoading(false);
    }
  };

  if (!hasPhone) return null;

  // Render POS Modal Action variant
  if (variant === "pos-action") {
    return (
      <div className={`d-flex flex-column gap-2 ${className}`}>
        {waStatus.connected ? (
          <>
            <button
              type="button"
              className="btn btn-lg rounded-3 fw-semibold text-white d-flex align-items-center justify-content-center gap-2 shadow-sm"
              style={{
                background: "linear-gradient(135deg, #25D366, #128C7E)",
                border: "none",
              }}
              onClick={() => handleSend("direct")}
              disabled={loading}
            >
              {loading ? (
                <span>পাঠানো হচ্ছে...</span>
              ) : (
                <>
                  <span>⚡</span>
                  <span>১-ট্যাপে হোয়াটসঅ্যাপে বিল পাঠান</span>
                </>
              )}
            </button>
            <div className="d-flex justify-content-between align-items-center px-1">
              <span className="small text-muted" style={{ fontSize: "0.75rem" }}>
                কানেক্টেড: <strong>{waStatus.phone}</strong>
              </span>
              <button
                type="button"
                className="btn btn-link btn-sm p-0 text-decoration-none text-secondary"
                style={{ fontSize: "0.75rem" }}
                onClick={() => handleSend("browser")}
              >
                🔗 অথবা WhatsApp Web এ খুলুন
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-lg rounded-3 fw-semibold text-white d-flex align-items-center justify-content-center gap-2"
              style={{ background: "#25D366" }}
              onClick={() => handleSend("browser")}
              disabled={loading}
            >
              <i className="bi bi-whatsapp"></i>
              <span>হোয়াটসঅ্যাপে বিল পাঠান (Web)</span>
            </button>
            <div className="text-center">
              <button
                type="button"
                className="btn btn-link btn-sm p-0 text-primary small"
                style={{ fontSize: "0.75rem" }}
                onClick={() => setConnectModalOpen(true)}
              >
                💡 ১-ট্যাপে সরাসরি পাঠাতে WhatsApp QR স্ক্যান করুন
              </button>
            </div>
          </>
        )}

        <WhatsAppConnectModal
          isOpen={connectModalOpen}
          onClose={() => setConnectModalOpen(false)}
          onConnected={(connectedPhone) => {
            setWaStatus({
              connected: true,
              phone: connectedPhone || "",
              default_mode: "direct",
            });
            toast.success("WhatsApp সংযুক্ত হয়েছে! এখন ১-ক্লিকে বিল পাঠাতে পারবেন।");
          }}
        />
      </div>
    );
  }

  // Standard Button variant (for /app/sales/[id])
  return (
    <>
      <div className={`btn-group ${className}`} role="group">
        <button
          type="button"
          className="btn btn-sm text-white d-flex align-items-center gap-1"
          style={{
            background: waStatus.connected
              ? "linear-gradient(135deg, #25D366, #128C7E)"
              : "#25D366",
            border: "none",
          }}
          onClick={() => handleSend(waStatus.connected ? "direct" : "browser")}
          disabled={loading}
          title={
            waStatus.connected
              ? "১-ট্যাপে সরাসরি WhatsApp-এ চালান পাঠান"
              : "WhatsApp Web-এ চালান খুলুন"
          }
        >
          {loading ? (
            <span className="spinner-border spinner-border-sm me-1" role="status"></span>
          ) : (
            <span>{waStatus.connected ? "⚡" : "💬"}</span>
          )}
          <span>
            {waStatus.connected ? "১-ক্লিকে WhatsApp বিল" : "WhatsApp"}
          </span>
        </button>

        <button
          type="button"
          className="btn btn-sm text-white dropdown-toggle dropdown-toggle-split"
          style={{
            background: waStatus.connected ? "#128C7E" : "#1ea952",
            border: "none",
            borderLeft: "1px solid rgba(255,255,255,0.3)",
          }}
          data-bs-toggle="dropdown"
          aria-expanded="false"
        >
          <span className="visually-hidden">Toggle Dropdown</span>
        </button>
        <ul className="dropdown-menu dropdown-menu-end shadow-sm" style={{ minWidth: 240, fontSize: "0.85rem" }}>
          {waStatus.connected ? (
            <>
              <li>
                <button
                  className="dropdown-item py-2 d-flex align-items-center gap-2"
                  onClick={() => handleSend("direct")}
                  disabled={loading}
                >
                  <span className="text-success">⚡</span>
                  <div>
                    <div className="fw-semibold">১-ট্যাপ সরাসরি পাঠান</div>
                    <div className="text-muted small" style={{ fontSize: "0.75rem" }}>
                      সার্ভার থেকে স্বয়ংক্রিয়ভাবে মেসেজ যাবে
                    </div>
                  </div>
                </button>
              </li>
              <li>
                <button
                  className="dropdown-item py-2 d-flex align-items-center gap-2"
                  onClick={() => handleSend("browser")}
                >
                  <span className="text-muted">🔗</span>
                  <div>
                    <div className="fw-semibold">WhatsApp Web এ খুলুন</div>
                    <div className="text-muted small" style={{ fontSize: "0.75rem" }}>
                      ম্যানুয়ালি ব্রাউজারে wa.me লিংক ওপেন হবে
                    </div>
                  </div>
                </button>
              </li>
            </>
          ) : (
            <>
              <li>
                <button
                  className="dropdown-item py-2 d-flex align-items-center gap-2"
                  onClick={() => handleSend("browser")}
                >
                  <span>🔗</span>
                  <div>
                    <div className="fw-semibold">WhatsApp Web এ খুলুন</div>
                    <div className="text-muted small" style={{ fontSize: "0.75rem" }}>
                      wa.me লিঙ্ক ব্রাউজারে খুলবে
                    </div>
                  </div>
                </button>
              </li>
              <li><hr className="dropdown-divider" /></li>
              <li>
                <button
                  className="dropdown-item py-2 text-primary d-flex align-items-center gap-2"
                  onClick={() => setConnectModalOpen(true)}
                >
                  <span>📲</span>
                  <div>
                    <div className="fw-semibold">WhatsApp কানেক্ট করুন</div>
                    <div className="text-muted small" style={{ fontSize: "0.75rem" }}>
                      QR কোড স্ক্যান করে ১-ট্যাপ মোড চালু করুন
                    </div>
                  </div>
                </button>
              </li>
            </>
          )}
        </ul>
      </div>

      <WhatsAppConnectModal
        isOpen={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        onConnected={(phoneNum) => {
          setWaStatus({
            connected: true,
            phone: phoneNum || "",
            default_mode: "direct",
          });
          toast.success("WhatsApp সফলভাবে যুক্ত হয়েছে!");
        }}
      />
    </>
  );
}
