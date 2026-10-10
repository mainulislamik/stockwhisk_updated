"use client";

import { ModuleRouteGuard } from "@/components/ModuleRouteGuard";
import { useLanguage } from "@/contexts/LanguageContext";

export default function IntegrationsLayout({ children }: { children: React.ReactNode }) {
  const { lang } = useLanguage();
  return (
    <ModuleRouteGuard module="integrations" name={lang === "bn" ? "ওয়েবসাইট ও কুরিয়ার ইন্টিগ্রেশন" : "Integrations Hub"}>
      {children}
    </ModuleRouteGuard>
  );
}
