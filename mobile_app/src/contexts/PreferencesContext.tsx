import React, { createContext, useContext, useState } from 'react';

type PreferencesContextType = {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  language: 'BN' | 'EN';
  toggleLanguage: () => void;
};

const PreferencesContext = createContext<PreferencesContextType | null>(null);

export const PreferencesProvider = ({ children }: { children: React.ReactNode }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [language, setLanguage] = useState<'BN' | 'EN'>('BN');

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);
  const toggleLanguage = () => setLanguage(prev => prev === 'BN' ? 'EN' : 'BN');

  return (
    <PreferencesContext.Provider value={{ isDarkMode, toggleDarkMode, language, toggleLanguage }}>
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used within PreferencesProvider');
  return context;
};
