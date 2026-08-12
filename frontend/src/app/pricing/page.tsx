"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Box, Typography, Button, Container, Stack, Grid, Card, CardContent, Switch, IconButton } from '@mui/material';
import MarketingNav from '@/components/MarketingNav';
import PublicThemeProvider from '@/components/PublicThemeProvider';
import { getAccess, api, unwrap } from "@/lib/api";
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
};

type PricingContent = {
  hero_title: string;
  hero_subtitle: string;
  trial_badge: string;
  yearly_save_label: string;
  features_heading: string;
  cta_label: string;
  popular_badge: string;
};

const DEFAULT_CONTENT: PricingContent = {
  hero_title: "Simple, transparent pricing",
  hero_subtitle: "Choose the perfect plan for your retail business. No hidden fees.",
  trial_badge: "🎉 Start with a {days}-day free trial — no card required",
  yearly_save_label: "Save 20%",
  features_heading: "Features Included",
  cta_label: "Get Started",
  popular_badge: "Most Popular",
};

// Known features to map
const FEATURE_LABELS: Record<string, string> = {
  "pos": "Point of Sale (POS)",
  "basic_analytics": "Basic Analytics",
  "advanced_analytics": "Advanced Analytics",
  "reports_export": "Export Reports",
  "multi_branch": "Multiple Branches",
  "api_access": "API Access",
};

export default function PricingPage() {
  const mode: string = "light";
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isYearly, setIsYearly] = useState(false);
  const [trialDays, setTrialDays] = useState(45);
  const [offer, setOffer] = useState<{ url: string; is_pdf: boolean } | null>(null);
  const [showOffer, setShowOffer] = useState(false);
  const [content, setContent] = useState<PricingContent>(DEFAULT_CONTENT);

  const COLORS = mounted && mode === 'dark' ? DARK_COLORS : LIGHT_COLORS;

  useEffect(() => {
    setMounted(true);
    setIsLoggedIn(!!getAccess());
    api<any>("/platform/public/pricing/")
      .then((data) => {
        setPlans(unwrap(data));
      })
      .catch((e) => console.error("Failed to load pricing plans", e))
      .finally(() => setLoading(false));
    api<{ trial_days: number; offer: { url: string; is_pdf: boolean } | null; pricing_content: PricingContent }>("/platform/public/site-config/")
      .then((d) => {
        if (d?.trial_days != null) setTrialDays(d.trial_days);
        if (d?.offer?.url) { setOffer(d.offer); setShowOffer(true); }
        if (d?.pricing_content) setContent({ ...DEFAULT_CONTENT, ...d.pricing_content });
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
              {content.hero_title}
            </Typography>
            <Typography variant="h6" sx={{ color: COLORS.onSurfaceVariant, maxWidth: '600px', mx: 'auto', mb: 3, fontFamily: 'Outfit, sans-serif' }}>
              {content.hero_subtitle}
            </Typography>

            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 5, px: 2.5, py: 1, borderRadius: 999, bgcolor: 'rgba(16,185,129,0.1)', color: '#059669', fontWeight: 700 }}>
              {content.trial_badge.replace('{days}', String(trialDays))}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <Typography sx={{ fontWeight: 600, color: !isYearly ? COLORS.onSurface : COLORS.onSurfaceVariant }}>Monthly</Typography>
              <Switch 
                checked={isYearly} 
                onChange={(e) => setIsYearly(e.target.checked)} 
                color="primary"
              />
              <Typography sx={{ fontWeight: 600, color: isYearly ? COLORS.onSurface : COLORS.onSurfaceVariant }}>
                Yearly <Typography component="span" sx={{ color: '#10b981', ml: 1, fontSize: '0.8rem', fontWeight: 700, bgcolor: 'rgba(16, 185, 129, 0.1)', px: 1, py: 0.5, borderRadius: '4px' }}>{content.yearly_save_label}</Typography>
              </Typography>
            </Box>
          </Box>

          {/* Pricing Grid */}
          <Grid container spacing={4} sx={{ justifyContent: "center", alignItems: "stretch" }}>
            {loading ? (
              <Box sx={{ py: 10, textAlign: 'center', width: '100%' }}>
                <Typography>Loading plans...</Typography>
              </Box>
            ) : (
              plans.map((plan) => {
                const isPopular = plan.tier === 'professional';
                const monthly = parseFloat(plan.price_monthly) || 0;
                const yearlyTotal = parseFloat(plan.price_yearly) || 0;
                // Use the admin's yearly price if it's an actual discount; otherwise
                // fall back to 20% off monthly so the toggle always shows a saving.
                const hasRealYearly = yearlyTotal > 0 && yearlyTotal < monthly * 12;
                const yearlyPerMonth = hasRealYearly ? yearlyTotal / 12 : monthly * 0.8;
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
                      }
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
                          {content.popular_badge}
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
                              ? <>Billed ৳{yearlyBilled.toLocaleString()}/year · <span style={{ color: '#059669', fontWeight: 700 }}>save 20%</span></>
                              : <>Billed monthly · {trialDays}-day free trial</>}
                          </Typography>
                        </Box>

                        <Button 
                          component={Link} 
                          href="/signup" 
                          fullWidth
                          sx={{ 
                            py: 1.5, 
                            mb: 4,
                            borderRadius: '12px',
                            fontWeight: 700,
                            textTransform: 'none',
                            fontSize: '1rem',
                            bgcolor: isPopular ? COLORS.primary : 'transparent',
                            color: isPopular ? COLORS.onPrimary : COLORS.primary,
                            border: `2px solid ${COLORS.primary}`,
                            '&:hover': {
                              bgcolor: isPopular ? COLORS.surfaceTint : 'rgba(0, 74, 198, 0.05)',
                            }
                          }}
                        >
                          {content.cta_label}
                        </Button>

                        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: '0.5px', mb: 1 }}>
                            {content.features_heading}
                          </Typography>

                          {(plan.highlights && plan.highlights.length > 0
                            ? plan.highlights
                            : [
                                ...(plan.show_users !== false ? [`Up to ${plan.max_users} Users`] : []),
                                ...(plan.show_branches !== false ? [`${plan.max_branches} ${plan.max_branches > 1 ? 'Branches' : 'Branch'}`] : []),
                                ...(plan.show_products !== false ? [`${plan.max_products} Products Limit`] : []),
                                ...Object.entries(plan.features).filter(([, v]) => v).map(([k]) => FEATURE_LABELS[k] || k),
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
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ bgcolor: mode === 'dark' ? '#020617' : '#0b1c30', color: '#94a3b8', py: 4, mt: 'auto' }}>
        <Container maxWidth="xl">
          <Typography variant="body2" align="center" sx={{ fontFamily: 'Outfit, sans-serif' }}>
            © {new Date().getFullYear()} StockWhisk. All rights reserved.
          </Typography>
        </Container>
      </Box>
    </Box>
    </PublicThemeProvider>
  );
}
