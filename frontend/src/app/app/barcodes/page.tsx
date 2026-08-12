"use client";

import { useState } from "react";
import Barcode from "react-barcode";
import { useAuth } from "@/components/AuthProvider";

export default function BarcodesGeneratorPage() {
  const { user } = useAuth();
  const shopPrefix = (user?.shop_barcode_prefix || "").toUpperCase();
  const [quantity, setQuantity] = useState<number>(10);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [isPrintingAll, setIsPrintingAll] = useState(false);
  const [printIndex, setPrintIndex] = useState<number | null>(null);

  function generateBarcodes() {
    const codes: string[] = [];
    const base = Date.now().toString().slice(-6);
    for (let i = 0; i < quantity; i++) {
      const randomStr = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
      codes.push(`${shopPrefix}${base}${randomStr}${i}`);
    }
    setGeneratedCodes(codes);
  }

  function printAll() {
    setIsPrintingAll(true);
    setTimeout(() => {
      window.print();
      setIsPrintingAll(false);
    }, 100);
  }

  function printOne(index: number) {
    setPrintIndex(index);
    setTimeout(() => {
      window.print();
      setPrintIndex(null);
    }, 100);
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: 38mm 25mm;
            margin: 0;
          }
          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
          }
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
          }
          .barcode-label {
            width: 100%;
            height: 25mm;
            display: flex;
            justify-content: center;
            align-items: center;
            page-break-after: always;
            box-sizing: border-box;
            background: white;
            overflow: hidden;
            margin: 0;
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      <div className="vstack gap-4 no-print">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div>
            <h4 className="fw-semibold mb-1">Barcode Generator</h4>
            <div className="text-secondary small">
              Generate unique barcodes for printing on 38x25mm labels.
              {shopPrefix && (
                <> Each code is prefixed with your shop code <span className="badge text-bg-primary">{shopPrefix}</span> for uniqueness.</>
              )}
            </div>
          </div>
          {generatedCodes.length > 0 && (
            <button className="btn btn-brand shadow-sm fw-medium px-4" onClick={printAll}>
              <span className="me-2">🖨️</span> Print All ({generatedCodes.length})
            </button>
          )}
        </div>

        <div className="card shadow-sm border-0 bg-white">
          <div className="card-body p-4">
            <div className="row g-3 align-items-end">
              <div className="col-md-4">
                <label className="form-label small fw-medium text-secondary">Number of barcodes</label>
                <input
                  type="number"
                  className="form-control"
                  min={1}
                  max={500}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
              </div>
              <div className="col-md-4">
                <button className="btn btn-primary w-100 fw-medium" onClick={generateBarcodes}>
                  Generate Unique Barcodes
                </button>
              </div>
              <div className="col-md-4">
                 <div className="text-secondary small h-100 d-flex align-items-center">
                    These barcodes are dynamically generated and won't be saved to the database.
                 </div>
              </div>
            </div>
          </div>
        </div>

        {generatedCodes.length > 0 ? (
          <div className="row g-3">
            {generatedCodes.map((code, idx) => (
              <div key={idx} className="col-6 col-md-4 col-lg-3 col-xl-2">
                <div className="card shadow-sm text-center h-100 border-0 bg-white">
                  <div className="card-body d-flex flex-column align-items-center justify-content-center p-3">
                    <div className="bg-light rounded p-2 mb-3 w-100 d-flex justify-content-center">
                       <Barcode value={code} width={1.2} height={40} fontSize={12} background="transparent" />
                    </div>
                    <button className="btn btn-sm btn-outline-secondary w-100" onClick={() => printOne(idx)}>
                      Print Target
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card shadow-sm border-0 bg-white">
             <div className="card-body p-5 text-center text-secondary">
                 <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>🖨️</div>
                 <h5>No barcodes generated yet</h5>
                 <p className="mb-0">Enter a quantity above and click Generate.</p>
             </div>
          </div>
        )}
      </div>

      {/* Hidden Print Area */}
      {(isPrintingAll || printIndex !== null) && (
        <div id="print-area">
          {generatedCodes
            .filter((_, idx) => isPrintingAll || idx === printIndex)
            .map((code, idx) => (
              <div key={idx} className="barcode-label">
                <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
                  <Barcode value={code} width={1.5} height={45} fontSize={14} margin={0} displayValue={true} />
                </div>
              </div>
            ))}
        </div>
      )}
    </>
  );
}
