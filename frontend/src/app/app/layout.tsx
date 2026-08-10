import AppShell from "@/components/AppShell";
import PageWrapper from "@/components/PageWrapper";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <PageWrapper>{children}</PageWrapper>
    </AppShell>
  );
}
