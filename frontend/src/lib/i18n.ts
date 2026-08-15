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
    
    // Landing Page - Hero
    hero_badge: "#1 CLOUD POS SOLUTION",
    hero_title_mobile: "Run your store",
    hero_title_mobile_highlight: "smarter",
    hero_title_mobile_suffix: "with StockWhisk",
    hero_title_desktop: "Inventory & POS Management",
    hero_title_desktop_highlight: "Software for Retail",
    hero_subtitle: "Modern retail dashboard built for clarity, speed, and accuracy. Manage inventory, track sales, and grow your business without the hassle.",
    hero_btn_trial: "Start Free Trial",
    hero_btn_demo: "Explore Live Demo",
    hero_sales_today: "Today's Sales",
    hero_orders: "Orders",
    hero_sales_trend: "Sales Trend",

    // Landing Page - Bento Grid
    bento_title: "Everything You Need to Manage Your Retail Business",
    bento_subtitle: "A complete suite of tools designed to streamline your daily operations.",
    
    bento_inv_title: "Smart Inventory",
    bento_inv_desc: "Track stock levels in real-time across multiple locations. Get automatic alerts when items run low.",
    bento_pos_title: "Fast POS",
    bento_pos_desc: "Process transactions quickly with our intuitive checkout interface.",
    bento_rep_title: "Insightful Reports",
    bento_rep_desc: "Understand your sales trends and profit margins with beautiful charts.",
    
    bento_small_1_title: "Purchases",
    bento_small_1_desc: "Streamline ordering.",
    bento_small_2_title: "Customers",
    bento_small_2_desc: "Build loyalty.",
    bento_small_3_title: "Suppliers",
    bento_small_3_desc: "Manage vendors.",

    // Landing Page - Problems
    prob_title: "Managing Your Shop Shouldn’t Be This Complicated",
    prob_1_title: "Manual Stock Counting",
    prob_1_text: "Wasting hours counting items and still getting it wrong.",
    prob_2_title: "Messy Paper Records",
    prob_2_text: "Losing track of who bought what and who owes you money.",
    prob_3_title: "Guessing Profits",
    prob_3_text: "Not knowing which products are actually making you money.",

    prob_sol_badge: "The StockWhisk Way",
    prob_sol_title: "Automate & Simplify",
    prob_sol_text: "StockWhisk connects every part of your store. Make a sale, and inventory updates instantly. Buy stock, and supplier ledgers are adjusted. It just works.",
    prob_sol_stat_title: "Save 10+ hours a week",
    prob_sol_stat_text: "Focus on growing, not paperwork.",

    // Landing Page - Flow Diagram
    flow_title: "One Platform for Your Entire Retail Operation",
    flow_step_1: "Products",
    flow_step_2: "Purchases",
    flow_step_3: "Inventory",
    flow_step_4: "Sales",
    flow_step_5: "Reports",

    // Landing Page - Feature Details
    feat_1_title: "Powerful Inventory Management",
    feat_1_desc: "Keep your shelves stocked and your data accurate without manual counting.",
    feat_1_bullet_1: "Organize by categories, brands, and variants (size/color).",
    feat_1_bullet_2: "Track exact item movement history.",
    feat_1_bullet_3: "Set low-stock thresholds and get notified automatically.",
    feat_1_link: "Explore Inventory Features",

    feat_2_title: "Fast & Simple POS for Everyday Sales",
    feat_2_desc: "A checkout experience designed for speed, ensuring your customers never wait in long lines.",
    feat_2_bullet_1: "Barcode scanner integration for lightning-fast checkout.",
    feat_2_bullet_2: "Accept multiple payment methods (Cash, Card, Mobile).",
    feat_2_bullet_3: "Inventory updates instantly the moment a sale is completed.",

    // Landing Page - Pricing Teaser
    price_teaser_title: "Simple Pricing, No Surprises",
    price_teaser_subtitle: "Start for free, upgrade when you need to grow.",
    price_card_1_title: "Starter",
    price_card_1_desc: "Perfect for small, single-location shops.",
    price_card_1_price: "Free",
    price_card_1_period: "/forever",
    price_card_1_bullet_1: "Up to 500 Products",
    price_card_1_bullet_2: "Basic POS",
    price_card_1_bullet_3: "1 User",
    price_card_1_btn: "Get Started",

    price_card_2_badge: "Most Popular",
    price_card_2_title: "Professional",
    price_card_2_desc: "For growing businesses needing more power.",
    price_card_2_price: "$29",
    price_card_2_period: "/month",
    price_card_2_bullet_1: "Unlimited Products",
    price_card_2_bullet_2: "Advanced POS & Barcodes",
    price_card_2_bullet_3: "3 Users",
    price_card_2_bullet_4: "Detailed Reports",
    price_card_2_btn: "Start 14-Day Free Trial",

    price_card_3_title: "Enterprise",
    price_card_3_desc: "Multi-store management and priority support.",
    price_card_3_price: "$79",
    price_card_3_period: "/month",
    price_card_3_bullet_1: "Multiple Locations",
    price_card_3_bullet_2: "Unlimited Users",
    price_card_3_bullet_3: "API Access",
    price_card_3_btn: "Contact Sales",

    price_view_full: "View Full Feature Comparison",

    // Landing Page - Final CTA
    final_cta_title: "Ready to Manage Your Shop Smarter?",
    final_cta_subtitle: "Join thousands of retailers who have simplified their operations, reduced errors, and grown their profits with StockWhisk.",
    final_cta_btn_1: "Start Your Free Trial",
    final_cta_btn_2: "Talk to Sales",
    final_cta_note: "No credit card required. Setup takes 5 minutes.",

    // Existing Pricing Page
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
    footer_rights: "© {year} StockWhisk. All rights reserved.",
    footer_terms: "Terms & Conditions",

    // Reseller Page
    reseller_eyebrow: "🤝 StockWhisk Partner Program",
    reseller_title_1: "Grow with StockWhisk — ",
    reseller_title_2: "earn a share of the profit",
    reseller_subtitle: "Refer retail shops with your unique code and earn a fixed percentage of the profit they generate — every month, transparently.",
    reseller_btn_register: "Become a Reseller →",
    reseller_feat1_title: "Register",
    reseller_feat1_desc: "Sign up as a partner. Your account is reviewed and approved by our team.",
    reseller_feat2_title: "Share your code",
    reseller_feat2_desc: "Get a unique referral code & link. Shops that sign up with it are attributed to you.",
    reseller_feat3_title: "Earn monthly",
    reseller_feat3_desc: "Receive a fixed % of each connected shop’s monthly gross profit — tracked in your dashboard."
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
    
    // Landing Page - Hero
    hero_badge: "#১ ক্লাউড পিওএস সমাধান",
    hero_title_mobile: "আপনার দোকান পরিচালনা করুন",
    hero_title_mobile_highlight: "আরও স্মার্টভাবে",
    hero_title_mobile_suffix: "স্টকহিস্কের সাথে",
    hero_title_desktop: "ইনভেন্টরি ও পিওএস ম্যানেজমেন্ট",
    hero_title_desktop_highlight: "রিটেইল সফটওয়্যার",
    hero_subtitle: "স্পষ্টতা, গতি এবং নির্ভুলতার জন্য তৈরি আধুনিক রিটেইল ড্যাশবোর্ড। ইনভেন্টরি ম্যানেজ করুন, সেলস ট্র্যাক করুন এবং ঝামেলা ছাড়াই আপনার ব্যবসা প্রসারিত করুন।",
    hero_btn_trial: "ফ্রি ট্রায়াল শুরু করুন",
    hero_btn_demo: "লাইভ ডেমো দেখুন",
    hero_sales_today: "আজকের সেলস",
    hero_orders: "অর্ডার",
    hero_sales_trend: "সেলস ট্রেন্ড",

    // Landing Page - Bento Grid
    bento_title: "আপনার রিটেইল ব্যবসার জন্য প্রয়োজনীয় সবকিছু",
    bento_subtitle: "আপনার দৈনন্দিন কাজগুলোকে সহজ করতে সম্পূর্ণ টুলের সমাহার।",
    
    bento_inv_title: "স্মার্ট ইনভেন্টরি",
    bento_inv_desc: "একাধিক ব্রাঞ্চের স্টক রিয়েল-টাইমে ট্র্যাক করুন। স্টক কমে গেলে অটোমেটিক অ্যালার্ট পান।",
    bento_pos_title: "ফাস্ট পিওএস",
    bento_pos_desc: "সহজ চেকআউট ইন্টারফেস দিয়ে দ্রুত ট্রানজ্যাকশন সম্পন্ন করুন।",
    bento_rep_title: "বিস্তারিত রিপোর্ট",
    bento_rep_desc: "সুন্দর চার্টের মাধ্যমে আপনার সেলস ট্রেন্ড এবং লাভের হিসাব বুঝুন।",
    
    bento_small_1_title: "ক্রয় (Purchases)",
    bento_small_1_desc: "অর্ডারিং প্রক্রিয়া সহজ করুন।",
    bento_small_2_title: "কাস্টমার",
    bento_small_2_desc: "লয়্যালটি তৈরি করুন।",
    bento_small_3_title: "সাপ্লায়ার",
    bento_small_3_desc: "ভেন্ডর ম্যানেজ করুন।",

    // Landing Page - Problems
    prob_title: "দোকান পরিচালনা এতটা জটিল হওয়া উচিত নয়",
    prob_1_title: "ম্যানুয়াল স্টক গণনা",
    prob_1_text: "স্টক গণনায় ঘণ্টার পর ঘণ্টা নষ্ট এবং তবুও ভুল হওয়া।",
    prob_2_title: "অগোছালো কাগজের হিসাব",
    prob_2_text: "কে কত টাকার পণ্য কিনলো বা কার কাছে কত পাওনা আছে তা হারিয়ে ফেলা।",
    prob_3_title: "লাভ নিয়ে অনুমান",
    prob_3_text: "কোন প্রোডাক্টগুলো আসলে লাভজনক তা না জানা।",

    prob_sol_badge: "স্টকহিস্কের সমাধান",
    prob_sol_title: "অটোমেশন ও সরলীকরণ",
    prob_sol_text: "স্টকহিস্ক আপনার দোকানের প্রতিটি অংশকে যুক্ত করে। বিক্রি হলে সাথে সাথে ইনভেন্টরি আপডেট হয়। স্টক কিনলে সাপ্লায়ার লেজার সমন্বয় হয়ে যায়। সব কাজ অটোমেটিক!",
    prob_sol_stat_title: "সপ্তাহে ১০+ ঘণ্টা সাশ্রয়",
    prob_sol_stat_text: "কাগজপত্রের চেয়ে ব্যবসা প্রসারে মন দিন।",

    // Landing Page - Flow Diagram
    flow_title: "আপনার সম্পূর্ণ রিটেইল ব্যবসার জন্য একটি মাত্র প্ল্যাটফর্ম",
    flow_step_1: "প্রোডাক্টস",
    flow_step_2: "ক্রয়",
    flow_step_3: "ইনভেন্টরি",
    flow_step_4: "বিক্রয়",
    flow_step_5: "রিপোর্ট",

    // Landing Page - Feature Details
    feat_1_title: "শক্তিশালী ইনভেন্টরি ম্যানেজমেন্ট",
    feat_1_desc: "ম্যানুয়াল গণনা ছাড়াই শেলফে স্টক বজায় রাখুন এবং ডেটা নির্ভুল রাখুন।",
    feat_1_bullet_1: "ক্যাটাগরি, ব্র্যান্ড এবং ভেরিয়েন্ট (সাইজ/কালার) অনুযায়ী সাজান।",
    feat_1_bullet_2: "প্রতিটি পণ্যের মুভমেন্ট হিস্ট্রি ট্র্যাক করুন।",
    feat_1_bullet_3: "স্টক অ্যালার্ট সেট করুন এবং অটোমেটিক নোটিফিকেশন পান।",
    feat_1_link: "ইনভেন্টরি ফিচার দেখুন",

    feat_2_title: "দৈনন্দিন বিক্রির জন্য ফাস্ট ও সিম্পল পিওএস",
    feat_2_desc: "চেকআউট আরও দ্রুত করতে ডিজাইন করা হয়েছে, যাতে কাস্টমারদের দীর্ঘ লাইনে দাঁড়াতে না হয়।",
    feat_2_bullet_1: "বিদ্যুৎ গতির চেকআউটের জন্য বারকোড স্ক্যানার ইন্টিগ্রেশন।",
    feat_2_bullet_2: "একাধিক পেমেন্ট মাধ্যম গ্রহণ করুন (ক্যাশ, কার্ড, মোবাইল)।",
    feat_2_bullet_3: "বিক্রি হওয়ার সাথে সাথেই ইনভেন্টরি স্বয়ংক্রিয়ভাবে আপডেট হয়।",

    // Landing Page - Pricing Teaser
    price_teaser_title: "সহজ প্রাইসিং, কোনো লুকানো চার্জ নেই",
    price_teaser_subtitle: "ফ্রিতে শুরু করুন, ব্যবসা বাড়ার সাথে সাথে আপগ্রেড করুন।",
    price_card_1_title: "স্টার্টার",
    price_card_1_desc: "ছোট, একটি মাত্র দোকানের জন্য আদর্শ।",
    price_card_1_price: "ফ্রি",
    price_card_1_period: "/আজীবন",
    price_card_1_bullet_1: "সর্বোচ্চ ৫০০ প্রোডাক্ট",
    price_card_1_bullet_2: "বেসিক পিওএস",
    price_card_1_bullet_3: "১ জন ইউজার",
    price_card_1_btn: "শুরু করুন",

    price_card_2_badge: "সবচেয়ে জনপ্রিয়",
    price_card_2_title: "প্রফেশনাল",
    price_card_2_desc: "বড় হতে থাকা ব্যবসার জন্য আরও বেশি পাওয়ার।",
    price_card_2_price: "$২৯",
    price_card_2_period: "/মাস",
    price_card_2_bullet_1: "আনলিমিটেড প্রোডাক্ট",
    price_card_2_bullet_2: "অ্যাডভান্সড পিওএস ও বারকোড",
    price_card_2_bullet_3: "৩ জন ইউজার",
    price_card_2_bullet_4: "বিস্তারিত রিপোর্ট",
    price_card_2_btn: "১৪-দিনের ফ্রি ট্রায়াল শুরু করুন",

    price_card_3_title: "এন্টারপ্রাইজ",
    price_card_3_desc: "একাধিক দোকান পরিচালনা এবং প্রাইওরিটি সাপোর্ট।",
    price_card_3_price: "$৭৯",
    price_card_3_period: "/মাস",
    price_card_3_bullet_1: "একাধিক লোকেশন",
    price_card_3_bullet_2: "আনলিমিটেড ইউজার",
    price_card_3_bullet_3: "এপিআই অ্যাক্সেস",
    price_card_3_btn: "আমাদের সাথে কথা বলুন",

    price_view_full: "সম্পূর্ণ ফিচার তুলনা দেখুন",

    // Landing Page - Final CTA
    final_cta_title: "আপনার দোকান আরও স্মার্টভাবে ম্যানেজ করতে প্রস্তুত?",
    final_cta_subtitle: "হাজার হাজার রিটেইলারদের সাথে যোগ দিন যারা স্টকহিস্কের মাধ্যমে তাদের কাজ সহজ করেছেন, ভুল কমিয়েছেন এবং লাভ বাড়িয়েছেন।",
    final_cta_btn_1: "ফ্রি ট্রায়াল শুরু করুন",
    final_cta_btn_2: "আমাদের সাথে কথা বলুন",
    final_cta_note: "কোনো ক্রেডিট কার্ড লাগবে না। সেটআপ করতে মাত্র ৫ মিনিট সময় লাগে।",

    // Existing Pricing Page
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
    footer_rights: "© {year} StockWhisk. সর্বস্বত্ব সংরক্ষিত。",
    footer_terms: "শর্তাবলী ও নীতিমালা",

    // Reseller Page
    reseller_eyebrow: "🤝 স্টকহিস্ক পার্টনার প্রোগ্রাম",
    reseller_title_1: "স্টকহিস্কের সাথে বেড়ে উঠুন — ",
    reseller_title_2: "লাভের একটি অংশ আয় করুন",
    reseller_subtitle: "আপনার ইউনিক কোড দিয়ে রিটেইল শপ রেফার করুন এবং তাদের তৈরি করা লাভের একটি নির্দিষ্ট অংশ আয় করুন — প্রতি মাসে, সম্পূর্ণ স্বচ্ছতার সাথে।",
    reseller_btn_register: "রিসেলার হোন →",
    reseller_feat1_title: "রেজিস্টার করুন",
    reseller_feat1_desc: "পার্টনার হিসেবে সাইন আপ করুন। আমাদের টিম আপনার অ্যাকাউন্টটি রিভিউ করে অ্যাপ্রুভ করবে।",
    reseller_feat2_title: "আপনার কোড শেয়ার করুন",
    reseller_feat2_desc: "একটি ইউনিক রেফারেল কোড এবং লিঙ্ক পান। যে দোকানগুলো এই লিঙ্ক দিয়ে সাইন আপ করবে, তারা আপনার রেফারেল হিসেবে যুক্ত হবে।",
    reseller_feat3_title: "প্রতি মাসে আয় করুন",
    reseller_feat3_desc: "প্রতিটি যুক্ত দোকানের মাসিক মোট লাভের একটি নির্দিষ্ট % পান — যা আপনার ড্যাশবোর্ডে ট্র্যাক করা যায়।"
  }
};
