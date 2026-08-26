"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Nav from "@/components/Nav";
import UniversalSearch from "@/components/UniversalSearch";
import { impersonatingShop, isImpersonating, returnToAdmin } from "@/lib/impersonation";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageToggle from "@/components/LanguageToggle";
import { api } from "@/lib/api";
import { useBranding } from "@/lib/branding";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, billing, can, isOwner } = useAuth();
  const { t } = useLanguage();
  const branding = useBranding();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [openGroup, setOpenGroup] = useState("products");
  const [mounted, setMounted] = useState(false);
  const [unread, setUnread] = useState(0);
  const [showContact, setShowContact] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [showQuick, setShowQuick] = useState(false);

  // Core shortcuts shown in the Quick Access menu (permission-aware).
  const QUICK_ITEMS = [
    { href: "/app/pos", icon: "bi-cart-plus-fill", label: t("nav_new_sale"), color: "#2563eb", perms: ["create_sale"] },
    { href: "/app/products", icon: "bi-box-seam-fill", label: t("nav_products"), color: "#7c3aed", perms: ["view_products"] },
    { href: "/app/inventory", icon: "bi-boxes", label: t("nav_inventory"), color: "#0891b2", perms: ["view_inventory"] },
    { href: "/app/sales", icon: "bi-receipt", label: t("nav_invoices"), color: "#059669", perms: ["view_sales"] },
    { href: "/app/customers", icon: "bi-people-fill", label: t("nav_customers"), color: "#d97706", perms: ["view_customers", "manage_customers"] },
    { href: "/app/dues", icon: "bi-cash-coin", label: t("nav_dues"), color: "#e11d48", perms: ["view_customers", "manage_customers"] },
    { href: "/app/reports", icon: "bi-graph-up-arrow", label: t("nav_reports"), color: "#0ea5e9", perms: ["view_reports"] },
    { href: "/app/service/tickets", icon: "bi-wrench-adjustable", label: t("nav_service"), color: "#9333ea", perms: ["view_service", "manage_service"] },
  ];
  const quickItems = QUICK_ITEMS.filter((q) => isOwner || q.perms.some((p) => can(p)));
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Quick Access: portal dropdown anchored under its icon. Hover or click opens
  // it; a short close delay lets the pointer travel from the icon to the panel.
  const quickBtnRef = useRef<HTMLButtonElement>(null);
  const quickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [quickPos, setQuickPos] = useState<{ top: number; right: number }>({ top: 62, right: 14 });
  const openQuick = () => {
    if (quickTimer.current) clearTimeout(quickTimer.current);
    const r = quickBtnRef.current?.getBoundingClientRect();
    if (r) setQuickPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
    setShowQuick(true);
  };
  const closeQuickSoon = () => {
    if (quickTimer.current) clearTimeout(quickTimer.current);
    quickTimer.current = setTimeout(() => setShowQuick(false), 180);
  };

  useEffect(() => {
    setMounted(true);
    setCollapsed(localStorage.getItem("sbCollapsed") === "1");
    setOpenGroup(localStorage.getItem("sbGroup") || "products");
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (user.is_reseller && !user.shop) {
      router.replace("/reseller/dashboard");
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
            {!collapsed && (branding.logo
              ? <span style={{ background: "#fff", borderRadius: 10, padding: "5px 10px", display: "inline-flex" }}>
                  <img src={branding.logo} alt="Logo" style={{ height: 44, maxWidth: 170, objectFit: "contain", display: "block" }} />
                </span>
              : <div className="fs-5 fw-bold brand-title lh-1" style={{ color: "var(--text-main)" }}>StockWhisk</div>)}
            <button
              onClick={toggle}
              className="btn btn-sm flex-shrink-0 ms-auto p-0"
              style={{ color: "var(--text-muted)" }}
              title={collapsed ? t("sidebar_expand") : t("sidebar_collapse")}
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
                <div className="fw-semibold lh-1 text-truncate" style={{ fontSize: "0.9rem", color: "var(--text-main)" }}>{user.shop_name || t("nav_my_shop")}</div>
                <div className="d-flex align-items-center gap-1 mt-1 flex-wrap">
                  {(user.shop_code || user.shop) && (
                    <span className="badge rounded-pill bg-primary bg-opacity-25 text-primary border border-primary border-opacity-25" style={{ fontSize: "0.65rem", padding: "0.15rem 0.4rem" }}>
                      {user.shop_code || `SW-${1000 + (user.shop || 0)}`}
                    </span>
                  )}
                  <span className="small text-truncate" style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                    {billing?.plan ? t("nav_plan", { plan: billing.plan }) : " "}
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
            title={collapsed ? t("nav_logout") : ""}
          >
            {collapsed ? "⎋" : `${t("nav_logout")} →`}
          </a>
        </div>
      </aside>

      {/* Sidebar (mobile offcanvas) */}
      <div className="offcanvas offcanvas-start sidebar d-md-none" tabIndex={-1} id="mobileNav" style={{ width: "15rem" }}>
        <div className="offcanvas-header border-bottom flex-column align-items-stretch gap-3" style={{ borderColor: "var(--line)" }}>
          <div className="d-flex align-items-center justify-content-between">
            {branding.logo
              ? <span style={{ background: "#fff", borderRadius: 10, padding: "5px 10px", display: "inline-flex" }}>
                  <img src={branding.logo} alt="Logo" style={{ height: 44, maxWidth: 170, objectFit: "contain", display: "block" }} />
                </span>
              : <div className="fs-5 fw-bold brand-title lh-1" style={{ color: "var(--text-main)" }}>StockWhisk</div>}
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
          <div className="d-print-none d-flex flex-wrap align-items-center justify-content-between gap-2 px-3 py-2 text-white" style={{ background: "var(--brand-500)" }}>
            <span className="small">
              🔓 You are viewing <strong>{impersonatingShop()}</strong> as a platform admin.
            </span>
            <button className="btn btn-light btn-sm py-0" onClick={returnToAdmin}>
              ← Return to admin
            </button>
          </div>
        )}
        {mounted && user?.shop_is_demo && (
          <div className="d-print-none d-flex flex-wrap align-items-center justify-content-between gap-2 px-3 py-2 text-white" style={{ background: "#059669" }}>
            <span className="small">
              🔴 <strong>Demo mode</strong> — you can browse everything, but changes are disabled (read-only).
            </span>
            <button className="btn btn-light btn-sm py-0" onClick={logout}>
              ← Exit demo
            </button>
          </div>
        )}
        <header className="topbar px-3 py-3 d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <button
              className="btn btn-sm d-md-none border-0 p-1"
              type="button"
              data-bs-toggle="offcanvas"
              data-bs-target="#mobileNav"
              aria-label="Open navigation menu"
              style={{ color: "var(--topbar-color)" }}
            >
              <i className="bi bi-list fs-3"></i>
            </button>
            <div className="fw-semibold text-truncate" id="page-heading"></div>
          </div>
          <UniversalSearch />
          <div className="d-flex align-items-center gap-3">
            {billing?.state === "paid" ? (
              <button
                type="button"
                onClick={() => setShowPlan((v) => !v)}
                className="d-inline-flex align-items-center gap-1 fw-bold border-0"
                title="View your plan"
                style={{
                  background: "linear-gradient(135deg,#f59e0b,#f97316)",
                  color: "#fff", padding: "0.3rem 0.7rem", borderRadius: "20px",
                  fontSize: "0.72rem", letterSpacing: "0.5px",
                  boxShadow: "0 2px 8px rgba(249,115,22,.35)",
                }}
              >
                <i className="bi bi-patch-check-fill"></i> PRO
              </button>
            ) : billing?.state === "free" ? (
              <span className="badge text-bg-success border-0" title="Lifetime-free shop">
                <i className="bi bi-gift-fill"></i> FREE
              </span>
            ) : billing?.on_trial ? (
              <button type="button" onClick={() => setShowPlan((v) => !v)}
                className="badge text-bg-warning border-0" title="View your plan"
                style={{ cursor: "pointer" }}>
                Trial
              </button>
            ) : null}

            <ThemeToggle />
            <LanguageToggle />

            {/* Quick access — hover or click the grid icon to reveal shortcuts */}
            {quickItems.length > 0 && (
              <>
                <button
                  ref={quickBtnRef}
                  type="button"
                  className="btn border-0 p-0 fs-5 d-flex align-items-center"
                  aria-label="Quick access"
                  title="Quick access"
                  style={{ color: showQuick ? "var(--bs-primary, #2563eb)" : "var(--topbar-color)" }}
                  onMouseEnter={openQuick}
                  onMouseLeave={closeQuickSoon}
                  onClick={() => (showQuick ? setShowQuick(false) : openQuick())}
                >
                  <i className="bi bi-grid-3x3-gap-fill"></i>
                </button>
                {showQuick && mounted && createPortal(
                  <>
                    <div
                      className="position-fixed p-2 rounded-4 shadow-lg bg-body border"
                      style={{ zIndex: 100001, top: quickPos.top, right: quickPos.right, width: 300 }}
                      onMouseEnter={openQuick}
                      onMouseLeave={closeQuickSoon}
                    >
                      <div className="small fw-bold text-secondary px-2 pb-2 d-flex align-items-center gap-1">
                        <i className="bi bi-lightning-charge-fill text-warning"></i> Quick access
                      </div>
                      <div className="d-grid gap-1" style={{ gridTemplateColumns: "1fr 1fr" }}>
                        {quickItems.map((q) => (
                          <Link
                            key={q.href}
                            href={q.href}
                            onClick={() => setShowQuick(false)}
                            className="d-flex flex-column align-items-center justify-content-center gap-1 p-3 rounded-3 text-decoration-none text-body quick-tile"
                            style={{ transition: "background .15s" }}
                          >
                            <span className="d-inline-flex align-items-center justify-content-center rounded-3"
                                  style={{ width: 40, height: 40, background: `${q.color}1a`, color: q.color }}>
                              <i className={`bi ${q.icon} fs-5`}></i>
                            </span>
                            <span className="small fw-medium">{q.label}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </>,
                  document.body
                )}
              </>
            )}

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
              {showContact && mounted && createPortal(
                <>
                  <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 100000 }} onClick={() => setShowContact(false)} />
                  <div
                    className="position-fixed p-3 rounded-4 shadow-lg"
                    style={{ zIndex: 100001, top: 62, right: 14, width: 264, background: "#0f172a", border: "1px solid rgba(148,163,184,.28)", color: "#fff" }}
                  >
                    <div className="fw-bold mb-1 d-flex align-items-center gap-2">
                      <i className="bi bi-headset text-primary"></i> {t("nav_contact_us") || "Contact us"}
                    </div>
                    <div className="small mb-3" style={{ color: "#94a3b8" }}>{t("nav_contact") || "We're here to help with billing & renewals."}</div>
                    <a href="https://wa.me/8801613511887" target="_blank" rel="noopener noreferrer"
                       className="d-flex align-items-center gap-2 text-decoration-none mb-2 p-2 rounded-3"
                       style={{ background: "rgba(34,197,94,.15)", color: "#fff" }}>
                      <i className="bi bi-whatsapp text-success fs-5"></i>
                      <div>
                        <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{t("sup_lbl_phone") || "Phone / WhatsApp"}</div>
                        <div className="fw-semibold">+8801613511887</div>
                      </div>
                    </a>
                    <a href="mailto:admin@stockwhisk.com"
                       className="d-flex align-items-center gap-2 text-decoration-none p-2 rounded-3"
                       style={{ background: "rgba(59,130,246,.15)", color: "#fff" }}>
                      <i className="bi bi-envelope-fill text-primary fs-5"></i>
                      <div>
                        <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{t("sup_lbl_email") || "Email"}</div>
                        <div className="fw-semibold">admin@stockwhisk.com</div>
                      </div>
                    </a>
                  </div>
                </>,
                document.body
              )}
            </div>

            {showPlan && mounted && billing && createPortal(
              (() => {
                const paid = billing.state === "paid";
                const dleft = billing.days_left ?? 0;
                const total = paid ? 30 : 45;
                const pct = Math.max(0, Math.min(100, Math.round((dleft / total) * 100)));
                const barColor = dleft <= 3 ? "#ef4444" : dleft <= 7 ? "#f59e0b" : "#10b981";
                const endStr = billing.ends_at
                  ? new Date(billing.ends_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
                  : "—";
                return (
                  <>
                    <style>{`
                      @keyframes slideDownFades {
                        from { opacity: 0; transform: translateY(-10px) scale(0.98); }
                        to { opacity: 1; transform: translateY(0) scale(1); }
                      }
                      .modern-plan-modal {
                        animation: slideDownFades 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                        box-shadow: 0 20px 40px -10px rgba(0,0,0,0.6), 0 0 30px 0 var(--modal-glow);
                        backdrop-filter: blur(20px);
                        -webkit-backdrop-filter: blur(20px);
                      }
                      .modern-plan-btn {
                        transition: all 0.2s ease;
                      }
                      .modern-plan-btn:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 8px 16px rgba(0,0,0,0.3);
                        filter: brightness(1.1);
                      }
                    `}</style>
                    <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 100000, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(3px)" }} onClick={() => setShowPlan(false)} />
                    <div className="position-fixed p-0 rounded-4 overflow-hidden modern-plan-modal"
                      style={{ 
                        zIndex: 100001, top: 70, right: 16, width: 340, 
                        background: "rgba(15, 23, 42, 0.75)", 
                        border: "1px solid rgba(255,255,255,0.1)", 
                        color: "#fff",
                        '--modal-glow': paid ? 'rgba(249, 115, 22, 0.15)' : 'rgba(59, 130, 246, 0.15)'
                      } as React.CSSProperties}>
                      
                      {/* header */}
                      <div className="position-relative overflow-hidden" style={{ padding: "24px 24px 16px" }}>
                        {/* Glow orb */}
                        <div className="position-absolute rounded-circle" style={{
                           width: 200, height: 200, top: -80, right: -80,
                           background: paid ? "rgba(249,115,22,0.25)" : "rgba(59,130,246,0.25)",
                           filter: "blur(50px)", zIndex: 0, pointerEvents: "none"
                        }}></div>
                        
                        <div className="position-relative z-1 d-flex align-items-start justify-content-between mb-2">
                           <div className="d-flex align-items-center gap-3">
                              <div className="d-flex align-items-center justify-content-center rounded-4 shadow-sm" style={{ width: 48, height: 48, background: paid ? "linear-gradient(135deg, #f59e0b, #f97316)" : "linear-gradient(135deg, #3b82f6, #6366f1)" }}>
                                 <i className={`bi ${paid ? "bi-star-fill" : "bi-lightning-fill"} text-white fs-4`}></i>
                              </div>
                              <div>
                                 <div className="fw-bold fs-5 lh-1 text-white mb-1">{billing.plan_name || (paid ? "Pro Plan" : "Free Trial")}</div>
                                 <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{paid ? (t("plan_title") || "Premium Access") : (t("plan_free_trial") || "Free Trial")}</div>
                              </div>
                           </div>
                           <span className="badge rounded-pill px-2 py-1 mt-1" style={{ background: paid ? "rgba(249,115,22,0.15)" : "rgba(59,130,246,0.15)", color: paid ? "#fbd38d" : "#93c5fd", border: `1px solid ${paid ? "rgba(249,115,22,0.3)" : "rgba(59,130,246,0.3)"}` }}>
                             {paid ? "ACTIVE" : "TRIAL"}
                           </span>
                        </div>
                      </div>

                      {/* body */}
                      <div className="px-4 pb-4 position-relative z-1">
                        <div className="p-3 rounded-4 mb-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                           <div className="d-flex justify-content-between align-items-end mb-3">
                              <span style={{ color: "#94a3b8", fontSize: "0.85rem", fontWeight: 500 }}>{t("nav_trial_rem") || "Time Remaining"}</span>
                              <div className="d-flex align-items-baseline gap-1">
                                 <span className="fw-bolder" style={{ fontSize: "2rem", lineHeight: 1, color: barColor, textShadow: `0 0 12px ${barColor}80` }}>{dleft}</span>
                                 <span style={{ color: "#cbd5e1", fontSize: "0.9rem", fontWeight: 500 }}>{t("prod_repl_guarantee_days") ? t("prod_repl_guarantee_days").replace(/.*?(দিন|day).*/i, "$1") : "days"}</span>
                              </div>
                           </div>
                           <div className="rounded-pill mb-2 overflow-hidden position-relative" style={{ height: 8, background: "rgba(255,255,255,0.1)" }}>
                             <div className="position-absolute top-0 start-0 h-100 rounded-pill" style={{ width: `${pct}%`, background: barColor, boxShadow: `0 0 10px ${barColor}` }} />
                           </div>
                           <div className="d-flex justify-content-between small mt-2">
                              <span style={{ color: "#64748b", fontSize: "0.75rem", fontWeight: 600 }}>{pct}% {t("nav_trial_rem") || "remaining"}</span>
                              <span style={{ color: "#64748b", fontSize: "0.75rem", fontWeight: 600 }}>Total {total} days</span>
                           </div>
                        </div>

                        <div className="d-flex justify-content-between align-items-center mb-3 px-1">
                          <span style={{ color: "#94a3b8", fontSize: "0.9rem" }}><i className="bi bi-calendar-event me-2 opacity-75"></i>{paid ? "Renews on" : "Ends on"}</span>
                          <span className="fw-semibold text-white" style={{ fontSize: "0.95rem" }}>{endStr}</span>
                        </div>
                        <div className="d-flex justify-content-between align-items-center mb-4 px-1">
                          <span style={{ color: "#94a3b8", fontSize: "0.9rem" }}><i className="bi bi-info-circle me-2 opacity-75"></i>{t("cust_col_status") || "Status"}</span>
                          <span className="fw-semibold text-white text-capitalize" style={{ fontSize: "0.95rem" }}>{billing.status || (paid ? "active" : "trial")}</span>
                        </div>

                        <button className="btn w-100 rounded-pill fw-bold modern-plan-btn d-flex justify-content-center align-items-center gap-2 border-0"
                          style={{ background: paid ? "linear-gradient(135deg, #f97316, #ea580c)" : "linear-gradient(135deg, #3b82f6, #2563eb)", color: "#fff", padding: "12px", fontSize: "1rem" }}
                          onClick={() => { setShowPlan(false); setShowContact(true); }}>
                          <i className="bi bi-rocket-takeoff"></i> {paid ? (t("plan_title") || "Renew / Upgrade") : "Upgrade to Pro"}
                        </button>
                      </div>
                    </div>
                  </>
                );
              })(),
              document.body
            )}

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
