"use client";

import Link from "next/link";
import { Box, Typography, Button, Container, Stack, Grid } from "@mui/material";
import MarketingNav from "@/components/MarketingNav";
import { M } from "@/lib/marketing";

const FEATURES = [
  { icon: "bi-upc-scan", title: "Barcode POS", desc: "Scan-and-sell checkout with per-unit barcodes, shared-barcode picker and mobile camera scanning." },
  { icon: "bi-box-seam", title: "Inventory & Stock", desc: "Real-time stock levels, purchase receiving, adjustments and low-stock alerts across branches." },
  { icon: "bi-shield-check", title: "Warranty Tracking", desc: "Auto-record warranty per sold unit, track coverage and service tickets, expire automatically." },
  { icon: "bi-graph-up-arrow", title: "Sales & Reports", desc: "Daily sales, profit margins, top products and exportable reports — clarity at a glance." },
  { icon: "bi-people", title: "Customers & Suppliers", desc: "Customer dues, supplier balances, EMI installments and full purchase history in one place." },
  { icon: "bi-diagram-3", title: "Multi-branch & Staff", desc: "Run multiple outlets, add staff with roles and permissions, keep every branch in sync." },
];

const STATS = [
  { value: "45-day", label: "Free trial" },
  { value: "< 30s", label: "Per checkout" },
  { value: "24/7", label: "Cloud access" },
  { value: "100%", label: "Data ownership" },
];

const btnPrimary = {
  bgcolor: M.primary, color: M.onPrimary, fontWeight: 700, textTransform: "none" as const,
  borderRadius: "12px", px: 4, py: 1.5, fontSize: "1rem",
  boxShadow: "0 10px 24px -8px rgba(37,99,235,.65)",
  "&:hover": { bgcolor: M.primaryDark },
};
const btnGhost = {
  bgcolor: M.card, color: M.text, border: `1px solid ${M.borderStrong}`,
  fontWeight: 700, textTransform: "none" as const, borderRadius: "12px", px: 4, py: 1.5, fontSize: "1rem",
  "&:hover": { bgcolor: M.surfaceTint, borderColor: M.primary, color: M.primary },
};

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Box sx={{
      flex: 1, bgcolor: accent ? M.primary : M.card, color: accent ? "#fff" : M.text,
      border: `1px solid ${accent ? "transparent" : M.border}`, borderRadius: "12px", p: 1.5,
    }}>
      <Typography sx={{ fontSize: ".68rem", opacity: accent ? 0.85 : 0.6, fontWeight: 600 }}>{label}</Typography>
      <Typography sx={{ fontSize: "1.1rem", fontWeight: 800, lineHeight: 1.2 }}>{value}</Typography>
    </Box>
  );
}

