import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stockwhisk.com";

export const metadata: Metadata = {
  title: "Contact Us — Support & Sales",
  description:
    "Get in touch with the StockWhisk team. Send us a message, or reach us by phone and WhatsApp at 01613511887 for inventory and POS software support.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact StockWhisk",
    description:
      "Questions about StockWhisk inventory & POS software? Message us, or call/WhatsApp 01613511887.",
    url: "/contact",
    type: "website",
  },
};

const contactJsonLd = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  name: "Contact StockWhisk",
  url: `${SITE_URL}/contact`,
  mainEntity: {
    "@type": "Organization",
    name: "StockWhisk",
    url: SITE_URL,
    email: "contact@stockwhisk.com",
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+8801613511887",
      contactType: "customer support",
      areaServed: "BD",
      availableLanguage: ["en", "bn"],
    },
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactJsonLd) }}
      />
      {children}
    </>
  );
}
