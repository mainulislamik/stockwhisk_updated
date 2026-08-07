"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Box, Typography, Button, Container, Stack, Grid, Chip } from '@mui/material';
import { getAccess } from "@/lib/api";

const COLORS = {
  darkBg: '#1b3b4d',
  pillBg: '#274a60',
  textLight: '#9cb4c4',
  btnBg: '#e6d5c3',
  btnText: '#1b3b4d',
  statsBg: '#f6f4f0',
  darkText: '#1b3b4d'
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
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Hero & Nav Section */}
      <Box sx={{ backgroundColor: COLORS.darkBg, color: '#fff', pt: 3, pb: 12 }}>
        <Container maxWidth="lg">
          {/* Navbar */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: { xs: 8, md: 12 } }}>
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.5px' }}>
              StockWhisk
            </Typography>
            
            <Stack direction="row" spacing={4} sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center' }}>
              <Link href="#features" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 500 }}>Features</Link>
              <Link href="#pricing" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 500 }}>Pricing</Link>
              <Link href="#contact" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 500 }}>Contact</Link>
              
              {mounted && isLoggedIn ? (
                <Link href="/app" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 500 }}>
                  Dashboard
                </Link>
              ) : (
                <Link href="/login" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 500 }}>
                  Log in
                </Link>
              )}
              
              <Button 
                variant="contained" 
                sx={{ 
                  bgcolor: COLORS.btnBg, 
                  color: COLORS.btnText, 
                  fontWeight: 600, 
                  textTransform: 'none',
                  borderRadius: 1.5,
                  px: 2.5,
                  '&:hover': { bgcolor: '#d4c1ac' }
                }}
              >
                Request access
              </Button>
            </Stack>
          </Box>

          {/* Hero Content */}
          <Box sx={{ textAlign: 'center', maxWidth: '800px', mx: 'auto' }}>
            <Chip 
              label="RETAIL OPERATING SYSTEM" 
              sx={{ 
                bgcolor: COLORS.pillBg, 
                color: '#fff', 
                fontWeight: 700, 
                fontSize: '0.75rem', 
                letterSpacing: '1px',
                borderRadius: '8px',
                mb: 4,
                px: 1
              }} 
            />
            
            <Typography variant="h2" sx={{ fontWeight: 800, mb: 3, letterSpacing: '-1.5px', fontSize: { xs: '2.5rem', md: '3.75rem' }, lineHeight: 1.1 }}>
              Run your entire shop<br/>from one dashboard
            </Typography>
            
            <Typography variant="h6" sx={{ color: COLORS.textLight, fontWeight: 400, mb: 6, fontSize: { xs: '1rem', md: '1.2rem' }, lineHeight: 1.6, maxWidth: '700px', mx: 'auto' }}>
              POS, inventory, purchasing, customers, dues, service tickets, accounting and analytics — built for electronics, mobile, computer and general retail shops in Bangladesh.
            </Typography>
            
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3, justifyContent: 'center' }}>
              <Button 
                variant="contained" 
                size="large"
                sx={{ 
                  bgcolor: COLORS.btnBg, 
                  color: COLORS.btnText, 
                  fontWeight: 600, 
                  textTransform: 'none',
                  borderRadius: 2,
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  '&:hover': { bgcolor: '#d4c1ac' }
                }}
              >
                Request access
              </Button>
              <Button 
                variant="outlined" 
                size="large"
                sx={{ 
                  color: '#fff', 
                  borderColor: 'rgba(255,255,255,0.4)', 
                  fontWeight: 500, 
                  textTransform: 'none',
                  borderRadius: 2,
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                See features
              </Button>
            </Stack>
            
            <Typography variant="body2" sx={{ color: COLORS.textLight, fontSize: '0.85rem' }}>
              Accounts are set up by our team — no credit card, no setup fees.
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* Stats Section */}
      <Box sx={{ bgcolor: COLORS.statsBg, py: 5, borderBottom: '1px solid #eaeaea' }}>
        <Container maxWidth="lg">
          <Grid container spacing={4} textAlign="center">
            <Grid item xs={6} md={3}>
              <Typography variant="h3" sx={{ fontWeight: 700, color: COLORS.darkText, mb: 1 }}>1</Typography>
              <Typography variant="body2" sx={{ color: '#666', fontWeight: 500 }}>unified platform</Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="h3" sx={{ fontWeight: 700, color: COLORS.darkText, mb: 1 }}>10+</Typography>
              <Typography variant="body2" sx={{ color: '#666', fontWeight: 500 }}>connected modules</Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="h3" sx={{ fontWeight: 700, color: COLORS.darkText, mb: 1 }}>100%</Typography>
              <Typography variant="body2" sx={{ color: '#666', fontWeight: 500 }}>audit-ready stock ledger</Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="h3" sx={{ fontWeight: 700, color: COLORS.darkText, mb: 1 }}>0</Typography>
              <Typography variant="body2" sx={{ color: '#666', fontWeight: 500 }}>hidden charges</Typography>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Feature Section Preview */}
      <Box sx={{ bgcolor: '#fff', py: 10 }}>
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <Typography variant="h3" sx={{ fontWeight: 800, color: '#111', mb: 2, letterSpacing: '-1px' }}>
            Everything your shop needs, connected
          </Typography>
          <Typography variant="h6" sx={{ color: '#555', fontWeight: 400, lineHeight: 1.6 }}>
            No more juggling notebooks, spreadsheets and separate apps. Every sale, purchase and repair updates the same source of truth.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
