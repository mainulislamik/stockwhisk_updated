"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Box, Container, Stack, Button, Typography } from "@mui/material";
import { getAccess } from "@/lib/api";
import { M } from "@/lib/marketing";

/** Shared top navigation for the public pages (home, pricing, blog, contact, login, register). */
export default function MarketingNav() {
  const [mounted, setMounted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => {
    setMounted(true);
    setIsLoggedIn(!!getAccess());
  }, []);

  const link = {
    color: M.textMuted, fontWeight: 600, textTransform: "none" as const,
    borderRadius: "8px", px: { xs: 1, sm: 1.5 },
    "&:hover": { color: M.primary, bgcolor: M.surfaceTint },
  };
  const cta = {
    bgcolor: M.primary, color: M.onPrimary, fontWeight: 700, textTransform: "none" as const,
    borderRadius: "10px", px: 3, boxShadow: "0 6px 16px -6px rgba(37,99,235,.6)",
    "&:hover": { bgcolor: M.primaryDark },
  };

  return (
    <Box
      sx={{
        bgcolor: "rgba(248,250,252,0.8)",
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${M.border}`,
        position: "sticky", top: 0, zIndex: 1200,
      }}
    >
      <Container maxWidth="xl">
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 66 }}>
          <Typography component={Link} href="/" variant="h6"
            sx={{ fontWeight: 800, color: M.text, textDecoration: "none", fontFamily: "Outfit, sans-serif",
                  display: "flex", alignItems: "center", gap: 1, letterSpacing: "-0.02em" }}>
            <Box component="span" sx={{
              width: 30, height: 30, borderRadius: "8px", display: "inline-flex",
              alignItems: "center", justifyContent: "center", fontSize: 16,
              background: `linear-gradient(135deg, ${M.accent}, ${M.primaryDark})`,
            }}>📦</Box>
            StockWhisk
          </Typography>
          <Stack direction="row" spacing={{ xs: 0.25, sm: 1 }} sx={{ alignItems: "center" }}>
            <Button component={Link} href="/" sx={{ ...link, display: { xs: "none", sm: "inline-flex" } }}>Home</Button>
            <Button component={Link} href="/pricing" sx={link}>Pricing</Button>
            <Button component={Link} href="/blog" sx={{ ...link, display: { xs: "none", sm: "inline-flex" } }}>Blog</Button>
            <Button component={Link} href="/contact" sx={link}>Contact</Button>
            {mounted && isLoggedIn ? (
              <Button component={Link} href="/app" sx={cta}>Dashboard</Button>
            ) : (
              <>
                <Button component={Link} href="/login"
                  sx={{ color: M.textMuted, fontWeight: 600, textTransform: "none",
                    display: { xs: "none", md: "inline-flex" }, "&:hover": { color: M.primary, bgcolor: "transparent" } }}>
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
