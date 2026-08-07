"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Box, Typography, Button, Container, Stack, Chip, keyframes } from '@mui/material';
import { getAccess } from "@/lib/api";
import BarChartIcon from '@mui/icons-material/BarChart';
import InventoryIcon from '@mui/icons-material/Inventory';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import GroupsIcon from '@mui/icons-material/Groups';
import StorefrontIcon from '@mui/icons-material/Storefront';

const COLORS = {
  darkBg: '#0f172a', // Deep slate
  pillBg: 'rgba(255, 255, 255, 0.1)',
  textLight: '#94a3b8',
  btnBg: '#3b82f6',
  btnText: '#ffffff',
  statsBg: '#020617', // Extremely dark blue/black
  darkText: '#f8fafc',
  cardBg: 'rgba(30, 41, 59, 0.7)',
  cardBorder: 'rgba(255, 255, 255, 0.05)',
  accent: '#38bdf8'
};

// Animations
const float = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
`;

const pulseGlow = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.4); }
  70% { box-shadow: 0 0 0 15px rgba(56, 189, 248, 0); }
  100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0); }
`;

const gradientBg = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

export default function LandingPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsLoggedIn(!!getAccess());
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: COLORS.darkBg, overflowX: 'hidden' }}>
      
      {/* Background Glowing Orbs */}
      <Box sx={{ position: 'fixed', top: '-20%', left: '-10%', width: '50vw', height: '50vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(56,189,248,0.15) 0%, rgba(15,23,42,0) 70%)', filter: 'blur(60px)', zIndex: 0, pointerEvents: 'none' }} />
      <Box sx={{ position: 'fixed', bottom: '-20%', right: '-10%', width: '50vw', height: '50vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, rgba(15,23,42,0) 70%)', filter: 'blur(60px)', zIndex: 0, pointerEvents: 'none' }} />

      {/* Hero & Nav Section */}
      <Box sx={{ color: '#fff', pt: 3, pb: { xs: 8, md: 15 }, position: 'relative', zIndex: 1 }}>
        <Container maxWidth="lg">
          {/* Navbar */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: { xs: 8, md: 12 }, animation: `${fadeIn} 0.6s ease-out` }}>
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.5px', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              StockWhisk
            </Typography>
            
            <Stack direction="row" spacing={4} sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center' }}>
              <Link href="#features" style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 500, transition: 'color 0.2s' }}>Features</Link>
              <Link href="#pricing" style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 500, transition: 'color 0.2s' }}>Pricing</Link>
              
              {mounted && isLoggedIn ? (
                <Link href="/app" style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 500 }}>
                  Dashboard
                </Link>
              ) : (
                <Link href="/login" style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 500 }}>
                  Log in
                </Link>
              )}
              
              <Button 
                variant="contained" 
                sx={{ 
                  bgcolor: '#ffffff', 
                  color: '#0f172a', 
                  fontWeight: 700, 
                  textTransform: 'none',
                  borderRadius: '12px',
                  px: 3,
                  py: 1,
                  boxShadow: '0 4px 14px 0 rgba(255, 255, 255, 0.2)',
                  transition: 'all 0.2s ease',
                  '&:hover': { bgcolor: '#f1f5f9', transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(255,255,255,0.25)' }
                }}
              >
                Request access
              </Button>
            </Stack>
          </Box>

          {/* Hero Content */}
          <Box sx={{ textAlign: 'center', maxWidth: '850px', mx: 'auto', animation: `${fadeIn} 0.8s ease-out 0.1s both` }}>
            <Chip 
              label="RETAIL OPERATING SYSTEM" 
              sx={{ 
                bgcolor: COLORS.pillBg, 
                color: COLORS.accent, 
                fontWeight: 700, 
                fontSize: '0.75rem', 
                letterSpacing: '1.5px',
                borderRadius: '16px',
                mb: 4,
                px: 2,
                py: 2.5,
                border: '1px solid rgba(56, 189, 248, 0.3)',
                backdropFilter: 'blur(10px)',
                animation: `${float} 4s ease-in-out infinite`
              }} 
            />
            
            <Typography variant="h1" sx={{ 
              fontWeight: 900, 
              mb: 3, 
              letterSpacing: '-2px', 
              fontSize: { xs: '3rem', sm: '4rem', md: '5.5rem' }, 
              lineHeight: 1.05,
              background: 'linear-gradient(135deg, #ffffff 30%, #94a3b8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 10px 30px rgba(0,0,0,0.5)'
            }}>
              Run your entire shop<br/>from one dashboard
            </Typography>
            
            <Typography variant="h6" sx={{ color: COLORS.textLight, fontWeight: 400, mb: 6, fontSize: { xs: '1.1rem', md: '1.35rem' }, lineHeight: 1.6, maxWidth: '700px', mx: 'auto' }}>
              POS, inventory, purchasing, customers, dues, service tickets, accounting and analytics — built for modern retail shops.
            </Typography>
            
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 4, justifyContent: 'center' }}>
              <Button 
                variant="contained" 
                size="large"
                sx={{ 
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: '#fff', 
                  fontWeight: 600, 
                  textTransform: 'none',
                  borderRadius: '12px',
                  px: 5,
                  py: 1.8,
                  fontSize: '1.15rem',
                  animation: `${pulseGlow} 2s infinite`,
                  transition: 'all 0.3s ease',
                  '&:hover': { transform: 'translateY(-2px)', filter: 'brightness(1.1)' }
                }}
              >
                Request access
              </Button>
              <Button 
                variant="outlined" 
                size="large"
                sx={{ 
                  color: '#fff', 
                  borderColor: 'rgba(255,255,255,0.2)', 
                  fontWeight: 500, 
                  textTransform: 'none',
                  borderRadius: '12px',
                  px: 5,
                  py: 1.8,
                  fontSize: '1.15rem',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.3s ease',
                  '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.05)', transform: 'translateY(-2px)' }
                }}
              >
                See features
              </Button>
            </Stack>
            
            <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 500 }}>
              Accounts are set up by our team — no credit card, no setup fees.
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* Stats Section */}
      <Box sx={{ bgcolor: 'rgba(2, 6, 23, 0.7)', py: 6, borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', position: 'relative', zIndex: 1 }}>
        <Container maxWidth="lg">
          <Box 
            sx={{ 
              display: 'grid', 
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, 
              gap: 4, 
              textAlign: 'center',
              animation: `${fadeIn} 0.8s ease-out 0.3s both`
            }}
          >
            <Box>
              <Typography variant="h2" sx={{ fontWeight: 800, color: COLORS.darkText, mb: 0.5 }}>1</Typography>
              <Typography variant="body1" sx={{ color: COLORS.textLight, fontWeight: 500 }}>unified platform</Typography>
            </Box>
            <Box>
              <Typography variant="h2" sx={{ fontWeight: 800, color: COLORS.darkText, mb: 0.5 }}>10+</Typography>
              <Typography variant="body1" sx={{ color: COLORS.textLight, fontWeight: 500 }}>connected modules</Typography>
            </Box>
            <Box>
              <Typography variant="h2" sx={{ fontWeight: 800, color: COLORS.darkText, mb: 0.5 }}>100%</Typography>
              <Typography variant="body1" sx={{ color: COLORS.textLight, fontWeight: 500 }}>audit-ready stock</Typography>
            </Box>
            <Box>
              <Typography variant="h2" sx={{ fontWeight: 800, color: COLORS.darkText, mb: 0.5 }}>0</Typography>
              <Typography variant="body1" sx={{ color: COLORS.textLight, fontWeight: 500 }}>hidden charges</Typography>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Modern Bento Grid Features */}
      <Box sx={{ pt: { xs: 10, md: 15 }, pb: 15, position: 'relative', zIndex: 1 }} id="features">
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8, animation: `${fadeIn} 0.8s ease-out 0.4s both` }}>
            <Typography variant="h2" sx={{ fontWeight: 800, color: '#fff', mb: 2, letterSpacing: '-1px', fontSize: { xs: '2.5rem', md: '3.5rem' } }}>
              Everything your shop needs.
            </Typography>
            <Typography variant="h6" sx={{ color: COLORS.textLight, fontWeight: 400, lineHeight: 1.6, maxWidth: '600px', mx: 'auto' }}>
              No more juggling notebooks, spreadsheets and separate apps. Every sale, purchase and repair updates the same source of truth.
            </Typography>
          </Box>

          {/* Bento Grid */}
          <Box 
            sx={{ 
              display: 'grid', 
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, 
              gridAutoRows: 'minmax(250px, auto)',
              gap: 3,
              animation: `${fadeIn} 0.8s ease-out 0.5s both`
            }}
          >
            {/* Large Card 1 */}
            <Box sx={{ 
              gridColumn: { xs: '1', md: 'span 2' }, 
              bgcolor: COLORS.cardBg, 
              border: `1px solid ${COLORS.cardBorder}`,
              borderRadius: '24px',
              p: 5,
              backdropFilter: 'blur(20px)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
              transition: 'transform 0.3s ease, border-color 0.3s ease',
              '&:hover': { transform: 'translateY(-5px)', borderColor: 'rgba(56, 189, 248, 0.3)' }
            }}>
              <Box sx={{ position: 'absolute', top: -50, right: -50, opacity: 0.1 }}>
                <PointOfSaleIcon sx={{ fontSize: 200, color: COLORS.accent }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#fff', mb: 2, position: 'relative' }}>Lightning Fast POS</Typography>
              <Typography variant="body1" sx={{ color: COLORS.textLight, mb: 4, maxWidth: '400px', position: 'relative' }}>Process sales, scan barcodes, and print receipts in seconds. Works completely seamlessly with your inventory.</Typography>
            </Box>

            {/* Small Card 1 */}
            <Box sx={{ 
              bgcolor: COLORS.cardBg, 
              border: `1px solid ${COLORS.cardBorder}`,
              borderRadius: '24px',
              p: 4,
              backdropFilter: 'blur(20px)',
              transition: 'transform 0.3s ease, border-color 0.3s ease',
              '&:hover': { transform: 'translateY(-5px)', borderColor: 'rgba(56, 189, 248, 0.3)' }
            }}>
              <InventoryIcon sx={{ fontSize: 40, color: COLORS.accent, mb: 2 }} />
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>Smart Inventory</Typography>
              <Typography variant="body2" sx={{ color: COLORS.textLight }}>Real-time stock tracking with automated low-stock notifications and supplier management.</Typography>
            </Box>

            {/* Small Card 2 */}
            <Box sx={{ 
              bgcolor: COLORS.cardBg, 
              border: `1px solid ${COLORS.cardBorder}`,
              borderRadius: '24px',
              p: 4,
              backdropFilter: 'blur(20px)',
              transition: 'transform 0.3s ease, border-color 0.3s ease',
              '&:hover': { transform: 'translateY(-5px)', borderColor: 'rgba(56, 189, 248, 0.3)' }
            }}>
              <ReceiptLongIcon sx={{ fontSize: 40, color: COLORS.accent, mb: 2 }} />
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>Daily Accounting</Typography>
              <Typography variant="body2" sx={{ color: COLORS.textLight }}>End-of-day settlements, cash discrepancy tracking, and profit margins automatically calculated.</Typography>
            </Box>

            {/* Large Card 2 */}
            <Box sx={{ 
              gridColumn: { xs: '1', md: 'span 2' }, 
              bgcolor: COLORS.cardBg, 
              border: `1px solid ${COLORS.cardBorder}`,
              borderRadius: '24px',
              p: 5,
              backdropFilter: 'blur(20px)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
              transition: 'transform 0.3s ease, border-color 0.3s ease',
              '&:hover': { transform: 'translateY(-5px)', borderColor: 'rgba(56, 189, 248, 0.3)' }
            }}>
              <Box sx={{ position: 'absolute', bottom: -50, right: -50, opacity: 0.1 }}>
                <BarChartIcon sx={{ fontSize: 200, color: COLORS.accent }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#fff', mb: 2, position: 'relative' }}>Powerful Analytics</Typography>
              <Typography variant="body1" sx={{ color: COLORS.textLight, mb: 4, maxWidth: '400px', position: 'relative' }}>Visualize your sales trends, top performing products, and customer behavior with stunning, easy-to-read reports.</Typography>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
