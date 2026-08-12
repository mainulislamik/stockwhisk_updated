"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Box, Typography, Button, Container, Stack, Grid, Card, CardContent, CardMedia, Chip } from '@mui/material';
import MarketingNav from '@/components/MarketingNav';
import { getAccess, api, unwrap } from "@/lib/api";
const LIGHT_COLORS = {
  surface: '#f8fafc',
  onSurface: '#0f172a',
  onSurfaceVariant: '#475569',
  primary: '#2563eb',
  onPrimary: '#ffffff',
  surfaceTint: '#1d4ed8',
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
  const mode: string = "light";
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
      <MarketingNav />

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1, py: { xs: 4, md: 8 }, px: { xs: 2, md: 0 } }}>
        <Container maxWidth="lg">
          {/* Hero Section */}
          <Box sx={{ 
            position: 'relative',
            textAlign: 'center', 
            mb: 8,
            py: { xs: 6, md: 10 },
            px: { xs: 3, md: 6 },
            borderRadius: '32px',
            background: mounted && mode === 'dark' 
              ? 'linear-gradient(145deg, rgba(30,41,59,0.6) 0%, rgba(15,23,42,0.9) 100%)' 
              : 'linear-gradient(145deg, #f0f5ff 0%, #ffffff 100%)',
            border: `1px solid ${COLORS.outlineVariant}`,
            boxShadow: mounted && mode === 'dark' ? '0 10px 40px -10px rgba(0,0,0,0.5)' : '0 10px 40px -10px rgba(0,0,0,0.05)',
            overflow: 'hidden'
          }}>
            {/* Decorative blobs */}
            <Box sx={{
              position: 'absolute', top: '-50%', left: '-10%', width: { xs: '300px', md: '500px' }, height: { xs: '300px', md: '500px' },
              background: mounted && mode === 'dark' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(0, 74, 198, 0.08)', 
              filter: 'blur(80px)', borderRadius: '50%', zIndex: 0
            }} />
            <Box sx={{
              position: 'absolute', bottom: '-50%', right: '-10%', width: { xs: '250px', md: '400px' }, height: { xs: '250px', md: '400px' },
              background: mounted && mode === 'dark' ? 'rgba(129, 140, 248, 0.15)' : 'rgba(67, 56, 202, 0.08)', 
              filter: 'blur(80px)', borderRadius: '50%', zIndex: 0
            }} />

            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Chip 
                label="The Official Blog" 
                sx={{ mb: 3, fontWeight: 700, bgcolor: COLORS.surfaceContainer, color: COLORS.primary, fontFamily: 'Outfit, sans-serif' }} 
              />
              <Typography variant="h2" sx={{ 
                fontWeight: 800, mb: 3, fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.03em', fontSize: { xs: '2.75rem', md: '4.5rem' },
                background: mounted && mode === 'dark' ? 'linear-gradient(to right, #38bdf8, #818cf8)' : 'linear-gradient(to right, #004ac6, #4338ca)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
              }}>
                StockWhisk Journal
              </Typography>
              <Typography variant="h6" sx={{ color: COLORS.onSurfaceVariant, fontWeight: 500, maxWidth: '650px', mx: 'auto', fontFamily: 'Outfit, sans-serif', fontSize: { xs: '1.1rem', md: '1.25rem' }, lineHeight: 1.6 }}>
                Insights, updates, and modern retail strategies to help you run your shop smarter and scale faster.
              </Typography>
            </Box>
          </Box>

          {loading ? (
            <Box sx={{ textAlign: 'center', py: 10 }}>
              <Typography sx={{ color: COLORS.onSurfaceVariant, fontWeight: 500, fontSize: '1.1rem' }}>Loading the latest articles...</Typography>
            </Box>
          ) : blogs.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 10, bgcolor: COLORS.surfaceContainerLowest, borderRadius: 4, border: `1px solid ${COLORS.outlineVariant}` }}>
              <Typography sx={{ color: COLORS.onSurfaceVariant, fontSize: '1.1rem' }}>Check back soon for our first post!</Typography>
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
                      bgcolor: mounted && mode === 'dark' ? 'rgba(30,41,59,0.4)' : '#ffffff',
                      backdropFilter: 'blur(12px)',
                      border: `1px solid ${COLORS.outlineVariant}`,
                      borderRadius: '24px',
                      overflow: 'hidden',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        transform: 'translateY(-8px)',
                        boxShadow: mounted && mode === 'dark' 
                          ? '0 20px 40px -10px rgba(0,0,0,0.5), 0 0 20px 0 rgba(56,189,248,0.1)'
                          : '0 20px 40px -10px rgba(0,0,0,0.1), 0 0 20px 0 rgba(0,74,198,0.05)',
                        borderColor: COLORS.primary,
                        '& .blog-image': {
                          transform: 'scale(1.05)'
                        }
                      }
                    }}
                  >
                    <Link href={`/blog/${blog.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
                        <CardMedia
                          className="blog-image"
                          component="img"
                          height="240"
                          image={blog.cover_image_url || 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'}
                          alt={blog.title}
                          sx={{ 
                            borderBottom: `1px solid ${COLORS.outlineVariant}`,
                            transition: 'transform 0.5s ease',
                          }}
                        />
                        <Chip 
                          label="Article" 
                          size="small" 
                          sx={{ 
                            position: 'absolute', top: 16, right: 16, 
                            bgcolor: 'rgba(0,0,0,0.6)', color: '#fff', backdropFilter: 'blur(4px)', fontWeight: 600, fontFamily: 'Outfit, sans-serif'
                          }} 
                        />
                      </Box>
                      <CardContent sx={{ flexGrow: 1, p: { xs: 3, md: 4 }, display: 'flex', flexDirection: 'column' }}>
                        <Typography sx={{ fontSize: '0.85rem', color: COLORS.primary, fontWeight: 700, mb: 1.5, fontFamily: 'Outfit, sans-serif', textTransform: 'uppercase', letterSpacing: '1px' }}>
                          {new Date(blog.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 800, mb: 2, fontFamily: 'Outfit, sans-serif', lineHeight: 1.3, fontSize: '1.5rem', color: COLORS.onSurface, flexGrow: 1 }}>
                          {blog.title}
                        </Typography>
                        
                        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', color: COLORS.primary, fontWeight: 600, fontSize: '0.9rem', fontFamily: 'Outfit, sans-serif' }}>
                          Read Article <Box component="span" sx={{ ml: 1, transition: 'transform 0.2s', '.MuiCard-root:hover &': { transform: 'translateX(4px)' } }}>→</Box>
                        </Box>
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
