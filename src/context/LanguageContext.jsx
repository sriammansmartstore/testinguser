import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations } from '../constants/translations';

// Common brand and grocery terms to automatically transliterate / translate into Tamil
const BRAND_AND_PRODUCT_TERMS_TAMIL = [
  // Multi-word brands / phrases first (longest phrases first)
  ['cadbury dairy milk silk', 'கேட்பரி டெய்ரி மில்க் சில்க்'],
  ['cadbury dairy milk', 'கேட்பரி டெய்ரி மில்க்'],
  ['dairy milk silk', 'டெய்ரி மில்க் சில்க்'],
  ['dairy milk', 'டெய்ரி மில்க்'],
  ['sunsilk shampoo', 'சன்சில்க் ஷாம்பு'],
  ['head & shoulders', 'ஹெட் & ஷோல்டர்ஸ்'],
  ['head and shoulders', 'ஹெட் & ஷோல்டர்ஸ்'],
  ['clinic plus shampoo', 'கிளினிக் பிளஸ் ஷாம்பு'],
  ['clinic plus', 'கிளினிக் பிளஸ்'],
  ['gold winner', 'கோல்ட் வின்னர்'],
  ['surf excel', 'சர்ப் எக்செல்'],
  ['close up', 'குளோஸ் அப்'],
  ['mysore sandal', 'மைசூர் சாண்டல்'],
  ['red label', 'ரெட் லேபிள்'],
  ['3 roses', '3 ரோசஸ்'],
  ['three roses', '3 ரோசஸ்'],
  ['parle-g', 'பார்லே-ஜி'],
  ['parle g', 'பார்லே-ஜி'],
  ['mamy poko', 'மேமி போக்கோ'],
  ['thick & long', 'திக் & லாங்'],
  ['black shine', 'பிளாக் ஷைன்'],
  ['anti dandruff', 'பொடுகு எதிர்ப்பு'],
  ['hair fall', 'முடி உதிர்தல்'],
  ['offer zone', 'சலுகை மண்டலம்'],
  ['offer-zone', 'சலுகை மண்டலம்'],
  ['offerzone', 'சலுகை மண்டலம்'],
  ['offerzon', 'சலுகை மண்டலம்'],

  // Single word brands
  ['sunsilk', 'சன்சில்க்'],
  ['cadbury', 'கேட்பரி'],
  ['dove', 'டவ்'],
  ['pantene', 'பான்டீன்'],
  ['tresemme', 'டிரெசெம்மே'],
  ['meera', 'மீரா'],
  ['chik', 'சிக்'],
  ['vatika', 'வாடிகா'],
  ['garnier', 'கார்னியர்'],
  ['lifebuoy', 'லைஃப்பாய்'],
  ['dettol', 'டெட்டால்'],
  ['hamam', 'ஹமாம்'],
  ['lux', 'லக்ஸ்'],
  ['cinthol', 'சின்தால்'],
  ['pears', 'பியர்ஸ்'],
  ['medimix', 'மேடிமிக்ஸ்'],
  ['santoor', 'சந்தூர்'],
  ['sakthi', 'சக்தி'],
  ['aachi', 'ஆச்சி'],
  ['everest', 'எவரெஸ்ட்'],
  ['mtr', 'எம்.டி.ஆர்'],
  ['tata', 'டாடா'],
  ['fortune', 'ஃபார்ச்சூன்'],
  ['idhayam', 'இதயம்'],
  ['idhyam', 'இதயம்'],
  ['gemini', 'ஜெமினி'],
  ['aashirvaad', 'ஆசீர்வாத்'],
  ['ashirvaad', 'ஆசீர்வாத்'],
  ['pillsbury', 'பில்ஸ்பரி'],
  ['britannia', 'பிரிட்டானியா'],
  ['parle', 'பார்லே'],
  ['sunfeast', 'சன்பீஸ்ட்'],
  ['nestle', 'நெஸ்லே'],
  ['maggi', 'மேகி'],
  ['yippee', 'இப்பி'],
  ['bru', 'புரூ'],
  ['sunrise', 'சன்ரைஸ்'],
  ['boost', 'பூஸ்ட்'],
  ['horlicks', 'ஹார்லிக்ஸ்'],
  ['complan', 'காம்ப்ளான்'],
  ['bournvita', 'போர்ன்விட்டா'],
  ['ariel', 'ஏரியல்'],
  ['tide', 'டைடு'],
  ['rin', 'ரின'],
  ['comfort', 'கம்ஃபர்ட்'],
  ['vim', 'விம்'],
  ['exo', 'எக்சோ'],
  ['pril', 'பிரில்'],
  ['harpic', 'ஹார்பிக்'],
  ['colgate', 'கோல்கேட்'],
  ['pepsodent', 'பெப்சோடென்ட்'],
  ['sensodyne', 'சென்சோடைன்'],
  ['dabur', 'டாபர்'],
  ['vaseline', 'வாஸ்லின்'],
  ['nivea', 'நிவியா'],
  ['ponds', 'பாண்ட்ஸ்'],
  ['parachute', 'பாராசூட்'],
  ['whisper', 'விஸ்பர்'],
  ['stayfree', 'ஸ்டேப்ரீ'],
  ['sofy', 'சோஃபி'],
  ['pampers', 'பாம்பர்ஸ்'],
  ['huggies', 'ஹக்கீஸ்'],

  // Grocery product words & items
  ['chocolates', 'சாக்லேட்டுகள்'],
  ['chocolate', 'சாக்லேட்'],
  ['silk', 'சில்க்'],
  ['shampoos', 'ஷாம்புகள்'],
  ['shampoo', 'ஷாம்பு'],
  ['conditioners', 'கண்டிஷனர்கள்'],
  ['conditioner', 'கண்டிஷனர்'],
  ['soaps', 'சோப்புகள்'],
  ['soap', 'சோப்'],
  ['body wash', 'குளியல் திரவம்'],
  ['oil', 'எண்ணெய்'],
  ['hair oil', 'கூந்தல் எண்ணெய்'],
  ['coconut oil', 'தேங்காய் எண்ணெய்'],
  ['groundnut oil', 'கடலை எண்ணெய்'],
  ['sunflower oil', 'சூரியகாந்தி எண்ணெய்'],
  ['gingelly oil', 'நல்லெண்ணெய்'],
  ['deepam oil', 'தீபம் எண்ணெய்'],
  ['paste', 'பேஸ்ட்'],
  ['toothpaste', 'பல்பசை'],
  ['toothbrush', 'பல் துலக்கி'],
  ['powder', 'பொடி'],
  ['tea', 'தேநீர்'],
  ['coffee', 'காபி'],
  ['rice', 'அரிசி'],
  ['dall', 'பருப்பு'],
  ['dal', 'பருப்பு'],
  ['toor dal', 'துவரம் பருப்பு'],
  ['moong dal', 'பாசிப் பருப்பு'],
  ['urad dal', 'உளுத்தம் பருப்பு'],
  ['chana dal', 'கடலைப் பருப்பு'],
  ['salt', 'உப்பு'],
  ['sugar', 'சர்க்கரை'],
  ['jaggery', 'வெல்லம்'],
  ['ghee', 'நெய்'],
  ['butter', 'வெண்ணெய்'],
  ['milk', 'பால்'],
  ['dairy', 'பால் பொருட்கள்'],
  ['curd', 'தயிர்'],
  ['paneer', 'பன்னீர்'],
  ['atta', 'கோதுமை மாவு'],
  ['maida', 'மைதா மாவு'],
  ['rava', 'ரவை'],
  ['sooji', 'ரவை'],
  ['flour', 'மாவு'],
  ['biscuit', 'பிஸ்கட்'],
  ['biscuits', 'பிஸ்கட்டுகள்'],
  ['cookies', 'குக்கீஸ்'],
  ['noodles', 'நூடுல்ஸ்'],
  ['pasta', 'பாஸ்தா'],
  ['vermicelli', 'சேமியா'],
  ['cashew', 'முந்திரி'],
  ['badam', 'பாதாம்'],
  ['almond', 'பாதாம்'],
  ['dates', 'பேரீச்சம்பழம்'],
  ['honey', 'தேன்'],
  ['turmeric', 'மஞ்சள் தூள்'],
  ['chilli powder', 'மிளகாய்த் தூள்'],
  ['chilli', 'மிளகாய்'],
  ['coriander', 'கொத்தமல்லி'],
  ['mustard', 'கடுகு'],
  ['cumin', 'சீரகம்'],
  ['jeera', 'சீரகம்'],
  ['pepper', 'மிளகு'],
  ['detergent', 'சலவை தூள்'],
  ['dishwash bar', 'பாத்திரம் கழுவும் பார்'],
  ['dishwash liquid', 'பாத்திரம் கழுவும் லிக்விட்'],
  ['dishwash', 'பாத்திரம் கழுவும் பொருள்'],
  ['floor cleaner', 'தரை சுத்தப்படுத்தும் திரவம்'],
  ['handwash', 'கை கழுவும் திரவம்'],
  ['sanitizer', 'கிருமிநாசினி'],
  ['face wash', 'முகக் கழுவும் திரவம்'],
  ['lotion', 'லோஷன்'],
  ['cream', 'கிரீம்'],
];

