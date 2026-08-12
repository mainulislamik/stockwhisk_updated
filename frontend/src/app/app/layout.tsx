import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import PageWrapper from "@/components/PageWrapper";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <PageWrapper>{children}</PageWrapper>
    </AppShell>
  );
}
