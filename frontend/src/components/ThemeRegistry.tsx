'use client';

import React, { createContext, useState, useEffect, useMemo, useContext } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import { Fab, Zoom } from '@mui/material';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { getTheme } from '@/theme';

type ThemeMode = 'light' | 'dark';

interface ThemeModeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
}

export const ThemeModeContext = createContext<ThemeModeContextType>({
  mode: 'dark',
  toggleTheme: () => {},
});

export const useThemeMode = () => useContext(ThemeModeContext);

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedMode = localStorage.getItem('themeMode') as ThemeMode;
    const initialMode = (savedMode === 'light' || savedMode === 'dark') ? savedMode : 'dark';
    setMode(initialMode);
    
    // Sync Bootstrap theme
    document.documentElement.setAttribute('data-bs-theme', initialMode);
    if (initialMode === 'dark') {
      document.body.classList.add('bg-dark', 'text-light');
      document.body.classList.remove('bg-light', 'text-dark');
    } else {
      document.body.classList.add('bg-light', 'text-dark');
      document.body.classList.remove('bg-dark', 'text-light');
    }
  }, []);

  const toggleTheme = () => {
    setMode((prevMode) => {
      const newMode = prevMode === 'light' ? 'dark' : 'light';
      localStorage.setItem('themeMode', newMode);
      
      // Sync Bootstrap theme
      document.documentElement.setAttribute('data-bs-theme', newMode);
      if (newMode === 'dark') {
        document.body.classList.add('bg-dark', 'text-light');
        document.body.classList.remove('bg-light', 'text-dark');
      } else {
        document.body.classList.add('bg-light', 'text-dark');
        document.body.classList.remove('bg-dark', 'text-light');
      }
      
      return newMode;
    });
  };

  const theme = useMemo(() => getTheme(mode), [mode]);

  // Prevent flash by hiding until hydration is complete
  if (!mounted) {
    return <div style={{ visibility: 'hidden' }}>{children}</div>;
  }

  return (
    <ThemeModeContext.Provider value={{ mode, toggleTheme }}>
      <AppRouterCacheProvider>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
          
          <Zoom in={true}>
            <Fab 
              color="primary" 
              aria-label="toggle theme"
              onClick={toggleTheme}
              sx={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                zIndex: 9999,
                boxShadow: '0 8px 16px rgba(99, 102, 241, 0.4)',
              }}
            >
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </Fab>
          </Zoom>

        </ThemeProvider>
      </AppRouterCacheProvider>
    </ThemeModeContext.Provider>
  );
}
