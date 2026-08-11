"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";
import { Box, Typography, TextField, Button, Alert, CircularProgress, Stack, IconButton, InputAdornment } from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import MarketingNav from '@/components/MarketingNav';
import LockIcon from '@mui/icons-material/Lock';
import { useThemeMode } from '@/components/ThemeRegistry';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const { mode } = useThemeMode();
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
      // Platform staff land on the admin dashboard; shop users on the app.
      const me = await api<{ is_staff: boolean }>("/auth/me/").catch(() => null);
      router.push(me?.is_staff ? "/platform" : "/app");
    } catch (err: any) {
      setError(err?.data?.detail || "No active account found with the given credentials.");
      setBusy(false);
    }
  }

  const isDark = mode === 'dark';

  return (
    <>
    <MarketingNav />
    <Box sx={{ minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
      {/* Left Side: Brand Imagery */}
      <Box 
        sx={{ 
          flex: { xs: '0 0 auto', md: '1 1 50%', lg: '1 1 60%' }, 
          minHeight: { xs: '30vh', md: 'calc(100vh - 64px)' },
          backgroundImage: 'url(/login-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {/* Glassmorphism overlay for text */}
        <Box sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to right, rgba(0,0,0,0.6), rgba(0,0,0,0.1))',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 4,
          textAlign: 'center'
        }}>
          <Typography variant="h1" sx={{ fontWeight: 800, color: '#fff', textShadow: '0px 4px 12px rgba(0,0,0,0.6)', mb: 2, letterSpacing: '-1.5px', fontSize: { xs: '3rem', md: '4.5rem' } }}>
            StockWhisk
          </Typography>
          <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.9)', maxWidth: 500, fontWeight: 400, textShadow: '0px 2px 8px rgba(0,0,0,0.5)', fontSize: { xs: '1rem', md: '1.25rem' }, lineHeight: 1.6 }}>
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
    </>
  );
}
