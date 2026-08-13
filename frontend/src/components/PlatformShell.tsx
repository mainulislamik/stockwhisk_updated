"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import PlatformNav from "@/components/PlatformNav";
import ThemeToggle from "@/components/ThemeToggle";
import { useBranding } from "@/lib/branding";

export default function PlatformShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const branding = useBranding();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCollapsed(localStorage.getItem("pfCollapsed") === "1");
  }, []);

  // Gate: only platform staff. Non-staff users are sent to the shop app.
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (!user.is_staff) router.replace("/app");
  }, [loading, user, router]);

  function toggle() {
    setCollapsed((c) => {
      const n = !c;
      localStorage.setItem("pfCollapsed", n ? "1" : "0");
      return n;
    });
  }

  if (loading || !user || !user.is_staff) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <span className="spinner-border text-brand" role="status" aria-hidden="true"></span>
      </div>
    );
  }

  return (
    <div className="d-flex min-vh-100">
      {/* Sidebar (desktop) */}
      <aside
        className={`sidebar d-none d-md-flex flex-column vh-100 position-sticky top-0 flex-shrink-0 ${collapsed ? "sb-collapsed" : ""}`}
        style={{ width: collapsed ? "4.5rem" : "15rem", transition: "width .2s" }}
      >
        <div className="d-flex align-items-center justify-content-between gap-2 p-3 border-bottom border-secondary border-opacity-25">
          {!collapsed && (
            <div className="text-truncate">
              {branding.logo
                ? <span style={{ background: "#fff", borderRadius: 10, padding: "5px 10px", display: "inline-flex" }}>
                    <img src={branding.logo} alt="Logo" style={{ height: 44, maxWidth: 170, objectFit: "contain", display: "block" }} />
                  </span>
                : <div className="fs-5 fw-bold brand-title">StockWhisk</div>}
              <div className="small text-secondary">Platform Admin</div>
            </div>
          )}
          <button onClick={toggle} className="btn btn-sm text-secondary flex-shrink-0" title={collapsed ? "Expand" : "Collapse"}>
            {collapsed ? "»" : "«"}
          </button>
        </div>
        <nav className="nav flex-column flex-grow-1 p-2 gap-1 overflow-auto">
          {mounted && <PlatformNav collapsed={collapsed} />}
        </nav>
        <div className="p-3 border-top border-secondary border-opacity-25 small text-secondary">
          {!collapsed && <div className="text-truncate">{user.email}</div>}
          <a onClick={logout} role="button" className="d-inline-block mt-2 text-danger text-decoration-none" title="Log out">
            {collapsed ? "⎋" : "Log out →"}
          </a>
        </div>
      </aside>

      {/* Sidebar (mobile offcanvas) */}
      <div className="offcanvas offcanvas-start sidebar text-light d-md-none" tabIndex={-1} id="platformNav" style={{ width: "15rem" }}>
        <div className="offcanvas-header border-bottom border-secondary border-opacity-25">
          <div>
            {branding.logo
              ? <span style={{ background: "#fff", borderRadius: 10, padding: "5px 10px", display: "inline-flex" }}>
                  <img src={branding.logo} alt="Logo" style={{ height: 44, maxWidth: 170, objectFit: "contain", display: "block" }} />
                </span>
              : <div className="fs-5 fw-bold brand-title">StockWhisk</div>}
            <div className="small text-secondary">Platform Admin</div>
          </div>
          <button type="button" className="btn-close btn-close-white" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div className="offcanvas-body p-2">
          <nav className="nav flex-column gap-1">{mounted && <PlatformNav />}</nav>
          <div className="border-top border-secondary border-opacity-25 mt-2 pt-2 small text-secondary">
            <div className="text-truncate">{user.email}</div>
            <a onClick={logout} role="button" className="text-danger text-decoration-none">Log out →</a>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-grow-1 d-flex flex-column min-vw-0" style={{ minWidth: 0 }}>
        <header className="bg-white border-bottom px-3 py-3 d-flex align-items-center gap-2">
          <button
            className="btn btn-sm btn-outline-secondary d-md-none"
            type="button"
            data-bs-toggle="offcanvas"
            data-bs-target="#platformNav"
            aria-label="Open navigation menu"
          >
            <i className="bi bi-list"></i>
          </button>
          <span className="fw-semibold text-secondary">Platform Admin</span>
          <ThemeToggle className="ms-auto" />
        </header>
        <main className="p-3 p-md-4 flex-grow-1">{children}</main>
      </div>
    </div>
  );
}
