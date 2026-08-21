"use client";

import { useEffect, useState } from "react";
import { Box, Typography, Container, Grid, Card, CardContent, CircularProgress, IconButton, Dialog } from '@mui/material';
import MarketingNav from '@/components/MarketingNav';
import MarketingFooter from '@/components/MarketingFooter';
import PublicThemeProvider from '@/components/PublicThemeProvider';
import { api, unwrap } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";

type TutorialVideo = {
  id: number;
  title: string;
  youtube_url: string;
  sequence: number;
  target_audience?: string;
  video_id: string;
  thumbnail_url: string;
  embed_url: string;
};

export default function PublicTutorialsPage() {
  const [videos, setVideos] = useState<TutorialVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [playingVideo, setPlayingVideo] = useState<TutorialVideo | null>(null);
  const { lang } = useLanguage();

  useEffect(() => {
    // Fetch public tutorials
    api<any>("/public/tutorials/")
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.results || [];
        setVideos(list as TutorialVideo[]);
      })
      .catch(() => {
        // Fallback to accounts/tutorials if needed
        api<any>("/tutorials/")
          .then((data) => {
            const list = Array.isArray(data) ? data : data?.results || [];
            setVideos(list as TutorialVideo[]);
          })
          .catch(() => setVideos([]));
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredVideos = videos.filter((v) =>
    v.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PublicThemeProvider>
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f8fafc', color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>
        
        {/* Navigation */}
        <MarketingNav />

        {/* Hero Section */}
        <Box sx={{ pt: { xs: 8, md: 12 }, pb: { xs: 5, md: 8 }, textAlign: 'center', px: 2, background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', borderBottom: '1px solid rgba(226, 232, 240, 0.8)' }}>
          <Container maxWidth="md">
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, px: 2, py: 0.75, mb: 2.5, borderRadius: '999px', bgcolor: 'rgba(37, 99, 235, 0.08)', color: '#2563eb', fontWeight: 700, fontSize: '0.875rem' }}>
              <span>🎥</span> {lang === 'bn' ? 'টিউটোরিয়াল ও ব্যবহার সহায়িকা' : 'Help & Tutorial Center'}
            </Box>
            <Typography variant="h2" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 2, fontSize: { xs: '2rem', sm: '2.75rem', md: '3.25rem' }, color: '#0f172a' }}>
              {lang === 'bn' ? 'স্টকহুইস্ক ভিডিও গাইড' : 'StockWhisk Video Tutorials'}
            </Typography>
            <Typography variant="h6" sx={{ color: '#475569', mb: 4, fontWeight: 400, maxWidth: 640, mx: 'auto', fontSize: { xs: '1rem', md: '1.125rem' }, lineHeight: 1.6 }}>
              {lang === 'bn' 
                ? 'স্টকহুইস্ক সফটওয়্যারের প্রতিটি ফিচার কীভাবে ব্যবহার করবেন তা সহজে দেখে নিন এবং আপনার ব্যবসা আরও দ্রুত পরিচালনা করুন।' 
                : 'Watch step-by-step guides to master every feature in StockWhisk and grow your retail business efficiently.'}
            </Typography>

            {/* Search Bar */}
            <Box sx={{ maxWidth: 520, mx: 'auto' }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  bgcolor: '#ffffff',
                  borderRadius: '12px',
                  px: 2,
                  py: 1.2,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
                  transition: 'all 0.2s ease',
                  '&:focus-within': {
                    borderColor: '#2563eb',
                    boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.15)',
                  }
                }}
              >
                <i className="bi bi-search" style={{ color: '#64748b', marginRight: '10px', fontSize: '1.1rem' }}></i>
                <input
                  type="text"
                  placeholder={lang === 'bn' ? 'ভিডিও খুঁজুন (যেমন: একাউন্ট তৈরি, সেলস, সার্ভিস...)' : 'Search videos (e.g. create account, sales, service)...'}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    border: 'none',
                    outline: 'none',
                    width: '100%',
                    fontSize: '0.95rem',
                    fontFamily: 'inherit',
                    backgroundColor: 'transparent',
                    color: '#0f172a',
                  }}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: '#94a3b8',
                      padding: 0,
                    }}
                  >
                    <i className="bi bi-x-circle-fill"></i>
                  </button>
                )}
              </Box>
            </Box>
          </Container>
        </Box>

        {/* Video Grid Section */}
        <Box sx={{ flexGrow: 1, py: { xs: 6, md: 9 }, px: 2 }}>
          <Container maxWidth="lg">
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
                <CircularProgress sx={{ color: '#2563eb' }} />
              </Box>
            ) : filteredVideos.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 10, bgcolor: '#ffffff', borderRadius: '16px', border: '1px dashed #cbd5e1', maxWidth: 600, mx: 'auto' }}>
                <Typography variant="h5" sx={{ mb: 1, fontWeight: 700, color: '#334155' }}>
                  {lang === 'bn' ? 'কোনো ভিডিও পাওয়া যায়নি' : 'No videos found'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                  {lang === 'bn' ? 'অনুগ্রহ করে ভিন্ন কোনো শব্দ দিয়ে সার্চ করুন।' : 'Try searching with different keywords.'}
                </Typography>
              </Box>
            ) : (
              <Grid container spacing={3.5}>
                {filteredVideos.map((video, index) => {
                  const rawThumb = video.thumbnail_url || (video.video_id ? `https://img.youtube.com/vi/${video.video_id}/hqdefault.jpg` : "");
                  return (
                    <Grid key={video.id} size={{ xs: 12, sm: 6, md: 4 }}>
                      <Card
                        onClick={() => setPlayingVideo(video)}
                        sx={{
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          borderRadius: '16px',
                          border: '1px solid rgba(226, 232, 240, 0.8)',
                          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
                          cursor: 'pointer',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          bgcolor: '#ffffff',
                          overflow: 'hidden',
                          '&:hover': {
                            transform: 'translateY(-6px)',
                            boxShadow: '0 16px 32px -8px rgba(37, 99, 235, 0.15)',
                            borderColor: 'rgba(37, 99, 235, 0.3)',
                            '& .play-btn': {
                              transform: 'scale(1.15)',
                              bgcolor: '#ef4444',
                              boxShadow: '0 0 24px rgba(239, 68, 68, 0.6)',
                            },
                            '& .thumb-img': {
                              transform: 'scale(1.05)',
                            }
                          }
                        }}
                      >
                        {/* Thumbnail Container */}
                        <Box sx={{ position: 'relative', width: '100%', paddingTop: '56.25%', bgcolor: '#0f172a', overflow: 'hidden' }}>
                          {rawThumb ? (
                            <Box
                              component="img"
                              className="thumb-img"
                              src={rawThumb}
                              alt={video.title}
                              onError={(e: any) => {
                                if (video.video_id && !e.target.dataset.triedFallback) {
                                  e.target.dataset.triedFallback = "true";
                                  e.target.src = `https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`;
                                }
                              }}
                              sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                transition: 'transform 0.4s ease',
                              }}
                            />
                          ) : (
                            <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                              <i className="bi bi-play-btn" style={{ fontSize: '3rem' }}></i>
                            </Box>
                          )}

                          {/* Play Button Overlay */}
                          <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(15, 23, 42, 0.25)' }}>
                            <Box
                              className="play-btn"
                              sx={{
                                width: 52,
                                height: 52,
                                borderRadius: '50%',
                                bgcolor: 'rgba(255, 255, 255, 0.95)',
                                color: '#ef4444',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
                              }}
                            >
                              <i className="bi bi-play-fill" style={{ fontSize: '2rem', marginLeft: '3px' }}></i>
                            </Box>
                          </Box>

                          {/* Episode / Index Pill */}
                          <Box sx={{ position: 'absolute', top: 12, left: 12, bgcolor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', color: '#ffffff', fontSize: '0.75rem', fontWeight: 700, px: 1.2, py: 0.4, borderRadius: '6px' }}>
                            #{index + 1}
                          </Box>
                        </Box>

                        {/* Title & Info */}
                        <CardContent sx={{ p: 2.5, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.4, color: '#0f172a', mb: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {video.title}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 'auto', pt: 1, borderTop: '1px solid #f1f5f9' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: '#2563eb', fontSize: '0.85rem', fontWeight: 600 }}>
                              <i className="bi bi-play-circle-fill"></i>
                              <span>{lang === 'bn' ? 'ভিডিও দেখুন' : 'Watch Video'}</span>
                            </Box>
                            <Box sx={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                              YouTube
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </Container>
        </Box>

        {/* Video Player Modal */}
        {playingVideo && (
          <Dialog
            open={Boolean(playingVideo)}
            onClose={() => setPlayingVideo(null)}
            maxWidth="md"
            fullWidth
            slotProps={{
              paper: {
                sx: {
                  bgcolor: '#000000',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
                }
              }
            }}
          >
            <Box sx={{ position: 'relative', width: '100%', paddingTop: '56.25%' }}>
              <IconButton
                onClick={() => setPlayingVideo(null)}
                sx={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  zIndex: 10,
                  bgcolor: 'rgba(0, 0, 0, 0.65)',
                  color: '#ffffff',
                  '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.9)' },
                }}
              >
                <i className="bi bi-x-lg" style={{ fontSize: '1.2rem' }}></i>
              </IconButton>
              <iframe
                src={
                  playingVideo.embed_url ||
                  (playingVideo.video_id
                    ? `https://www.youtube-nocookie.com/embed/${playingVideo.video_id}?autoplay=1&rel=0`
                    : playingVideo.youtube_url.replace("youtu.be/", "www.youtube-nocookie.com/embed/").replace("watch?v=", "embed/") + "?autoplay=1&rel=0")
                }
                title={playingVideo.title}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  border: 0,
                }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </Box>
          </Dialog>
        )}

        {/* Footer */}
        <MarketingFooter />
      </Box>
    </PublicThemeProvider>
  );
}
