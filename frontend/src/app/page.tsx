"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Box, Typography, Button, Container, Stack, Grid, Accordion, AccordionSummary, AccordionDetails } from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";
import PublicThemeProvider from "@/components/PublicThemeProvider";
import { api } from "@/lib/api";
import { M } from "@/lib/marketing";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBranding } from "@/lib/branding";

const btnPrimary = {
  bgcolor: M.primary, color: M.onPrimary, fontWeight: 700, textTransform: "none" as const,
  borderRadius: "12px", px: 4, py: 1.5, fontSize: "1rem",
  boxShadow: "0 10px 24px -8px rgba(37,99,235,.65)",
  "&:hover": { bgcolor: M.primaryDark },
};
const btnGhost = {
  bgcolor: M.card, color: M.text, border: `1px solid ${M.borderStrong}`,
  fontWeight: 700, textTransform: "none" as const, borderRadius: "12px", px: 4, py: 1.5, fontSize: "1rem",
  "&:hover": { bgcolor: M.surfaceTint, borderColor: M.primary, color: M.primary },
};

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Box sx={{
      flex: 1, bgcolor: accent ? M.primary : M.card, color: accent ? "#fff" : M.text,
      border: `1px solid ${accent ? "transparent" : M.border}`, borderRadius: "12px", p: 1.5,
    }}>
      <Typography sx={{ fontSize: ".68rem", opacity: accent ? 0.85 : 0.6, fontWeight: 600 }}>{label}</Typography>
      <Typography sx={{ fontSize: "1.1rem", fontWeight: 800, lineHeight: 1.2 }}>{value}</Typography>
    </Box>
  );
}

