import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tutorials — Learn StockWhisk POS & Inventory Software",
  description: "Step-by-step StockWhisk tutorials: set up your shop, add products, barcode billing at POS, purchase entries, stock reports and more. Bengali & English guides.",
  alternates: { canonical: "/tutorials" },
  openGraph: {
    title: "Tutorials — Learn StockWhisk POS & Inventory Software",
    description: "Step-by-step StockWhisk tutorials: set up your shop, add products, barcode billing at POS, purchase entries, stock reports and more. Bengali & English guides.",
    url: "/tutorials",
    type: "website",
  },
};

export default function SeoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
