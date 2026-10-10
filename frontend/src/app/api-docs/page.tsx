"use client";

import { useEffect } from "react";

export default function ApiDocsPage() {
  useEffect(() => {
    window.location.replace("/api-docs.html");
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "Outfit, system-ui, -apple-system, sans-serif",
        backgroundColor: "#faf8ff",
        color: "#0f172a",
        padding: "20px",
        textAlign: "center",
      }}
    >
      <meta httpEquiv="refresh" content="0; url=/api-docs.html" />
      <div
        style={{
          width: "48px",
          height: "48px",
          border: "4px solid #e2e8f0",
          borderTop: "4px solid #2563eb",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
          marginBottom: "16px",
        }}
      />
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      <p style={{ fontWeight: 600, fontSize: "1.1rem", margin: "0 0 8px 0" }}>
        API ডকে রিডাইরেক্ট করা হচ্ছে...
      </p>
      <a
        href="/api-docs.html"
        style={{
          color: "#2563eb",
          fontWeight: 600,
          textDecoration: "underline",
          fontSize: "0.95rem",
        }}
      >
        স্বয়ংক্রিয়ভাবে ওপেন না হলে এখানে ক্লিক করুন
      </a>
    </div>
  );
}
