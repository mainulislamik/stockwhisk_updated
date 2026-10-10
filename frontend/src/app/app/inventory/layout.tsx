"use client";

import { ModuleRouteGuard } from "@/components/ModuleRouteGuard";
import { useLanguage } from "@/contexts/LanguageContext";

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  const { lang } = useLanguage();
  return (
    <ModuleRouteGuard module="inventory_basic,inventory_advanced" name={lang === "bn" ? "ইনভেন্টরি ও স্টক" : "Inventory & Stock"}>
      {children}
    </ModuleRouteGuard>
  );
}
