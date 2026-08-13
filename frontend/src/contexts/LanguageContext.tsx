"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, translations } from '@/lib/i18n';

type LanguageContextType = {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, variables?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Default to Bangla ('bn') per requirements
  const [lang, setLangState] = useState<Language>('bn');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Load preference from localStorage if available
    const saved = localStorage.getItem('site_lang') as Language;
    if (saved === 'en' || saved === 'bn') {
      setLangState(saved);
    }
    setMounted(true);
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('site_lang', newLang);
  };

  // Translation helper function
  const t = (key: string, variables?: Record<string, string | number>): string => {
    let str = translations[lang][key];
    if (!str) {
      // Fallback to English if key doesn't exist in current language
      str = translations['en'][key] || key;
    }
    
    // Replace variables like {year} or {max_users}
    if (variables) {
      Object.keys(variables).forEach((vKey) => {
        str = str.replace(`{${vKey}}`, String(variables[vKey]));
      });
    }
    
    return str;
  };

  // Avoid hydration mismatch by rendering default until mounted
  // but to prevent layout shift, we just pass the default 'bn' initially
  // which matches server render if server assumes 'bn'.
  
  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
