"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Box, Button, TextField, Typography, Card, CardContent, CircularProgress, Container, Alert } from "@mui/material";
import { api, setTokens } from "@/lib/api";
import { useThemeMode } from "@/components/ThemeRegistry";

const LIGHT_COLORS = {
  surface: '#f8f9ff',
  onSurface: '#0b1c30',
  primary: '#004ac6',
  outlineVariant: '#c3c6d7',
};

const DARK_COLORS = {
  surface: '#0f172a',
  onSurface: '#f8fafc',
  primary: '#38bdf8',
  outlineVariant: '#334155',
};

export default function RegisterPage() {
  const router = useRouter();
  const { mode } = useThemeMode();
  const COLORS = mode === 'dark' ? DARK_COLORS : LIGHT_COLORS;

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Form state
  const [shopName, setShopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api("/auth/register/", { 
        method: "POST",
        body: {
          shop_name: shopName,
          owner_name: ownerName,
          owner_email: email,
          owner_password: password,
          business_type: "general"
        },
      });
      setStep(2);
    } catch (err: any) {
      setError(err?.message || "Registration failed. Please check your details.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await api("/auth/verify-otp/", {
        method: "POST",
        body: { email, otp },
      });
      setTokens(data.access, data.refresh);
      router.push("/app");
    } catch (err: any) {
      setError(err?.message || "Invalid or expired OTP code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: COLORS.surface, p: 2 }}>
      <Container maxWidth="sm">
        <Card elevation={mode === 'dark' ? 0 : 3} sx={{ borderRadius: 4, bgcolor: mode === 'dark' ? '#1e293b' : '#ffffff', border: mode === 'dark' ? `1px solid ${COLORS.outlineVariant}` : 'none' }}>
          <CardContent sx={{ p: { xs: 3, md: 5 } }}>
            <Box sx={{ textAlign: "center", mb: 4 }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: COLORS.primary, mb: 1, fontFamily: 'Outfit, sans-serif' }}>
                StockWhisk
              </Typography>
              <Typography variant="subtitle1" sx={{ color: "text.secondary", fontFamily: 'Outfit, sans-serif' }}>
                {step === 1 ? "Create your store account" : "Verify your email"}
              </Typography>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {step === 1 ? (
              <form onSubmit={handleRegister}>
                <TextField
                  fullWidth
                  label="Store Name"
                  variant="outlined"
                  margin="normal"
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Your Name"
                  variant="outlined"
                  margin="normal"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Email Address"
                  type="email"
                  variant="outlined"
                  margin="normal"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Password"
                  type="password"
                  variant="outlined"
                  margin="normal"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  sx={{ mt: 4, mb: 2, py: 1.5, fontSize: "1.1rem", borderRadius: 2, textTransform: "none", bgcolor: COLORS.primary }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : "Sign Up"}
                </Button>
                <Box sx={{ textAlign: "center", mt: 2 }}>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Already have an account? <Link href="/login" style={{ color: COLORS.primary, textDecoration: "none", fontWeight: 600 }}>Log In</Link>
                  </Typography>
                </Box>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTP}>
                <Typography sx={{ mb: 3, textAlign: 'center', color: 'text.secondary' }}>
                  We sent a 6-digit code to <strong>{email}</strong>. Please enter it below.
                </Typography>
                <TextField
                  fullWidth
                  label="Verification Code (OTP)"
                  variant="outlined"
                  margin="normal"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  inputProps={{ maxLength: 6, style: { textAlign: 'center', letterSpacing: '8px', fontSize: '1.5rem', fontWeight: 700 } }}
                />
                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  disabled={loading || otp.length < 6}
                  sx={{ mt: 4, mb: 2, py: 1.5, fontSize: "1.1rem", borderRadius: 2, textTransform: "none", bgcolor: COLORS.primary }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : "Verify & Complete Setup"}
                </Button>
                <Box sx={{ textAlign: "center", mt: 2 }}>
                  <Button variant="text" onClick={() => setStep(1)} sx={{ textTransform: 'none', color: COLORS.primary }}>
                    Change email address
                  </Button>
                </Box>
              </form>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
