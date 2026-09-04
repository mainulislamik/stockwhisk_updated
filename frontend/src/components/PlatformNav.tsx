"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export default function PlatformNav({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const active = (href: string) => (pathname === href ? "active" : "");

  const ITEMS: { href: string; icon: string; label: string; bn: string }[] = [
    { href: "/platform", icon: "bi-bar-chart-line", label: "Overview", bn: "সামগ্রিক চিত্র" },
    { href: "/platform/shops", icon: "bi-shop", label: "Shops", bn: "দোকানসমূহ" },
    { href: "/platform/users", icon: "bi-people", label: "Active Users", bn: "ব্যবহারকারী" },
    { href: "/platform/plans", icon: "bi-puzzle", label: "Plan & Features", bn: "প্যাকেজ ও ফিচার" },
    { href: "/platform/resellers", icon: "bi-person-badge", label: "Resellers", bn: "রিসেলার পার্টনার" },
    { href: "/platform/payments", icon: "bi-credit-card", label: "Manual Payments", bn: "ম্যানুয়াল পেমেন্ট" },
    { href: "/platform/imports", icon: "bi-inbox-fill", label: "Data Import", bn: "ডাটা ইমপোর্ট" },
    { href: "/platform/api-keys", icon: "bi-plug", label: "API Keys", bn: "এপিআই কি" },
    { href: "/platform/messages", icon: "bi-envelope", label: "Messages", bn: "বার্তাসমূহ" },
    { href: "/platform/blogs", icon: "bi-journal-text", label: "Blogs", bn: "ব্লগ ও পোস্ট" },
    { href: "/platform/software", icon: "bi-download", label: "Software", bn: "সফটওয়্যার" },
    { href: "/platform/shop-data", icon: "bi-trash3", label: "Shop Data Mgmt", bn: "শপ ডাটা রিসেট" },
    { href: "/platform/tutorials", icon: "bi-camera-video", label: "Tutorials", bn: "ভিডিও টিউটোরিয়াল" },
    { href: "/platform/backups", icon: "bi-device-hdd", label: "System Backups", bn: "ক্লাউড ব্যাকআপ" },
    { href: "/platform/mail-server", icon: "bi-envelope-at", label: "Mail Server Admin", bn: "মেইল সার্ভার" },
    { href: "/platform/settings", icon: "bi-gear", label: "Platform Settings", bn: "প্ল্যাটফর্ম সেটিংস" },
  ];

  return (
    <>
      {ITEMS.map((it) => {
        const text = lang === "bn" ? it.bn : it.label;
        return (
          <Link key={it.href} href={it.href} title={text} className={`nav-link ${active(it.href)}`}>
            <i className={`bi ${it.icon}`}></i> {!collapsed && <span>{text}</span>}
          </Link>
        );
      })}
      <a href={`${API_BASE}/admin/`} target="_blank" rel="noreferrer" title={lang === "bn" ? "জ্যাঙ্গো ব্যাকএন্ড" : "Django Admin"} className="nav-link">
        <i className="bi bi-tools"></i> {!collapsed && <span>{lang === "bn" ? "জ্যাঙ্গো ব্যাকএন্ড" : "Django Admin"}</span>}
      </a>
    </>
  );
}
