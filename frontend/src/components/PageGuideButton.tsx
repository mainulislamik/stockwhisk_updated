"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import Link from "next/link";

interface PageDoc {
  title: { bn: string; en: string };
  icon: string;
  badge?: { bn: string; en: string };
  summary: { bn: string; en: string };
  steps: { bn: string[]; en: string[] };
  tips?: { bn: string; en: string };
  relatedLink?: { href: string; label: { bn: string; en: string } };
}

const PAGE_DOCS_REGISTRY: Record<string, PageDoc> = {
  "/app": {
    title: { bn: "ড্যাশবোর্ড ওভারভিউ", en: "Dashboard Overview" },
    icon: "📊",
    badge: { bn: "মেইন ড্যাশবোর্ড", en: "Main Dashboard" },
    summary: {
      bn: "আপনার ব্যবসায়ের দৈনিক মোট বিক্রয়, নেট লাভ, ক্যাশ ড্রয়ার স্থিতি, সকল ব্যাংক/বিকাশ ব্যালেন্স এবং লো-স্টক সতর্কবার্তা একনজরে দেখার কেন্দ্রীয় পাতা।",
      en: "The central command center showing daily revenue, net profit, drawer cash, liquid multi-account balances, and real-time inventory alerts."
    },
    steps: {
      bn: [
        "আজকের মোট বিক্রয়, অর্ডার সংখ্যা এবং মোট নিট প্রফিট ট্র্যাক করুন।",
        "ক্যাশ ড্রয়ার, বিকাশ, নগদ ও ব্যাংকে মোট কত তরল টাকা জমা আছে তা লাইভ দেখুন।",
        "লো-স্টক অ্যালার্ট কার্ডে ক্লিক করে যেসব পণ্যের স্টক কমে গেছে তা দ্রুত রিস্টক করুন।",
        "কাস্টমার বাকি ও সাপ্লায়ার দেনার বর্তমান মোট স্থিতি পর্যবেক্ষণ করুন।"
      ],
      en: [
        "Track today's total revenue, order count, and net profit margins in real-time.",
        "Monitor liquid money balances across Cash Drawer, bKash, Nagad, and Bank accounts.",
        "Click on low-stock alerts to quickly identify products needing immediate reorder.",
        "Keep track of outstanding customer receivables and unpaid supplier payables."
      ]
    },
    tips: {
      bn: "প্রতিদিন সকালে এবং দিনের কাজ শেষে ড্যাশবোর্ডের তরল ফান্ড ও ক্যাশ ড্রয়ার চেক করে নিন।",
      en: "Check liquid balances and drawer cash daily to ensure smooth cash flow operations."
    },
    relatedLink: { href: "/app/accounting", label: { bn: "ফাইন্যান্সিয়াল ব্যালেন্স দেখুন", en: "View Financial Balance" } }
  },

  "/app/pos": {
    title: { bn: "পয়েন্ট অব সেল (POS)", en: "Point of Sale (POS)" },
    icon: "🛒",
    badge: { bn: "দ্রুত বিক্রয় ও স্ক্যানিং", en: "Fast Sale & Scanning" },
    summary: {
      bn: "৩০ সেকেন্ডের মধ্যে বারকোড স্ক্যান করে অথবা নাম লিখে কার্টে পণ্য যোগ করে তাৎক্ষণিক মেমো তৈরির দ্রুততম বিক্রয় ইন্টারফেস।",
      en: "High-speed billing interface to scan barcodes, manage cart lines, and checkout in under 30 seconds."
    },
    steps: {
      bn: [
        "মোবাইল স্ক্যানার অ্যাপ বা লেজার বারকোড গান দিয়ে পণ্যের বারকোড স্ক্যান করুন।",
        "অথবা সার্চ বক্সে নাম/মডেল লিখে পণ্যে ক্লিক করে সরাসরি কার্টে যুক্ত করুন।",
        "ইউনিক সিরিয়াল/ওয়ারেন্টি পণ্যের ক্ষেত্রে নির্দিষ্ট সিরিয়াল পিস নির্বাচন করুন।",
        "কার্ট পূর্ণ হলে 'কাস্টমার ও পেমেন্ট ধাপে যান' বাটনে ক্লিক করে চেকআউট করুন।"
      ],
      en: [
        "Scan barcodes using the StockWhisk Mobile Scanner app or handheld laser gun.",
        "Or search by product name/SKU and click to instantly add items to the cart.",
        "For serialized items, choose the specific unit/serial barcode for warranty tracking.",
        "Click 'Proceed to Customer & Payment' to apply discounts and finalize checkout."
      ]
    },
    tips: {
      bn: "যেসব পণ্যের স্টক শূন্য (০), সেগুলো বিক্রয় রোধ করতে স্বয়ংক্রিয়ভাবে পিওএস তালিকা থেকে বাদ রাখা হয়।",
      en: "Products with 0 stock are automatically hidden to prevent overselling."
    },
    relatedLink: { href: "/app/sales", label: { bn: "সকল বিক্রয় তালিকা", en: "View Invoices" } }
  },

  "/app/pos/customer": {
    title: { bn: "চেকআউট ও পেমেন্ট", en: "Checkout & Payment" },
    icon: "💳",
    badge: { bn: "পেমেন্ট ও ইনভয়েস", en: "Payment & Invoice" },
    summary: {
      bn: "কাস্টমারের তথ্য নেওয়া, নগদ/বিকাশ/কার্ড/বাকির পেমেন্ট সমন্বয় করা, ডিসকাউন্ট ও কিস্তি (EMI) নির্ধারণ এবং ইনভয়েস প্রিন্ট করার পাতা।",
      en: "Finalize transactions with customer info, split payment methods, discounts, EMI installments, or quotations."
    },
    steps: {
      bn: [
        "ওয়াক-ইন কাস্টমারের নাম ও মোবাইল নম্বর দিন অথবা সংরক্ষিত পুরাতন কাস্টমার সিলেক্ট করুন।",
        "প্রয়োজন অনুযায়ী ইনভয়েস ডিসকাউন্ট বা ডেলিভারি চার্জ যোগ করুন।",
        "পেমেন্ট মেথড (Cash, bKash, Nagad, Card, Bank) নির্বাচন করে পরিশোধিত টাকা দিন।",
        "বাকি থাকলে Promised Payment Date দিন অথবা কিস্তির ক্ষেত্রে EMI সিলেক্ট করুন।",
        "'Complete Sale' বাটনে ক্লিক করে সাথে সাথে ৩-ইঞ্চি থার্মাল বা A4 সাইজ মেমো প্রিন্ট করুন।"
      ],
      en: [
        "Enter walk-in customer details or select an existing registered customer.",
        "Apply overall invoice discount or delivery charges if applicable.",
        "Select payment method (Cash, bKash, Nagad, Card, Bank) and paid amount.",
        "For dues, set promised payment due date or enable EMI installments schedule.",
        "Click 'Complete Sale' to generate invoice and print 3-inch POS or A4 receipts."
      ]
    },
    tips: {
      bn: "স্টক না কেটে শুধু খরচের খসড়া মেমো দিতে চাইলে 'Save as Quotation' ব্যবহার করুন।",
      en: "Use 'Save as Quotation' to produce an estimate without reducing inventory."
    }
  },

  "/app/products": {
    title: { bn: "প্রোডাক্ট ক্যাটালগ", en: "Products Catalog" },
    icon: "📦",
    badge: { bn: "পণ্য ব্যবস্থাপনা", en: "Product Management" },
    summary: {
      bn: "দোকানের সকল পণ্যের ক্রয়মূল্য, বিক্রয়মূল্য, বর্তমান স্টক, ক্যাটাগরি, ব্র্যান্ড ও ওয়ারেন্টি তথ্য পরিচালনার পাতা।",
      en: "Manage product master list, purchase cost, retail price, stock level, categories, and warranty durations."
    },
    steps: {
      bn: [
        "'+ নতুন প্রোডাক্ট' বাটনে ক্লিক করে নতুন আইটেম তৈরি করুন।",
        "ফিজিক্যাল পণ্যের ক্ষেত্রে 'ইনভেন্টরি স্টক ট্র্যাক করুন' চেকবক্স চালু রাখুন।",
        "সার্ভিস, মেরামত বা লেবার চার্জের ক্ষেত্রে স্টক ট্র্যাকিং অফ রেখে 'সার্ভিস আইটেম' বানান।",
        "প্রয়োজনে যে কোনো প্রোডাক্টের নাম, দাম বা রিঅর্ডার লেভেল এডিট করুন।"
      ],
      en: [
        "Click '+ Add Product' to create a new catalog entry with SKU and prices.",
        "Ensure 'Track Stock Inventory' is enabled for physical warehouse items.",
        "Disable inventory tracking for labor, repair, or delivery services.",
        "Edit pricing, reorder thresholds, or warranty months anytime."
      ]
    },
    tips: {
      bn: "স্টক ৫ বা রিঅর্ডার লেভেলের নিচে নামলে প্রোডাক্টটি স্বয়ংক্রিয়ভাবে লাল রঙে হাইলাইট হবে।",
      en: "Items falling below safety reorder levels will automatically highlight in red."
    }
  },

  "/app/products/purchase": {
    title: { bn: "পণ্য ক্রয় এন্ট্রি", en: "Product Purchase Entry" },
    icon: "📥",
    badge: { bn: "স্টক বৃদ্ধি", en: "Stock In" },
    summary: {
      bn: "নতুন কেনা পণ্যের স্টক ইনভেন্টরিতে যোগ করা, কেনা দাম নির্ধারণ এবং সাপ্লায়ার পেমেন্ট এন্ট্রি করার পাতা।",
      en: "Direct entry screen to receive purchased inventory, update cost prices, and disburse supplier payments."
    },
    steps: {
      bn: [
        "সাপ্লায়ার নির্বাচন করুন এবং যে পণ্যগুলো কেনা হয়েছে তা সিলেক্ট করুন।",
        "কত পিস কেনা হয়েছে এবং ইউনিট প্রতি ক্রয়মূল্য (Cost Price) বসান।",
        "নগদ পরিশোধ করলে পেমেন্ট মেথড দিন, আর বাকিতে কিনলে পেমেন্ট ০ রাখুন (যা সাপ্লায়ার দেনায় যুক্ত হবে)।"
      ],
      en: [
        "Select supplier and add purchased product lines with quantities and unit costs.",
        "Record paid amount to deduct from Cash/Bank, or leave 0 for credit purchases.",
        "Confirming the purchase atomically updates warehouse stock and ledger accounts."
      ]
    }
  },

  "/app/barcodes": {
    title: { bn: "বারকোড ও সিরিয়াল ইউনিট", en: "Barcodes & Serial Units" },
    icon: "🏷️",
    badge: { bn: "ইউনিক সিরিয়াল", en: "Unique Serials" },
    summary: {
      bn: "প্রতিটি পৃথক পিসের ইউনিক বারকোড/সিরিয়াল ট্র্যাকিং, বাল্ক জেনারেটর এবং স্টিকার প্রিন্ট করার পাতা।",
      en: "Manage per-unit serialized barcodes, bulk barcode generator, and sticker sheet printing."
    },
    steps: {
      bn: [
        "পণ্য সিলেক্ট করে একসাথে একাধিক ইউনিক বারকোড জেনারেট করুন।",
        "স্টিকার প্রিন্টারে প্রিন্ট করে প্রতিটি বক্সে বা পণ্যের গায়ে লাগিয়ে দিন।",
        "কোন সিরিয়ালটি স্টকে আছে আর কোনটি বিক্রি হয়েছে তা সরাসরি ট্র্যাক করুন।"
      ],
      en: [
        "Generate bulk unique barcodes for individual physical inventory units.",
        "Print barcode labels directly onto thermal sticker sheets.",
        "Track individual unit status (In Stock, Sold, Returned, Under Repair)."
      ]
    }
  },

  "/app/products/lookup": {
    title: { bn: "আইটেম ও সিরিয়াল লুকআপ", en: "Item & Serial Lookup" },
    icon: "🔍",
    badge: { bn: "সিরিয়াল ট্র্যাকার", en: "Serial Tracker" },
    summary: {
      bn: "যেকোনো বারকোড বা সিরিয়াল স্ক্যান করে সাথে সাথে সেই নির্দিষ্ট পণ্যটির বিক্রয় ইনভয়েস, ক্রেতার তথ্য ও অবশিষ্ট ওয়ারেন্টি যাচাই করার পাতা।",
      en: "Scan any barcode or serial to instantly view purchase source, sales invoice, buyer details, and warranty validity."
    },
    steps: {
      bn: [
        "বারকোড স্ক্যান করুন বা টাইপ করে এন্টার চাপুন।",
        "পণ্যটি কত তারিখে বিক্রি হয়েছে, কোন মেমোতে এবং কে কিনেছে তা একনজরে দেখুন।",
        "ওয়ারেন্টি বা রিপ্লেসমেন্ট গ্যারান্টি বৈধ আছে কিনা তা তাৎক্ষণিক নিশ্চিত হন।"
      ],
      en: [
        "Scan or type any product unit serial barcode.",
        "Instantly inspect original sales invoice, customer name, and sale date.",
        "Verify remaining warranty days and replacement guarantee eligibility."
      ]
    }
  },

  "/app/inventory": {
    title: { bn: "ইনভেন্টরি লেজার", en: "Inventory Ledger" },
    icon: "📋",
    badge: { bn: "স্টক মুভমেন্ট", en: "Stock Movements" },
    summary: {
      bn: "পণ্য আগমন (Stock-in) এবং বিক্রয় (Stock-out)-এর সম্পূর্ণ অডিট ট্রেইল ও টাইমস্ট্যাম্প হিস্ট্রি।",
      en: "Immutable audit trail of all warehouse stock movements (sales, purchases, returns, and adjustments)."
    },
    steps: {
      bn: [
        "কোন পণ্য কখন, কার দ্বারা এবং কোন ইনভয়েসের মাধ্যমে স্টকে এসেছে বা বের হয়েছে তা যাচাই করুন।",
        "ফিজিক্যাল গণনার সাথে গরমিল থাকলে স্টক অ্যাডজাস্টমেন্ট সম্পন্ন করুন।"
      ],
      en: [
        "Audit stock additions, sales deductions, and returns with timestamped references.",
        "Perform manual inventory adjustments when doing periodic physical audits."
      ]
    }
  },

  "/app/suppliers": {
    title: { bn: "সাপ্লায়ার ডিরেক্টরি", en: "Suppliers & Payables" },
    icon: "🤝",
    badge: { bn: "সাপ্লায়ার দেনা", en: "Supplier Payables" },
    summary: {
      bn: "মালামাল সরবরাহকারীদের তালিকা, ক্রয়ের হিসাব এবং বকেয়া বিল পরিশোধের পাতা।",
      en: "Supplier directory, purchase logs, and outstanding supplier payable disbursements."
    },
    steps: {
      bn: [
        "সাপ্লায়ারের নাম, ফোন ও ঠিকানা সংরক্ষণ করুন।",
        "কোন সাপ্লায়ার কত টাকা বকেয়া পাবে তা একনজরে দেখুন।",
        "'Pay Supplier' বাটনে ক্লিক করে ক্যাশ বা ব্যাংক থেকে বকেয়া পরিশোধ করুন।"
      ],
      en: [
        "Maintain supplier profiles, contact numbers, and purchasing history.",
        "View live outstanding payables owed to each vendor.",
        "Click 'Pay Supplier' to record payment disbursements from Cash or Bank."
      ]
    }
  },

  "/app/sales": {
    title: { bn: "বিক্রয় ও ইনভয়েস তালিকা", en: "Sales Invoices" },
    icon: "🧾",
    badge: { bn: "ইনভয়েস হিস্ট্রি", en: "Invoice History" },
    summary: {
      bn: "দোকানের সকল বিক্রিত মেমোর তালিকা, পেমেন্ট স্ট্যাটাস, পিডিএফ ডাউনলোড এবং ওয়াটসঅ্যাপে মেমো পাঠানোর পাতা।",
      en: "Searchable log of all completed sales, payment status badges, PDF download, and WhatsApp sharing."
    },
    steps: {
      bn: [
        "ইনভয়েস নম্বর, কাস্টমারের নাম বা ফোন দিয়ে মেমো খুঁজুন।",
        "মেমো প্রিন্ট করুন (POS 80mm থার্মাল বা ফুল A4 সাইজ)।",
        "বাকি থাকা মেমোতে পরবর্তী সময়ে কিস্তি বা বাকি পেমেন্ট যুক্ত করুন।"
      ],
      en: [
        "Search invoices by invoice number, customer name, phone, or sold barcode.",
        "Print thermal receipts (80mm) or formal A4 PDF invoices.",
        "Add additional payments to partial/due invoices."
      ]
    }
  },

  "/app/sales/returns": {
    title: { bn: "পণ্য ফেরত ও রিফান্ড", en: "Sales Returns & Refunds" },
    icon: "🔄",
    badge: { bn: "রিটার্ন ও এক্সচেঞ্জ", en: "Returns & Exchanges" },
    summary: {
      bn: "কাস্টমার পণ্য ফেরত দিলে স্টক রিস্টক করা এবং ক্যাশ/ব্যাংক থেকে টাকা রিফান্ড বা পণ্য বদল (Exchange) করার পাতা।",
      en: "Process customer product returns, restock returned items, and issue cash refunds or product exchanges."
    },
    steps: {
      bn: [
        "মূল ইনভয়েস নম্বর নির্বাচন করুন।",
        "যে পণ্যটি ফেরত এসেছে তা সিলেক্ট করে কারণ লিখুন।",
        "ক্যাশ ফেরত দিতে চাইলে রিফান্ড মেথড দিন, অথবা বদলে অন্য পণ্য দিতে চাইলে এক্সচেঞ্জ আইটেম যোগ করুন।"
      ],
      en: [
        "Select the original sales invoice.",
        "Specify the returning line item, quantity, and reason.",
        "Choose refund account (Cash/Bank) or select exchange replacement items."
      ]
    }
  },

  "/app/customers": {
    title: { bn: "কাস্টমার ডিরেক্টরি", en: "Customers CRM" },
    icon: "👥",
    badge: { bn: "ক্রেতা তালিকা", en: "Customer Directory" },
    summary: {
      bn: "নিয়মিত কাস্টমারদের নাম, ফোন, ঠিকানা, মোট কেনাকাটা ও বর্তমান বাকি টাকার প্রোফাইল।",
      en: "Customer directory with purchase histories, contact info, total spend, and outstanding balances."
    },
    steps: {
      bn: [
        "কাস্টমারের প্রোফাইলে ক্লিক করে তার অতীতের সকল ইনভয়েস ও ওয়ারেন্টি দেখুন।",
        "নির্দিষ্ট কাস্টমারকে স্পেশাল পার্সেন্টেজ ডিসকাউন্ট রেট সেট করে দিন।"
      ],
      en: [
        "Inspect customer purchase ledger, previous invoices, and active warranties.",
        "Assign custom default discount percentages for VIP / wholesale customers."
      ]
    }
  },

  "/app/dues": {
    title: { bn: "কাস্টমার বাকি ট্র্যাকিং", en: "Customer Due Tracking" },
    icon: "💰",
    badge: { bn: "বাকি আদায়", en: "Due Collection" },
    summary: {
      bn: "যেসব কাস্টমারের কাছে বাকি টাকা পাওনা রয়েছে তাদের তালিকা এবং বাকি আদায়ের রশিদ তৈরি করার পাতা।",
      en: "Dedicated receivables management to track overdue customer balances and record due collections."
    },
    steps: {
      bn: [
        "বকেয়া কাস্টমার তালিকা থেকে 'Pay Due' বাটনে ক্লিক করুন।",
        "ক্যাশ, বিকাশ বা ব্যাংকের মাধ্যমে কত টাকা আদায় হয়েছে তা এন্ট্রি করুন।",
        "সিস্টেম স্বয়ংক্রিয়ভাবে ক্যাশ বৃদ্ধি করবে এবং কাস্টমারের বাকি কমিয়ে মানি রিসিট দেবে।"
      ],
      en: [
        "Find outstanding customer and click 'Pay Due'.",
        "Enter collected amount and select receiving account (Cash, bKash, Bank).",
        "Generates a formal Due Payment Receipt and updates liquid balances."
      ]
    },
    tips: {
      bn: "বাকি আদায় কোনো নতুন বিক্রয় নয়; এটি পাওনা টাকা আদায়ের ক্যাশ ইনফ্লো।",
      en: "Due collection is a debt settlement inflow and does not duplicate sales revenue."
    }
  },

  "/app/emi": {
    title: { bn: "ইএমআই ও কিস্তি ব্যবস্থাপনা", en: "EMI Installment Schedules" },
    icon: "📅",
    badge: { bn: "মাসিক কিস্তি", en: "EMI Schedules" },
    summary: {
      bn: "মাসিক কিস্তিতে বিক্রিত পণ্যের কিস্তি শিডিউল, ডিউ ডেট ও কিস্তির টাকা আদায়ের পাতা।",
      en: "Track installment financing, monthly payment schedules, interest calculations, and overdue reminders."
    },
    steps: {
      bn: [
        "কাস্টমারের কিস্তির তালিকা ও পরবর্তী মাসের ডিউ ডেট দেখুন।",
        "কিস্তি পরিশোধ হলে 'Pay Installment' দিয়ে আদায়ের মেমো তৈরি করুন।"
      ],
      en: [
        "Review EMI schedules with monthly due dates and outstanding principal.",
        "Record installment receipts as customers pay their monthly amounts."
      ]
    }
  },

  "/app/service/warranties": {
    title: { bn: "ওয়ারেন্টি ও গ্যারান্টি", en: "Warranty Verification" },
    icon: "🛡️",
    badge: { bn: "ওয়ারেন্টি সেবা", en: "Warranty Service" },
    summary: {
      bn: "বিক্রিত পণ্যের ওয়ারেন্টির মেয়াদ, কত দিন বাকি আছে তা লাইভ যাচাই ও ক্লেম নেওয়ার পাতা।",
      en: "Validate warranty eligibility, remaining coverage days, and replacement guarantees by serial barcode."
    },
    steps: {
      bn: [
        "কাস্টমার পণ্য নিয়ে এলে বারকোড বা সিরিয়াল দিয়ে সার্চ করুন।",
        "ওয়ারেন্টি স্ট্যাটাস (Active / Expired) এবং বাকি থাকা দিন যাচাই করুন।",
        "প্রয়োজনে সরাসরি 'Create Service Ticket' খুলে মেরামতের জন্য গ্রহণ করুন।"
      ],
      en: [
        "Search by product barcode, customer phone, or invoice number.",
        "Verify if the unit is within warranty or replacement guarantee duration.",
        "One-click action to create a repair service ticket if defective."
      ]
    }
  },

  "/app/service/tickets": {
    title: { bn: "সার্ভিস ও মেরামত টিকেট", en: "Service & Repair Tickets" },
    icon: "🔧",
    badge: { bn: "জব কার্ড", en: "Job Cards" },
    summary: {
      bn: "সার্ভিস সেন্টারে মেরামত করতে দেওয়া ডিভাইসের জব কার্ড তৈরি, প্রগ্রেস ট্র্যাকিং ও ডেলিভারি দেওয়ার পাতা।",
      en: "Manage repair job cards, problem descriptions, technician assignments, repair costs, and delivery status."
    },
    steps: {
      bn: [
        "নতুন ডিভাইস জমা নিয়ে সমস্যা লিখে 'New Ticket' তৈরি করুন।",
        "কাস্টমারকে ট্র্যাকিং নম্বর সহ টোকেন প্রিন্ট করে দিন।",
        "মেরামত শেষে খরচ যোগ করে ডিভাইস হস্তান্তর ও ডেলিভারি দিন।"
      ],
      en: [
        "Open a new repair ticket specifying customer symptoms and estimated cost.",
        "Print a repair job card token for the customer.",
        "Update ticket progress (Pending -> In Progress -> Repaired -> Delivered)."
      ]
    }
  },

  "/app/accounting": {
    title: { bn: "হিসাব ও অর্থায়ন (P&L ও ব্যালেন্স)", en: "Finance & Accounting" },
    icon: "⚖️",
    badge: { bn: "ক্যাশ ফ্লো ও ব্যালেন্স", en: "Cash Flow & Balance" },
    summary: {
      bn: "দোকানের লাভ-ক্ষতি (P&L), ক্যাশ/বিকাশ/ব্যাংকের প্রকৃত ব্যালেন্স, মালিকের মূলধন (Capital & Drawings) এবং অ্যাকাউন্ট ট্রান্সফারের কেন্দ্রীয় পাতা।",
      en: "Master financial position: Profit & Loss (P&L), liquid balances (Cash, bKash, Nagad, Bank), owner equity, and internal account fund transfers."
    },
    steps: {
      bn: [
        "📊 ট্যাব ১ (P&L & Position): মোট রেভিনিউ, COGS, গ্রস প্রফিট, খরচ এবং সকল ব্যাংকের তরল টাকার ব্যালেন্স দেখুন।",
        "💼 ট্যাব ২ (Capital & Drawings): ব্যবসায় নতুন মূলধন বিনিয়োগ বা মালিকের ব্যক্তিগত খরচ উত্তোলন এন্ট্রি করুন।",
        "🔄 ট্যাব ৩ (Account Transfers): ক্যাশ ড্রয়ার থেকে বিকাশ, নগদ বা ব্যাংক অ্যাকাউন্টে টাকা স্থানান্তর করুন।"
      ],
      en: [
        "📊 Tab 1 (P&L & Position): View real-time revenue, COGS, gross profit, expenses, and exact multi-account liquid balances.",
        "💼 Tab 2 (Capital & Drawings): Record partner capital additions and owner personal withdrawals.",
        "🔄 Tab 3 (Account Transfers): Atomically transfer funds between Cash, bKash, Nagad, and Bank accounts."
      ]
    },
    tips: {
      bn: "ক্যাশ ব্যালেন্স = ওপেনিং ব্যালেন্স + প্রকৃত আগমন - প্রকৃত বহির্গমন। বিক্রয়ের সময় ক্রয়মূল্য কখনোই দ্বিতীয়বার বিয়োগ করা হয় না।",
      en: "Cash balance follows strict actual money movement: Opening + Inflows - Outflows. COGS is never deducted from cash."
    }
  },

  "/app/accounting/settlement": {
    title: { bn: "দৈনিক ক্যাশ মেলানো (Settlement)", en: "Daily Cash Settlement" },
    icon: "💵",
    badge: { bn: "শিফট ক্লোজিং", en: "Shift Closing" },
    summary: {
      bn: "প্রতিদিন দোকান বন্ধের সময় ড্রয়ারের নগদ টাকা গুনে প্রত্যাশিত ক্যাশের সাথে মিলিয়ে শর্টেজ বা উদ্বৃত্ত নির্ণয় করার পাতা।",
      en: "End-of-day register reconciliation: Count actual drawer cash and reconcile against system expected cash."
    },
    steps: {
      bn: [
        "ক্যাশ ক্যালকুলেটর ড্রয়ার খুলে ১০০০, ৫০০, ১০০ টাকার নোট গুনে সংখ্যা বসান।",
        "সিস্টেম স্বয়ংক্রিয়ভাবে মোট গোনা টাকার সাথে প্রত্যাশিত টাকার অমিল (Discrepancy) বের করবে।",
        "'Close Shift' বাটনে ক্লিক করে শিফট ক্লোজ করুন। পরের দিন এই ক্লোজিং ক্যাশই ওপেনিং হিসেবে শুরু হবে।"
      ],
      en: [
        "Use the denomination calculator to enter counts of 1000, 500, 100, 50, 20 notes.",
        "Inspect real-time discrepancy (Shortage or Surplus) between actual and expected cash.",
        "Click 'Close Shift' to lock register. Closing cash automatically carries over as tomorrow's opening cash."
      ]
    }
  },

  "/app/expenses": {
    title: { bn: "দোকানের খরচ", en: "Operating Expenses" },
    icon: "💸",
    badge: { bn: "পরিচালন ব্যয়", en: "Operating Expenses" },
    summary: {
      bn: "দোকান ভাড়া, বিদ্যুৎ বিল, কর্মচারীর বেতন, নাস্তা ও দৈনন্দিন পরিচালনা খরচ এন্ট্রি ও ট্র্যাক করার পাতা।",
      en: "Track store rent, electricity bills, employee salaries, and routine operational expenses."
    },
    steps: {
      bn: [
        "খরচের ক্যাটাগরি, পরিমাণ এবং পেমেন্ট মেথড (Cash / Bank) দিন।",
        "খরচ সাবমিট করলে স্বয়ংক্রিয়ভাবে ক্যাশ ড্রয়ার/ব্যাংক থেকে টাকা কমবে এবং মাসিক প্রফিট স্টেটমেন্টে যোগ হবে।"
      ],
      en: [
        "Enter expense category, amount, date, and payment source account.",
        "Submitting immediately reduces liquid money and records an expense in the P&L statement."
      ]
    }
  },

  "/app/reports": {
    title: { bn: "রিপোর্ট ও অ্যানালিটিক্স", en: "Reports & Analytics" },
    icon: "📈",
    badge: { bn: "বিজনেস অ্যানালিটিক্স", en: "Business Analytics" },
    summary: {
      bn: "মাসিক বিক্রয় গ্রাফ, প্রফিট মার্জিন, টপ সেলিং প্রোডাক্ট এবং ইনভেন্টরি ভ্যালুয়েশনের বিস্তারিত রিপোর্ট।",
      en: "Comprehensive business reporting: Profitability trends, daily sales graph, inventory valuation, and top products."
    },
    steps: {
      bn: [
        "তারিখ নির্বাচন করে নির্দিষ্ট সময়সীমার সেলস ও লাভ বিশ্লেষণ করুন।",
        "কোন ক্যাটাগরি বা প্রোডাক্ট থেকে সবচেয়ে বেশি লাভ আসছে তা গ্রাফে পর্যবেক্ষণ করুন।"
      ],
      en: [
        "Filter by date ranges (Last 7 Days, Last 30 Days, Custom) to evaluate performance.",
        "Analyze top revenue generating items and product margin contributions."
      ]
    }
  },

  "/app/settings": {
    title: { bn: "শপ সেটিংস", en: "Shop Settings" },
    icon: "⚙️",
    badge: { bn: "কনফিগারেশন", en: "Configuration" },
    summary: {
      bn: "দোকানের নাম, লোগো, ঠিকানা, মেমো ফুটার নোট, ভ্যাট পারসেন্টেজ ও অফলাইন সেল মোড কনফিগারেশনের পাতা।",
      en: "Configure store profile, business logo, receipt footer message, VAT tax rates, and offline billing mode."
    },
    steps: {
      bn: [
        "শপের ঠিকানা ও মোবাইল নম্বর আপডেট করুন যা ইনভয়েস রশিদের উপরে প্রিন্ট হবে।",
        "ভ্যাট চালু করতে চাইলে VAT Enable করে শতকরা হার বসান।"
      ],
      en: [
        "Update shop name, address, and contact numbers printed on customer receipts.",
        "Enable VAT taxation percentage if applicable to your business."
      ]
    }
  },

  "/app/users": {
    title: { bn: "স্টাফ ও ইউজার ম্যানেজমেন্ট", en: "Staff & User Roles" },
    icon: "👤",
    badge: { bn: "রোল পারমিশন", en: "Staff Permissions" },
    summary: {
      bn: "ম্যানেজার, ক্যাশিয়ার বা সেলসম্যান অ্যাকাউন্ট তৈরি এবং তাদের এক্সেস পারমিশন নিয়ন্ত্রণ করার পাতা।",
      en: "Manage staff accounts, assign roles (Cashier, Manager, Admin), and configure granular feature permissions."
    },
    steps: {
      bn: [
        "নতুন কর্মচারীর জন্য অ্যাকাউন্ট তৈরি করে ভূমিকা (Role) দিন।",
        "ক্যাশিয়ারদের ক্রয়মূল্য বা মুনাফার তথ্য দেখা বন্ধ রাখতে পারমিশন কাস্টমাইজ করুন।"
      ],
      en: [
        "Create user logins for employees and assign role privileges.",
        "Restrict cashiers from viewing wholesale purchase costs or shop net profits."
      ]
    }
  },

  "/app/backups": {
    title: { bn: "ডাটাবেস ব্যাকআপ", en: "Database Backups" },
    icon: "💾",
    badge: { bn: "ডাটা সিকিউরিটি", en: "Data Security" },
    summary: {
      bn: "এক ক্লিকে আপনার দোকানের সম্পূর্ণ ইনভেন্টরি, সেলস ও কাস্টমার ডাটাবেস ডাউনলোড ও নিরাপদ রাখার পাতা।",
      en: "One-click complete database export to securely download and archive your business data."
    },
    steps: {
      bn: [
        "'Generate Backup' বাটনে ক্লিক করে সাথে সাথে সম্পূর্ণ ডাটার ব্যাকআপ ফাইল ডাউনলোড করুন।"
      ],
      en: [
        "Click 'Generate Backup' to instantly download an encrypted backup archive."
      ]
    }
  }
};