export default function LandingPage() {
  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", bgcolor: M.surface, color: M.text, fontFamily: "Outfit, sans-serif" }}>
      <MarketingNav />

      <Box component="main" sx={{ flexGrow: 1 }}>
        {/* ── Hero ── */}
        <Box sx={{
          position: "relative", overflow: "hidden",
          background: `radial-gradient(1200px 500px at 50% -10%, ${M.surfaceAlt} 0%, ${M.surface} 60%)`,
          pt: { xs: 7, md: 11 }, pb: { xs: 7, md: 10 },
        }}>
          <Container maxWidth="lg">
            <Box sx={{ textAlign: "center", maxWidth: 860, mx: "auto" }}>
              <Box sx={{
                display: "inline-flex", alignItems: "center", gap: 1, mb: 3,
                px: 2, py: 0.75, borderRadius: 999, bgcolor: M.card,
                border: `1px solid ${M.border}`, color: M.primary, fontWeight: 700, fontSize: ".85rem",
                boxShadow: "0 2px 10px -4px rgba(15,23,42,.12)",
              }}>
                <i className="bi bi-stars" /> Inventory &amp; POS, reimagined for retail
              </Box>
              <Typography component="h1" sx={{
                fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1,
                fontSize: { xs: "2.4rem", md: "3.8rem" }, mb: 2.5,
              }}>
                Run your shop smarter with{" "}
                <Box component="span" sx={{ background: `linear-gradient(120deg, ${M.primary}, ${M.accent})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  StockWhisk
                </Box>
              </Typography>
              <Typography sx={{ color: M.textMuted, fontSize: { xs: "1.05rem", md: "1.2rem" }, lineHeight: 1.6, maxWidth: 680, mx: "auto", mb: 4 }}>
                The all-in-one retail platform for barcode billing, live inventory, warranty tracking and sales insight — fast, clear, and built for the way real shops work.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "center" }}>
                <Button component={Link} href="/register" sx={btnPrimary}>Start free trial</Button>
                <Button component={Link} href="/pricing" sx={btnGhost}>See pricing</Button>
              </Stack>
            </Box>

            {/* Self-contained dashboard preview (no external image) */}
            <Box sx={{
              mt: { xs: 5, md: 7 }, maxWidth: 980, mx: "auto",
              borderRadius: "20px", border: `1px solid ${M.border}`, bgcolor: M.card,
              boxShadow: "0 30px 60px -30px rgba(15,23,42,.35)", overflow: "hidden",
            }}>
              {/* window bar */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.25, borderBottom: `1px solid ${M.border}`, bgcolor: M.surfaceTint }}>
                {["#ef4444", "#f59e0b", "#22c55e"].map((c) => (<Box key={c} sx={{ width: 11, height: 11, borderRadius: 999, bgcolor: c }} />))}
                <Typography sx={{ ml: 1.5, fontSize: ".8rem", color: M.textFaint, fontWeight: 600 }}>stockwhisk.com/app</Typography>
              </Box>
              <Box sx={{ display: "flex", minHeight: { xs: 220, md: 320 } }}>
                {/* sidebar */}
                <Box sx={{ width: { xs: 0, sm: 190 }, display: { xs: "none", sm: "block" }, borderRight: `1px solid ${M.border}`, p: 2 }}>
                  <Box sx={{ height: 10, width: "60%", bgcolor: M.primary, borderRadius: 999, mb: 2.5, opacity: .9 }} />
                  {["Dashboard", "POS", "Products", "Inventory", "Reports"].map((t, i) => (
                    <Box key={t} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, opacity: i === 1 ? 1 : 0.5 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: 2, bgcolor: i === 1 ? M.primary : M.textFaint }} />
                      <Typography sx={{ fontSize: ".8rem", fontWeight: i === 1 ? 700 : 500, color: i === 1 ? M.primary : M.textMuted }}>{t}</Typography>
                    </Box>
                  ))}
                </Box>
                {/* content */}
                <Box sx={{ flex: 1, p: { xs: 2, md: 3 } }}>
                  <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
                    <MiniStat label="Today's Sales" value="৳ 48,250" accent />
                    <MiniStat label="Orders" value="126" />
                    <MiniStat label="Low Stock" value="7" />
                  </Stack>
                  {/* fake bar chart */}
                  <Box sx={{ bgcolor: M.surfaceTint, border: `1px solid ${M.border}`, borderRadius: "12px", p: 2 }}>
                    <Typography sx={{ fontSize: ".78rem", color: M.textFaint, fontWeight: 700, mb: 1.5 }}>Sales this week</Typography>
                    <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1, height: { xs: 90, md: 140 } }}>
                      {[45, 62, 38, 78, 55, 90, 70].map((h, i) => (
                        <Box key={i} sx={{ flex: 1, height: `${h}%`, borderRadius: "6px 6px 0 0",
                          background: `linear-gradient(180deg, ${M.accent}, ${M.primary})`, opacity: 0.85 + (i === 5 ? 0.15 : 0) }} />
                      ))}
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Container>
        </Box>

        {/* ── Features ── */}
        <Box sx={{ py: { xs: 7, md: 11 } }}>
          <Container maxWidth="lg">
            <Box sx={{ textAlign: "center", mb: { xs: 5, md: 7 } }}>
              <Typography sx={{ color: M.primary, fontWeight: 800, letterSpacing: ".08em", fontSize: ".85rem", textTransform: "uppercase", mb: 1 }}>
                Everything your shop needs
              </Typography>
              <Typography component="h2" sx={{ fontWeight: 800, letterSpacing: "-0.02em", fontSize: { xs: "1.9rem", md: "2.6rem" } }}>
                One platform, from purchase to profit
              </Typography>
            </Box>
            <Grid container spacing={3}>
              {FEATURES.map((f) => (
                <Grid key={f.title} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Box sx={{
                    height: "100%", bgcolor: M.card, border: `1px solid ${M.border}`, borderRadius: "16px", p: 3,
                    transition: "transform .15s, box-shadow .15s, border-color .15s",
                    "&:hover": { transform: "translateY(-4px)", boxShadow: "0 20px 40px -24px rgba(15,23,42,.35)", borderColor: M.primary },
                  }}>
                    <Box sx={{
                      width: 48, height: 48, borderRadius: "12px", mb: 2, display: "flex", alignItems: "center", justifyContent: "center",
                      color: M.primary, fontSize: "1.5rem", background: `linear-gradient(135deg, ${M.surfaceAlt}, #dbeafe)`,
                    }}>
                      <i className={`bi ${f.icon}`} />
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontSize: "1.15rem", mb: 1 }}>{f.title}</Typography>
                    <Typography sx={{ color: M.textMuted, fontSize: ".95rem", lineHeight: 1.6 }}>{f.desc}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* ── Stats band ── */}
        <Box sx={{ bgcolor: M.surfaceAlt, borderTop: `1px solid ${M.border}`, borderBottom: `1px solid ${M.border}`, py: { xs: 5, md: 7 } }}>
          <Container maxWidth="lg">
            <Grid container spacing={2}>
              {STATS.map((s) => (
                <Grid key={s.label} size={{ xs: 6, md: 3 }} sx={{ textAlign: "center" }}>
                  <Typography sx={{ fontWeight: 800, fontSize: { xs: "1.8rem", md: "2.4rem" }, color: M.primary, letterSpacing: "-0.02em" }}>{s.value}</Typography>
                  <Typography sx={{ color: M.textMuted, fontWeight: 600, fontSize: ".9rem" }}>{s.label}</Typography>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* ── Final CTA ── */}
        <Box sx={{ py: { xs: 8, md: 12 } }}>
          <Container maxWidth="md">
            <Box sx={{
              textAlign: "center", borderRadius: "28px", px: { xs: 3, md: 8 }, py: { xs: 6, md: 8 },
              background: `linear-gradient(135deg, ${M.primaryDark}, ${M.primary})`, color: "#fff",
              boxShadow: "0 40px 80px -40px rgba(37,99,235,.7)",
            }}>
              <Typography component="h2" sx={{ fontWeight: 800, letterSpacing: "-0.02em", fontSize: { xs: "1.8rem", md: "2.6rem" }, mb: 2 }}>
                Ready to take control of your shop?
              </Typography>
              <Typography sx={{ opacity: 0.9, fontSize: { xs: "1rem", md: "1.15rem" }, mb: 4, maxWidth: 560, mx: "auto" }}>
                Set up in minutes and start your free trial today.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "center" }}>
                <Button component={Link} href="/register" sx={{ bgcolor: "#fff", color: M.primaryDark, fontWeight: 800, textTransform: "none", borderRadius: "12px", px: 4, py: 1.5, "&:hover": { bgcolor: "#eef2ff" } }}>
                  Start free trial
                </Button>
                <Button component={Link} href="/contact" sx={{ color: "#fff", border: "1px solid rgba(255,255,255,.5)", fontWeight: 700, textTransform: "none", borderRadius: "12px", px: 4, py: 1.5, "&:hover": { bgcolor: "rgba(255,255,255,.12)" } }}>
                  Talk to us
                </Button>
              </Stack>
            </Box>
          </Container>
        </Box>
      </Box>

      {/* ── Footer ── */}
      <Box component="footer" sx={{ bgcolor: M.dark, color: M.darkText, py: 6 }}>
        <Container maxWidth="xl">
          <Grid container spacing={4}>
            <Grid size={{ xs: 12, md: 5 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, color: "#fff", mb: 1, fontFamily: "Outfit, sans-serif" }}>📦 StockWhisk</Typography>
              <Typography variant="body2" sx={{ maxWidth: 340, lineHeight: 1.7 }}>
                Cloud inventory management &amp; POS software for retail shops — barcode billing, stock control, warranty and reports.
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography sx={{ fontWeight: 700, color: "#fff", mb: 1.5, fontSize: ".9rem" }}>Product</Typography>
              <Stack spacing={1}>
                <Link href="/pricing" style={{ color: M.darkText, textDecoration: "none", fontSize: ".9rem" }}>Pricing</Link>
                <Link href="/blog" style={{ color: M.darkText, textDecoration: "none", fontSize: ".9rem" }}>Blog</Link>
                <Link href="/contact" style={{ color: M.darkText, textDecoration: "none", fontSize: ".9rem" }}>Contact</Link>
              </Stack>
            </Grid>
            <Grid size={{ xs: 6, md: 4 }}>
              <Typography sx={{ fontWeight: 700, color: "#fff", mb: 1.5, fontSize: ".9rem" }}>Get started</Typography>
              <Stack spacing={1}>
                <Link href="/register" style={{ color: M.darkText, textDecoration: "none", fontSize: ".9rem" }}>Create account</Link>
                <Link href="/login" style={{ color: M.darkText, textDecoration: "none", fontSize: ".9rem" }}>Login</Link>
              </Stack>
            </Grid>
          </Grid>
          <Typography variant="body2" sx={{ mt: 5, pt: 3, borderTop: `1px solid rgba(255,255,255,.1)`, fontSize: ".85rem" }}>
            © {new Date().getFullYear()} StockWhisk. All rights reserved.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
