import { ImageResponse } from "next/og";

// Render on demand instead of prerendering at build time (avoids a Windows-only
// @vercel/og font path crash during `next build`; served fine at runtime).
export const dynamic = "force-dynamic";
export const alt = "StockWhisk — Inventory Management & POS Software";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0B1120 0%, #1B3C53 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>
          📦 StockWhisk
        </div>
        <div
          style={{
            fontSize: 68,
            fontWeight: 800,
            marginTop: 24,
            lineHeight: 1.1,
            maxWidth: 900,
          }}
        >
          Inventory Management & POS Software for Retail
        </div>
        <div style={{ fontSize: 32, marginTop: 28, color: "#9fd3e0" }}>
          Barcode billing · Stock control · Warranty · Reports
        </div>
      </div>
    ),
    { ...size }
  );
}
