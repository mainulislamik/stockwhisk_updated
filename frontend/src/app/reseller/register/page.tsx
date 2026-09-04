"use client";

import { useLanguage } from "@/contexts/LanguageContext";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Box, Button, Container, Typography, TextField, Grid, Alert, Paper } from "@mui/material";
import PublicThemeProvider from "@/components/PublicThemeProvider";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";
import { M } from "@/lib/marketing";

export default function ResellerRegisterPage() {
  const { lang, t } = useLanguage();
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", company_name: "", country: "", address: "", password: "", confirm_password: "", otp: "" });
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      if (step === 1) {
        await api("/reseller/register/", { method: "POST", body: form });
        setStep(2);
      } else if (step === 2) {
        await api("/reseller/verify-otp/", { method: "POST", body: { email: form.email, otp: form.otp } });
        setStep(3);
      }
    } catch (err: any) {
      const d = err?.data;
      setError(d?.detail || (d ? Object.values(d).flat().join(" ") : "Registration failed."));
    } finally {
      setBusy(false);
    }
  }

  const inputProps = {
    sx: {
      "& .MuiOutlinedInput-root": {
        borderRadius: "12px",
        bgcolor: M.surface,
        "& fieldset": { borderColor: M.border },
        "&:hover fieldset": { borderColor: M.borderStrong },
        "&.Mui-focused fieldset": { borderColor: M.primary, borderWidth: "2px" },
      }
    }
  };

  return (
    <PublicThemeProvider>
      <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", bgcolor: M.surfaceAlt, fontFamily: "Outfit, sans-serif" }}>
        <MarketingNav />

        <Box component="main" sx={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center", py: 8, position: "relative" }}>
          {/* Subtle background glow */}
          <Box sx={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: 600, height: 600, background: `radial-gradient(circle, ${M.accent}33 0%, transparent 70%)`, filter: "blur(60px)", zIndex: 0, pointerEvents: "none" }} />
          
          <Container maxWidth="sm" sx={{ position: "relative", zIndex: 1 }}>
            {step === 3 ? (
              <Paper sx={{ p: 5, borderRadius: "24px", textAlign: "center", border: `1px solid ${M.border}`, boxShadow: "0 20px 40px -20px rgba(15,23,42,.15)", bgcolor: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)" }}>
                <Box sx={{ fontSize: "4rem", mb: 2 }}>✅</Box>
                <Typography variant="h4" sx={{ fontWeight: 800, mb: 2, color: M.text }}>{lang === "bn" ? "নিবন্ধন সম্পন্ন হয়েছে" : "Registration received"}</Typography>
                <Typography sx={{ color: M.textMuted, mb: 4 }}>Your reseller account is <strong>{lang === "bn" ? "অ্যাডমিন অনুমোদনের অপেক্ষায় রয়েছে" : "pending admin approval"}</strong>. You’ll be notified via email when it’s activated.</Typography>
                <Button component={Link} href="/reseller/login" fullWidth sx={{
                  bgcolor: M.primary, color: M.onPrimary, fontWeight: 700, borderRadius: "12px", py: 1.5,
                  "&:hover": { bgcolor: M.primaryDark }
                }}>
                  Go to login
                </Button>
              </Paper>
            ) : step === 2 ? (
              <Paper sx={{ p: { xs: 4, md: 5 }, borderRadius: "24px", border: `1px solid ${M.border}`, boxShadow: "0 20px 40px -20px rgba(15,23,42,.15)", bgcolor: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)" }}>
                <Box sx={{ textAlign: "center", mb: 4 }}>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: M.text, mb: 1, letterSpacing: "-0.02em" }}>{lang === "bn" ? "আপনার ইমেইল চেক করুন" : "Check your email"}</Typography>
                  <Typography sx={{ color: M.textMuted, fontSize: "1.05rem" }}>We sent a 6-digit verification code to <strong>{form.email}</strong>.</Typography>
                </Box>
                
                <form onSubmit={submit}>
                  <TextField fullWidth label="6-digit code *" variant="outlined" value={form.otp} onChange={(e) => set("otp", e.target.value)} required {...inputProps} sx={{ mb: 2, ...inputProps.sx }} />
                  
                  {error && <Alert severity="error" sx={{ mb: 3, borderRadius: "10px" }}>{error}</Alert>}

                  <Button type="submit" disabled={busy} fullWidth sx={{
                    bgcolor: M.primary, color: M.onPrimary, fontWeight: 700, borderRadius: "12px", py: 1.5,
                    boxShadow: "0 8px 20px -8px rgba(37,99,235,.6)",
                    "&:hover": { bgcolor: M.primaryDark }
                  }}>
                    {busy ? "Verifying…" : "Verify code"}
                  </Button>
                  <Button disabled={busy} onClick={() => setStep(1)} fullWidth sx={{ mt: 2, color: M.textMuted, fontWeight: 600, "&:hover": { bgcolor: "transparent", color: M.text } }}>
                    Go back
                  </Button>
                </form>
              </Paper>
            ) : (
              <Paper sx={{ p: { xs: 4, md: 5 }, borderRadius: "24px", border: `1px solid ${M.border}`, boxShadow: "0 20px 40px -20px rgba(15,23,42,.15)", bgcolor: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)" }}>
                <Box sx={{ textAlign: "center", mb: 4 }}>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: M.text, mb: 1, letterSpacing: "-0.02em" }}>{lang === "bn" ? "স্টকহুইস্ক রিসেলার পার্টনার হন" : "Become a StockWhisk Reseller"}</Typography>
                  <Typography sx={{ color: M.textMuted, fontSize: "1.05rem" }}>{lang === "bn" ? "আপনার রেফারকৃত প্রতিটি শপ থেকে আকর্ষণীয় কমিশন ও প্রফিট শেয়ারিং অর্জন করুন।" : "Earn a share of the profit from shops you refer."}</Typography>
                </Box>
                
                <form onSubmit={submit}>
                  <Grid container spacing={2.5}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField fullWidth label="Full name *" variant="outlined" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} required {...inputProps} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField fullWidth label="Email *" type="email" variant="outlined" value={form.email} onChange={(e) => set("email", e.target.value)} required {...inputProps} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField fullWidth label="Phone" variant="outlined" value={form.phone} onChange={(e) => set("phone", e.target.value)} {...inputProps} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField fullWidth label="Company / business name" variant="outlined" value={form.company_name} onChange={(e) => set("company_name", e.target.value)} {...inputProps} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField fullWidth label="Country" variant="outlined" value={form.country} onChange={(e) => set("country", e.target.value)} {...inputProps} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField fullWidth label="Address" variant="outlined" value={form.address} onChange={(e) => set("address", e.target.value)} {...inputProps} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField fullWidth label="Password *" type="password" variant="outlined" value={form.password} onChange={(e) => set("password", e.target.value)} required {...inputProps} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField fullWidth label="Confirm password *" type="password" variant="outlined" value={form.confirm_password} onChange={(e) => set("confirm_password", e.target.value)} required {...inputProps} />
                    </Grid>
                  </Grid>

                  {error && <Alert severity="error" sx={{ mt: 3, borderRadius: "10px" }}>{error}</Alert>}

                  <Box sx={{ mt: 4, display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: "center", justifyContent: "space-between", gap: 2 }}>
                    <Typography component={Link} href="/reseller/login" sx={{ color: M.textMuted, textDecoration: "none", fontWeight: 600, "&:hover": { color: M.primary } }}>
                      Already a partner? Sign in
                    </Typography>
                    <Button type="submit" disabled={busy} sx={{
                      bgcolor: M.primary, color: M.onPrimary, fontWeight: 700, borderRadius: "12px", px: 4, py: 1.5,
                      boxShadow: "0 8px 20px -8px rgba(37,99,235,.6)",
                      "&:hover": { bgcolor: M.primaryDark }
                    }}>
                      {busy ? "Submitting…" : "Register"}
                    </Button>
                  </Box>
                </form>
              </Paper>
            )}
          </Container>
        </Box>

        <MarketingFooter />
      </Box>
    </PublicThemeProvider>
  );
}
