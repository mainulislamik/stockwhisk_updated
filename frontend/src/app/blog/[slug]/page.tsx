"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Box, Typography, Button, Container, Stack, Avatar } from '@mui/material';
import MarketingNav from '@/components/MarketingNav';
import { getAccess, api } from "@/lib/api";
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
  content: string;
  published_at: string;
  cover_image_url: string;
};

export default function BlogDetailPage() {
  const params = useParams();
  const { mode } = useThemeMode();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [blog, setBlog] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  const COLORS = mounted && mode === 'dark' ? DARK_COLORS : LIGHT_COLORS;

  useEffect(() => {
    setMounted(true);
    setIsLoggedIn(!!getAccess());
    api<BlogPost>(`/platform/public/blogs/${params.slug}/`)
      .then((data) => {
        setBlog(data);
      })
      .catch((e) => console.error("Failed to load blog", e))
      .finally(() => setLoading(false));
  }, [params.slug]);

  if (!mounted) return null;

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: COLORS.surface, color: COLORS.onSurface, fontFamily: 'Outfit, sans-serif' }}>
      
      {/* Navigation */}
      <MarketingNav />

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1, py: { xs: 6, md: 10 } }}>
        <Container maxWidth="md">
          {loading ? (
             <Box sx={{ textAlign: 'center', py: 10 }}>
               <Typography sx={{ color: COLORS.onSurfaceVariant }}>Loading article...</Typography>
             </Box>
          ) : !blog ? (
             <Box sx={{ textAlign: 'center', py: 10 }}>
               <Typography variant="h4" sx={{ mb: 2 }}>Post not found.</Typography>
               <Button component={Link} href="/blog" sx={{ color: COLORS.primary }}>← Back to Blog</Button>
             </Box>
          ) : (
            <article>
              <Box sx={{ mb: 6, textAlign: 'center' }}>
                <Typography sx={{ color: COLORS.primary, fontWeight: 600, mb: 2, fontFamily: 'Outfit, sans-serif', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {new Date(blog.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </Typography>
                <Typography variant="h2" sx={{ fontWeight: 800, mb: 4, fontFamily: 'Outfit, sans-serif', fontSize: { xs: '2.5rem', md: '3.5rem' }, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
                  {blog.title}
                </Typography>
                
                <Stack direction="row" spacing={2} sx={{ justifyContent: 'center', alignItems: 'center', mb: 6 }}>
                  <Avatar sx={{ bgcolor: COLORS.surfaceContainer, color: COLORS.primary, border: `1px solid ${COLORS.outlineVariant}` }}>S</Avatar>
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>StockWhisk Team</Typography>
                  </Box>
                </Stack>
              </Box>

              {blog.cover_image_url && (
                <Box sx={{ mb: 8, borderRadius: '16px', overflow: 'hidden', border: `1px solid ${COLORS.outlineVariant}`, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                  <img src={blog.cover_image_url} alt={blog.title} style={{ width: '100%', height: 'auto', display: 'block' }} />
                </Box>
              )}

              <Box 
                sx={{ 
                  '& p': { mb: 3, lineHeight: 1.8, fontSize: '1.1rem', color: COLORS.onSurfaceVariant, fontFamily: 'Outfit, sans-serif' },
                  '& h2': { mt: 6, mb: 3, fontWeight: 700, fontFamily: 'Outfit, sans-serif', fontSize: '2rem' },
                  '& h3': { mt: 5, mb: 2, fontWeight: 700, fontFamily: 'Outfit, sans-serif', fontSize: '1.5rem' },
                  '& ul, & ol': { mb: 3, pl: 4, fontSize: '1.1rem', color: COLORS.onSurfaceVariant, lineHeight: 1.8 },
                  '& li': { mb: 1 },
                  '& a': { color: COLORS.primary, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } },
                  '& blockquote': { borderLeft: `4px solid ${COLORS.primary}`, pl: 3, ml: 0, my: 4, fontStyle: 'italic', color: COLORS.onSurfaceVariant }
                }}
                dangerouslySetInnerHTML={{ __html: blog.content }} 
              />
            </article>
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
