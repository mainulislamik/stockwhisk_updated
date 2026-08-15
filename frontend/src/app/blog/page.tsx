"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Box, Typography, Button, Container, Grid, Card, CardMedia, Chip, Avatar, useMediaQuery, useTheme } from '@mui/material';
import MarketingNav from '@/components/MarketingNav';
import MarketingFooter from '@/components/MarketingFooter';
import PublicThemeProvider from '@/components/PublicThemeProvider';
import { getAccess, api, unwrap } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import { Hanken_Grotesk, Manrope } from "next/font/google";

const hanken = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "700", "800"] });
const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

type BlogPost = {
  title: string;
  slug: string;
  excerpt: string;
  published_at: string;
  cover_image_url: string;
  category: string;
  author_name: string;
  author_role: string;
  author_avatar_url: string;
  read_time_minutes: number;
  is_featured: boolean;
};

// Mock data to match the UI if backend is missing fields
const CATEGORIES = [
  { id: 'inv', key: 'blog_cat_1', icon: 'inventory_2' },
  { id: 'pos', key: 'blog_cat_2', icon: 'point_of_sale' },
  { id: 'retail', key: 'blog_cat_3', icon: 'storefront' },
  { id: 'smallbiz', key: 'blog_cat_4', icon: 'work' },
  { id: 'stockwhisk', key: 'blog_cat_5', icon: 'campaign' },
];

