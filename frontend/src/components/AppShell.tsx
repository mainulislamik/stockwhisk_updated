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
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
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
        <div className="d-flex flex-column gap-3 p-3 border-bottom border-secondary border-opacity-25">
          <div className="d-flex align-items-center justify-content-between">
            {!collapsed && (
              <div className="d-flex align-items-center gap-2">
                {user.shop_logo ? (
                  <img src={user.shop_logo} alt="Shop Logo" style={{ height: "28px", maxWidth: "140px", objectFit: "contain" }} />
                ) : (
                  <div className="fs-5 fw-bold brand-title lh-1">StockWhisk</div>
                )}
              </div>
            )}
            <button
              onClick={toggle}
              className="btn btn-sm text-white-50 flex-shrink-0 ms-auto p-0"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? "»" : "«"}
            </button>
          </div>
          
          {!collapsed && (
            <div className="d-flex align-items-center gap-2 bg-white bg-opacity-10 p-2 rounded shadow-sm border border-white border-opacity-10">
              <div 
                className="bg-white bg-opacity-25 rounded d-flex align-items-center justify-content-center flex-shrink-0 text-white fw-bold shadow-sm"
                style={{ width: "32px", height: "32px" }}
              >
                {user.shop_name ? user.shop_name.charAt(0).toUpperCase() : "🏪"}
              </div>
              <div className="text-truncate min-vw-0">
                <div className="fw-semibold text-white lh-1 text-truncate" style={{ fontSize: "0.9rem" }}>{user.shop_name || "My Shop"}</div>
                <div className="small text-white-50 text-truncate mt-1" style={{ fontSize: "0.7rem" }}>{billing?.plan ? `${billing.plan} plan` : " "}</div>
              </div>
            </div>
          )}
        </div>
        <nav className="nav flex-column flex-grow-1 p-2 gap-1 overflow-auto">
          {mounted && <Nav collapsed={collapsed} openGroup={openGroup} setGroup={setGroup} />}
        </nav>
        <div className="p-3 border-top border-secondary border-opacity-25 small text-white-50">
          {!collapsed && (
            <div>
              <div className="text-truncate">{user.email}</div>
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
      <div className="offcanvas offcanvas-start sidebar text-light d-md-none" tabIndex={-1} id="mobileNav" style={{ width: "15rem" }}>
        <div className="offcanvas-header border-bottom border-secondary border-opacity-25 flex-column align-items-stretch gap-3">
          <div className="d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-2">
              {user.shop_logo ? (
                <img src={user.shop_logo} alt="Shop Logo" style={{ height: "28px", maxWidth: "140px", objectFit: "contain" }} />
              ) : (
                <div className="fs-5 fw-bold brand-title lh-1">StockWhisk</div>
              )}
            </div>
            <button type="button" className="btn-close btn-close-white p-0" data-bs-dismiss="offcanvas" aria-label="Close"></button>
          </div>
          
          <div className="d-flex align-items-center gap-2 bg-white bg-opacity-10 p-2 rounded shadow-sm border border-white border-opacity-10">
            <div 
              className="bg-white bg-opacity-25 rounded d-flex align-items-center justify-content-center flex-shrink-0 text-white fw-bold shadow-sm"
              style={{ width: "32px", height: "32px" }}
            >
              {user.shop_name ? user.shop_name.charAt(0).toUpperCase() : "🏪"}
            </div>
            <div className="text-truncate min-vw-0">
              <div className="fw-semibold text-white lh-1 text-truncate" style={{ fontSize: "0.9rem" }}>{user.shop_name || "My Shop"}</div>
              <div className="small text-white-50 text-truncate mt-1" style={{ fontSize: "0.7rem" }}>{billing?.plan ? `${billing.plan} plan` : " "}</div>
            </div>
          </div>
        </div>
        <div className="offcanvas-body p-2">
          <nav className="nav flex-column gap-1">
            {mounted && <Nav collapsed={false} openGroup={openGroup} setGroup={setGroup} />}
          </nav>
          <div className="border-top border-secondary border-opacity-25 mt-2 pt-2 small text-white-50">
            <div className="text-truncate">{user.email}</div>
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
            {billing?.on_trial && <span className="badge text-bg-warning">Trial</span>}
            <Link href="/app/notifications" className="position-relative text-decoration-none fs-5" aria-label="Notifications" onClick={() => setUnread(0)} style={{ color: "var(--topbar-color)" }}>
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
