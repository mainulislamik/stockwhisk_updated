"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Box, Typography, Button, Container, Stack, Alert, Chip, Skeleton } from "@mui/material";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";
import PublicThemeProvider from "@/components/PublicThemeProvider";
import { M } from "@/lib/marketing";
import { setTokens, clearTokens } from "@/lib/api";
import { clearImpersonation } from "@/lib/impersonation";

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

// Industry Theme Definition
const INDUSTRY_THEMES: Record<string, {
  accentGradient: string;
  btnGradient: string;
  badgeBg: string;
  badgeColor: string;
  badgeBorder: string;
  glowColor: string;
  iconBg: string;
}> = {
  fashion: {
    accentGradient: "linear-gradient(135deg, #7c3aed, #a855f7)",
    btnGradient: "linear-gradient(135deg, #7c3aed, #6d28d9)",
    badgeBg: "rgba(124, 58, 237, 0.08)",
    badgeColor: "#7c3aed",
    badgeBorder: "rgba(124, 58, 237, 0.25)",
    glowColor: "rgba(124, 58, 237, 0.2)",
    iconBg: "rgba(124, 58, 237, 0.12)",
  },
  general: {
    accentGradient: "linear-gradient(135deg, #2563eb, #3b82f6)",
    btnGradient: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    badgeBg: "rgba(37, 99, 235, 0.08)",
    badgeColor: "#1d4ed8",
    badgeBorder: "rgba(37, 99, 235, 0.25)",
    glowColor: "rgba(37, 99, 235, 0.2)",
    iconBg: "rgba(37, 99, 235, 0.12)",
  },
  supershop: {
    accentGradient: "linear-gradient(135deg, #059669, #10b981)",
    btnGradient: "linear-gradient(135deg, #059669, #047857)",
    badgeBg: "rgba(5, 150, 105, 0.08)",
    badgeColor: "#047857",
    badgeBorder: "rgba(5, 150, 105, 0.25)",
    glowColor: "rgba(5, 150, 105, 0.2)",
    iconBg: "rgba(5, 150, 105, 0.12)",
  },
};

const DEFAULT_THEME = {
  accentGradient: "linear-gradient(135deg, #475569, #64748b)",
  btnGradient: "linear-gradient(135deg, #334155, #1e293b)",
  badgeBg: "rgba(71, 85, 105, 0.08)",
  badgeColor: "#334155",
  badgeBorder: "rgba(71, 85, 105, 0.25)",
  glowColor: "rgba(71, 85, 105, 0.2)",
  iconBg: "rgba(71, 85, 105, 0.12)",
};

