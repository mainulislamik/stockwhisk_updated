import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Request a Free Demo — StockWhisk Inventory & POS",
  description: "See StockWhisk in action. Request a free live demo of our inventory management and POS software for your retail shop — barcode billing, stock control and reports.",
  alternates: { canonical: "/demo" },
  openGraph: {
    title: "Request a Free Demo — StockWhisk Inventory & POS",
    description: "See StockWhisk in action. Request a free live demo of our inventory management and POS software for your retail shop — barcode billing, stock control and reports.",
    url: "/demo",
    type: "website",
  },
};

export default function SeoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
