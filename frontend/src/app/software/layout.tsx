import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Download StockWhisk App — Android Scanner APK & Desktop Software",
  description: "Download the official StockWhisk mobile scanner app (Android APK) and desktop software. Free inventory & POS companion apps for your retail shop.",
  alternates: { canonical: "/software" },
  openGraph: {
    title: "Download StockWhisk App — Android Scanner APK & Desktop Software",
    description: "Download the official StockWhisk mobile scanner app (Android APK) and desktop software. Free inventory & POS companion apps for your retail shop.",
    url: "/software",
    type: "website",
  },
};

export default function SeoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
