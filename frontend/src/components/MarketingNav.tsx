"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Box, Container, Stack, Button, Typography, IconButton, Menu, MenuItem } from "@mui/material";
import { getAccess } from "@/lib/api";
import { M } from "@/lib/marketing";
import { useBranding } from "@/lib/branding";

/** Shared top navigation for the public pages (home, pricing, blog, contact, login, register). */
export default function MarketingNav() {
  const branding = useBranding();
  const [mounted, setMounted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);
  const openMenu = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const closeMenu = () => setAnchorEl(null);

  useEffect(() => {
    setMounted(true);
    setIsLoggedIn(!!getAccess());
  }, []);

  const link = {
    color: M.textMuted, fontWeight: 600, textTransform: "none" as const,
    borderRadius: "8px", px: 1.5,
    "&:hover": { color: M.primary, bgcolor: M.surfaceTint },
  };
  const cta = {
    bgcolor: M.primary, color: M.onPrimary, fontWeight: 700, textTransform: "none" as const,
    borderRadius: "10px", px: 3, boxShadow: "0 6px 16px -6px rgba(37,99,235,.6)",
    "&:hover": { bgcolor: M.primaryDark },
  };

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/pricing", label: "Pricing" },
    { href: "/demo", label: "Live Demo" },
    { href: "/reseller", label: "Reseller" },
    { href: "/blog", label: "Blog" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <Box
      sx={{
        bgcolor: "rgba(248,250,252,0.85)",
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
            {branding.logo ? (
              <Box sx={{ bgcolor: "#fff", borderRadius: "10px", px: 1, py: 0.5, display: "inline-flex", boxShadow: "0 1px 6px rgba(15,23,42,.12)" }}>
                <Box component="img" src={branding.logo} alt="Logo" sx={{ height: 46, maxWidth: 220, objectFit: "contain", display: "block" }} />
              </Box>
            ) : (
              <>
                <Box component="span" sx={{
                  width: 30, height: 30, borderRadius: "8px", display: "inline-flex",
                  alignItems: "center", justifyContent: "center", fontSize: 16,
                  background: `linear-gradient(135deg, ${M.accent}, ${M.primaryDark})`,
                }}>📦</Box>
                StockWhisk
              </>
            )}
          </Typography>

          {/* Desktop nav */}
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", display: { xs: "none", md: "flex" } }}>
            {navLinks.map((l) => (
              <Button key={l.href} component={Link} href={l.href} sx={link}>{l.label}</Button>
            ))}
            {mounted && isLoggedIn ? (
              <Button component={Link} href="/app" sx={cta}>Dashboard</Button>
            ) : (
              <>
                <Button component={Link} href="/login"
                  sx={{ color: M.textMuted, fontWeight: 600, textTransform: "none",
                    "&:hover": { color: M.primary, bgcolor: "transparent" } }}>
                  Login
                </Button>
                <Button component={Link} href="/register" sx={cta}>Sign Up</Button>
              </>
            )}
          </Stack>

          {/* Mobile nav: CTA + hamburger menu */}
          <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 1 }}>
            {mounted && isLoggedIn ? (
              <Button component={Link} href="/app" sx={{ ...cta, px: 2, fontSize: ".85rem" }}>Dashboard</Button>
            ) : (
              <Button component={Link} href="/register" sx={{ ...cta, px: 2, fontSize: ".85rem" }}>Sign Up</Button>
            )}
            <IconButton onClick={openMenu} aria-label="Open menu" sx={{ color: M.text }}>
              <i className="bi bi-list" style={{ fontSize: "1.6rem", lineHeight: 1 }} />
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={menuOpen}
              onClose={closeMenu}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
              slotProps={{ paper: { sx: { mt: 1, minWidth: 180, borderRadius: 3, boxShadow: "0 12px 32px -12px rgba(15,23,42,.3)" } } }}
            >
              {navLinks.map((l) => (
                <MenuItem key={l.href} component={Link} href={l.href} onClick={closeMenu}
                  sx={{ fontWeight: 600, color: M.text, py: 1.2 }}>
                  {l.label}
                </MenuItem>
              ))}
              {!(mounted && isLoggedIn) && (
                <MenuItem component={Link} href="/login" onClick={closeMenu}
                  sx={{ fontWeight: 600, color: M.primary, py: 1.2 }}>
                  Login
                </MenuItem>
              )}
            </Menu>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
