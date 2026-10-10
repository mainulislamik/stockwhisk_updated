"use client";

import { ModuleRouteGuard } from "@/components/ModuleRouteGuard";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  const { lang } = useLanguage();
  return (
    <ModuleRouteGuard module="sales_crm" name={lang === "bn" ? "বিক্রয় ও ইনভয়েস" : "Sales & Invoices"}>
      {children}
    </ModuleRouteGuard>
  );
}
