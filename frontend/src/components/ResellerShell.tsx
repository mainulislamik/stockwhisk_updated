"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, clearTokens, getAccess } from "@/lib/api";

const NAV = [
  { href: "/reseller/dashboard", label: "Dashboard", icon: "bi-speedometer2" },
  { href: "/reseller/shops", label: "My Shops", icon: "bi-shop" },
  { href: "/reseller/commissions", label: "Commissions", icon: "bi-cash-coin" },
  { href: "/reseller/tutorials", label: "Tutorials", icon: "bi-play-btn" },
  { href: "/reseller/profile", label: "Profile", icon: "bi-person-badge" },
];

export default function ResellerShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [canFreeShops, setCanFreeShops] = useState(false);

  useEffect(() => {
    if (!getAccess()) { router.replace("/reseller/login"); return; }
    // Verify this token belongs to an active reseller; else bounce to login.
    api<{ full_name?: string; reseller_code?: string; can_grant_free_shops?: boolean }>("/reseller/profile/")
      .then((p) => { setName(p.full_name || p.reseller_code || "Reseller"); setCanFreeShops(!!p.can_grant_free_shops); setReady(true); })
      .catch(() => { clearTokens(); router.replace("/reseller/login"); });
  }, [router]);

  const nav = canFreeShops
    ? [...NAV, { href: "/reseller/free-shops", label: "Free Shops", icon: "bi-gift" }]
    : NAV;

  function logout() { clearTokens(); router.replace("/reseller/login"); }

  if (!ready) {
    return <div className="d-flex justify-content-center align-items-center vh-100"><span className="spinner-border" role="status" /></div>;
  }

  return (
    <div className="d-flex" style={{ minHeight: "100vh", background: "#f6f8fb" }}>
      <aside className="d-flex flex-column p-3 text-white" style={{ width: "15rem", background: "#0f172a" }}>
        <div className="fw-bold fs-5 mb-1">StockWhisk</div>
        <div className="small text-secondary mb-4">Partner Portal</div>
        <nav className="nav flex-column gap-1 flex-grow-1">
          {nav.map((n) => (
            <Link key={n.href} href={n.href}
              className={`nav-link text-start rounded px-2 ${pathname?.startsWith(n.href) ? "active bg-primary text-white" : "text-light"}`}>
              <i className={`bi ${n.icon} me-2`} />{n.label}
            </Link>
          ))}
        </nav>
        <div className="small text-secondary text-truncate mb-2">{name}</div>
        <button className="btn btn-outline-light btn-sm" onClick={logout}>Log out →</button>
      </aside>
      <main className="flex-grow-1 p-4" style={{ minWidth: 0 }}>{children}</main>
    </div>
  );
}
