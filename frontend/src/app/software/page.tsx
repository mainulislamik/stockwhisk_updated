"use client";

import { useEffect, useState } from "react";
import { Box, Typography, Button, Container, Grid, Card, CardContent, CircularProgress } from '@mui/material';
import MarketingNav from '@/components/MarketingNav';
import MarketingFooter from '@/components/MarketingFooter';
import PublicThemeProvider from '@/components/PublicThemeProvider';
import { api, unwrap } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";

const LIGHT_COLORS = {
  surface: '#f8fafc',
  onSurface: '#0f172a',
  onSurfaceVariant: '#475569',
  primary: '#2563eb',
  onPrimary: '#ffffff',
  surfaceContainerLowest: '#ffffff',
  outlineVariant: '#c3c6d7',
};

const DARK_COLORS = {
  surface: '#0f172a',
  onSurface: '#f8fafc',
  onSurfaceVariant: '#cbd5e1',
  primary: '#38bdf8',
  onPrimary: '#020617',
  surfaceContainerLowest: '#020617',
  outlineVariant: '#334155',
};

type SoftwareRelease = {
  id: number;
  platform: "android" | "windows" | "mac";
  version: string;
  release_notes: string;
  file: string;
  download_url?: string;
  created_at: string;
};

const DEFAULT_ANDROID_RELEASE: SoftwareRelease = {
  id: 1,
  platform: "android",
  version: "1.0.1",
  release_notes: "",
  file: "/downloads/stockwhisk_scanner.apk",
  download_url: "/downloads/stockwhisk_scanner.apk",
  created_at: new Date().toISOString(),
};

export default function SoftwarePage() {
  const mode: string = "light"; // Hardcoded default for simplicity, can be dynamic
  const [mounted, setMounted] = useState(false);
  const [releases, setReleases] = useState<SoftwareRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const { lang } = useLanguage();

  const COLORS = mounted && mode === 'dark' ? DARK_COLORS : LIGHT_COLORS;

  useEffect(() => {
    setMounted(true);
    api<any>("/platform/public/software/")
      .then((data) => {
        const list = unwrap<SoftwareRelease>(data);
        if (Array.isArray(list) && list.length > 0) {
          setReleases(list);
        } else {
          setReleases([DEFAULT_ANDROID_RELEASE]);
        }
      })
      .catch((e) => {
        console.error("Failed to load software releases, using default", e);
        setReleases([DEFAULT_ANDROID_RELEASE]);
      })
      .finally(() => setLoading(false));
  }, []);

  const getPlatformIcon = (platform: string) => {
    switch(platform) {
      case 'android': return '📱';
      case 'windows': return '💻';
      case 'mac': return '🍏';
      default: return '📦';
    }
  };

  const getPlatformName = (platform: string) => {
    switch(platform) {
      case 'android': return 'Android APK';
      case 'windows': return 'Windows PC';
      case 'mac': return 'macOS';
      default: return 'Download';
    }
  };

  const getDownloadHref = (release: SoftwareRelease) => {
    if (release.download_url) {
      return release.download_url;
    }
    if (release.file) {
      return release.file;
    }
    if (release.platform === 'android') {
      return '/downloads/stockwhisk_scanner.apk';
    }
    return '#';
  };

  return (
    <PublicThemeProvider>
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: COLORS.surface, color: COLORS.onSurface, fontFamily: 'Outfit, sans-serif' }}>
        
        {/* Navigation */}
        <MarketingNav />

        {/* Hero Section */}
        <Box sx={{ pt: { xs: 8, md: 12 }, pb: { xs: 6, md: 10 }, textAlign: 'center', px: 2 }}>
          <Container maxWidth="md">
            <Typography variant="h2" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 3, 
              background: `linear-gradient(135deg, ${COLORS.onSurface}, ${COLORS.primary})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>
              {lang === 'bn' ? 'স্টকহুইস্ক ডাউনলোড করুন' : 'Download StockWhisk'}
            </Typography>
            <Typography variant="h6" sx={{ color: COLORS.onSurfaceVariant, mb: 5, fontWeight: 400, maxWidth: 600, mx: 'auto' }}>
              {lang === 'bn' ? 'আপনার ডিভাইসের জন্য স্টকহুইস্ক অ্যাপ্লিকেশনের সর্বশেষ সংস্করণ পান। দ্রুত, সুরক্ষিত এবং সবসময় আপডেট করা।' : 'Get the latest version of the StockWhisk application for your device. Fast, secure, and always updated.'}
            </Typography>
          </Container>
        </Box>

        {/* Content Section */}
        <Box sx={{ flexGrow: 1, pb: 12, px: 2 }}>
          <Container maxWidth="lg">
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
                <CircularProgress />
              </Box>
            ) : releases.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 10 }}>
                <Typography variant="body1" sx={{ color: COLORS.onSurfaceVariant }}>
                  {lang === 'bn' ? 'বর্তমানে কোনো সফটওয়্যার রিলিজ নেই। অনুগ্রহ করে পরে আবার চেক করুন!' : 'No software releases are currently available. Check back later!'}
                </Typography>
              </Box>
            ) : (
              <Grid container spacing={4} sx={{ justifyContent: "center" }}>
                {releases.map((release) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={release.id}>
                    <Card sx={{ 
                      height: '100%', 
                      display: 'flex', 
                      flexDirection: 'column',
                      borderRadius: 4,
                      boxShadow: '0 12px 40px rgba(15,23,42,0.06)',
                      border: `1px solid ${COLORS.outlineVariant}`,
                      bgcolor: COLORS.surfaceContainerLowest,
                      transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-8px)',
                        boxShadow: '0 20px 40px rgba(15,23,42,0.12)',
                      }
                    }}>
                      <CardContent sx={{ p: 4, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                          <Typography sx={{ fontSize: 48, lineHeight: 1, mr: 2 }}>
                            {getPlatformIcon(release.platform)}
                          </Typography>
                          <Box>
                            <Typography variant="h5" sx={{ fontWeight: 700, color: COLORS.onSurface }}>
                              {getPlatformName(release.platform)}
                            </Typography>
                            <Typography variant="caption" sx={{ color: COLORS.onSurfaceVariant, mb: 2, display: 'block' }}>
                              {lang === 'bn' ? 'সংস্করণ' : 'Version'} {release.version} • {new Date(release.created_at).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ flexGrow: 1, mb: 4 }}>
                          <Typography variant="body2" sx={{ color: COLORS.onSurfaceVariant, mb: 3, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {release.release_notes || (lang === 'bn' ? 'এই আপডেটে পারফরম্যান্স উন্নতি এবং বাগ ফিক্স অন্তর্ভুক্ত করা হয়েছে।' : 'Includes performance improvements and bug fixes.')}
                          </Typography>
                        </Box>
                        
                        <Button 
                          component="a"
                          variant="contained" 
                          href={getDownloadHref(release)} 
                          download={release.platform === 'android' ? `StockWhisk_Scanner_v${release.version}.apk` : undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ 
                            py: 1.5, 
                            borderRadius: 2, 
                            fontWeight: 700,
                            textTransform: 'none',
                            bgcolor: COLORS.primary,
                            color: COLORS.onPrimary,
                            boxShadow: `0 8px 16px -4px ${COLORS.primary}80`,
                            '&:hover': {
                              bgcolor: COLORS.primary,
                              filter: 'brightness(0.9)',
                            }
                          }}
                          fullWidth
                        >
                          {lang === 'bn' ? 'ডাউনলোড' : 'Download'}
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Container>
        </Box>

        {/* Footer */}
        <MarketingFooter />
      </Box>
    </PublicThemeProvider>
  );
}