export default function LandingPage() {
  const { t } = useLanguage();
  const branding = useBranding();
  const [trialDays, setTrialDays] = useState(45);
  useEffect(() => {
    api<{ trial_days: number }>("/platform/public/site-config/")
      .then((d) => { if (d?.trial_days != null) setTrialDays(d.trial_days); })
      .catch(() => {});
  }, []);

  const STATS = [
    { value: t("stat_trial_val").replace("{days}", String(trialDays)), label: t("stat_trial") },
    { value: t("stat_speed_val"), label: t("stat_speed") },
    { value: t("stat_uptime_val"), label: t("stat_uptime") },
    { value: t("stat_ownership_val"), label: t("stat_ownership") },
  ];

  const INDUSTRIES = [
    { key: "retail", icon: "bi-shop", title: t("industries_retail"), img: "/industries/retail.svg" },
    { key: "grocery", icon: "bi-cart-check", title: t("industries_grocery"), img: "/industries/grocery.svg" },
    { key: "fashion", icon: "bi-tags", title: t("industries_fashion"), img: "/industries/fashion.svg" },
    { key: "electronics", icon: "bi-phone", title: t("industries_electronics"), img: "/industries/electronics.svg" },
    { key: "sme", icon: "bi-box-seam", title: t("industries_sme"), img: "/industries/sme.svg" },
    { key: "automobile", icon: "bi-car-front", title: t("industries_auto"), img: "/industries/automobile.svg" },
  ];

  const WHY_CHOOSE_US = [
    { title: t("why_easy_title"), text: t("why_easy_text") },
    { title: t("why_secure_title"), text: t("why_secure_text") },
    { title: t("why_cloud_title"), text: t("why_cloud_text") },
    { title: t("why_support_title"), text: t("why_support_text") },
  ];

  const FEATURES = [
    { icon: "bi-upc-scan", title: t("feat_pos"), desc: "Scan-and-sell checkout with per-unit barcodes, shared-barcode picker and mobile camera scanning." },
    { icon: "bi-box-seam", title: "Inventory & Stock", desc: "Real-time stock levels, purchase receiving, adjustments and low-stock alerts across branches." },
    { icon: "bi-shield-check", title: "Warranty Tracking", desc: "Auto-record warranty per sold unit, track coverage and service tickets, expire automatically." },
    { icon: "bi-graph-up-arrow", title: t("feat_basic_analytics"), desc: "Daily sales, profit margins, top products and exportable reports — clarity at a glance." },
    { icon: "bi-people", title: "Customers & Suppliers", desc: "Customer dues, supplier balances, EMI installments and full purchase history in one place." },
    { icon: "bi-diagram-3", title: t("feat_multi_branch"), desc: "Run multiple outlets, add staff with roles and permissions, keep every branch in sync." },
  ];

  return (
    <PublicThemeProvider>
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", bgcolor: M.surface, color: M.text, fontFamily: "Outfit, sans-serif" }}>
      <MarketingNav />

      <Box component="main" sx={{ flexGrow: 1 }}>
        {/* ── Hero ── */}
        <Box sx={{
          position: "relative", overflow: "hidden",
          pt: { xs: 8, md: 12 }, pb: { xs: 8, md: 12 },
        }}>
          {/* Glowing Orbs */}
          <Box sx={{ position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)", width: 800, height: 400, background: `radial-gradient(ellipse at center, ${M.accent}33 0%, transparent 70%)`, filter: "blur(60px)", zIndex: 0, pointerEvents: "none" }} />
          
          <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
            <Box sx={{ textAlign: "center", maxWidth: 860, mx: "auto" }}>
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, px: 2, py: 0.75, borderRadius: "20px", bgcolor: "rgba(37,99,235,0.08)", color: M.primary, fontWeight: 700, fontSize: "0.85rem", mb: 3, border: `1px solid rgba(37,99,235,0.2)` }}>
                <i className="bi bi-star-fill" style={{ color: "#f59e0b" }}></i>
                {t("hero_badge")}
              </Box>
              <Typography component="h1" sx={{
                fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1,
                fontSize: { xs: "2.5rem", md: "4rem" }, mb: 2.5,
              }}>
                {t("hero_title")}
              </Typography>
              <Typography sx={{ color: M.textMuted, fontSize: { xs: "1.05rem", md: "1.2rem" }, lineHeight: 1.6, maxWidth: 680, mx: "auto", mb: 5 }}>
                {t("hero_subtitle")}
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "center" }}>
                <Button component={Link} href="/register" sx={btnPrimary}>{t("hero_btn_register")}</Button>
                <Button component={Link} href="/demo" sx={{
                  bgcolor: "#059669", color: "#fff", fontWeight: 700, textTransform: "none",
                  borderRadius: "12px", px: 4, py: 1.5, fontSize: "1rem",
                  boxShadow: "0 10px 24px -8px rgba(5,150,105,.6)", "&:hover": { bgcolor: "#047857" },
                }}>▶ {t("hero_btn_demo")}</Button>
              </Stack>
            </Box>

            {/* Dashboard Preview */}
            <Box sx={{
              mt: { xs: 6, md: 8 }, maxWidth: 980, mx: "auto",
              borderRadius: "20px", border: `1px solid ${M.border}`, bgcolor: M.card,
              boxShadow: "0 30px 60px -30px rgba(15,23,42,.35)", overflow: "hidden",
            }}>
              {/* window bar */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.25, borderBottom: `1px solid ${M.border}`, bgcolor: M.surfaceTint }}>
                {["#ef4444", "#f59e0b", "#22c55e"].map((c) => (<Box key={c} sx={{ width: 11, height: 11, borderRadius: 999, bgcolor: c }} />))}
                <Typography sx={{ ml: 1.5, fontSize: ".8rem", color: M.textFaint, fontWeight: 600 }}>stockwhisk.com/app</Typography>
              </Box>
              <Box sx={{ display: "flex", minHeight: { xs: 220, md: 320 } }}>
                {/* sidebar */}
                <Box sx={{ width: { xs: 0, sm: 190 }, display: { xs: "none", sm: "block" }, borderRight: `1px solid ${M.border}`, p: 2 }}>
                  <Box sx={{ height: 10, width: "60%", bgcolor: M.primary, borderRadius: 999, mb: 2.5, opacity: .9 }} />
                  {["Dashboard", "POS", "Products", "Inventory", "Reports"].map((t, i) => (
                    <Box key={t} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, opacity: i === 1 ? 1 : 0.5 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: 2, bgcolor: i === 1 ? M.primary : M.textFaint }} />
                      <Typography sx={{ fontSize: ".8rem", fontWeight: i === 1 ? 700 : 500, color: i === 1 ? M.primary : M.textMuted }}>{t}</Typography>
                    </Box>
                  ))}
                </Box>
                {/* content */}
                <Box sx={{ flex: 1, p: { xs: 2, md: 3 } }}>
                  <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
                    <MiniStat label="Today's Sales" value="৳ 48,250" accent />
                    <MiniStat label="Orders" value="126" />
                    <MiniStat label="Low Stock" value="7" />
                  </Stack>
                  <Box sx={{ bgcolor: M.surfaceTint, border: `1px solid ${M.border}`, borderRadius: "12px", p: 2 }}>
                    <Typography sx={{ fontSize: ".78rem", color: M.textFaint, fontWeight: 700, mb: 1.5 }}>Sales this week</Typography>
                    <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1, height: { xs: 90, md: 140 } }}>
                      {[45, 62, 38, 78, 55, 90, 70].map((h, i) => (
                        <Box key={i} sx={{ flex: 1, height: `${h}%`, borderRadius: "6px 6px 0 0",
                          background: `linear-gradient(180deg, ${M.accent}, ${M.primary})`, opacity: 0.85 + (i === 5 ? 0.15 : 0) }} />
                      ))}
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Container>
        </Box>

        {/* ── Stats band ── */}
        <Box sx={{ bgcolor: M.surfaceAlt, borderTop: `1px solid ${M.border}`, borderBottom: `1px solid ${M.border}`, py: { xs: 5, md: 7 } }}>
          <Container maxWidth="lg">
            <Grid container spacing={2}>
              {STATS.map((s) => (
                <Grid key={s.label} size={{ xs: 6, md: 3 }} sx={{ textAlign: "center" }}>
                  <Typography sx={{ fontWeight: 800, fontSize: { xs: "1.8rem", md: "2.4rem" }, color: M.primary, letterSpacing: "-0.02em" }}>{s.value}</Typography>
                  <Typography sx={{ color: M.textMuted, fontWeight: 600, fontSize: ".9rem" }}>{s.label}</Typography>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* ── Industries ── */}
        <Box sx={{ py: { xs: 8, md: 12 } }}>
          <Container maxWidth="lg">
            <Box sx={{ textAlign: "center", mb: { xs: 5, md: 7 } }}>
              <Typography sx={{ color: M.primary, fontWeight: 800, letterSpacing: ".08em", fontSize: ".85rem", textTransform: "uppercase", mb: 1 }}>
                <i className="bi bi-buildings" style={{ marginRight: 6 }}></i>
                {t("industries_eyebrow")}
              </Typography>
              <Typography component="h2" sx={{ fontWeight: 800, letterSpacing: "-0.02em", fontSize: { xs: "1.9rem", md: "2.6rem" } }}>
                {t("industries_title")}
              </Typography>
            </Box>
            <Grid container spacing={3} sx={{ justifyContent: "center" }}>
              {INDUSTRIES.map((ind, i) => (
                <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Box sx={{
                    bgcolor: M.card, border: `1px solid ${M.border}`, borderRadius: "20px", overflow: "hidden",
                    transition: "all .2s ease", cursor: "default", height: "100%",
                    "&:hover": { borderColor: M.primary, transform: "translateY(-4px)", boxShadow: "0 24px 48px -24px rgba(37,99,235,.28)" }
                  }}>
                    {/* Photo (if present) layered over a brand-gradient fallback, so
                        the card looks good even before an image is dropped in. */}
                    <Box sx={{
                      height: 210,
                      // Admin-uploaded photo (if any) → default illustration → gradient.
                      backgroundImage: `url(${branding.industryImages?.[ind.key] || ind.img}), linear-gradient(135deg, ${M.primary} 0%, ${M.accent} 100%)`,
                      backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat",
                    }} />
                    <Box sx={{ p: 3, display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Box sx={{ color: M.primary, fontSize: "1.3rem", lineHeight: 1 }}><i className={`bi ${ind.icon}`}></i></Box>
                      <Typography sx={{ fontWeight: 700, fontSize: "1.05rem" }}>{ind.title}</Typography>
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* ── Split Layout Features ── */}
        <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.surfaceAlt, borderTop: `1px solid ${M.border}`, borderBottom: `1px solid ${M.border}` }}>
          <Container maxWidth="lg">
            <Grid container spacing={6} sx={{ alignItems: "center" }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Box sx={{ position: "relative" }}>
                  <Box sx={{ position: "absolute", top: -40, left: -40, width: 200, height: 200, background: `radial-gradient(circle, ${M.accent}40 0%, transparent 70%)`, filter: "blur(40px)" }} />
                  <Box sx={{
                    position: "relative", zIndex: 1,
                    bgcolor: M.card, borderRadius: "24px", p: 4, border: `1px solid ${M.border}`,
                    boxShadow: "0 30px 60px -30px rgba(15,23,42,.35)"
                  }}>
                    {/* On-brand POS / analytics illustration (pure SVG) */}
                    <Box component="svg" viewBox="0 0 400 300" sx={{ width: "100%", height: "auto", display: "block" }}>
                      <defs>
                        <linearGradient id="feat-bar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0" stopColor={M.primary} />
                          <stop offset="1" stopColor={M.accent} />
                        </linearGradient>
                      </defs>
                      {/* window header */}
                      <rect x="0" y="0" width="400" height="300" rx="16" fill={M.surfaceTint} />
                      <rect x="0" y="0" width="400" height="34" rx="16" fill={M.card} />
                      <rect x="0" y="18" width="400" height="16" fill={M.card} />
                      <circle cx="20" cy="17" r="4" fill="#ef4444" />
                      <circle cx="34" cy="17" r="4" fill="#f59e0b" />
                      <circle cx="48" cy="17" r="4" fill="#22c55e" />
                      {/* stat tiles */}
                      <g>
                        <rect x="16" y="48" width="115" height="52" rx="10" fill={M.primary} />
                        <rect x="28" y="60" width="55" height="7" rx="3.5" fill="rgba(255,255,255,.6)" />
                        <rect x="28" y="74" width="80" height="14" rx="4" fill="#fff" />
                        <rect x="143" y="48" width="115" height="52" rx="10" fill={M.card} stroke={M.border} />
                        <rect x="155" y="60" width="45" height="7" rx="3.5" fill={M.borderStrong} />
                        <rect x="155" y="74" width="70" height="14" rx="4" fill={M.text} opacity="0.85" />
                        <rect x="270" y="48" width="114" height="52" rx="10" fill={M.card} stroke={M.border} />
                        <rect x="282" y="60" width="45" height="7" rx="3.5" fill={M.borderStrong} />
                        <rect x="282" y="74" width="55" height="14" rx="4" fill={M.text} opacity="0.85" />
                      </g>
                      {/* chart card */}
                      <rect x="16" y="114" width="368" height="120" rx="12" fill={M.card} stroke={M.border} />
                      <rect x="30" y="128" width="90" height="9" rx="4.5" fill={M.borderStrong} />
                      {[70, 110, 55, 135, 90, 160, 120].map((h, i) => (
                        <rect key={i} x={34 + i * 50} y={214 - h * 0.55} width="30" height={h * 0.55} rx="5" fill="url(#feat-bar)" opacity={0.55 + (i % 3) * 0.15} />
                      ))}
                      {/* product rows */}
                      <g>
                        {[0, 1].map((r) => (
                          <g key={r} transform={`translate(0 ${r * 26})`}>
                            <rect x="16" y="248" width="368" height="18" rx="6" fill={M.card} stroke={M.border} />
                            <circle cx="30" cy="257" r="5" fill={M.accent} opacity="0.7" />
                            <rect x="44" y="253" width="120" height="8" rx="4" fill={M.borderStrong} />
                            <rect x="330" y="253" width="42" height="8" rx="4" fill={M.primary} opacity="0.7" />
                          </g>
                        ))}
                      </g>
                    </Box>
                  </Box>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Box sx={{ mb: 4 }}>
                  <Typography sx={{ color: M.primary, fontWeight: 800, letterSpacing: ".08em", fontSize: ".85rem", textTransform: "uppercase", mb: 1 }}>
                    <i className="bi bi-lightning-charge-fill" style={{ marginRight: 6 }}></i>
                    Powerful Features
                  </Typography>
                  <Typography component="h2" sx={{ fontWeight: 800, letterSpacing: "-0.02em", fontSize: { xs: "1.9rem", md: "2.6rem" } }}>
                    Advanced tools with incredible design
                  </Typography>
                </Box>
                <Grid container spacing={3}>
                  {FEATURES.map((f, i) => (
                    <Grid key={i} size={{ xs: 12 }}>
                      <Box sx={{ display: "flex", gap: 2 }}>
                        <Typography sx={{ color: M.primary, fontWeight: 800, fontSize: "1.2rem", opacity: 0.5 }}>0{i + 1}</Typography>
                        <Box>
                          <Typography sx={{ fontWeight: 700, fontSize: "1.1rem", mb: 0.5 }}>{f.title}</Typography>
                          <Typography sx={{ color: M.textMuted, fontSize: "0.9rem", lineHeight: 1.5 }}>{f.desc}</Typography>
                        </Box>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Grid>
            </Grid>
          </Container>
        </Box>

        {/* ── Stats band ── */}
        <Box sx={{ bgcolor: M.surfaceAlt, borderTop: `1px solid ${M.border}`, borderBottom: `1px solid ${M.border}`, py: { xs: 5, md: 7 } }}>
          <Container maxWidth="lg">
            <Grid container spacing={2}>
              {STATS.map((s) => (
                <Grid key={s.label} size={{ xs: 6, md: 3 }} sx={{ textAlign: "center" }}>
                  <Typography sx={{ fontWeight: 800, fontSize: { xs: "1.8rem", md: "2.4rem" }, color: M.primary, letterSpacing: "-0.02em" }}>{s.value}</Typography>
                  <Typography sx={{ color: M.textMuted, fontWeight: 600, fontSize: ".9rem" }}>{s.label}</Typography>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>
        {/* ── Why Choose Us ── */}
        <Box sx={{ py: { xs: 8, md: 12 } }}>
          <Container maxWidth="lg">
            <Box sx={{ textAlign: "center", mb: { xs: 5, md: 7 } }}>
              <Typography sx={{ color: M.primary, fontWeight: 800, letterSpacing: ".08em", fontSize: ".85rem", textTransform: "uppercase", mb: 1 }}>
                <i className="bi bi-shield-check" style={{ marginRight: 6 }}></i>
                {t("why_eyebrow")}
              </Typography>
              <Typography component="h2" sx={{ fontWeight: 800, letterSpacing: "-0.02em", fontSize: { xs: "1.9rem", md: "2.6rem" } }}>
                {t("why_title")}
              </Typography>
            </Box>
            <Grid container spacing={4} sx={{ justifyContent: "center" }}>
              {WHY_CHOOSE_US.map((item, i) => (
                <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
                  <Box sx={{ textAlign: "center" }}>
                    <Box sx={{ width: 50, height: 50, mx: "auto", borderRadius: "50%", bgcolor: M.surfaceAlt, border: `1px solid ${M.border}`, color: M.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", mb: 2 }}>
                      <i className="bi bi-check-lg"></i>
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontSize: "1.1rem", mb: 1 }}>{item.title}</Typography>
                    <Typography sx={{ color: M.textMuted, fontSize: "0.9rem", lineHeight: 1.5 }}>{item.text}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* ── FAQ Section ── */}
        <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.surfaceAlt, borderTop: `1px solid ${M.border}` }}>
          <Container maxWidth="md">
            <Box sx={{ textAlign: "center", mb: { xs: 5, md: 7 } }}>
              <Typography component="h2" sx={{ fontWeight: 800, letterSpacing: "-0.02em", fontSize: { xs: "1.9rem", md: "2.6rem" } }}>
                {t("faq_title")}
              </Typography>
            </Box>
            <Box>
              <Accordion sx={{ bgcolor: "transparent", borderBottom: `1px solid ${M.border}`, boxShadow: "none", "&:before": { display: "none" } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: M.primary }} />}>
                  <Typography sx={{ fontWeight: 700, fontSize: "1.05rem" }}>Do I need to download an app?</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography sx={{ color: M.textMuted }}>No, StockWhisk is 100% cloud-based. You can access it securely from any web browser on your phone, tablet, or computer.</Typography>
                </AccordionDetails>
              </Accordion>
              <Accordion sx={{ bgcolor: "transparent", borderBottom: `1px solid ${M.border}`, boxShadow: "none", "&:before": { display: "none" } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: M.primary }} />}>
                  <Typography sx={{ fontWeight: 700, fontSize: "1.05rem" }}>Is my business data secure?</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography sx={{ color: M.textMuted }}>Absolutely. We use industry-standard encryption to protect your data, and we perform automated daily backups.</Typography>
                </AccordionDetails>
              </Accordion>
              <Accordion sx={{ bgcolor: "transparent", borderBottom: `1px solid ${M.border}`, boxShadow: "none", "&:before": { display: "none" } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: M.primary }} />}>
                  <Typography sx={{ fontWeight: 700, fontSize: "1.05rem" }}>What happens after the free trial?</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography sx={{ color: M.textMuted }}>At the end of your trial, you can choose to upgrade to a paid plan. Your data is kept safe, and you can pick up exactly where you left off.</Typography>
                </AccordionDetails>
              </Accordion>
            </Box>
          </Container>
        </Box>

        {/* ── Final CTA ── */}
        <Box sx={{ py: { xs: 8, md: 12 } }}>
          <Container maxWidth="md">
            <Box sx={{
              textAlign: "center", borderRadius: "28px", px: { xs: 3, md: 8 }, py: { xs: 6, md: 8 },
              background: `linear-gradient(135deg, ${M.primaryDark}, ${M.primary})`, color: "#fff",
              boxShadow: "0 40px 80px -40px rgba(37,99,235,.7)",
            }}>
              <Typography component="h2" sx={{ fontWeight: 800, letterSpacing: "-0.02em", fontSize: { xs: "1.8rem", md: "2.6rem" }, mb: 2 }}>
                {t("cta_title")}
              </Typography>
              <Typography sx={{ opacity: 0.9, fontSize: { xs: "1rem", md: "1.15rem" }, mb: 4, maxWidth: 560, mx: "auto" }}>
                {t("cta_subtitle")}
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "center" }}>
                <Button component={Link} href="/register" sx={{ bgcolor: "#fff", color: M.primaryDark, fontWeight: 800, textTransform: "none", borderRadius: "12px", px: 4, py: 1.5, "&:hover": { bgcolor: "#eef2ff" } }}>
                  {t("hero_btn_register")}
                </Button>
                <Button component={Link} href="/contact" sx={{ color: "#fff", border: "1px solid rgba(255,255,255,.5)", fontWeight: 700, textTransform: "none", borderRadius: "12px", px: 4, py: 1.5, "&:hover": { bgcolor: "rgba(255,255,255,.12)" } }}>
                  {t("cta_btn_contact")}
                </Button>
              </Stack>
            </Box>
          </Container>
        </Box>
      </Box>

      <MarketingFooter />
    </Box>
    </PublicThemeProvider>
  );
}
