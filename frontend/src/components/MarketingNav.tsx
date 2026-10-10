"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Box, Container, Stack, Button, Typography, IconButton } from "@mui/material";
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
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsLoggedIn(!!getAccess());
  }, []);

  // Auto-close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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
    { href: "/api-docs.html", label: lang === 'bn' ? "API ডক" : "API Docs" },
    { href: "/tutorials", label: lang === 'bn' ? "ভিডিও" : "Videos" },
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
                <Box component="img" src={branding.logo} alt="StockWhisk" sx={{ height: { xs: 32, sm: 46 }, maxWidth: { xs: 140, sm: 220 }, objectFit: "contain", display: "block" }} />
              </Box>
            ) : (
              <Box sx={{ bgcolor: "#fff", borderRadius: "10px", px: 1, py: 0.5, display: "inline-flex", boxShadow: "0 1px 6px rgba(15,23,42,.12)" }}>
                <Box component="img" src="/logo.png" alt="StockWhisk" sx={{ height: { xs: 32, sm: 46 }, maxWidth: { xs: 140, sm: 220 }, objectFit: "contain", display: "block" }} />
              </Box>
            )}
          </Typography>

          {/* Desktop nav */}
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", display: { xs: "none", md: "flex" } }}>
            {navLinks.map((l) => {
              const isActive = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
              const isHtml = l.href.endsWith(".html");
              if (isHtml) {
                return (
                  <Button
                    key={l.href}
                    component="a"
                    href={l.href}
                    sx={getLinkStyle(isActive)}
                  >
                    {l.label}
                  </Button>
                );
              }
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

          {/* Mobile nav: Language + instant-response hamburger menu */}
          <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 1 }}>
            <LanguageToggle />
            <IconButton
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              sx={{
                color: M.text,
                ml: 0.5,
                width: 44,
                height: 44,
                minWidth: 44,
                minHeight: 44,
                touchAction: "manipulation",
                borderRadius: "10px",
                bgcolor: mobileOpen ? "rgba(15, 23, 42, 0.08)" : "transparent",
                "&:hover": { bgcolor: "rgba(15, 23, 42, 0.08)" },
              }}
            >
              <i className={mobileOpen ? "bi bi-x-lg" : "bi bi-list"} style={{ fontSize: "1.6rem", lineHeight: 1 }} />
            </IconButton>
          </Box>
        </Box>
      </Container>

      {/* Lightweight Instant Mobile Drawer / Popover (Zero Popper.js overhead) */}
      {mobileOpen && (
        <>
          <Box
            onClick={() => setMobileOpen(false)}
            sx={{
              position: "fixed",
              inset: 0,
              top: 66,
              zIndex: 1250,
              bgcolor: "rgba(15, 23, 42, 0.2)",
              backdropFilter: "blur(2px)",
              touchAction: "manipulation",
            }}
          />
          <Box
            sx={{
              position: "fixed",
              top: 72,
              right: 12,
              left: { xs: 12, sm: "auto" },
              width: { xs: "calc(100% - 24px)", sm: 270 },
              maxHeight: "calc(100vh - 88px)",
              overflowY: "auto",
              bgcolor: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 20px 40px -12px rgba(15, 23, 42, 0.35), 0 0 1px rgba(15, 23, 42, 0.15)",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              p: 1.25,
              zIndex: 1260,
              display: "flex",
              flexDirection: "column",
              gap: 0.5,
              animation: "mobileNavDrop 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
              "@keyframes mobileNavDrop": {
                from: { opacity: 0, transform: "translateY(-6px) scale(0.98)" },
                to: { opacity: 1, transform: "translateY(0) scale(1)" },
              },
            }}
          >
            {navLinks.map((l) => {
              const isActive = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
              const isHtml = l.href.endsWith(".html");
              const linkSx = {
                display: "flex",
                alignItems: "center",
                minHeight: 44,
                px: 2,
                py: 1,
                borderRadius: "10px",
                fontSize: "0.95rem",
                fontWeight: isActive ? 700 : 600,
                color: isActive ? M.primary : M.text,
                bgcolor: isActive ? "rgba(37, 99, 235, 0.08)" : "transparent",
                textDecoration: "none",
                touchAction: "manipulation",
                transition: "background-color 0.1s ease",
                "&:active": { bgcolor: "rgba(37, 99, 235, 0.12)" },
              };
              if (isHtml) {
                return (
                  <Box
                    key={l.href}
                    component="a"
                    href={l.href}
                    onClick={() => setMobileOpen(false)}
                    sx={linkSx}
                  >
                    {l.label}
                  </Box>
                );
              }
              return (
                <Box
                  key={l.href}
                  component={Link}
                  href={l.href}
                  prefetch={true}
                  onClick={() => setMobileOpen(false)}
                  sx={linkSx}
                >
                  {l.label}
                </Box>
              );
            })}
            <Box sx={{ my: 0.5, borderTop: "1px solid rgba(15, 23, 42, 0.08)" }} />
            {mounted && isLoggedIn ? (
              <Box
                component={Link}
                href="/app"
                prefetch={true}
                onClick={() => setMobileOpen(false)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 44,
                  px: 2,
                  borderRadius: "10px",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  bgcolor: M.primary,
                  color: M.onPrimary,
                  textDecoration: "none",
                  touchAction: "manipulation",
                }}
              >
                {t("nav_dashboard")}
              </Box>
            ) : (
              <>
                <Box
                  component={Link}
                  href="/login"
                  prefetch={true}
                  onClick={() => setMobileOpen(false)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    minHeight: 44,
                    px: 2,
                    borderRadius: "10px",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    color: M.text,
                    textDecoration: "none",
                    touchAction: "manipulation",
                    "&:active": { bgcolor: "rgba(15, 23, 42, 0.04)" },
                  }}
                >
                  {t("nav_login")}
                </Box>
                <Box
                  component={Link}
                  href="/register"
                  prefetch={true}
                  onClick={() => setMobileOpen(false)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 44,
                    px: 2,
                    borderRadius: "10px",
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    bgcolor: M.primary,
                    color: M.onPrimary,
                    textDecoration: "none",
                    touchAction: "manipulation",
                  }}
                >
                  {t("nav_signup")}
                </Box>
              </>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}
