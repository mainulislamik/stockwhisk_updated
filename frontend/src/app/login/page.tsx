"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";
import { Box, Card, Typography, TextField, Button, Alert, CircularProgress, Stack, IconButton } from '@mui/material';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useThemeMode } from '@/components/ThemeRegistry';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const { mode, toggleTheme } = useThemeMode();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      // Platform staff land on the admin dashboard; shop users on the app.
      const me = await api<{ is_staff: boolean }>("/auth/me/").catch(() => null);
      router.push(me?.is_staff ? "/platform" : "/app");
    } catch (err: any) {
      setError(err?.data?.detail || "No active account found with the given credentials.");
      setBusy(false);
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Card sx={{ p: { xs: 4, md: 5 }, width: '100%', maxWidth: '400px', position: 'relative' }}>
        <IconButton 
          onClick={toggleTheme} 
          sx={{ position: 'absolute', top: 16, right: 16 }}
          color="inherit"
        >
          {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
        </IconButton>
        <Box sx={{ textAlign: "center", mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>StockWhisk</Typography>
          <Typography variant="body2" color="text.secondary">Sign in to your shop</Typography>
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        <form onSubmit={onSubmit}>
          <Stack spacing={3}>
            <TextField
              label="Username or Email"
              variant="outlined"
              fullWidth
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              label="Password"
              type="password"
              variant="outlined"
              fullWidth
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={busy}
              startIcon={busy ? <CircularProgress size={20} color="inherit" /> : null}
            >
              {busy ? "Working..." : "Sign in"}
            </Button>
          </Stack>
        </form>
      </Card>
    </Box>
  );
}
