import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import ThemeRegistry from '@/components/ThemeRegistry';
import { AuthProvider } from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "StockWhisk",
  description: "StockWhisk — inventory management",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0B1120",
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
        <ThemeRegistry>
          <AuthProvider>{children}</AuthProvider>
        </ThemeRegistry>
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
