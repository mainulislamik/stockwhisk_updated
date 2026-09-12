/**
 * StockWhisk Mobile App — Unified Design Tokens & Theme Colors
 * Strictly aligned with Web App Glassmorphic & Indigo Theme (frontend/src/theme.ts)
 */

export const AppColors = {
  // 1. Primary Brand (Indigo)
  primary: '#4f46e5',
  primaryLight: '#6366f1',
  primaryDark: '#4338ca',
  primaryBgLight: '#eef2ff',
  primaryBgDark: '#1e1b4b',
  primaryBorderLight: '#c7d2fe',
  primaryBorderDark: '#3730a3',
  primaryAccent: '#818cf8',

  // 2. Slate Neutrals (Light Mode)
  light: {
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceVariant: '#f1f5f9',
    border: '#e2e8f0',
    borderLight: '#f1f5f9',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
    cardShadow: 'rgba(0, 0, 0, 0.05)',
  },

  // 3. Slate Neutrals (Dark Mode)
  dark: {
    background: '#090d16',
    surface: '#0f172a',
    surfaceVariant: '#1e293b',
    border: '#1e293b',
    borderLight: '#334155',
    textPrimary: '#f8fafc',
    textSecondary: '#cbd5e1',
    textMuted: '#64748b',
    cardShadow: 'rgba(0, 0, 0, 0.4)',
  },

  // 4. Semantic Accents (Consistent Functional Colors Only)
  success: '#16a34a',
  successLight: '#22c55e',
  successBgLight: '#f0fdf4',
  successBgDark: '#052e16',
  successBorderLight: '#bbf7d0',
  successBorderDark: '#065f46',
  successText: '#15803d',

  danger: '#ef4444',
  dangerLight: '#f87171',
  dangerBgLight: '#fef2f2',
  dangerBgDark: '#450a0a',
  dangerBorderLight: '#fca5a5',
  dangerBorderDark: '#7f1d1d',
  dangerText: '#dc2626',

  warning: '#d97706',
  warningLight: '#f59e0b',
  warningBgLight: '#fffbeb',
  warningBgDark: '#451a03',
  warningBorderLight: '#fde047',
  warningBorderDark: '#78350f',
  warningText: '#b45309',
};

export default AppColors;
