import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations } from '../constants/translations';

const LanguageContext = createContext({
  language: 'english',
  setLanguage: () => {},
  t: (key) => key
});

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('appLanguage') || localStorage.getItem('productLanguage') || 'english';
    return (saved === 'tamil' || saved === 'english') ? saved : 'english';
  });

  useEffect(() => {
    localStorage.setItem('appLanguage', language);
    localStorage.setItem('productLanguage', language);
  }, [language]);

  const t = useCallback((key) => {
    const activeLang = language === 'tamil' ? 'tamil' : 'english';
    return translations[activeLang]?.[key] || translations['english']?.[key] || key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);

