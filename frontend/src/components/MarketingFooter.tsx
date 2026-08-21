"use client";

import Link from "next/link";
import { Box, Container, Grid, Stack, Typography } from "@mui/material";
import { M } from "@/lib/marketing";
import { useLanguage } from "@/contexts/LanguageContext";

/** Shared footer for every public/marketing page. */
export default function MarketingFooter() {
  const { t } = useLanguage();
  const linkSx = { color: M.darkText, textDecoration: "none", fontSize: ".9rem" };
  return (
    <Box component="footer" sx={{ bgcolor: M.dark, color: M.darkText, py: 6, mt: "auto" }}>
      <Container maxWidth="xl">
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: "#fff", mb: 1, fontFamily: "Outfit, sans-serif" }}>📦 StockWhisk</Typography>
            <Typography variant="body2" sx={{ maxWidth: 340, lineHeight: 1.7 }}>
              {t("hero_subtitle")}
            </Typography>
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Typography sx={{ fontWeight: 700, color: "#fff", mb: 1.5, fontSize: ".9rem" }}>Product</Typography>
            <Stack spacing={1}>
              <Link href="/pricing" style={linkSx}>{t("nav_pricing")}</Link>
              <Link href="/tutorials" style={linkSx}>{lang === 'bn' ? "ভিডিও টিউটোরিয়াল" : "Video Tutorials"}</Link>
              <Link href="/blog" style={linkSx}>{t("nav_blog")}</Link>
              <Link href="/contact" style={linkSx}>{t("nav_contact")}</Link>
            </Stack>
          </Grid>
          <Grid size={{ xs: 6, md: 4 }}>
            <Typography sx={{ fontWeight: 700, color: "#fff", mb: 1.5, fontSize: ".9rem" }}>Get started</Typography>
            <Stack spacing={1}>
              <Link href="/register" style={linkSx}>{t("hero_btn_register")}</Link>
              <Link href="/login" style={linkSx}>{t("nav_login")}</Link>
            </Stack>
          </Grid>
        </Grid>
        <Box sx={{ mt: 5, pt: 3, borderTop: `1px solid rgba(255,255,255,.1)`, display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", alignItems: { xs: "center", sm: "flex-start" }, gap: 2 }}>
          <Typography variant="body2" sx={{ fontSize: ".85rem" }}>
            {t("footer_rights").replace("{year}", String(new Date().getFullYear()))}
          </Typography>
          <Box sx={{ display: "flex", gap: 3 }}>
            <Link href="/terms" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: ".85rem", transition: "color 0.2s" }} onMouseOver={(e) => e.currentTarget.style.color = "#fff"} onMouseOut={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}>
              {t("footer_terms")}
            </Link>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
