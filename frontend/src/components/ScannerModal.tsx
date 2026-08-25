import { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

export function ScannerModal({
  onScan,
  onClose,
}: {
  onScan: (barcode: string) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      if (!isMounted) return;
      try {
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (scannerRef.current && scannerRef.current.isScanning) {
              scannerRef.current.stop().then(() => {
                onScan(decodedText);
              }).catch(e => console.error("Error stopping scanner", e));
            } else {
              onScan(decodedText);
            }
          },
          (errorMessage) => {
            // Ignore normal scanning errors
          }
        ).catch((err: any) => {
          if (isMounted) {
            setError(err?.message || "Failed to start camera. Make sure you are using HTTPS and have granted camera permissions.");
          }
        });
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || "Camera initialization failed.");
        }
      }
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(e => console.error("Failed to stop scanner on unmount", e));
      }
    };
  }, [onScan]);

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1050 }} onClick={onClose} />
      <div className="modal fade show d-block" tabIndex={-1} style={{ zIndex: 1055 }}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header bg-light">
              <h5 className="modal-title fs-6 fw-bold">Scan Barcode</h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body p-4 text-center">
              {error ? (
                <div className="alert alert-danger mb-0 small text-start">
                  {error}
                </div>
              ) : (
                <div id="reader" style={{ width: "100%", maxWidth: "400px", margin: "0 auto", borderRadius: "8px", overflow: "hidden" }}></div>
              )}
            </div>
            <div className="modal-footer bg-light p-2">
              <button type="button" className="btn btn-secondary btn-sm w-100" onClick={onClose}>
                Cancel Scanning
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
