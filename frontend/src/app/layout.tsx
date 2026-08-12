import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import ThemeRegistry from '@/components/ThemeRegistry';
import { AuthProvider } from "@/components/AuthProvider";
import { Toaster } from "react-hot-toast";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stockwhisk.com";
const SITE_NAME = "StockWhisk";
const SITE_DESC =
  "StockWhisk is cloud inventory management and POS software for retail shops — barcode billing, stock control, warranty tracking, sales reports and multi-branch support.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "StockWhisk — Inventory Management & POS Software for Retail",
    template: "%s · StockWhisk",
  },
  description: SITE_DESC,
  keywords: [
    "inventory management software",
    "POS software",
    "point of sale",
    "barcode billing software",
    "retail software Bangladesh",
    "stock management",
    "warranty tracking",
    "shop management software",
  ],
  applicationName: SITE_NAME,
  manifest: "/manifest.json",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: SITE_URL,
    title: "StockWhisk — Inventory Management & POS Software for Retail",
    description: SITE_DESC,
    // og:image is supplied automatically by app/opengraph-image.tsx
  },
  twitter: {
    card: "summary_large_image",
    title: "StockWhisk — Inventory Management & POS Software",
    description: SITE_DESC,
  },
};

export const viewport: Viewport = {
  themeColor: "#0B1120",
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/opengraph-image`,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "BDT" },
      description: SITE_DESC,
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-100">
      <head>
        {/* Same CDN assets as the original Django base.html, so the look matches exactly. */}
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
          rel="stylesheet"
        />
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"
          rel="stylesheet"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-100">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <ThemeRegistry>
          <AuthProvider>{children}</AuthProvider>
        </ThemeRegistry>
        <Toaster position="bottom-center" />
        {/* Bootstrap bundle for offcanvas/modal/dropdown behaviour. */}
        <Script
          src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
          strategy="afterInteractive"
        />
        <Script
          src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
