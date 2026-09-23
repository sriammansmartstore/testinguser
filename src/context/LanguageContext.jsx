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
      if (product.name) {
        const trimmed = String(product.name).trim();
        if (translations.tamil?.[trimmed]) return translations.tamil[trimmed];
        const lower = trimmed.toLowerCase();
        if (translations.tamil?.[lower]) return translations.tamil[lower];
      }
    }
    return product.name || '';
  }, [language]);

  const getCategoryName = useCallback((catOrName) => {
    if (!catOrName) return '';
    const rawName = typeof catOrName === 'object'
      ? (catOrName.nameTamil || catOrName.tamilName || catOrName.name || catOrName.id || '')
      : String(catOrName);

    if (language !== 'tamil') {
      if (typeof catOrName === 'object') {
        return catOrName.name || catOrName.id || '';
      }
      return rawName;
    }

    // When Tamil is selected:
    if (typeof catOrName === 'object' && (catOrName.nameTamil || catOrName.tamilName)) {
      const tn = catOrName.nameTamil || catOrName.tamilName;
      if (tn && typeof tn === 'string' && tn.trim()) return tn.trim();
    }

    const trimmed = rawName.trim();
    if (translations.tamil?.[trimmed]) return translations.tamil[trimmed];

    const lower = trimmed.toLowerCase();
    if (translations.tamil?.[lower]) return translations.tamil[lower];

    // Find by case-insensitive key match in translations.tamil
    const matchingKey = Object.keys(translations.tamil).find(
      (k) => k.trim().toLowerCase() === lower
    );
    if (matchingKey) return translations.tamil[matchingKey];

    return trimmed;
  }, [language]);

  const getUnitText = useCallback((unit) => {
    if (!unit) return '';
    if (language === 'tamil') {
      const trimmed = String(unit).trim();
      const lower = trimmed.toLowerCase();
      return translations.tamil?.[trimmed] || translations.tamil?.[lower] || trimmed;
    }
    return String(unit);
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, getProductName, getCategoryName, getUnitText }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
