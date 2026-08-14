"use client";

import Link from "next/link";
import { Box, Container, Typography, Button, Grid, Card, CardContent } from "@mui/material";
import PublicThemeProvider from "@/components/PublicThemeProvider";
import { M } from "@/lib/marketing";

export default function ResellerPublicPage() {
  const features = [
    { icon: "📝", title: "Register", body: "Sign up as a partner. Your account is reviewed and approved by our team." },
    { icon: "🔗", title: "Share your code", body: "Get a unique referral code & link. Shops that sign up with it are attributed to you." },
    { icon: "💰", title: "Earn monthly", body: "Receive a fixed % of each connected shop’s monthly gross profit — tracked in your dashboard." },
  ];

  return (
    <PublicThemeProvider>
      <Box sx={{ minHeight: "100vh", bgcolor: M.surface, color: M.text, fontFamily: "Outfit, sans-serif" }}>
        {/* Custom Header for Reseller Page */}
        <Box sx={{ borderBottom: `1px solid ${M.border}`, bgcolor: "rgba(255,255,255,0.8)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 1000 }}>
          <Container maxWidth="lg">
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 70 }}>
              <Typography component={Link} href="/" sx={{ fontWeight: 800, color: M.text, textDecoration: "none", fontSize: "1.25rem", display: "flex", alignItems: "center", gap: 1 }}>
                <Box component="span" sx={{
                  width: 28, height: 28, borderRadius: "6px", display: "inline-flex",
                  alignItems: "center", justifyContent: "center", fontSize: 14,
                  background: `linear-gradient(135deg, ${M.accent}, ${M.primaryDark})`,
                }}>📦</Box>
                StockWhisk <span style={{ color: M.textMuted, fontWeight: 500 }}>Partners</span>
              </Typography>
              <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                <Button component={Link} href="/reseller/login" sx={{ color: M.textMuted, fontWeight: 600, textTransform: "none", "&:hover": { color: M.primary, bgcolor: M.surfaceTint } }}>
                  Login
                </Button>
                <Button component={Link} href="/reseller/register" sx={{
                  bgcolor: M.primary, color: M.onPrimary, fontWeight: 700, textTransform: "none", borderRadius: "10px", px: 3,
                  boxShadow: "0 4px 12px rgba(37,99,235,.4)", "&:hover": { bgcolor: M.primaryDark }
                }}>
                  Become a reseller
                </Button>
              </Box>
            </Box>
          </Container>
        </Box>

        {/* Hero Section */}
        <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
          <Box sx={{ textAlign: "center", maxWidth: 760, mx: "auto", mb: { xs: 6, md: 8 } }}>
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, px: 2, py: 0.75, borderRadius: "20px", bgcolor: "rgba(37,99,235,0.08)", color: M.primary, fontWeight: 700, fontSize: "0.85rem", mb: 3, border: `1px solid rgba(37,99,235,0.2)` }}>
              🤝 StockWhisk Partner Program
            </Box>
            <Typography component="h1" sx={{ fontWeight: 800, fontSize: { xs: "2.5rem", md: "3.5rem" }, letterSpacing: "-0.03em", mb: 3, lineHeight: 1.1 }}>
              Grow with StockWhisk — <br />
              <span style={{ color: M.primary }}>earn a share of the profit</span>
            </Typography>
            <Typography sx={{ fontSize: { xs: "1.1rem", md: "1.25rem" }, color: M.textMuted, mb: 5, lineHeight: 1.6 }}>
              Refer retail shops with your unique code and earn a fixed percentage of the profit they generate — every month, transparently.
            </Typography>
            <Button component={Link} href="/reseller/register" sx={{
              bgcolor: M.primary, color: M.onPrimary, fontWeight: 700, textTransform: "none", borderRadius: "12px", px: 5, py: 1.8, fontSize: "1.1rem",
              boxShadow: "0 10px 24px -8px rgba(37,99,235,.65)", "&:hover": { bgcolor: M.primaryDark, transform: "translateY(-2px)" }, transition: "all 0.2s ease"
            }}>
              Become a Reseller →
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
    </PublicThemeProvider>
  );
}
