"use client";

import React, { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';

export default function LanguageToggle() {
  const { lang, setLang } = useLanguage();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null; // Avoid hydration mismatch

  const toggleLanguage = () => {
    setLang(lang === 'en' ? 'bn' : 'en');
  };

  return (
    <Box
      onClick={toggleLanguage}
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: 76,
        height: 32,
        borderRadius: 16,
        cursor: 'pointer',
        background: 'rgba(15, 23, 42, 0.06)',
        border: '1px solid rgba(15, 23, 42, 0.1)',
        backdropFilter: 'blur(8px)',
        overflow: 'hidden',
        ml: 2, // margin left from the rest of the navbar
      }}
    >
      <Box
        component={motion.div}
        animate={{
          x: lang === 'bn' ? 0 : 46,
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        sx={{
          position: 'absolute',
          top: 2,
          left: 2,
          width: 26,
          height: 26,
          borderRadius: 13,
          background: 'linear-gradient(135deg, #a855f7 0%, #3b82f6 100%)',
          boxShadow: '0 2px 8px rgba(168, 85, 247, 0.4)',
          zIndex: 1,
        }}
      />
      <Box
        sx={{
          display: 'flex',
          width: '100%',
          justifyContent: 'space-between',
          px: 1,
          zIndex: 2,
          pointerEvents: 'none',
        }}
      >
        <Typography
          sx={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: lang === 'bn' ? '#fff' : 'rgba(15, 23, 42, 0.5)',
            width: '50%',
            textAlign: 'center',
            transition: 'color 0.3s ease',
          }}
        >
          BN
        </Typography>
        <Typography
          sx={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: lang === 'en' ? '#fff' : 'rgba(15, 23, 42, 0.5)',
            width: '50%',
            textAlign: 'center',
            transition: 'color 0.3s ease',
          }}
        >
          EN
        </Typography>
      </Box>
    </Box>
  );
}
