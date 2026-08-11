"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Nav from "@/components/Nav";
import UniversalSearch from "@/components/UniversalSearch";
import { impersonatingShop, isImpersonating, returnToAdmin } from "@/lib/impersonation";
import { api } from "@/lib/api";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, billing } = useAuth();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [openGroup, setOpenGroup] = useState("products");
  const [mounted, setMounted] = useState(false);
  const [unread, setUnread] = useState(0);
  const [showContact, setShowContact] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setMounted(true);
    setCollapsed(localStorage.getItem("sbCollapsed") === "1");
    setOpenGroup(localStorage.getItem("sbGroup") || "products");
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (user.is_staff && !user.shop) {
      router.replace("/platform");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    const fetch = () =>
      api<{ unread: number }>("/notifications/notifications/unread_count/")
        .then((d) => setUnread(d.unread))
        .catch(() => {});
    fetch();
    pollRef.current = setInterval(fetch, 30_000);
    
    const handleUpdate = () => fetch();
    window.addEventListener("notifications_updated", handleUpdate);
    
    return () => { 
      if (pollRef.current) clearInterval(pollRef.current); 
      window.removeEventListener("notifications_updated", handleUpdate);
    };
  }, [user]);

  function toggle() {
    setCollapsed((c) => {
      const n = !c;
      localStorage.setItem("sbCollapsed", n ? "1" : "0");
      return n;
    });
  }
  function setGroup(g: string) {
    setOpenGroup((cur) => {
      const n = cur === g ? "" : g;
      localStorage.setItem("sbGroup", n);
      return n;
    });
  }

  if (loading || !user) {
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
        <div className="d-flex flex-column gap-3 p-3 border-bottom" style={{ borderColor: "var(--line)" }}>
          <div className="d-flex align-items-center justify-content-between">
            {!collapsed && <div className="fs-5 fw-bold brand-title lh-1" style={{ color: "var(--text-main)" }}>StockWhisk</div>}
            <button
              onClick={toggle}
              className="btn btn-sm flex-shrink-0 ms-auto p-0"
              style={{ color: "var(--text-muted)" }}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? "»" : "«"}
            </button>
          </div>
          
          {!collapsed && (
            <div className="d-flex align-items-center gap-2 p-2 rounded shadow-sm" style={{ background: "var(--sidebar-hover)", border: "1px solid var(--line)" }}>
              {user.shop_logo ? (
                <div 
                  className="rounded d-flex align-items-center justify-content-center flex-shrink-0 shadow-sm"
                  style={{ width: "32px", height: "32px", background: "var(--glass-bg)", overflow: "hidden" }}
                >
                  <img src={user.shop_logo} alt="Logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                </div>
              ) : (
                <div 
                  className="rounded d-flex align-items-center justify-content-center flex-shrink-0 fw-bold shadow-sm"
                  style={{ width: "32px", height: "32px", background: "var(--brand-500)", color: "#fff" }}
                >
                  {user.shop_name ? user.shop_name.charAt(0).toUpperCase() : "🏪"}
                </div>
              )}
              <div className="text-truncate min-vw-0">
                <div className="fw-semibold lh-1 text-truncate" style={{ fontSize: "0.9rem", color: "var(--text-main)" }}>{user.shop_name || "My Shop"}</div>
                <div className="d-flex align-items-center gap-1 mt-1 flex-wrap">
                  {(user.shop_code || user.shop) && (
                    <span className="badge rounded-pill bg-primary bg-opacity-25 text-primary border border-primary border-opacity-25" style={{ fontSize: "0.65rem", padding: "0.15rem 0.4rem" }}>
                      {user.shop_code || `SW-${1000 + (user.shop || 0)}`}
                    </span>
                  )}
                  <span className="small text-truncate" style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                    {billing?.plan ? `${billing.plan} plan` : " "}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
        <nav className="nav flex-column flex-grow-1 p-2 gap-1 overflow-auto">
          {mounted && <Nav collapsed={collapsed} openGroup={openGroup} setGroup={setGroup} />}
        </nav>
        <div className="p-3 border-top small" style={{ borderColor: "var(--line)", color: "var(--text-muted)" }}>
          {!collapsed && (
            <div>
              <div className="text-truncate" style={{ color: "var(--text-main)" }}>{user.email}</div>
              <div className="text-capitalize">{user.role}</div>
            </div>
          )}
          <a
            onClick={logout}
            role="button"
            className="d-inline-block mt-2 text-danger text-decoration-none"
            title={collapsed ? "Log out" : ""}
          >
            {collapsed ? "⎋" : "Log out →"}
          </a>
        </div>
      </aside>

      {/* Sidebar (mobile offcanvas) */}
      <div className="offcanvas offcanvas-start sidebar d-md-none" tabIndex={-1} id="mobileNav" style={{ width: "15rem" }}>
        <div className="offcanvas-header border-bottom flex-column align-items-stretch gap-3" style={{ borderColor: "var(--line)" }}>
          <div className="d-flex align-items-center justify-content-between">
            <div className="fs-5 fw-bold brand-title lh-1" style={{ color: "var(--text-main)" }}>StockWhisk</div>
            <button type="button" className="btn-close p-0" data-bs-dismiss="offcanvas" aria-label="Close"></button>
          </div>
          
          <div className="d-flex align-items-center gap-2 p-2 rounded shadow-sm" style={{ background: "var(--sidebar-hover)", border: "1px solid var(--line)" }}>
            {user.shop_logo ? (
              <div 
                className="rounded d-flex align-items-center justify-content-center flex-shrink-0 shadow-sm"
                style={{ width: "32px", height: "32px", background: "var(--glass-bg)", overflow: "hidden" }}
              >
                <img src={user.shop_logo} alt="Logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              </div>
            ) : (
              <div 
                className="rounded d-flex align-items-center justify-content-center flex-shrink-0 fw-bold shadow-sm"
                style={{ width: "32px", height: "32px", background: "var(--brand-500)", color: "#fff" }}
              >
                {user.shop_name ? user.shop_name.charAt(0).toUpperCase() : "🏪"}
              </div>
            )}
            <div className="text-truncate min-vw-0">
              <div className="fw-semibold lh-1 text-truncate" style={{ fontSize: "0.9rem", color: "var(--text-main)" }}>{user.shop_name || "My Shop"}</div>
              <div className="d-flex align-items-center gap-1 mt-1 flex-wrap">
                {(user.shop_code || user.shop) && (
                  <span className="badge rounded-pill bg-primary bg-opacity-25 text-primary border border-primary border-opacity-25" style={{ fontSize: "0.65rem", padding: "0.15rem 0.4rem" }}>
                    {user.shop_code || `SW-${1000 + (user.shop || 0)}`}
                  </span>
                )}
                <span className="small text-truncate" style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                  {billing?.plan ? `${billing.plan} plan` : " "}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="offcanvas-body p-2">
          <nav className="nav flex-column gap-1">
            {mounted && <Nav collapsed={false} openGroup={openGroup} setGroup={setGroup} />}
          </nav>
          <div className="border-top mt-2 pt-2 small" style={{ borderColor: "var(--line)", color: "var(--text-muted)" }}>
            <div className="text-truncate" style={{ color: "var(--text-main)" }}>{user.email}</div>
            <a onClick={logout} role="button" className="text-danger text-decoration-none">
              Log out →
            </a>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-grow-1 d-flex flex-column min-vw-0" style={{ minWidth: 0 }}>
        {mounted && isImpersonating() && (
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 px-3 py-2 text-white" style={{ background: "var(--brand-500)" }}>
            <span className="small">
              🔓 You are viewing <strong>{impersonatingShop()}</strong> as a platform admin.
            </span>
            <button className="btn btn-light btn-sm py-0" onClick={returnToAdmin}>
              ← Return to admin
            </button>
          </div>
        )}
        <header className="topbar px-3 py-3 d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <button
              className="btn btn-sm btn-outline-light d-md-none border-0"
              type="button"
              data-bs-toggle="offcanvas"
              data-bs-target="#mobileNav"
              aria-label="Open navigation menu"
            >
              <i className="bi bi-list fs-4"></i>
            </button>
            <div className="fw-semibold text-truncate" id="page-heading"></div>
          </div>
          <UniversalSearch />
          <div className="d-flex align-items-center gap-3">
            {billing?.state === "paid" ? (
              <span
                className="d-inline-flex align-items-center gap-1 fw-bold"
                style={{
                  background: "linear-gradient(135deg,#f59e0b,#f97316)",
                  color: "#fff", padding: "0.3rem 0.7rem", borderRadius: "20px",
                  fontSize: "0.72rem", letterSpacing: "0.5px",
                  boxShadow: "0 2px 8px rgba(249,115,22,.35)",
                }}
                title={typeof billing.days_left === "number" ? `${billing.days_left} days left` : "Pro plan"}
              >
                <i className="bi bi-patch-check-fill"></i> PRO
              </span>
            ) : billing?.on_trial ? (
              <span className="badge text-bg-warning">Trial</span>
            ) : null}

            {/* Contact / support */}
            <div className="position-relative">
              <button
                type="button"
                className="btn border-0 p-0 fs-5 d-flex align-items-center"
                onClick={() => setShowContact((v) => !v)}
                aria-label="Contact support"
                title="Contact support"
                style={{ color: "var(--topbar-color)" }}
              >
                <i className="bi bi-headset"></i>
              </button>
              {showContact && (
                <>
                  <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 1040 }} onClick={() => setShowContact(false)} />
                  <div
                    className="position-absolute end-0 mt-2 p-3 rounded-4 shadow-lg"
                    style={{ zIndex: 1050, width: 260, background: "var(--card, #1e293b)", border: "1px solid var(--line, rgba(148,163,184,.25))" }}
                  >
                    <div className="fw-bold mb-1 d-flex align-items-center gap-2" style={{ color: "var(--topbar-color, #fff)" }}>
                      <i className="bi bi-headset text-primary"></i> Contact us
                    </div>
                    <div className="small text-secondary mb-3">We're here to help with billing & renewals.</div>
                    <a href="https://wa.me/8801613511887" target="_blank" rel="noopener noreferrer"
                       className="d-flex align-items-center gap-2 text-decoration-none mb-2 p-2 rounded-3"
                       style={{ background: "rgba(34,197,94,.12)" }}>
                      <i className="bi bi-whatsapp text-success fs-5"></i>
                      <div>
                        <div className="small text-secondary" style={{ fontSize: "0.7rem" }}>Phone / WhatsApp</div>
                        <div className="fw-semibold" style={{ color: "var(--topbar-color, #fff)" }}>+8801613511887</div>
                      </div>
                    </a>
                    <a href="mailto:admin@stockwhisk.com"
                       className="d-flex align-items-center gap-2 text-decoration-none p-2 rounded-3"
                       style={{ background: "rgba(59,130,246,.12)" }}>
                      <i className="bi bi-envelope-fill text-primary fs-5"></i>
                      <div>
                        <div className="small text-secondary" style={{ fontSize: "0.7rem" }}>Email</div>
                        <div className="fw-semibold" style={{ color: "var(--topbar-color, #fff)" }}>admin@stockwhisk.com</div>
                      </div>
                    </a>
                  </div>
                </>
              )}
            </div>

            <Link href="/app/notifications" className="position-relative text-decoration-none fs-5" aria-label="Notifications" style={{ color: "var(--topbar-color)" }}>
              🔔
              {unread > 0 && (
                <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: "0.6rem", lineHeight: 1.4, minWidth: "1.2rem" }}>
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* Mobile search bar */}
        <div className="d-sm-none border-bottom px-3 py-2" style={{ background: "var(--topbar-bg)" }}>
          <UniversalSearch mobile />
        </div>

        <main id="maincontent" className="p-3 p-md-4 flex-grow-1">
          {children}
        </main>
      </div>
    </div>
  );
}
