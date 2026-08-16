"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, unwrap } from "@/lib/api";
import { Box, Typography, Button, Container, Grid, useTheme, useMediaQuery } from "@mui/material";
import { motion } from "framer-motion";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";
import PublicThemeProvider from "@/components/PublicThemeProvider";
import { useLanguage } from "@/contexts/LanguageContext";
import { Hanken_Grotesk, Manrope, JetBrains_Mono } from "next/font/google";

const hanken = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "500", "700", "800"] });
const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"] });

const C = {
  primary: "#004ac6",
  primaryContainer: "#2563eb",
  onPrimaryContainer: "#eeefff",
  primaryFixedDim: "#b4c5ff",
  onPrimaryFixedVariant: "#003ea8",
  
  secondaryContainer: "#fea619",
  onSecondaryContainer: "#684000",
  secondaryFixedDim: "#ffb95f",
  
  tertiaryContainer: "#007d55",
  onTertiaryContainer: "#bdffdb",
  tertiaryFixedDim: "#4edea3",
  
  errorContainer: "#ffdad6",
  onErrorContainer: "#93000a",
  
  background: "#faf8ff",
  onBackground: "#131b2e",
  
  surface: "#faf8ff",
  surfaceContainerLowest: "#ffffff",
  surfaceContainerLow: "#f2f3ff",
  surfaceContainer: "#eaedff",
  surfaceVariant: "#dae2fd",
  onSurface: "#131b2e",
  onSurfaceVariant: "#434655",
  onPrimary: "#ffffff",
  
  outlineVariant: "#c3c6d7",
  outline: "#737686",
};

// --- ANIMATION VARIANTS ---

type PricingPlan = {
  id: number;
  name: string;
  tier: string;
  price_monthly: string;
  price_yearly: string;
  features: Record<string, any>;
  max_users: number;
  max_branches: number;
  max_products: number;
  highlights?: string[];
  show_users?: boolean;
  show_branches?: boolean;
  show_products?: boolean;
};
const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const fadeScale = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.6 } }
};

const slideInLeft = {
  hidden: { opacity: 0, x: -50 },
  show: { opacity: 1, x: 0, transition: { duration: 0.7 } }
};

const slideInRight = {
  hidden: { opacity: 0, x: 50 },
  show: { opacity: 1, x: 0, transition: { duration: 0.7 } }
};

function MaterialIcon({ icon, filled = false, sx = {} }: { icon: string, filled?: boolean, sx?: any }) {
  return (
    <Box
      component="span"
      className="material-symbols-outlined"
      sx={{
        fontVariationSettings: filled ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
        lineHeight: 1,
        ...sx
      }}
    >
      {icon}
    </Box>
  );
}

