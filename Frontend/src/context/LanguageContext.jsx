import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import moment from 'moment';
import 'moment/locale/ar';
import en from '../i18n/en.js';
import ar from '../i18n/ar.js';
import { usersApi } from '../api/axios.js';

const translations = { en, ar };

const LanguageContext = createContext({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
});

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(() => {
    try {
      const stored = localStorage.getItem('flownet_lang');
      if (stored === 'ar' || stored === 'en') return stored;
    } catch {
      // ignore
    }
    return 'en';
  });

  // Sync moment locale whenever lang changes
  useEffect(() => {
    moment.locale(lang);
    // Ensure document direction stays strictly LTR as required
    document.documentElement.setAttribute('dir', 'ltr');
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  const setLang = useCallback((newLang, persistToBackend = true) => {
    if (newLang !== 'ar' && newLang !== 'en') return;
    setLangState(newLang);
    try {
      localStorage.setItem('flownet_lang', newLang);
    } catch {
      // ignore
    }
    moment.locale(newLang);

    if (persistToBackend) {
      usersApi.updateSettings({ appearance: { language: newLang } }).catch(() => {
        // quiet ignore in background
      });
    }
  }, []);

  const t = useCallback(
    (key, params = {}) => {
      const keys = key.split('.');
      let val = translations[lang];

      for (const k of keys) {
        if (val && typeof val === 'object' && k in val) {
          val = val[k];
        } else {
          // Fallback to English
          let fallback = translations.en;
          for (const fb of keys) {
            if (fallback && typeof fallback === 'object' && fb in fallback) {
              fallback = fallback[fb];
            } else {
              return key;
            }
          }
          val = fallback;
          break;
        }
      }

      if (typeof val === 'string') {
        let result = val;
        for (const [pKey, pVal] of Object.entries(params)) {
          result = result.replace(new RegExp(`{${pKey}}`, 'g'), String(pVal));
        }
        return result;
      }

      return typeof val === 'string' ? val : key;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
export default LanguageContext;
