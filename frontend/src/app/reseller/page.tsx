"use client";

import Link from "next/link";
import { Box, Container, Typography, Button, Grid, Card, CardContent } from "@mui/material";
import PublicThemeProvider from "@/components/PublicThemeProvider";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";
import { M } from "@/lib/marketing";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ResellerPublicPage() {
  const { t } = useLanguage();

  const features = [
    { icon: "📝", title: t("reseller_feat1_title"), body: t("reseller_feat1_desc") },
    { icon: "🔗", title: t("reseller_feat2_title"), body: t("reseller_feat2_desc") },
    { icon: "💰", title: t("reseller_feat3_title"), body: t("reseller_feat3_desc") },
  ];

  return (
    <PublicThemeProvider>
      <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", bgcolor: M.surface, color: M.text, fontFamily: "Outfit, sans-serif" }}>
        <MarketingNav />

        <Box component="main" sx={{ flexGrow: 1 }}>
          {/* Hero Section */}
          <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
            <Box sx={{ textAlign: "center", maxWidth: 760, mx: "auto", mb: { xs: 6, md: 8 } }}>
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, px: 2, py: 0.75, borderRadius: "20px", bgcolor: "rgba(37,99,235,0.08)", color: M.primary, fontWeight: 700, fontSize: "0.85rem", mb: 3, border: `1px solid rgba(37,99,235,0.2)` }}>
                {t("reseller_eyebrow")}
              </Box>
              <Typography component="h1" sx={{ fontWeight: 800, fontSize: { xs: "2.5rem", md: "3.5rem" }, letterSpacing: "-0.03em", mb: 3, lineHeight: 1.1 }}>
                {t("reseller_title_1")} <br />
                <span style={{ color: M.primary }}>{t("reseller_title_2")}</span>
              </Typography>
              <Typography sx={{ fontSize: { xs: "1.1rem", md: "1.25rem" }, color: M.textMuted, mb: 5, lineHeight: 1.6 }}>
                {t("reseller_subtitle")}
              </Typography>
              <Button component={Link} href="/reseller/register" sx={{
                bgcolor: M.primary, color: M.onPrimary, fontWeight: 700, textTransform: "none", borderRadius: "12px", px: 5, py: 1.8, fontSize: "1.1rem",
                boxShadow: "0 10px 24px -8px rgba(37,99,235,.65)", "&:hover": { bgcolor: M.primaryDark, transform: "translateY(-2px)" }, transition: "all 0.2s ease"
              }}>
                {t("reseller_btn_register")}
              </Button>
            </Box>

            {/* Features Grid */}
            <Grid container spacing={4}>
              {features.map((f, i) => (
                <Grid key={i} size={{ xs: 12, md: 4 }}>
                  <Card sx={{
                    height: "100%", bgcolor: M.card, border: `1px solid ${M.border}`, borderRadius: 4,
                    boxShadow: "0 12px 24px -12px rgba(15,23,42,.1)", transition: "transform 0.2s",
                    "&:hover": { transform: "translateY(-4px)", borderColor: M.primary }
                  }}>
                    <CardContent sx={{ p: 4 }}>
                      <Box sx={{ fontSize: "2.5rem", mb: 2 }}>{f.icon}</Box>
                      <Typography variant="h5" sx={{ fontWeight: 800, mb: 1.5, color: M.text }}>{f.title}</Typography>
                      <Typography sx={{ color: M.textMuted, lineHeight: 1.6 }}>{f.body}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        <MarketingFooter />
      </Box>
    </PublicThemeProvider>
  );
}
