"use client";

import { useThemeMode } from "@/components/ThemeRegistry";

/** Small day/night toggle for topbars. Uses Bootstrap icons + theme colors. */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { mode, toggleTheme } = useThemeMode();
  const isDark = mode === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`btn btn-sm border-0 d-inline-flex align-items-center justify-content-center rounded-circle ${className}`}
      title={isDark ? "Switch to day mode" : "Switch to night mode"}
      aria-label="Toggle day / night mode"
      style={{ width: 34, height: 34, color: "var(--topbar-color, inherit)" }}
    >
      <i className={`bi ${isDark ? "bi-sun-fill" : "bi-moon-stars-fill"} fs-6`}></i>
    </button>
  );
}
