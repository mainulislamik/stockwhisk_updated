import { useEffect, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

export function ScannerModal({
  onScan,
  onClose,
}: {
  onScan: (barcode: string) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState("");

  useEffect(() => {
    // We add a short timeout to ensure the DOM element is fully mounted
    // before initializing the scanner.
    const timer = setTimeout(() => {
      try {
        const scanner = new Html5QrcodeScanner(
          "reader",
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          /* verbose= */ false
        );

        scanner.render(
          (decodedText) => {
            scanner.clear();
            onScan(decodedText);
          },
          (errorMessage) => {
            // Ignore normal scanning errors (e.g., no barcode found yet)
            // But we can log them if needed.
          }
        );

        // Cleanup on unmount
        return () => {
          try {
            scanner.clear().catch(e => console.error("Failed to clear scanner", e));
          } catch (e) {
            console.error("Failed to clear scanner on unmount", e);
          }
        };
      } catch (err: any) {
        setError(err?.message || "Failed to start camera. Make sure you are using HTTPS and have granted camera permissions.");
      }
    }, 100);

    return () => clearTimeout(timer);
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
                <div id="reader" style={{ width: "100%", maxWidth: "400px", margin: "0 auto" }}></div>
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
