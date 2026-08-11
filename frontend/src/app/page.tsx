"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Box, Typography, Button, Container, Stack } from '@mui/material';
import { getAccess } from "@/lib/api";
import { useThemeMode } from "@/components/ThemeRegistry";
import MarketingNav from "@/components/MarketingNav";

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
  secondary: '#565e74',
  inverseSurface: '#213145',
  inverseOnSurface: '#eaf1ff',
  secondaryFixedDim: '#bec6e0'
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
  secondary: '#94a3b8',
  inverseSurface: '#f1f5f9',
  inverseOnSurface: '#0f172a',
  secondaryFixedDim: '#475569'
};

export default function LandingPage() {
  const router = useRouter();
  const { mode } = useThemeMode();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);

  const COLORS = mounted && mode === 'dark' ? DARK_COLORS : LIGHT_COLORS;

  useEffect(() => {
    setMounted(true);
    setIsLoggedIn(!!getAccess());
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: COLORS.surface, color: COLORS.onSurface, fontFamily: 'Outfit, sans-serif' }}>
      
      {/* Navigation */}
      <MarketingNav />

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
            
            <Stack direction="row" spacing={2} sx={{ justifyContent: 'center', mb: 8 }}>
              <Button 
                component={Link}
                href="/register"
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
                Register Now
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
            <Stack direction="row" sx={{ flexWrap: 'wrap', justifyContent: 'center', gap: { xs: 4, md: 8 } }}>
              {[
                { icon: 'bi-box-seam', label: 'Inventory' },
                { icon: 'bi-shop', label: 'POS' },
                { icon: 'bi-graph-up', label: 'Sales' },
                { icon: 'bi-people', label: 'Customers' },
                { icon: 'bi-pie-chart', label: 'Reports' },
              ].map((item) => (
                <Stack key={item.label} spacing={1} sx={{ alignItems: 'center', color: COLORS.secondary }}>
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
              href="/register"
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
              Sign Up Today
            </Button>
          </Container>
        </Box>
      </Box>

      {/* Footer */}
      <Box component="footer" sx={{ bgcolor: COLORS.surfaceContainerLowest, borderTop: `1px solid ${COLORS.outlineVariant}`, mt: 'auto', py: 6 }}>
        <Container maxWidth="xl">
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 45%' } }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: COLORS.primary, mb: 1, fontFamily: 'Outfit, sans-serif' }}>
                StockWhisk
              </Typography>
              <Typography variant="body2" sx={{ color: COLORS.onSurfaceVariant, fontFamily: 'Outfit, sans-serif' }}>
                © {new Date().getFullYear()} StockWhisk Inc. All rights reserved.
              </Typography>
            </Box>
            <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 45%' }, display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: { xs: 4, md: 8 } }}>
              <Stack spacing={1}>
                <Typography sx={{ fontWeight: 700, color: COLORS.onSurface, fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem' }}>Product</Typography>
                <Link href="/blog" style={{ color: COLORS.onSurfaceVariant, textDecoration: 'none', fontSize: '0.875rem' }}>Blog</Link>
                <Link href="/login" style={{ color: COLORS.onSurfaceVariant, textDecoration: 'none', fontSize: '0.875rem' }}>Login</Link>
                <Link href="/register" style={{ color: COLORS.onSurfaceVariant, textDecoration: 'none', fontSize: '0.875rem' }}>Sign Up</Link>
              </Stack>
              <Stack spacing={1}>
                <Typography sx={{ fontWeight: 700, color: COLORS.onSurface, fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem' }}>Legal</Typography>
                <span style={{ color: COLORS.onSurfaceVariant, fontSize: '0.875rem', cursor: 'pointer' }}>Privacy</span>
                <span style={{ color: COLORS.onSurfaceVariant, fontSize: '0.875rem', cursor: 'pointer' }}>Terms</span>
              </Stack>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
