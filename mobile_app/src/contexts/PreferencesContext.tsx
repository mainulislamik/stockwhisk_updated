import React, { createContext, useContext, useState } from 'react';

type PreferencesContextType = {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  language: 'BN' | 'EN';
  toggleLanguage: () => void;
  printerWidth: '58mm' | '80mm';
  setPrinterWidth: (w: '58mm' | '80mm') => void;
};

const PreferencesContext = createContext<PreferencesContextType | null>(null);

import * as SecureStore from '../utils/storage';
import { Platform } from 'react-native';

export const PreferencesProvider = ({ children }: { children: React.ReactNode }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [language, setLanguage] = useState<'BN' | 'EN'>('BN');
  const [printerWidth, setPrinterWidth] = useState<'58mm' | '80mm'>('58mm');

  React.useEffect(() => {
    (async () => {
      try {
        let savedLang = null;
        if (Platform.OS === 'web') {
          savedLang = localStorage.getItem('app_language');
        } else {
          savedLang = await SecureStore.getItemAsync('app_language');
        }
        if (savedLang === 'BN' || savedLang === 'EN') {
          setLanguage(savedLang);
        }
      } catch (e) {}
    })();
  }, []);

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);
  const toggleLanguage = () => {
    setLanguage(prev => {
      const next = prev === 'BN' ? 'EN' : 'BN';
      try {
        if (Platform.OS === 'web') {
          localStorage.setItem('app_language', next);
        } else {
          SecureStore.setItemAsync('app_language', next);
        }
      } catch (e) {}
      return next;
    });
  };

  return (
    <PreferencesContext.Provider value={{ isDarkMode, toggleDarkMode, language, toggleLanguage, printerWidth, setPrinterWidth }}>
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used within PreferencesProvider');
  return context;
};
