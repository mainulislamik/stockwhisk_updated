"use client";

import { ModuleRouteGuard } from "@/components/ModuleRouteGuard";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ManufacturingLayout({ children }: { children: React.ReactNode }) {
  const { lang } = useLanguage();
  return (
    <ModuleRouteGuard module="manufacturing" name={lang === "bn" ? "ম্যানুফ্যাকচারিং ও প্রোডাকশন" : "Manufacturing & Production"}>
      {children}
    </ModuleRouteGuard>
  );
}
