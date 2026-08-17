"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Box, Container, Stack, Button, Typography, IconButton, Menu, MenuItem } from "@mui/material";
import { getAccess } from "@/lib/api";
import { M } from "@/lib/marketing";
import { useBranding } from "@/lib/branding";
import LanguageToggle from "./LanguageToggle";
import { useLanguage } from "@/contexts/LanguageContext";

/** Shared top navigation for the public pages (home, pricing, blog, contact, login, register). */
export default function MarketingNav() {
  const pathname = usePathname();
  const branding = useBranding();
  const { lang, t } = useLanguage();
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

  const getLinkStyle = (isActive: boolean) => ({
    color: isActive ? M.primary : M.textMuted, 
    fontWeight: isActive ? 700 : 600, 
    textTransform: "none" as const,
    borderRadius: "8px", 
    px: 1.5,
    bgcolor: isActive ? "rgba(37, 99, 235, 0.08)" : "transparent",
    "&:hover": { color: M.primary, bgcolor: "rgba(37, 99, 235, 0.08)" },
  });
  const cta = {
    bgcolor: M.primary, color: M.onPrimary, fontWeight: 700, textTransform: "none" as const,
    borderRadius: "10px", px: 3, boxShadow: "0 6px 16px -6px rgba(37,99,235,.6)",
    "&:hover": { bgcolor: M.primaryDark },
  };

  const navLinks = [
    { href: "/", label: t("nav_home") },
    { href: "/pricing", label: t("nav_pricing") },
    { href: "/demo", label: t("nav_demo") },
    { href: "/software", label: lang === 'bn' ? "সফটওয়্যার" : "Software" },
    { href: "/reseller", label: t("nav_reseller") },
    { href: "/blog", label: t("nav_blog") },
    { href: "/contact", label: t("nav_contact") },
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
            {navLinks.map((l) => {
              const isActive = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
              return (
                <Button key={l.href} component={Link} href={l.href} sx={getLinkStyle(isActive)}>
                  {l.label}
                </Button>
              );
            })}
            {mounted && isLoggedIn ? (
              <Button component={Link} href="/app" sx={cta}>{t("nav_dashboard")}</Button>
            ) : (
              <>
                <Button component={Link} href="/login"
                  sx={{ color: M.textMuted, fontWeight: 600, textTransform: "none",
                    "&:hover": { color: M.primary, bgcolor: "transparent" } }}>
                  {t("nav_login")}
                </Button>
                <Button component={Link} href="/register" sx={cta}>{t("nav_signup")}</Button>
              </>
            )}
            <LanguageToggle />
          </Stack>

          {/* Mobile nav: CTA + hamburger menu */}
          <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 1 }}>
            {mounted && isLoggedIn ? (
              <Button component={Link} href="/app" sx={{ ...cta, px: 2, fontSize: ".85rem" }}>{t("nav_dashboard")}</Button>
            ) : (
              <Button component={Link} href="/register" sx={{ ...cta, px: 2, fontSize: ".85rem" }}>{t("nav_signup")}</Button>
            )}
            <LanguageToggle />
            <IconButton onClick={openMenu} aria-label="Open menu" sx={{ color: M.text, ml: 1 }}>
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
              {navLinks.map((l) => {
                const isActive = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
                return (
                  <MenuItem key={l.href} component={Link} href={l.href} onClick={closeMenu}
                    sx={{ 
                      fontWeight: isActive ? 700 : 600, 
                      color: isActive ? M.primary : M.text, 
                      bgcolor: isActive ? "rgba(37, 99, 235, 0.05)" : "transparent",
                      py: 1.2 
                    }}>
                    {l.label}
                  </MenuItem>
                );
              })}
              {!(mounted && isLoggedIn) && (
                <MenuItem component={Link} href="/login" onClick={closeMenu}
                  sx={{ fontWeight: 600, color: M.primary, py: 1.2 }}>
                  {t("nav_login")}
                </MenuItem>
              )}
            </Menu>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