export default function Home() {
  const { lang, t } = useLanguage();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loadingPricing, setLoadingPricing] = useState(true);
  const [trialDays, setTrialDays] = useState(14);

  useEffect(() => {
    api<any>("/platform/public/pricing/")
      .then((data) => {
        setPlans((unwrap(data) as PricingPlan[]).slice(0, 3)); // show top 3 on homepage
      })
      .catch((e) => console.error("Failed to load pricing plans", e))
      .finally(() => setLoadingPricing(false));

    api<{ trial_days: number }>("/platform/public/site-config/")
      .then((d) => {
        if (d?.trial_days != null) setTrialDays(d.trial_days);
      })
      .catch(() => {});
  }, []);

  const toBnNum = (str: string | number) => str.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d as any]);

  return (
    <PublicThemeProvider>
      {/* Material symbols font */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
      `}} />
      <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", bgcolor: C.background, color: C.onBackground, fontFamily: manrope.style.fontFamily, overflowX: "hidden" }}>
        <MarketingNav />

        <Box component="main" sx={{ flexGrow: 1, pt: { xs: 8, md: 12 }, pb: { xs: 10, md: 16 } }}>
          
          {/* --- HERO SECTION --- */}
          <Box sx={{ position: "relative", overflow: "visible", pt: { xs: 4, md: 8 }, pb: { xs: 8, md: 12 } }}>
            {/* Animated Background Blobs */}
            <Box
              component={motion.div}
              animate={{ 
                scale: [1, 1.1, 1],
                opacity: [0.5, 0.8, 0.5],
                x: ["-50%", "-48%", "-50%"],
                y: [0, -20, 0]
              }}
              transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
              sx={{ position: "absolute", top: -100, left: "50%", transform: "translateX(-50%)", width: 800, height: 800, bgcolor: `${C.primary}1A`, borderRadius: "50%", filter: "blur(100px)", zIndex: 0, pointerEvents: "none" }} 
            />
            <Box
              component={motion.div}
              animate={{ 
                scale: [1, 1.3, 1], rotate: [0, 90, 0],
                opacity: [0.3, 0.6, 0.3],
                x: [0, -30, 0],
                y: [0, 30, 0]
              }}
              transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
              sx={{ position: "absolute", top: 160, right: -100, width: 500, height: 500, bgcolor: `${C.secondaryContainer}26`, borderRadius: "50%", filter: "blur(90px)", zIndex: 0, pointerEvents: "none" }} 
            />
            
            <Container maxWidth="xl" sx={{ position: "relative", zIndex: 1 }}>
              <Grid container spacing={{ xs: 6, md: 4 }} sx={{ alignItems: "center" }}>
                
                {/* Left Side: Text Content */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <motion.div variants={staggerContainer} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'center' : 'flex-start', textAlign: isMobile ? 'center' : 'left', width: '100%' }}>
                    
                    <motion.div variants={fadeUp}>
                      <Typography component="h1" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 800, fontSize: { xs: "2.5rem", md: "4rem", lg: "4.5rem" }, lineHeight: 1.1, letterSpacing: "-0.02em", color: C.onBackground, mb: 3, maxWidth: 900 }}>
                        {isMobile ? (
                          <>
                            {t('hero_title_mobile')} <br />
                            <Box component="span" sx={{ color: C.primary, position: "relative", display: "inline-block" }}>
                              {t('hero_title_mobile_highlight')}
                              <Box component="svg" viewBox="0 0 100 10" preserveAspectRatio="none" sx={{ position: "absolute", width: "100%", height: 12, bottom: -4, left: 0, color: C.primaryFixedDim }}>
                                <path d="M0 5 Q 50 10 100 5" fill="transparent" stroke="currentColor" strokeWidth="3" />
                              </Box>
                            </Box>{" "}
                            {t('hero_title_mobile_suffix')}
                          </>
                        ) : (
                          <>
                            {t('hero_title_desktop')} <br />
                            <Box component="span" sx={{ background: `linear-gradient(135deg, ${C.primary}, #0053db)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{t('hero_title_desktop_highlight')}</Box>
                          </>
                        )}
                      </Typography>
                    </motion.div>

                    <motion.div variants={fadeUp}>
                      <Typography sx={{ fontSize: { xs: "1rem", md: "1.125rem" }, color: C.onSurfaceVariant, maxWidth: 680, mb: 5, lineHeight: 1.6 }}>
                        {t('hero_subtitle')}
                      </Typography>
                    </motion.div>

                    <motion.div variants={fadeUp}>
                      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 2, width: { xs: "100%", sm: "auto" } }}>
                        <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }} transition={{ type: "spring", stiffness: 400, damping: 17 }}>
                          <Button component={Link} href="/register" sx={{ bgcolor: C.primary, color: C.onPrimary, fontWeight: 700, borderRadius: 999, px: 4, py: 2, fontSize: "1rem", textTransform: "none", boxShadow: `0 8px 24px ${C.primary}66`, transition: 'all 0.3s ease', "&:hover": { bgcolor: C.onPrimaryFixedVariant, boxShadow: `0 12px 32px ${C.primary}80`, transform: 'translateY(-2px)' } }}>
                            {lang === 'bn' ? `${toBnNum(trialDays)}-দিনের ফ্রি ট্রায়াল শুরু করুন` : `Start ${trialDays}-Day Free Trial`}
                          </Button>
                        </motion.div>
                        <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }} transition={{ type: "spring", stiffness: 400, damping: 17 }}>
                          <Button component={Link} href="/demo" sx={{ bgcolor: `${C.surface}E6`, backdropFilter: "blur(12px)", color: C.primary, border: `1px solid ${C.primary}33`, fontWeight: 700, borderRadius: 999, px: 4, py: 2, fontSize: "1rem", textTransform: "none", "&:hover": { bgcolor: C.surfaceContainerLow } }}>
                            <MaterialIcon icon="play_arrow" filled sx={{ mr: 1 }} />
                            {t('hero_btn_demo')}
                          </Button>
                        </motion.div>
                      </Box>
                    </motion.div>
                  </motion.div>
                </Grid>

                {/* Right Side: Image Mockup */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <motion.div initial="hidden" animate="show" variants={fadeScale} style={{ width: '100%' }}>
                    {isMobile ? (
                      <Box sx={{ width: "100%", position: "relative" }}>
                        <Box sx={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, ${C.primaryFixedDim}33, transparent)`, borderRadius: "32px 32px 0 0", filter: "blur(20px)", zIndex: 0 }} />
                        <Box sx={{ position: "relative", zIndex: 1, bgcolor: "#fff", borderRadius: "24px 24px 0 0", boxShadow: "0 -10px 40px rgba(15,23,42,0.08)", borderTop: `1px solid ${C.surfaceVariant}`, borderLeft: `1px solid ${C.surfaceVariant}`, borderRight: `1px solid ${C.surfaceVariant}`, overflow: "hidden", pt: 2, px: 2, height: 260, textAlign: "left" }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                            <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: C.errorContainer, border: `1px solid ${C.onErrorContainer}` }} />
                            <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: C.secondaryContainer }} />
                            <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: C.tertiaryContainer }} />
                            <Box sx={{ height: 16, width: "33%", bgcolor: C.surfaceContainer, borderRadius: 1, ml: 1 }} />
                          </Box>
                          <Grid container spacing={1.5}>
                            <Grid size={{ xs: 6 }}>
                              <Box sx={{ bgcolor: C.primary, color: C.onPrimary, p: 2, borderRadius: "12px" }}>
                                <Typography sx={{ fontSize: "0.75rem", opacity: 0.8, mb: 0.5 }}>{t('hero_sales_today')}</Typography>
                                <Typography sx={{ fontWeight: 700, fontSize: "1.125rem" }}>৳ 48,250</Typography>
                              </Box>
                            </Grid>
                            <Grid size={{ xs: 6 }}>
                              <Box sx={{ bgcolor: C.surfaceContainerLow, border: `1px solid ${C.surfaceVariant}`, p: 2, borderRadius: "12px" }}>
                                <Typography sx={{ fontSize: "0.75rem", color: C.onSurfaceVariant, mb: 0.5 }}>{t('hero_orders')}</Typography>
                                <Typography sx={{ fontWeight: 700, fontSize: "1.125rem", color: C.onSurface }}>126</Typography>
                              </Box>
                            </Grid>
                          </Grid>
                          <Box sx={{ bgcolor: C.surfaceContainerLow, border: `1px solid ${C.surfaceVariant}`, borderRadius: "12px", mt: 1.5, p: 2, height: 130, position: "relative", overflow: "hidden" }}>
                            <Typography sx={{ fontSize: "0.75rem", color: C.onSurfaceVariant, mb: 1 }}>{t('hero_sales_trend')}</Typography>
                            <Box sx={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 64, display: "flex", alignItems: "flex-end", justifyContent: "space-between", px: 2, pb: 1, opacity: 0.3 }}>
                              <Box sx={{ width: 16, bgcolor: C.primary, borderRadius: "2px 2px 0 0", height: 16 }} />
                              <Box sx={{ width: 16, bgcolor: C.primary, borderRadius: "2px 2px 0 0", height: 32 }} />
                              <Box sx={{ width: 16, bgcolor: C.primary, borderRadius: "2px 2px 0 0", height: 24 }} />
                              <Box sx={{ width: 16, bgcolor: C.primary, borderRadius: "2px 2px 0 0", height: 48 }} />
                              <Box sx={{ width: 16, bgcolor: C.primary, borderRadius: "2px 2px 0 0", height: 40 }} />
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    ) : (
                      <Box component={motion.div} whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 150, damping: 20 }} sx={{ width: "100%", position: "relative" }}>
                        <Box sx={{ position: "absolute", inset: 0, background: `linear-gradient(to top, ${C.background} 5%, transparent 30%, transparent)`, zIndex: 10, pointerEvents: "none" }} />
                        <Box sx={{ position: "relative", borderRadius: "24px", border: `1px solid ${C.outlineVariant}4D`, boxShadow: `0 30px 80px ${C.primary}33`, overflow: "hidden", bgcolor: C.surface, transform: "perspective(1000px) rotateY(-5deg) rotateX(2deg)", transformOrigin: "right center" }}>
                          <Box sx={{ height: 40, bgcolor: C.surfaceContainerLowest, borderBottom: `1px solid ${C.outlineVariant}4D`, display: "flex", alignItems: "center", px: 2, gap: 1 }}>
                            <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "#ef4444" }} />
                            <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: C.secondaryFixedDim }} />
                            <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: C.tertiaryFixedDim }} />
                            <Typography sx={{ flex: 1, textAlign: "center", fontFamily: jetbrains.style.fontFamily, fontSize: "0.75rem", color: `${C.onSurfaceVariant}80` }}>stockwhisk.com/app</Typography>
                          </Box>
                          <Box component="img" src="/images/dashboard_mockup.jpg" alt="StockWhisk Dashboard Mockup" sx={{ width: "100%", display: "block" }} />
                        </Box>
                      </Box>
                    )}
                  </motion.div>
                </Grid>
              </Grid>
            </Container>
          </Box>

          {/* --- BENTO GRID / FEATURES --- */}
          <Box id="features" sx={{ py: { xs: 8, md: 12 }, bgcolor: `${C.surfaceContainerLow}80`, position: "relative", overflow: "hidden" }}>
            <Box sx={{ position: "absolute", top: -100, right: -100, width: 300, height: 300, bgcolor: `${C.tertiaryContainer}1A`, borderRadius: "50%", filter: "blur(80px)", zIndex: 0 }} />
            
            <Container maxWidth="xl" sx={{ position: "relative", zIndex: 1 }}>
              <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer}>
                <Box sx={{ textAlign: "center", mb: 8 }}>
                  <motion.div variants={fadeUp}>
                    <Typography component="h2" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 700, fontSize: { xs: "1.75rem", md: "2.5rem" }, color: C.onBackground, mb: 2 }}>
                      {t('bento_title')}
                    </Typography>
                  </motion.div>
                  <motion.div variants={fadeUp}>
                    <Typography sx={{ fontSize: "1rem", color: C.onSurfaceVariant, maxWidth: 680, mx: "auto" }}>
                      {t('bento_subtitle')}
                    </Typography>
                  </motion.div>
                </Box>

                <Grid container spacing={3}>
                  {/* Inventory (Large) */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <motion.div variants={fadeUp} style={{ height: '100%' }}>
                      <Box component={motion.div} whileHover={{ y: -12, scale: 1.01, boxShadow: `0 24px 48px ${C.primary}33` }} transition={{ type: "spring", stiffness: 300, damping: 20 }} sx={{ bgcolor: `${C.surface}CC`, backdropFilter: "blur(12px)", borderRadius: "32px", p: { xs: 4, md: 5 }, border: `1px solid ${C.outlineVariant}66`, boxShadow: "0 4px 6px rgba(0,0,0,0.02)", height: "100%", display: "flex", flexDirection: "column", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)" }}>
                        <Box sx={{ width: 56, height: 56, borderRadius: "16px", bgcolor: C.primaryContainer, color: C.onPrimaryContainer, display: "flex", alignItems: "center", justifyContent: "center", mb: 3 }}>
                          <MaterialIcon icon="inventory_2" sx={{ fontSize: "2rem" }} />
                        </Box>
                        <Typography component="h3" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 700, fontSize: "1.5rem", color: C.onBackground, mb: 1.5 }}>
                          {t('bento_inv_title')}
                        </Typography>
                        <Typography sx={{ color: C.onSurfaceVariant, mb: 4, flexGrow: 1, fontSize: "1.0625rem" }}>
                          {t('bento_inv_desc')}
                        </Typography>
                        <Box sx={{ minHeight: 280, flexGrow: 1, borderRadius: "16px", bgcolor: C.surfaceContainerLowest, border: `1px solid ${C.outlineVariant}33`, overflow: "hidden", position: "relative" }}>
                          <Box component="img" src="/images/inventory_illustration.jpg" alt="Inventory illustration" sx={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
                        </Box>
                      </Box>
                    </motion.div>
                  </Grid>

                  {/* POS & Reports (Medium stack) */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Grid container spacing={3} sx={{ height: "100%" }}>
                      <Grid size={{ xs: 12 }}>
                        <motion.div variants={fadeUp} style={{ height: '100%' }}>
                          <Box component={motion.div} whileHover={{ y: -12, scale: 1.02, boxShadow: `0 24px 48px ${C.secondaryContainer}33` }} transition={{ type: "spring", stiffness: 300, damping: 20 }} sx={{ bgcolor: `${C.surface}CC`, backdropFilter: "blur(12px)", borderRadius: "32px", p: { xs: 4, md: 5 }, border: `1px solid ${C.outlineVariant}66`, boxShadow: "0 4px 6px rgba(0,0,0,0.02)", height: "100%", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", display: "flex", flexDirection: "column" }}>
                            <Box sx={{ width: 48, height: 48, borderRadius: "16px", bgcolor: `${C.secondaryContainer}33`, color: C.onSecondaryContainer, display: "flex", alignItems: "center", justifyContent: "center", mb: 2.5 }}>
                              <MaterialIcon icon="point_of_sale" sx={{ fontSize: "1.5rem" }} />
                            </Box>
                            <Typography component="h3" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 700, fontSize: "1.25rem", color: C.onBackground, mb: 1 }}>
                              {t('bento_pos_title')}
                            </Typography>
                            <Typography sx={{ color: C.onSurfaceVariant, flexGrow: 1, mb: 3, fontSize: "1.0625rem" }}>
                              {t('bento_pos_desc')}
                            </Typography>
                            <Box sx={{ height: 200, borderRadius: "16px", bgcolor: "#fff", border: `1px solid ${C.outlineVariant}33`, overflow: "hidden", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Box component="img" src="/images/pos_illustration.jpg" alt="POS illustration" sx={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
                            </Box>
                          </Box>
                        </motion.div>
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <motion.div variants={fadeUp} style={{ height: '100%' }}>
                          <Box component={motion.div} whileHover={{ y: -12, scale: 1.02, boxShadow: `0 24px 48px ${C.tertiaryContainer}33` }} transition={{ type: "spring", stiffness: 300, damping: 20 }} sx={{ bgcolor: `${C.surface}CC`, backdropFilter: "blur(12px)", borderRadius: "32px", p: { xs: 4, md: 5 }, border: `1px solid ${C.outlineVariant}66`, boxShadow: "0 4px 6px rgba(0,0,0,0.02)", height: "100%", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", display: "flex", flexDirection: "column" }}>
                            <Box sx={{ width: 48, height: 48, borderRadius: "16px", bgcolor: `${C.tertiaryContainer}33`, color: C.onTertiaryContainer, display: "flex", alignItems: "center", justifyContent: "center", mb: 2.5 }}>
                              <MaterialIcon icon="bar_chart" sx={{ fontSize: "1.5rem" }} />
                            </Box>
                            <Typography component="h3" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 700, fontSize: "1.25rem", color: C.onBackground, mb: 1 }}>
                              {t('bento_rep_title')}
                            </Typography>
                            <Typography sx={{ color: C.onSurfaceVariant, flexGrow: 1, mb: 3, fontSize: "1.0625rem" }}>
                              {t('bento_rep_desc')}
                            </Typography>
                            <Box sx={{ height: 200, borderRadius: "16px", bgcolor: "#fff", border: `1px solid ${C.outlineVariant}33`, overflow: "hidden", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Box component="img" src="/images/reports_illustration.jpg" alt="Reports illustration" sx={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
                            </Box>
                          </Box>
                        </motion.div>
                      </Grid>
                    </Grid>
                  </Grid>

                  {/* Small Cards */}
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <motion.div variants={fadeUp} style={{ height: '100%' }}>
                      <Box component={motion.div} whileHover={{ y: -8, scale: 1.03 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} sx={{ bgcolor: C.surface, borderRadius: "24px", p: 3.5, border: `1px solid ${C.outlineVariant}4D`, boxShadow: "0 2px 4px rgba(0,0,0,0.02)", height: "100%", transition: "box-shadow 0.3s ease", "&:hover": { boxShadow: "0 16px 32px rgba(0,0,0,0.08)" } }}>
                        <Box sx={{ width: 40, height: 40, borderRadius: "10px", bgcolor: C.surfaceVariant, color: C.primary, display: "flex", alignItems: "center", justifyContent: "center", mb: 2 }}>
                          <MaterialIcon icon="shopping_cart" />
                        </Box>
                        <Typography component="h3" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 600, fontSize: "1.125rem", color: C.onBackground, mb: 1 }}>{t('bento_small_1_title')}</Typography>
                        <Typography sx={{ fontSize: "0.875rem", color: C.onSurfaceVariant }}>{t('bento_small_1_desc')}</Typography>
                      </Box>
                    </motion.div>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <motion.div variants={fadeUp} style={{ height: '100%' }}>
                      <Box component={motion.div} whileHover={{ y: -8, scale: 1.03 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} sx={{ bgcolor: C.surface, borderRadius: "24px", p: 3.5, border: `1px solid ${C.outlineVariant}4D`, boxShadow: "0 2px 4px rgba(0,0,0,0.02)", height: "100%", transition: "box-shadow 0.3s ease", "&:hover": { boxShadow: "0 16px 32px rgba(0,0,0,0.08)" } }}>
                        <Box sx={{ width: 40, height: 40, borderRadius: "10px", bgcolor: C.surfaceVariant, color: C.primary, display: "flex", alignItems: "center", justifyContent: "center", mb: 2 }}>
                          <MaterialIcon icon="group" />
                        </Box>
                        <Typography component="h3" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 600, fontSize: "1.125rem", color: C.onBackground, mb: 1 }}>{t('bento_small_2_title')}</Typography>
                        <Typography sx={{ fontSize: "0.875rem", color: C.onSurfaceVariant }}>{t('bento_small_2_desc')}</Typography>
                      </Box>
                    </motion.div>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <motion.div variants={fadeUp} style={{ height: '100%' }}>
                      <Box component={motion.div} whileHover={{ y: -8, scale: 1.03 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} sx={{ bgcolor: C.surface, borderRadius: "24px", p: 3.5, border: `1px solid ${C.outlineVariant}4D`, boxShadow: "0 2px 4px rgba(0,0,0,0.02)", height: "100%", transition: "box-shadow 0.3s ease", "&:hover": { boxShadow: "0 16px 32px rgba(0,0,0,0.08)" } }}>
                        <Box sx={{ width: 40, height: 40, borderRadius: "10px", bgcolor: C.surfaceVariant, color: C.primary, display: "flex", alignItems: "center", justifyContent: "center", mb: 2 }}>
                          <MaterialIcon icon="local_shipping" />
                        </Box>
                        <Typography component="h3" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 600, fontSize: "1.125rem", color: C.onBackground, mb: 1 }}>{t('bento_small_3_title')}</Typography>
                        <Typography sx={{ fontSize: "0.875rem", color: C.onSurfaceVariant }}>{t('bento_small_3_desc')}</Typography>
                      </Box>
                    </motion.div>
                  </Grid>
                </Grid>
              </motion.div>
            </Container>
          </Box>

          {/* --- RETAIL PROBLEMS & SOLUTION --- */}
          <Box sx={{ py: { xs: 12, md: 16 } }}>
            <Container maxWidth="xl">
              <Grid container spacing={8} sx={{ alignItems: "center" }}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-100px" }} variants={slideInLeft}>
                    <Typography component="h2" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 700, fontSize: { xs: "2rem", md: "2.75rem" }, color: C.onBackground, mb: 4, lineHeight: 1.1 }}>
                      {t('prob_title')}
                    </Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, mt: 5 }}>
                      {[
                        { title: t('prob_1_title'), text: t('prob_1_text') },
                        { title: t('prob_2_title'), text: t('prob_2_text') },
                        { title: t('prob_3_title'), text: t('prob_3_text') }
                      ].map((item, i) => (
                        <Box component={motion.div} whileHover={{ x: 12, scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }} key={i} sx={{ display: "flex", alignItems: "flex-start", gap: 2, p: 2, borderRadius: "16px", "&:hover": { bgcolor: `${C.errorContainer}33` } }}>
                          <Box sx={{ width: 36, height: 36, borderRadius: "50%", bgcolor: C.errorContainer, color: C.onErrorContainer, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, mt: 0.5 }}>
                            <MaterialIcon icon="close" sx={{ fontSize: "1.25rem" }} />
                          </Box>
                          <Box>
                            <Typography sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 700, fontSize: "1.25rem", color: C.onBackground, mb: 0.5 }}>{item.title}</Typography>
                            <Typography sx={{ fontSize: "1rem", color: C.onSurfaceVariant }}>{item.text}</Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </motion.div>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-100px" }} variants={slideInRight}>
                    <Box component={motion.div} whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }} sx={{ bgcolor: C.surfaceContainer, p: { xs: 4, md: 6 }, borderRadius: "32px", position: "relative", overflow: "hidden", border: `1px solid ${C.primary}1A`, boxShadow: `0 24px 60px ${C.primary}1A` }}>
                      <Box sx={{ position: "absolute", top: -80, right: -80, width: 300, height: 300, bgcolor: `${C.primary}33`, borderRadius: "50%", filter: "blur(60px)" }} />
                      <Box sx={{ position: "absolute", bottom: -50, left: -50, width: 200, height: 200, bgcolor: `${C.tertiaryContainer}26`, borderRadius: "50%", filter: "blur(50px)" }} />
                      
                      <Box sx={{ position: "relative", zIndex: 1 }}>
                        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, bgcolor: C.primaryContainer, color: C.onPrimaryContainer, px: 2, py: 0.75, borderRadius: 999, mb: 3 }}>
                          <MaterialIcon icon="verified" sx={{ fontSize: "1rem" }} />
                          <Typography sx={{ fontFamily: jetbrains.style.fontFamily, fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t('prob_sol_badge')}</Typography>
                        </Box>
                        <Typography component="h3" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 800, fontSize: "2.25rem", color: C.onBackground, mb: 2, lineHeight: 1.2 }}>
                          {t('prob_sol_title')}
                        </Typography>
                        <Typography sx={{ color: C.onSurfaceVariant, mb: 4, fontSize: "1.125rem" }}>
                          {t('prob_sol_text')}
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 2, bgcolor: `${C.surface}CC`, backdropFilter: "blur(8px)", p: 2.5, borderRadius: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", border: `1px solid ${C.outlineVariant}4D` }}>
                          <Box sx={{ width: 56, height: 56, borderRadius: "16px", bgcolor: `${C.tertiaryContainer}33`, display: "flex", alignItems: "center", justifyContent: "center", color: C.tertiaryContainer }}>
                            <MaterialIcon icon="trending_up" sx={{ fontSize: "2rem" }} />
                          </Box>
                          <Box>
                            <Typography sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 800, fontSize: "1.25rem", color: C.onBackground }}>{t('prob_sol_stat_title')}</Typography>
                            <Typography sx={{ fontSize: "0.875rem", color: C.onSurfaceVariant }}>{t('prob_sol_stat_text')}</Typography>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </motion.div>
                </Grid>
              </Grid>
            </Container>
          </Box>

          {/* --- FLOW DIAGRAM --- */}
          <Box id="how-it-works" sx={{ py: { xs: 12, md: 16 }, bgcolor: C.surfaceContainerLowest, borderTop: `1px solid ${C.outlineVariant}33`, borderBottom: `1px solid ${C.outlineVariant}33` }}>
            <Container maxWidth="xl" sx={{ textAlign: "center" }}>
              <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-100px" }} variants={fadeUp}>
                <Typography component="h2" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 800, fontSize: { xs: "2rem", md: "2.75rem" }, color: C.onBackground, mb: 10 }}>
                  {t('flow_title')}
                </Typography>
                
                {!isMobile && (
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 900, mx: "auto", mb: 10, position: "relative" }}>
                    <Box sx={{ position: "absolute", top: "50%", left: 0, width: "100%", height: "4px", background: `linear-gradient(90deg, ${C.outlineVariant}33, ${C.primary}66, ${C.outlineVariant}33)`, zIndex: 0, transform: "translateY(-50%)", borderRadius: 999 }} />
                    {[
                      { icon: "category", label: t('flow_step_1') },
                      { icon: "shopping_cart", label: t('flow_step_2') },
                      { icon: "inventory_2", label: t('flow_step_3'), primary: true },
                      { icon: "point_of_sale", label: t('flow_step_4') },
                      { icon: "bar_chart", label: t('flow_step_5') }
                    ].map((item, i) => (
                      <motion.div key={i} whileHover={{ y: -5, scale: 1.05 }} style={{ zIndex: 1 }}>
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, bgcolor: C.surfaceContainerLowest, p: 1.5, borderRadius: "24px" }}>
                          {item.primary ? (
                            <Box sx={{ width: 72, height: 72, borderRadius: "50%", bgcolor: C.primary, border: `6px solid ${C.primaryContainer}4D`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 8px 16px ${C.primary}4D`, transform: "scale(1.15)" }}>
                              <MaterialIcon icon={item.icon} sx={{ color: C.onPrimary, fontSize: "2rem" }} />
                            </Box>
                          ) : (
                            <Box sx={{ width: 64, height: 64, borderRadius: "50%", bgcolor: C.surfaceContainer, border: `2px solid ${C.outlineVariant}80`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                              <MaterialIcon icon={item.icon} sx={{ color: C.primary, fontSize: "1.75rem" }} />
                            </Box>
                          )}
                          <Typography sx={{ fontFamily: jetbrains.style.fontFamily, fontWeight: 800, fontSize: "0.875rem", color: item.primary ? C.primary : C.onSurface }}>{item.label}</Typography>
                        </Box>
                      </motion.div>
                    ))}
                  </Box>
                )}

                <motion.div whileHover={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 300 }}>
                  <Box sx={{ borderRadius: "32px", border: `1px solid ${C.outlineVariant}4D`, boxShadow: `0 24px 80px ${C.primary}1A`, overflow: "hidden", bgcolor: C.surface, maxWidth: 1200, mx: "auto" }}>
                    <Box component="img" src="/images/full_dashboard.jpg" alt="Full Dashboard" sx={{ width: "100%", display: "block" }} />
                  </Box>
                </motion.div>
              </motion.div>
            </Container>
          </Box>

          {/* --- FEATURE DETAILS (Alternating) --- */}
          <Box sx={{ py: { xs: 12, md: 16 } }}>
            <Container maxWidth="xl">
              
              {/* Inventory Feature */}
              <Grid container spacing={8} sx={{ alignItems: "center", mb: { xs: 12, md: 20 } }}>
                <Grid size={{ xs: 12, md: 6 }} sx={{ order: { xs: 2, md: 1 } }}>
                  <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-100px" }} variants={slideInLeft}>
                    <Box sx={{ borderRadius: "32px", overflow: "hidden", boxShadow: `0 24px 60px ${C.primary}1A`, border: `1px solid ${C.outlineVariant}33`, bgcolor: C.surface }}>
                      <Box component="img" src="/images/inventory_ui.jpg" alt="Inventory UI" sx={{ width: "100%", display: "block", transition: "transform 0.5s", "&:hover": { transform: "scale(1.03)" } }} />
                    </Box>
                  </motion.div>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }} sx={{ order: { xs: 1, md: 2 } }}>
                  <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-100px" }} variants={slideInRight}>
                    <Box sx={{ width: 56, height: 56, bgcolor: C.primaryContainer, borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", color: C.onPrimaryContainer, mb: 4, boxShadow: `0 8px 16px ${C.primary}33` }}>
                      <MaterialIcon icon="inventory_2" sx={{ fontSize: "1.75rem" }} />
                    </Box>
                    <Typography component="h2" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 800, fontSize: { xs: "2rem", md: "2.75rem" }, color: C.onBackground, mb: 2, lineHeight: 1.1 }}>
                      {t('feat_1_title')}
                    </Typography>
                    <Typography sx={{ color: C.onSurfaceVariant, fontSize: "1.125rem", mb: 4 }}>
                      {t('feat_1_desc')}
                    </Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mb: 5 }}>
                      {[
                        t('feat_1_bullet_1'),
                        t('feat_1_bullet_2'),
                        t('feat_1_bullet_3')
                      ].map((t, i) => (
                        <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                          <Box sx={{ width: 24, height: 24, borderRadius: "50%", bgcolor: `${C.primary}26`, color: C.primary, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <MaterialIcon icon="check" sx={{ fontSize: "1rem" }} />
                          </Box>
                          <Typography sx={{ color: C.onSurface, fontWeight: 500 }}>{t}</Typography>
                        </Box>
                      ))}
                    </Box>
                    <motion.div whileHover={{ x: 5 }} style={{ display: 'inline-block' }}>
                      <Link href="/register" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: C.primary, fontWeight: 800, textDecoration: "none", fontSize: "1.125rem" }}>
                        {t('feat_1_link')} <MaterialIcon icon="arrow_forward" />
                      </Link>
                    </motion.div>
                  </motion.div>
                </Grid>
              </Grid>

              {/* POS Feature */}
              <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-100px" }} variants={fadeUp}>
                <Box sx={{ bgcolor: `${C.surfaceContainerLow}CC`, backdropFilter: "blur(12px)", borderRadius: "40px", p: { xs: 4, md: 8 }, border: `1px solid ${C.outlineVariant}4D`, position: "relative", overflow: "hidden" }}>
                  <Box sx={{ position: "absolute", bottom: -100, left: -100, width: 300, height: 300, bgcolor: `${C.secondaryContainer}1A`, borderRadius: "50%", filter: "blur(80px)" }} />
                  
                  <Grid container spacing={8} sx={{ alignItems: "center", position: "relative", zIndex: 1 }}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Box sx={{ width: 56, height: 56, bgcolor: `${C.secondaryContainer}4D`, borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", color: C.onSecondaryContainer, mb: 4 }}>
                        <MaterialIcon icon="point_of_sale" sx={{ fontSize: "1.75rem" }} />
                      </Box>
                      <Typography component="h2" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 800, fontSize: { xs: "2rem", md: "2.75rem" }, color: C.onBackground, mb: 2, lineHeight: 1.1 }}>
                        {t('feat_2_title')}
                      </Typography>
                      <Typography sx={{ color: C.onSurfaceVariant, fontSize: "1.125rem", mb: 4 }}>
                        {t('feat_2_desc')}
                      </Typography>
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                        {[
                          t('feat_2_bullet_1'),
                          t('feat_2_bullet_2'),
                          t('feat_2_bullet_3')
                        ].map((t, i) => (
                          <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                            <Box sx={{ width: 24, height: 24, borderRadius: "50%", bgcolor: `${C.secondaryContainer}4D`, color: C.onSecondaryContainer, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <MaterialIcon icon="check" sx={{ fontSize: "1rem" }} />
                            </Box>
                            <Typography sx={{ color: C.onSurface, fontWeight: 500 }}>{t}</Typography>
                          </Box>
                        ))}
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <motion.div whileHover={{ scale: 1.03 }} transition={{ type: "spring", stiffness: 300 }}>
                        <Box sx={{ borderRadius: "32px", overflow: "hidden", boxShadow: `0 24px 60px ${C.secondaryContainer}33`, border: `1px solid ${C.outlineVariant}33`, bgcolor: C.surface }}>
                          <Box component="img" src="/images/pos_ui.jpg" alt="POS UI" sx={{ width: "100%", display: "block" }} />
                        </Box>
                      </motion.div>
                    </Grid>
                  </Grid>
                </Box>
              </motion.div>

            </Container>
          </Box>

          {/* --- PRICING TEASER --- */}
          <Box id="pricing" sx={{ py: { xs: 12, md: 16 }, position: "relative" }}>
            <Container maxWidth="xl">
              <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer}>
                
                <Box sx={{ textAlign: "center", mb: 10 }}>
                  <motion.div variants={fadeUp}>
                    <Typography component="h2" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 800, fontSize: { xs: "2rem", md: "2.75rem" }, color: C.onBackground, mb: 2 }}>
                      {t('price_teaser_title')}
                    </Typography>
                  </motion.div>
                  <motion.div variants={fadeUp}>
                    <Typography sx={{ fontSize: "1.125rem", color: C.onSurfaceVariant, maxWidth: 680, mx: "auto" }}>
                      {t('price_teaser_subtitle')}
                    </Typography>
                  </motion.div>
                </Box>

                <Grid container spacing={4} sx={{ maxWidth: 1200, mx: "auto", alignItems: "center", justifyContent: "center" }}>
                  
                  {loadingPricing ? (
                    <Box sx={{ py: 10, textAlign: 'center', width: '100%' }}>
                      <Typography>{t('pricing_loading') || 'Loading pricing...'}</Typography>
                    </Box>
                  ) : plans.length === 0 ? (
                    <Box sx={{ py: 10, textAlign: 'center', width: '100%' }}>
                      <Typography>No plans found.</Typography>
                    </Box>
                  ) : (
                    plans.map((plan) => {
                      const isPopular = plan.tier === 'professional';
                      const monthly = parseFloat(plan.price_monthly) || 0;
                      
                      let priceStr = monthly > 0 ? `$${monthly}` : t('price_card_1_price');
                      if (lang === 'bn' && monthly > 0) priceStr = `$${toBnNum(monthly)}`;
                      const periodStr = monthly > 0 ? t('price_card_2_period') : t('price_card_1_period');
                      
                      const features = plan.highlights && plan.highlights.length > 0
                        ? plan.highlights
                        : [
                            ...(plan.show_users !== false ? [t("pricing_users", { max_users: plan.max_users })] : []),
                            ...(plan.show_branches !== false ? [t("pricing_branches", { max_branches: plan.max_branches })] : []),
                            ...(plan.show_products !== false ? [t("pricing_products", { max_products: plan.max_products })] : []),
                            ...Object.entries(plan.features || {}).filter(([, v]) => v).map(([k]) => t(`feat_${k}`)),
                          ];

                      return (
                        <Grid size={{ xs: 12, md: 4 }} key={plan.id}>
                          <motion.div variants={isPopular ? fadeScale : fadeUp} style={{ height: '100%' }}>
                            <Box component={motion.div} whileHover={{ y: -8 }} 
                              sx={isPopular 
                                ? { bgcolor: C.primary, color: C.onPrimary, borderRadius: "32px", p: 4, boxShadow: `0 24px 60px ${C.primary}4D`, display: "flex", flexDirection: "column", height: "100%", position: "relative", transform: { md: "translateY(-16px)" } }
                                : { bgcolor: C.surface, borderRadius: "32px", p: 4, border: `1px solid ${C.outlineVariant}4D`, boxShadow: "0 4px 6px rgba(0,0,0,0.02)", display: "flex", flexDirection: "column", height: "100%" }
                              }>
                              
                              {isPopular && (
                                <Box sx={{ position: "absolute", top: 0, right: 0, bgcolor: C.secondaryContainer, color: C.onSecondaryContainer, fontSize: "0.75rem", fontWeight: 800, px: 2, py: 0.75, borderBottomLeftRadius: "16px", borderTopRightRadius: "32px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                  {t('price_card_2_badge')}
                                </Box>
                              )}
                              
                              <Typography component="h3" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 700, fontSize: "1.5rem", color: isPopular ? C.onPrimary : C.onBackground, mb: 1 }}>
                                {plan.name}
                              </Typography>
                              
                              <Typography sx={{ fontSize: "1rem", color: isPopular ? C.primaryFixedDim : C.onSurfaceVariant, mb: 3 }}>
                                {plan.tier === 'starter' ? t('price_card_1_desc') : plan.tier === 'enterprise' ? t('price_card_3_desc') : t('price_card_2_desc')}
                              </Typography>
                              
                              <Box sx={{ mb: 4 }}>
                                <Typography component="span" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 800, fontSize: "2.5rem", color: isPopular ? C.onPrimary : C.onBackground }}>{priceStr}</Typography>
                                <Typography component="span" sx={{ fontSize: "1rem", color: isPopular ? C.primaryFixedDim : C.onSurfaceVariant, ml: 1 }}>{periodStr}</Typography>
                              </Box>
                              
                              <Box sx={{ display: "flex", flexDirection: "column", gap: 2, flexGrow: 1, mb: 4 }}>
                                {features.slice(0, 4).map((text, i) => (
                                  <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                                    <MaterialIcon icon="check" sx={{ color: isPopular ? C.tertiaryFixedDim : C.primary, fontSize: "1.25rem" }} />
                                    <Typography sx={{ fontSize: "0.9375rem", color: isPopular ? C.onPrimary : C.onSurface }}>{text}</Typography>
                                  </Box>
                                ))}
                              </Box>
                              
                              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                <Button component={Link} href="/register" sx={isPopular 
                                  ? { width: "100%", py: 1.5, borderRadius: 999, bgcolor: C.surface, color: C.primary, fontWeight: 800, textTransform: "none", fontSize: "1.05rem", boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)", transition: "all 0.3s ease", "&:hover": { bgcolor: C.surfaceContainerLow, transform: "translateY(-2px)", boxShadow: "0 12px 32px rgba(0, 0, 0, 0.2)" } }
                                  : { width: "100%", py: 1.5, borderRadius: 999, border: `2px solid ${plan.tier === 'starter' ? C.primary : C.outlineVariant}`, color: plan.tier === 'starter' ? C.primary : C.onSurface, fontWeight: 800, textTransform: "none", fontSize: "1.05rem", transition: "all 0.3s ease", "&:hover": { bgcolor: C.surfaceContainerLow, transform: "translateY(-2px)" } }
                                }>
                                  {plan.tier === 'starter' 
                                    ? t('price_card_1_btn') 
                                    : (lang === 'bn' ? `${toBnNum(trialDays)}-দিনের ফ্রি ট্রায়াল শুরু করুন` : `Start ${trialDays}-Day Free Trial`)}
                                </Button>
                              </motion.div>
                            </Box>
                          </motion.div>
                        </Grid>
                      );
                    })
                  )}

                </Grid>
                
                <motion.div variants={fadeUp}>
                  <Box sx={{ textAlign: "center", mt: 6 }}>
                    <Link href="/pricing" style={{ color: C.primary, fontWeight: 800, textDecoration: "none", fontSize: "1.125rem", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {t('price_view_full')} <MaterialIcon icon="arrow_forward" sx={{ fontSize: "1.25rem" }} />
                    </Link>
                  </Box>
                </motion.div>
                
              </motion.div>
            </Container>
          </Box>

          {/* --- FINAL CTA --- */}
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-100px" }} variants={fadeScale}>
            <Box sx={{ py: { xs: 12, md: 16 }, position: "relative", overflow: "hidden", bgcolor: C.primary, color: C.onPrimary, mb: { md: 8 } }}>
              <Box sx={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom right, ${C.primary}, #003ea8, #00174b)`, zIndex: 0 }} />
              
              {/* Decorative shapes */}
              <Box component={motion.div} animate={{ rotate: 360 }} transition={{ duration: 50, repeat: Infinity, ease: "linear" }} sx={{ position: "absolute", top: -200, right: -100, width: 400, height: 400, borderRadius: "40%", border: `2px solid ${C.primaryFixedDim}33`, zIndex: 0, pointerEvents: "none" }} />
              <Box component={motion.div} animate={{ rotate: -360 }} transition={{ duration: 70, repeat: Infinity, ease: "linear" }} sx={{ position: "absolute", bottom: -200, left: -100, width: 500, height: 500, borderRadius: "30%", border: `2px solid ${C.primaryFixedDim}1A`, zIndex: 0, pointerEvents: "none" }} />

              <Container maxWidth="md" sx={{ position: "relative", zIndex: 1, textAlign: "center" }}>
                <Typography component="h2" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 800, fontSize: { xs: "2.5rem", md: "3.5rem" }, mb: 3, lineHeight: 1.1 }}>
                  {t('final_cta_title')}
                </Typography>
                <Typography sx={{ fontSize: "1.25rem", color: C.primaryFixedDim, mb: 6, maxWidth: 680, mx: "auto" }}>
                  {t('final_cta_subtitle')}
                </Typography>
                <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "center", gap: 3 }}>
                  <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }} transition={{ type: "spring", stiffness: 400, damping: 17 }}>
                    <Button component={Link} href="/register" sx={{ bgcolor: C.surface, color: C.primary, fontWeight: 800, borderRadius: 999, px: 4, py: 2, fontSize: "1.05rem", textTransform: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.15)", transition: "all 0.3s ease", "&:hover": { bgcolor: C.surfaceContainerLow, transform: "translateY(-2px)", boxShadow: "0 12px 32px rgba(0,0,0,0.2)" } }}>
                      {lang === 'bn' ? `${toBnNum(trialDays)}-দিনের ফ্রি ট্রায়াল শুরু করুন` : `Start ${trialDays}-Day Free Trial`}
                    </Button>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button component={Link} href="/contact" sx={{ bgcolor: "transparent", border: `2px solid ${C.primaryFixedDim}`, color: C.onPrimary, fontWeight: 800, borderRadius: 999, px: 6, py: 2.5, fontSize: "1.125rem", textTransform: "none", "&:hover": { bgcolor: `${C.primaryFixedDim}1A` } }}>
                      {t('final_cta_btn_2')}
                    </Button>
                  </motion.div>
                </Box>
                <Typography sx={{ fontSize: "0.875rem", color: C.primaryFixedDim, mt: 4, opacity: 0.8 }}>
                  {t('final_cta_note')}
                </Typography>
              </Container>
            </Box>
          </motion.div>

        </Box>
        <MarketingFooter />
      </Box>
    </PublicThemeProvider>
  );
}
