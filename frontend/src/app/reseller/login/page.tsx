"use client";

import { useLanguage } from "@/contexts/LanguageContext";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, setTokens } from "@/lib/api";
import { Box, Button, Container, Typography, TextField, Alert, Paper, Stack } from "@mui/material";
import PublicThemeProvider from "@/components/PublicThemeProvider";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";
import { M } from "@/lib/marketing";

export default function ResellerLoginPage() {
  const { lang, t } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const r = await api<{ access: string; refresh: string }>("/reseller/login/", { method: "POST", body: { email, password } });
      setTokens(r.access, r.refresh);
      router.push("/reseller/dashboard");
    } catch (err: any) {
      setError(err?.data?.detail || "Login failed.");
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
          
          <Container maxWidth="xs" sx={{ position: "relative", zIndex: 1 }}>
            <Paper sx={{ p: { xs: 4, md: 5 }, borderRadius: "24px", border: `1px solid ${M.border}`, boxShadow: "0 20px 40px -20px rgba(15,23,42,.15)", bgcolor: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)" }}>
              <Box sx={{ textAlign: "center", mb: 4 }}>
                <Typography variant="h4" sx={{ fontWeight: 800, color: M.text, mb: 1, letterSpacing: "-0.02em" }}>{lang === "bn" ? "স্টকহুইস্ক পার্টনার পোর্টাল" : "StockWhisk Partner"}</Typography>
                <Typography sx={{ color: M.textMuted, fontSize: "1.05rem" }}>{lang === "bn" ? "রিসেলার একাউন্টে লগইন করুন" : "Reseller portal login"}</Typography>
              </Box>
              
              <form onSubmit={submit}>
                <Stack spacing={2.5}>
                  <TextField fullWidth label="Email" type="email" variant="outlined" value={email} onChange={(e) => setEmail(e.target.value)} required {...inputProps} />
                  <TextField fullWidth label="Password" type="password" variant="outlined" value={password} onChange={(e) => setPassword(e.target.value)} required {...inputProps} />
                  
                  {error && <Alert severity="error" sx={{ borderRadius: "10px" }}>{error}</Alert>}
                  
                  <Button type="submit" fullWidth disabled={busy} sx={{
                    bgcolor: M.primary, color: M.onPrimary, fontWeight: 700, borderRadius: "12px", py: 1.5, mt: 1,
                    boxShadow: "0 8px 20px -8px rgba(37,99,235,.6)",
                    "&:hover": { bgcolor: M.primaryDark }
                  }}>
                    {busy ? "Signing in…" : "Sign in"}
                  </Button>
                </Stack>
              </form>
              
              <Box sx={{ mt: 4, textAlign: "center" }}>
                <Typography sx={{ color: M.textMuted, fontSize: ".9rem" }}>
                  Not a partner yet? <Typography component={Link} href="/reseller/register" sx={{ color: M.primary, textDecoration: "none", fontWeight: 700, ml: 1, "&:hover": { textDecoration: "underline" } }}>{lang === "bn" ? "নতুন রিসেলার হতে আবেদন করুন" : "Become a reseller"}</Typography>
                </Typography>
              </Box>
            </Paper>
          </Container>
        </Box>

        <MarketingFooter />
      </Box>
    </PublicThemeProvider>
  );
}
