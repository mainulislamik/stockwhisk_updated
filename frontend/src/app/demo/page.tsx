"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Typography, Button, Container, TextField, Stack, Alert } from "@mui/material";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";
import PublicThemeProvider from "@/components/PublicThemeProvider";
import { useAuth } from "@/components/AuthProvider";
import { M } from "@/lib/marketing";

const DEMO_EMAIL = "admin@demo.stockwhisk.com";
const DEMO_PASSWORD = "admin";

export default function DemoPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function enterDemo(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      // "admin" is a friendly alias for the demo shop's owner account.
      const email = username.trim().toLowerCase() === "admin" ? DEMO_EMAIL : username.trim();
      const pass = username.trim().toLowerCase() === "admin" ? DEMO_PASSWORD : password;
      await login(email, pass);
      router.push("/app");
    } catch {
      setError("Demo is temporarily unavailable. Please try again shortly.");
      setBusy(false);
    }
  }

  const features = [
    { icon: "🛒", label: "POS & Billing" },
    { icon: "📦", label: "Inventory & Stock" },
    { icon: "📊", label: "Sales & Reports" },
    { icon: "👥", label: "Customers & Dues" },
    { icon: "🛡️", label: "Warranty Tracking" },
    { icon: "🧾", label: "Invoices" },
  ];

  return (
    <PublicThemeProvider>
      <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", bgcolor: M.surface, color: M.text, fontFamily: "Outfit, sans-serif" }}>
        <MarketingNav />

        <Box component="main" sx={{ flexGrow: 1, py: { xs: 6, md: 9 } }}>
          <Container maxWidth="md">
            <Box sx={{ textAlign: "center", mb: 5 }}>
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, mb: 2, px: 2, py: 0.75, borderRadius: 999, bgcolor: "rgba(16,185,129,0.12)", color: "#059669", fontWeight: 700, fontSize: ".85rem" }}>
                🔴 Live interactive demo · read-only
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 800, mb: 2, fontSize: { xs: "2rem", md: "2.8rem" }, letterSpacing: "-0.02em" }}>
                Explore the full owner dashboard
              </Typography>
              <Typography sx={{ color: M.textMuted, fontSize: "1.1rem", maxWidth: 620, mx: "auto" }}>
                Click below to enter a fully-populated demo shop. Browse every page — POS, inventory,
                sales, reports — with sample data. It&apos;s <strong>view-only</strong>, so nothing you do changes any data.
              </Typography>
            </Box>

            <Box sx={{ maxWidth: 460, mx: "auto", bgcolor: M.card, border: `1px solid ${M.border}`, borderRadius: 4, p: { xs: 3, md: 4 }, boxShadow: "0 20px 50px -30px rgba(15,23,42,.4)" }}>
              <Box component="form" onSubmit={enterDemo}>
                <Stack spacing={2}>
                  <TextField label="Username" fullWidth value={username} onChange={(e) => setUsername(e.target.value)} />
                  <TextField label="Password" type="password" fullWidth value={password} onChange={(e) => setPassword(e.target.value)} />
                  {error && <Alert severity="error" sx={{ py: 0 }}>{error}</Alert>}
                  <Button type="submit" variant="contained" size="large" disabled={busy}
                    sx={{ bgcolor: M.primary, fontWeight: 700, textTransform: "none", borderRadius: 2.5, py: 1.4, fontSize: "1rem", "&:hover": { bgcolor: M.primaryDark } }}>
                    {busy ? "Entering demo…" : "Enter Demo Shop →"}
                  </Button>
                </Stack>
              </Box>

              <Box sx={{ mt: 3, pt: 2.5, borderTop: `1px dashed ${M.borderStrong}`, textAlign: "center" }}>
                <Typography sx={{ color: M.textFaint, fontSize: ".85rem", mb: 0.5 }}>Demo login</Typography>
                <Typography sx={{ fontWeight: 700, color: M.text }}>
                  Username: <span style={{ color: M.primary }}>admin</span> &nbsp;·&nbsp; Password: <span style={{ color: M.primary }}>admin</span>
                </Typography>
                <Typography sx={{ color: M.textFaint, fontSize: ".8rem", mt: 1 }}>
                  These credentials only open the demo shop — not real accounts.
                </Typography>
              </Box>
            </Box>

            <Box sx={{ mt: 6 }}>
              <Typography sx={{ textAlign: "center", color: M.textFaint, fontWeight: 700, letterSpacing: ".08em", fontSize: ".8rem", textTransform: "uppercase", mb: 2 }}>
                What you can explore
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 1.5 }}>
                {features.map((f) => (
                  <Box key={f.label} sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1, bgcolor: M.card, border: `1px solid ${M.border}`, borderRadius: 999, fontWeight: 600, fontSize: ".9rem" }}>
                    <span>{f.icon}</span> {f.label}
                  </Box>
                ))}
              </Box>
            </Box>
          </Container>
        </Box>

        <MarketingFooter />
      </Box>
    </PublicThemeProvider>
  );
}
