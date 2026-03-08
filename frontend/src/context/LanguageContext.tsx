import React, { createContext, useContext, useState, useCallback } from 'react';
import { Language, translations, Translations, LANGUAGES, LanguageOption } from '../i18n/translations';

interface LanguageContextType {
  language: Language;
  t: Translations;
  setLanguage: (lang: Language) => void;
  languages: LanguageOption[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'pashu-aadhaar-language';

function getInitialLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in translations) {
      return stored as Language;
    }
  } catch { /* ignore */ }
  return 'en';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch { /* ignore */ }
  }, []);

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, t, setLanguage, languages: LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
