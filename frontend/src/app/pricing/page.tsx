"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Box, Typography, Button, Container, Stack, Grid, Card, CardContent, Switch, IconButton } from '@mui/material';
import MarketingNav from '@/components/MarketingNav';
import MarketingFooter from '@/components/MarketingFooter';
import PublicThemeProvider from '@/components/PublicThemeProvider';
import { getAccess, api, unwrap } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";

const LIGHT_COLORS = {
  surface: '#f8fafc',
  onSurface: '#0f172a',
  onSurfaceVariant: '#475569',
  primary: '#2563eb',
  onPrimary: '#ffffff',
  surfaceTint: '#1d4ed8',
  surfaceContainerLowest: '#ffffff',
  surfaceContainer: '#e5eeff',
  surfaceContainerLow: '#eff4ff',
  outlineVariant: '#c3c6d7',
  outline: '#737686',
};

const DARK_COLORS = {
  surface: '#0f172a',
  onSurface: '#f8fafc',
  onSurfaceVariant: '#cbd5e1',
  primary: '#38bdf8',
  onPrimary: '#020617',
  surfaceTint: '#7dd3fc',
  surfaceContainerLowest: '#020617',
  surfaceContainer: '#1e293b',
  surfaceContainerLow: '#0f172a',
  outlineVariant: '#334155',
  outline: '#475569',
};

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
  yearly_discount_percent?: number;
};

