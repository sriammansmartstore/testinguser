import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations } from '../constants/translations';

const LanguageContext = createContext({
  language: 'english',
  setLanguage: () => {},
  t: (key, fallback = null, variables = null) => key,
  getProductName: (product) => product?.name || '',
  getCategoryName: (name) => name || ''
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

  const t = useCallback((key, fallback = null, variables = null) => {
    if (!key) return '';
    const activeLang = language === 'tamil' ? 'tamil' : 'english';
    let text = translations[activeLang]?.[key] || translations['english']?.[key] || fallback || key;
    if (variables && typeof variables === 'object') {
      Object.keys(variables).forEach(k => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), variables[k]);
      });
    }
    return text;
  }, [language]);

  const getProductName = useCallback((product) => {
    if (!product) return '';
    if (language === 'tamil') {
      const tn = product.nameTamil || product.tamilName || translations.tamil?.[product.name];
      if (tn && typeof tn === 'string' && tn.trim()) return tn.trim();
    }
    return product.name || '';
  }, [language]);

  const getCategoryName = useCallback((catName) => {
    if (!catName) return '';
    if (language === 'tamil') {
      return translations.tamil?.[catName] || catName;
    }
    return catName;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, getProductName, getCategoryName }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
