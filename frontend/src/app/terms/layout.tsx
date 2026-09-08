import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — StockWhisk",
  description: "Terms of service for using StockWhisk cloud inventory management and POS software — accounts, billing, fair use and data policies for retail shops.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service — StockWhisk",
    description: "Terms of service for using StockWhisk cloud inventory management and POS software — accounts, billing, fair use and data policies for retail shops.",
    url: "/terms",
    type: "website",
  },
};

export default function SeoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
