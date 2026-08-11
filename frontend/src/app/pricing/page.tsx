"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Box, Typography, Button, Container, Stack, Grid, Card, CardContent, Switch } from '@mui/material';
import { getAccess, api, unwrap } from "@/lib/api";
import { useThemeMode } from "@/components/ThemeRegistry";

const LIGHT_COLORS = {
  surface: '#f8f9ff',
  onSurface: '#0b1c30',
  onSurfaceVariant: '#434655',
  primary: '#004ac6',
  onPrimary: '#ffffff',
  surfaceTint: '#0053db',
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
  const { mode } = useThemeMode();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isYearly, setIsYearly] = useState(false);

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
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: COLORS.surface, color: COLORS.onSurface, fontFamily: 'Outfit, sans-serif' }}>
      
      {/* Navigation */}
      <Box sx={{ bgcolor: COLORS.surface, borderBottom: `1px solid ${COLORS.outlineVariant}`, position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
        <Container maxWidth="xl">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '64px' }}>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: COLORS.primary, fontFamily: 'Outfit, sans-serif' }}>
                StockWhisk
              </Typography>
            </Link>
            
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <Button component={Link} href="/pricing" sx={{ color: COLORS.onSurface, fontWeight: 600, textTransform: 'none' }}>
                Pricing
              </Button>
              <Button component={Link} href="/blog" sx={{ color: COLORS.onSurface, fontWeight: 600, textTransform: 'none' }}>
                Blog
              </Button>
              {mounted && isLoggedIn ? (
                <Button component={Link} href="/app" sx={{ bgcolor: COLORS.primary, color: COLORS.onPrimary, fontWeight: 600, textTransform: 'none', borderRadius: '8px', px: 3, '&:hover': { bgcolor: COLORS.surfaceTint }}}>
                  Dashboard
                </Button>
              ) : (
                <Button component={Link} href="/login" sx={{ color: COLORS.onSurfaceVariant, fontWeight: 600, textTransform: 'none', '&:hover': { color: COLORS.primary }}}>
                  Login
                </Button>
              )}
            </Stack>
          </Box>
        </Container>
      </Box>

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
              Simple, transparent pricing
            </Typography>
            <Typography variant="h6" sx={{ color: COLORS.onSurfaceVariant, maxWidth: '600px', mx: 'auto', mb: 6, fontFamily: 'Outfit, sans-serif' }}>
              Choose the perfect plan for your retail business. No hidden fees.
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <Typography sx={{ fontWeight: 600, color: !isYearly ? COLORS.onSurface : COLORS.onSurfaceVariant }}>Monthly</Typography>
              <Switch 
                checked={isYearly} 
                onChange={(e) => setIsYearly(e.target.checked)} 
                color="primary"
              />
              <Typography sx={{ fontWeight: 600, color: isYearly ? COLORS.onSurface : COLORS.onSurfaceVariant }}>
                Yearly <Typography component="span" sx={{ color: '#10b981', ml: 1, fontSize: '0.8rem', fontWeight: 700, bgcolor: 'rgba(16, 185, 129, 0.1)', px: 1, py: 0.5, borderRadius: '4px' }}>Save 20%</Typography>
              </Typography>
            </Box>
          </Box>

          {/* Pricing Grid */}
          <Grid container spacing={4} justifyContent="center" alignItems="stretch">
            {loading ? (
              <Box sx={{ py: 10, textAlign: 'center', width: '100%' }}>
                <Typography>Loading plans...</Typography>
              </Box>
            ) : (
              plans.map((plan) => {
                const isPopular = plan.tier === 'professional';
                const price = isYearly ? parseFloat(plan.price_yearly) / 12 : parseFloat(plan.price_monthly);

                return (
                  <Grid item xs={12} md={4} key={plan.id} sx={{ display: 'flex' }}>
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
                          Most Popular
                        </Box>
                      )}
                      
                      <CardContent sx={{ p: { xs: 3, md: 5 }, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, fontFamily: 'Outfit, sans-serif', color: COLORS.onSurface }}>
                          {plan.name}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 4 }}>
                          <Typography variant="h3" sx={{ fontWeight: 800, color: COLORS.onSurface, fontFamily: 'Outfit, sans-serif' }}>
                            ৳{price.toFixed(0)}
                          </Typography>
                          <Typography variant="body1" sx={{ color: COLORS.onSurfaceVariant, ml: 1, fontWeight: 500 }}>
                            /mo
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
                          Get Started
                        </Button>

                        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: '0.5px', mb: 1 }}>
                            Features Included
                          </Typography>
                          
                          {/* Hard limits */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ color: '#10b981' }}>✓</Box>
                            <Typography sx={{ color: COLORS.onSurface, fontWeight: 500 }}>
                              Up to {plan.max_users} Users
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ color: '#10b981' }}>✓</Box>
                            <Typography sx={{ color: COLORS.onSurface, fontWeight: 500 }}>
                              {plan.max_branches} {plan.max_branches > 1 ? 'Branches' : 'Branch'}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ color: '#10b981' }}>✓</Box>
                            <Typography sx={{ color: COLORS.onSurface, fontWeight: 500 }}>
                              {plan.max_products} Products Limit
                            </Typography>
                          </Box>

                          {/* Dynamic Features */}
                          {Object.entries(plan.features).map(([key, value]) => {
                            if (!value) return null;
                            return (
                              <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Box sx={{ color: '#10b981' }}>✓</Box>
                                <Typography sx={{ color: COLORS.onSurface, fontWeight: 500 }}>
                                  {FEATURE_LABELS[key] || key}
                                </Typography>
                              </Box>
                            );
                          })}
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
  );
}
