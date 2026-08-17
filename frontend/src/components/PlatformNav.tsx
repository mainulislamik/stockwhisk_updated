"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

const ITEMS: { href: string; icon: string; label: string }[] = [
  { href: "/platform", icon: "bi-bar-chart-line", label: "Overview" },
  { href: "/platform/shops", icon: "bi-shop", label: "Shops" },
  { href: "/platform/users", icon: "bi-people", label: "Active Users" },
  { href: "/platform/plans", icon: "bi-puzzle", label: "Plan & Features" },
  { href: "/platform/resellers", icon: "bi-person-badge", label: "Resellers" },
  { href: "/platform/payments", icon: "bi-credit-card", label: "Manual Payments" },
  { href: "/platform/imports", icon: "bi-inbox-fill", label: "Data Import" },
  { href: "/platform/api-keys", icon: "bi-plug", label: "API Keys" },
  { href: "/platform/messages", icon: "bi-envelope", label: "Messages" },
  { href: "/platform/blogs", icon: "bi-journal-text", label: "Blogs" },
  { href: "/platform/software", icon: "bi-download", label: "Software" },
  { href: "/platform/tutorials", icon: "bi-camera-video", label: "Tutorials" },
  { href: "/platform/backups", icon: "bi-device-hdd", label: "System Backups" },
  { href: "/platform/mail-server", icon: "bi-envelope-at", label: "Mail Server Admin" },
  { href: "/platform/settings", icon: "bi-gear", label: "Platform Settings" },
];

export default function PlatformNav({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const active = (href: string) => (pathname === href ? "active" : "");

  return (
    <>
      {ITEMS.map((it) => (
        <Link key={it.href} href={it.href} title={it.label} className={`nav-link ${active(it.href)}`}>
          <i className={`bi ${it.icon}`}></i> {!collapsed && <span>{it.label}</span>}
        </Link>
      ))}
      <a href={`${API_BASE}/admin/`} target="_blank" rel="noreferrer" title="Django Admin" className="nav-link">
        <i className="bi bi-tools"></i> {!collapsed && <span>Django Admin</span>}
      </a>
    </>
  );
}