// Helper to translate an English phrase/product name to Tamil by substituting known brand/item tokens
const translateTokensToTamil = (rawText) => {
  if (!rawText || typeof rawText !== 'string') return '';
  let result = rawText.trim();

  // Check direct full phrase dictionary match first
  const lower = result.toLowerCase();
  if (translations.tamil?.[result]) return translations.tamil[result];
  if (translations.tamil?.[lower]) return translations.tamil[lower];

  // Sequentially replace multi-word and single-word tokens using lookaround boundaries
  for (const [pattern, replacement] of BRAND_AND_PRODUCT_TERMS_TAMIL) {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<![a-zA-Z0-9])${escaped}(?![a-zA-Z0-9])`, 'gi');
    result = result.replace(regex, replacement);
  }

  return result;
};

const LanguageContext = createContext({
  language: 'english',
  setLanguage: () => {},
  t: (key, fallback = null, variables = null) => key,
  getProductName: (product) => (typeof product === 'object' ? (product?.name || product?.title) : product) || '',
  getCategoryName: (name) => name || ''
});

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    const saved = localStorage.getItem('appLanguage') || localStorage.getItem('productLanguage') || 'english';
    return (saved === 'tamil' || saved === 'ta') ? 'tamil' : 'english';
  });

  const setLanguage = useCallback((val) => {
    const normalized = (val === 'tamil' || val === 'ta') ? 'tamil' : 'english';
    setLanguageState(normalized);
  }, []);

  const isTamil = language === 'tamil' || language === 'ta';

  useEffect(() => {
    localStorage.setItem('appLanguage', language);
    localStorage.setItem('productLanguage', language);
  }, [language]);

  const t = useCallback((key, fallback = null, variables = null) => {
    if (!key) return '';
    const activeLang = isTamil ? 'tamil' : 'english';
    let text = translations[activeLang]?.[key] || translations['english']?.[key] || fallback || key;
    if (variables && typeof variables === 'object') {
      Object.keys(variables).forEach(k => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), variables[k]);
      });
    }
    return text;
  }, [isTamil]);

  const getProductName = useCallback((product) => {
    if (!product) return '';
    const rawName = typeof product === 'object'
      ? (product.name || product.title || product.productName || '')
      : String(product);

    if (!isTamil) {
      return rawName;
    }

    // 1. Explicit Tamil fields in product object
    if (typeof product === 'object') {
      const tn = product.nameTamil || product.tamilName || product.name_ta || product.tamil_name;
      if (tn && typeof tn === 'string' && tn.trim()) return tn.trim();
    }

    // 2. Direct dictionary match
    const trimmed = rawName.trim();
    if (translations.tamil?.[trimmed]) return translations.tamil[trimmed];
    const lower = trimmed.toLowerCase();
    if (translations.tamil?.[lower]) return translations.tamil[lower];

    // 3. Brand & Token-based translation
    const tokenTranslated = translateTokensToTamil(trimmed);
    if (tokenTranslated && tokenTranslated !== trimmed) {
      return tokenTranslated;
    }

    return trimmed;
  }, [isTamil]);

  const getCategoryName = useCallback((catOrName) => {
    if (!catOrName) return '';
    const rawName = typeof catOrName === 'object'
      ? (catOrName.nameTamil || catOrName.tamilName || catOrName.name || catOrName.id || '')
      : String(catOrName);

    if (!isTamil) {
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
    const lower = trimmed.toLowerCase();

    // Handle special Offer Zone category variants
    if (lower === 'offer-zone' || lower === 'offer zone' || lower === 'offerzone' || lower === 'offerzon') {
      return translations.tamil?.['Offer Zone'] || 'சலுகை மண்டலம்';
    }

    if (translations.tamil?.[trimmed]) return translations.tamil[trimmed];
    if (translations.tamil?.[lower]) return translations.tamil[lower];

    // Find by case-insensitive key match in translations.tamil
    const matchingKey = Object.keys(translations.tamil).find(
      (k) => k.trim().toLowerCase() === lower
    );
    if (matchingKey) return translations.tamil[matchingKey];

    // Token-based fallback
    const tokenTranslated = translateTokensToTamil(trimmed);
    if (tokenTranslated && tokenTranslated !== trimmed) {
      return tokenTranslated;
    }

    return trimmed;
  }, [isTamil]);

  const getUnitText = useCallback((unit) => {
    if (!unit) return '';
    if (isTamil) {
      const trimmed = String(unit).trim();
      const lower = trimmed.toLowerCase();
      return translations.tamil?.[trimmed] || translations.tamil?.[lower] || trimmed;
    }
    return String(unit);
  }, [isTamil]);

  return (
    <LanguageContext.Provider value={{ language, isTamil, setLanguage, t, getProductName, getCategoryName, getUnitText }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
