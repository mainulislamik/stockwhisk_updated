import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog — Retail, Inventory & POS Tips",
  description:
    "Guides and tips on inventory management, POS, barcode billing and growing a retail business — from the StockWhisk team.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "StockWhisk Blog",
    description:
      "Guides on inventory, POS and running a retail shop from the StockWhisk team.",
    url: "/blog",
    type: "website",
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
