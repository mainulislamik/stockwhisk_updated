"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, setTokens } from "@/lib/api";
import { Box, Typography, TextField, Button, Alert, CircularProgress, Stack, IconButton, InputAdornment, MenuItem } from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import MarketingNav from '@/components/MarketingNav';
import PublicThemeProvider from '@/components/PublicThemeProvider';
import LockIcon from '@mui/icons-material/Lock';
import PersonIcon from '@mui/icons-material/Person';
import StoreIcon from '@mui/icons-material/Store';
import PhoneIcon from '@mui/icons-material/Phone';
import CategoryIcon from '@mui/icons-material/Category';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";

const SHOP_CATEGORIES = [
  { value: 'fashion', label: 'Fashion & Apparel' },
  { value: 'beauty', label: 'Beauty & Cosmetics' },
  { value: 'jewelry', label: 'Jewelry & Accessories' },
  { value: 'home_decor', label: 'Home Decor & Furniture' },
  { value: 'food', label: 'Groceries & Organic Food' },
  { value: 'footwear', label: 'Footwear & Shoes' },
  { value: 'handcrafts', label: 'Handcrafts & Boutique' },
  { value: 'electronics', label: 'Electronics & Gadgets' },
  { value: 'computer', label: 'Computer & IT' },
  { value: 'mobile', label: 'Mobile & Accessories' },
  { value: 'general', label: 'General Retail' },
  { value: 'camical', label: 'Chemical & Lab Supplies' },
  { value: 'supershop', label: 'Super Shop & Grocery' },
  { value: 'cosmetics', label: 'Cosmetics & Beauty' },
  { value: 'other', label: 'Other' }
];

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [timeLeft, setTimeLeft] = useState(180); // 3 minutes

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 2 && timeLeft > 0) {
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

  // Form State
  const [shopName, setShopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [businessType, setBusinessType] = useState("general");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [referralCode, setReferralCode] = useState("");

  // Capture a reseller referral code from ?ref=CODE (window avoids needing a
  // Suspense boundary for useSearchParams during static build).
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref) setReferralCode(ref.trim().toUpperCase());
    } catch {}
  }, []);

  const isDark = false;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
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
      await api("/auth/register/", { 
        method: "POST",
        body: {
          shop_name: shopName,
          owner_name: ownerName,
          owner_email: email,
          owner_password: password,
          phone: phone,
          business_type: businessType,
          address: address,
          referral_code: referralCode,
        },
      });
      setSuccess("An OTP has been sent to your email.");
      setStep(2);
      setTimeLeft(180);
    } catch (err: any) {
      let errorMsg = "Registration failed. Please check your details.";
      if (err?.data) {
        if (typeof err.data === 'string' && err.data.trim() !== '') {
          errorMsg = err.data.substring(0, 200); // Show start of HTML/string
        } else if (err.data.detail) {
          errorMsg = err.data.detail;
        } else {
          // Check for field-specific errors
          const firstKey = Object.keys(err.data)[0];
          if (firstKey && Array.isArray(err.data[firstKey])) {
            errorMsg = `${firstKey}: ${err.data[firstKey][0]}`;
          }
        }
      } else if (err?.message && err.message.trim() !== '') {
        errorMsg = err.message;
      }
      
      // Prevent showing empty HTML string from api client
      if (errorMsg.trim() === "") {
         errorMsg = "Registration failed (Server returned empty error).";
      }
      
      setError(errorMsg);
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await api("/auth/verify-otp/", {
        method: "POST",
        body: { email, otp },
      });
      setTokens(data.access, data.refresh);
      router.push("/app");
    } catch (err: any) {
      setError(err?.data?.detail || err?.data?.otp?.[0] || err?.message || "Invalid or expired OTP code.");
    } finally {
      setBusy(false);
    }
  };

  const textFieldStyles = {
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
  };

  return (
    <PublicThemeProvider>
    <MarketingNav />
    <Box sx={{ minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
      {/* Left Side: Step-by-Step Guideline */}
      <Box
        sx={{
          flex: { xs: '0 0 auto', md: '1 1 45%', lg: '1 1 50%' },
          minHeight: { xs: 'auto', md: 'calc(100vh - 64px)' },
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          p: { xs: 4, md: 8 },
          background:
            'radial-gradient(circle at 28% 22%, rgba(99,102,241,0.2) 0%, transparent 48%),' +
            'linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #312e81 100%)',
          color: '#fff'
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Typography variant="h3" sx={{ fontWeight: 800, mb: 4, color: '#fff', fontFamily: 'Outfit, sans-serif' }}>
            {t('reg_guide_title')}
          </Typography>
        </motion.div>

        <Stack spacing={4}>
          {[
            { title: t('reg_step1_title'), desc: t('reg_step1_desc'), step: 1 },
            { title: t('reg_step2_title'), desc: t('reg_step2_desc'), step: 2 },
            { title: t('reg_step3_title'), desc: t('reg_step3_desc'), step: 3 },
            { title: t('reg_step4_title'), desc: t('reg_step4_desc'), step: 4 },
          ].map((item, i) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.15 }}
            >
              <Box sx={{ display: 'flex', gap: 3 }}>
                <Box sx={{
                  flexShrink: 0,
                  width: 48,
                  height: 48,
                  borderRadius: '16px',
                  bgcolor: 'rgba(99, 102, 241, 0.2)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#818cf8',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                }}>
                  {item.step}
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', mb: 0.5 }}>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, fontSize: '1rem' }}>
                    {item.desc}
                  </Typography>
                </Box>
              </Box>
            </motion.div>
          ))}
        </Stack>
      </Box>

      {/* Right Side: Register Form */}
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
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 1.5, color: isDark ? '#fff' : '#0F172A', letterSpacing: '-0.5px' }}>
              {t("auth_create_account") || "Create an Account"}
            </Typography>
            <Typography variant="body1" sx={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '1.05rem' }}>
              {step === 1 ? (t("reg_step1_desc") || "Fill in your details below to get started.") : (t("reg_step2_desc") || "Verify your email address.")}
            </Typography>
          </Box>
          
          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2, fontWeight: 500 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 3, borderRadius: 2, fontWeight: 500 }}>
              {success}
            </Alert>
          )}

          {step === 1 ? (
            <form onSubmit={handleRegister}>
              <Stack spacing={2.5}>
                <TextField
                  label={t("set_shop_name") || "Store Name"}
                  variant="outlined"
                  fullWidth
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><StoreIcon sx={{ color: isDark ? '#64748b' : '#94a3b8' }} /></InputAdornment> } }}
                  sx={textFieldStyles}
                />
                
                <TextField
                  label={t("cust_name") || "Your Name"}
                  variant="outlined"
                  fullWidth
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><PersonIcon sx={{ color: isDark ? '#64748b' : '#94a3b8' }} /></InputAdornment> } }}
                  sx={textFieldStyles}
                />
                
                <TextField
                  label={t("sup_lbl_email") || "Email Address"}
                  type="email"
                  variant="outlined"
                  fullWidth
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><EmailIcon sx={{ color: isDark ? '#64748b' : '#94a3b8' }} /></InputAdornment> } }}
                  sx={textFieldStyles}
                />

                <TextField
                  label={t("sup_lbl_phone") || "Mobile Number"}
                  type="tel"
                  variant="outlined"
                  fullWidth
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><PhoneIcon sx={{ color: isDark ? '#64748b' : '#94a3b8' }} /></InputAdornment> } }}
                  sx={textFieldStyles}
                />

                <TextField
                  select
                  label={t("cat_title") || "Business Category"}
                  fullWidth
                  required
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><CategoryIcon sx={{ color: isDark ? '#64748b' : '#94a3b8' }} /></InputAdornment> } }}
                  sx={{...textFieldStyles, '& .MuiSelect-select': { display: 'flex', alignItems: 'center' }}}
                >
                  {SHOP_CATEGORIES.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  label={t("set_shop_addr") || "Address"}
                  variant="outlined"
                  fullWidth
                  multiline
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start" sx={{alignSelf: 'flex-start', mt: 1.5}}><LocationOnIcon sx={{ color: isDark ? '#64748b' : '#94a3b8' }} /></InputAdornment> } }}
                  sx={textFieldStyles}
                />

                <TextField
                  label={t("res_referral_code") ? `${t("res_referral_code")} (Optional)` : "Referral Code (Optional)"}
                  variant="outlined"
                  fullWidth
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  helperText={referralCode ? "You were referred by a StockWhisk partner." : undefined}
                  sx={textFieldStyles}
                />

                <TextField
                  label="Password"
                  type="password"
                  variant="outlined"
                  fullWidth
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><LockIcon sx={{ color: isDark ? '#64748b' : '#94a3b8' }} /></InputAdornment> } }}
                  sx={textFieldStyles}
                />

                <TextField
                  label="Confirm Password"
                  type="password"
                  variant="outlined"
                  fullWidth
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><LockIcon sx={{ color: isDark ? '#64748b' : '#94a3b8' }} /></InputAdornment> } }}
                  sx={textFieldStyles}
                />

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  size="large"
                  disabled={busy}
                  startIcon={busy ? <CircularProgress size={20} color="inherit" /> : null}
                  sx={{ 
                    mt: 1,
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
                  {busy ? "Creating Account..." : (t("nav_signup") || "Sign Up")}
                </Button>
              </Stack>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP}>
              <Stack spacing={3.5}>
                <Typography sx={{ color: isDark ? '#cbd5e1' : '#475569' }}>
                  {t("reg_step2_desc") ? `${t("reg_step2_desc")}: ` : "We sent a 6-digit code to "}<strong>{email}</strong>
                </Typography>
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
                      startAdornment: <InputAdornment position="start"><VpnKeyIcon sx={{ color: isDark ? '#64748b' : '#94a3b8' }} /></InputAdornment>,
                    },
                    htmlInput: { maxLength: 6, style: { textAlign: 'center', letterSpacing: '8px', fontSize: '1.25rem', fontWeight: 700 } }
                  }}
                  sx={textFieldStyles}
                />
                
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  size="large"
                  disabled={busy || otp.length < 6 || timeLeft === 0}
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
                    '&:disabled': {
                      background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                      color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                    }
                  }}
                >
                  {busy ? "Verifying..." : (t("reg_step4_title") || "Verify & Complete Setup")}
                </Button>
                
                <Box sx={{ textAlign: 'center', mt: 2 }}>
                  <Typography variant="body2" sx={{ color: isDark ? '#94a3b8' : '#64748b', mb: 1 }}>
                    {timeLeft > 0 ? (
                      `Code expires in ${formatTime(timeLeft)}`
                    ) : (
                      <span style={{ color: '#ef4444' }}>{t("auth_code_expired") || "Code expired"}</span>
                    )}
                  </Typography>
                  
                  {timeLeft === 0 && (
                    <Button 
                      variant="outlined" 
                      onClick={handleRegister} 
                      disabled={busy}
                      sx={{ textTransform: 'none', borderRadius: 2, borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}
                    >
                      {t("auth_resend_code") || "Resend Code"}
                    </Button>
                  )}
                </Box>

                <Box sx={{ textAlign: "center" }}>
                  <Button variant="text" onClick={() => setStep(1)} sx={{ textTransform: 'none', color: '#4f46e5', fontWeight: 600 }}>
                    {t("auth_change_email") || "Change email address"}
                  </Button>
                </Box>
              </Stack>
            </form>
          )}

          {step === 1 && (
            <Box sx={{ mt: 4, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                {t("footer_terms") ? "ইতিমধ্যে একাউন্ট আছে? " : "Already have an account? "}
                <Link href="/login" style={{ color: '#4f46e5', textDecoration: 'none', fontWeight: 600 }}>
                  {t("nav_login") || "Sign in"}
                </Link>
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
    </PublicThemeProvider>
  );
}
