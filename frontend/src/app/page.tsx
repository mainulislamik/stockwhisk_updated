"use client";

import Link from "next/link";
import { Box, Typography, Button, Container, Grid, useTheme, useMediaQuery } from "@mui/material";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";
import PublicThemeProvider from "@/components/PublicThemeProvider";
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

export default function LandingPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  return (
    <PublicThemeProvider>
      {/* We need the material symbols font */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
      `}} />
      <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", bgcolor: C.background, color: C.onBackground, fontFamily: manrope.style.fontFamily, overflowX: "hidden" }}>
        <MarketingNav />

        <Box component="main" sx={{ flexGrow: 1, pt: { xs: 8, md: 12 }, pb: { xs: 10, md: 16 } }}>
          
          {/* --- HERO SECTION --- */}
          <Box sx={{ position: "relative", overflow: "hidden", pt: { xs: 4, md: 8 }, pb: { xs: 8, md: 12 } }}>
            {/* Background elements */}
            <Box sx={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 800, height: 800, bgcolor: `${C.primary}0D`, borderRadius: "50%", filter: "blur(80px)", zIndex: 0, pointerEvents: "none" }} />
            <Box sx={{ position: "absolute", top: 160, right: 0, width: 400, height: 400, bgcolor: `${C.secondaryContainer}1A`, borderRadius: "50%", filter: "blur(80px)", zIndex: 0, pointerEvents: "none" }} />
            
            <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1, textAlign: "center", display: "flex", flexDir: "column", alignItems: "center" }}>
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, bgcolor: C.surfaceContainerLow, border: `1px solid ${C.outlineVariant}`, borderRadius: 999, px: 2, py: 1, mb: 4 }}>
                <MaterialIcon icon="star" filled sx={{ color: C.secondaryContainer, fontSize: "1rem" }} />
                <Typography sx={{ fontFamily: jetbrains.style.fontFamily, fontSize: "0.75rem", color: C.onSurfaceVariant, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  #1 CLOUD POS SOLUTION
                </Typography>
              </Box>

              <Typography component="h1" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 800, fontSize: { xs: "2.5rem", md: "4rem" }, lineHeight: 1.1, letterSpacing: "-0.02em", color: C.onBackground, mb: 3, maxWidth: 900, mx: "auto" }}>
                {isMobile ? (
                  <>
                    Run your store <br />
                    <Box component="span" sx={{ color: C.primary, position: "relative", display: "inline-block" }}>
                      smarter
                      <Box component="svg" viewBox="0 0 100 10" preserveAspectRatio="none" sx={{ position: "absolute", width: "100%", height: 12, bottom: -4, left: 0, color: C.primaryFixedDim }}>
                        <path d="M0 5 Q 50 10 100 5" fill="transparent" stroke="currentColor" strokeWidth="3" />
                      </Box>
                    </Box>{" "}
                    with StockWhisk
                  </>
                ) : (
                  <>
                    Inventory & POS Management <br />
                    <Box component="span" sx={{ background: `linear-gradient(135deg, ${C.primary}, #0053db)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Software for Retail</Box>
                  </>
                )}
              </Typography>

              <Typography sx={{ fontSize: { xs: "1rem", md: "1.125rem" }, color: C.onSurfaceVariant, maxWidth: 680, mx: "auto", mb: 5, lineHeight: 1.6 }}>
                Modern retail dashboard built for clarity, speed, and accuracy. Manage inventory, track sales, and grow your business without the hassle.
              </Typography>

              <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 2, width: { xs: "100%", sm: "auto" }, mb: { xs: 6, md: 10 }, mx: "auto" }}>
                <Button component={Link} href="/register" sx={{ bgcolor: C.primary, color: C.onPrimary, fontWeight: 700, borderRadius: 999, px: 4, py: 2, fontSize: "1rem", textTransform: "none", boxShadow: `0 8px 24px ${C.primary}4D`, "&:hover": { bgcolor: C.onPrimaryFixedVariant, transform: "translateY(-2px)" }, transition: "all 0.2s" }}>
                  Start Free Trial
                </Button>
                <Button component={Link} href="/demo" sx={{ bgcolor: C.surface, color: C.primary, border: `1px solid ${C.primary}33`, fontWeight: 700, borderRadius: 999, px: 4, py: 2, fontSize: "1rem", textTransform: "none", "&:hover": { bgcolor: C.surfaceContainerLow, transform: "translateY(-2px)" }, transition: "all 0.2s" }}>
                  <MaterialIcon icon="play_arrow" filled sx={{ mr: 1 }} />
                  Explore Live Demo
                </Button>
              </Box>

              {/* Hero Image Mockup */}
              {isMobile ? (
                <Box sx={{ width: "100%", position: "relative", mt: 4 }}>
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
                          <Typography sx={{ fontSize: "0.75rem", opacity: 0.8, mb: 0.5 }}>Today's Sales</Typography>
                          <Typography sx={{ fontWeight: 700, fontSize: "1.125rem" }}>৳ 48,250</Typography>
                        </Box>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Box sx={{ bgcolor: C.surfaceContainerLow, border: `1px solid ${C.surfaceVariant}`, p: 2, borderRadius: "12px" }}>
                          <Typography sx={{ fontSize: "0.75rem", color: C.onSurfaceVariant, mb: 0.5 }}>Orders</Typography>
                          <Typography sx={{ fontWeight: 700, fontSize: "1.125rem", color: C.onSurface }}>126</Typography>
                        </Box>
                      </Grid>
                    </Grid>
                    <Box sx={{ bgcolor: C.surfaceContainerLow, border: `1px solid ${C.surfaceVariant}`, borderRadius: "12px", mt: 1.5, p: 2, height: 130, position: "relative", overflow: "hidden" }}>
                      <Typography sx={{ fontSize: "0.75rem", color: C.onSurfaceVariant, mb: 1 }}>Sales Trend</Typography>
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
                <Box sx={{ width: "100%", maxWidth: 1024, mx: "auto", position: "relative", perspective: 1000 }}>
                  <Box sx={{ position: "absolute", inset: 0, background: `linear-gradient(to top, ${C.background}, transparent, transparent)`, zIndex: 10, pointerEvents: "none" }} />
                  <Box sx={{ position: "relative", borderRadius: "24px", border: `1px solid ${C.outlineVariant}4D`, boxShadow: `0 20px 60px ${C.primary}1A`, overflow: "hidden", bgcolor: C.surface, transition: "transform 0.7s", "&:hover": { transform: "rotateX(2deg)" } }}>
                    <Box sx={{ height: 40, bgcolor: C.surfaceContainerLowest, borderBottom: `1px solid ${C.outlineVariant}4D`, display: "flex", alignItems: "center", px: 2, gap: 1 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "#ef4444" }} />
                      <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: C.secondaryFixedDim }} />
                      <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: C.tertiaryFixedDim }} />
                      <Typography sx={{ flex: 1, textAlign: "center", fontFamily: jetbrains.style.fontFamily, fontSize: "0.75rem", color: `${C.onSurfaceVariant}80` }}>stockwhisk.com/app</Typography>
                    </Box>
                    <Box component="img" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC6-ujRGatBx_3wsyR5uq1BS91XjnkpfBxNc7seDYzGQK4OipRJ00bVUgYOSGbkJlPdNwKUab_MzJi8EEz3X32hkkUAwQYHSAwLl8vOqiF7DTXwluQbmDRvlHab8t_RQrftCOGveHxJ0337OxQp3yOizdCjfdyXtYuYEXKQoqO63vmW5KaBj7R-zLXzjMAEwklupd6qYKAgoUMNXCDTNUDJpfllGa2b_e9bqVbxYqMglWGgzxdHusxp" alt="StockWhisk Dashboard Mockup" sx={{ width: "100%", display: "block" }} />
                  </Box>
                </Box>
              )}
            </Container>
          </Box>

          {/* --- BENTO GRID / FEATURES --- */}
          <Box id="features" sx={{ py: { xs: 8, md: 12 }, bgcolor: `${C.surfaceContainerLow}80` }}>
            <Container maxWidth="lg">
              <Box sx={{ textAlign: "center", mb: 8 }}>
                <Typography component="h2" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 700, fontSize: { xs: "1.75rem", md: "2.25rem" }, color: C.onBackground, mb: 2 }}>
                  Everything You Need to Manage Your Retail Business
                </Typography>
                <Typography sx={{ fontSize: "1rem", color: C.onSurfaceVariant, maxWidth: 680, mx: "auto" }}>
                  A complete suite of tools designed to streamline your daily operations.
                </Typography>
              </Box>

              <Grid container spacing={3}>
                {/* Inventory (Large) */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box sx={{ bgcolor: C.surface, borderRadius: "24px", p: 4, border: `1px solid ${C.outlineVariant}4D`, boxShadow: "0 1px 2px rgba(0,0,0,0.05)", height: "100%", display: "flex", flexDirection: "column", transition: "all 0.3s", "&:hover": { boxShadow: `0 12px 40px ${C.primary}1A` } }}>
                    <Box sx={{ width: 56, height: 56, borderRadius: "12px", bgcolor: C.primaryContainer, color: C.onPrimaryContainer, display: "flex", alignItems: "center", justifyContent: "center", mb: 3 }}>
                      <MaterialIcon icon="inventory_2" sx={{ fontSize: "2rem" }} />
                    </Box>
                    <Typography component="h3" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 600, fontSize: "1.25rem", color: C.onBackground, mb: 1.5 }}>
                      Smart Inventory
                    </Typography>
                    <Typography sx={{ color: C.onSurfaceVariant, mb: 3, flexGrow: 1 }}>
                      Track stock levels in real-time across multiple locations. Get automatic alerts when items run low.
                    </Typography>
                    <Box sx={{ height: 160, borderRadius: "12px", bgcolor: C.surfaceContainerLowest, border: `1px solid ${C.outlineVariant}33`, overflow: "hidden", position: "relative" }}>
                      <Box component="img" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCsC9jhBbOcraVxXq5vDD7xm6CNg1RFmeeVjqNufP6BvGPev1y2J-bwO5JoSbOnpO33GsUXhhJ8Z-gzZCyXwxbybfFmY2MD8SeniLdIvu-3M0TeCHWAY6KkGvu_exySL4BMKTK7IjWUzd5t2COeKaf9yCeUccUWUZTumNVzLDO3UZQEfix0arAehxvtCUuyNJyvqav2PfqJuBUH0S59JXsija-OwE7UOB1RjiqBdaY0TSMHFvq9IFcA" alt="Inventory illustration" sx={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.8 }} />
                    </Box>
                  </Box>
                </Grid>

                {/* POS & Reports (Medium stack) */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Grid container spacing={3} sx={{ height: "100%" }}>
                    <Grid size={{ xs: 12 }}>
                      <Box sx={{ bgcolor: C.surface, borderRadius: "24px", p: 4, border: `1px solid ${C.outlineVariant}4D`, boxShadow: "0 1px 2px rgba(0,0,0,0.05)", height: "100%", transition: "all 0.3s", "&:hover": { boxShadow: `0 12px 40px ${C.primary}1A` } }}>
                        <Box sx={{ width: 48, height: 48, borderRadius: "12px", bgcolor: `${C.secondaryContainer}33`, color: C.onSecondaryContainer, display: "flex", alignItems: "center", justifyContent: "center", mb: 2.5 }}>
                          <MaterialIcon icon="point_of_sale" sx={{ fontSize: "1.5rem" }} />
                        </Box>
                        <Typography component="h3" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 600, fontSize: "1.25rem", color: C.onBackground, mb: 1 }}>
                          Fast POS
                        </Typography>
                        <Typography sx={{ color: C.onSurfaceVariant }}>
                          Process transactions quickly with our intuitive checkout interface.
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <Box sx={{ bgcolor: C.surface, borderRadius: "24px", p: 4, border: `1px solid ${C.outlineVariant}4D`, boxShadow: "0 1px 2px rgba(0,0,0,0.05)", height: "100%", transition: "all 0.3s", "&:hover": { boxShadow: `0 12px 40px ${C.primary}1A` } }}>
                        <Box sx={{ width: 48, height: 48, borderRadius: "12px", bgcolor: `${C.tertiaryContainer}33`, color: C.onTertiaryContainer, display: "flex", alignItems: "center", justifyContent: "center", mb: 2.5 }}>
                          <MaterialIcon icon="bar_chart" sx={{ fontSize: "1.5rem" }} />
                        </Box>
                        <Typography component="h3" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 600, fontSize: "1.25rem", color: C.onBackground, mb: 1 }}>
                          Insightful Reports
                        </Typography>
                        <Typography sx={{ color: C.onSurfaceVariant }}>
                          Understand your sales trends and profit margins with beautiful charts.
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Grid>

                {/* Small Cards */}
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Box sx={{ bgcolor: C.surface, borderRadius: "24px", p: 3, border: `1px solid ${C.outlineVariant}4D`, boxShadow: "0 1px 2px rgba(0,0,0,0.05)", transition: "transform 0.2s", "&:hover": { transform: "translateY(-4px)" } }}>
                    <Box sx={{ width: 40, height: 40, borderRadius: "8px", bgcolor: C.surfaceVariant, color: C.primary, display: "flex", alignItems: "center", justifyContent: "center", mb: 2 }}>
                      <MaterialIcon icon="shopping_cart" />
                    </Box>
                    <Typography component="h3" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 600, fontSize: "1.125rem", color: C.onBackground, mb: 1 }}>Purchases</Typography>
                    <Typography sx={{ fontSize: "0.875rem", color: C.onSurfaceVariant }}>Streamline ordering.</Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Box sx={{ bgcolor: C.surface, borderRadius: "24px", p: 3, border: `1px solid ${C.outlineVariant}4D`, boxShadow: "0 1px 2px rgba(0,0,0,0.05)", transition: "transform 0.2s", "&:hover": { transform: "translateY(-4px)" } }}>
                    <Box sx={{ width: 40, height: 40, borderRadius: "8px", bgcolor: C.surfaceVariant, color: C.primary, display: "flex", alignItems: "center", justifyContent: "center", mb: 2 }}>
                      <MaterialIcon icon="group" />
                    </Box>
                    <Typography component="h3" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 600, fontSize: "1.125rem", color: C.onBackground, mb: 1 }}>Customers</Typography>
                    <Typography sx={{ fontSize: "0.875rem", color: C.onSurfaceVariant }}>Build loyalty.</Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Box sx={{ bgcolor: C.surface, borderRadius: "24px", p: 3, border: `1px solid ${C.outlineVariant}4D`, boxShadow: "0 1px 2px rgba(0,0,0,0.05)", transition: "transform 0.2s", "&:hover": { transform: "translateY(-4px)" } }}>
                    <Box sx={{ width: 40, height: 40, borderRadius: "8px", bgcolor: C.surfaceVariant, color: C.primary, display: "flex", alignItems: "center", justifyContent: "center", mb: 2 }}>
                      <MaterialIcon icon="local_shipping" />
                    </Box>
                    <Typography component="h3" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 600, fontSize: "1.125rem", color: C.onBackground, mb: 1 }}>Suppliers</Typography>
                    <Typography sx={{ fontSize: "0.875rem", color: C.onSurfaceVariant }}>Manage vendors.</Typography>
                  </Box>
                </Grid>
              </Grid>
            </Container>
          </Box>

          {/* --- RETAIL PROBLEMS & SOLUTION --- */}
          <Box sx={{ py: { xs: 8, md: 12 } }}>
            <Container maxWidth="lg">
              <Grid container spacing={8} sx={{ alignItems: "center" }}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography component="h2" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 700, fontSize: { xs: "1.75rem", md: "2.25rem" }, color: C.onBackground, mb: 4 }}>
                    Managing Your Shop Shouldn’t Be This Complicated
                  </Typography>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 3, mt: 4 }}>
                    {[
                      { title: "Manual Stock Counting", text: "Wasting hours counting items and still getting it wrong." },
                      { title: "Messy Paper Records", text: "Losing track of who bought what and who owes you money." },
                      { title: "Guessing Profits", text: "Not knowing which products are actually making you money." }
                    ].map((item, i) => (
                      <Box key={i} sx={{ display: "flex", alignItems: "flex-start", gap: 2, opacity: 0.7 }}>
                        <Box sx={{ width: 32, height: 32, borderRadius: "50%", bgcolor: C.errorContainer, color: C.onErrorContainer, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, mt: 0.5 }}>
                          <MaterialIcon icon="close" sx={{ fontSize: "1rem" }} />
                        </Box>
                        <Box>
                          <Typography sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 600, fontSize: "1.25rem", color: C.onBackground, mb: 0.5 }}>{item.title}</Typography>
                          <Typography sx={{ fontSize: "0.875rem", color: C.onSurfaceVariant }}>{item.text}</Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box sx={{ bgcolor: C.surfaceContainer, p: { xs: 4, md: 6 }, borderRadius: "24px", position: "relative", overflow: "hidden", border: `1px solid ${C.primary}1A`, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}>
                    <Box sx={{ position: "absolute", top: -80, right: -80, width: 256, height: 256, bgcolor: `${C.primary}33`, borderRadius: "50%", filter: "blur(60px)" }} />
                    <Box sx={{ position: "relative", zIndex: 1 }}>
                      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, bgcolor: C.primaryContainer, color: C.onPrimaryContainer, px: 1.5, py: 0.5, borderRadius: 999, mb: 3 }}>
                        <MaterialIcon icon="check_circle" sx={{ fontSize: "0.875rem" }} />
                        <Typography sx={{ fontFamily: jetbrains.style.fontFamily, fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>The StockWhisk Way</Typography>
                      </Box>
                      <Typography component="h3" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 700, fontSize: "2.25rem", color: C.onBackground, mb: 2 }}>
                        Automate & Simplify
                      </Typography>
                      <Typography sx={{ color: C.onSurfaceVariant, mb: 4 }}>
                        StockWhisk connects every part of your store. Make a sale, and inventory updates instantly. Buy stock, and supplier ledgers are adjusted. It just works.
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2, bgcolor: C.surface, p: 2, borderRadius: "12px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)", border: `1px solid ${C.outlineVariant}33` }}>
                        <Box sx={{ width: 48, height: 48, borderRadius: "50%", bgcolor: `${C.tertiaryContainer}33`, display: "flex", alignItems: "center", justifyContent: "center", color: C.tertiaryContainer }}>
                          <MaterialIcon icon="trending_up" />
                        </Box>
                        <Box>
                          <Typography sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 700, color: C.onBackground }}>Save 10+ hours a week</Typography>
                          <Typography sx={{ fontSize: "0.875rem", color: C.onSurfaceVariant }}>Focus on growing, not paperwork.</Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </Container>
          </Box>

          {/* --- FLOW DIAGRAM --- */}
          <Box id="how-it-works" sx={{ py: { xs: 8, md: 12 }, bgcolor: C.surfaceContainerLowest, borderTop: `1px solid ${C.outlineVariant}33`, borderBottom: `1px solid ${C.outlineVariant}33` }}>
            <Container maxWidth="lg" sx={{ textAlign: "center" }}>
              <Typography component="h2" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 700, fontSize: { xs: "1.75rem", md: "2.25rem" }, color: C.onBackground, mb: 8 }}>
                One Platform for Your Entire Retail Operation
              </Typography>
              
              {!isMobile && (
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 900, mx: "auto", mb: 8, position: "relative" }}>
                  <Box sx={{ position: "absolute", top: "50%", left: 0, width: "100%", height: "2px", bgcolor: `${C.outlineVariant}4D`, zIndex: 0, transform: "translateY(-50%)" }} />
                  {[
                    { icon: "category", label: "Products" },
                    { icon: "shopping_cart", label: "Purchases" },
                    { icon: "inventory_2", label: "Inventory", primary: true },
                    { icon: "point_of_sale", label: "Sales" },
                    { icon: "bar_chart", label: "Reports" }
                  ].map((item, i) => (
                    <Box key={i} sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, bgcolor: C.surfaceContainerLowest, p: 1, zIndex: 1 }}>
                      {item.primary ? (
                        <Box sx={{ width: 64, height: 64, borderRadius: "50%", bgcolor: C.primary, border: `4px solid ${C.primaryContainer}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", transform: "scale(1.1)" }}>
                          <MaterialIcon icon={item.icon} sx={{ color: C.onPrimary, fontSize: "1.875rem" }} />
                        </Box>
                      ) : (
                        <Box sx={{ width: 56, height: 56, borderRadius: "50%", bgcolor: C.surfaceContainer, border: `2px solid ${C.outlineVariant}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                          <MaterialIcon icon={item.icon} sx={{ color: C.primary }} />
                        </Box>
                      )}
                      <Typography sx={{ fontFamily: jetbrains.style.fontFamily, fontWeight: 700, fontSize: "0.75rem", color: item.primary ? C.primary : C.onSurface }}>{item.label}</Typography>
                    </Box>
                  ))}
                </Box>
              )}

              <Box sx={{ borderRadius: "24px", border: `1px solid ${C.outlineVariant}4D`, boxShadow: `0 12px 40px ${C.primary}1A`, overflow: "hidden", bgcolor: C.surface, maxWidth: 1024, mx: "auto" }}>
                <Box component="img" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCX8MVbI7cy9oyCsyCoMNnZ-AXZa1mmb6AtVS_5R5oIVib7fDYrXRWuUtqRw19vfduFD2-XdtUXVzU9LXVw6W0s7yNpHLw8SNXYfMlY6z8QF_vVqQQK9M_DZz5eGFxakVDTMe1XrMFKW5mNILsR8ivt_CkiSJL8sq8iNpSmHOjCtG1p9LAiNX8MDnCz4BjYoe3cW80bRmCkNosNB-rMng7fukbiX18kwParKaywJyYNEvh0IPreDVG0" alt="Full Dashboard" sx={{ width: "100%", display: "block" }} />
              </Box>
            </Container>
          </Box>

          {/* --- FEATURE DETAILS (Alternating) --- */}
          <Box sx={{ py: { xs: 8, md: 12 } }}>
            <Container maxWidth="lg">
              
              {/* Inventory Feature */}
              <Grid container spacing={8} sx={{ alignItems: "center", mb: { xs: 8, md: 16 } }}>
                <Grid size={{ xs: 12, md: 6 }} sx={{ order: { xs: 2, md: 1 } }}>
                  <Box sx={{ borderRadius: "24px", overflow: "hidden", boxShadow: `0 12px 40px ${C.primary}1A`, border: `1px solid ${C.outlineVariant}33`, bgcolor: C.surface }}>
                    <Box component="img" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDC2-Hr_i7eBi5QI2Y285Nklwp4tnRtkEXl5R-NGSp6Y5hCI5fYQPCgK9A92qnieiWRbAHQSirp3Y0_JRbwoJPp3Fz5wV313ksyeuOLB2Mku5dWh3GoW0SKSpTuDHE2s40Nd35dLmYXYqn4vPWxU80wI2NxDeRvhpABmj_3V7oKtzaXkn4aWlx8495XfTLEli6f5E_QHwNsw5mK8MsCFOIXdRbLyBJ3mlMNQYya6itRKQrhpd7NRDeX" alt="Inventory UI" sx={{ width: "100%", display: "block" }} />
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }} sx={{ order: { xs: 1, md: 2 } }}>
                  <Box sx={{ width: 48, height: 48, bgcolor: C.primaryContainer, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", color: C.onPrimaryContainer, mb: 3 }}>
                    <MaterialIcon icon="inventory_2" sx={{ fontSize: "1.5rem" }} />
                  </Box>
                  <Typography component="h2" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 700, fontSize: { xs: "1.75rem", md: "2.25rem" }, color: C.onBackground, mb: 2 }}>
                    Powerful Inventory Management
                  </Typography>
                  <Typography sx={{ color: C.onSurfaceVariant, fontSize: "1.125rem", mb: 3 }}>
                    Keep your shelves stocked and your data accurate without manual counting.
                  </Typography>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 4 }}>
                    {[
                      "Organize by categories, brands, and variants (size/color).",
                      "Track exact item movement history.",
                      "Set low-stock thresholds and get notified automatically."
                    ].map((t, i) => (
                      <Box key={i} sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                        <MaterialIcon icon="check" sx={{ color: C.primary, mt: 0.25 }} />
                        <Typography sx={{ color: C.onSurface }}>{t}</Typography>
                      </Box>
                    ))}
                  </Box>
                  <Link href="/register" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: C.primary, fontWeight: 700, textDecoration: "none" }}>
                    Explore Inventory Features <MaterialIcon icon="arrow_forward" />
                  </Link>
                </Grid>
              </Grid>

              {/* POS Feature */}
              <Box sx={{ bgcolor: `${C.surfaceContainerLow}80`, borderRadius: "32px", p: { xs: 4, md: 8 } }}>
                <Grid container spacing={8} sx={{ alignItems: "center" }}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Box sx={{ width: 48, height: 48, bgcolor: `${C.secondaryContainer}4D`, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", color: C.onSecondaryContainer, mb: 3 }}>
                      <MaterialIcon icon="point_of_sale" sx={{ fontSize: "1.5rem" }} />
                    </Box>
                    <Typography component="h2" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 700, fontSize: { xs: "1.75rem", md: "2.25rem" }, color: C.onBackground, mb: 2 }}>
                      Fast & Simple POS for Everyday Sales
                    </Typography>
                    <Typography sx={{ color: C.onSurfaceVariant, fontSize: "1.125rem", mb: 3 }}>
                      A checkout experience designed for speed, ensuring your customers never wait in long lines.
                    </Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {[
                        "Barcode scanner integration for lightning-fast checkout.",
                        "Accept multiple payment methods (Cash, Card, Mobile).",
                        "Inventory updates instantly the moment a sale is completed."
                      ].map((t, i) => (
                        <Box key={i} sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                          <MaterialIcon icon="check" sx={{ color: C.secondaryContainer, mt: 0.25 }} />
                          <Typography sx={{ color: C.onSurface }}>{t}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Box sx={{ borderRadius: "24px", overflow: "hidden", boxShadow: `0 12px 40px ${C.primary}1A`, border: `1px solid ${C.outlineVariant}33`, bgcolor: C.surface }}>
                      <Box component="img" src="https://lh3.googleusercontent.com/aida-public/AB6AXuARZQi3fPGlafivXLK-3ZfImKPstbx0a95c6gWc5TxHoLRs1EWxECodoxJDsXlldw2MGyu5_qQv3JkfBzOUWZ59o52mlAKXFFL0QKc2fbhjH5k5O_GCALxkVyLsGcu-s-JcQwvjgWBPTT2bg52u3He_SwvWJ_AAbhJuyg-5WC1cjpy5lhHERwAFAEsYNXjl_GRlEeYMHFIXyC9-fVr6kOFfhPbgC15H3MFIASe9wCpborbR_KHM1xep" alt="POS UI" sx={{ width: "100%", display: "block" }} />
                    </Box>
                  </Grid>
                </Grid>
              </Box>

            </Container>
          </Box>

          {/* --- PRICING TEASER --- */}
          <Box id="pricing" sx={{ py: { xs: 8, md: 12 } }}>
            <Container maxWidth="lg">
              <Box sx={{ textAlign: "center", mb: 8 }}>
                <Typography component="h2" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 700, fontSize: { xs: "1.75rem", md: "2.25rem" }, color: C.onBackground, mb: 2 }}>
                  Simple Pricing, No Surprises
                </Typography>
                <Typography sx={{ fontSize: "1rem", color: C.onSurfaceVariant, maxWidth: 680, mx: "auto" }}>
                  Start for free, upgrade when you need to grow.
                </Typography>
              </Box>

              <Grid container spacing={4} sx={{ maxWidth: 1024, mx: "auto", alignItems: "center" }}>
                
                {/* Starter Plan */}
                <Grid size={{ xs: 12, md: 4 }}>
                  <Box sx={{ bgcolor: C.surface, borderRadius: "32px", p: 4, border: `1px solid ${C.outlineVariant}4D`, boxShadow: "0 1px 2px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", height: "100%" }}>
                    <Typography component="h3" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 600, fontSize: "1.25rem", color: C.onBackground, mb: 1 }}>Starter</Typography>
                    <Typography sx={{ fontSize: "0.875rem", color: C.onSurfaceVariant, mb: 3 }}>Perfect for small, single-location shops.</Typography>
                    <Box sx={{ mb: 4 }}>
                      <Typography component="span" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 800, fontSize: "2.25rem", color: C.onBackground }}>Free</Typography>
                      <Typography component="span" sx={{ fontSize: "0.875rem", color: C.onSurfaceVariant, ml: 1 }}>/forever</Typography>
                    </Box>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, flexGrow: 1, mb: 4 }}>
                      {["Up to 500 Products", "Basic POS", "1 User"].map((t, i) => (
                        <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <MaterialIcon icon="check" sx={{ color: C.primary, fontSize: "0.875rem" }} />
                          <Typography sx={{ fontSize: "0.875rem", color: C.onSurface }}>{t}</Typography>
                        </Box>
                      ))}
                    </Box>
                    <Button component={Link} href="/register" sx={{ width: "100%", py: 1.5, borderRadius: 999, border: `1px solid ${C.primary}`, color: C.primary, fontWeight: 700, textTransform: "none", "&:hover": { bgcolor: C.surfaceContainer } }}>
                      Get Started
                    </Button>
                  </Box>
                </Grid>

                {/* Professional Plan (Highlighted) */}
                <Grid size={{ xs: 12, md: 4 }}>
                  <Box sx={{ bgcolor: C.primary, color: C.onPrimary, borderRadius: "32px", p: 4, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)", display: "flex", flexDirection: "column", height: "100%", position: "relative", transform: { md: "translateY(-16px)" } }}>
                    <Box sx={{ position: "absolute", top: 0, right: 0, bgcolor: C.secondaryContainer, color: C.onSecondaryContainer, fontSize: "0.75rem", fontWeight: 700, px: 1.5, py: 0.5, borderBottomLeftRadius: "12px", borderTopRightRadius: "32px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Most Popular
                    </Box>
                    <Typography component="h3" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 600, fontSize: "1.25rem", color: C.onPrimary, mb: 1 }}>Professional</Typography>
                    <Typography sx={{ fontSize: "0.875rem", color: C.primaryFixedDim, mb: 3 }}>For growing businesses needing more power.</Typography>
                    <Box sx={{ mb: 4 }}>
                      <Typography component="span" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 800, fontSize: "2.25rem", color: C.onPrimary }}>$29</Typography>
                      <Typography component="span" sx={{ fontSize: "0.875rem", color: C.primaryFixedDim, ml: 1 }}>/month</Typography>
                    </Box>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, flexGrow: 1, mb: 4 }}>
                      {["Unlimited Products", "Advanced POS & Barcodes", "3 Users", "Detailed Reports"].map((t, i) => (
                        <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <MaterialIcon icon="check" sx={{ color: C.tertiaryFixedDim, fontSize: "0.875rem" }} />
                          <Typography sx={{ fontSize: "0.875rem", color: C.onPrimary }}>{t}</Typography>
                        </Box>
                      ))}
                    </Box>
                    <Button component={Link} href="/register" sx={{ width: "100%", py: 1.5, borderRadius: 999, bgcolor: C.surface, color: C.primary, fontWeight: 700, textTransform: "none", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", "&:hover": { bgcolor: C.surfaceContainerLow } }}>
                      Start 14-Day Free Trial
                    </Button>
                  </Box>
                </Grid>

                {/* Enterprise Plan */}
                <Grid size={{ xs: 12, md: 4 }}>
                  <Box sx={{ bgcolor: C.surface, borderRadius: "32px", p: 4, border: `1px solid ${C.outlineVariant}4D`, boxShadow: "0 1px 2px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", height: "100%" }}>
                    <Typography component="h3" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 600, fontSize: "1.25rem", color: C.onBackground, mb: 1 }}>Enterprise</Typography>
                    <Typography sx={{ fontSize: "0.875rem", color: C.onSurfaceVariant, mb: 3 }}>Multi-store management and priority support.</Typography>
                    <Box sx={{ mb: 4 }}>
                      <Typography component="span" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 800, fontSize: "2.25rem", color: C.onBackground }}>$79</Typography>
                      <Typography component="span" sx={{ fontSize: "0.875rem", color: C.onSurfaceVariant, ml: 1 }}>/month</Typography>
                    </Box>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, flexGrow: 1, mb: 4 }}>
                      {["Multiple Locations", "Unlimited Users", "API Access"].map((t, i) => (
                        <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <MaterialIcon icon="check" sx={{ color: C.primary, fontSize: "0.875rem" }} />
                          <Typography sx={{ fontSize: "0.875rem", color: C.onSurface }}>{t}</Typography>
                        </Box>
                      ))}
                    </Box>
                    <Button component={Link} href="/contact" sx={{ width: "100%", py: 1.5, borderRadius: 999, border: `1px solid ${C.outlineVariant}`, color: C.onSurface, fontWeight: 700, textTransform: "none", "&:hover": { bgcolor: C.surfaceContainer } }}>
                      Contact Sales
                    </Button>
                  </Box>
                </Grid>

              </Grid>
              <Box sx={{ textAlign: "center", mt: 4 }}>
                <Link href="/pricing" style={{ color: C.primary, fontWeight: 700, textDecoration: "none" }}>
                  View Full Feature Comparison
                </Link>
              </Box>
            </Container>
          </Box>

          {/* --- FINAL CTA --- */}
          <Box sx={{ py: { xs: 10, md: 16 }, position: "relative", overflow: "hidden", bgcolor: C.primary, color: C.onPrimary }}>
            <Box sx={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom right, ${C.primary}, #003ea8, #00174b)`, zIndex: 0 }} />
            <Container maxWidth="md" sx={{ position: "relative", zIndex: 1, textAlign: "center" }}>
              <Typography component="h2" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 800, fontSize: { xs: "2rem", md: "3rem" }, mb: 3 }}>
                Ready to Manage Your Shop Smarter?
              </Typography>
              <Typography sx={{ fontSize: "1.125rem", color: C.primaryFixedDim, mb: 5, maxWidth: 680, mx: "auto" }}>
                Join thousands of retailers who have simplified their operations, reduced errors, and grown their profits with StockWhisk.
              </Typography>
              <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "center", gap: 2 }}>
                <Button component={Link} href="/register" sx={{ bgcolor: C.surface, color: C.primary, fontWeight: 700, borderRadius: 999, px: 5, py: 2, fontSize: "1rem", textTransform: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", "&:hover": { bgcolor: C.surfaceContainerLow, transform: "scale(1.05)" }, transition: "all 0.2s" }}>
                  Start Your Free Trial
                </Button>
                <Button component={Link} href="/contact" sx={{ bgcolor: "transparent", border: `1px solid ${C.primaryFixedDim}`, color: C.onPrimary, fontWeight: 700, borderRadius: 999, px: 5, py: 2, fontSize: "1rem", textTransform: "none", "&:hover": { bgcolor: `${C.primaryFixedDim}1A` }, transition: "all 0.2s" }}>
                  Talk to Sales
                </Button>
              </Box>
              <Typography sx={{ fontSize: "0.875rem", color: C.primaryFixedDim, mt: 3 }}>
                No credit card required. Setup takes 5 minutes.
              </Typography>
            </Container>
          </Box>

        </Box>
        <MarketingFooter />
      </Box>
    </PublicThemeProvider>
  );
}