export default function PageGuideButton() {
  const pathname = usePathname() || "/app";
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Normalize path to find closest matching page documentation
  const currentDoc: PageDoc = (() => {
    if (PAGE_DOCS_REGISTRY[pathname]) {
      return PAGE_DOCS_REGISTRY[pathname];
    }
    // Check prefix matches (e.g. /app/products/123/edit -> /app/products)
    const matchedKey = Object.keys(PAGE_DOCS_REGISTRY)
      .sort((a, b) => b.length - a.length)
      .find((key) => pathname.startsWith(key) && key !== "/app");
    
    return matchedKey ? PAGE_DOCS_REGISTRY[matchedKey] : PAGE_DOCS_REGISTRY["/app"];
  })();

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        open &&
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const isBn = lang === "bn";

  return (
    <div className="position-relative d-inline-flex align-items-center">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="btn btn-sm d-flex align-items-center justify-content-center border shadow-sm transition-all"
        title={isBn ? "এই পেজের গাইড ও নির্দেশিকা" : "Page Documentation & Guide"}
        aria-label="Page Guide"
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          background: open ? "var(--brand-500, #2563eb)" : "var(--glass-bg, #ffffff)",
          color: open ? "#ffffff" : "var(--brand-500, #2563eb)",
          borderColor: open ? "var(--brand-500, #2563eb)" : "var(--line, #e2e8f0)",
          fontSize: "1.1rem",
          fontWeight: "bold",
          boxShadow: open ? "0 0 0 3px rgba(37,99,235,0.25)" : "0 1px 3px rgba(0,0,0,0.08)",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: "1.15rem", lineHeight: 1 }}>ⓘ</span>
      </button>

      {/* Popover Card */}
      {open && (
        <div
          ref={popoverRef}
          className="position-absolute end-0 shadow-lg rounded-4 border p-0 animate-fadeIn"
          style={{
            width: "360px",
            maxWidth: "92vw",
            zIndex: 1080,
            background: "var(--glass-bg, #ffffff)",
            borderColor: "var(--line, #e2e8f0)",
            color: "var(--text-main, #1e293b)",
            backdropFilter: "blur(16px)",
            top: "calc(100% + 8px)",
          }}
        >
          {/* Header */}
          <div
            className="p-3 border-bottom d-flex align-items-center justify-content-between rounded-top-4"
            style={{
              background: "linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(59,130,246,0.02) 100%)",
              borderColor: "var(--line, #e2e8f0)",
            }}
          >
            <div className="d-flex align-items-center gap-2 min-vw-0">
              <span className="fs-4">{currentDoc.icon}</span>
              <div>
                <div className="fw-bold fs-6 text-truncate lh-sm" style={{ color: "var(--text-main)" }}>
                  {isBn ? currentDoc.title.bn : currentDoc.title.en}
                </div>
                {currentDoc.badge && (
                  <span
                    className="badge bg-primary bg-opacity-15 text-primary border border-primary border-opacity-25 mt-0.5"
                    style={{ fontSize: "0.68rem" }}
                  >
                    {isBn ? currentDoc.badge.bn : currentDoc.badge.en}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-link text-secondary p-1 text-decoration-none"
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{ fontSize: "1.1rem", lineHeight: 1 }}
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="p-3" style={{ maxHeight: "65vh", overflowY: "auto" }}>
            {/* Summary */}
            <div
              className="p-2.5 rounded-3 mb-3 small"
              style={{
                background: "var(--sidebar-hover, #f8fafc)",
                border: "1px solid var(--line, #e2e8f0)",
                color: "var(--text-main)",
                lineHeight: "1.5",
              }}
            >
              {isBn ? currentDoc.summary.bn : currentDoc.summary.en}
            </div>

            {/* Steps & Key Actions */}
            <div className="mb-3">
              <div className="fw-semibold small text-uppercase mb-2 text-secondary" style={{ fontSize: "0.72rem", letterSpacing: "0.5px" }}>
                ⚡ {isBn ? "কীভাবে ব্যবহার করবেন / প্রধান কাজসমূহ" : "Key Actions & Instructions"}
              </div>
              <ul className="list-unstyled mb-0 vstack gap-2 small">
                {(isBn ? currentDoc.steps.bn : currentDoc.steps.en).map((step, idx) => (
                  <li key={idx} className="d-flex align-items-start gap-2">
                    <span
                      className="badge rounded-circle bg-primary bg-opacity-15 text-primary d-flex align-items-center justify-content-center flex-shrink-0 mt-0.5"
                      style={{ width: "18px", height: "18px", fontSize: "0.65rem" }}
                    >
                      {idx + 1}
                    </span>
                    <span style={{ color: "var(--text-main)", lineHeight: "1.4" }}>{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro Tip */}
            {currentDoc.tips && (
              <div
                className="p-2.5 rounded-3 bg-warning bg-opacity-10 border border-warning border-opacity-25 small mb-2"
                style={{ color: "var(--text-main)" }}
              >
                <div className="fw-bold text-warning-emphasis mb-0.5 d-flex align-items-center gap-1" style={{ fontSize: "0.75rem" }}>
                  💡 {isBn ? "গুরুত্বপূর্ণ পরামর্শ" : "Pro Tip & Rules"}
                </div>
                <div style={{ fontSize: "0.8rem", lineHeight: "1.4" }}>
                  {isBn ? currentDoc.tips.bn : currentDoc.tips.en}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="p-2.5 border-top d-flex align-items-center justify-content-between rounded-bottom-4 small"
            style={{
              background: "var(--sidebar-hover, #f8fafc)",
              borderColor: "var(--line, #e2e8f0)",
            }}
          >
            <Link
              href="/app/tutorials"
              className="text-primary text-decoration-none fw-medium d-flex align-items-center gap-1"
              style={{ fontSize: "0.75rem" }}
              onClick={() => setOpen(false)}
            >
              🎥 {isBn ? "ভিডিও টিউটোরিয়াল দেখুন" : "Watch Tutorials"}
            </Link>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm py-0.5 px-2.5"
              style={{ fontSize: "0.75rem" }}
              onClick={() => setOpen(false)}
            >
              {isBn ? "বুঝেছি" : "Got it"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
