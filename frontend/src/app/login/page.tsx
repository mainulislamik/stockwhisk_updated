"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";
import { Box, Typography, TextField, Button, Alert, CircularProgress, Stack, IconButton, InputAdornment } from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import MarketingNav from '@/components/MarketingNav';
import PublicThemeProvider from '@/components/PublicThemeProvider';
import LockIcon from '@mui/icons-material/Lock';
import { useBranding } from '@/lib/branding';
import { getLandingPath } from '@/lib/landing';

export default function LoginPage() {
  const { login } = useAuth();
  const branding = useBranding();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      const me = await api<{ is_staff: boolean; is_reseller?: boolean; shop: number | null }>("/auth/me/").catch(() => null);
      // Platform staff land on the admin dashboard.
      if (me?.is_staff) { router.push("/platform"); return; }
      // Resellers (no shop) belong in the reseller portal, not the shop app.
      if (me?.is_reseller) { router.push("/reseller/dashboard"); return; }
      // Shop users: resolve the first page their permissions actually allow, so
      // roles without `view_reports` don't get dropped on the protected dashboard.
      const p = await api<{ role: string; permissions: string[] }>("/auth/my-permissions/")
        .catch(() => ({ role: "", permissions: [] as string[] }));
      const isOwner = p.role === "owner";
      const perms = new Set(p.permissions || []);
      router.push(getLandingPath({ isOwner, can: (c) => isOwner || perms.has(c) }));
    } catch (err: any) {
      setError(err?.data?.detail || "No active account found with the given credentials.");
      setBusy(false);
    }
  }

  const isDark = false;

  return (
    <PublicThemeProvider>
    <MarketingNav />
    <Box sx={{ minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
      {/* Left Side: on-brand vector hero */}
      <Box
        sx={{
          flex: { xs: '0 0 auto', md: '1 1 50%', lg: '1 1 60%' },
          minHeight: { xs: '30vh', md: 'calc(100vh - 64px)' },
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(circle at 28% 22%, rgba(99,102,241,0.55) 0%, transparent 48%),' +
            'radial-gradient(circle at 78% 78%, rgba(124,58,237,0.5) 0%, transparent 45%),' +
            'linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #312e81 100%)',
        }}
      >
        {/* Decorative geometric shapes (pure SVG, theme-matched) */}
        <Box component="svg" viewBox="0 0 600 700" preserveAspectRatio="xMidYMid slice"
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
                '& .flt': { animation: 'floaty 9s ease-in-out infinite' },
                '& .flt2': { animation: 'floaty 11s ease-in-out infinite reverse' },
                '@keyframes floaty': { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-14px)' } } }}>
          <defs>
            <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#818cf8" /><stop offset="1" stopColor="#4f46e5" />
            </linearGradient>
            <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#c084fc" /><stop offset="1" stopColor="#7c3aed" />
            </linearGradient>
            <linearGradient id="g3" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#22d3ee" /><stop offset="1" stopColor="#3b82f6" />
            </linearGradient>
            <pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse">
              <path d="M42 0H0V42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            </pattern>
            <filter id="soft"><feGaussianBlur stdDeviation="9" /></filter>
          </defs>
          <rect width="600" height="700" fill="url(#grid)" />
          {/* glows */}
          <circle cx="150" cy="150" r="90" fill="#6366f1" opacity="0.35" filter="url(#soft)" />
          <circle cx="470" cy="520" r="110" fill="#a855f7" opacity="0.3" filter="url(#soft)" />
          {/* floating boxes (inventory motif) */}
          <g className="flt">
            <rect x="120" y="180" width="150" height="150" rx="26" fill="url(#g1)" transform="rotate(-16 195 255)" opacity="0.95" />
          </g>
          <g className="flt2">
            <rect x="330" y="120" width="115" height="115" rx="22" fill="url(#g2)" transform="rotate(12 387 177)" opacity="0.9" />
          </g>
          <g className="flt">
            <rect x="360" y="380" width="130" height="130" rx="24" fill="url(#g3)" transform="rotate(-8 425 445)" opacity="0.9" />
          </g>
          <g className="flt2">
            <rect x="150" y="430" width="95" height="95" rx="18" fill="url(#g2)" transform="rotate(18 197 477)" opacity="0.85" />
          </g>
          <circle cx="300" cy="330" r="150" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2" />
          <circle cx="300" cy="330" r="200" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
        </Box>

        {/* Foreground: logo + tagline */}
        <Box sx={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4, textAlign: 'center' }}>
          {branding.logo ? (
            <Box sx={{ bgcolor: '#fff', borderRadius: 3, px: 3, py: 2, mb: 3, boxShadow: '0 12px 40px -12px rgba(0,0,0,.5)' }}>
              <Box component="img" src={branding.logo} alt="Logo" sx={{ height: { xs: 46, md: 64 }, maxWidth: 320, objectFit: 'contain', display: 'block' }} />
            </Box>
          ) : (
            <Typography variant="h1" sx={{ fontWeight: 800, color: '#fff', textShadow: '0px 4px 12px rgba(0,0,0,0.5)', mb: 2, letterSpacing: '-1.5px', fontSize: { xs: '3rem', md: '4.5rem' } }}>
              StockWhisk
            </Typography>
          )}
          <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.92)', maxWidth: 500, fontWeight: 400, textShadow: '0px 2px 8px rgba(0,0,0,0.4)', fontSize: { xs: '1rem', md: '1.25rem' }, lineHeight: 1.6 }}>
            The smartest way to manage your inventory, analytics, and daily retail operations all in one place.
          </Typography>
        </Box>
      </Box>

      {/* Right Side: Login Form */}
      <Box 
        sx={{ 
          flex: { xs: '1 1 auto', md: '1 1 50%', lg: '1 1 40%' }, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          p: { xs: 3, sm: 6, md: 8 },
          backgroundColor: isDark ? '#0F172A' : '#ffffff',
          position: 'relative',
          borderLeft: isDark ? '1px solid rgba(255,255,255,0.05)' : 'none'
        }}
      >

        <Box sx={{ width: '100%', maxWidth: '440px' }}>
          <Box sx={{ mb: 5 }}>
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 1.5, color: isDark ? '#fff' : '#0F172A', letterSpacing: '-0.5px' }}>
              Welcome back
            </Typography>
            <Typography variant="body1" sx={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '1.05rem' }}>
              Please enter your details to sign in.
            </Typography>
          </Box>
          
          {error && (
            <Alert severity="error" sx={{ mb: 4, borderRadius: 2, fontWeight: 500 }}>
              {error}
            </Alert>
          )}
          
          <form onSubmit={onSubmit}>
            <Stack spacing={3.5}>
              <TextField
                label="Email or Username"
                variant="outlined"
                fullWidth
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon sx={{ color: isDark ? '#64748b' : '#94a3b8' }} />
                      </InputAdornment>
                    ),
                  }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2.5,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc',
                    transition: 'all 0.2s',
                    '&:hover': {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9',
                    }
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                  }
                }}
              />
              <TextField
                label="Password"
                type="password"
                variant="outlined"
                fullWidth
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon sx={{ color: isDark ? '#64748b' : '#94a3b8' }} />
                      </InputAdornment>
                    ),
                  }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2.5,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc',
                    transition: 'all 0.2s',
                    '&:hover': {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9',
                    }
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                  }
                }}
              />

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: -2 }}>
                <Link href="/forgot-password" style={{ color: isDark ? '#94a3b8' : '#64748b', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500, transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = '#4f46e5'} onMouseLeave={(e) => e.currentTarget.style.color = isDark ? '#94a3b8' : '#64748b'}>
                  Forgot Password?
                </Link>
              </Box>

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={busy}
                startIcon={busy ? <CircularProgress size={20} color="inherit" /> : null}
                sx={{ 
                  py: 1.8, 
                  borderRadius: 2.5, 
                  textTransform: 'none', 
                  fontSize: '1.1rem', 
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                  boxShadow: isDark ? '0 8px 20px rgba(0,0,0,0.5)' : '0 8px 20px rgba(99,102,241,0.25)',
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                    transform: 'translateY(-2px)',
                    boxShadow: isDark ? '0 12px 24px rgba(0,0,0,0.6)' : '0 12px 24px rgba(99,102,241,0.35)',
                  },
                  '&:active': {
                    transform: 'translateY(0)',
                  }
                }}
              >
                {busy ? "Signing in..." : "Sign in to Dashboard"}
              </Button>
            </Stack>
          </form>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>
              Don't have an account?{' '}
              <Link href="/register" style={{ color: '#4f46e5', textDecoration: 'none', fontWeight: 600 }}>
                Sign up
              </Link>
            </Typography>
          </Box>
          
          <Box sx={{ mt: 5, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: isDark ? '#64748b' : '#94a3b8' }}>
              &copy; {new Date().getFullYear()} StockWhisk. All rights reserved.
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
    </PublicThemeProvider>
  );
}
