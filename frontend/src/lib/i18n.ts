export type Language = 'en' | 'bn';

type Translations = {
  [key in Language]: {
    [key: string]: string;
  };
};

export const translations: Translations = {
  en: {
    // Navigation
    nav_pricing: "Pricing",
    nav_blog: "Blog",
    nav_dashboard: "Dashboard",
    nav_login: "Login",
    
    // Landing Page
    hero_title: "Run Your Shop Smarter with StockWhisk",
    hero_subtitle: "The modern retail dashboard built for clarity, speed, and precision. Manage inventory, track sales, and grow your business without the cognitive load.",
    hero_btn_register: "Register Now",
    hero_btn_demo: "View Demo",
    
    // Pricing Page
    pricing_title: "Simple, transparent pricing",
    pricing_subtitle: "Choose the perfect plan for your retail business. No hidden fees.",
    pricing_monthly: "Monthly",
    pricing_yearly: "Yearly",
    pricing_save: "Save 20%",
    pricing_most_popular: "Most Popular",
    pricing_get_started: "Get Started",
    pricing_features_included: "Features Included",
    pricing_loading: "Loading plans...",
    pricing_users: "Up to {max_users} Users",
    pricing_branches: "{max_branches} Branch(es)",
    pricing_products: "{max_products} Products Limit",
    
    // Feature translations for Pricing
    feat_pos: "Point of Sale (POS)",
    feat_basic_analytics: "Basic Analytics",
    feat_advanced_analytics: "Advanced Analytics",
    feat_reports_export: "Export Reports",
    feat_multi_branch: "Multiple Branches",
    feat_api_access: "API Access",

    // Blog Page
    blog_title: "StockWhisk Updates & Insights",
    blog_subtitle: "The latest product news, industry trends, and practical guides to help you scale your retail business.",
    blog_read_article: "Read Article",
    blog_loading: "Loading blogs...",
    blog_empty: "No blog posts found.",

    // Footer
    footer_rights: "© {year} StockWhisk. All rights reserved."
  },
  bn: {
    // Navigation
    nav_pricing: "প্রাইসিং",
    nav_blog: "ব্লগ",
    nav_dashboard: "ড্যাশবোর্ড",
    nav_login: "লগইন",
    
    // Landing Page
    hero_title: "স্টকহিস্ক দিয়ে আপনার দোকান আরও স্মার্টভাবে চালান",
    hero_subtitle: "স্পষ্টতা, গতি এবং নির্ভুলতার জন্য তৈরি আধুনিক রিটেইল ড্যাশবোর্ড। ইনভেন্টরি ম্যানেজ করুন, সেলস ট্র্যাক করুন এবং ঝামেলা ছাড়াই আপনার ব্যবসা প্রসারিত করুন।",
    hero_btn_register: "রেজিস্টার করুন",
    hero_btn_demo: "ডেমো দেখুন",

    // Pricing Page
    pricing_title: "সহজ ও স্বচ্ছ প্রাইসিং",
    pricing_subtitle: "আপনার ব্যবসার জন্য উপযুক্ত প্ল্যানটি বেছে নিন। কোন লুকানো চার্জ নেই।",
    pricing_monthly: "মাসিক",
    pricing_yearly: "বার্ষিক",
    pricing_save: "২০% সাশ্রয়",
    pricing_most_popular: "সবচেয়ে জনপ্রিয়",
    pricing_get_started: "শুরু করুন",
    pricing_features_included: "যেসব সুবিধা থাকছে",
    pricing_loading: "প্ল্যান লোড হচ্ছে...",
    pricing_users: "সর্বোচ্চ {max_users} জন ইউজার",
    pricing_branches: "{max_branches} টি ব্রাঞ্চ",
    pricing_products: "{max_products} টি প্রোডাক্ট লিমিট",
    
    // Feature translations for Pricing
    feat_pos: "পয়েন্ট অফ সেল (POS)",
    feat_basic_analytics: "বেসিক অ্যানালিটিক্স",
    feat_advanced_analytics: "অ্যাডভান্সড অ্যানালিটিক্স",
    feat_reports_export: "রিপোর্ট এক্সপোর্ট",
    feat_multi_branch: "একাধিক ব্রাঞ্চ",
    feat_api_access: "এপিআই অ্যাক্সেস",

    // Blog Page
    blog_title: "স্টকহিস্ক আপডেট এবং ইনসাইট",
    blog_subtitle: "সর্বশেষ প্রোডাক্ট নিউজ, ইন্ডাস্ট্রির ট্রেন্ড এবং আপনার রিটেইল ব্যবসা বাড়াতে প্র্যাক্টিকাল গাইড।",
    blog_read_article: "আর্টিকেলটি পড়ুন",
    blog_loading: "ব্লগ লোড হচ্ছে...",
    blog_empty: "কোনো ব্লগ পোস্ট পাওয়া যায়নি।",

    // Footer
    footer_rights: "© {year} StockWhisk. সর্বস্বত্ব সংরক্ষিত।"
  }
};
