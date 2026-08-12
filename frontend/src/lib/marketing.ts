// Shared LIGHT palette for all public/marketing pages, aligned to the app's
// light theme (blue #2563eb on slate #f8fafc). Public pages are intentionally
// always light so first-time visitors get one polished, consistent look.
export const M = {
  surface: "#f8fafc",        // page background
  surfaceAlt: "#eef2ff",     // subtle blue-tinted band
  surfaceTint: "#f1f5ff",
  card: "#ffffff",           // card / panel
  text: "#0f172a",           // headings / primary text
  textMuted: "#475569",      // body text
  textFaint: "#64748b",      // captions
  primary: "#2563eb",        // brand blue (matches app light mode)
  primaryDark: "#1d4ed8",
  accent: "#3b82f6",
  onPrimary: "#ffffff",
  border: "rgba(15,23,42,0.08)",
  borderStrong: "rgba(15,23,42,0.14)",
  dark: "#0b1c30",           // dark CTA band / footer
  darkText: "#94a3b8",
};

export type MarketingColors = typeof M;