function MaterialIcon({ icon, sx = {} }: { icon: string, sx?: any }) {
  return (
    <Box component="span" className="material-symbols-outlined" sx={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24", ...sx }}>
      {icon}
    </Box>
  );
}

export default function BlogListPage() {
  const { lang, t } = useLanguage();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  useEffect(() => {
    api<any>("/platform/public/blogs/")
      .then((data) => {
        setBlogs(unwrap(data));
      })
      .catch((e) => console.error("Failed to load blogs", e))
      .finally(() => setLoading(false));
  }, []);

  // Compute featured and latest posts based on active category
  const filteredBlogs = blogs.filter(b => activeCategory === 'all' || b.category === activeCategory);
  const featuredPost = filteredBlogs.find(b => b.is_featured) || (filteredBlogs.length > 0 ? filteredBlogs[0] : null);
  const latestPosts = filteredBlogs.filter(b => b !== featuredPost).slice(0, 3);

  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 80, damping: 20 } }
  };

  return (
    <PublicThemeProvider>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
      `}} />
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#FAFBFC', color: '#0f172a', fontFamily: manrope.style.fontFamily }}>
        <MarketingNav />

        <Box component="main" sx={{ flexGrow: 1, pt: { xs: 8, md: 12 }, pb: { xs: 8, md: 12 } }}>
          
          {/* Header */}
          <Container maxWidth="lg" sx={{ textAlign: "center", mb: { xs: 6, md: 8 } }}>
            <motion.div initial="hidden" animate="show" variants={fadeUp}>
              <Typography component="h1" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 800, fontSize: { xs: '2.5rem', md: '3.5rem' }, mb: 2, color: '#0f172a' }}>
                {t("blog_title")}
              </Typography>
              <Typography sx={{ fontSize: { xs: '1rem', md: '1.15rem' }, color: '#64748b', maxWidth: '600px', mx: 'auto', lineHeight: 1.6 }}>
                {t("blog_subtitle")}
              </Typography>
            </motion.div>
          </Container>

          <Container maxWidth="lg">
            
            {/* Categories */}
            <Box sx={{ mb: { xs: 6, md: 8 } }}>
              {isMobile ? (
                // Mobile: Scrollable Pills
                <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 2, '::-webkit-scrollbar': { display: 'none' }, msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
                  <Button 
                    onClick={() => setActiveCategory('all')}
                    sx={{ flexShrink: 0, borderRadius: 999, px: 3, py: 1, textTransform: 'none', fontWeight: 600, fontSize: '0.85rem',
                          bgcolor: activeCategory === 'all' ? '#2563eb' : 'transparent', color: activeCategory === 'all' ? '#fff' : '#64748b',
                          border: `1px solid ${activeCategory === 'all' ? '#2563eb' : '#e2e8f0'}`, '&:hover': { bgcolor: activeCategory === 'all' ? '#1d4ed8' : '#f1f5f9' }
                    }}>
                    {t('blog_all_topics')}
                  </Button>
                  {CATEGORIES.map(cat => (
                    <Button 
                      key={cat.id} onClick={() => setActiveCategory(cat.id)}
                      sx={{ flexShrink: 0, borderRadius: 999, px: 3, py: 1, textTransform: 'none', fontWeight: 600, fontSize: '0.85rem',
                            bgcolor: activeCategory === cat.id ? '#2563eb' : 'transparent', color: activeCategory === cat.id ? '#fff' : '#64748b',
                            border: `1px solid ${activeCategory === cat.id ? '#2563eb' : '#e2e8f0'}`, '&:hover': { bgcolor: activeCategory === cat.id ? '#1d4ed8' : '#f1f5f9' }
                      }}>
                      {t(cat.key)}
                    </Button>
                  ))}
                </Box>
              ) : (
                // Desktop: 5 Cards Grid
                <Grid container spacing={2}>
                  {CATEGORIES.map((cat, i) => (
                    <Grid size={{ xs: 12, sm: 2.4 }} key={cat.id}>
                      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                        <Box 
                          onClick={() => setActiveCategory(cat.id)}
                          sx={{ 
                            bgcolor: '#ffffff', borderRadius: '16px', p: 3, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', height: '100%',
                            boxShadow: activeCategory === cat.id ? '0 10px 25px rgba(37,99,235,0.1)' : 'none',
                            borderColor: activeCategory === cat.id ? '#2563eb' : '#e2e8f0',
                            '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }
                          }}
                        >
                          <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: activeCategory === cat.id ? '#eff6ff' : '#f1f5f9', color: activeCategory === cat.id ? '#2563eb' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                            <MaterialIcon icon={cat.icon} sx={{ fontSize: '1.5rem' }} />
                          </Box>
                          <Typography sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 700, fontSize: '0.9rem', color: activeCategory === cat.id ? '#0f172a' : '#475569', textAlign: 'center' }}>
                            {t(cat.key)}
                          </Typography>
                        </Box>
                      </motion.div>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>

            {/* Featured Insight */}
            {featuredPost && (
            <Box sx={{ mb: { xs: 8, md: 10 } }}>
              <Typography component="h2" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 800, fontSize: '1.75rem', mb: 3, color: '#0f172a' }}>
                {t('blog_featured')}
              </Typography>
              <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-50px" }} variants={fadeUp}>
                <Card sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, borderRadius: '24px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 10px 40px rgba(0,0,0,0.03)', bgcolor: '#ffffff', transition: 'transform 0.3s', '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 20px 50px rgba(0,0,0,0.06)' }, textDecoration: 'none' }} component={Link} href={`/blog/${featuredPost.slug}`}>
                  <Box sx={{ width: { xs: '100%', md: '55%' }, height: { xs: 240, md: 'auto' }, position: 'relative' }}>
                    <CardMedia
                      component="img"
                      image={featuredPost.cover_image_url || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=1200"}
                      alt={featuredPost.title}
                      sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </Box>
                  <Box sx={{ width: { xs: '100%', md: '45%' }, p: { xs: 3, md: 5 }, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    {featuredPost.category && (
                    <Box sx={{ display: 'inline-block', bgcolor: '#eff6ff', color: '#2563eb', px: 1.5, py: 0.5, borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, mb: 2, alignSelf: 'flex-start' }}>
                      {t(CATEGORIES.find(c => c.id === featuredPost.category)?.key || 'blog_cat_1')}
                    </Box>
                    )}
                    <Typography component="h3" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 800, fontSize: { xs: '1.5rem', md: '2rem' }, lineHeight: 1.2, mb: 2, color: '#0f172a' }}>
                      {featuredPost.title}
                    </Typography>
                    <Typography sx={{ color: '#475569', fontSize: '1rem', lineHeight: 1.6, mb: 4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {featuredPost.excerpt}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 'auto' }}>
                      <Avatar src={featuredPost.author_avatar_url || "https://i.pravatar.cc/150?u=a042581f4e29026704d"} sx={{ width: 40, height: 40 }} />
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>{featuredPost.author_name || "StockWhisk Team"}</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{featuredPost.author_role || "Editorial Team"} • {featuredPost.read_time_minutes || 5} min read</Typography>
                      </Box>
                    </Box>
                  </Box>
                </Card>
              </motion.div>
            </Box>
            )}

            {/* Latest Articles */}
            {latestPosts.length > 0 && (
            <Box sx={{ mb: { xs: 10, md: 12 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Typography component="h2" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 800, fontSize: '1.75rem', color: '#0f172a' }}>
                  {t('blog_latest')}
                </Typography>
                <Link href="/blog" style={{ display: 'flex', alignItems: 'center', color: '#2563eb', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem' }}>
                  {t('blog_view_all')} <MaterialIcon icon="arrow_forward" sx={{ fontSize: '1.1rem', ml: 0.5 }} />
                </Link>
              </Box>

              {isMobile ? (
                // Mobile: Vertical list of horizontal cards
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {latestPosts.map((post, index) => (
                    <motion.div key={post.slug} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-50px" }} variants={fadeUp} style={{ transitionDelay: `${index * 0.1}s` }}>
                      <Card sx={{ display: 'flex', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', bgcolor: '#ffffff', textDecoration: 'none' }} component={Link} href={`/blog/${post.slug}`}>
                        <Box sx={{ width: 120, height: 120, flexShrink: 0 }}>
                          <CardMedia component="img" image={post.cover_image_url || "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&q=80&w=800"} alt={post.title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </Box>
                        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          {post.category && (
                          <Typography sx={{ color: '#f59e0b', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', mb: 0.5, letterSpacing: '0.05em' }}>
                            {t(CATEGORIES.find(c => c.id === post.category)?.key || 'blog_cat_2')}
                          </Typography>
                          )}
                          <Typography component="h3" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 700, fontSize: '1rem', lineHeight: 1.3, color: '#0f172a', mb: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {post.title}
                          </Typography>
                          <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {new Date(post.published_at).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'short', day: 'numeric' })} • {post.read_time_minutes || 5} min read
                          </Typography>
                        </Box>
                      </Card>
                    </motion.div>
                  ))}
                </Box>
              ) : (
                // Desktop: 3 Column Grid
                <Grid container spacing={4}>
                  {latestPosts.map((post, index) => (
                    <Grid size={{ xs: 12, md: 4 }} key={post.slug}>
                      <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-50px" }} variants={fadeUp} style={{ height: '100%' }}>
                        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: '24px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.02)', bgcolor: '#ffffff', transition: 'transform 0.3s', '&:hover': { transform: 'translateY(-6px)', boxShadow: '0 20px 40px rgba(0,0,0,0.06)' }, textDecoration: 'none' }} component={Link} href={`/blog/${post.slug}`}>
                          <CardMedia component="img" height="200" image={post.cover_image_url || "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&q=80&w=800"} alt={post.title} />
                          <Box sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                              {post.category && (
                              <Box sx={{ bgcolor: '#f1f5f9', color: '#475569', px: 1, py: 0.5, borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>
                                {t(CATEGORIES.find(c => c.id === post.category)?.key || 'blog_cat_4')}
                              </Box>
                              )}
                              <Box sx={{ display: 'flex', alignItems: 'center', color: '#64748b', fontSize: '0.75rem' }}>
                                <MaterialIcon icon="schedule" sx={{ fontSize: '1rem', mr: 0.5 }} /> {post.read_time_minutes || 5} min
                              </Box>
                            </Box>
                            <Typography component="h3" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 800, fontSize: '1.25rem', lineHeight: 1.3, color: '#0f172a', mb: 1.5 }}>
                              {post.title}
                            </Typography>
                            <Typography sx={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.5, mb: 3, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {post.excerpt}
                            </Typography>
                            <Box sx={{ mt: 'auto', borderTop: '1px solid #e2e8f0', pt: 2 }}>
                              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>By {post.author_name || "StockWhisk Team"}</Typography>
                            </Box>
                          </Box>
                        </Card>
                      </motion.div>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
            )}

            {/* Bottom CTA */}
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-50px" }} variants={fadeUp}>
              <Box sx={{ 
                bgcolor: '#0a40a8', 
                background: 'linear-gradient(135deg, #0a40a8 0%, #1d4ed8 100%)',
                borderRadius: '32px', 
                p: { xs: 4, md: 8 }, 
                display: 'flex', 
                flexDirection: { xs: 'column', md: 'row' }, 
                alignItems: 'center', 
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 24px 60px rgba(29, 78, 216, 0.3)'
              }}>
                {/* Decorative Blur Circles */}
                <Box sx={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, bgcolor: '#3b82f6', borderRadius: '50%', filter: 'blur(60px)', opacity: 0.6 }} />
                <Box sx={{ position: 'absolute', bottom: -50, left: 100, width: 150, height: 150, bgcolor: '#60a5fa', borderRadius: '50%', filter: 'blur(50px)', opacity: 0.4 }} />

                <Box sx={{ flex: 1, pr: { md: 6 }, position: 'relative', zIndex: 1, textAlign: { xs: 'center', md: 'left' }, mb: { xs: 4, md: 0 } }}>
                  {isMobile && (
                    <Box sx={{ width: 56, height: 56, borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3, mx: 'auto' }}>
                      <MaterialIcon icon="inventory_2" sx={{ fontSize: '2rem' }} />
                    </Box>
                  )}
                  <Typography component="h2" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 800, fontSize: { xs: '2rem', md: '2.5rem' }, color: '#ffffff', mb: 2, lineHeight: 1.1 }}>
                    {t('blog_cta_title')}
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: { xs: '1rem', md: '1.1rem' }, lineHeight: 1.6, maxWidth: { md: 500 } }}>
                    {t('blog_cta_subtitle')}
                  </Typography>
                </Box>

                <Box sx={{ position: 'relative', zIndex: 1, width: { xs: '100%', md: 'auto' } }}>
                  <Button 
                    component={Link} 
                    href="/register" 
                    sx={{ 
                      bgcolor: '#ffffff', color: '#1d4ed8', fontWeight: 800, borderRadius: 999, px: 4, py: 2, fontSize: '1.05rem', textTransform: 'none', 
                      width: { xs: '100%', md: 'auto' },
                      display: 'flex', alignItems: 'center', gap: 1,
                      boxShadow: '0 10px 20px rgba(0,0,0,0.1)', transition: 'all 0.3s ease', 
                      '&:hover': { bgcolor: '#f1f5f9', transform: 'translateY(-2px)', boxShadow: '0 15px 30px rgba(0,0,0,0.15)' }
                    }}
                  >
                    {t('blog_cta_btn')} <MaterialIcon icon="arrow_forward" sx={{ fontSize: '1.1rem' }} />
                  </Button>
                  {isMobile && (
                    <Typography sx={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', mt: 2 }}>
                      14-day free trial. No credit card required.
                    </Typography>
                  )}
                </Box>
              </Box>
            </motion.div>

          </Container>
        </Box>

        <MarketingFooter />
      </Box>
    </PublicThemeProvider>
  );
}
