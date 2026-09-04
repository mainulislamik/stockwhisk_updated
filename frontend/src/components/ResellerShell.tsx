"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, clearTokens, getAccess } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";

export default function ResellerShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, lang } = useLanguage();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [canFreeShops, setCanFreeShops] = useState(false);

  const NAV = [
    { href: "/reseller/dashboard", label: t("nav_dashboard") || "Dashboard", icon: "bi-speedometer2" },
    { href: "/reseller/shops", label: lang === "bn" ? "আমার শপসমূহ" : "My Shops", icon: "bi-shop" },
    { href: "/reseller/commissions", label: lang === 'bn' ? "কমিশন বিবরণী" : "Commissions", icon: "bi-cash-coin" },
    { href: "/reseller/tutorials", label: lang === "bn" ? "ভিডিও টিউটোরিয়াল" : "Tutorials", icon: "bi-play-btn" },
    { href: "/reseller/profile", label: lang === 'bn' ? "প্রোফাইল" : "Profile", icon: "bi-person-badge" },
  ];

  useEffect(() => {
    if (!getAccess()) { router.replace("/reseller/login"); return; }
    // Verify this token belongs to an active reseller; else bounce to login.
    api<{ full_name?: string; reseller_code?: string; can_grant_free_shops?: boolean }>("/reseller/profile/")
      .then((p) => { setName(p.full_name || p.reseller_code || "Reseller"); setCanFreeShops(!!p.can_grant_free_shops); setReady(true); })
      .catch(() => { clearTokens(); router.replace("/reseller/login"); });
  }, [router]);

  const nav = canFreeShops
    ? [...NAV, { href: "/reseller/free-shops", label: t("res_free_shops") || "Free Shops", icon: "bi-gift" }]
    : NAV;

  function logout() { clearTokens(); router.replace("/reseller/login"); }

  if (!ready) {
    return <div className="d-flex justify-content-center align-items-center vh-100"><span className="spinner-border" role="status" /></div>;
  }

  return (
    <div className="d-flex" style={{ minHeight: "100vh", background: "#f6f8fb" }}>
      <aside className="d-flex flex-column p-3 text-white" style={{ width: "15rem", background: "#0f172a" }}>
        <div className="d-flex justify-content-between align-items-center mb-1">
          <div className="fw-bold fs-5">StockWhisk</div>
          <LanguageToggle />
        </div>
        <div className="small text-secondary mb-4">{lang === 'bn' ? "রিসেলার পার্টনার পোর্টাল" : "Partner Portal"}</div>
        <nav className="nav flex-column gap-1 flex-grow-1">
          {nav.map((n) => (
            <Link key={n.href} href={n.href}
              className={`nav-link text-start rounded px-2 ${pathname?.startsWith(n.href) ? "active bg-primary text-white" : "text-light"}`}>
              <i className={`bi ${n.icon} me-2`} />{n.label}
            </Link>
          ))}
        </nav>
        <div className="small text-secondary text-truncate mb-2">{name}</div>
        <button className="btn btn-outline-light btn-sm" onClick={logout}>{lang === "bn" ? "লগআউট →" : "Log out →"}</button>
      </aside>
      <main className="flex-grow-1 p-4" style={{ minWidth: 0 }}>{children}</main>
    </div>
  );
}