// Modernized Feature Styling Dictionary
const FEATURE_MAP: Record<string, { icon: string; color: string; bg: string; border: string; bn: string; en: string }> = {
  "POS Thermal Billing": {
    icon: "🧾",
    color: "#1d4ed8",
    bg: "rgba(37, 99, 235, 0.06)",
    border: "rgba(37, 99, 235, 0.18)",
    bn: "থার্মাল ও A4 পিওএস বিলিং",
    en: "POS Thermal & A4 Billing"
  },
  "Barcode Scanning": {
    icon: "🏷️",
    color: "#6d28d9",
    bg: "rgba(109, 40, 217, 0.06)",
    border: "rgba(109, 40, 217, 0.18)",
    bn: "বারকোড তৈরি ও স্ক্যানিং",
    en: "Barcode Generator & Scanning"
  },
  "Real-Time Stock": {
    icon: "📦",
    color: "#047857",
    bg: "rgba(5, 150, 105, 0.06)",
    border: "rgba(5, 150, 105, 0.18)",
    bn: "রিয়েল-টাইম স্টক লেজার",
    en: "Live Stock & Inventory"
  },
  "Daily Cash Register": {
    icon: "💰",
    color: "#b45309",
    bg: "rgba(217, 119, 6, 0.06)",
    border: "rgba(217, 119, 6, 0.18)",
    bn: "দৈনিক ক্যাশ ও সেলস হিসাব",
    en: "Daily Cash Register Closing"
  },
  "Customer Dues": {
    icon: "👥",
    color: "#0e7490",
    bg: "rgba(14, 116, 144, 0.06)",
    border: "rgba(14, 116, 144, 0.18)",
    bn: "কাস্টমার বাকি ও রসিদ",
    en: "Customer Dues & Ledgers"
  },
  "Service & Repair Tickets (with QR Live Tracking)": {
    icon: "🛠️",
    color: "#4338ca",
    bg: "rgba(67, 56, 202, 0.06)",
    border: "rgba(67, 56, 202, 0.18)",
    bn: "সার্ভিস টিকিট ও QR ট্র্যাকিং",
    en: "Repair Tickets & Live QR Tracking"
  },
  "Serial Warranty Management": {
    icon: "🛡️",
    color: "#be123c",
    bg: "rgba(190, 18, 60, 0.06)",
    border: "rgba(190, 18, 60, 0.18)",
    bn: "সিরিয়াল ওয়ারেন্টি ট্র্যাকিং",
    en: "Serial Warranty Management"
  },
  "Barcode Scale Integration (EAN-13)": {
    icon: "⚖️",
    color: "#15803d",
    bg: "rgba(22, 128, 61, 0.06)",
    border: "rgba(22, 128, 61, 0.18)",
    bn: "ওয়েট স্কেল বারকোড (EAN-13)",
    en: "Weight Scale Barcodes (EAN-13)"
  },
  "Hold & Recall Cart (F8/F9)": {
    icon: "⏸️",
    color: "#0369a1",
    bg: "rgba(3, 105, 161, 0.06)",
    border: "rgba(3, 105, 161, 0.18)",
    bn: "হোল্ড ও রিকল কার্ট (F8/F9)",
    en: "Hold & Recall Carts (F8/F9)"
  },
  "You Saved Discount Receipts": {
    icon: "🎁",
    color: "#c2410c",
    bg: "rgba(194, 65, 12, 0.06)",
    border: "rgba(194, 65, 12, 0.18)",
    bn: "ইউ সেভড (You Saved) রসিদ",
    en: "You Saved Discount Receipts"
  },
  "Size/Color Variant Matrix": {
    icon: "👗",
    color: "#be185d",
    bg: "rgba(190, 24, 93, 0.06)",
    border: "rgba(190, 24, 93, 0.18)",
    bn: "সাইজ ও কালার ভ্যারিয়েন্ট",
    en: "Size & Color Variant Matrix"
  },
  "Barcode Hangtag Printing": {
    icon: "🏷️",
    color: "#7c3aed",
    bg: "rgba(124, 58, 237, 0.06)",
    border: "rgba(124, 58, 237, 0.18)",
    bn: "বারকোড হ্যাংট্যাগ প্রিন্টিং",
    en: "Hangtag Barcode Printing"
  },
  "Alteration & Exchange Tracking": {
    icon: "✂️",
    color: "#b91c1c",
    bg: "rgba(185, 28, 28, 0.06)",
    border: "rgba(185, 28, 28, 0.18)",
    bn: "অল্টারেশন ও এক্সচেঞ্জ ট্র্যাকিং",
    en: "Alteration & Exchange Tracking"
  }
};

