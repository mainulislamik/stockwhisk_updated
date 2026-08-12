"use client";

import { useState } from "react";
import { Box, Typography, Button, Container, Grid, Card, CardContent, TextField, Stack } from "@mui/material";
import MarketingNav from "@/components/MarketingNav";
import { api } from "@/lib/api";
import { M } from "@/lib/marketing";

const COLORS = {
  surface: M.surface,
  onSurface: M.text,
  onSurfaceVariant: M.textMuted,
  primary: M.primary,
  surfaceContainerLowest: M.card,
  outlineVariant: M.border,
};

// Phone / WhatsApp for the business (Bangladesh).
const PHONE_DISPLAY = "01613511887";
const PHONE_TEL = "+8801613511887";
const WHATSAPP = "8801613511887"; // wa.me international format
const EMAIL = "contact@stockwhisk.com";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError("Please fill in your name, email and message.");
      return;
    }
    setSending(true);
    try {
      await api("/platform/public/contact/", { method: "POST", body: form });
      setSent(true);
      setForm({ name: "", email: "", phone: "", subject: "", message: "" });
    } catch (err: any) {
      setError(err?.message || "Could not send your message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const infoCards = [
    { icon: "📞", label: "Call us", value: PHONE_DISPLAY, href: `tel:${PHONE_TEL}` },
    { icon: "💬", label: "WhatsApp", value: PHONE_DISPLAY, href: `https://wa.me/${WHATSAPP}` },
    { icon: "✉️", label: "Email", value: EMAIL, href: `mailto:${EMAIL}` },
  ];

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", bgcolor: COLORS.surface, color: COLORS.onSurface, fontFamily: "Outfit, sans-serif" }}>
      <MarketingNav />

      <Box component="main" sx={{ flexGrow: 1 }}>
        {/* Hero */}
        <Box sx={{ py: { xs: 6, md: 9 }, textAlign: "center" }}>
          <Container maxWidth="md">
            <Typography variant="h3" sx={{ fontWeight: 700, mb: 2, fontSize: { xs: "2rem", md: "3rem" } }}>
              Contact Us
            </Typography>
            <Typography sx={{ color: COLORS.onSurfaceVariant, fontSize: "1.1rem" }}>
              Questions about StockWhisk inventory & POS software? Send us a message or reach us on phone / WhatsApp — we usually reply within a few hours.
            </Typography>
          </Container>
        </Box>

        <Container maxWidth="lg" sx={{ pb: 8 }}>
          <Grid container spacing={4}>
            {/* Contact info */}
            <Grid size={{ xs: 12, md: 5 }}>
              <Stack spacing={2}>
                {infoCards.map((c) => (
                  <Card
                    key={c.label}
                    component="a"
                    href={c.href}
                    target={c.href.startsWith("http") ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    sx={{
                      textDecoration: "none",
                      bgcolor: COLORS.surfaceContainerLowest,
                      border: `1px solid ${COLORS.outlineVariant}`,
                      borderRadius: 3, transition: "transform .15s, box-shadow .15s",
                      "&:hover": { transform: "translateY(-2px)", boxShadow: 3 },
                    }}
                  >
                    <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <Box sx={{ fontSize: "1.8rem" }}>{c.icon}</Box>
                      <Box>
                        <Typography sx={{ color: COLORS.onSurfaceVariant, fontSize: ".8rem", textTransform: "uppercase", letterSpacing: ".5px" }}>
                          {c.label}
                        </Typography>
                        <Typography sx={{ color: COLORS.onSurface, fontWeight: 600 }}>{c.value}</Typography>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Grid>

            {/* Form */}
            <Grid size={{ xs: 12, md: 7 }}>
              <Card sx={{ bgcolor: COLORS.surfaceContainerLowest, border: `1px solid ${COLORS.outlineVariant}`, borderRadius: 3 }}>
                <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                  {sent ? (
                    <Box sx={{ textAlign: "center", py: 5 }}>
                      <Box sx={{ fontSize: "3rem", mb: 1 }}>✅</Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Message sent!</Typography>
                      <Typography sx={{ color: COLORS.onSurfaceVariant, mb: 3 }}>
                        Thanks for reaching out. We&apos;ll get back to you at your email soon.
                      </Typography>
                      <Button variant="outlined" onClick={() => setSent(false)}>Send another message</Button>
                    </Box>
                  ) : (
                    <Box component="form" onSubmit={submit}>
                      <Stack spacing={2.5}>
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField label="Your name" fullWidth required value={form.name} onChange={set("name")} />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField label="Email" type="email" fullWidth required value={form.email} onChange={set("email")} />
                          </Grid>
                        </Grid>
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField label="Phone (optional)" fullWidth value={form.phone} onChange={set("phone")} />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField label="Subject (optional)" fullWidth value={form.subject} onChange={set("subject")} />
                          </Grid>
                        </Grid>
                        <TextField label="Message" fullWidth required multiline minRows={5} value={form.message} onChange={set("message")} />
                        {error && <Typography sx={{ color: "#dc2626", fontSize: ".9rem" }}>{error}</Typography>}

                        <Button type="submit" variant="contained" size="large" disabled={sending} sx={{ alignSelf: "flex-start", px: 4, borderRadius: 2, textTransform: "none", fontWeight: 600 }}>
                          {sending ? "Sending…" : "Send message"}
                        </Button>
                      </Stack>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ bgcolor: M.dark, color: M.darkText, py: 4, mt: "auto" }}>
        <Container maxWidth="xl">
          <Typography variant="body2" align="center" sx={{ fontFamily: "Outfit, sans-serif" }}>
            © {new Date().getFullYear()} StockWhisk. All rights reserved.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
