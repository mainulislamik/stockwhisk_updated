"use client";

import { ModuleRouteGuard } from "@/components/ModuleRouteGuard";
import { useLanguage } from "@/contexts/LanguageContext";

export default function PosLayout({ children }: { children: React.ReactNode }) {
  const { lang } = useLanguage();
  return (
    <ModuleRouteGuard module="core_pos" name={lang === "bn" ? "পি ও এস (POS)" : "Point of Sale"}>
      {children}
    </ModuleRouteGuard>
  );
}
