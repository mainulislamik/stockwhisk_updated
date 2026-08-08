"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Box, Typography, Button, Container, Stack, Grid } from '@mui/material';
import { getAccess } from "@/lib/api";

const COLORS = {
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
  secondary: '#565e74',
  inverseSurface: '#213145',
  inverseOnSurface: '#eaf1ff',
  secondaryFixedDim: '#bec6e0'
};

export default function LandingPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsLoggedIn(!!getAccess());
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: COLORS.surface, color: COLORS.onSurface, fontFamily: 'Outfit, sans-serif' }}>
      
      {/* Navigation */}
      <Box sx={{ 
        bgcolor: COLORS.surface, 
        borderBottom: `1px solid ${COLORS.outlineVariant}`, 
        position: 'sticky', 
        top: 0, 
        zIndex: 50, 
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' 
      }}>
        <Container maxWidth="xl">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '64px' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: COLORS.primary, fontFamily: 'Outfit, sans-serif' }}>
              StockWhisk
            </Typography>
            
            <Stack direction="row" spacing={2} alignItems="center">
              {mounted && isLoggedIn ? (
                <Button 
                  component={Link} 
                  href="/app" 
                  sx={{ 
                    bgcolor: COLORS.primary, 
                    color: COLORS.onPrimary, 
                    fontWeight: 600, 
                    textTransform: 'none',
                    borderRadius: '8px',
                    px: 3,
                    '&:hover': { bgcolor: COLORS.surfaceTint }
                  }}
                >
                  Dashboard
                </Button>
              ) : (
                <>
                  <Button 
                    component={Link} 
                    href="/login" 
                    sx={{ 
                      color: COLORS.onSurfaceVariant, 
                      fontWeight: 600, 
                      textTransform: 'none',
                      px: 2,
                      display: { xs: 'none', md: 'inline-flex' },
                      '&:hover': { color: COLORS.primary, bgcolor: 'transparent' }
                    }}
                  >
                    Login
                  </Button>
                  <Button 
                    component={Link} 
                    href="/login" 
                    sx={{ 
                      bgcolor: COLORS.primary, 
                      color: COLORS.onPrimary, 
                      fontWeight: 600, 
                      textTransform: 'none',
                      borderRadius: '8px',
                      px: 3,
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                      '&:hover': { bgcolor: COLORS.surfaceTint }
                    }}
                  >
                    Get Started
                  </Button>
                </>
              )}
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* Main Content Canvas */}
      <Box component="main" sx={{ flexGrow: 1 }}>
        
        {/* Hero Section */}
        <Box sx={{ py: { xs: 8, md: 12 }, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Container maxWidth="lg">
            <Typography variant="h2" sx={{ 
              fontWeight: 700, 
              color: COLORS.onSurface, 
              mb: 3, 
              maxWidth: '900px', 
              mx: 'auto',
              fontFamily: 'Outfit, sans-serif',
              fontSize: { xs: '2.2rem', md: '3.5rem' },
              lineHeight: 1.2,
              letterSpacing: '-0.02em'
            }}>
              Run Your Shop Smarter with StockWhisk
            </Typography>
            <Typography variant="h6" sx={{ 
              color: COLORS.onSurfaceVariant, 
              mb: 5, 
              maxWidth: '700px', 
              mx: 'auto',
              fontWeight: 400, 
              fontFamily: 'Outfit, sans-serif',
              lineHeight: 1.6
            }}>
              The modern retail dashboard built for clarity, speed, and precision. Manage inventory, track sales, and grow your business without the cognitive load.
            </Typography>
            
            <Stack direction="row" spacing={2} justifyContent="center" sx={{ mb: 8 }}>
              <Button 
                component={Link}
                href="/login"
                sx={{ 
                  bgcolor: COLORS.primary, 
                  color: COLORS.onPrimary, 
                  fontWeight: 600, 
                  textTransform: 'none',
                  borderRadius: '8px',
                  px: 4,
                  py: 1.5,
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                  '&:hover': { bgcolor: COLORS.surfaceTint }
                }}
              >
                Start Free Trial
              </Button>
              <Button 
                variant="outlined"
                component={Link}
                href="/login"
                sx={{ 
                  bgcolor: COLORS.surfaceContainerLowest, 
                  color: COLORS.onSurface, 
                  borderColor: COLORS.outline,
                  fontWeight: 600, 
                  textTransform: 'none',
                  borderRadius: '8px',
                  px: 4,
                  py: 1.5,
                  '&:hover': { bgcolor: COLORS.surfaceContainerLow, borderColor: COLORS.outline }
                }}
              >
                View Demo
              </Button>
            </Stack>

            <Box sx={{ 
              width: '100%', 
              maxWidth: '1000px', 
              mx: 'auto',
              borderRadius: '16px', 
              border: `1px solid ${COLORS.outlineVariant}`,
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              bgcolor: COLORS.surfaceContainerLowest,
              overflow: 'hidden',
              p: 2
            }}>
              <img 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAzW48uV3r9MWwBqJgAj-m2e4b-mqOQeLGhp8qAU8ShWp3_GLXapYYsvWl4tPUdyr5QuBSlsvMjKrg1qZl4_BfW-JNc5Z1_LbfPIzpAkH6ubNjGAnULLL6YIulypogv6btGeL7w4Sy7hkOcYKjuNoDNhw8Y2oN46JA4Chx9k3yFBYsuAWNQZlaiKrUcg4Ff_sCEAYCIRQdIYnalKDez1C4548B2VwmVorZKLSO-rcCO2TOnLczVNbVU" 
                alt="StockWhisk Dashboard Mockup" 
                style={{ width: '100%', height: 'auto', borderRadius: '8px', objectFit: 'cover' }}
              />
            </Box>
          </Container>
        </Box>

        {/* Trust Strip */}
        <Box sx={{ bgcolor: COLORS.surfaceContainer, py: 6, borderTop: `1px solid ${COLORS.outlineVariant}`, borderBottom: `1px solid ${COLORS.outlineVariant}` }}>
          <Container maxWidth="lg">
            <Stack direction="row" flexWrap="wrap" justifyContent="center" gap={{ xs: 4, md: 8 }}>
              {[
                { icon: 'bi-box-seam', label: 'Inventory' },
                { icon: 'bi-shop', label: 'POS' },
                { icon: 'bi-graph-up', label: 'Sales' },
                { icon: 'bi-people', label: 'Customers' },
                { icon: 'bi-pie-chart', label: 'Reports' },
              ].map((item) => (
                <Stack key={item.label} alignItems="center" spacing={1} sx={{ color: COLORS.secondary }}>
                  <i className={`bi ${item.icon}`} style={{ fontSize: '2rem' }}></i>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', fontFamily: 'Outfit, sans-serif' }}>{item.label}</Typography>
                </Stack>
              ))}
            </Stack>
          </Container>
        </Box>

        {/* Final CTA */}
        <Box sx={{ py: 10, bgcolor: COLORS.inverseSurface, color: COLORS.inverseOnSurface, textAlign: 'center' }}>
          <Container maxWidth="md">
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 3, fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.01em' }}>
              Ready to Take Control of Your Shop?
            </Typography>
            <Typography variant="h6" sx={{ color: COLORS.secondaryFixedDim, mb: 5, fontWeight: 400, fontFamily: 'Outfit, sans-serif' }}>
              Join thousands of modern retail owners who trust StockWhisk for high-velocity utility and absolute clarity.
            </Typography>
            <Button 
              component={Link}
              href="/login"
              sx={{ 
                bgcolor: COLORS.primary, 
                color: COLORS.onPrimary, 
                fontWeight: 600, 
                textTransform: 'none',
                borderRadius: '8px',
                px: 5,
                py: 1.5,
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                '&:hover': { bgcolor: COLORS.surfaceTint }
              }}
            >
              Create Your Shop Today
            </Button>
          </Container>
        </Box>
      </Box>

      {/* Footer */}
      <Box component="footer" sx={{ bgcolor: COLORS.surfaceContainerLowest, borderTop: `1px solid ${COLORS.outlineVariant}`, mt: 'auto', py: 6 }}>
        <Container maxWidth="xl">
          <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: COLORS.primary, mb: 1, fontFamily: 'Outfit, sans-serif' }}>
                StockWhisk
              </Typography>
              <Typography variant="body2" sx={{ color: COLORS.onSurfaceVariant, fontFamily: 'Outfit, sans-serif' }}>
                © {new Date().getFullYear()} StockWhisk Inc. All rights reserved.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: { xs: 4, md: 8 } }}>
              <Stack spacing={1}>
                <Typography sx={{ fontWeight: 700, color: COLORS.onSurface, fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem' }}>Product</Typography>
                <Link href="/login" style={{ color: COLORS.onSurfaceVariant, textDecoration: 'none', fontSize: '0.875rem' }}>Login</Link>
                <Link href="/login" style={{ color: COLORS.onSurfaceVariant, textDecoration: 'none', fontSize: '0.875rem' }}>Get Started</Link>
              </Stack>
              <Stack spacing={1}>
                <Typography sx={{ fontWeight: 700, color: COLORS.onSurface, fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem' }}>Legal</Typography>
                <span style={{ color: COLORS.onSurfaceVariant, fontSize: '0.875rem', cursor: 'pointer' }}>Privacy</span>
                <span style={{ color: COLORS.onSurfaceVariant, fontSize: '0.875rem', cursor: 'pointer' }}>Terms</span>
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </Box>
  );
}
