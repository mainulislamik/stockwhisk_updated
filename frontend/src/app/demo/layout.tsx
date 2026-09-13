import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "লাইভ ডেমো এক্সপ্লোর করুন — StockWhisk Inventory & POS Software Live Demo",
  description: "StockWhisk-এর লাইভ ডেমো শপ এক্সপ্লোর করুন। জেনারেল রিটেইল, সুপারশপ, ফ্যাশন ও মোবাইল রিপেয়ার শপের জন্য ক্লাউড POS, বারকোড বিলিং, স্টক খাতা, ওয়ারেন্টি ও লাভ-ক্ষতির রিপোর্ট রিয়েল-টাইমে যাচাই করুন। কোনো রেজিস্ট্রেশন ছাড়াই ১-ক্লিকে ফ্রি ডেমো দেখুন।",
  keywords: [
    "StockWhisk live demo",
    "POS software demo Bangladesh",
    "ইনভেন্টরি সফটওয়্যার ডেমো",
    "সুপারশপ সফটওয়্যার ডেমো",
    "মোবাইল রিপেয়ার সফটওয়্যার",
    "retail POS demo",
    "free POS trial Bangladesh",
    "cloud POS software",
    "barcode billing demo",
    "inventory management demo"
  ],
  alternates: { canonical: "https://stockwhisk.com/demo" },
  openGraph: {
    title: "StockWhisk Live Interactive Demo — Inventory & POS Management",
    description: "১-ক্লিকে আপনার ব্যবসার ধরন অনুযায়ী StockWhisk লাইভ ডেমো স্টোর ঘুরে দেখুন। POS বিলিং, বারকোড ও স্টক ম্যানেজমেন্টের পূর্ণ অভিজ্ঞতা নিন।",
    url: "https://stockwhisk.com/demo",
    siteName: "StockWhisk",
    type: "website",
    locale: "bn_BD",
  },
  twitter: {
    card: "summary_large_image",
    title: "StockWhisk Live Demo — Cloud POS & Inventory System",
    description: "Explore the live interactive demo of StockWhisk. Test POS billing, barcode, stock control, and real-time reports.",
  },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  const schemaOrgJson = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "StockWhisk",
    "operatingSystem": "Web, Android, iOS, Windows",
    "applicationCategory": "BusinessApplication, POSApplication",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "BDT"
    },
    "description": "Smart cloud inventory, POS billing, barcode scanning, and business management software for retail and wholesale shops in Bangladesh.",
    "url": "https://stockwhisk.com/demo",
    "featureList": [
      "Fast POS Thermal & A4 Billing",
      "Barcode Hangtag & Scale Scanning",
      "Real-time Inventory Ledger",
      "Mobile Repair Tickets with QR Live Tracking",
      "Serial Number & Warranty Tracking",
      "Daily Cash Register & Profit/Loss Reports",
      "Customer Dues & WhatsApp Invoices"
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrgJson) }}
      />
      {children}
    </>
  );
}