export default function DemoPage() {
  const { lang } = useLanguage();
  const isBn = lang === "bn";

  const [categories, setCategories] = useState<DemoCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [enteringShopId, setEnteringShopId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDemoShops() {
      try {
        setLoading(true);
        const res = await fetch("/api/public/demo-shops/");
        if (!res.ok) throw new Error("Failed to load demo shops");
        const data: DemoResponse = await res.json();
        setCategories(data.categories || []);
      } catch (err: any) {
        console.error("Demo load error:", err);
        setError(isBn ? "ডেমো শপের তথ্য লোড করা যায়নি।" : "Failed to load demo stores.");
      } finally {
        setLoading(false);
      }
    }
    loadDemoShops();
  }, [isBn]);

  const allShopsList = useMemo(() => {
    const list: { shop: DemoShop; cat: DemoCategory }[] = [];
    categories.forEach((cat) => {
      cat.shops.forEach((shop) => {
        list.push({ shop, cat });
      });
    });
    return list;
  }, [categories]);

  const displayedShopItems = useMemo(() => {
    if (selectedCategory === "all") return allShopsList;
    return allShopsList.filter((item) => item.cat.key === selectedCategory);
  }, [selectedCategory, allShopsList]);

  async function enterDemoShop(shopId: number) {
    try {
      setEnteringShopId(shopId);
      setError(null);

      const res = await fetch("/api/public/demo-login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_id: shopId }),
      });

      if (!res.ok) {
        throw new Error("Demo login failed");
      }

      const authData = await res.json();

      // Wipe any lingering admin impersonation or old session
      clearImpersonation();
      clearTokens();

      // Set the fresh demo tokens
      setTokens(authData.access, authData.refresh);

      // Redirect smoothly into the live demo shop dashboard
      window.location.href = "/app";
    } catch (err: any) {
      console.error("Demo entry error:", err);
      setError(isBn ? "ডেমো শপে প্রবেশ করা সম্ভব হচ্ছে না। অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন।" : "Could not log into demo store. Please try again.");
      setEnteringShopId(null);
    }
  }

  return (
    <PublicThemeProvider>
      <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", bgcolor: "#f8fafc", color: "#0f172a" }}>
        <MarketingNav />

        {/* HERO HEADER */}
        <Box sx={{ pt: { xs: 5, md: 7 }, pb: { xs: 4, md: 5 }, bgcolor: "#ffffff", borderBottom: "1px solid #e2e8f0", textAlign: "center" }}>
          <Container maxWidth="lg">
            <Stack spacing={2} sx={{ alignItems: "center", maxWidth: 880, mx: "auto" }}>
              
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 1,
                  px: 2,
                  py: 0.6,
                  borderRadius: "24px",
                  bgcolor: "rgba(37, 99, 235, 0.08)",
                  border: "1px solid rgba(37, 99, 235, 0.2)",
                  color: "#1d4ed8",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#16a34a", boxShadow: "0 0 8px #16a34a" }} />
                <span>{isBn ? "লাইভ ইন্টারঅ্যাক্টিভ ডেমো · রিড-অনলি (Live Interactive Demo)" : "Live Interactive Sandbox · Read-Only"}</span>
              </Box>

              <Typography
                component="h1"
                sx={{
                  fontSize: { xs: "26px", sm: "34px", md: "42px" },
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  color: "#0f172a",
                  lineHeight: 1.25,
                }}
              >
                {isBn ? "আপনার ব্যবসার ধরন অনুযায়ী ডেমো শপ এক্সপ্লোর করুন" : "Explore Live Demo Tailored to Your Business"}
              </Typography>

              <Typography
                sx={{
                  fontSize: { xs: "14px", sm: "16px" },
                  color: "#475569",
                  lineHeight: 1.6,
                  maxWidth: 760,
                }}
              >
                {isBn
                  ? "নিচের যেকোনো ক্যাটাগরির ডেমো স্টোরে ১-ক্লিকে সরাসরি প্রবেশ করুন। পিওএস বিলিং, বারকোড স্ক্যানিং, স্টক লেজার, কাস্টমার বাকি ও রিপোর্ট সম্পূর্ণ রিয়েল-টাইমে অভিজ্ঞতা নিন — কোনো পাসওয়ার্ডের প্রয়োজন নেই।"
                  : "Experience StockWhisk's live cloud POS, inventory, barcode scanning, dues tracking, and reports in a real-time sandbox tailored for your industry."}
              </Typography>

              {/* Dynamic Category Filter Pills */}
              {!loading && categories.length > 1 && (
                <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 1, pt: 2 }}>
                  <Chip
                    label={`${isBn ? "সকল ক্যাটাগরি" : "All Categories"} (${allShopsList.length})`}
                    onClick={() => setSelectedCategory("all")}
                    sx={{
                      fontWeight: 700,
                      fontSize: "13px",
                      py: 2.2,
                      px: 1,
                      cursor: "pointer",
                      bgcolor: selectedCategory === "all" ? "#1e293b" : "#f1f5f9",
                      color: selectedCategory === "all" ? "#ffffff" : "#475569",
                      border: "1px solid",
                      borderColor: selectedCategory === "all" ? "#1e293b" : "#cbd5e1",
                      "&:hover": { bgcolor: selectedCategory === "all" ? "#0f172a" : "#e2e8f0" }
                    }}
                  />
                  {categories.map((cat) => (
                    <Chip
                      key={cat.key}
                      icon={<span style={{ fontSize: "15px" }}>{cat.icon}</span>}
                      label={`${isBn ? cat.name_bn : cat.name_en} (${cat.shops.length})`}
                      onClick={() => setSelectedCategory(cat.key)}
                      sx={{
                        fontWeight: 700,
                        fontSize: "13px",
                        py: 2.2,
                        px: 1,
                        cursor: "pointer",
                        bgcolor: selectedCategory === cat.key ? "#2563eb" : "#f1f5f9",
                        color: selectedCategory === cat.key ? "#ffffff" : "#475569",
                        border: "1px solid",
                        borderColor: selectedCategory === cat.key ? "#2563eb" : "#cbd5e1",
                        "&:hover": { bgcolor: selectedCategory === cat.key ? "#1d4ed8" : "#e2e8f0" }
                      }}
                    />
                  ))}
                </Box>
              )}
            </Stack>
          </Container>
        </Box>

        {/* DEMO CARDS GRID */}
        <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 }, flexGrow: 1 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 4, borderRadius: "12px", maxWidth: 700, mx: "auto" }}>
              {error}
            </Alert>
          )}

          {/* Loading Skeletons */}
          {loading && (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }, gap: 3.5 }}>
              {[1, 2, 3].map((n) => (
                <Skeleton key={n} variant="rounded" height={460} sx={{ borderRadius: "20px" }} />
              ))}
            </Box>
          )}

          {/* Side-by-Side Unified Cards Grid */}
          {!loading && displayedShopItems.length > 0 && (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: displayedShopItems.length === 2 ? "repeat(2, 1fr)" : "repeat(2, 1fr)",
                  lg: displayedShopItems.length >= 3 ? "repeat(3, 1fr)" : "repeat(2, 1fr)",
                },
                gap: 3.5,
                alignItems: "stretch",
              }}
            >
              {displayedShopItems.map(({ shop, cat }) => {
                const theme = INDUSTRY_THEMES[cat.key] || DEFAULT_THEME;
                const isCurrentEntering = enteringShopId === shop.id;

                return (
                  <Box
                    key={shop.id}
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      bgcolor: "#ffffff",
                      borderRadius: "20px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)",
                      overflow: "hidden",
                      transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                      position: "relative",
                      "&:hover": {
                        transform: "translateY(-4px)",
                        boxShadow: `0 16px 36px ${theme.glowColor}`,
                        borderColor: theme.badgeColor,
                      },
                    }}
                  >
                    {/* Top Gradient Accent Line */}
                    <Box sx={{ height: 5, background: theme.accentGradient }} />

                    {/* Card Content Wrapper */}
                    <Box sx={{ p: { xs: 2.5, sm: 3 }, display: "flex", flexDirection: "column", flexGrow: 1 }}>
                      
                      {/* Top Header Row: Category Badge + Live Status */}
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1.5 }}>
                        <Box
                          sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.8,
                            px: 1.4,
                            py: 0.4,
                            borderRadius: "14px",
                            bgcolor: theme.badgeBg,
                            color: theme.badgeColor,
                            border: `1px solid ${theme.badgeBorder}`,
                            fontSize: "12px",
                            fontWeight: 700,
                          }}
                        >
                          <span>{cat.icon}</span>
                          <span>{isBn ? cat.name_bn : cat.name_en}</span>
                        </Box>

                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, fontSize: "11px", fontWeight: 700, color: "#16a34a" }}>
                          <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "#16a34a", boxShadow: "0 0 6px #16a34a" }} />
                          <span>{isBn ? "লাইভ ডেমো" : "Live Demo"}</span>
                        </Box>
                      </Box>

                      {/* Shop Name */}
                      <Typography
                        component="h2"
                        sx={{
                          fontSize: { xs: "18px", sm: "20px" },
                          fontWeight: 800,
                          color: "#0f172a",
                          mb: 0.8,
                          lineHeight: 1.3,
                        }}
                      >
                        {shop.name}
                      </Typography>

                      {/* Address / Location with Min Height for Uniform Alignment */}
                      <Box sx={{ minHeight: "42px", display: "flex", alignItems: "flex-start", gap: 0.8, color: "#64748b", fontSize: "12.5px", mb: 2 }}>
                        <span>📍</span>
                        <Typography sx={{ fontSize: "12.5px", color: "#64748b", lineHeight: 1.4 }}>
                          {shop.address}
                        </Typography>
                      </Box>

                      {/* Divider */}
                      <Box sx={{ height: "1px", bgcolor: "#f1f5f9", mb: 2 }} />

                      {/* Feature Chips Section */}
                      <Typography sx={{ fontSize: "11.5px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", mb: 1.2 }}>
                        ⚡ {isBn ? "প্রদর্শিত প্রিমিয়াম ফিচারসমূহ:" : "Enabled Demo Features:"}
                      </Typography>

                      {/* Flex-Wrap Chips (Zero Clipping Guaranteed) */}
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8, mb: 2.5, flexGrow: 1, minHeight: "170px", alignContent: "flex-start" }}>
                        {shop.features.map((featName, idx) => {
                          const f = FEATURE_MAP[featName] || {
                            icon: "✓",
                            color: "#334155",
                            bg: "rgba(51, 65, 85, 0.06)",
                            border: "rgba(51, 65, 85, 0.18)",
                            bn: featName,
                            en: featName,
                          };

                          return (
                            <Box
                              key={idx}
                              sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 0.7,
                                px: 1.2,
                                py: 0.5,
                                borderRadius: "16px",
                                bgcolor: f.bg,
                                border: `1px solid ${f.border}`,
                                fontSize: "12px",
                                fontWeight: 600,
                                color: "#1e293b",
                                transition: "all 0.15s ease",
                                "&:hover": {
                                  bgcolor: "#ffffff",
                                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                                  borderColor: f.color,
                                }
                              }}
                            >
                              <span style={{ fontSize: "13px" }}>{f.icon}</span>
                              <span>{isBn ? f.bn : f.en}</span>
                            </Box>
                          );
                        })}
                      </Box>

                      {/* Action CTA Button (Pushed to bottom uniformly via margin-top: auto) */}
                      <Box sx={{ mt: "auto", pt: 1 }}>
                        <Button
                          fullWidth
                          variant="contained"
                          disabled={isCurrentEntering}
                          onClick={() => enterDemoShop(shop.id)}
                          sx={{
                            background: theme.btnGradient,
                            color: "#ffffff",
                            fontWeight: 700,
                            fontSize: "14px",
                            py: 1.4,
                            borderRadius: "12px",
                            textTransform: "none",
                            boxShadow: `0 4px 14px ${theme.glowColor}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 1,
                            transition: "all 0.2s ease",
                            "&:hover": {
                              background: theme.btnGradient,
                              filter: "brightness(1.08)",
                              boxShadow: `0 8px 22px ${theme.glowColor}`,
                              transform: "translateY(-1px)",
                            },
                          }}
                        >
                          {isCurrentEntering ? (
                            <span>{isBn ? "প্রবেশ করা হচ্ছে…" : "Connecting Sandbox…"}</span>
                          ) : (
                            <>
                              <span>🚀 {isBn ? "ডেমো এক্সপ্লোর করুন" : "Explore Live Demo"}</span>
                              <span>→</span>
                            </>
                          )}
                        </Button>
                      </Box>

                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}

          {/* Fallback Empty */}
          {!loading && displayedShopItems.length === 0 && (
            <Box sx={{ textAlign: "center", py: 8, bgcolor: "#ffffff", borderRadius: "16px", border: "1px dashed #cbd5e1" }}>
              <Typography sx={{ color: "#64748b", fontSize: "16px", fontWeight: 600 }}>
                {isBn ? "এই ক্যাটাগরিতে বর্তমানে কোনো ডেমো শপ সক্রিয় নেই।" : "No live demo store available in this category."}
              </Typography>
            </Box>
          )}
        </Container>

        {/* FEATURE OVERVIEW SECTION FOR MARKETING & SEO */}
        <Box sx={{ py: { xs: 6, md: 8 }, bgcolor: "#ffffff", borderTop: "1px solid #e2e8f0" }}>
          <Container maxWidth="lg">
            <Stack spacing={4} sx={{ textAlign: "center", alignItems: "center" }}>
              <Box sx={{ maxWidth: 700 }}>
                <Typography sx={{ fontSize: "13px", fontWeight: 800, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>
                  {isBn ? "কেন StockWhisk বেছে নেবেন?" : "Why Choose StockWhisk?"}
                </Typography>
                <Typography component="h2" sx={{ fontSize: { xs: "22px", md: "30px" }, fontWeight: 800, color: "#0f172a", mb: 1 }}>
                  {isBn ? "যেকোনো রিটেইল ও হোলসেল ব্যবসার জন্য তৈরি" : "Engineered for Every Retail & Wholesale Business"}
                </Typography>
                <Typography sx={{ color: "#64748b", fontSize: "14.5px" }}>
                  {isBn ? "সহজ ব্যবহার, দ্রুত বিলিং এবং ক্লাউড সিকিউরিটি — যা আপনার দোকানের ব্যবসা পরিচালনা করবে ঝামেলামুক্ত।" : "Fast, reliable cloud POS designed to streamline billing, stock control, and profits."}
                </Typography>
              </Box>

              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }, gap: 3, width: "100%", textAlign: "left" }}>
                {[
                  {
                    icon: "🛒",
                    titleBn: "সুপারফাস্ট POS ও দ্রুত চেকআউট",
                    titleEn: "Lightning Fast POS Billing",
                    descBn: "কিবোর্ড শর্টকাট (F12), বারকোড স্ক্যানিং, স্প্লিট পেমেন্ট এবং হোল্ড/রিকল কার্ট সুবিধা।",
                    descEn: "Keyboard hotkeys (F12), instant barcode lookup, split payments and hold/recall carts."
                  },
                  {
                    icon: "📦",
                    titleBn: "স্মার্ট ইনভেন্টরি ও স্টক লেজার",
                    titleEn: "Smart Stock & Inventory",
                    descBn: "রিয়েল-টাইম স্টক লেজার, লো-স্টক অ্যালার্ট, মেয়াদ ট্র্যাকিং এবং ব্যাচ ওয়্যারহাউজ ম্যানেজমেন্ট।",
                    descEn: "Real-time stock ledger, low stock alerts, expiry dates and multi-batch management."
                  },
                  {
                    icon: "⚖️",
                    titleBn: "ওজন স্কেল ও বারকোড ইন্টিগ্রেশন",
                    titleEn: "Weight Scale & Barcode Matrix",
                    descBn: "সুপারশপের ওজন স্কেল স্টিকার (EAN-13) অটো-ডিকোডিং এবং কাস্টম হ্যাংট্যাগ প্রিন্টিং।",
                    descEn: "EAN-13 weight scale parsing and custom barcode hangtag generation."
                  },
                  {
                    icon: "👥",
                    titleBn: "কাস্টমার বাকি ও লয়্যালটি পয়েন্ট",
                    titleEn: "Customer Dues & Loyalty Club",
                    descBn: "বাকি খাতা, পেমেন্ট রসিদ, ক্লাব রিওয়ার্ড পয়েন্ট এবং WhatsApp চালান শেয়ারিং।",
                    descEn: "Credit ledgers, automated payment receipts, loyalty rewards and WhatsApp invoices."
                  },
                  {
                    icon: "📊",
                    titleBn: "দৈনিক ক্যাশ ও অডিটিং হিসাব",
                    titleEn: "Daily Cash Register & Audit",
                    descBn: "শিফট ওপেনিং/ক্লোজিং ক্যাশ রিকনসিলিয়েশন এবং ডে-এন্ড প্রফিট ও লস রিপোর্ট।",
                    descEn: "Shift opening/closing cash drawer reconciliation and daily profit/loss analytics."
                  },
                  {
                    icon: "🔒",
                    titleBn: "১০০% ক্লাউড ব্যাকআপ ও নিরাপদ",
                    titleEn: "100% Cloud Synced & Secure",
                    descBn: "কোনো ডেটা হারানোর ভয় নেই, যেকোনো ডিভাইস (মোবাইল/কম্পিউটার) থেকে পরিচালনাযোগ্য।",
                    descEn: "Zero data loss risk, access anywhere from mobile, tablet or PC."
                  }
                ].map((item, i) => (
                  <Box
                    key={i}
                    sx={{
                      p: 3,
                      borderRadius: "16px",
                      bgcolor: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      transition: "all 0.2s ease",
                      "&:hover": { bgcolor: "#ffffff", boxShadow: "0 8px 24px rgba(0,0,0,0.06)", transform: "translateY(-2px)" }
                    }}
                  >
                    <Box sx={{ fontSize: "28px", mb: 1.5 }}>{item.icon}</Box>
                    <Typography sx={{ fontWeight: 700, fontSize: "16px", color: "#0f172a", mb: 0.8 }}>
                      {isBn ? item.titleBn : item.titleEn}
                    </Typography>
                    <Typography sx={{ fontSize: "13px", color: "#64748b", lineHeight: 1.5 }}>
                      {isBn ? item.descBn : item.descEn}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Stack>
          </Container>
        </Box>

        <MarketingFooter />
      </Box>
    </PublicThemeProvider>
  );
}
