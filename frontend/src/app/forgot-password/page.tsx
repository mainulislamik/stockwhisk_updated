"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Box, Typography, TextField, Button, Alert, CircularProgress, Stack, IconButton, InputAdornment, Stepper, Step, StepLabel } from '@mui/material';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import { useThemeMode } from '@/components/ThemeRegistry';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { mode, toggleTheme } = useThemeMode();
  const [step, setStep] = useState(0); // 0: Request OTP, 1: Verify OTP & Reset
  
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const isDark = mode === 'dark';

  async function handleRequestOTP(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      await api("/auth/password-reset/request-otp/", {
        method: "POST",
        body: JSON.stringify({ email })
      });
      setSuccess("If an account with that email exists, an OTP has been sent.");
      setStep(1);
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
        body: JSON.stringify({ email, otp, new_password: password })
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
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
      {/* Left Side: Brand Imagery */}
      <Box 
        sx={{ 
          flex: { xs: '0 0 auto', md: '1 1 50%', lg: '1 1 60%' }, 
          minHeight: { xs: '30vh', md: '100vh' },
          backgroundImage: 'url(/login-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
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
        <IconButton 
          onClick={toggleTheme} 
          sx={{ position: 'absolute', top: 24, right: 24, bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' } }}
          color="inherit"
        >
          {isDark ? <LightModeIcon /> : <DarkModeIcon />}
        </IconButton>

        <Box sx={{ width: '100%', maxWidth: '440px' }}>
          <Box sx={{ mb: 5 }}>
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 1.5, color: isDark ? '#fff' : '#0F172A', letterSpacing: '-0.5px' }}>
              Reset Password
            </Typography>
            <Typography variant="body1" sx={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '1.05rem' }}>
              {step === 0 ? "Enter your email to receive a verification code." : "Enter the code and your new password."}
            </Typography>
          </Box>

          <Stepper activeStep={step} sx={{ mb: 4 }} alternativeLabel>
            <Step>
              <StepLabel>Request Code</StepLabel>
            </Step>
            <Step>
              <StepLabel>Reset Password</StepLabel>
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
                  {busy ? "Resetting..." : "Reset Password"}
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
  );
}
