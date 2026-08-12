import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Inventory & POS Plans",
  description:
    "Simple, transparent pricing for StockWhisk inventory and POS software. Start with a free trial, then pick a monthly plan that fits your retail shop.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "StockWhisk Pricing — Inventory & POS Plans",
    description:
      "Transparent monthly pricing for StockWhisk. Free trial, then a plan that fits your shop.",
    url: "/pricing",
    type: "website",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
