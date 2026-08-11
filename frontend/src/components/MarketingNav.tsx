"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Box, Container, Stack, Button, Typography } from "@mui/material";
import { getAccess } from "@/lib/api";

const C = {
  surface: "#0F172A",
  primary: "#38BDF8",
  onPrimary: "#0F172A",
  text: "#E2E8F0",
  textMuted: "#94A3B8",
  border: "rgba(255,255,255,0.08)",
};

/** Shared top navigation for the public pages (home, pricing, blog, login, register). */
export default function MarketingNav() {
  const [mounted, setMounted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => {
    setMounted(true);
    setIsLoggedIn(!!getAccess());
  }, []);

  const link = { color: C.text, fontWeight: 600, textTransform: "none" as const };
  const cta = {
    bgcolor: C.primary, color: C.onPrimary, fontWeight: 700, textTransform: "none" as const,
    borderRadius: "8px", px: 3, "&:hover": { bgcolor: "#0ea5e9" },
  };

  return (
    <Box sx={{ bgcolor: C.surface, borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 1200 }}>
      <Container maxWidth="xl">
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 64 }}>
          <Typography component={Link} href="/" variant="h6"
            sx={{ fontWeight: 700, color: C.primary, textDecoration: "none", fontFamily: "Outfit, sans-serif" }}>
            StockWhisk
          </Typography>
          <Stack direction="row" spacing={{ xs: 0.5, sm: 1.5 }} sx={{ alignItems: "center" }}>
            <Button component={Link} href="/" sx={link}>Home</Button>
            <Button component={Link} href="/pricing" sx={link}>Pricing</Button>
            <Button component={Link} href="/blog" sx={link}>Blog</Button>
            {mounted && isLoggedIn ? (
              <Button component={Link} href="/app" sx={cta}>Dashboard</Button>
            ) : (
              <>
                <Button component={Link} href="/login"
                  sx={{ color: C.textMuted, fontWeight: 600, textTransform: "none",
                    display: { xs: "none", md: "inline-flex" }, "&:hover": { color: C.primary, bgcolor: "transparent" } }}>
                  Login
                </Button>
                <Button component={Link} href="/register" sx={cta}>Sign Up</Button>
              </>
            )}
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
