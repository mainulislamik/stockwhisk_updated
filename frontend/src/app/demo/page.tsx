"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Box, Typography, Button, Container, Stack, Alert, Chip, Skeleton } from "@mui/material";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";
import PublicThemeProvider from "@/components/PublicThemeProvider";
import { M } from "@/lib/marketing";

type DemoShop = {
  id: number;
  name: string;
  slug: string;
  business_type: string;
  address: string;
  features: string[];
};

type DemoCategory = {
  key: string;
  name_en: string;
  name_bn: string;
  icon: string;
  desc_en: string;
  desc_bn: string;
  shops: DemoShop[];
};

type DemoResponse = {
  total_demo_shops: number;
  total_categories: number;
  categories: DemoCategory[];
};

export default function CategoryDemoPage() {
  const { lang, t } = useLanguage();
  const [data, setData] = useState<DemoResponse | null>(null);
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [busyShopId, setBusyShopId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const isBn = lang === "bn";

  useEffect(() => {
    async function loadDemoShops() {
      try {
        const res = await fetch("/api/public/demo-shops/");
        if (!res.ok) throw new Error("Failed to load demo stores");
        const json: DemoResponse = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err?.message || "Could not load demo stores.");
      } finally {
        setLoading(false);
      }
    }
    loadDemoShops();
  }, []);

  async function enterDemoShop(shopId?: number) {
    setBusyShopId(shopId || 7);
    setError("");
    try {
      const res = await fetch("/api/public/demo-login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_id: shopId || undefined }),
      });

      if (!res.ok) {
        throw new Error("Demo store login is temporarily unavailable.");
      }

      const authData = await res.json();
      
      // Save tokens
      localStorage.setItem("token", authData.access);
      localStorage.setItem("refresh", authData.refresh);
      try {
        localStorage.setItem("themeMode", "light");
        document.documentElement.setAttribute("data-bs-theme", "light");
      } catch {}

      // Smooth transition to app
      window.location.href = "/app";
    } catch (err: any) {
      setError(err?.message || "Demo login failed. Please try again.");
      setBusyShopId(null);
    }
  }

  // Categories that strictly have available demo shops
  const availableCategories = data?.categories || [];
  
  const displayedCategories = selectedCat === "all"
    ? availableCategories
    : availableCategories.filter(c => c.key === selectedCat);

  return (
    <PublicThemeProvider>
      <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", bgcolor: M.surface, color: M.text, fontFamily: "Outfit, sans-serif" }}>
        <MarketingNav />

        <Box component="main" sx={{ position: "relative", flexGrow: 1, py: { xs: 6, md: 10 }, overflow: "hidden" }}>
          {/* Background Glow */}
          <Box sx={{ 
            position: "absolute", top: "5%", left: "50%", transform: "translateX(-50%)", 
            width: 900, height: 450, 
            background: `radial-gradient(ellipse at center, ${M.accent}25 0%, transparent 70%)`, 
            filter: "blur(70px)", zIndex: 0, pointerEvents: "none" 
          }} />

          <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
            {/* Header Hero */}
            <Box sx={{ textAlign: "center", mb: { xs: 5, md: 7 } }}>
              <Box sx={{ 
                display: "inline-flex", alignItems: "center", gap: 1, px: 2.5, py: 0.8, 
                borderRadius: "30px", bgcolor: "rgba(37,99,235,0.08)", color: M.primary, 
                fontWeight: 700, fontSize: "0.88rem", mb: 2.5, border: `1px solid rgba(37,99,235,0.2)` 
              }}>
                <span style={{ color: "#ef4444", fontSize: "1.2rem", lineHeight: 1 }}>●</span> 
                {isBn ? "লাইভ ইন্টারঅ্যাক্টিভ ডেমো · ১০০% ফ্রি ও রিড-অনলি" : "Live Interactive Demo · 100% Free & Read-Only"}
              </Box>

              <Typography variant="h2" sx={{ 
                fontWeight: 800, mb: 2, 
                fontSize: { xs: "1.85rem", sm: "2.4rem", md: "3.2rem" }, 
                letterSpacing: "-0.03em", color: "#0f172a", lineHeight: 1.2 
              }}>
                {isBn ? "আপনার ব্যবসার ধরন অনুযায়ী ডেমো শপ এক্সপ্লোর করুন" : "Explore Live Demo Tailored to Your Business"}
              </Typography>

              <Typography sx={{ 
                color: M.textMuted, fontSize: { xs: "1rem", md: "1.15rem" }, 
                maxWidth: 720, mx: "auto", lineHeight: 1.6 
              }}>
                {isBn 
                  ? "নিচের যে কোনো ক্যাটাগরির ডেমো স্টোরে ১-ক্লিকে প্রবেশ করুন। POS বিলিং, বারকোড স্ক্যানিং, স্টক লেজার, কাস্টমার বাকি ও রিপোর্টের সম্পূর্ণ অভিজ্ঞতা নিন — কোনো রেজিস্ট্রেশনের প্রয়োজন নেই।"
                  : "Jump directly into a live, fully-populated demo store for your industry. Test POS billing, barcode scanning, real-time inventory, and financial reporting with sample data."}
              </Typography>

              {error && (
                <Alert severity="error" sx={{ maxWidth: 600, mx: "auto", mt: 3 }}>
                  {error}
                </Alert>
              )}
            </Box>

            {/* Category Filter Pills (Only shown when >1 category exists) */}
            {availableCategories.length > 1 && (
              <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 1.5, mb: 5 }}>
                <Button
                  variant={selectedCat === "all" ? "contained" : "outlined"}
                  onClick={() => setSelectedCat("all")}
                  sx={{
                    borderRadius: "50px", textTransform: "none", fontWeight: 700, px: 2.5, py: 0.8,
                    bgcolor: selectedCat === "all" ? M.primary : "rgba(255,255,255,0.8)",
                    color: selectedCat === "all" ? "#fff" : M.text,
                    borderColor: M.border,
                    "&:hover": { bgcolor: selectedCat === "all" ? M.primaryDark : "#f1f5f9" }
                  }}
                >
                  🏬 {isBn ? "সকল ক্যাটাগরি" : "All Categories"} ({data?.total_demo_shops || 0})
                </Button>

                {availableCategories.map((cat) => (
                  <Button
                    key={cat.key}
                    variant={selectedCat === cat.key ? "contained" : "outlined"}
                    onClick={() => setSelectedCat(cat.key)}
                    sx={{
                      borderRadius: "50px", textTransform: "none", fontWeight: 700, px: 2.5, py: 0.8,
                      bgcolor: selectedCat === cat.key ? M.primary : "rgba(255,255,255,0.8)",
                      color: selectedCat === cat.key ? "#fff" : M.text,
                      borderColor: M.border,
                      "&:hover": { bgcolor: selectedCat === cat.key ? M.primaryDark : "#f1f5f9" }
                    }}
                  >
                    {cat.icon} {isBn ? cat.name_bn : cat.name_en} ({cat.shops.length})
                  </Button>
                ))}
              </Box>
            )}

            {/* Loading State */}
            {loading && (
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 3 }}>
                {[1, 2].map((n) => (
                  <Skeleton key={n} variant="rounded" height={320} sx={{ borderRadius: 4 }} />
                ))}
              </Box>
            )}

            {/* Category Groups & Demo Shop Cards */}
            {!loading && displayedCategories.length > 0 && (
              <Stack spacing={6}>
                {displayedCategories.map((cat) => (
                  <Box key={cat.key}>
                    {/* Category Header */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
                      <Box sx={{ 
                        fontSize: "1.8rem", width: 48, height: 48, 
                        display: "flex", alignItems: "center", justifyContent: "center", 
                        borderRadius: "14px", bgcolor: "rgba(37,99,235,0.1)", border: `1px solid rgba(37,99,235,0.2)` 
                      }}>
                        {cat.icon}
                      </Box>
                      <Box>
                        <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f172a", fontSize: { xs: "1.25rem", md: "1.5rem" } }}>
                          {isBn ? cat.name_bn : cat.name_en}
                        </Typography>
                        <Typography sx={{ color: M.textMuted, fontSize: "0.92rem" }}>
                          {isBn ? cat.desc_bn : cat.desc_en}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Demo Shops Grid for this category */}
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 3 }}>
                      {cat.shops.map((shop) => (
                        <Box
                          key={shop.id}
                          sx={{
                            bgcolor: "rgba(255, 255, 255, 0.9)",
                            backdropFilter: "blur(20px)",
                            border: `1px solid ${M.border}`,
                            borderRadius: 4,
                            p: { xs: 3, md: 3.5 },
                            boxShadow: "0 15px 35px -15px rgba(15,23,42,.12)",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            transition: "all .25s ease",
                            "&:hover": {
                              transform: "translateY(-4px)",
                              boxShadow: "0 25px 50px -20px rgba(37,99,235,.25)",
                              borderColor: "rgba(37,99,235,0.4)"
                            }
                          }}
                        >
                          <Box>
                            {/* Shop Title & Badge */}
                            <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, mb: 1.5 }}>
                              <Box>
                                <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a", fontSize: "1.2rem" }}>
                                  {shop.name}
                                </Typography>
                                <Typography sx={{ color: M.textFaint, fontSize: "0.82rem" }}>
                                  📍 {shop.address}
                                </Typography>
                              </Box>
                              <Chip 
                                label={isBn ? cat.name_bn : cat.name_en} 
                                size="small" 
                                sx={{ 
                                  bgcolor: "rgba(37,99,235,0.08)", 
                                  color: M.primary, 
                                  fontWeight: 700, 
                                  borderRadius: "6px" 
                                }} 
                              />
                            </Box>

                            {/* Features list */}
                            <Box sx={{ my: 2.5 }}>
                              <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: M.textFaint, textTransform: "uppercase", letterSpacing: ".05em", mb: 1.2 }}>
                                {isBn ? "প্রদর্শিত ফিচারসমূহ:" : "Enabled Demo Features:"}
                              </Typography>
                              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                                {shop.features.map((feat, idx) => (
                                  <Box
                                    key={idx}
                                    sx={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 0.75,
                                      px: 1.5,
                                      py: 0.5,
                                      bgcolor: "#f8fafc",
                                      border: "1px solid #e2e8f0",
                                      borderRadius: "8px",
                                      fontSize: "0.82rem",
                                      fontWeight: 600,
                                      color: "#334155"
                                    }}
                                  >
                                    <span style={{ color: "#16a34a" }}>✓</span> {feat}
                                  </Box>
                                ))}
                              </Box>
                            </Box>
                          </Box>

                          {/* 1-Click Action Button */}
                          <Box sx={{ pt: 2, borderTop: "1px solid #f1f5f9", mt: 2 }}>
                            <Button
                              variant="contained"
                              fullWidth
                              size="large"
                              disabled={busyShopId === shop.id}
                              onClick={() => enterDemoShop(shop.id)}
                              sx={{
                                bgcolor: M.primary,
                                color: "#fff",
                                fontWeight: 800,
                                textTransform: "none",
                                borderRadius: 3,
                                py: 1.3,
                                fontSize: "1rem",
                                boxShadow: "0 10px 20px -10px rgba(37,99,235,0.5)",
                                "&:hover": { bgcolor: M.primaryDark }
                              }}
                            >
                              {busyShopId === shop.id 
                                ? (isBn ? "ডেমো লোড হচ্ছে…" : "Entering Demo…") 
                                : (isBn ? `🚀 ${shop.name} ডেমো এক্সপ্লোর করুন →` : `Explore ${shop.name} Demo →`)}
                            </Button>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                ))}
              </Stack>
            )}

            {/* If no demo shops found */}
            {!loading && availableCategories.length === 0 && (
              <Box sx={{ textAlign: "center", py: 8 }}>
                <Typography variant="h6" sx={{ color: M.textMuted, mb: 2 }}>
                  {isBn ? "বর্তমানে কোনো ডেমো শপ উপলব্ধ নেই।" : "No demo shops are currently active."}
                </Typography>
                <Link href="/" style={{ textDecoration: "none" }}>
                  <Button variant="outlined" sx={{ borderRadius: "20px" }}>
                    {isBn ? "হোমে ফিরে যান" : "Return to Home"}
                  </Button>
                </Link>
              </Box>
            )}

            {/* SEO & Feature Highlights Section */}
            <Box sx={{ mt: { xs: 8, md: 12 }, pt: 6, borderTop: `1px solid ${M.border}` }}>
              <Typography variant="h4" sx={{ textAlign: "center", fontWeight: 800, color: "#0f172a", mb: 1.5, fontSize: { xs: "1.5rem", md: "2rem" } }}>
                {isBn ? "StockWhisk কেন বাংলাদেশের রিটেইল ব্যবসার সেরা সমাধান?" : "Why StockWhisk is Bangladesh's Leading Retail POS?"}
              </Typography>
              <Typography sx={{ textAlign: "center", color: M.textMuted, maxWidth: 650, mx: "auto", mb: 5, fontSize: "1rem" }}>
                {isBn ? "সহজ ব্যবহার, দ্রুত বিলিং এবং ক্লাউড সিকিউরিটি — যা আপনার দোকানের ব্যবসা পরিচালনা করবে ঝামেলামুক্ত।" : "Fast, reliable cloud POS designed to streamline billing, stock control, and profits."}
              </Typography>

              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }, gap: 3 }}>
                {[
                  {
                    icon: "🛒",
                    title: isBn ? "সুপারফাস্ট POS বিলিং" : "Fast POS Billing",
                    desc: isBn ? "ক্যাশ, কার্ড, বিকাশ ও নগদ পেমেন্ট। থার্মাল ও সাধারণ প্রিন্টারে দ্রুত রসিদ প্রিন্ট।" : "Cash, mobile payments, and split tenders with instant 58mm/80mm thermal receipts."
                  },
                  {
                    icon: "📦",
                    title: isBn ? "লাইভ স্টক ও ইনভেন্টরি" : "Live Inventory Ledger",
                    desc: isBn ? "পণ্যের রিয়েল-টাইম স্টক লেজার, লো-স্টক সতর্কতা ও বারকোড জেনারেশন।" : "Real-time stock ledger with low-stock alerts and instant barcode label generator."
                  },
                  {
                    icon: "📱",
                    title: isBn ? "সার্ভিস রিপেয়ার ও QR ট্র্যাকিং" : "Service Tickets & QR Tracking",
                    desc: isBn ? "মোবাইল ও ইলেকট্রনিক্স রিপেয়ার টিকিট তৈরি ও কাস্টমারের জন্য লাইভ QR ট্র্যাকিং।" : "Repair job management with live customer status tracking via QR code scanning."
                  },
                  {
                    icon: "📊",
                    title: isBn ? "দৈনিক ক্যাশ ও লাভ-ক্ষতি" : "Daily Register & Reports",
                    desc: isBn ? "প্রতিদিনের ক্যাশ ক্লোজিং, বিক্রি, লাভ-ক্ষতি ও খরচের স্বয়ংক্রিয় নিখুঁত হিসাব।" : "Daily shift cash register reconciliation and profit-and-loss business analytics."
                  },
                  {
                    icon: "👥",
                    title: isBn ? "কাস্টমার বাকি ও WhatsApp ইনভয়েস" : "Customer Dues & WhatsApp",
                    desc: isBn ? "গ্রাহকের বাকির খাতা ও এক ক্লিকে WhatsApp-এ ডিজিটাল ইনভয়েস পাঠানো।" : "Track customer credit balances and send PDF invoices directly on WhatsApp."
                  },
                  {
                    icon: "🛡️",
                    title: isBn ? "১০০% সুরক্ষিত ক্লাউড ব্যাকআপ" : "Safe & Cloud Synced",
                    desc: isBn ? "স্বয়ংক্রিয় ক্লাউড ব্যাকআপ ও একাধিক ব্রাঞ্চ বা কম্পিউটার থেকে রিয়েল-টাইম সিঙ্ক।" : "Automated Google Drive / cloud backups with seamless multi-device sync."
                  }
                ].map((item, i) => (
                  <Box
                    key={i}
                    sx={{
                      p: 3,
                      bgcolor: "rgba(255,255,255,0.7)",
                      borderRadius: 3,
                      border: "1px solid #e2e8f0",
                      transition: "transform .2s ease",
                      "&:hover": { transform: "translateY(-2px)", bgcolor: "#fff" }
                    }}
                  >
                    <Box sx={{ fontSize: "2rem", mb: 1.5 }}>{item.icon}</Box>
                    <Typography sx={{ fontWeight: 700, color: "#0f172a", fontSize: "1.1rem", mb: 1 }}>
                      {item.title}
                    </Typography>
                    <Typography sx={{ color: M.textMuted, fontSize: "0.9rem", lineHeight: 1.5 }}>
                      {item.desc}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Container>
        </Box>

        <MarketingFooter />
      </Box>
    </PublicThemeProvider>
  );
}
