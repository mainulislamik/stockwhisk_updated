import { createTheme } from '@mui/material/styles';

export const getTheme = (mode: 'light' | 'dark') => {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#6366f1',
        light: '#818cf8',
        dark: '#4f46e5',
      },
      background: {
        default: isDark ? '#0f172a' : '#f8fafc',
        paper: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
      },
      text: {
        primary: isDark ? '#f8fafc' : '#0f172a',
        secondary: isDark ? '#cbd5e1' : '#475569',
      },
    },
    typography: {
      fontFamily: 'Outfit, system-ui, -apple-system, sans-serif',
      button: {
        textTransform: 'none',
        fontWeight: 600,
      },
    },
    shape: {
      borderRadius: 16,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: `
          body {
            background: ${
              isDark
                ? `radial-gradient(1000px circle at top left, rgba(99,102,241,0.15), transparent 50%),
                   radial-gradient(1200px circle at bottom right, rgba(139,92,246,0.1), transparent 50%),
                   #0f172a`
                : `radial-gradient(1000px circle at top left, rgba(99,102,241,0.1), transparent 50%),
                   radial-gradient(1200px circle at bottom right, rgba(139,92,246,0.05), transparent 50%),
                   #f8fafc`
            };
            background-attachment: fixed;
            scrollbar-width: thin;
            scrollbar-color: ${isDark ? 'rgba(148,163,184,0.4)' : 'rgba(148,163,184,0.6)'} transparent;
            transition: background 0.5s ease-in-out;
          }
          ::-webkit-scrollbar { width: 8px; height: 8px; }
          ::-webkit-scrollbar-thumb { background: ${isDark ? 'rgba(148,163,184,0.4)' : 'rgba(148,163,184,0.6)'}; border-radius: 10px; }
          ::-webkit-scrollbar-thumb:hover { background: ${isDark ? 'rgba(148,163,184,0.6)' : 'rgba(148,163,184,0.8)'}; }
        `,
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backdropFilter: 'blur(16px)',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'}`,
            boxShadow: isDark 
              ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.3)'
              : '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: isDark 
                ? '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)'
                : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
            },
          }
        }
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 6px 16px rgba(99, 102, 241, 0.4)',
            },
            '&:active': {
              transform: 'scale(0.96)',
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              background: isDark ? 'rgba(15, 23, 42, 0.5)' : 'rgba(255, 255, 255, 0.5)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '& fieldset': {
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              },
              '&:hover fieldset': {
                borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
              },
              '&.Mui-focused': {
                background: isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                boxShadow: '0 0 0 4px rgba(99, 102, 241, 0.15)',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#6366f1',
                borderWidth: '2px',
              }
            },
          },
        },
      },
    },
  });
};
