export type Language = 'en' | 'bn';

type Translations = {
  [key in Language]: {
    [key: string]: string;
  };
};

export const translations: Translations = {
  en: {
    // Navigation
    nav_home: "Home",
    nav_pricing: "Pricing",
    nav_demo: "Live Demo",
    nav_reseller: "Reseller",
    nav_blog: "Blog",
    nav_contact: "Contact",
    nav_dashboard: "Dashboard",
    nav_login: "Login",
    nav_signup: "Sign Up",
    
    // Landing Page
    hero_badge: "#1 Cloud POS Solution",
    hero_title: "Run Your Shop Smarter with StockWhisk",
    hero_subtitle: "The modern retail dashboard built for clarity, speed, and precision. Manage inventory, track sales, and grow your business without the cognitive load.",
    hero_btn_register: "Start free trial",
    hero_btn_demo: "Try Live Demo",
    
    // Landing Page Stats
    stat_trial: "Free trial",
    stat_trial_val: "{days}-day",
    stat_speed: "Per checkout",
    stat_speed_val: "< 30s",
    stat_uptime: "Cloud access",
    stat_uptime_val: "24/7",
    stat_ownership: "Data ownership",
    stat_ownership_val: "100%",

    // Industries Section
    industries_eyebrow: "Built For Every Business",
    industries_title: "Industries We Serve",
    industries_retail: "Retail & E-commerce",
    industries_grocery: "Supermarkets & Grocery",
    industries_fashion: "Fashion & Apparel",
    industries_electronics: "Electronics & Mobile",
    industries_sme: "SME & E-commerce",
    industries_auto: "Automobile & Parts",

    // Why Choose Us Section
    why_eyebrow: "Built for Smarter Business",
    why_title: "Why Choose StockWhisk?",
    why_easy_title: "Easy to Use",
    why_easy_text: "Simple, intuitive, and designed for seamless daily operations",
    why_secure_title: "Secure & Reliable",
    why_secure_text: "Advanced security measures to keep your business data safe",
    why_cloud_title: "Cloud-Based System",
    why_cloud_text: "Access your business data anytime, anywhere in real time",
    why_support_title: "24/7 Support",
    why_support_text: "Dedicated assistance whenever you need it",

    // FAQ Section
    faq_title: "Frequently Asked Questions",

    // Landing Page Final CTA
    cta_title: "Ready to take control of your shop?",
    cta_subtitle: "Set up in minutes and start your free trial today.",
    cta_btn_contact: "Talk to us",

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
    pricing_trial: "🎉 Start with a {days}-day free trial — no card required",
    
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
    nav_home: "হোম",
    nav_pricing: "প্রাইসিং",
    nav_demo: "লাইভ ডেমো",
    nav_reseller: "রিসেলার",
    nav_blog: "ব্লগ",
    nav_contact: "যোগাযোগ",
    nav_dashboard: "ড্যাশবোর্ড",
    nav_login: "লগইন",
    nav_signup: "সাইন আপ",
    
    // Landing Page
    hero_badge: "#১ ক্লাউড পিওএস সমাধান",
    hero_title: "স্টকহিস্ক দিয়ে আপনার দোকান আরও স্মার্টভাবে চালান",
    hero_subtitle: "স্পষ্টতা, গতি এবং নির্ভুলতার জন্য তৈরি আধুনিক রিটেইল ড্যাশবোর্ড। ইনভেন্টরি ম্যানেজ করুন, সেলস ট্র্যাক করুন এবং ঝামেলা ছাড়াই আপনার ব্যবসা প্রসারিত করুন।",
    hero_btn_register: "ফ্রি ট্রায়াল শুরু করুন",
    hero_btn_demo: "ডেমো দেখুন",

    // Landing Page Stats
    stat_trial: "ফ্রি ট্রায়াল",
    stat_trial_val: "{days} দিন",
    stat_speed: "প্রতি চেকআউট",
    stat_speed_val: "< ৩০সেঃ",
    stat_uptime: "ক্লাউড অ্যাক্সেস",
    stat_uptime_val: "২৪/৭",
    stat_ownership: "ডেটার মালিকানা",
    stat_ownership_val: "১০০%",

    // Industries Section
    industries_eyebrow: "সব ধরনের ব্যবসার জন্য তৈরি",
    industries_title: "যেসকল ইন্ডাস্ট্রিতে আমরা কাজ করি",
    industries_retail: "রিটেইল ও ই-কমার্স",
    industries_grocery: "সুপারমার্কেট ও মুদি দোকান",
    industries_fashion: "ফ্যাশন ও পোশাক",
    industries_electronics: "ইলেকট্রনিক্স ও মোবাইল",
    industries_sme: "SME ও ই-কমার্স",
    industries_auto: "অটোমোবাইল ও যন্ত্রাংশ",

    // Why Choose Us Section
    why_eyebrow: "স্মার্ট ব্যবসার জন্য তৈরি",
    why_title: "কেন স্টকহিস্ক বেছে নিবেন?",
    why_easy_title: "সহজ ব্যবহার",
    why_easy_text: "সহজ, সাবলীল এবং দৈনন্দিন কাজের জন্য দারুণভাবে ডিজাইন করা",
    why_secure_title: "নিরাপদ ও বিশ্বস্ত",
    why_secure_text: "আপনার ব্যবসার ডেটা সুরক্ষিত রাখতে উন্নত নিরাপত্তা ব্যবস্থা",
    why_cloud_title: "ক্লাউড-ভিত্তিক সিস্টেম",
    why_cloud_text: "যে কোনো সময়, যে কোনো জায়গা থেকে রিয়েল-টাইমে ব্যবসার ডেটা অ্যাক্সেস করুন",
    why_support_title: "২৪/৭ সাপোর্ট",
    why_support_text: "আপনার প্রয়োজনে সার্বক্ষণিক ডেডিকেটেড সাপোর্ট",

    // FAQ Section
    faq_title: "সাধারণ জিজ্ঞাসা",

    // Landing Page Final CTA
    cta_title: "আপনার দোকানের নিয়ন্ত্রণ নিতে প্রস্তুত?",
    cta_subtitle: "মাত্র কয়েক মিনিটে সেট আপ করুন এবং আজই ফ্রি ট্রায়াল শুরু করুন।",
    cta_btn_contact: "আমাদের সাথে কথা বলুন",

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
    pricing_trial: "🎉 {days} দিনের ফ্রি ট্রায়াল দিয়ে শুরু করুন — কোনো কার্ডের প্রয়োজন নেই",
    
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
