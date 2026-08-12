"use client";

import Link from "next/link";
import { Box, Container, Grid, Stack, Typography } from "@mui/material";
import { M } from "@/lib/marketing";

/** Shared footer for every public/marketing page. */
export default function MarketingFooter() {
  const linkSx = { color: M.darkText, textDecoration: "none", fontSize: ".9rem" };
  return (
    <Box component="footer" sx={{ bgcolor: M.dark, color: M.darkText, py: 6, mt: "auto" }}>
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
              <Link href="/pricing" style={linkSx}>Pricing</Link>
              <Link href="/blog" style={linkSx}>Blog</Link>
              <Link href="/contact" style={linkSx}>Contact</Link>
            </Stack>
          </Grid>
          <Grid size={{ xs: 6, md: 4 }}>
            <Typography sx={{ fontWeight: 700, color: "#fff", mb: 1.5, fontSize: ".9rem" }}>Get started</Typography>
            <Stack spacing={1}>
              <Link href="/register" style={linkSx}>Create account</Link>
              <Link href="/login" style={linkSx}>Login</Link>
            </Stack>
          </Grid>
        </Grid>
        <Typography variant="body2" sx={{ mt: 5, pt: 3, borderTop: `1px solid rgba(255,255,255,.1)`, fontSize: ".85rem" }}>
          © {new Date().getFullYear()} StockWhisk. All rights reserved.
        </Typography>
      </Container>
    </Box>
  );
}
