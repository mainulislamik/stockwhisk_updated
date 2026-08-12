import type { Metadata } from "next";
import PlatformShell from "@/components/PlatformShell";

export const metadata: Metadata = {
  title: "Platform Admin",
  robots: { index: false, follow: false },
};

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <PlatformShell>{children}</PlatformShell>;
}
