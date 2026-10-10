"use client";

import { ModuleRouteGuard } from "@/components/ModuleRouteGuard";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ServiceLayout({ children }: { children: React.ReactNode }) {
  const { lang } = useLanguage();
  return (
    <ModuleRouteGuard module="service_repair,mobile_repair_pos" name={lang === "bn" ? "সার্ভিসিং ও মোবাইল রিপেয়ার" : "Service & Repair"}>
      {children}
    </ModuleRouteGuard>
  );
}
