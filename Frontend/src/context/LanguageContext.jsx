import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import moment from 'moment';
import 'moment/locale/ar';
import en from '../i18n/en.js';
import ar from '../i18n/ar.js';
import { usersApi } from '../api/axios.js';

const translations = { en, ar };

function humanizeKey(key) {
  if (!key || typeof key !== 'string') return '';
  const lastSegment = key.split('.').pop() || '';
  const words = lastSegment
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : key;
}

const LanguageContext = createContext({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
});

const pluralForm = (n) =>
  n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n % 100 >= 3 && n % 100 <= 10 ? 3 : n % 100 >= 11 ? 4 : 5;

const plurals = {
  s: ['أقل من ثانية', 'ثانية واحدة', ['ثانيتان', 'ثانيتين'], '%d ثوان', '%d ثانية', '%d ثانية'],
  m: ['أقل من دقيقة', 'دقيقة واحدة', ['دقيقتان', 'دقيقتين'], '%d دقائق', '%d دقيقة', '%d دقيقة'],
  h: ['أقل من ساعة', 'ساعة واحدة', ['ساعتان', 'ساعتين'], '%d ساعات', '%d ساعة', '%d ساعة'],
  d: ['أقل من يوم', 'يوم واحد', ['يومان', 'يومين'], '%d أيام', '%d يومًا', '%d يوم'],
  M: ['أقل من شهر', 'شهر واحد', ['شهران', 'شهرين'], '%d أشهر', '%d شهرا', '%d شهر'],
  y: ['أقل من عام', 'عام واحد', ['عامان', 'عامين'], '%d أعوام', '%d عامًا', '%d عام'],
};

const pluralize = (u) => (number, withoutSuffix) => {
  const f = pluralForm(number);
  let str = plurals[u][f];
  if (f === 2) str = str[withoutSuffix ? 0 : 1];
  return str.replace(/%d/i, number);
};

const configureMomentLocales = () => {
  moment.updateLocale('ar', {
    months: 'يناير_فبراير_مارس_أبريل_مايو_يونيو_يوليو_أغسطس_سبتمبر_أكتوبر_نوفمبر_ديسمبر'.split('_'),
    monthsShort: 'يناير_فبراير_مارس_أبريل_مايو_يونيو_يوليو_أغسطس_سبتمبر_أكتوبر_نوفمبر_ديسمبر'.split('_'),
    weekdays: 'الأحد_الإثنين_الثلاثاء_الأربعاء_الخميس_الجمعة_السبت'.split('_'),
    weekdaysShort: 'أحد_إثنين_ثلاثاء_أربعاء_خميس_جمعة_سبت'.split('_'),
    weekdaysMin: 'ح_ن_ث_ر_خ_ج_س'.split('_'),
    relativeTime: {
      future: 'بعد %s',
      past: 'منذ %s',
      s: pluralize('s'),
      ss: pluralize('s'),
      m: pluralize('m'),
      mm: pluralize('m'),
      h: pluralize('h'),
      hh: pluralize('h'),
      d: pluralize('d'),
      dd: pluralize('d'),
      M: pluralize('M'),
      MM: pluralize('M'),
      y: pluralize('y'),
      yy: pluralize('y'),
    },
    postformat: (string) => string, // Keep Western digits 0-9
  });
};

configureMomentLocales();

const initialStoredLang = (() => {
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('flownet_lang');
      if (stored === 'ar' || stored === 'en') return stored;
    }
  } catch {
    // ignore
  }
  return 'en';
})();

moment.locale(initialStoredLang);

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(initialStoredLang);

  // Sync direction, lang attribute, and moment locale
  useEffect(() => {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);
    if (document.body) {
      document.body.setAttribute('dir', dir);
    }

    moment.locale(lang);
    if (lang === 'ar') {
      moment.updateLocale('ar', {
        postformat: (string) => string, // Keep Western digits 0-9
      });
    }
  }, [lang]);

  const setLang = useCallback((newLang, persistToBackend = true) => {
    if (newLang !== 'ar' && newLang !== 'en') return;
    moment.locale(newLang);
    if (newLang === 'ar') {
      moment.updateLocale('ar', {
        postformat: (string) => string,
      });
    }
    setLangState(newLang);
    try {
      localStorage.setItem('flownet_lang', newLang);
    } catch {
      // ignore
    }

    const dir = newLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', newLang);
    if (document.body) {
      document.body.setAttribute('dir', dir);
    }

    moment.locale(newLang);
    if (newLang === 'ar') {
      moment.updateLocale('ar', {
        postformat: (string) => string,
      });
    }

    if (persistToBackend) {
      usersApi.updateSettings({ appearance: { language: newLang } }).catch(() => {
        // quiet ignore in background
      });
    }
  }, []);

  const t = useCallback(
    (key, params = {}) => {
      if (!key || typeof key !== 'string') return '';
      const keys = key.split('.');
      let val = translations[lang];

      let found = true;
      for (const k of keys) {
        if (val && typeof val === 'object' && k in val) {
          val = val[k];
        } else {
          found = false;
          break;
        }
      }

      // If missing in current language, fall back to English
      if (!found || typeof val !== 'string') {
        if (lang !== 'en') {
          let fallback = translations.en;
          let fbFound = true;
          for (const fb of keys) {
            if (fallback && typeof fallback === 'object' && fb in fallback) {
              fallback = fallback[fb];
            } else {
              fbFound = false;
              break;
            }
          }
          if (fbFound && typeof fallback === 'string') {
            val = fallback;
            found = true;
          }
        }
      }

      // If missing in both, humanize the last segment
      if (!found || typeof val !== 'string') {
        const humanized = humanizeKey(key);
        if (import.meta.env?.DEV) {
          console.warn(`[i18n] Missing translation for key "${key}" (lang: ${lang}). Fallback: "${humanized}"`);
        }
        val = humanized;
      }

      if (typeof val === 'string' && params && typeof params === 'object') {
        let result = val;
        for (const [pKey, pVal] of Object.entries(params)) {
          result = result.replace(new RegExp(`{${pKey}}`, 'g'), String(pVal));
        }
        return result;
      }

      return typeof val === 'string' ? val : humanizeKey(key);
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