export default function PricingPage() {
  const { t } = useLanguage();
  const mode: string = "light";
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isYearly, setIsYearly] = useState(false);
  const [trialDays, setTrialDays] = useState(45);
  const [offer, setOffer] = useState<{ url: string; is_pdf: boolean } | null>(null);
  const [showOffer, setShowOffer] = useState(false);

  const COLORS = mounted && mode === 'dark' ? DARK_COLORS : LIGHT_COLORS;

  // Highest yearly discount across shown plans (per-package, not fixed).
  const maxSave = plans.reduce((mx, p) => Math.max(mx, Number(p.yearly_discount_percent) || 0), 0);

  useEffect(() => {
    setMounted(true);
    setIsLoggedIn(!!getAccess());
    api<any>("/platform/public/pricing/")
      .then((data) => {
        setPlans(unwrap(data));
      })
      .catch((e) => console.error("Failed to load pricing plans", e))
      .finally(() => setLoading(false));
    api<{ trial_days: number; offer: { url: string; is_pdf: boolean } | null }>("/platform/public/site-config/")
      .then((d) => {
        if (d?.trial_days != null) setTrialDays(d.trial_days);
        if (d?.offer?.url) { setOffer(d.offer); setShowOffer(true); }
      })
      .catch(() => {});
  }, []);

  return (
    <PublicThemeProvider>
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: COLORS.surface, color: COLORS.onSurface, fontFamily: 'Outfit, sans-serif' }}>
      
      {/* Navigation */}
      <MarketingNav />

      {/* Promotional offer popup */}
      {showOffer && offer && (
        <Box
          onClick={() => setShowOffer(false)}
          sx={{ position: "fixed", inset: 0, zIndex: 1400, bgcolor: "rgba(15,23,42,0.75)",
                display: "flex", alignItems: "center", justifyContent: "center", p: 2, backdropFilter: "blur(3px)" }}
        >
          {/* Close button lives on the overlay — outside the popup, so it uses no popup space */}
          <IconButton onClick={() => setShowOffer(false)} aria-label="Close"
            sx={{ position: "absolute", top: 16, right: 16, zIndex: 2, width: 44, height: 44,
                  bgcolor: "rgba(255,255,255,.95)", boxShadow: "0 2px 10px rgba(0,0,0,.35)", "&:hover": { bgcolor: "#fff" } }}>
            <span style={{ fontSize: 24, lineHeight: 1, fontWeight: 700 }}>×</span>
          </IconButton>

          {offer.is_pdf ? (
            <Box onClick={(e) => e.stopPropagation()}
              sx={{ width: "min(92vw, 800px)", height: "90vh", bgcolor: "#fff", borderRadius: 3, overflow: "hidden",
                    boxShadow: "0 40px 90px -30px rgba(0,0,0,.65)" }}>
              <iframe src={offer.url} title="Offer" style={{ width: "100%", height: "100%", border: 0 }} />
            </Box>
          ) : (
            // Popup wraps the image tightly (its natural shape) — no extra white space.
            <Box component="a" href={offer.url} target="_blank" rel="noreferrer"
              onClick={(e) => e.stopPropagation()} sx={{ display: "inline-block", lineHeight: 0 }}>
              <Box component="img" src={offer.url} alt="Special offer"
                sx={{ maxWidth: "94vw", maxHeight: "90vh", width: "auto", height: "auto", display: "block",
                      borderRadius: 3, boxShadow: "0 40px 90px -30px rgba(0,0,0,.65)" }} />
            </Box>
          )}
        </Box>
      )}

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1, py: { xs: 6, md: 10 }, px: { xs: 2, md: 0 } }}>
        <Container maxWidth="lg">
          {/* Hero Section */}
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography variant="h2" sx={{ 
              fontWeight: 900, 
              mb: 3, 
              fontFamily: 'Outfit, sans-serif',
              background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${mode === 'dark' ? '#818cf8' : '#312e81'} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontSize: { xs: '2.5rem', md: '4rem' }
            }}>
              {t("pricing_title")}
            </Typography>
            <Typography variant="h6" sx={{ color: COLORS.onSurfaceVariant, maxWidth: '600px', mx: 'auto', mb: 3, fontFamily: 'Outfit, sans-serif' }}>
              {t("pricing_subtitle")}
            </Typography>

            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 5, px: 2.5, py: 1, borderRadius: 999, bgcolor: 'rgba(16,185,129,0.1)', color: '#059669', fontWeight: 700 }}>
              {t("pricing_trial", { days: trialDays })}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <Typography sx={{ fontWeight: 600, color: !isYearly ? COLORS.onSurface : COLORS.onSurfaceVariant }}>{t("pricing_monthly")}</Typography>
              <Switch 
                checked={isYearly} 
                onChange={(e) => setIsYearly(e.target.checked)} 
                color="primary"
              />
              <Typography sx={{ fontWeight: 600, color: isYearly ? COLORS.onSurface : COLORS.onSurfaceVariant }}>
                {t("pricing_yearly")} {maxSave > 0 && <Typography component="span" sx={{ color: '#10b981', ml: 1, fontSize: '0.8rem', fontWeight: 700, bgcolor: 'rgba(16, 185, 129, 0.1)', px: 1, py: 0.5, borderRadius: '4px' }}>Save up to {maxSave}%</Typography>}
              </Typography>
            </Box>
          </Box>

          {/* Pricing Grid */}
          <Grid container spacing={4} sx={{ justifyContent: "center", alignItems: "stretch" }}>
            {loading ? (
              <Box sx={{ py: 10, textAlign: 'center', width: '100%' }}>
                <Typography>{t("pricing_loading")}</Typography>
              </Box>
            ) : (
              plans.map((plan) => {
                const isPopular = plan.tier === 'professional';
                const monthly = parseFloat(plan.price_monthly) || 0;
                // Per-package yearly discount set by the admin (0 = no discount).
                const savePct = Number(plan.yearly_discount_percent) || 0;
                const yearlyPerMonth = savePct > 0 ? monthly * (1 - savePct / 100) : monthly;
                const price = isYearly ? yearlyPerMonth : monthly;
                const yearlyBilled = Math.round(yearlyPerMonth * 12);

                return (
                  <Grid size={{ xs: 12, md: 4 }} key={plan.id} sx={{ display: 'flex' }}>
                    <Card sx={{ 
                      flexGrow: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      borderRadius: '24px', 
                      bgcolor: isPopular ? (mode === 'dark' ? 'rgba(56, 189, 248, 0.05)' : 'rgba(0, 74, 198, 0.03)') : (mode === 'dark' ? 'rgba(30, 41, 59, 0.4)' : '#ffffff'),
                      border: `1px solid ${isPopular ? COLORS.primary : COLORS.outlineVariant}`,
                      boxShadow: isPopular 
                        ? (mode === 'dark' ? '0 20px 40px -15px rgba(56,189,248,0.2)' : '0 20px 40px -15px rgba(0,74,198,0.2)') 
                        : '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                      backdropFilter: 'blur(16px)',
                      transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                      position: 'relative',
                      overflow: 'visible',
                      '&:hover': {
                        transform: 'translateY(-8px)',
                        boxShadow: isPopular 
                          ? (mode === 'dark' ? '0 25px 50px -12px rgba(56,189,248,0.3)' : '0 25px 50px -12px rgba(0,74,198,0.3)')
                          : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                      },
                      ...(isPopular && {
                        '&::after': {
                          content: '""',
                          position: 'absolute',
                          inset: 0,
                          borderRadius: '24px',
                          background: `linear-gradient(135deg, ${COLORS.primary}1A, transparent)`,
                          pointerEvents: 'none',
                        }
                      })
                    }}>
                      {isPopular && (
                        <Box sx={{
                          position: 'absolute',
                          top: '-16px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: `linear-gradient(90deg, ${COLORS.primary}, ${mode === 'dark' ? '#818cf8' : '#312e81'})`,
                          color: '#fff',
                          px: 3,
                          py: 0.75,
                          borderRadius: '20px',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          letterSpacing: '1px',
                          textTransform: 'uppercase',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                        }}>
                          {t("pricing_most_popular")}
                        </Box>
                      )}
                      
                      <CardContent sx={{ p: { xs: 3, md: 5 }, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, fontFamily: 'Outfit, sans-serif', color: COLORS.onSurface }}>
                          {plan.name}
                        </Typography>
                        <Box sx={{ mb: 4 }}>
                          <Box sx={{ display: 'flex', alignItems: 'baseline' }}>
                            <Typography variant="h3" sx={{ fontWeight: 800, color: COLORS.onSurface, fontFamily: 'Outfit, sans-serif' }}>
                              ৳{price.toFixed(0)}
                            </Typography>
                            <Typography variant="body1" sx={{ color: COLORS.onSurfaceVariant, ml: 1, fontWeight: 500 }}>
                              /mo
                            </Typography>
                          </Box>
                          <Typography sx={{ fontSize: '0.85rem', color: COLORS.onSurfaceVariant, mt: 0.5, minHeight: '1.2rem' }}>
                            {isYearly
                              ? <>Billed ৳{yearlyBilled.toLocaleString()}/year{savePct > 0 && <> · <span style={{ color: '#059669', fontWeight: 700 }}>save {savePct}%</span></>} · {trialDays}-day free trial</>
                              : <>Billed monthly · {trialDays}-day free trial</>}
                          </Typography>
                        </Box>

                        <Button
                          component={Link}
                          href="/register"
                          fullWidth
                          sx={{
                            py: 1.5,
                            mb: 4,
                            borderRadius: '12px',
                            fontWeight: 700,
                            textTransform: 'none',
                            fontSize: '1rem',
                            bgcolor: COLORS.primary,
                            color: COLORS.onPrimary,
                            border: `2px solid ${COLORS.primary}`,
                            boxShadow: '0 8px 20px -8px rgba(37,99,235,.6)',
                            '&:hover': {
                              bgcolor: COLORS.surfaceTint,
                            }
                          }}
                        >
                          {t("pricing_get_started")}
                        </Button>

                        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: '0.5px', mb: 1 }}>
                            {t("pricing_features_included")}
                          </Typography>

                          {(plan.highlights && plan.highlights.length > 0
                            ? plan.highlights
                            : [
                                ...(plan.show_users !== false ? [t("pricing_users", { max_users: plan.max_users })] : []),
                                ...(plan.show_branches !== false ? [t("pricing_branches", { max_branches: plan.max_branches })] : []),
                                ...(plan.show_products !== false ? [t("pricing_products", { max_products: plan.max_products })] : []),
                                ...Object.entries(plan.features).filter(([, v]) => v).map(([k]) => t(`feat_${k}`)),
                              ]
                          ).map((line, i) => (
                            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Box sx={{ color: '#10b981' }}>✓</Box>
                              <Typography sx={{ color: COLORS.onSurface, fontWeight: 500 }}>{line}</Typography>
                            </Box>
                          ))}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })
            )}
          </Grid>

          {/* ── FAQ Section ── */}
          <Box sx={{ mt: { xs: 8, md: 12 }, pt: { xs: 6, md: 8 }, borderTop: `1px solid ${COLORS.outlineVariant}` }}>
            <Container maxWidth="md">
              <Box sx={{ textAlign: "center", mb: { xs: 5, md: 7 } }}>
                <Typography component="h2" sx={{ fontWeight: 800, letterSpacing: "-0.02em", fontSize: { xs: "1.9rem", md: "2.6rem" } }}>
                  {t("faq_title")}
                </Typography>
              </Box>
              <Box>
                {/* Note: In a real implementation we would map through an array, but we'll hardcode some for now */}
                <Box sx={{ mb: 2, p: 3, bgcolor: mode === 'dark' ? 'rgba(255,255,255,0.02)' : '#fff', border: `1px solid ${COLORS.outlineVariant}`, borderRadius: '16px' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: "1.05rem", mb: 1 }}>How does the 45-day trial work?</Typography>
                  <Typography sx={{ color: COLORS.onSurfaceVariant }}>You get full access to all features for 45 days. No credit card is required. You can upgrade to a paid plan at any time during or after the trial.</Typography>
                </Box>
                <Box sx={{ mb: 2, p: 3, bgcolor: mode === 'dark' ? 'rgba(255,255,255,0.02)' : '#fff', border: `1px solid ${COLORS.outlineVariant}`, borderRadius: '16px' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: "1.05rem", mb: 1 }}>Can I change my plan later?</Typography>
                  <Typography sx={{ color: COLORS.onSurfaceVariant }}>Yes, you can upgrade or downgrade your plan at any time from your billing dashboard. Changes are prorated automatically.</Typography>
                </Box>
                <Box sx={{ p: 3, bgcolor: mode === 'dark' ? 'rgba(255,255,255,0.02)' : '#fff', border: `1px solid ${COLORS.outlineVariant}`, borderRadius: '16px' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: "1.05rem", mb: 1 }}>What counts as a "product"?</Typography>
                  <Typography sx={{ color: COLORS.onSurfaceVariant }}>A product is a unique item in your inventory (SKU). Variations (like sizes or colors) may count as separate products depending on how you configure them.</Typography>
                </Box>
              </Box>
            </Container>
          </Box>
        </Container>
      </Box>

      <MarketingFooter />
    </Box>
    </PublicThemeProvider>
  );
}
