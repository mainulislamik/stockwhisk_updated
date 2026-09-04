"use client";

import { useLanguage } from "@/contexts/LanguageContext";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Box, Typography, TextField, Button, Alert, CircularProgress, Stack, IconButton, InputAdornment, Stepper, Step, StepLabel } from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import PublicThemeProvider from '@/components/PublicThemeProvider';

export default function ForgotPasswordPage() {
  const { lang, t } = useLanguage();
  const router = useRouter();
  const [step, setStep] = useState(0); // 0: Request OTP, 1: Verify OTP & Reset
  const [timeLeft, setTimeLeft] = useState(180); // 3 minutes = 180 seconds

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 1 && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [step, timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };
  
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const isDark = false;

  async function handleRequestOTP(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      await api("/auth/password-reset/request-otp/", {
        method: "POST",
        body: { email }
      });
      setSuccess("If an account with that email exists, an OTP has been sent.");
      setStep(1);
      setTimeLeft(180);
    } catch (err: any) {
      let errorMsg = "An error occurred while requesting OTP.";
      if (err?.data?.detail) {
        errorMsg = err.data.detail;
      } else if (err?.data?.email && Array.isArray(err.data.email)) {
        errorMsg = err.data.email[0];
      } else if (err?.data?.non_field_errors && Array.isArray(err.data.non_field_errors)) {
        errorMsg = err.data.non_field_errors[0];
      }
      setError(errorMsg);
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setBusy(true);
    try {
      await api("/auth/password-reset/verify-otp/", {
        method: "POST",
        body: { email, otp, new_password: password }
      });
      setSuccess("Your password has been successfully reset. Redirecting to login...");
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err: any) {
      let errorMsg = "An error occurred. Please verify the OTP and try again.";
      if (err?.data?.detail) {
        errorMsg = err.data.detail;
      } else if (err?.data?.otp && Array.isArray(err.data.otp)) {
        errorMsg = err.data.otp[0];
      } else if (err?.data?.non_field_errors && Array.isArray(err.data.non_field_errors)) {
        errorMsg = err.data.non_field_errors[0];
      }
      setError(errorMsg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicThemeProvider>
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
      {/* Left Side: on-brand vector hero */}
      <Box
        sx={{
          flex: { xs: '0 0 auto', md: '1 1 50%', lg: '1 1 60%' },
          minHeight: { xs: '30vh', md: '100vh' },
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
          <Typography variant="h1" sx={{ fontWeight: 800, color: '#fff', textShadow: '0px 4px 12px rgba(0,0,0,0.5)', mb: 2, letterSpacing: '-1.5px', fontSize: { xs: '3rem', md: '4.5rem' } }}>
            StockWhisk
          </Typography>
          <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.92)', maxWidth: 500, fontWeight: 400, textShadow: '0px 2px 8px rgba(0,0,0,0.4)', fontSize: { xs: '1rem', md: '1.25rem' }, lineHeight: 1.6 }}>
            Recover your access and keep managing your retail operations seamlessly.
          </Typography>
        </Box>
      </Box>

      {/* Right Side: Forgot Password Form */}
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
              setPasswordForm
            </Typography>
            <Typography variant="body1" sx={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '1.05rem' }}>
              {step === 0 ? "Enter your email to receive a verification code." : "Enter the code and your new password."}
            </Typography>
          </Box>

          <Stepper activeStep={step} sx={{ mb: 4 }} alternativeLabel>
            <Step>
              <StepLabel>{lang === "bn" ? "ভেরিফিকেশন কোড পাঠান" : "Request Code"}</StepLabel>
            </Step>
            <Step>
              <StepLabel>setPasswordForm</StepLabel>
            </Step>
          </Stepper>
          
          {error && (
            <Alert severity="error" sx={{ mb: 4, borderRadius: 2, fontWeight: 500 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 4, borderRadius: 2, fontWeight: 500 }}>
              {success}
            </Alert>
          )}
          
          {step === 0 ? (
            <form onSubmit={handleRequestOTP}>
              <Stack spacing={3.5}>
                <TextField
                  label="Email Address"
                  type="email"
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
                  }}
                >
                  {busy ? "Sending Code..." : "Send Verification Code"}
                </Button>
              </Stack>
            </form>
          ) : (
            <form onSubmit={handleResetPassword}>
              <Stack spacing={3.5}>
                <TextField
                  label="Verification Code (OTP)"
                  variant="outlined"
                  fullWidth
                  required
                  autoFocus
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <VpnKeyIcon sx={{ color: isDark ? '#64748b' : '#94a3b8' }} />
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

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: -1.5, mb: 1 }}>
                  <Typography variant="body2" sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                    {timeLeft > 0 ? (
                      <>{lang === "bn" ? "কোডের মেয়াদ বাকি:" : "Code expires in:"} <strong style={{ color: isDark ? '#fff' : '#0F172A', paddingLeft: 4 }}>{formatTime(timeLeft)}</strong></>
                    ) : (
                      <span style={{ color: '#ef4444', fontWeight: 600 }}>{lang === "bn" ? "কোডের মেয়াদ শেষ" : "Code expired"}</span>
                    )}
                  </Typography>
                  
                  <Button 
                    variant="text" 
                    onClick={() => handleRequestOTP()} 
                    disabled={timeLeft > 0 || busy}
                    sx={{ textTransform: 'none', fontWeight: 600, color: '#4f46e5', '&:disabled': { color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.26)' } }}
                  >
                    Resend Code
                  </Button>
                </Box>

                <TextField
                  label="New Password"
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
                <TextField
                  label="Confirm New Password"
                  type="password"
                  variant="outlined"
                  fullWidth
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                      transform: 'translateY(-2px)',
                      boxShadow: isDark ? '0 12px 24px rgba(0,0,0,0.6)' : '0 12px 24px rgba(16,185,129,0.35)',
                    },
                  }}
                >
                  {busy ? "Resetting..." : "setPasswordForm"}
                </Button>
              </Stack>
            </form>
          )}

          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>
              Remember your password?{' '}
              <Link href="/login" style={{ color: '#4f46e5', textDecoration: 'none', fontWeight: 600 }}>
                Sign in
              </Link>
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
    </PublicThemeProvider>
  );
}
