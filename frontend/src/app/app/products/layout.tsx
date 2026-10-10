"use client";

import { ModuleRouteGuard } from "@/components/ModuleRouteGuard";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  const { lang } = useLanguage();
  return (
    <ModuleRouteGuard module="inventory_basic" name={lang === "bn" ? "পণ্য ও ক্যাটালগ" : "Products & Catalog"}>
      {children}
    </ModuleRouteGuard>
  );
}
