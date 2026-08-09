"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Box, Typography, Button, Container, Stack, Grid, Card, CardContent, CardMedia, Chip } from '@mui/material';
import { getAccess, api, unwrap } from "@/lib/api";
import { useThemeMode } from "@/components/ThemeRegistry";

const LIGHT_COLORS = {
  surface: '#f8f9ff',
  onSurface: '#0b1c30',
  onSurfaceVariant: '#434655',
  primary: '#004ac6',
  onPrimary: '#ffffff',
  surfaceTint: '#0053db',
  surfaceContainerLowest: '#ffffff',
  surfaceContainer: '#e5eeff',
  surfaceContainerLow: '#eff4ff',
  outlineVariant: '#c3c6d7',
  outline: '#737686',
};

const DARK_COLORS = {
  surface: '#0f172a',
  onSurface: '#f8fafc',
  onSurfaceVariant: '#cbd5e1',
  primary: '#38bdf8',
  onPrimary: '#020617',
  surfaceTint: '#7dd3fc',
  surfaceContainerLowest: '#020617',
  surfaceContainer: '#1e293b',
  surfaceContainerLow: '#0f172a',
  outlineVariant: '#334155',
  outline: '#475569',
};

type BlogPost = {
  title: string;
  slug: string;
  excerpt: string;
  published_at: string;
  cover_image_url: string;
};

export default function BlogListPage() {
  const { mode } = useThemeMode();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  const COLORS = mounted && mode === 'dark' ? DARK_COLORS : LIGHT_COLORS;

  useEffect(() => {
    setMounted(true);
    setIsLoggedIn(!!getAccess());
    api<any>("/platform/public/blogs/")
      .then((data) => {
        setBlogs(unwrap(data));
      })
      .catch((e) => console.error("Failed to load blogs", e))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: COLORS.surface, color: COLORS.onSurface, fontFamily: 'Outfit, sans-serif' }}>
      
      {/* Navigation */}
      <Box sx={{ bgcolor: COLORS.surface, borderBottom: `1px solid ${COLORS.outlineVariant}`, position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
        <Container maxWidth="xl">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '64px' }}>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: COLORS.primary, fontFamily: 'Outfit, sans-serif' }}>
                StockWhisk
              </Typography>
            </Link>
            
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <Button component={Link} href="/blog" sx={{ color: COLORS.onSurface, fontWeight: 600, textTransform: 'none' }}>
                Blog
              </Button>
              {mounted && isLoggedIn ? (
                <Button component={Link} href="/app" sx={{ bgcolor: COLORS.primary, color: COLORS.onPrimary, fontWeight: 600, textTransform: 'none', borderRadius: '8px', px: 3, '&:hover': { bgcolor: COLORS.surfaceTint }}}>
                  Dashboard
                </Button>
              ) : (
                <Button component={Link} href="/login" sx={{ color: COLORS.onSurfaceVariant, fontWeight: 600, textTransform: 'none', '&:hover': { color: COLORS.primary }}}>
                  Login
                </Button>
              )}
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1, py: { xs: 6, md: 10 } }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography variant="h2" sx={{ fontWeight: 700, mb: 2, fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.02em', fontSize: { xs: '2.5rem', md: '3.5rem' } }}>
              StockWhisk Journal
            </Typography>
            <Typography variant="h6" sx={{ color: COLORS.onSurfaceVariant, fontWeight: 400, maxWidth: '600px', mx: 'auto', fontFamily: 'Outfit, sans-serif' }}>
              Insights, updates, and modern retail strategies to help you run your shop smarter.
            </Typography>
          </Box>

          {loading ? (
            <Box sx={{ textAlign: 'center', py: 10 }}>
              <Typography sx={{ color: COLORS.onSurfaceVariant }}>Loading articles...</Typography>
            </Box>
          ) : blogs.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 10, bgcolor: COLORS.surfaceContainerLowest, borderRadius: 4, border: `1px solid ${COLORS.outlineVariant}` }}>
              <Typography sx={{ color: COLORS.onSurfaceVariant }}>Check back soon for our first post!</Typography>
            </Box>
          ) : (
            <Grid container spacing={4}>
              {blogs.map((blog) => (
                <Grid size={{ xs: 12, md: 6, lg: 4 }} key={blog.slug}>
                  <Card 
                    elevation={0}
                    sx={{ 
                      height: '100%', 
                      display: 'flex', 
                      flexDirection: 'column',
                      bgcolor: COLORS.surfaceContainerLowest,
                      border: `1px solid ${COLORS.outlineVariant}`,
                      borderRadius: '16px',
                      transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 12px 24px -10px rgba(0,0,0,0.1)'
                      }
                    }}
                  >
                    <Link href={`/blog/${blog.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <CardMedia
                        component="img"
                        height="200"
                        image={blog.cover_image_url || 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'}
                        alt={blog.title}
                        sx={{ borderBottom: `1px solid ${COLORS.outlineVariant}` }}
                      />
                      <CardContent sx={{ flexGrow: 1, p: 3 }}>
                        <Typography sx={{ fontSize: '0.85rem', color: COLORS.primary, fontWeight: 600, mb: 1, fontFamily: 'Outfit, sans-serif' }}>
                          {new Date(blog.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, fontFamily: 'Outfit, sans-serif', lineHeight: 1.3 }}>
                          {blog.title}
                        </Typography>
                        <Typography variant="body2" sx={{ color: COLORS.onSurfaceVariant, fontFamily: 'Outfit, sans-serif', lineHeight: 1.6 }}>
                          {blog.excerpt || "Read more about this topic inside..."}
                        </Typography>
                      </CardContent>
                    </Link>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Container>
      </Box>

      {/* Footer */}
      <Box component="footer" sx={{ bgcolor: COLORS.surfaceContainerLowest, borderTop: `1px solid ${COLORS.outlineVariant}`, mt: 'auto', py: 6 }}>
        <Container maxWidth="xl">
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 45%' } }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: COLORS.primary, mb: 1, fontFamily: 'Outfit, sans-serif' }}>
                StockWhisk
              </Typography>
              <Typography variant="body2" sx={{ color: COLORS.onSurfaceVariant, fontFamily: 'Outfit, sans-serif' }}>
                © {new Date().getFullYear()} StockWhisk Inc. All rights reserved.
              </Typography>
            </Box>
            <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 45%' }, display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: { xs: 4, md: 8 } }}>
              <Stack spacing={1}>
                <Typography sx={{ fontWeight: 700, color: COLORS.onSurface, fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem' }}>Product</Typography>
                <Link href="/blog" style={{ color: COLORS.onSurfaceVariant, textDecoration: 'none', fontSize: '0.875rem' }}>Blog</Link>
                <Link href="/login" style={{ color: COLORS.onSurfaceVariant, textDecoration: 'none', fontSize: '0.875rem' }}>Login</Link>
              </Stack>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
