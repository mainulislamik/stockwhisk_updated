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

// Modernized Feature Styling Dictionary
const FEATURE_MAP: Record<string, { icon: string; color: string; bg: string; border: string; bn: string; en: string }> = {
  "POS Thermal Billing": {
    icon: "🧾",
    color: "#1d4ed8",
    bg: "rgba(37, 99, 235, 0.08)",
    border: "rgba(37, 99, 235, 0.2)",
    bn: "থার্মাল ও A4 পিওএস বিলিং",
    en: "POS Thermal & A4 Billing"
  },
  "Barcode Scanning": {
    icon: "🏷️",
    color: "#6d28d9",
    bg: "rgba(109, 40, 217, 0.08)",
    border: "rgba(109, 40, 217, 0.2)",
    bn: "বারকোড তৈরি ও স্ক্যানিং",
    en: "Barcode Generator & Scanning"
  },
  "Real-Time Stock": {
    icon: "📦",
    color: "#047857",
    bg: "rgba(5, 150, 105, 0.08)",
    border: "rgba(5, 150, 105, 0.2)",
    bn: "রিয়েল-টাইম স্টক লেজার",
    en: "Live Stock & Inventory"
  },
  "Daily Cash Register": {
    icon: "💰",
    color: "#b45309",
    bg: "rgba(217, 119, 6, 0.08)",
    border: "rgba(217, 119, 6, 0.2)",
    bn: "দৈনিক ক্যাশ ও সেলস হিসাব",
    en: "Daily Cash Register"
  },
  "Customer Dues": {
    icon: "👥",
    color: "#0e7490",
    bg: "rgba(14, 116, 144, 0.08)",
    border: "rgba(14, 116, 144, 0.2)",
    bn: "কাস্টমার বাকি ও পেমেন্ট ট্র্যাকিং",
    en: "Customer Dues & Ledger"
  },
  "Service & Repair Tickets (with QR Live Tracking)": {
    icon: "🛠️",
    color: "#4338ca",
    bg: "rgba(67, 56, 202, 0.08)",
    border: "rgba(67, 56, 202, 0.22)",
    bn: "সার্ভিস টিকিট ও লাইভ QR ট্র্যাকিং",
    en: "Service Tickets & Live QR Tracking"
  },
  "Serial Warranty Management": {
    icon: "🛡️",
    color: "#be123c",
    bg: "rgba(190, 18, 60, 0.08)",
    border: "rgba(190, 18, 60, 0.2)",
    bn: "সিরিয়াল ওয়ারেন্টি ম্যানেজমেন্ট",
    en: "Serial & Warranty Tracking"
  },
  "Barcode Scale Integration (EAN-13)": {
    icon: "⚖️",
    color: "#15803d",
    bg: "rgba(22, 128, 61, 0.08)",
    border: "rgba(22, 128, 61, 0.2)",
    bn: "ওজন স্কেল বারকোড (EAN-13)",
    en: "Weight Scale Barcodes"
  },
  "Hold & Recall Cart (F8/F9)": {
    icon: "⏸️",
    color: "#0369a1",
    bg: "rgba(2, 132, 199, 0.08)",
    border: "rgba(2, 132, 199, 0.2)",
    bn: "হোল্ড ও রিকল কার্ট (F8/F9)",
    en: "Hold & Recall Cart"
  },
  "You Saved Discount Receipts": {
    icon: "🎁",
    color: "#c2410c",
    bg: "rgba(194, 65, 12, 0.08)",
    border: "rgba(194, 65, 12, 0.2)",
    bn: "ইউ সেভড ডিসকাউন্ট রসিদ",
    en: "You Saved Savings Receipts"
  },
  "Size/Color Variant Matrix": {
    icon: "👗",
    color: "#be185d",
    bg: "rgba(190, 24, 93, 0.08)",
    border: "rgba(190, 24, 93, 0.2)",
    bn: "সাইজ/রং ভ্যারিয়েন্ট ম্যাট্রিক্স",
    en: "Variant Matrix (Size/Color)"
  },
  "Batch Manufacturing & Production": {
    icon: "🏭",
    color: "#334155",
    bg: "rgba(51, 65, 85, 0.08)",
    border: "rgba(51, 65, 85, 0.2)",
    bn: "ব্যাচ প্রোডাকশন ও ফর্মুলা",
    en: "Batch Manufacturing"
  }
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
      
      clearImpersonation();
      clearTokens();
      // Save tokens in sw_access and sw_refresh (StockWhisk client storage)
      setTokens(authData.access, authData.refresh);
      try {
        localStorage.setItem("themeMode", "light");
        document.documentElement.setAttribute("data-bs-theme", "light");
      } catch {}

      // Hard navigation to /app so AuthProvider and layout re-initialise fresh with new tokens
      window.location.href = "/app";
    } catch (err: any) {
      setError(err?.message || "Demo login failed. Please try again.");
      setBusyShopId(null);
    }
  }

  // Categories that strictly have available demo shops
  const availableCategories = data?.categories || [];
  
  // Flatten all demo shops with their category metadata for side-by-side grid
  const allShopsWithCat = useMemo(() => {
    const list: { shop: DemoShop; cat: DemoCategory }[] = [];
    availableCategories.forEach(cat => {
      cat.shops.forEach(shop => {
        list.push({ shop, cat });
      });
    });
    return list;
  }, [availableCategories]);

  // Filtered list based on selected category pill
  const displayedShopItems = useMemo(() => {
    if (selectedCat === "all") return allShopsWithCat;
    return allShopsWithCat.filter(item => item.cat.key === selectedCat);
  }, [allShopsWithCat, selectedCat]);

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
            <Box sx={{ textAlign: "center", mb: { xs: 4, md: 6 } }}>
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
                  🏬 {isBn ? "সকল ক্যাটাগরি" : "All Categories"} ({allShopsWithCat.length})
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

            {/* Loading State Skeleton */}
            {loading && (
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 3.5 }}>
                {[1, 2].map((n) => (
                  <Skeleton key={n} variant="rounded" height={420} sx={{ borderRadius: "20px" }} />
                ))}
              </Box>
            )}

            {/* ── Side-by-Side Modernized Demo Shop Cards Grid ── */}
            {!loading && displayedShopItems.length > 0 && (
              <Box sx={{ 
                display: "grid", 
                gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, 
                gap: { xs: 3, md: 4 } 
              }}>
                {displayedShopItems.map(({ shop, cat }) => (
                  <Box
                    key={shop.id}
                    sx={{
                      position: "relative",
                      bgcolor: "rgba(255, 255, 255, 0.98)",
                      backdropFilter: "blur(24px)",
                      border: `1px solid rgba(226, 232, 240, 0.95)`,
                      borderRadius: "24px",
                      p: { xs: 3, sm: 3.8 },
                      boxShadow: "0 20px 45px -20px rgba(15,23,42,.12)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      transition: "all .3s cubic-bezier(0.4, 0, 0.2, 1)",
                      overflow: "hidden",
                      "&:hover": {
                        transform: "translateY(-6px)",
                        boxShadow: "0 30px 65px -20px rgba(37,99,235,.3)",
                        borderColor: "rgba(37,99,235,0.45)"
                      }
                    }}
                  >
                    {/* Top Accent Gradient Bar */}
                    <Box sx={{
                      position: "absolute", top: 0, left: 0, right: 0, height: 5,
                      background: cat.key === "supershop"
                        ? "linear-gradient(90deg, #10b981, #06b6d4, #3b82f6)"
                        : "linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6)"
                    }} />

                    <Box>
                      {/* Shop Header */}
                      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, mb: 2 }}>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a", fontSize: { xs: "1.2rem", sm: "1.35rem" }, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 1 }}>
                            <span>{cat.icon}</span> {shop.name}
                          </Typography>
                          <Typography sx={{ color: "#64748b", fontSize: "0.85rem", mt: 0.5, display: "flex", alignItems: "center", gap: 0.5 }}>
                            <span>📍</span> {shop.address}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: "right" }}>
                          <Chip 
                            label={isBn ? cat.name_bn : cat.name_en} 
                            size="small" 
                            sx={{ 
                              bgcolor: "rgba(37,99,235,0.09)", 
                              color: "#1d4ed8", 
                              fontWeight: 700, 
                              borderRadius: "8px",
                              fontSize: "0.78rem",
                              border: "1px solid rgba(37,99,235,0.2)"
                            }} 
                          />
                          <Typography sx={{ fontSize: "0.74rem", color: "#16a34a", fontWeight: 800, mt: 0.6, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5 }}>
                            <span style={{ fontSize: "8px" }}>●</span> Live Demo
                          </Typography>
                        </Box>
                      </Box>

                      {/* Category Description */}
                      <Typography sx={{ color: "#475569", fontSize: "0.88rem", mb: 2.5, lineHeight: 1.45 }}>
                        {isBn ? cat.desc_bn : cat.desc_en}
                      </Typography>

                      {/* Modernized Feature Chips Grid */}
                      <Box sx={{ my: 2.5 }}>
                        <Typography sx={{ 
                          fontSize: "0.76rem", fontWeight: 800, color: "#64748b", 
                          textTransform: "uppercase", letterSpacing: ".08em", mb: 1.5,
                          display: "flex", alignItems: "center", gap: 1
                        }}>
                          <span>⚡</span> {isBn ? "প্রদর্শিত প্রিমিয়াম ফিচারসমূহ:" : "Enabled Demo Features:"}
                        </Typography>

                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" }, gap: 1.2 }}>
                          {shop.features.map((featName, idx) => {
                            const f = FEATURE_MAP[featName] || {
                              icon: "✓",
                              color: "#2563eb",
                              bg: "rgba(37, 99, 235, 0.06)",
                              border: "rgba(37, 99, 235, 0.15)",
                              bn: featName,
                              en: featName
                            };

                            return (
                              <Box
                                key={idx}
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1,
                                  px: 1.4,
                                  py: 0.9,
                                  bgcolor: f.bg,
                                  border: `1px solid ${f.border}`,
                                  borderRadius: "10px",
                                  transition: "all .2s ease",
                                  "&:hover": {
                                    bgcolor: "#fff",
                                    transform: "translateY(-1px)",
                                    boxShadow: "0 4px 10px -2px rgba(15,23,42,.08)"
                                  }
                                }}
                              >
                                <Box sx={{ 
                                  fontSize: "1rem", lineHeight: 1, flexShrink: 0,
                                  width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center"
                                }}>
                                  {f.icon}
                                </Box>
                                <Typography sx={{ 
                                  fontSize: "0.82rem", fontWeight: 700, 
                                  color: f.color, lineHeight: 1.25,
                                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                                }}>
                                  {isBn ? f.bn : f.en}
                                </Typography>
                              </Box>
                            );
                          })}
                        </Box>
                      </Box>
                    </Box>

                    {/* Modernized CTA 1-Click Button */}
                    <Box sx={{ pt: 2.5, borderTop: "1px solid #f1f5f9", mt: 1 }}>
                      <Button
                        variant="contained"
                        fullWidth
                        size="large"
                        disabled={busyShopId === shop.id}
                        onClick={() => enterDemoShop(shop.id)}
                        sx={{
                          background: cat.key === "supershop"
                            ? "linear-gradient(135deg, #059669 0%, #047857 100%)"
                            : "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                          color: "#fff",
                          fontWeight: 800,
                          textTransform: "none",
                          borderRadius: "14px",
                          py: 1.45,
                          fontSize: "1.02rem",
                          letterSpacing: "-0.01em",
                          boxShadow: cat.key === "supershop"
                            ? "0 10px 25px -8px rgba(5,150,105,0.6)"
                            : "0 10px 25px -8px rgba(37,99,235,0.6)",
                          transition: "all .25s ease",
                          "&:hover": { 
                            background: cat.key === "supershop"
                              ? "linear-gradient(135deg, #047857 0%, #065f46 100%)"
                              : "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
                            boxShadow: "0 14px 30px -8px rgba(37,99,235,0.8)",
                            transform: "translateY(-2px)"
                          }
                        }}
                      >
                        {busyShopId === shop.id 
                          ? (isBn ? "ডেমোতে প্রবেশ করা হচ্ছে…" : "Entering Demo…") 
                          : (isBn ? `🚀 ${shop.name} ডেমো এক্সপ্লোর করুন →` : `Explore ${shop.name} Demo →`)}
                      </Button>

                      <Typography sx={{ textAlign: "center", color: "#94a3b8", fontSize: "0.76rem", mt: 1 }}>
                        🔒 {isBn ? "১০০% নিরাপদ · কোনো পাসওয়ার্ড বা লগইন ছাড়াই ডেমো ড্যাশবোর্ডে প্রবেশ করুন" : "100% Safe · Instant 1-click access without typing credentials"}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}

            {/* If no demo shops found */}
            {!loading && displayedShopItems.length === 0 && (
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
